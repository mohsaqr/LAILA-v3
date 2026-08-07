import prisma from '../utils/prisma.js';
import { settingsService } from './settings.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { createLogger } from '../utils/logger.js';
import { isPdfFile, fileExtensionOf } from '../utils/fileKind.js';

const logger = createLogger('lectureAiPolicy');

/**
 * Which lectures may offer the AI study tools (Explain / Discuss / Practice).
 *
 * The tools used to render under every lecture, including videos, folders of
 * files, `.pptx` decks and CSVs. The server can only extract text from **PDFs**
 * (`pdfExtractor.service.ts`) — there is no DOCX, PPTX, transcript or URL
 * reader — so on that content the model was answering from the lecture title
 * alone, or the request failed outright.
 *
 * The rule this file enforces is therefore not a taste judgement: **a lecture is
 * eligible when the AI can read all of it.** Anything the extractor cannot see
 * makes the lecture ineligible, because a confident answer drawn from a fraction
 * of the material is worse than no button.
 *
 * Admins narrow it further through three settings rows. They cannot *widen* it
 * past what the extractors support — see `parseKinds` / `parseExtensions`.
 */

export const LECTURE_AI_SETTING_KEYS = {
  enabled: 'lectureAi.enabled',
  resourceKinds: 'lectureAi.enabledResourceKinds',
  fileExtensions: 'lectureAi.enabledFileExtensions',
} as const;

/**
 * Every kind a lecture part can be. Only `page` and `file` are readable today;
 * the rest are listed so the admin UI can show them greyed with a reason,
 * rather than pretending they do not exist.
 */
export const LECTURE_AI_RESOURCE_KINDS = [
  'page',
  'file',
  'video',
  'url',
  'embed',
  'folder',
  'image',
  'chatbot',
] as const;
export type LectureAiResourceKind = (typeof LECTURE_AI_RESOURCE_KINDS)[number];

/** Kinds an extractor exists for. Widening this needs code, not a setting. */
export const SUPPORTED_RESOURCE_KINDS: LectureAiResourceKind[] = ['page', 'file'];

/** File extensions the admin UI offers. Only `pdf` is readable today. */
export const LECTURE_AI_FILE_EXTENSIONS = [
  'pdf',
  'docx',
  'pptx',
  'txt',
  'md',
  'csv',
  'xlsx',
] as const;
export type LectureAiFileExtension = (typeof LECTURE_AI_FILE_EXTENSIONS)[number];

/**
 * Extensions an extractor exists for.
 *
 * `txt` and `md` look like they should work and do not: `buildLectureContext`
 * only ever calls `pdfExtractorService` on a `file` section, so an uploaded
 * `.txt` contributes nothing to the prompt. Adding them here without adding a
 * reader would produce exactly the empty-context failure this gate exists to
 * prevent.
 */
export const SUPPORTED_FILE_EXTENSIONS: LectureAiFileExtension[] = ['pdf'];

/**
 * How many PDFs a lecture may carry and still qualify.
 *
 * This is a scope decision, not a technical ceiling — the extractor handles any
 * number. One PDF keeps the prompt inside `MAX_PDF_CHARS` with room for the
 * conversation, and keeps the page-range selector meaningful.
 */
export const MAX_PDFS = 1;

export type LectureAiUnavailableReason =
  /** The site-wide toggle is off. */
  | 'disabled'
  /** Contains something no extractor can read. */
  | 'unsupported'
  /** More than `MAX_PDFS`. */
  | 'too_many_pdfs'
  /** Nothing readable in it at all — an empty or not-yet-authored lecture. */
  | 'empty';

export interface LectureAiAvailability {
  available: boolean;
  reason: LectureAiUnavailableReason | null;
}

export interface LectureAiPolicy {
  enabled: boolean;
  resourceKinds: LectureAiResourceKind[];
  fileExtensions: LectureAiFileExtension[];
}

/** The stored defaults, and the fallback whenever a key is missing. */
export const DEFAULT_LECTURE_AI_POLICY: LectureAiPolicy = {
  enabled: true,
  resourceKinds: ['page', 'file'],
  fileExtensions: ['pdf'],
};

/** Seeded alongside the other system settings; see settings.service.ts. */
export const LECTURE_AI_DEFAULT_SETTINGS = [
  {
    settingKey: LECTURE_AI_SETTING_KEYS.enabled,
    settingValue: String(DEFAULT_LECTURE_AI_POLICY.enabled),
    settingType: 'boolean',
    description: 'Offer the AI study tools (Explain, Discuss, Practice) on lectures',
  },
  {
    settingKey: LECTURE_AI_SETTING_KEYS.resourceKinds,
    settingValue: JSON.stringify(DEFAULT_LECTURE_AI_POLICY.resourceKinds),
    settingType: 'json',
    description: 'Lecture content kinds the AI study tools may act on',
  },
  {
    settingKey: LECTURE_AI_SETTING_KEYS.fileExtensions,
    settingValue: JSON.stringify(DEFAULT_LECTURE_AI_POLICY.fileExtensions),
    settingType: 'json',
    description: 'File types the AI study tools may read',
  },
];

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

/*
 * Every parser here takes a fallback and never throws, matching the rule the
 * rest of this codebase states explicitly (llmBudget.service.ts:98-105,
 * registrationPolicy.service.ts): a hand-edited or half-written settings row
 * must not take a feature down.
 *
 * The direction chosen when a row is unreadable is **the defaults**, not "off"
 * and not "everything". The defaults still apply the content gate, so a broken
 * row can never put AI buttons back under a video; it only restores the
 * intended behaviour of the feature.
 */

const parseBoolean = (value: string | null | undefined, fallback: boolean): boolean => {
  if (value === null || value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
};

/** A JSON string array, narrowed to `allowed`. Anything else → `fallback`. */
const parseList = <T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T[],
): T[] => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return fallback;
    // An empty selection is a legitimate choice ("no file types at all"), so an
    // empty array is returned as-is rather than treated as "unset".
    return parsed.filter((v): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v));
  } catch {
    return fallback;
  }
};

/**
 * Narrowed to what an extractor exists for, so a hand-edited row cannot enable
 * a kind the server would then fail to read. The admin UI greys these out; this
 * is the same rule enforced where it cannot be bypassed.
 */
const parseKinds = (value: string | null | undefined): LectureAiResourceKind[] =>
  parseList(value, SUPPORTED_RESOURCE_KINDS, DEFAULT_LECTURE_AI_POLICY.resourceKinds);

const parseExtensions = (value: string | null | undefined): LectureAiFileExtension[] =>
  parseList(value, SUPPORTED_FILE_EXTENSIONS, DEFAULT_LECTURE_AI_POLICY.fileExtensions);

/* -------------------------------------------------------------------------- */
/* The predicate                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The shapes `evaluateLectureAi` needs. Declared structurally rather than as
 * Prisma types so the predicate stays pure and its test needs no database.
 */
export interface LectureAiLectureShape {
  content: string | null;
  contentType: string | null;
  videoUrl: string | null;
}

export interface LectureAiSectionShape {
  type: string;
  content: string | null;
  fileName: string | null;
  fileType: string | null;
}

export interface LectureAiAttachmentShape {
  fileName: string | null;
  fileType: string | null;
}

/**
 * TipTap serialises files, videos, folders, URLs, embeds and MCQs as
 * `<lecture-*>` tags **inside a `type: 'text'` section** — `MoodleCourseEditor`
 * persists five of its palette kinds that way. So `type === 'text'` says where
 * the row is stored, not what it holds, and a gate written against `type` alone
 * lets every one of them through.
 *
 * `buildLectureContext` strips these tags and never follows them, so a page
 * carrying one is genuinely unreadable in part. Treat any of them as
 * disqualifying, including `<lecture-file>` pointing at a PDF: the extractor
 * only visits `type: 'file'` sections and attachments, so that PDF would be
 * silently absent from the prompt.
 */
const containsLessonNode = (content: string | null): boolean =>
  !!content && content.includes('<lecture-');

const isBlank = (content: string | null): boolean => !content || content.trim() === '';

/**
 * Decide whether one lecture may offer the AI study tools.
 *
 * Pure: no Prisma, no settings read, no clock. Everything it needs is an
 * argument, which is what makes the eligibility matrix cheap to test.
 */
export const evaluateLectureAi = (
  lecture: LectureAiLectureShape,
  sections: LectureAiSectionShape[],
  attachments: LectureAiAttachmentShape[],
  policy: LectureAiPolicy,
): LectureAiAvailability => {
  const unavailable = (reason: LectureAiUnavailableReason): LectureAiAvailability => ({
    available: false,
    reason,
  });

  if (!policy.enabled) return unavailable('disabled');

  // A lecture-level video is the whole lecture, and there is no transcript
  // reader. Checked before the sections because such a lecture often has none.
  if (lecture.videoUrl || lecture.contentType === 'video') return unavailable('unsupported');

  const pageAllowed = policy.resourceKinds.includes('page');
  const fileAllowed = policy.resourceKinds.includes('file');
  const extensionAllowed = (ext: string): boolean =>
    fileAllowed && (policy.fileExtensions as string[]).includes(ext);

  let pageCount = 0;
  let pdfCount = 0;

  // The legacy top-level body. Same rules as a text section: it is one.
  if (!isBlank(lecture.content)) {
    if (containsLessonNode(lecture.content) || !pageAllowed) return unavailable('unsupported');
    pageCount += 1;
  }

  for (const section of sections) {
    if (section.type === 'text' || section.type === 'ai-generated') {
      // A blank section is not content and must not disqualify a lecture — the
      // editor leaves them behind routinely.
      if (isBlank(section.content)) continue;
      if (containsLessonNode(section.content) || !pageAllowed) return unavailable('unsupported');
      pageCount += 1;
      continue;
    }

    if (section.type === 'file') {
      const ext = isPdfFile(section.fileType, section.fileName)
        ? 'pdf'
        : fileExtensionOf(section.fileName, section.fileType);
      if (!extensionAllowed(ext)) return unavailable('unsupported');
      pdfCount += 1;
      continue;
    }

    // 'chatbot', 'assignment', and anything a future migration adds.
    return unavailable('unsupported');
  }

  for (const attachment of attachments) {
    // Attachments are side downloads rather than the lecture body, so a
    // non-PDF one does not disqualify the lecture — it contributes nothing to
    // the prompt either way, and a teacher attaching a spreadsheet alongside a
    // readable page should not lose the tools for it.
    //
    // A PDF attachment is different: `buildLectureContext` *does* read it, so
    // it counts toward the limit and is refused when PDFs are turned off.
    if (!isPdfFile(attachment.fileType, attachment.fileName)) continue;
    if (!extensionAllowed('pdf')) return unavailable('unsupported');
    pdfCount += 1;
  }

  if (pdfCount > MAX_PDFS) return unavailable('too_many_pdfs');
  if (pageCount === 0 && pdfCount === 0) return unavailable('empty');

  return { available: true, reason: null };
};

/* -------------------------------------------------------------------------- */
/* Service                                                                     */
/* -------------------------------------------------------------------------- */

export class LectureAiPolicyService {
  private policyCache: { value: LectureAiPolicy; expiresAt: number } | null = null;
  private readonly cacheMs = 60 * 1000;

  /**
   * The stored policy, cached briefly. One batched read rather than a
   * `findUnique` per key — this is consulted on every lecture render.
   */
  async getPolicy(): Promise<LectureAiPolicy> {
    if (this.policyCache && Date.now() < this.policyCache.expiresAt) return this.policyCache.value;

    try {
      const rows = await prisma.systemSetting.findMany({
        where: { settingKey: { in: Object.values(LECTURE_AI_SETTING_KEYS) } },
        select: { settingKey: true, settingValue: true },
      });
      const byKey = new Map(rows.map(r => [r.settingKey, r.settingValue]));

      const value: LectureAiPolicy = {
        enabled: parseBoolean(
          byKey.get(LECTURE_AI_SETTING_KEYS.enabled),
          DEFAULT_LECTURE_AI_POLICY.enabled,
        ),
        resourceKinds: parseKinds(byKey.get(LECTURE_AI_SETTING_KEYS.resourceKinds)),
        fileExtensions: parseExtensions(byKey.get(LECTURE_AI_SETTING_KEYS.fileExtensions)),
      };

      this.policyCache = { value, expiresAt: Date.now() + this.cacheMs };
      return value;
    } catch (err) {
      logger.warn({ err }, 'Could not read the lecture AI policy, using defaults');
      return DEFAULT_LECTURE_AI_POLICY;
    }
  }

  /** Call after writing any of the three rows, or the change waits out the TTL. */
  clearCache(): void {
    this.policyCache = null;
  }

  /**
   * Write the supplied fields; untouched fields keep their stored value.
   *
   * Each write re-supplies the type and description from the seed array, so a
   * row edited through the API keeps the metadata a fresh seed would have given
   * it. Returns the re-read policy so the caller sees the normalised result
   * rather than its own patch echoed back.
   */
  async updatePolicy(patch: Partial<LectureAiPolicy>): Promise<LectureAiPolicy> {
    const describedBy = new Map(LECTURE_AI_DEFAULT_SETTINGS.map(s => [s.settingKey, s] as const));
    type SettingKey = (typeof LECTURE_AI_SETTING_KEYS)[keyof typeof LECTURE_AI_SETTING_KEYS];

    const writes: Array<Promise<unknown>> = [];
    const write = (key: SettingKey, value: string) => {
      const meta = describedBy.get(key);
      writes.push(
        settingsService.updateSystemSetting(key, value, {
          type: meta?.settingType,
          description: meta?.description,
        }),
      );
    };

    if (patch.enabled !== undefined) {
      write(LECTURE_AI_SETTING_KEYS.enabled, String(patch.enabled));
    }
    if (patch.resourceKinds !== undefined) {
      write(LECTURE_AI_SETTING_KEYS.resourceKinds, JSON.stringify(patch.resourceKinds));
    }
    if (patch.fileExtensions !== undefined) {
      write(LECTURE_AI_SETTING_KEYS.fileExtensions, JSON.stringify(patch.fileExtensions));
    }

    await Promise.all(writes);
    this.clearCache();
    return this.getPolicy();
  }

  /**
   * Whether one lecture may offer the tools.
   *
   * Deliberately cheap: it reads columns only. It must never call
   * `lectureAIHelperService.getPdfInfo`, which opens and parses every PDF to
   * count pages — acceptable behind a click, not on every lecture render.
   */
  async getAvailability(lectureId: number): Promise<LectureAiAvailability> {
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      select: {
        content: true,
        contentType: true,
        videoUrl: true,
        sections: {
          select: { type: true, content: true, fileName: true, fileType: true },
          orderBy: { order: 'asc' },
        },
        attachments: { select: { fileName: true, fileType: true } },
      },
    });

    if (!lecture) throw new AppError('Lecture not found', 404);

    const policy = await this.getPolicy();
    return evaluateLectureAi(lecture, lecture.sections, lecture.attachments, policy);
  }

  /**
   * Refuse an ineligible lecture.
   *
   * The greyed-out buttons in the client are a courtesy; this is the control.
   * Without it a student can POST straight to the endpoint and spend tokens on
   * a lecture an admin has turned off.
   */
  async assertAvailable(lectureId: number): Promise<void> {
    const { available, reason } = await this.getAvailability(lectureId);
    if (available) return;

    logger.info({ lectureId, reason }, 'Refused AI study tools for an ineligible lecture');
    throw new AppError(`AI study tools are not available for this lecture (${reason})`, 403);
  }
}

export const lectureAiPolicyService = new LectureAiPolicyService();
