/**
 * Authorization on the plugin runtime endpoints.
 *
 * This file did not exist, which is how the following went unnoticed: a
 * placement's configuration — where a teacher-authored answer key lives — was
 * gated only by the caller's GLOBAL `isInstructor` flag for writes and by
 * nothing but a valid session for reads. `instanceKey` was shape-checked and
 * never resolved to a course, so:
 *
 *   - an instructor of their own course could rewrite the block in someone
 *     else's course by passing that course's section id, and
 *   - any signed-in student could read any placement's config in any course.
 *
 * The tests below are about the placement→course resolution, not about the
 * store: the question is always "is this caller entitled to THIS placement".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../utils/logger.js', () => {
  const noop = () => {};
  return {
    createLogger: () => ({ error: noop, warn: noop, info: noop, debug: noop }),
    authLogger: { error: noop, warn: noop, info: noop, debug: noop },
  };
});

const store = { get: vi.fn(), set: vi.fn() };
vi.mock('../plugins/store.js', () => ({
  createStoreApi: () => store,
  createDataApi: () => ({ get: vi.fn(), set: vi.fn(), forInstance: vi.fn(), delete: vi.fn() }),
  instanceKey: (kind: string, id: number | string) => `${kind}:${id}`,
}));

vi.mock('../plugins/registry.js', () => ({
  pluginRegistry: {
    get: () => ({
      status: 'active',
      manifest: { id: 'org.example.x', extends: [{ id: 'drag-match', point: 'lecture.block' }] },
    }),
    has: () => true,
    list: () => [],
  },
}));

vi.mock('../services/plugin.service.js', () => ({
  pluginService: {},
  PluginInstallError: class extends Error {},
}));
vi.mock('../plugins/loader.js', () => ({ pluginPath: () => '/tmp/nope' }));

vi.mock('../utils/prisma.js', () => ({
  default: {
    course: { findUnique: vi.fn() },
    lectureSection: { findUnique: vi.fn() },
    customLab: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
  },
}));

vi.mock('../services/courseRole.service.js', () => ({
  courseRoleService: { isCourseStaff: vi.fn() },
}));

// The signed-in user is swapped per test.
let currentUser: { id: number; isAdmin: boolean; isInstructor: boolean } | null = null;
vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req: { user?: unknown }, res: { status: (n: number) => { json: (b: unknown) => void } }, next: () => void) => {
    if (!currentUser) return res.status(401).json({ error: 'Authentication required' });
    req.user = currentUser;
    next();
  },
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import prisma from '../utils/prisma.js';
import { courseRoleService } from '../services/courseRole.service.js';
import pluginRoutes from './plugin.routes.js';

const app = express();
app.use(express.json());
app.use('/api/plugins', pluginRoutes);

const OWN_COURSE = 10;
const OTHER_COURSE = 20;
const SECTION_IN_OTHER_COURSE = 991;

const asInstructor = { id: 5, isAdmin: false, isInstructor: true };
const asStudent = { id: 6, isAdmin: false, isInstructor: false };

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = asInstructor;
  // Section 991 lives in a course this instructor has nothing to do with.
  vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue({
    lecture: { module: { courseId: OTHER_COURSE } },
  } as never);
  vi.mocked(prisma.course.findUnique).mockImplementation((async (args: { where: { id: number } }) =>
    ({ id: args.where.id })) as never);
  vi.mocked(prisma.customLab.findUnique).mockResolvedValue({ id: 3, createdBy: 999 } as never);
  vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null as never);
  vi.mocked(courseRoleService.isCourseStaff).mockResolvedValue(false as never);
  store.get.mockResolvedValue({ answer: 'the answer key' });
  store.set.mockResolvedValue(undefined);
});

const putConfig = (instanceKey: string) =>
  request(app)
    .put('/api/plugins/org.example.x/config/drag-match')
    .send({ instanceKey, config: { answer: 'mine' } });

const getConfig = (instanceKey: string) =>
  request(app).get('/api/plugins/org.example.x/config/drag-match').query({ instanceKey });

describe('PUT /api/plugins/:id/config/:extensionId', () => {
  it('refuses an instructor with no standing in the placement\'s course', async () => {
    const res = await putConfig(`section:${SECTION_IN_OTHER_COURSE}`);

    expect(res.status).toBe(403);
    // The write must not have happened.
    expect(store.set).not.toHaveBeenCalled();
    expect(courseRoleService.isCourseStaff).toHaveBeenCalledWith(5, OTHER_COURSE, false);
  });

  it('allows staff of that course', async () => {
    vi.mocked(courseRoleService.isCourseStaff).mockResolvedValue(true as never);

    const res = await putConfig(`section:${SECTION_IN_OTHER_COURSE}`);

    expect(res.status).toBe(200);
    expect(store.set).toHaveBeenCalledOnce();
  });

  it('resolves a course: key to that course directly', async () => {
    vi.mocked(courseRoleService.isCourseStaff).mockResolvedValue(true as never);
    await putConfig(`course:${OWN_COURSE}`);
    expect(courseRoleService.isCourseStaff).toHaveBeenCalledWith(5, OWN_COURSE, false);
  });

  it('refuses a student outright, before any placement lookup', async () => {
    currentUser = asStudent;
    const res = await putConfig(`section:${SECTION_IN_OTHER_COURSE}`);
    expect(res.status).toBe(403);
    expect(store.set).not.toHaveBeenCalled();
  });

  it('refuses a placement that does not exist', async () => {
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(null as never);
    const res = await putConfig('section:4242');
    expect(res.status).toBe(404);
    expect(store.set).not.toHaveBeenCalled();
  });

  // A lab is attachable to many courses, so no single course owns its config.
  it('gates a lab placement on the lab\'s owner, not on a course', async () => {
    const refused = await putConfig('lab:3');
    expect(refused.status).toBe(403);

    vi.mocked(prisma.customLab.findUnique).mockResolvedValue({ id: 3, createdBy: 5 } as never);
    const allowed = await putConfig('lab:3');
    expect(allowed.status).toBe(200);
  });

  it.each(['nonsense', 'section:', 'section:../../etc', 'drop:1'])(
    'refuses the malformed instanceKey %s',
    async (key) => {
      const res = await putConfig(key);
      expect(res.status).toBe(400);
      expect(store.set).not.toHaveBeenCalled();
    },
  );
});

describe('GET /api/plugins/:id/config/:extensionId', () => {
  it('refuses a student who is not in the placement\'s course', async () => {
    currentUser = asStudent;

    const res = await getConfig(`section:${SECTION_IN_OTHER_COURSE}`);

    expect(res.status).toBe(403);
    // The answer key must not have been read, let alone returned.
    expect(store.get).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain('the answer key');
  });

  it('allows an enrolled student', async () => {
    currentUser = asStudent;
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as never);

    const res = await getConfig(`section:${SECTION_IN_OTHER_COURSE}`);

    expect(res.status).toBe(200);
    expect(store.get).toHaveBeenCalledOnce();
  });

  it('allows course staff', async () => {
    vi.mocked(courseRoleService.isCourseStaff).mockResolvedValue(true as never);
    const res = await getConfig(`course:${OWN_COURSE}`);
    expect(res.status).toBe(200);
  });

  it('requires a session at all', async () => {
    currentUser = null;
    const res = await getConfig(`course:${OWN_COURSE}`);
    expect(res.status).toBe(401);
  });
});
