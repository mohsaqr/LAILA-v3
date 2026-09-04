import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { AppError } from '../middleware/error.middleware.js';
import { minimalPackage, FIXTURE_FILE_URL } from './coursePackage.fixtures.js';
import { COURSE_PACKAGE_FORMAT, COURSE_PACKAGE_VERSION } from './coursePackage.schema.js';

// ---- fs: nothing touches the real uploads directory --------------------------
const fsState = {
  written: new Map<string, Buffer>(),
  unlinked: [] as string[],
};
vi.mock('node:fs', () => ({
  default: {
    promises: {
      mkdir: vi.fn(async () => undefined),
      writeFile: vi.fn(async (p: string, data: Buffer) => {
        fsState.written.set(p, data);
      }),
      unlink: vi.fn(async (p: string) => {
        fsState.unlinked.push(p);
      }),
      readFile: vi.fn(async () => {
        throw new Error('not used');
      }),
    },
  },
}));

// ---- prisma: a transaction client that hands out ids and records calls --------
type Call = { model: string; op: string; args: any; id: number };
const calls: Call[] = [];
let nextId = 100;
const record = (model: string, op: string) =>
  vi.fn(async (args: any) => {
    const id = nextId++;
    calls.push({ model, op, args, id });
    if (op === 'createMany') return { count: args.data.length };
    return { id, ...(args?.data ?? args?.create ?? {}) };
  });
const chatbotFindUnique = vi.fn();
const tx: any = {
  course: { create: record('course', 'create'), update: record('course', 'update') },
  category: { upsert: record('category', 'upsert') },
  courseCategory: { create: record('courseCategory', 'create') },
  chatbot: { findUnique: chatbotFindUnique, create: record('chatbot', 'create') },
  survey: { create: record('survey', 'create') },
  customLab: { create: record('customLab', 'create') },
  courseModule: { create: record('courseModule', 'create') },
  lecture: { create: record('lecture', 'create') },
  codeLab: { create: record('codeLab', 'create') },
  moduleSurvey: { create: record('moduleSurvey', 'create') },
  assignment: { create: record('assignment', 'create') },
  lectureSection: { createMany: record('lectureSection', 'createMany') },
  quiz: { create: record('quiz', 'create') },
  labAssignment: { create: record('labAssignment', 'create') },
  forumThread: { create: record('forumThread', 'create') },
  courseTutor: { create: record('courseTutor', 'create') },
  rubric: { create: record('rubric', 'create') },
};
const transaction = vi.fn(async (fn: (t: any) => Promise<unknown>, _opts?: unknown) => fn(tx));
vi.mock('../utils/prisma.js', () => ({
  default: { $transaction: (fn: any, opts: any) => transaction(fn, opts) },
}));

vi.mock('./courseExport.service.js', () => ({
  courseExportService: { buildPackage: vi.fn() },
}));

import { courseImportService } from './courseImport.service.js';
import { courseExportService } from './courseExport.service.js';

const BLOB = Buffer.from('pdf');
const BLOB_SHA = createHash('sha256').update(BLOB).digest('hex');

/** The fixture but with a real hash for its one file. */
const pkgWithBlob = () => {
  const pkg = minimalPackage();
  pkg.files = [{ url: FIXTURE_FILE_URL, sha256: BLOB_SHA, size: BLOB.length }];
  return pkg;
};
const readBlob = async (sha: string) => (sha === BLOB_SHA ? BLOB : null);
const find = (model: string, op = 'create') => calls.filter((c) => c.model === model && c.op === op);
/** Id the fake transaction handed out for the n-th create on `model`. */
const getId = (model: string, n: number): number => find(model)[n].id;

beforeEach(() => {
  calls.length = 0;
  nextId = 100;
  fsState.written.clear();
  fsState.unlinked.length = 0;
  chatbotFindUnique.mockReset();
  transaction.mockClear();
});

describe('importPackage', () => {
  it('creates a draft course owned by the importer with every key resolved', async () => {
    // stats-tutor exists here; ghost-helper (code lab AI) does not.
    chatbotFindUnique.mockImplementation(async ({ where }: any) =>
      where.name === 'stats-tutor' ? { id: 7 } : null,
    );

    const report = await courseImportService.importPackage(pkgWithBlob(), null, readBlob, 42);

    const course = find('course')[0].args.data;
    expect(course.instructorId).toBe(42);
    expect(course.status).toBe('draft');
    expect(course.title).toBe('Learning Analytics 101');
    expect(course.slug).toMatch(/^learning-analytics-101-[0-9a-z]+$/);
    expect(course).not.toHaveProperty('activationCode');
    expect(course).not.toHaveProperty('publishedAt');

    // The transaction budget was raised above Prisma's 5 s default.
    expect(transaction.mock.calls[0][1]).toMatchObject({ timeout: 600_000 });

    // Files: blob stored under a new name, every reference rewritten.
    expect(fsState.written.size).toBe(1);
    const [newPath, data] = [...fsState.written.entries()][0];
    expect(data).toBe(BLOB);
    expect(newPath).toMatch(/-notes\.pdf$/);
    expect(newPath).not.toContain('11111111-1111');
    const lecture = find('lecture')[0].args.data;
    expect(lecture.attachments.create[0].fileUrl).not.toBe(FIXTURE_FILE_URL);
    expect(lecture.attachments.create[0].fileUrl).toMatch(/^\/uploads\/[0-9a-f-]{36}-notes\.pdf$/);
    const sections = find('lectureSection', 'createMany')[0].args.data;
    expect(sections[0].content).toContain(lecture.attachments.create[0].fileUrl);
    expect(sections[0].content).not.toContain(FIXTURE_FILE_URL);

    // Cross-references resolve to the ids the transaction handed out.
    const assignment = find('assignment')[0];
    expect(find('courseModule')[0].args.data.parentId).toBeNull();
    expect(assignment.args.data.moduleId).toBe(getId('courseModule', 0));
    expect(assignment.args.data.lectureId).toBe(getId('lecture', 0));
    expect(assignment.args.data.postSurveyId).toBe(getId('survey', 0));
    expect(sections[1].assignmentId).toBe(getId('assignment', 0));
    expect(find('moduleSurvey')[0].args.data.surveyId).toBe(getId('survey', 0));
    expect(find('labAssignment')[0].args.data.labId).toBe(getId('customLab', 0));
    expect(find('courseTutor')[0].args.data.chatbotId).toBe(7);
    expect(find('course', 'update')[0].args.data.defaultTutorId).toBe(getId('courseTutor', 0));

    // Ownership of global copies moves to the importer.
    expect(find('survey')[0].args.data.createdById).toBe(42);
    expect(find('customLab')[0].args.data).toMatchObject({ createdBy: 42, isPublic: false });
    expect(find('forumThread')[0].args.data.authorId).toBe(42);
    expect(find('rubric')[0].args.data).toMatchObject({ createdById: 42, courseId: getId('course', 0) });

    // Dates come back as Date objects.
    expect(find('courseModule')[0].args.data.availableFrom).toBeInstanceOf(Date);
    expect(assignment.args.data.dueDate?.toISOString()).toBe('2026-10-01T00:00:00.000Z');

    // Category matched by title.
    expect(find('category', 'upsert')[0].args.where).toEqual({ title: 'Analytics' });

    expect(report.chatbots).toEqual({ matched: ['stats-tutor'], created: [] });
    expect(find('codeLab')[0].args.data.aiChatbotId).toBeNull();
    expect(report.warnings).toEqual(['code lab "R warm-up": AI helper "ghost-helper" does not exist here and was left unset']);
    expect(report.files).toEqual({ copied: 1, missing: [] });
    expect(report.counts).toEqual({
      modules: 1, lectures: 1, sections: 2, assignments: 1, quizzes: 1, quizQuestions: 1,
      surveys: 1, customLabs: 1, codeLabs: 1, forums: 1, tutors: 1, rubrics: 1,
    });
    expect(report.courseId).toBe(getId('course', 0));
  });

  it('creates the tutor chatbot when no chatbot of that name exists', async () => {
    chatbotFindUnique.mockResolvedValue(null);
    const report = await courseImportService.importPackage(pkgWithBlob(), null, readBlob, 42);
    const created = find('chatbot')[0].args.data;
    expect(created).toMatchObject({ name: 'stats-tutor', creatorId: 42, isSystem: false, isActive: true });
    expect(report.chatbots).toEqual({ matched: [], created: ['stats-tutor'] });
    expect(find('courseTutor')[0].args.data.chatbotId).toBe(getId('chatbot', 0));
  });

  it('honours a title override', async () => {
    chatbotFindUnique.mockResolvedValue({ id: 7 });
    const report = await courseImportService.importPackage(pkgWithBlob(), null, readBlob, 1, { title: 'Copy of LA' });
    expect(find('course')[0].args.data.title).toBe('Copy of LA');
    expect(report.title).toBe('Copy of LA');
  });

  it('keeps the original URL and warns when a blob is missing from the package', async () => {
    chatbotFindUnique.mockResolvedValue({ id: 7 });
    const report = await courseImportService.importPackage(pkgWithBlob(), null, async () => null, 1);
    expect(fsState.written.size).toBe(0);
    expect(find('lecture')[0].args.data.attachments.create[0].fileUrl).toBe(FIXTURE_FILE_URL);
    expect(report.files).toEqual({ copied: 0, missing: [FIXTURE_FILE_URL] });
    expect(report.warnings[0]).toMatch(/1 file\(s\) were not in the package/);
  });

  it('removes staged files and rethrows when the transaction fails', async () => {
    chatbotFindUnique.mockResolvedValue({ id: 7 });
    transaction.mockRejectedValueOnce(new Error('db down'));
    await expect(courseImportService.importPackage(pkgWithBlob(), null, readBlob, 1)).rejects.toThrow('db down');
    expect(fsState.written.size).toBe(1);
    expect(fsState.unlinked).toEqual([...fsState.written.keys()]);
  });
});

describe('parsePackage', () => {
  it('rejects invalid JSON, schema violations and dangling keys as 400s', () => {
    expect(() => courseImportService.parsePackage('{')).toThrow(AppError);
    expect(() => courseImportService.parsePackage('{}')).toThrow(/Invalid course package/);
    const pkg = minimalPackage();
    pkg.labAssignments[0].labKey = 'nope';
    const err = (() => {
      try {
        courseImportService.parsePackage(JSON.stringify(pkg));
      } catch (e) {
        return e as AppError;
      }
      return null;
    })();
    expect(err?.statusCode).toBe(400);
    expect(err?.message).toContain('labAssignment lab refers to unknown key "nope"');
  });
});

describe('importZip', () => {
  const manifest = (over: Record<string, unknown> = {}) => ({
    format: COURSE_PACKAGE_FORMAT,
    formatVersion: COURSE_PACKAGE_VERSION,
    exportedAt: '2026-09-04T00:00:00.000Z',
    exporter: { application: 'LAILA', version: 'test' },
    source: { courseId: 1, slug: 'x', title: 'X' },
    ...over,
  });
  const buildZip = async (opts: { manifest?: object | null; pkg?: object; blob?: Buffer | null } = {}) => {
    const zip = new JSZip();
    if (opts.manifest !== null) zip.file('manifest.json', JSON.stringify(opts.manifest ?? manifest()));
    zip.file('course.json', JSON.stringify(opts.pkg ?? pkgWithBlob()));
    if (opts.blob !== null) zip.file(`files/${BLOB_SHA}`, opts.blob ?? BLOB);
    return zip.generateAsync({ type: 'nodebuffer' });
  };

  it('imports a well-formed package end to end', async () => {
    chatbotFindUnique.mockResolvedValue({ id: 7 });
    const report = await courseImportService.importZip(await buildZip(), 5);
    expect(report.files.copied).toBe(1);
    expect([...fsState.written.values()][0]).toEqual(BLOB);
  });

  it('rejects a blob whose content does not match its name', async () => {
    chatbotFindUnique.mockResolvedValue({ id: 7 });
    await expect(courseImportService.importZip(await buildZip({ blob: Buffer.from('tampered') }), 5)).rejects.toThrow(
      /corrupt/,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects non-zip input and packages without a manifest', async () => {
    await expect(courseImportService.importZip(Buffer.from('hello'), 5)).rejects.toThrow('Not a zip file');
    await expect(courseImportService.importZip(await buildZip({ manifest: null }), 5)).rejects.toThrow(/manifest\.json/);
  });

  it('rejects a package from a newer format version', async () => {
    const zip = await buildZip({ manifest: manifest({ formatVersion: COURSE_PACKAGE_VERSION + 1 }) });
    await expect(courseImportService.importZip(zip, 5)).rejects.toThrow(/newer LAILA/);
  });
});

describe('duplicateCourse', () => {
  it('exports then imports with a "(copy)" title, reading blobs from disk', async () => {
    chatbotFindUnique.mockResolvedValue({ id: 7 });
    const pkg = minimalPackage();
    pkg.files = []; // nothing on disk in this test
    vi.mocked(courseExportService.buildPackage).mockResolvedValue({ pkg, manifest: manifestStub, missingFiles: [] });
    const report = await courseImportService.duplicateCourse(3, 42, false);
    expect(courseExportService.buildPackage).toHaveBeenCalledWith(3, 42, false);
    expect(report.title).toBe('Learning Analytics 101 (copy)');
    expect(find('course')[0].args.data.instructorId).toBe(42);
  });
});

const manifestStub = {
  format: COURSE_PACKAGE_FORMAT,
  formatVersion: COURSE_PACKAGE_VERSION,
  exportedAt: '2026-09-04T00:00:00.000Z',
  exporter: { application: 'LAILA', version: 'test' },
  source: { courseId: 3, slug: 'x', title: 'X' },
} as const;
