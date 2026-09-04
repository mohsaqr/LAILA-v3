/**
 * Course export: turn one course's design into a `.laila.zip` package.
 *
 * See coursePackage.schema.ts for the format. This service only READS: it
 * walks the course graph, serialises it with package keys instead of ids, finds
 * every uploaded file the design refers to, and streams a zip.
 *
 * Two models are not reachable through Prisma relations and are fetched by
 * hand: `Rubric.courseId` and (deliberately not exported) `CoursePrerequisite`,
 * which points at another course that may not exist where the package lands.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import archiver from 'archiver';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { courseRoleService } from './courseRole.service.js';
import { APP_VERSION } from '../config/buildInfo.js';
import { findUploadUrls, resolveUploadPath } from '../utils/uploadFiles.js';
import {
  COURSE_PACKAGE_EXTENSION,
  COURSE_PACKAGE_FORMAT,
  COURSE_PACKAGE_VERSION,
  type CoursePackage,
  type PackageChatbot,
  type PackageFile,
  type PackageManifest,
  type PackageModule,
} from './coursePackage.schema.js';

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

const moduleInclude = {
  lectures: {
    orderBy: { orderIndex: 'asc' as const },
    include: {
      sections: { orderBy: { order: 'asc' as const } },
      attachments: true,
    },
  },
  codeLabs: {
    orderBy: { orderIndex: 'asc' as const },
    include: {
      blocks: { orderBy: { orderIndex: 'asc' as const } },
      aiChatbot: { select: { name: true } },
    },
  },
  moduleSurveys: { orderBy: { orderIndex: 'asc' as const } },
};

const courseInclude = {
  categories: { include: { category: true } },
  modules: {
    where: { parentId: null },
    orderBy: { orderIndex: 'asc' as const },
    include: {
      ...moduleInclude,
      children: { orderBy: { orderIndex: 'asc' as const }, include: moduleInclude },
    },
  },
  assignments: {
    orderBy: { orderIndex: 'asc' as const },
    include: { attachments: true, postSurvey: { include: { questions: { orderBy: { orderIndex: 'asc' as const } } } } },
  },
  quizzes: {
    orderBy: { orderIndex: 'asc' as const },
    include: { questions: { orderBy: { orderIndex: 'asc' as const } } },
  },
  courseTutors: { orderBy: { displayOrder: 'asc' as const }, include: { chatbot: true } },
  labAssignments: {
    orderBy: { orderIndex: 'asc' as const },
    include: {
      lab: { include: { templates: { orderBy: { orderIndex: 'asc' as const } }, aiChatbot: { select: { name: true } } } },
    },
  },
  moduleSurveys: {
    include: { survey: { include: { questions: { orderBy: { orderIndex: 'asc' as const } } } } },
  },
  forumThreads: { orderBy: { orderIndex: 'asc' as const } },
  courseRoles: { select: { userId: true } },
};

type CourseGraph = NonNullable<
  Awaited<ReturnType<typeof prisma.course.findUnique<{ where: { id: number }; include: typeof courseInclude }>>>
>;
type GraphModule = CourseGraph['modules'][number];
type GraphChildModule = GraphModule['children'][number];
type GraphSurvey = NonNullable<CourseGraph['assignments'][number]['postSurvey']>;

export interface ExportResult {
  pkg: CoursePackage;
  manifest: PackageManifest;
  /** Upload URLs the design refers to whose file is no longer on disk. */
  missingFiles: string[];
}

export class CourseExportService {
  /** Build the package for `courseId`. Requires edit rights on the course. */
  async buildPackage(courseId: number, userId: number, isAdmin = false): Promise<ExportResult> {
    if (!(await courseRoleService.canEditContent(userId, courseId, isAdmin))) {
      throw new AppError('Not authorized', 403);
    }
    const course = (await prisma.course.findUnique({
      where: { id: courseId },
      include: courseInclude,
    })) as CourseGraph | null;
    if (!course) {
      throw new AppError('Course not found', 404);
    }
    const rubrics = await prisma.rubric.findMany({
      where: { courseId },
      include: { criteria: { orderBy: { orderIndex: 'asc' } } },
    });

    const staffIds = new Set<number>([course.instructorId, ...course.courseRoles.map((r) => r.userId)]);

    const surveysByKey = new Map<string, GraphSurvey>();
    course.moduleSurveys.forEach((ms) => surveysByKey.set(`s${ms.survey.id}`, ms.survey));
    course.assignments.forEach((a) => {
      if (a.postSurvey) surveysByKey.set(`s${a.postSurvey.id}`, a.postSurvey);
    });

    const labsByKey = new Map<string, CourseGraph['labAssignments'][number]['lab']>();
    course.labAssignments.forEach((la) => labsByKey.set(`l${la.lab.id}`, la.lab));

    // Only rows that belong to THIS course may be referenced. A dangling
    // moduleId/lectureId/assignmentId (a module deleted with SetNull, or a row
    // that was re-parented across courses) becomes null rather than a key the
    // importer would reject; the importer's validator is the safety net, this
    // keeps honest data from tripping it.
    const allModules = [...course.modules, ...course.modules.flatMap((m) => m.children)];
    const moduleIds = new Set(allModules.map((m) => m.id));
    const lectureIds = new Set(allModules.flatMap((m) => m.lectures.map((l) => l.id)));
    const assignmentIds = new Set(course.assignments.map((a) => a.id));
    const ref = (prefix: string, id: number | null, valid: Set<number>): string | null =>
      id != null && valid.has(id) ? `${prefix}${id}` : null;
    const moduleRef = (id: number | null) => ref('m', id, moduleIds);
    const lectureRef = (id: number | null) => ref('le', id, lectureIds);
    const assignmentRef = (id: number | null) => ref('a', id, assignmentIds);

    const tutorKey = (id: number) => `t${id}`;
    const defaultTutorKey =
      course.defaultTutorId != null && course.courseTutors.some((t) => t.id === course.defaultTutorId)
        ? tutorKey(course.defaultTutorId)
        : null;

    const withoutFiles: Omit<CoursePackage, 'files'> = {
      course: {
        title: course.title,
        slug: course.slug,
        description: course.description,
        thumbnail: course.thumbnail,
        difficulty: course.difficulty,
        isPublic: course.isPublic,
        collaborativeModuleName: course.collaborativeModuleName,
        collaborativeModuleEnabled: course.collaborativeModuleEnabled,
        emotionalPulseEnabled: course.emotionalPulseEnabled,
        tutorsEnabled: course.tutorsEnabled,
        tutorRoutingMode: course.tutorRoutingMode,
        defaultTutorKey,
        curriculumViewMode: course.curriculumViewMode,
        openLinkLecturesDirectly: course.openLinkLecturesDirectly,
        enabledLabs: course.enabledLabs,
        startTime: iso(course.startTime),
      },
      categories: course.categories.map((c) => c.category.title),
      modules: course.modules.map((m) => this.serialiseModule(m, m.children, assignmentRef)),
      assignments: course.assignments.map((a) => ({
        key: `a${a.id}`,
        moduleKey: moduleRef(a.moduleId),
        lectureKey: lectureRef(a.lectureId),
        title: a.title,
        description: a.description,
        instructions: a.instructions,
        submissionType: a.submissionType,
        maxFileSize: a.maxFileSize,
        allowedFileTypes: a.allowedFileTypes,
        dueDate: iso(a.dueDate),
        gracePeriodDeadline: iso(a.gracePeriodDeadline),
        availableFrom: iso(a.availableFrom),
        availableUntil: iso(a.availableUntil),
        points: a.points,
        weight: a.weight,
        isPublished: a.isPublished,
        aiAssisted: a.aiAssisted,
        aiPrompt: a.aiPrompt,
        agentRequirements: a.agentRequirements,
        reflectionRequirement: a.reflectionRequirement,
        postSurveyKey: a.postSurveyId != null ? `s${a.postSurveyId}` : null,
        postSurveyRequired: a.postSurveyRequired,
        orderIndex: a.orderIndex,
        attachments: a.attachments.map((f) => ({
          fileName: f.fileName,
          fileUrl: f.fileUrl,
          fileType: f.fileType,
          fileSize: f.fileSize,
        })),
      })),
      quizzes: course.quizzes.map((q) => ({
        key: `q${q.id}`,
        moduleKey: moduleRef(q.moduleId),
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
        dueDate: iso(q.dueDate),
        availableFrom: iso(q.availableFrom),
        availableUntil: iso(q.availableUntil),
        orderIndex: q.orderIndex,
        questions: q.questions.map((qq) => ({
          questionType: qq.questionType,
          questionText: qq.questionText,
          options: qq.options,
          correctAnswer: qq.correctAnswer,
          explanation: qq.explanation,
          points: qq.points,
          shuffleOptions: qq.shuffleOptions,
          orderIndex: qq.orderIndex,
        })),
      })),
      surveys: [...surveysByKey.entries()].map(([key, s]) => ({
        key,
        title: s.title,
        description: s.description,
        isPublished: s.isPublished,
        isAnonymous: s.isAnonymous,
        questions: s.questions.map((sq) => ({
          questionText: sq.questionText,
          questionType: sq.questionType,
          options: sq.options,
          isRequired: sq.isRequired,
          orderIndex: sq.orderIndex,
        })),
      })),
      customLabs: [...labsByKey.entries()].map(([key, lab]) => ({
        key,
        name: lab.name,
        description: lab.description,
        labType: lab.labType,
        config: lab.config,
        aiChatbotName: lab.aiChatbot?.name ?? null,
        cells: lab.templates.map((c) => ({
          title: c.title,
          description: c.description,
          content: c.content,
          code: c.code,
          orderIndex: c.orderIndex,
          locked: c.locked,
          cellType: c.cellType,
        })),
      })),
      labAssignments: course.labAssignments.map((la) => ({
        labKey: `l${la.labId}`,
        moduleKey: moduleRef(la.moduleId),
        assignmentKey: assignmentRef(la.assignmentId),
        orderIndex: la.orderIndex,
        isPublished: la.isPublished,
      })),
      // A forum row is both the forum's settings and its opening post. Only
      // threads opened by course staff are part of the design; a student's
      // thread is their data and stays behind.
      forums: course.forumThreads
        .filter((f) => staffIds.has(f.authorId))
        .map((f) => ({
          moduleKey: moduleRef(f.moduleId),
          title: f.title,
          content: f.content,
          description: f.description,
          isPublished: f.isPublished,
          availableFrom: iso(f.availableFrom),
          availableUntil: iso(f.availableUntil),
          allowAnonymous: f.allowAnonymous,
          orderIndex: f.orderIndex,
          isPinned: f.isPinned,
          isLocked: f.isLocked,
        })),
      tutors: course.courseTutors.map((t) => ({
        key: tutorKey(t.id),
        chatbot: this.serialiseChatbot(t.chatbot),
        customName: t.customName,
        customDescription: t.customDescription,
        customSystemPrompt: t.customSystemPrompt,
        customWelcomeMessage: t.customWelcomeMessage,
        customPersonality: t.customPersonality,
        customTemperature: t.customTemperature,
        isActive: t.isActive,
        displayOrder: t.displayOrder,
      })),
      rubrics: rubrics.map((r) => ({
        title: r.title,
        description: r.description,
        isTemplate: r.isTemplate,
        criteria: r.criteria.map((c) => ({
          name: c.name,
          description: c.description,
          maxPoints: c.maxPoints,
          orderIndex: c.orderIndex,
          levels: c.levels,
        })),
      })),
    };

    // Module keys in assignments/quizzes/forums may point at any module, top or
    // nested, so the flattened set is what the keys are checked against.
    const { files, missingFiles } = await this.collectFiles(JSON.stringify(withoutFiles));
    const pkg: CoursePackage = { ...withoutFiles, files };

    const manifest: PackageManifest = {
      format: COURSE_PACKAGE_FORMAT,
      formatVersion: COURSE_PACKAGE_VERSION,
      exportedAt: new Date().toISOString(),
      exporter: { application: 'LAILA', version: APP_VERSION },
      source: { courseId: course.id, slug: course.slug, title: course.title },
    };
    return { pkg, manifest, missingFiles };
  }

  /** Build the package and stream it as a zip. */
  async streamZip(courseId: number, userId: number, isAdmin = false): Promise<{ archive: Readable; fileName: string; missingFiles: string[] }> {
    const { pkg, manifest, missingFiles } = await this.buildPackage(courseId, userId, isAdmin);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    archive.append(JSON.stringify(pkg, null, 2), { name: 'course.json' });
    pkg.files.forEach((f) => {
      const onDisk = resolveUploadPath(f.url);
      // collectFiles only lists files it hashed from disk, so this cannot be null.
      if (onDisk) archive.file(onDisk, { name: `files/${f.sha256}` });
    });
    void archive.finalize();
    // Slugs end in a base-36 timestamp (course.service generateSlug); a title
    // word never has a digit in it, so requiring one keeps "-course" intact.
    const stem = pkg.course.slug.replace(/-(?=[0-9a-z]*\d)[0-9a-z]{7,9}$/, '') || 'course';
    return { archive, fileName: `${stem}${COURSE_PACKAGE_EXTENSION}`, missingFiles };
  }

  private serialiseModule(
    m: GraphModule | GraphChildModule,
    children: GraphChildModule[],
    assignmentRef: (id: number | null) => string | null,
  ): PackageModule {
    return {
      key: `m${m.id}`,
      title: m.title,
      description: m.description,
      label: m.label,
      orderIndex: m.orderIndex,
      isPublished: m.isPublished,
      availableFrom: iso(m.availableFrom),
      availableUntil: iso(m.availableUntil),
      interactiveLabs: m.interactiveLabs,
      lectures: m.lectures.map((l) => ({
        key: `le${l.id}`,
        title: l.title,
        description: l.description,
        content: l.content,
        contentType: l.contentType,
        videoUrl: l.videoUrl,
        duration: l.duration,
        orderIndex: l.orderIndex,
        isPublished: l.isPublished,
        isFree: l.isFree,
        availableFrom: iso(l.availableFrom),
        availableUntil: iso(l.availableUntil),
        sections: l.sections.map((s) => ({
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
          assignmentKey: assignmentRef(s.assignmentId),
          showDeadline: s.showDeadline,
          showPoints: s.showPoints,
        })),
        attachments: l.attachments.map((f) => ({
          fileName: f.fileName,
          fileUrl: f.fileUrl,
          fileType: f.fileType,
          fileSize: f.fileSize,
        })),
      })),
      codeLabs: m.codeLabs.map((cl) => ({
        title: cl.title,
        description: cl.description,
        orderIndex: cl.orderIndex,
        isPublished: cl.isPublished,
        availableFrom: iso(cl.availableFrom),
        availableUntil: iso(cl.availableUntil),
        aiChatbotName: cl.aiChatbot?.name ?? null,
        blocks: cl.blocks.map((b) => ({
          title: b.title,
          instructions: b.instructions,
          starterCode: b.starterCode,
          orderIndex: b.orderIndex,
          locked: b.locked,
          cellType: b.cellType,
        })),
      })),
      moduleSurveys: m.moduleSurveys.map((ms) => ({ surveyKey: `s${ms.surveyId}`, orderIndex: ms.orderIndex })),
      children: children.map((c) => this.serialiseModule(c, [], assignmentRef)),
    };
  }

  private serialiseChatbot(c: CourseGraph['courseTutors'][number]['chatbot']): PackageChatbot {
    return {
      name: c.name,
      displayName: c.displayName,
      description: c.description,
      systemPrompt: c.systemPrompt,
      category: c.category,
      welcomeMessage: c.welcomeMessage,
      avatarUrl: c.avatarUrl,
      personality: c.personality,
      personalityPrompt: c.personalityPrompt,
      temperature: c.temperature,
      suggestedQuestions: c.suggestedQuestions,
      dosRules: c.dosRules,
      dontsRules: c.dontsRules,
      responseStyle: c.responseStyle,
      maxTokens: c.maxTokens,
      modelPreference: c.modelPreference,
      knowledgeContext: c.knowledgeContext,
    };
  }

  /**
   * Hash every upload the serialised design refers to. Scanning the JSON text
   * rather than a list of known columns means a URL inside lecture HTML, a
   * `data-files` attribute, or a lab's JSON config is found the same way as one
   * in a `fileUrl` column — there is no list of fields to keep in sync.
   */
  private async collectFiles(serialised: string): Promise<{ files: PackageFile[]; missingFiles: string[] }> {
    const urls = findUploadUrls(serialised);
    const files: PackageFile[] = [];
    const missingFiles: string[] = [];
    // Sequential on purpose: hashing many large videos in parallel would only
    // thrash the disk.
    for (const url of urls) {
      const onDisk = resolveUploadPath(url);
      const stat = onDisk ? await fs.promises.stat(onDisk).catch(() => null) : null;
      if (!onDisk || !stat || !stat.isFile()) {
        missingFiles.push(url);
        continue;
      }
      const hash = createHash('sha256');
      await pipeline(fs.createReadStream(onDisk), hash);
      files.push({ url, sha256: hash.digest('hex'), size: stat.size });
    }
    return { files, missingFiles };
  }
}

export const courseExportService = new CourseExportService();
