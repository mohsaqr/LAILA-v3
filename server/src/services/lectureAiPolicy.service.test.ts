import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LectureAiPolicyService,
  DEFAULT_LECTURE_AI_POLICY,
  LECTURE_AI_SETTING_KEYS,
  evaluateLectureAi,
  type LectureAiPolicy,
  type LectureAiLectureShape,
  type LectureAiSectionShape,
  type LectureAiAttachmentShape,
} from './lectureAiPolicy.service.js';

// Mock prisma — the policy lives in the SystemSetting key/value table, and
// getAvailability reads the lecture's columns directly.
vi.mock('../utils/prisma.js', () => ({
  default: {
    systemSetting: { findMany: vi.fn() },
    lecture: { findUnique: vi.fn() },
  },
}));

vi.mock('./settings.service.js', () => ({
  settingsService: { updateSystemSetting: vi.fn() },
}));

import prisma from '../utils/prisma.js';

/* -------------------------------------------------------------------------- */
/* Builders                                                                    */
/* -------------------------------------------------------------------------- */

const lecture = (overrides: Partial<LectureAiLectureShape> = {}): LectureAiLectureShape => ({
  content: null,
  contentType: 'text',
  videoUrl: null,
  ...overrides,
});

const textSection = (content = 'Some prose about regression.'): LectureAiSectionShape => ({
  type: 'text',
  content,
  fileName: null,
  fileType: null,
});

const fileSection = (fileName: string, fileType: string | null = null): LectureAiSectionShape => ({
  type: 'file',
  content: null,
  fileName,
  fileType,
});

const attachment = (fileName: string, fileType: string | null = null): LectureAiAttachmentShape => ({
  fileName,
  fileType,
});

const policyWith = (overrides: Partial<LectureAiPolicy> = {}): LectureAiPolicy => ({
  ...DEFAULT_LECTURE_AI_POLICY,
  ...overrides,
});

/** The common case: default policy, nothing else to say. */
const evaluate = (
  sections: LectureAiSectionShape[],
  attachments: LectureAiAttachmentShape[] = [],
  overrides: Partial<LectureAiLectureShape> = {},
  policy: LectureAiPolicy = DEFAULT_LECTURE_AI_POLICY,
) => evaluateLectureAi(lecture(overrides), sections, attachments, policy);

/* -------------------------------------------------------------------------- */

describe('evaluateLectureAi', () => {
  describe('what qualifies', () => {
    it('accepts a lecture that is one text section', () => {
      expect(evaluate([textSection()])).toEqual({ available: true, reason: null });
    });

    it('accepts several text sections', () => {
      expect(evaluate([textSection('One.'), textSection('Two.'), textSection('Three.')]))
        .toEqual({ available: true, reason: null });
    });

    it('accepts a lecture that is one PDF', () => {
      expect(evaluate([fileSection('week-3.pdf', 'application/pdf')]))
        .toEqual({ available: true, reason: null });
    });

    it('accepts text plus one PDF', () => {
      expect(evaluate([textSection(), fileSection('slides.pdf', 'application/pdf')]))
        .toEqual({ available: true, reason: null });
    });

    it('accepts the legacy top-level lecture body as a text page', () => {
      expect(evaluate([], [], { content: '<p>Introduction to the topic.</p>' }))
        .toEqual({ available: true, reason: null });
    });

    it('ignores a blank text section rather than counting it against the lecture', () => {
      // The editor leaves empty sections behind routinely; one must not turn a
      // readable lecture into an unreadable one.
      expect(evaluate([textSection(), textSection('   ')]))
        .toEqual({ available: true, reason: null });
    });
  });

  describe('the fileType column holds either a MIME type or a bare extension', () => {
    it('accepts fileType "application/pdf"', () => {
      expect(evaluate([fileSection('notes.pdf', 'application/pdf')]).available).toBe(true);
    });

    it('accepts a bare "pdf" extension in fileType', () => {
      expect(evaluate([fileSection('notes.pdf', 'pdf')]).available).toBe(true);
    });

    it('accepts a PDF whose fileType is missing entirely, by filename', () => {
      expect(evaluate([fileSection('notes.pdf', null)]).available).toBe(true);
    });

    it('accepts a PDF whose filename carries no extension, by MIME type', () => {
      expect(evaluate([fileSection('scan', 'application/pdf')]).available).toBe(true);
    });

    it('accepts a nonstandard pdf MIME on a file with no extension', () => {
      // The one case where isPdfFile's substring match earns its keep: neither
      // the filename nor the MIME tail yields a plain "pdf" here.
      expect(evaluate([fileSection('scan', 'application/x-pdf')]).available).toBe(true);
    });

    it('refuses a .pptx', () => {
      expect(evaluate([fileSection('deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')]))
        .toEqual({ available: false, reason: 'unsupported' });
    });

    it('refuses a .csv even though it is text-ish', () => {
      expect(evaluate([fileSection('data.csv', 'text/csv')]))
        .toEqual({ available: false, reason: 'unsupported' });
    });

    it('refuses a .txt, because no reader visits file sections other than the PDF one', () => {
      expect(evaluate([fileSection('notes.txt', 'text/plain')]))
        .toEqual({ available: false, reason: 'unsupported' });
    });
  });

  describe('a text section is not necessarily text', () => {
    // TipTap serialises files, videos, folders, URLs, embeds and MCQs as
    // <lecture-*> tags inside a type:'text' row, and buildLectureContext strips
    // them without following them.
    it.each([
      ['<lecture-video', '<p>Watch this.</p><lecture-video data-src="/uploads/x.mp4"></lecture-video>'],
      ['<lecture-file', '<lecture-file data-url="/uploads/a.pdf" data-name="a.pdf"></lecture-file>'],
      ['<lecture-folder', '<lecture-folder data-items="[]"></lecture-folder>'],
      ['<lecture-mcq', '<lecture-mcq data-question="q"></lecture-mcq>'],
      ['<lecture-url', '<lecture-url data-href="https://example.com"></lecture-url>'],
      ['<lecture-embed', '<lecture-embed data-src="https://example.com"></lecture-embed>'],
      ['<lecture-chatbot', '<lecture-chatbot data-id="3"></lecture-chatbot>'],
    ])('refuses a text section containing %s', (_label, content) => {
      expect(evaluate([textSection(content)]))
        .toEqual({ available: false, reason: 'unsupported' });
    });

    it('refuses an embedded PDF too, because the extractor never follows the tag', () => {
      expect(evaluate([textSection('<lecture-file data-url="/uploads/a.pdf" data-type="application/pdf"></lecture-file>')]))
        .toEqual({ available: false, reason: 'unsupported' });
    });

    it('refuses a lesson node in the legacy top-level body', () => {
      expect(evaluate([], [], { content: '<lecture-video data-src="/x.mp4"></lecture-video>' }))
        .toEqual({ available: false, reason: 'unsupported' });
    });
  });

  describe('non-readable section types', () => {
    it('refuses a chatbot section', () => {
      expect(evaluate([{ type: 'chatbot', content: null, fileName: null, fileType: null }]))
        .toEqual({ available: false, reason: 'unsupported' });
    });

    it('refuses an assignment section', () => {
      expect(evaluate([textSection(), { type: 'assignment', content: null, fileName: null, fileType: null }]))
        .toEqual({ available: false, reason: 'unsupported' });
    });

    it('refuses a section type nobody has invented yet', () => {
      expect(evaluate([{ type: 'hologram', content: null, fileName: null, fileType: null }]))
        .toEqual({ available: false, reason: 'unsupported' });
    });

    it('treats ai-generated sections as text', () => {
      expect(evaluate([{ type: 'ai-generated', content: 'A summary.', fileName: null, fileType: null }]).available)
        .toBe(true);
    });
  });

  describe('lecture-level video', () => {
    it('refuses a lecture with a videoUrl', () => {
      expect(evaluate([textSection()], [], { videoUrl: '/uploads/courses/videos/x.mp4' }))
        .toEqual({ available: false, reason: 'unsupported' });
    });

    it('refuses a lecture whose contentType is video', () => {
      expect(evaluate([textSection()], [], { contentType: 'video' }))
        .toEqual({ available: false, reason: 'unsupported' });
    });
  });

  describe('the one-PDF limit', () => {
    it('refuses two PDF sections', () => {
      expect(evaluate([
        fileSection('part-1.pdf', 'application/pdf'),
        fileSection('part-2.pdf', 'application/pdf'),
      ])).toEqual({ available: false, reason: 'too_many_pdfs' });
    });

    it('counts a PDF attachment alongside a PDF section', () => {
      // buildLectureContext reads attachments too, so they are part of the load.
      expect(evaluate(
        [fileSection('slides.pdf', 'application/pdf')],
        [attachment('handout.pdf', 'application/pdf')],
      )).toEqual({ available: false, reason: 'too_many_pdfs' });
    });

    it('accepts text plus a single PDF attachment', () => {
      expect(evaluate([textSection()], [attachment('handout.pdf', 'application/pdf')]))
        .toEqual({ available: true, reason: null });
    });

    it('ignores a non-PDF attachment rather than disqualifying the lecture', () => {
      // A spreadsheet sitting beside a readable page contributes nothing to the
      // prompt either way, so it should not cost the teacher the tools.
      expect(evaluate([textSection()], [attachment('marks.xlsx', 'application/vnd.ms-excel')]))
        .toEqual({ available: true, reason: null });
    });
  });

  describe('nothing to read', () => {
    it('reports empty for a lecture with no sections and no body', () => {
      expect(evaluate([])).toEqual({ available: false, reason: 'empty' });
    });

    it('reports empty when every section is blank', () => {
      expect(evaluate([textSection(''), textSection('  ')]))
        .toEqual({ available: false, reason: 'empty' });
    });
  });

  describe('the admin settings narrow it', () => {
    it('reports disabled when the master toggle is off, whatever the content', () => {
      expect(evaluate([textSection()], [], {}, policyWith({ enabled: false })))
        .toEqual({ available: false, reason: 'disabled' });
    });

    it('prefers "disabled" over a content reason, so the admin sees the real cause', () => {
      expect(evaluate([fileSection('deck.pptx')], [], {}, policyWith({ enabled: false })))
        .toEqual({ available: false, reason: 'disabled' });
    });

    it('refuses a PDF lecture when no file type is enabled', () => {
      expect(evaluate([fileSection('a.pdf', 'application/pdf')], [], {}, policyWith({ fileExtensions: [] })))
        .toEqual({ available: false, reason: 'unsupported' });
    });

    it('refuses a PDF lecture when uploaded files are turned off as a kind', () => {
      expect(evaluate([fileSection('a.pdf', 'application/pdf')], [], {}, policyWith({ resourceKinds: ['page'] })))
        .toEqual({ available: false, reason: 'unsupported' });
    });

    it('refuses a PDF attachment when PDFs are turned off', () => {
      expect(evaluate([textSection()], [attachment('a.pdf', 'application/pdf')], {}, policyWith({ fileExtensions: [] })))
        .toEqual({ available: false, reason: 'unsupported' });
    });

    it('refuses a text lecture when text pages are turned off', () => {
      expect(evaluate([textSection()], [], {}, policyWith({ resourceKinds: ['file'] })))
        .toEqual({ available: false, reason: 'unsupported' });
    });

    it('still accepts a PDF lecture when only files are enabled', () => {
      expect(evaluate([fileSection('a.pdf', 'application/pdf')], [], {}, policyWith({ resourceKinds: ['file'] })))
        .toEqual({ available: true, reason: null });
    });
  });
});

/* -------------------------------------------------------------------------- */

describe('LectureAiPolicyService.getPolicy', () => {
  let service: LectureAiPolicyService;

  /** Make prisma answer findMany from a { key: storedValue } map. */
  const storedSettings = (rows: Record<string, string | null>) => {
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValue(
      Object.entries(rows).map(([settingKey, settingValue]) => ({ settingKey, settingValue })) as any,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LectureAiPolicyService();
  });

  it('reads all three keys in a single query', async () => {
    storedSettings({});
    await service.getPolicy();
    expect(prisma.systemSetting.findMany).toHaveBeenCalledTimes(1);
  });

  it('falls back to the defaults when no rows exist', async () => {
    storedSettings({});
    await expect(service.getPolicy()).resolves.toEqual(DEFAULT_LECTURE_AI_POLICY);
  });

  it('reads a stored policy', async () => {
    storedSettings({
      [LECTURE_AI_SETTING_KEYS.enabled]: 'false',
      [LECTURE_AI_SETTING_KEYS.resourceKinds]: '["page"]',
      [LECTURE_AI_SETTING_KEYS.fileExtensions]: '[]',
    });
    await expect(service.getPolicy()).resolves.toEqual({
      enabled: false,
      resourceKinds: ['page'],
      fileExtensions: [],
    });
  });

  it('keeps an empty selection rather than treating it as unset', async () => {
    // "no file types at all" is a choice an admin can make; it must not silently
    // revert to the default of ["pdf"].
    storedSettings({ [LECTURE_AI_SETTING_KEYS.fileExtensions]: '[]' });
    await expect(service.getPolicy()).resolves.toMatchObject({ fileExtensions: [] });
  });

  it('falls back to the defaults on malformed JSON instead of throwing', async () => {
    storedSettings({
      [LECTURE_AI_SETTING_KEYS.resourceKinds]: 'not json at all',
      [LECTURE_AI_SETTING_KEYS.fileExtensions]: '{"nope": true}',
    });
    await expect(service.getPolicy()).resolves.toEqual(DEFAULT_LECTURE_AI_POLICY);
  });

  it('falls back on an unrecognised boolean rather than reading it as off', async () => {
    storedSettings({ [LECTURE_AI_SETTING_KEYS.enabled]: 'yes please' });
    await expect(service.getPolicy()).resolves.toMatchObject({ enabled: true });
  });

  it('drops a hand-edited kind the server has no reader for', async () => {
    // The admin UI greys these; this is the same rule where it cannot be bypassed.
    storedSettings({ [LECTURE_AI_SETTING_KEYS.resourceKinds]: '["page","video","folder"]' });
    await expect(service.getPolicy()).resolves.toMatchObject({ resourceKinds: ['page'] });
  });

  it('drops a hand-edited file type the server has no extractor for', async () => {
    storedSettings({ [LECTURE_AI_SETTING_KEYS.fileExtensions]: '["pdf","pptx","docx"]' });
    await expect(service.getPolicy()).resolves.toMatchObject({ fileExtensions: ['pdf'] });
  });

  it('falls back to the defaults when the settings table cannot be read', async () => {
    // A broken settings read must not put AI buttons back under a video, and
    // must not switch the feature off platform-wide either.
    vi.mocked(prisma.systemSetting.findMany).mockRejectedValue(new Error('no such table'));
    await expect(service.getPolicy()).resolves.toEqual(DEFAULT_LECTURE_AI_POLICY);
  });

  it('serves the second read from cache', async () => {
    storedSettings({});
    await service.getPolicy();
    await service.getPolicy();
    expect(prisma.systemSetting.findMany).toHaveBeenCalledTimes(1);
  });

  it('re-reads after clearCache, so an admin edit is visible immediately', async () => {
    storedSettings({});
    await service.getPolicy();
    service.clearCache();
    await service.getPolicy();
    expect(prisma.systemSetting.findMany).toHaveBeenCalledTimes(2);
  });
});

/* -------------------------------------------------------------------------- */

describe('LectureAiPolicyService.assertAvailable', () => {
  let service: LectureAiPolicyService;

  const storedLecture = (data: any) => {
    vi.mocked(prisma.lecture.findUnique).mockResolvedValue(data);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LectureAiPolicyService();
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([] as any);
  });

  it('passes an eligible lecture through', async () => {
    storedLecture({
      content: null,
      contentType: 'text',
      videoUrl: null,
      sections: [textSection()],
      attachments: [],
    });
    await expect(service.assertAvailable(1)).resolves.toBeUndefined();
  });

  it('throws 403 for an ineligible lecture, so the UI cannot be bypassed', async () => {
    storedLecture({
      content: null,
      contentType: 'text',
      videoUrl: null,
      sections: [fileSection('deck.pptx')],
      attachments: [],
    });
    await expect(service.assertAvailable(1)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 404 for a lecture that does not exist', async () => {
    storedLecture(null);
    await expect(service.getAvailability(999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('never opens a PDF to answer', async () => {
    // getPdfInfo parses every PDF to count pages. This runs on each lecture
    // render, so it must stay a column read.
    storedLecture({
      content: null,
      contentType: 'text',
      videoUrl: null,
      sections: [fileSection('big.pdf', 'application/pdf')],
      attachments: [],
    });
    await service.getAvailability(1);
    const select = vi.mocked(prisma.lecture.findUnique).mock.calls[0][0] as any;
    expect(select.select.sections.select).not.toHaveProperty('fileUrl');
  });
});
