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
  /**
   * Personal data, when the package carried any.
   *
   * `matched` / `unmatched` are people, by email. An unmatched person's rows
   * are skipped, never invented: see `writePersonalData` on why an import may
   * not create accounts.
   */
  people?: { matched: number; unmatched: string[] };
  personalCounts?: {
    enrollments: number;
    lectureProgress: number;
    submissions: number;
    assignmentGrades: number;
    quizAttempts: number;
    surveyResponses: number;
    discussionThreads: number;
    discussionPosts: number;
    conversations: number;
    activity: number;
  };
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
    const sectionIdByKey = new Map<string, number>();
    // Reading section ids back costs a query per lecture, so only do it when a
    // conversation in this package actually points at one.
    const needSectionKeys = (pkg.conversations ?? []).some((c) => c.sectionKey != null);
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
    const quizIdByKey = new Map<string, number>();
    const threadIdByKey = new Map<string, number>();
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

      // Conversations reference the section they happened in. createMany
      // returns no ids, so read them back in insertion order and zip with the
      // package's array. Only when a conversation actually needs it.
      if (needSectionKeys) {
        const created = await tx.lectureSection.findMany({
          where: { lectureId: id },
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        lecture.sections.forEach((sec, i) => {
          if (sec.key && created[i]) sectionIdByKey.set(sec.key, created[i].id);
        });
      }
    }

    for (const q of pkg.quizzes) {
      const createdQuiz = await tx.quiz.create({
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
        select: { id: true },
      });
      quizIdByKey.set(q.key, createdQuiz.id);
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
      const createdThread = await tx.forumThread.create({
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
        select: { id: true },
      });
      if (f.key) threadIdByKey.set(f.key, createdThread.id);
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

    const personal = await this.writePersonalData(tx, pkg, course.id, warnings, {
      moduleIdByKey,
      lectureIdByKey,
      sectionIdByKey,
      assignmentIdByKey,
      quizIdByKey,
      surveyIdByKey,
      threadIdByKey,
      tutorIdByKey,
    });

    return {
      courseId: course.id,
      slug: course.slug,
      title,
      counts,
      chatbots,
      files: { copied: files.written, missing: files.missing },
      ...(personal ?? {}),
      warnings,
    };
  }

  /**
   * Write the personal-data sections a package carried.
   *
   * ## Why this never creates a user
   *
   * A package is an uploaded file. If importing one could create accounts, a
   * crafted `people` roster would be an account-creation primitive in the
   * hands of anyone who can import — and the roster carries an email, which is
   * the identity the whole platform keys on. So people are **matched by email
   * against existing users, and nothing else happens**. Rows belonging to
   * someone this instance does not know are skipped and their email reported,
   * which is information the importer can act on (invite them, then re-import)
   * rather than a silent hole.
   *
   * Enrollments are the one place a match has an effect beyond data: matching
   * a person enrolls them. That is the point of importing enrollments, and it
   * is why the export side gates these sections on course-owner rights.
   *
   * @returns the report fragment, or null when the package carried nothing
   */
  private async writePersonalData(
    tx: Tx,
    pkg: CoursePackage,
    courseId: number,
    warnings: string[],
    keys: {
      moduleIdByKey: Map<string, number>;
      lectureIdByKey: Map<string, number>;
      sectionIdByKey: Map<string, number>;
      assignmentIdByKey: Map<string, number>;
      quizIdByKey: Map<string, number>;
      surveyIdByKey: Map<string, number>;
      threadIdByKey: Map<string, number>;
      tutorIdByKey: Map<string, number>;
    },
  ): Promise<Pick<ImportReport, 'people' | 'personalCounts'> | null> {
    const people = pkg.people ?? [];
    const hasPersonal =
      people.length > 0 ||
      (pkg.enrollments?.length ?? 0) > 0 ||
      (pkg.activity?.length ?? 0) > 0;
    if (!hasPersonal) return null;

    // Match by email, case-insensitively normalised the way the rest of the
    // platform stores it.
    const emails = people.map((p) => p.email.trim().toLowerCase());
    const existing = emails.length
      ? await tx.user.findMany({
          where: { email: { in: emails } },
          select: { id: true, email: true },
        })
      : [];
    const idByEmail = new Map(existing.map((u) => [u.email.trim().toLowerCase(), u.id]));

    const userIdByKey = new Map<string, number>();
    const unmatched: string[] = [];
    people.forEach((person) => {
      const id = idByEmail.get(person.email.trim().toLowerCase());
      if (id != null) userIdByKey.set(person.key, id);
      else unmatched.push(person.email);
    });
    if (unmatched.length) {
      warnings.push(
        `${unmatched.length} of ${people.length} people in this package have no account here; ` +
          `their rows were skipped. Invite them and re-import to bring their data across.`,
      );
    }

    /** Resolve a userKey, or null when that person is not on this instance. */
    const uid = (k: string | null | undefined): number | null =>
      k == null ? null : userIdByKey.get(k) ?? null;

    const counts = {
      enrollments: 0, lectureProgress: 0, submissions: 0, assignmentGrades: 0,
      quizAttempts: 0, surveyResponses: 0, discussionThreads: 0, discussionPosts: 0,
      conversations: 0, activity: 0,
    };

    // --- enrollments -------------------------------------------------------
    // Needed before progress, which hangs off an enrollment row.
    const enrollmentIdByUser = new Map<number, number>();
    for (const e of pkg.enrollments ?? []) {
      const userId = uid(e.userKey);
      if (userId == null) continue;
      const created = await tx.enrollment.create({
        data: {
          userId,
          courseId,
          status: e.status,
          progress: e.progress,
          enrolledAt: date(e.enrolledAt) ?? new Date(),
          completedAt: date(e.completedAt),
          lastAccessAt: date(e.lastAccessAt),
        },
        select: { id: true },
      });
      enrollmentIdByUser.set(userId, created.id);
      counts.enrollments += 1;
    }

    // --- progress ----------------------------------------------------------
    for (const p of pkg.lectureProgress ?? []) {
      const userId = uid(p.userKey);
      const lectureId = keys.lectureIdByKey.get(p.lectureKey);
      if (userId == null || lectureId == null) continue;
      // Progress without an enrollment has nowhere to hang: the row is keyed by
      // enrollmentId. Skip rather than invent an enrollment the package did not
      // ask for.
      const enrollmentId = enrollmentIdByUser.get(userId);
      if (enrollmentId == null) continue;
      await tx.lectureProgress.create({
        data: {
          enrollmentId,
          lectureId,
          isCompleted: p.isCompleted,
          completedAt: date(p.completedAt),
          timeSpent: p.timeSpent,
        },
      });
      counts.lectureProgress += 1;
    }

    // --- submissions and their grades --------------------------------------
    // One row holds both, so they are merged here: a package carrying only
    // grades still creates the submission row the grade belongs to.
    type SubmissionDraft = {
      userId: number;
      assignmentId: number;
      content: string | null;
      fileUrls: string | null;
      status: string;
      submittedAt: Date;
      grade: number | null;
      feedback: string | null;
      aiFeedback: string | null;
      gradedAt: Date | null;
      gradedById: number | null;
    };
    const drafts = new Map<string, SubmissionDraft>();
    const draftKey = (userId: number, assignmentId: number) => `${userId}:${assignmentId}`;

    for (const sub of pkg.submissions ?? []) {
      const userId = uid(sub.userKey);
      const assignmentId = keys.assignmentIdByKey.get(sub.assignmentKey);
      if (userId == null || assignmentId == null) continue;
      drafts.set(draftKey(userId, assignmentId), {
        userId,
        assignmentId,
        content: sub.content,
        fileUrls: sub.fileUrls,
        status: sub.status,
        submittedAt: date(sub.submittedAt) ?? new Date(),
        grade: null,
        feedback: null,
        aiFeedback: null,
        gradedAt: null,
        gradedById: null,
      });
    }

    for (const g of pkg.grades?.assignments ?? []) {
      const userId = uid(g.userKey);
      const assignmentId = keys.assignmentIdByKey.get(g.assignmentKey);
      if (userId == null || assignmentId == null) continue;
      const k = draftKey(userId, assignmentId);
      const draft = drafts.get(k) ?? {
        userId,
        assignmentId,
        content: null,
        fileUrls: null,
        // A grade with no submission body means the work came in some other
        // way; 'graded' is the honest status rather than pretending it was
        // submitted through LAILA.
        status: 'graded',
        submittedAt: date(g.gradedAt) ?? new Date(),
        grade: null,
        feedback: null,
        aiFeedback: null,
        gradedAt: null,
        gradedById: null,
      };
      draft.grade = g.grade;
      draft.feedback = g.feedback;
      draft.aiFeedback = g.aiFeedback;
      draft.gradedAt = date(g.gradedAt);
      draft.gradedById = uid(g.gradedByKey);
      drafts.set(k, draft);
      counts.assignmentGrades += 1;
    }

    for (const draft of drafts.values()) {
      await tx.assignmentSubmission.create({ data: draft });
      counts.submissions += 1;
    }

    // --- quiz attempts -----------------------------------------------------
    for (const a of pkg.grades?.quizAttempts ?? []) {
      const userId = uid(a.userKey);
      const quizId = keys.quizIdByKey.get(a.quizKey);
      if (userId == null || quizId == null) continue;

      // Answers reference questions by position in the exported quiz, so the
      // imported questions have to be read back in the same order.
      const questions = await tx.quizQuestion.findMany({
        where: { quizId },
        select: { id: true },
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
      });
      await tx.quizAttempt.create({
        data: {
          quizId,
          userId,
          attemptNumber: a.attemptNumber,
          startedAt: date(a.startedAt) ?? new Date(),
          submittedAt: date(a.submittedAt),
          score: a.score,
          pointsEarned: a.pointsEarned,
          pointsTotal: a.pointsTotal,
          timeTaken: a.timeTaken,
          status: a.status,
          answers: {
            create: a.answers
              .filter((ans) => questions[ans.questionIndex])
              .map((ans) => ({
                questionId: questions[ans.questionIndex].id,
                answer: ans.answer,
                isCorrect: ans.isCorrect,
                pointsAwarded: ans.pointsAwarded,
              })),
          },
        },
      });
      counts.quizAttempts += 1;
    }

    // --- survey responses --------------------------------------------------
    for (const r of pkg.grades?.surveyResponses ?? []) {
      const surveyId = keys.surveyIdByKey.get(r.surveyKey);
      if (surveyId == null) continue;
      // A response with a userKey we cannot resolve is skipped; one exported
      // WITHOUT a userKey is anonymous by design and imports as anonymous.
      const userId = r.userKey == null ? null : uid(r.userKey);
      if (r.userKey != null && userId == null) continue;

      const questions = await tx.surveyQuestion.findMany({
        where: { surveyId },
        select: { id: true },
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
      });
      await tx.surveyResponse.create({
        data: {
          surveyId,
          userId,
          moduleId: r.moduleKey != null ? keys.moduleIdByKey.get(r.moduleKey) ?? null : null,
          context: r.context,
          completedAt: date(r.completedAt) ?? new Date(),
          answers: {
            create: r.answers
              .filter((ans) => questions[ans.questionIndex])
              .map((ans) => ({
                questionId: questions[ans.questionIndex].id,
                answerValue: ans.answerValue,
              })),
          },
        },
      });
      counts.surveyResponses += 1;
    }

    // --- discussions -------------------------------------------------------
    const importedThreadIdByKey = new Map(keys.threadIdByKey);
    for (const th of pkg.discussions?.threads ?? []) {
      // An anonymous thread has no authorKey. It still needs an author column,
      // so it is attributed to the course owner with isAnonymous preserved —
      // which is exactly how an anonymous thread already behaves in LAILA.
      const authorId = uid(th.authorKey);
      if (th.authorKey != null && authorId == null) continue;
      const course = await tx.course.findUnique({
        where: { id: courseId },
        select: { instructorId: true },
      });
      const created = await tx.forumThread.create({
        data: {
          courseId,
          moduleId: th.moduleKey != null ? keys.moduleIdByKey.get(th.moduleKey) ?? null : null,
          authorId: authorId ?? course!.instructorId,
          title: th.title,
          content: th.content,
          isPinned: th.isPinned,
          isLocked: th.isLocked,
          isAnonymous: th.isAnonymous,
          viewCount: th.viewCount,
          createdAt: date(th.createdAt) ?? new Date(),
        },
        select: { id: true },
      });
      importedThreadIdByKey.set(th.key, created.id);
      counts.discussionThreads += 1;
    }

    // Posts are written parent-before-child so a threaded reply can point at
    // its parent's NEW id. A reply whose parent was skipped becomes top-level
    // rather than being dropped — losing the nesting is better than losing the
    // contribution.
    const postIdByKey = new Map<string, number>();
    const pending = [...(pkg.discussions?.posts ?? [])];
    let progressed = true;
    while (pending.length && progressed) {
      progressed = false;
      for (let i = 0; i < pending.length; ) {
        const post = pending[i];
        const parentReady = post.parentKey == null || postIdByKey.has(post.parentKey);
        if (!parentReady) {
          i += 1;
          continue;
        }
        pending.splice(i, 1);
        progressed = true;
        const threadId = importedThreadIdByKey.get(post.threadKey);
        const authorId = uid(post.authorKey);
        if (threadId == null || (post.authorKey != null && authorId == null)) continue;
        const course = await tx.course.findUnique({
          where: { id: courseId },
          select: { instructorId: true },
        });
        const created = await tx.forumPost.create({
          data: {
            threadId,
            authorId: authorId ?? course!.instructorId,
            parentId: post.parentKey != null ? postIdByKey.get(post.parentKey) ?? null : null,
            content: post.content,
            isAnonymous: post.isAnonymous,
            isEdited: post.isEdited,
            isAiGenerated: post.isAiGenerated,
            aiAgentName: post.aiAgentName,
            createdAt: date(post.createdAt) ?? new Date(),
          },
          select: { id: true },
        });
        postIdByKey.set(post.key, created.id);
        counts.discussionPosts += 1;
      }
    }
    if (pending.length) {
      // A cycle in parentKey, which a well-formed package cannot contain.
      warnings.push(`${pending.length} discussion post(s) had unresolvable parents and were skipped.`);
    }

    // --- conversations -----------------------------------------------------
    for (const c of pkg.conversations ?? []) {
      const userId = uid(c.userKey);
      if (userId == null) continue;
      const messages = c.messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: date(m.createdAt) ?? new Date(),
      }));

      if (c.kind === 'chatbot-section') {
        const sectionId = c.sectionKey != null ? keys.sectionIdByKey.get(c.sectionKey) : null;
        if (sectionId == null) continue;
        await tx.chatbotConversation.create({
          data: {
            sectionId,
            userId,
            createdAt: date(c.createdAt) ?? new Date(),
            messages: { create: messages },
          },
        });
      } else {
        const courseTutorId = c.tutorKey != null ? keys.tutorIdByKey.get(c.tutorKey) : null;
        if (courseTutorId == null) continue;
        await tx.courseTutorConversation.create({
          data: {
            courseTutorId,
            userId,
            title: c.title,
            createdAt: date(c.createdAt) ?? new Date(),
            messages: { create: messages },
          },
        });
      }
      counts.conversations += 1;
    }

    // --- activity ----------------------------------------------------------
    // createMany: an activity log is the one section that can run to six
    // figures, and a row-at-a-time insert would dominate the whole import.
    const activityRows = (pkg.activity ?? [])
      .map((r) => {
        const userId = uid(r.userKey);
        if (userId == null) return null;
        return {
          userId,
          courseId,
          verb: r.verb,
          objectType: r.objectType,
          objectTitle: r.objectTitle,
          objectSubtype: r.objectSubtype,
          courseTitle: r.courseTitle,
          moduleTitle: r.moduleTitle,
          lectureTitle: r.lectureTitle,
          sectionTitle: r.sectionTitle,
          sessionId: r.sessionId,
          success: r.success,
          score: r.score,
          maxScore: r.maxScore,
          progress: r.progress,
          duration: r.duration,
          extensions: r.extensions,
          timestamp: date(r.timestamp) ?? new Date(),
          deviceType: r.deviceType,
          browserName: r.browserName,
          actionSubtype: r.actionSubtype,
          // eventUuid is UNIQUE per (user, uuid). Re-importing the same package
          // would collide, so it is deliberately not carried over: these rows
          // are a copy, not the originals.
          route: r.route,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (activityRows.length) {
      await tx.learningActivityLog.createMany({ data: activityRows });
      counts.activity = activityRows.length;
    }

    return {
      people: { matched: userIdByKey.size, unmatched },
      personalCounts: counts,
    };
  }
}

export const courseImportService = new CourseImportService();
