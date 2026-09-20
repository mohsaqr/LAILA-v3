/**
 * Plugin administration, asset serving, and the runtime endpoints a plugin's
 * client half calls.
 *
 * Three audiences, three auth levels, deliberately not collapsed:
 *
 *   - **admin** — install, enable, disable, uninstall, settings. Installing a
 *     plugin means running its code in this process, so it is admin-only and
 *     nothing weaker will do.
 *   - **any signed-in user** — the client manifest (which plugins to load) and
 *     the asset files themselves. A student's browser must be able to fetch a
 *     block's code to render their lesson.
 *   - **the plugin's own routes** — mounted under `/api/plugins/<id>/api`,
 *     behind `authenticateToken`, so a plugin route always knows who is
 *     calling and can never be reached anonymously by accident.
 *
 * Assets are served from **LAILA's own origin**, which is what lets a plugin's
 * client half be real React rather than an iframe: `script-src 'self'` already
 * permits it, so no CSP change is needed for a plugin to ship UI.
 */

import { Router, Response, Request, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { pluginService, PluginInstallError } from '../services/plugin.service.js';
import { pluginRegistry } from '../plugins/registry.js';
import { pluginPath } from '../plugins/loader.js';
import { parseExtensionKey } from '../plugins/manifest.js';
import { createStoreApi, createDataApi } from '../plugins/store.js';
import { APP_VERSION } from '../config/buildInfo.js';

const router = Router();

/** A plugin bundle is read into memory by the zip parser. */
const MAX_BUNDLE_BYTES = 64 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BUNDLE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.(zip|laila-plugin\.zip)$/i.test(file.originalname)) cb(null, true);
    else cb(new AppError('Expected a .laila-plugin.zip bundle', 400));
  },
});

/**
 * Validate a plugin id coming from a URL before it reaches the filesystem or
 * the registry. The manifest schema enforces the same shape at install; this
 * is the boundary for ids that arrive from a client instead.
 */
const pluginIdParam = (raw: string): string => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(raw)) {
    throw new AppError('Invalid plugin id', 400);
  }
  return raw;
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** Every installed plugin, with live status. */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ success: true, data: await pluginService.list() });
  }),
);

/** Install or upgrade a plugin from an uploaded bundle. */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  upload.single('bundle'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) throw new AppError('No bundle uploaded (field "bundle")', 400);
    const enable = req.body?.enable === 'true' || req.body?.enable === true;
    const allowDowngrade = req.body?.allowDowngrade === 'true';
    try {
      const result = await pluginService.install(req.file.buffer, {
        hostVersion: APP_VERSION,
        userId: req.user!.id,
        enable,
        allowDowngrade,
      });
      res.status(201).json({
        success: true,
        data: {
          id: result.manifest.id,
          name: result.manifest.name,
          version: result.manifest.version,
          capabilities: result.manifest.capabilities ?? [],
          extensions: (result.manifest.extends ?? []).map((e) => ({
            point: e.point,
            id: e.id,
            label: e.label,
          })),
          upgraded: result.upgraded,
          previousVersion: result.previousVersion,
          migrationsApplied: result.migrationsApplied,
          restartRequired: result.restartRequired,
          warnings: result.warnings,
        },
      });
    } catch (err) {
      // A manifest with several problems should report all of them, not the
      // first — an author fixing one at a time is a miserable loop.
      if (err instanceof PluginInstallError && err.issues.length) {
        res.status(err.statusCode).json({
          success: false,
          error: err.message,
          issues: err.issues,
        });
        return;
      }
      throw err;
    }
  }),
);

router.post(
  '/:id/enable',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = pluginIdParam(req.params.id);
    const { warnings } = await pluginService.enable(id, APP_VERSION);
    res.json({ success: true, data: { id, enabled: true, warnings } });
  }),
);

router.post(
  '/:id/disable',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = pluginIdParam(req.params.id);
    await pluginService.disable(id);
    res.json({ success: true, data: { id, enabled: false } });
  }),
);

/**
 * Uninstall. `?dropData=true` also drops the plugin's own SQL tables — off by
 * default, because uninstalling to upgrade is far more common than
 * uninstalling to forget.
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = pluginIdParam(req.params.id);
    const dropData = req.query.dropData === 'true';
    const { droppedTables } = await pluginService.uninstall(id, dropData);
    res.json({ success: true, data: { id, droppedTables } });
  }),
);

router.put(
  '/:id/settings',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = pluginIdParam(req.params.id);
    const settings = req.body?.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw new AppError('Body must be { settings: { ... } }', 400);
    }
    await pluginService.updateSettings(id, settings as Record<string, unknown>);
    res.json({ success: true, data: { id } });
  }),
);

// ---------------------------------------------------------------------------
// What the SPA needs in order to load plugins
// ---------------------------------------------------------------------------

/**
 * The client manifest: every active plugin that ships UI, with the URL of its
 * bundle and the extensions it registers.
 *
 * Signed-in rather than admin — every student rendering a lesson needs it.
 * Deliberately minimal: no capabilities, no settings, no author metadata. Only
 * what the loader must have to fetch and mount the code.
 */
router.get(
  '/client/manifest',
  authenticateToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const plugins = pluginRegistry
      .active()
      .filter((p) => p.manifest.client)
      .map((p) => ({
        id: p.manifest.id,
        name: p.manifest.name,
        version: p.manifest.version,
        // Cache-busted by version so an upgrade is picked up without a hard
        // refresh, and cacheable forever within a version.
        entry: `/api/plugins/${p.manifest.id}/assets/${p.manifest.client!.entry}?v=${p.manifest.version}`,
        styles: (p.manifest.client!.styles ?? []).map(
          (s) => `/api/plugins/${p.manifest.id}/assets/${s}?v=${p.manifest.version}`,
        ),
        extensions: (p.manifest.extends ?? []).map((e) => ({
          point: e.point,
          id: e.id,
          key: `plugin:${p.manifest.id}:${e.id}`,
          label: e.label,
          description: e.description,
          icon: e.icon,
          component: e.component,
          editor: e.editor,
          path: e.path,
          settings: e.settings ?? [],
        })),
      }));
    res.json({ success: true, data: { plugins } });
  }),
);

/**
 * Serve a file out of a plugin's directory.
 *
 * The path is resolved and re-checked against the plugin root: `pluginPath`
 * throws on escape, and `req.params[0]` is whatever the client sent.
 */
router.get(
  '/:id/assets/*',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = pluginIdParam(req.params.id);
    const plugin = pluginRegistry.get(id);
    if (!plugin || plugin.status !== 'active') throw new AppError('Plugin not available', 404);

    const rel = (req.params as unknown as Record<string, string>)[0] ?? '';
    // The manifest only ever points at files it shipped; anything else is a
    // probe. `pluginPath` refuses traversal, and this refuses the obvious.
    if (!rel || rel.includes('..') || rel.includes('\0')) {
      throw new AppError('Invalid asset path', 400);
    }

    let file: string;
    try {
      file = pluginPath(id, rel);
    } catch {
      throw new AppError('Invalid asset path', 400);
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new AppError('Asset not found', 404);
    }

    // A plugin's JS must be served with a JS type or the browser refuses to
    // execute it as a module; express's default for an unknown extension is
    // application/octet-stream.
    const ext = path.extname(file).toLowerCase();
    const type =
      ext === '.js' || ext === '.mjs'
        ? 'text/javascript; charset=utf-8'
        : ext === '.css'
          ? 'text/css; charset=utf-8'
          : ext === '.json'
            ? 'application/json; charset=utf-8'
            : undefined;
    if (type) res.type(type);
    // Immutable within a version: the manifest appends ?v=<version>.
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(file);
  }),
);

// ---------------------------------------------------------------------------
// Runtime endpoints the client SDK calls
// ---------------------------------------------------------------------------

/** Resolve and authorise an extension key from the request. */
const requireExtension = (pluginId: string, extensionId: string) => {
  const plugin = pluginRegistry.get(pluginId);
  if (!plugin || plugin.status !== 'active') throw new AppError('Plugin not available', 404);
  const ext = (plugin.manifest.extends ?? []).find((e) => e.id === extensionId);
  if (!ext) throw new AppError('Unknown extension', 404);
  return { plugin, ext };
};

/** An instance key must be one of the shapes the host mints, not free text. */
const validInstanceKey = (raw: unknown): string => {
  if (typeof raw !== 'string' || !/^(section|lab|tool|course):[A-Za-z0-9_-]{1,64}$/.test(raw)) {
    throw new AppError('Invalid instanceKey', 400);
  }
  return raw;
};

/** Read the calling user's own state for one extension instance. */
router.get(
  '/:id/state/:extensionId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = pluginIdParam(req.params.id);
    requireExtension(id, req.params.extensionId);
    const key = validInstanceKey(req.query.instanceKey);
    const record = await createDataApi(id).get(req.user!.id, key);
    res.json({ success: true, data: record });
  }),
);

/**
 * Write the calling user's own state.
 *
 * `userId` is taken from the token, never the body: a student could otherwise
 * write another student's row, and `score` feeds the gradebook.
 */
router.put(
  '/:id/state/:extensionId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = pluginIdParam(req.params.id);
    requireExtension(id, req.params.extensionId);
    const key = validInstanceKey(req.body?.instanceKey);

    const body = req.body as {
      data?: Record<string, unknown>;
      score?: number | null;
      maxScore?: number | null;
      completed?: boolean;
      courseId?: number | null;
    };
    if (body.data !== undefined && (typeof body.data !== 'object' || body.data === null)) {
      throw new AppError('`data` must be an object', 400);
    }

    const record = await createDataApi(id).set(req.user!.id, key, {
      extensionId: req.params.extensionId,
      data: body.data,
      score: body.score,
      maxScore: body.maxScore,
      completed: body.completed,
      courseId: body.courseId ?? null,
    });
    res.json({ success: true, data: record });
  }),
);

/**
 * The teacher-authored configuration for one placement of an extension.
 *
 * Config is per instance and lives in the plugin's own store, so a plugin does
 * not need the `db` capability to be configurable.
 */
router.get(
  '/:id/config/:extensionId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = pluginIdParam(req.params.id);
    requireExtension(id, req.params.extensionId);
    const key = validInstanceKey(req.query.instanceKey);
    const config = await createStoreApi(id).get(`config:${req.params.extensionId}:${key}`);
    res.json({ success: true, data: config ?? {} });
  }),
);

/**
 * Save a placement's configuration. Instructor-only — this is authoring, and a
 * student writing it would rewrite the block for everyone.
 */
router.put(
  '/:id/config/:extensionId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (!user.isInstructor && !user.isAdmin) {
      throw new AppError('Only instructors can configure a plugin block', 403);
    }
    const id = pluginIdParam(req.params.id);
    requireExtension(id, req.params.extensionId);
    const key = validInstanceKey(req.body?.instanceKey);
    const config = req.body?.config;
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new AppError('Body must be { instanceKey, config: { ... } }', 400);
    }
    await createStoreApi(id).set(`config:${req.params.extensionId}:${key}`, config);
    res.json({ success: true });
  }),
);

/**
 * Everything a plugin's own router registered, under
 * `/api/plugins/<id>/api/...`.
 *
 * Resolved per request rather than mounted at boot, because plugins come and
 * go while the process runs and Express offers no supported way to unmount a
 * router. The indirection costs one map lookup and means a disabled plugin's
 * routes stop answering immediately.
 */
router.use(
  '/:id/api',
  authenticateToken,
  (req: Request, res: Response, next: NextFunction) => {
    let id: string;
    try {
      id = pluginIdParam((req.params as Record<string, string>).id);
    } catch (err) {
      next(err);
      return;
    }
    const plugin = pluginRegistry.get(id);
    if (!plugin || plugin.status !== 'active') {
      next(new AppError('Plugin not available', 404));
      return;
    }
    const pluginRouter = plugin.registration.router;
    if (!pluginRouter) {
      next(new AppError('Plugin exposes no HTTP routes', 404));
      return;
    }
    pluginRouter(req, res, next);
  },
);

export { parseExtensionKey };
export default router;
