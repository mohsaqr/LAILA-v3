/**
 * Course import: create a brand-new course from a `.laila.zip` package, and
 * course duplication, which is an export piped straight into an import.
 *
 * The importer owns the new course. Every row is created inside one Prisma
 * transaction, so a package that fails half-way leaves nothing behind; the
 * uploaded blobs are written before the transaction and removed again if it
 * fails.
 *
 * Global rows (chatbots, surveys, custom labs) are handled two ways:
 *   - chatbots are matched by their unique `name` and created only if absent,
 *     because a tutor's identity IS its chatbot and two courses may share one;
 *   - surveys and custom labs get a private copy owned by the importer, since
 *     they carry course-specific content and editing a shared one would leak
 *     changes into another instructor's course.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import type { Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { newUploadUrlFor, resolveUploadPath, rewriteUploadUrls } from '../utils/uploadFiles.js';
import { courseExportService } from './courseExport.service.js';
import {
  COURSE_PACKAGE_FORMAT,
  COURSE_PACKAGE_VERSION,
  coursePackageSchema,
  findDanglingReferences,
  packageManifestSchema,
  type CoursePackage,
  type PackageChatbot,
  type PackageLecture,
  type PackageManifest,
  type PackageModule,
} from './coursePackage.schema.js';

type Tx = Prisma.TransactionClient;

/** Returns the blob for a package file, or null when the package lacks it. */
export type BlobReader = (sha256: string) => Promise<Buffer | null>;

export interface ImportOptions {
  /** Override the course title (duplication uses this for "… (copy)"). */
  title?: string;
}

export interface ImportReport {
  courseId: number;
  slug: string;
  title: string;
  counts: {
    modules: number;
    lectures: number;
    sections: number;
    assignments: number;
    quizzes: number;
    quizQuestions: number;
    surveys: number;
    customLabs: number;
    codeLabs: number;
    forums: number;
    tutors: number;
    rubrics: number;
  };
  chatbots: { matched: string[]; created: string[] };
  files: { copied: number; missing: string[] };
  warnings: string[];
}

const date = (s: string | null): Date | null => (s == null ? null : new Date(s));

const slugFromTitle = (title: string): string =>
  (title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'course') +
  '-' +
  Date.now().toString(36);

/** Most packages are a few MB of JSON plus their files; this is the ceiling. */
export const MAX_PACKAGE_BYTES = 2 * 1024 * 1024 * 1024;

export class CourseImportService {
  /** Parse and validate an uploaded zip, then import it. */
  async importZip(zipBuffer: Buffer, userId: number, options: ImportOptions = {}): Promise<ImportReport> {
    const zip = await JSZip.loadAsync(zipBuffer).catch(() => {
      throw new AppError('Not a zip file', 400);
    });
    const manifestText = await zip.file('manifest.json')?.async('string');
    const courseText = await zip.file('course.json')?.async('string');
    if (!manifestText || !courseText) {
      throw new AppError('Not a LAILA course package: manifest.json or course.json is missing', 400);
    }
    const manifest = this.parseManifest(manifestText);
    const pkg = this.parsePackage(courseText);

    const readBlob: BlobReader = async (sha256) => {
      const entry = zip.file(`files/${sha256}`);
      if (!entry) return null;
      const buf = await entry.async('nodebuffer');
      // A blob whose name does not match its content is a damaged or tampered
      // package; refusing it is safer than serving an unknown file.
      const actual = createHash('sha256').update(buf).digest('hex');
      if (actual !== sha256) {
        throw new AppError(`Package file ${sha256} is corrupt (hash mismatch)`, 400);
      }
      return buf;
    };
    return this.importPackage(pkg, manifest, readBlob, userId, options);
  }

  /**
   * Copy a course inside this instance: export it in memory and import the
   * result, reading blobs straight from the uploads directory. The copy is a
   * draft owned by the caller, with no students, code, or history.
   */
  async duplicateCourse(courseId: number, userId: number, isAdmin = false, options: ImportOptions = {}): Promise<ImportReport> {
    const { pkg, manifest } = await courseExportService.buildPackage(courseId, userId, isAdmin);
    const byHash = new Map(pkg.files.map((f) => [f.sha256, f.url]));
    const readBlob: BlobReader = async (sha256) => {
      const url = byHash.get(sha256);
      const onDisk = url ? resolveUploadPath(url) : null;
      return onDisk ? fs.promises.readFile(onDisk).catch(() => null) : null;
    };
    return this.importPackage(pkg, manifest, readBlob, userId, {
      title: options.title ?? `${pkg.course.title} (copy)`,
    });
  }

  /** Validate `course.json` text; throws a 400 naming the first problems. */
  parsePackage(text: string): CoursePackage {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AppError('course.json is not valid JSON', 400);
    }
    const parsed = coursePackageSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      throw new AppError(`Invalid course package: ${first}`, 400);
    }
    const dangling = findDanglingReferences(parsed.data);
    if (dangling.length > 0) {
      throw new AppError(`Invalid course package: ${dangling.slice(0, 5).join('; ')}`, 400);
    }
    return parsed.data;
  }

  parseManifest(text: string): PackageManifest {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AppError('manifest.json is not valid JSON', 400);
    }
    const parsed = packageManifestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(`Not a ${COURSE_PACKAGE_FORMAT} package`, 400);
    }
    if (parsed.data.formatVersion > COURSE_PACKAGE_VERSION) {
      throw new AppError(
        `This package was made by a newer LAILA (format ${parsed.data.formatVersion}); this server reads up to ${COURSE_PACKAGE_VERSION}`,
        400,
      );
    }
    return parsed.data;
  }

  /**
   * Import an already-validated package. Files first (outside the transaction,
   * rolled back by hand on failure), then every row in one transaction.
   */
  async importPackage(
    input: CoursePackage,
    _manifest: PackageManifest | null,
    readBlob: BlobReader,
    userId: number,
    options: ImportOptions = {},
  ): Promise<ImportReport> {
    const warnings: string[] = [];
    const { pkg, written, missing } = await this.stageFiles(input, readBlob);
    if (missing.length > 0) {
      warnings.push(`${missing.length} file(s) were not in the package and their links were left as-is`);
    }

    try {
      const report = await prisma.$transaction(
        (tx) => this.writeRows(tx, pkg, userId, options, { written: written.length, missing }, warnings),
        // A course with hundreds of sections is many round-trips; the default
        // 5 s interactive-transaction budget is far too small for it.
        { timeout: 10 * 60_000, maxWait: 30_000 },
      );
      return report;
    } catch (err) {
      await Promise.all(written.map((p) => fs.promises.unlink(p).catch(() => undefined)));
      throw err;
    }
  }

  /**
   * Store every packaged blob under a fresh upload name and rewrite all
   * references. The rewrite runs over the serialised package, so a URL is
   * replaced wherever it occurs — a column, lecture HTML, or nested JSON.
   */
  private async stageFiles(
    pkg: CoursePackage,
    readBlob: BlobReader,
  ): Promise<{ pkg: CoursePackage; written: string[]; missing: string[] }> {
    const urlMap = new Map<string, string>();
    const written: string[] = [];
    const missing: string[] = [];
    try {
      // Sequential: each blob may be a large video.
      for (const file of pkg.files) {
        const blob = await readBlob(file.sha256);
        if (!blob) {
          missing.push(file.url);
          continue;
        }
        const newUrl = newUploadUrlFor(file.url);
        const onDisk = resolveUploadPath(newUrl);
        if (!onDisk) {
          missing.push(file.url);
          continue;
        }
        await fs.promises.mkdir(path.dirname(onDisk), { recursive: true });
        await fs.promises.writeFile(onDisk, blob, { flag: 'wx' });
        written.push(onDisk);
        urlMap.set(file.url, newUrl);
      }
    } catch (err) {
      await Promise.all(written.map((p) => fs.promises.unlink(p).catch(() => undefined)));
      throw err;
    }
    const rewritten = JSON.parse(rewriteUploadUrls(JSON.stringify(pkg), urlMap)) as CoursePackage;
    return { pkg: rewritten, written, missing };
  }

  private async writeRows(
    tx: Tx,
    pkg: CoursePackage,
    userId: number,
    options: ImportOptions,
    files: { written: number; missing: string[] },
    warnings: string[],
  ): Promise<ImportReport> {
    const title = options.title?.trim() || pkg.course.title;
    const chatbots = { matched: [] as string[], created: [] as string[] };
    const counts: ImportReport['counts'] = {
      modules: 0, lectures: 0, sections: 0, assignments: 0, quizzes: 0, quizQuestions: 0,
      surveys: 0, customLabs: 0, codeLabs: 0, forums: 0, tutors: 0, rubrics: 0,
    };

    // A new course is always an unpublished draft with no activation code: the
    // code is a signup sponsorship in a global namespace, never portable.
    const course = await tx.course.create({
      data: {
        title,
        slug: slugFromTitle(title),
        description: pkg.course.description,
        thumbnail: pkg.course.thumbnail,
        instructorId: userId,
        difficulty: pkg.course.difficulty,
        status: 'draft',
        isPublic: pkg.course.isPublic,
        collaborativeModuleName: pkg.course.collaborativeModuleName,
        collaborativeModuleEnabled: pkg.course.collaborativeModuleEnabled,
        emotionalPulseEnabled: pkg.course.emotionalPulseEnabled,
        tutorsEnabled: pkg.course.tutorsEnabled,
        tutorRoutingMode: pkg.course.tutorRoutingMode,
        curriculumViewMode: pkg.course.curriculumViewMode,
        openLinkLecturesDirectly: pkg.course.openLinkLecturesDirectly,
        enabledLabs: pkg.course.enabledLabs,
        startTime: date(pkg.course.startTime),
      },
    });

    for (const catTitle of pkg.categories) {
      const category = await tx.category.upsert({ where: { title: catTitle }, update: {}, create: { title: catTitle } });
      await tx.courseCategory.create({ data: { courseId: course.id, categoryId: category.id } });
    }

    const chatbotIdByName = new Map<string, number>();
    const resolveChatbot = async (c: PackageChatbot): Promise<number> => {
      const cached = chatbotIdByName.get(c.name);
      if (cached != null) return cached;
      const existing = await tx.chatbot.findUnique({ where: { name: c.name }, select: { id: true } });
      let id: number;
      if (existing) {
        id = existing.id;
        chatbots.matched.push(c.name);
      } else {
        const created = await tx.chatbot.create({
          data: { ...c, creatorId: userId, isActive: true, isSystem: false },
          select: { id: true },
        });
        id = created.id;
        chatbots.created.push(c.name);
      }
      chatbotIdByName.set(c.name, id);
      return id;
    };
    // A bare name (code lab / custom lab helper) carries no definition to
    // create from, so it resolves to an existing chatbot or to none.
    const lookupChatbot = async (name: string | null, where: string): Promise<number | null> => {
      if (name == null) return null;
      const cached = chatbotIdByName.get(name);
      if (cached != null) return cached;
      const found = await tx.chatbot.findUnique({ where: { name }, select: { id: true } });
      if (!found) {
        warnings.push(`${where}: AI helper "${name}" does not exist here and was left unset`);
        return null;
      }
      chatbotIdByName.set(name, found.id);
      return found.id;
    };

    const surveyIdByKey = new Map<string, number>();
    for (const s of pkg.surveys) {
      const survey = await tx.survey.create({
        data: {
          title: s.title,
          description: s.description,
          createdById: userId,
          isPublished: s.isPublished,
          isAnonymous: s.isAnonymous,
          questions: {
            create: s.questions.map((q) => ({
              questionText: q.questionText,
              questionType: q.questionType,
              options: q.options,
              isRequired: q.isRequired,
              orderIndex: q.orderIndex,
            })),
          },
        },
        select: { id: true },
      });
      surveyIdByKey.set(s.key, survey.id);
      counts.surveys += 1;
    }

    const labIdByKey = new Map<string, number>();
    for (const lab of pkg.customLabs) {
      const created = await tx.customLab.create({
        data: {
          name: lab.name,
          description: lab.description,
          labType: lab.labType,
          config: lab.config,
          aiChatbotId: await lookupChatbot(lab.aiChatbotName, `lab "${lab.name}"`),
          createdBy: userId,
          isPublic: false,
          templates: {
            create: lab.cells.map((c) => ({
              title: c.title,
              description: c.description,
              content: c.content,
              code: c.code,
              orderIndex: c.orderIndex,
              locked: c.locked,
              cellType: c.cellType,
            })),
          },
        },
        select: { id: true },
      });
      labIdByKey.set(lab.key, created.id);
      counts.customLabs += 1;
    }

    // Modules and lectures first (without sections), because sections point at
    // assignments and assignments point back at lectures.
    const moduleIdByKey = new Map<string, number>();
    const lectureIdByKey = new Map<string, number>();
    const pendingLectures: Array<{ id: number; lecture: PackageLecture }> = [];
    const createModule = async (m: PackageModule, parentId: number | null): Promise<void> => {
      const mod = await tx.courseModule.create({
        data: {
          courseId: course.id,
          parentId,
          title: m.title,
          description: m.description,
          label: m.label,
          orderIndex: m.orderIndex,
          isPublished: m.isPublished,
          availableFrom: date(m.availableFrom),
          availableUntil: date(m.availableUntil),
          interactiveLabs: m.interactiveLabs,
        },
        select: { id: true },
      });
      moduleIdByKey.set(m.key, mod.id);
      counts.modules += 1;

      for (const l of m.lectures) {
        const lecture = await tx.lecture.create({
          data: {
            moduleId: mod.id,
            title: l.title,
            description: l.description,
            content: l.content,
            contentType: l.contentType,
            videoUrl: l.videoUrl,
            duration: l.duration,
            orderIndex: l.orderIndex,
            isPublished: l.isPublished,
            isFree: l.isFree,
            availableFrom: date(l.availableFrom),
            availableUntil: date(l.availableUntil),
            attachments: { create: l.attachments },
          },
          select: { id: true },
        });
        lectureIdByKey.set(l.key, lecture.id);
        pendingLectures.push({ id: lecture.id, lecture: l });
        counts.lectures += 1;
      }

      for (const cl of m.codeLabs) {
        await tx.codeLab.create({
          data: {
            moduleId: mod.id,
            title: cl.title,
            description: cl.description,
            orderIndex: cl.orderIndex,
            isPublished: cl.isPublished,
            availableFrom: date(cl.availableFrom),
            availableUntil: date(cl.availableUntil),
            aiChatbotId: await lookupChatbot(cl.aiChatbotName, `code lab "${cl.title}"`),
            blocks: { create: cl.blocks },
          },
        });
        counts.codeLabs += 1;
      }

      for (const ms of m.moduleSurveys) {
        await tx.moduleSurvey.create({
          data: {
            courseId: course.id,
            moduleId: mod.id,
            surveyId: surveyIdByKey.get(ms.surveyKey) as number,
            orderIndex: ms.orderIndex,
          },
        });
      }

      for (const child of m.children) {
        await createModule(child, mod.id);
      }
    };
    for (const m of pkg.modules) {
      await createModule(m, null);
    }

    const assignmentIdByKey = new Map<string, number>();
    for (const a of pkg.assignments) {
      const created = await tx.assignment.create({
        data: {
          courseId: course.id,
          moduleId: a.moduleKey != null ? moduleIdByKey.get(a.moduleKey) ?? null : null,
          lectureId: a.lectureKey != null ? lectureIdByKey.get(a.lectureKey) ?? null : null,
          title: a.title,
          description: a.description,
          instructions: a.instructions,
          submissionType: a.submissionType,
          maxFileSize: a.maxFileSize,
          allowedFileTypes: a.allowedFileTypes,
          dueDate: date(a.dueDate),
          gracePeriodDeadline: date(a.gracePeriodDeadline),
          availableFrom: date(a.availableFrom),
          availableUntil: date(a.availableUntil),
          points: a.points,
          weight: a.weight,
          isPublished: a.isPublished,
          aiAssisted: a.aiAssisted,
          aiPrompt: a.aiPrompt,
          agentRequirements: a.agentRequirements,
          reflectionRequirement: a.reflectionRequirement,
          postSurveyId: a.postSurveyKey != null ? surveyIdByKey.get(a.postSurveyKey) ?? null : null,
          postSurveyRequired: a.postSurveyRequired,
          orderIndex: a.orderIndex,
          attachments: { create: a.attachments },
        },
        select: { id: true },
      });
      assignmentIdByKey.set(a.key, created.id);
      counts.assignments += 1;
    }

    for (const { id, lecture } of pendingLectures) {
      if (lecture.sections.length === 0) continue;
      await tx.lectureSection.createMany({
        data: lecture.sections.map((s) => ({
          lectureId: id,
          title: s.title,
          type: s.type,
          content: s.content,
          fileName: s.fileName,
          fileUrl: s.fileUrl,
          fileType: s.fileType,
          fileSize: s.fileSize,
          order: s.order,
          chatbotTitle: s.chatbotTitle,
          chatbotIntro: s.chatbotIntro,
          chatbotImageUrl: s.chatbotImageUrl,
          chatbotSystemPrompt: s.chatbotSystemPrompt,
          chatbotWelcome: s.chatbotWelcome,
          assignmentId: s.assignmentKey != null ? assignmentIdByKey.get(s.assignmentKey) ?? null : null,
          showDeadline: s.showDeadline,
          showPoints: s.showPoints,
        })),
      });
      counts.sections += lecture.sections.length;
    }

    for (const q of pkg.quizzes) {
      await tx.quiz.create({
        data: {
          courseId: course.id,
          moduleId: q.moduleKey != null ? moduleIdByKey.get(q.moduleKey) ?? null : null,
          title: q.title,
          description: q.description,
          instructions: q.instructions,
          timeLimit: q.timeLimit,
          maxAttempts: q.maxAttempts,
          passingScore: q.passingScore,
          shuffleQuestions: q.shuffleQuestions,
          shuffleOptions: q.shuffleOptions,
          showResults: q.showResults,
          isPublished: q.isPublished,
          dueDate: date(q.dueDate),
          availableFrom: date(q.availableFrom),
          availableUntil: date(q.availableUntil),
          orderIndex: q.orderIndex,
          questions: { create: q.questions },
        },
      });
      counts.quizzes += 1;
      counts.quizQuestions += q.questions.length;
    }

    for (const la of pkg.labAssignments) {
      await tx.labAssignment.create({
        data: {
          courseId: course.id,
          labId: labIdByKey.get(la.labKey) as number,
          moduleId: la.moduleKey != null ? moduleIdByKey.get(la.moduleKey) ?? null : null,
          assignmentId: la.assignmentKey != null ? assignmentIdByKey.get(la.assignmentKey) ?? null : null,
          orderIndex: la.orderIndex,
          isPublished: la.isPublished,
        },
      });
    }

    for (const f of pkg.forums) {
      await tx.forumThread.create({
        data: {
          courseId: course.id,
          moduleId: f.moduleKey != null ? moduleIdByKey.get(f.moduleKey) ?? null : null,
          authorId: userId,
          title: f.title,
          content: f.content,
          description: f.description,
          isPublished: f.isPublished,
          availableFrom: date(f.availableFrom),
          availableUntil: date(f.availableUntil),
          allowAnonymous: f.allowAnonymous,
          orderIndex: f.orderIndex,
          isPinned: f.isPinned,
          isLocked: f.isLocked,
        },
      });
      counts.forums += 1;
    }

    const tutorIdByKey = new Map<string, number>();
    for (const t of pkg.tutors) {
      const chatbotId = await resolveChatbot(t.chatbot);
      const tutor = await tx.courseTutor.create({
        data: {
          courseId: course.id,
          chatbotId,
          customName: t.customName,
          customDescription: t.customDescription,
          customSystemPrompt: t.customSystemPrompt,
          customWelcomeMessage: t.customWelcomeMessage,
          customPersonality: t.customPersonality,
          customTemperature: t.customTemperature,
          isActive: t.isActive,
          displayOrder: t.displayOrder,
        },
        select: { id: true },
      });
      tutorIdByKey.set(t.key, tutor.id);
      counts.tutors += 1;
    }

    for (const r of pkg.rubrics) {
      await tx.rubric.create({
        data: {
          title: r.title,
          description: r.description,
          courseId: course.id,
          createdById: userId,
          isTemplate: r.isTemplate,
          criteria: { create: r.criteria },
        },
      });
      counts.rubrics += 1;
    }

    if (pkg.course.defaultTutorKey != null) {
      await tx.course.update({
        where: { id: course.id },
        data: { defaultTutorId: tutorIdByKey.get(pkg.course.defaultTutorKey) ?? null },
      });
    }

    return {
      courseId: course.id,
      slug: course.slug,
      title,
      counts,
      chatbots,
      files: { copied: files.written, missing: files.missing },
      warnings,
    };
  }
}

export const courseImportService = new CourseImportService();
