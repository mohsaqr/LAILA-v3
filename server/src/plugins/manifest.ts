/**
 * The plugin manifest — `laila-plugin.json` at the root of every bundle.
 *
 * This file is the contract between LAILA and code it did not write. Everything
 * else in `src/plugins/` keys off the shape validated here, so the schema is
 * deliberately strict: an unknown key is an error, not a shrug. A plugin built
 * for a newer `apiVersion` is refused at install rather than half-loaded at
 * boot, because a plugin that fails *after* registration has already mounted
 * routes and subscribed to events.
 *
 * ## On the security model
 *
 * A plugin's server half runs **inside the Express process** and its client
 * half runs as **real React components in the SPA**. There is no sandbox, and
 * `capabilities` below is not one. Node offers no isolate that still permits
 * async host calls and ordinary npm dependencies, so pretending otherwise
 * would be worse than being plain about it: an installed plugin can read
 * `server/.env`, reach Prisma directly and touch the DOM, exactly as a Moodle
 * or WordPress plugin can.
 *
 * `capabilities` therefore does three honest jobs:
 *   1. it is shown to the admin at install time, so consent is informed;
 *   2. it gates the *supported* host API, so a plugin that stays on the
 *      documented path cannot reach a subsystem it never asked for, and
 *      capability drift shows up as a clean error instead of a silent
 *      dependency;
 *   3. it is recorded, so an audit can answer "what did we agree to run?".
 *
 * The real boundary is provenance: admin-only install, an integrity hash
 * recorded per bundle, and a visible capability list. See `docs/PLUGINS.md`.
 */

import { z } from 'zod';

/**
 * The host API contract version. Bump on a breaking change to anything a
 * plugin can call — the `api` object handed to `register()`, the `laila`
 * object handed to a client component, or the meaning of an extension point.
 *
 * A bundle declaring a different major is refused. Additive changes (a new
 * method, a new optional manifest field, a new extension point) keep the
 * number and are discovered by plugins through feature detection.
 */
export const PLUGIN_API_VERSION = 1;

/**
 * Plugin ids are used as a filesystem directory, a URL path segment and a SQL
 * table prefix, so the character set is the intersection of what all three
 * accept safely. Reverse-DNS shape (at least one dot) keeps ids collision-free
 * across authors without a registry.
 *
 * The explicit length cap matters for the SQL prefix: PostgreSQL truncates
 * identifiers at 63 bytes, and `plug_<id>_<table>` has to survive that.
 */
const PLUGIN_ID = z
  .string()
  .min(3)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/,
    'must be reverse-DNS, lowercase, e.g. "org.example.drag-match"',
  );

/** Semantic version. Compared with `compareVersions` in `version.ts`. */
const SEMVER = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, 'must be semver, e.g. "1.2.0"');

/**
 * A path inside the bundle. Rejects absolute paths, `..`, backslashes and NUL
 * before the unpacker ever sees them — zip entries are attacker-controlled
 * input and path traversal here writes anywhere the Node process can.
 */
const BUNDLE_PATH = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/, 'must be a relative path inside the bundle')
  .refine((p) => !p.split('/').includes('..'), 'must not contain ".."');

/**
 * What a plugin may ask the host for. Declared up front, shown at install,
 * and enforced on the host API object (see `hostApi.ts`).
 */
export const CAPABILITIES = [
  /** Read/write its own JSON key-value store, scoped to the plugin. */
  'store',
  /** Own SQL tables, created by its migrations, queried through `api.db`. */
  'db',
  /** Mount HTTP routes under `/api/plugins/<id>/`. */
  'http',
  /** Subscribe to lifecycle events and register filters. */
  'events',
  /** Call the configured LLM providers through the host's rate limits. */
  'llm',
  /** Read and write files in its own upload namespace. */
  'files',
  /** Read user profiles (id, name, email, role) for the current course. */
  'users:read',
  /** Read grades and submissions for the current course. */
  'grades:read',
  /** Write grades — create or update a submission's score. */
  'grades:write',
  /** Append to the learning activity log. */
  'activity-log',
  /** Read the course design tree (modules, lectures, sections). */
  'course:read',
  /** Contribute to and consume course export packages. */
  'course:export',
  /** Register a scheduled job that runs on an interval. */
  'jobs',
  /** Make outbound network requests to the origins listed in `network`. */
  'network',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const CAPABILITY = z.enum(CAPABILITIES);

/**
 * Extension points. Each is a place in LAILA where a plugin's component or
 * handler is rendered or called. Adding one here is additive — it does not
 * bump `PLUGIN_API_VERSION`.
 */
export const EXTENSION_POINTS = [
  /** A section type a teacher drops into a lesson, beside text/video/MCQ. */
  'lecture.block',
  /** A full-page lab type, beside r/python/sna/tna/network. */
  'lab',
  /** A panel on the analytics dashboard. */
  'dashboard.widget',
  /** A standalone page in a course's navigation. */
  'course.tool',
] as const;

export type ExtensionPoint = (typeof EXTENSION_POINTS)[number];

/**
 * A component export name in the plugin's client bundle. The loader reads it
 * off the module namespace object, so it must be a plain identifier.
 */
const EXPORT_NAME = z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, 'must be a JS identifier');

/**
 * One registration. `id` is unique *within* the plugin; the fully qualified
 * key stored in the database is `plugin:<pluginId>:<id>`, which is what
 * `LectureSection.type` and `CustomLab.labType` carry for plugin-provided
 * content.
 */
const extensionSchema = z
  .object({
    point: z.enum(EXTENSION_POINTS),
    id: z
      .string()
      .min(1)
      .max(48)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase kebab-case'),
    /** Shown in the teacher's block picker / lab list / widget gallery. */
    label: z.string().min(1).max(80),
    /** Shown under the label. Plain text. */
    description: z.string().max(280).optional(),
    /**
     * A lucide-react icon name. Resolved against the host's icon set, so a
     * plugin does not ship its own copy of the library.
     */
    icon: z.string().max(48).optional(),
    /**
     * The component the *student* (or reader) sees. Required for every point
     * except `dashboard.widget`, where it is also required — kept explicit so
     * a missing view is a manifest error, not a blank card at runtime.
     */
    component: EXPORT_NAME,
    /**
     * The component the *teacher* sees while authoring. Optional: a block with
     * no editor is configured entirely through `settings`, which the host
     * renders generically.
     */
    editor: EXPORT_NAME.optional(),
    /**
     * `course.tool` only — the URL segment under `/courses/:slug/t/<path>`.
     */
    path: z
      .string()
      .max(48)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    /**
     * Per-extension settings the host renders as a form for the teacher, and
     * hands back through `laila.getConfig()`. A plugin with a custom `editor`
     * can ignore these entirely.
     */
    settings: z.array(z.lazy(() => settingSchema)).optional(),
  })
  .strict()
  .refine((e) => e.point !== 'course.tool' || !!e.path, {
    message: 'a course.tool extension needs a `path`',
    path: ['path'],
  });

/** A single teacher-facing or admin-facing setting field. */
const settingSchema: z.ZodType<PluginSetting> = z
  .object({
    key: z
      .string()
      .min(1)
      .max(48)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'must be an identifier'),
    label: z.string().min(1).max(120),
    help: z.string().max(280).optional(),
    type: z.enum(['string', 'text', 'number', 'boolean', 'select', 'color', 'url']),
    /** `select` only. */
    options: z
      .array(z.object({ value: z.string().max(120), label: z.string().max(120) }).strict())
      .optional(),
    default: z.union([z.string(), z.number(), z.boolean()]).optional(),
    required: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .strict()
  .refine((s) => s.type !== 'select' || (s.options?.length ?? 0) > 0, {
    message: 'a select setting needs options',
    path: ['options'],
  });

export interface PluginSetting {
  key: string;
  label: string;
  help?: string;
  type: 'string' | 'text' | 'number' | 'boolean' | 'select' | 'color' | 'url';
  options?: { value: string; label: string }[];
  default?: string | number | boolean;
  required?: boolean;
  min?: number;
  max?: number;
}

export const manifestSchema = z
  .object({
    id: PLUGIN_ID,
    name: z.string().min(1).max(80),
    version: SEMVER,
    /** Must match `PLUGIN_API_VERSION`'s major. Refused at install otherwise. */
    apiVersion: z.number().int().positive(),
    description: z.string().max(500).optional(),
    author: z
      .object({
        name: z.string().min(1).max(120),
        email: z.string().email().optional(),
        url: z.string().url().optional(),
      })
      .strict()
      .optional(),
    license: z.string().max(64).optional(),
    homepage: z.string().url().optional(),
    /**
     * A semver range the host must satisfy, e.g. ">=3.16.0". Checked against
     * the running LAILA version at install and again at boot, so an upgrade
     * that outruns a plugin disables it loudly instead of crashing.
     */
    laila: z.string().max(32).optional(),

    /** The Node half. Omit for a client-only plugin. */
    server: z
      .object({
        entry: BUNDLE_PATH,
      })
      .strict()
      .optional(),

    /** The React half. Omit for a server-only plugin (a webhook, a job). */
    client: z
      .object({
        entry: BUNDLE_PATH,
        styles: z.array(BUNDLE_PATH).max(8).optional(),
      })
      .strict()
      .optional(),

    extends: z.array(extensionSchema).max(32).optional(),
    capabilities: z.array(CAPABILITY).max(CAPABILITIES.length).optional(),

    /** Directory of per-dialect SQL migrations. Requires the `db` capability. */
    migrations: BUNDLE_PATH.optional(),
    /** Directory of `<lang>.json` translation files merged into i18n. */
    locales: BUNDLE_PATH.optional(),

    /**
     * Origins the plugin's *server* half may call, and which are added to the
     * page's `connect-src` for its *client* half. Requires `network`.
     * Exact origins only — no wildcards, because a wildcard here would widen
     * the whole instance's CSP.
     */
    network: z
      .array(z.string().url().max(200))
      .max(16)
      .optional(),

    /** Instance-wide settings, rendered in the admin plugin detail page. */
    settings: z.array(settingSchema).max(48).optional(),
  })
  .strict()
  .superRefine((m, ctx) => {
    const needs = (cap: Capability, why: string, path: string[]) => {
      if (!m.capabilities?.includes(cap)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${why} requires the "${cap}" capability`,
          path,
        });
      }
    };
    if (m.migrations) needs('db', 'declaring migrations', ['migrations']);
    if (m.network?.length) needs('network', 'declaring network origins', ['network']);

    // A client entry without extensions renders nothing, and extensions
    // without a client entry name components that cannot be resolved. Either
    // is a packaging mistake worth catching before install.
    if (m.extends?.length && !m.client) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'extensions need a `client.entry` providing their components',
        path: ['client'],
      });
    }
    if (!m.server && !m.client) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'a plugin needs at least a server or a client half',
        path: ['id'],
      });
    }

    // Extension ids must be unique inside the plugin: they become part of the
    // key stored on content rows, and a duplicate would make that key
    // ambiguous forever.
    const seen = new Set<string>();
    m.extends?.forEach((e, i) => {
      const key = `${e.point}:${e.id}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate extension "${key}"`,
          path: ['extends', i, 'id'],
        });
      }
      seen.add(key);
    });
  });

export type PluginManifest = z.infer<typeof manifestSchema>;
export type PluginExtension = PluginManifest extends { extends?: (infer E)[] } ? E : never;

/** The key a content row carries for a plugin-provided extension. */
export const extensionKey = (pluginId: string, extensionId: string): string =>
  `plugin:${pluginId}:${extensionId}`;

/** Inverse of {@link extensionKey}. Returns null for a non-plugin type. */
export const parseExtensionKey = (
  key: string,
): { pluginId: string; extensionId: string } | null => {
  const parts = key.split(':');
  if (parts.length !== 3 || parts[0] !== 'plugin') return null;
  return { pluginId: parts[1], extensionId: parts[2] };
};

export class ManifestError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = 'ManifestError';
    this.issues = issues;
  }
}

/**
 * Parse and validate a manifest.
 *
 * @param raw the parsed JSON of `laila-plugin.json`
 * @throws {ManifestError} with one readable line per problem
 */
export function parseManifest(raw: unknown): PluginManifest {
  const result = manifestSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`,
    );
    throw new ManifestError(`Invalid laila-plugin.json (${issues.length} problem(s))`, issues);
  }
  if (result.data.apiVersion !== PLUGIN_API_VERSION) {
    throw new ManifestError(
      `Plugin targets host API version ${result.data.apiVersion}, this LAILA speaks ${PLUGIN_API_VERSION}`,
    );
  }
  return result.data;
}

/** Capabilities a plugin declared, as a set, for fast gating in the host API. */
export const capabilitySet = (m: PluginManifest): ReadonlySet<Capability> =>
  new Set(m.capabilities ?? []);
