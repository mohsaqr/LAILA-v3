/**
 * The LAILA course package format (`.laila.zip`).
 *
 * A package is a zip with three parts:
 *
 *   manifest.json   — format id + version, when/where it was exported
 *   course.json     — the whole course DESIGN as one JSON tree (this schema)
 *   files/<sha256>  — every `/uploads/...` blob the design refers to
 *
 * It carries content only: modules, lectures, sections, assignments, quizzes,
 * surveys, labs, tutors, forums (their settings and the instructor's opening
 * post), rubrics. Never students, submissions, grades, chat, logs, or secrets.
 *
 * Every entity that something else points at carries a `key` — a string that
 * is unique inside the package and means nothing outside it (the exporter uses
 * the source row id, but an importer must never rely on that). Cross-references
 * are `xxxKey` fields resolved by the importer, so the package survives being
 * imported into a database whose autoincrement ids are all different.
 *
 * File URLs are left exactly as they were on the exporting instance; the
 * `files` list maps each URL to its blob. The importer rewrites URLs after it
 * has stored the blobs under new names.
 *
 * The schema is Zod so an uploaded package is validated before a single row is
 * written; the TypeScript types are inferred from it so the two cannot drift.
 */
import { z } from 'zod';

export const COURSE_PACKAGE_FORMAT = 'laila-course';
export const COURSE_PACKAGE_VERSION = 1;
export const COURSE_PACKAGE_EXTENSION = '.laila.zip';

/** ISO-8601 timestamp or null; every DateTime column travels this way. */
const isoDate = z.string().datetime({ offset: true }).nullable();
const key = z.string().min(1).max(64);
const text = z.string();
const optText = z.string().nullable();

export const packageFileSchema = z.object({
  /** The URL as it appears in the content, e.g. `/uploads/<uuid>-notes.pdf`. */
  url: z.string().regex(/^\/uploads\/[^\s"'<>]+$/),
  /** Hex SHA-256 of the blob; also its name under `files/`. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  size: z.number().int().nonnegative(),
});

export const packageLectureAttachmentSchema = z.object({
  fileName: text,
  fileUrl: text,
  fileType: text,
  fileSize: z.number().int().nullable(),
});

export const packageSectionSchema = z.object({
  title: optText,
  type: text,
  content: optText,
  fileName: optText,
  fileUrl: optText,
  fileType: optText,
  fileSize: z.number().int().nullable(),
  order: z.number().int(),
  chatbotTitle: optText,
  chatbotIntro: optText,
  chatbotImageUrl: optText,
  chatbotSystemPrompt: optText,
  chatbotWelcome: optText,
  /** Resolves to a course-level assignment in `assignments`. */
  assignmentKey: key.nullable(),
  showDeadline: z.boolean(),
  showPoints: z.boolean(),
});

export const packageLectureSchema = z.object({
  key,
  title: text,
  description: optText,
  content: optText,
  contentType: text,
  videoUrl: optText,
  duration: z.number().int().nullable(),
  orderIndex: z.number().int(),
  isPublished: z.boolean(),
  isFree: z.boolean(),
  availableFrom: isoDate,
  availableUntil: isoDate,
  sections: z.array(packageSectionSchema),
  attachments: z.array(packageLectureAttachmentSchema),
});

export const packageCodeBlockSchema = z.object({
  title: text,
  instructions: optText,
  starterCode: optText,
  orderIndex: z.number().int(),
  locked: z.boolean(),
  cellType: text,
});

export const packageCodeLabSchema = z.object({
  title: text,
  description: optText,
  orderIndex: z.number().int(),
  isPublished: z.boolean(),
  availableFrom: isoDate,
  availableUntil: isoDate,
  /** Global chatbot matched by its unique name on import; null = none. */
  aiChatbotName: optText,
  blocks: z.array(packageCodeBlockSchema),
});

export const packageModuleSurveySchema = z.object({
  surveyKey: key,
  orderIndex: z.number().int(),
});

/** Modules nest one level (`children`), mirroring `CourseModule.parentId`. */
export type PackageModule = {
  key: string;
  title: string;
  description: string | null;
  label: string | null;
  orderIndex: number;
  isPublished: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
  interactiveLabs: string | null;
  lectures: z.infer<typeof packageLectureSchema>[];
  codeLabs: z.infer<typeof packageCodeLabSchema>[];
  moduleSurveys: z.infer<typeof packageModuleSurveySchema>[];
  children: PackageModule[];
};

export const packageModuleSchema: z.ZodType<PackageModule> = z.lazy(() =>
  z.object({
    key,
    title: text,
    description: optText,
    label: optText,
    orderIndex: z.number().int(),
    isPublished: z.boolean(),
    availableFrom: isoDate,
    availableUntil: isoDate,
    interactiveLabs: optText,
    lectures: z.array(packageLectureSchema),
    codeLabs: z.array(packageCodeLabSchema),
    moduleSurveys: z.array(packageModuleSurveySchema),
    children: z.array(packageModuleSchema),
  }),
);

export const packageAssignmentAttachmentSchema = packageLectureAttachmentSchema;

export const packageAssignmentSchema = z.object({
  key,
  moduleKey: key.nullable(),
  lectureKey: key.nullable(),
  title: text,
  description: optText,
  instructions: optText,
  submissionType: text,
  maxFileSize: z.number().int().nullable(),
  allowedFileTypes: optText,
  dueDate: isoDate,
  gracePeriodDeadline: isoDate,
  availableFrom: isoDate,
  availableUntil: isoDate,
  points: z.number().int(),
  weight: z.number().nullable(),
  isPublished: z.boolean(),
  aiAssisted: z.boolean(),
  aiPrompt: optText,
  agentRequirements: optText,
  reflectionRequirement: optText,
  postSurveyKey: key.nullable(),
  postSurveyRequired: z.boolean(),
  orderIndex: z.number().int(),
  attachments: z.array(packageAssignmentAttachmentSchema),
});

export const packageQuizQuestionSchema = z.object({
  questionType: text,
  questionText: text,
  options: optText,
  correctAnswer: text,
  explanation: optText,
  points: z.number(),
  shuffleOptions: z.boolean(),
  orderIndex: z.number().int(),
});

export const packageQuizSchema = z.object({
  key,
  moduleKey: key.nullable(),
  title: text,
  description: optText,
  instructions: optText,
  timeLimit: z.number().int().nullable(),
  maxAttempts: z.number().int(),
  passingScore: z.number(),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  showResults: text,
  isPublished: z.boolean(),
  dueDate: isoDate,
  availableFrom: isoDate,
  availableUntil: isoDate,
  orderIndex: z.number().int(),
  questions: z.array(packageQuizQuestionSchema),
});

export const packageSurveyQuestionSchema = z.object({
  questionText: text,
  questionType: text,
  options: optText,
  isRequired: z.boolean(),
  orderIndex: z.number().int(),
});

/** A survey is a global row in LAILA; the package embeds a private copy. */
export const packageSurveySchema = z.object({
  key,
  title: text,
  description: optText,
  isPublished: z.boolean(),
  isAnonymous: z.boolean(),
  questions: z.array(packageSurveyQuestionSchema),
});

export const packageLabCellSchema = z.object({
  title: text,
  description: optText,
  content: optText,
  code: text,
  orderIndex: z.number().int(),
  locked: z.boolean(),
  cellType: text,
});

/** A custom lab is a global row in LAILA; the package embeds a private copy. */
export const packageCustomLabSchema = z.object({
  key,
  name: text,
  description: optText,
  labType: text,
  config: optText,
  aiChatbotName: optText,
  cells: z.array(packageLabCellSchema),
});

export const packageLabAssignmentSchema = z.object({
  labKey: key,
  moduleKey: key.nullable(),
  assignmentKey: key.nullable(),
  orderIndex: z.number().int(),
  isPublished: z.boolean(),
});

/** Forum settings plus the staff-authored opening post. Student threads stay behind. */
export const packageForumSchema = z.object({
  moduleKey: key.nullable(),
  title: text,
  content: text,
  description: optText,
  isPublished: z.boolean(),
  availableFrom: isoDate,
  availableUntil: isoDate,
  allowAnonymous: z.boolean(),
  orderIndex: z.number().int(),
  isPinned: z.boolean(),
  isLocked: z.boolean(),
});

/** The global chatbot definition a course tutor is built on, keyed by unique name. */
export const packageChatbotSchema = z.object({
  name: text,
  displayName: text,
  description: optText,
  systemPrompt: text,
  category: optText,
  welcomeMessage: optText,
  avatarUrl: optText,
  personality: optText,
  personalityPrompt: optText,
  temperature: z.number().nullable(),
  suggestedQuestions: optText,
  dosRules: optText,
  dontsRules: optText,
  responseStyle: optText,
  maxTokens: z.number().int().nullable(),
  modelPreference: optText,
  knowledgeContext: optText,
});

export const packageTutorSchema = z.object({
  key,
  chatbot: packageChatbotSchema,
  customName: optText,
  customDescription: optText,
  customSystemPrompt: optText,
  customWelcomeMessage: optText,
  customPersonality: optText,
  customTemperature: z.number().nullable(),
  isActive: z.boolean(),
  displayOrder: z.number().int(),
});

export const packageRubricCriterionSchema = z.object({
  name: text,
  description: optText,
  maxPoints: z.number(),
  orderIndex: z.number().int(),
  levels: text,
});

export const packageRubricSchema = z.object({
  title: text,
  description: optText,
  isTemplate: z.boolean(),
  criteria: z.array(packageRubricCriterionSchema),
});

export const packageCourseSchema = z.object({
  title: text,
  slug: text,
  description: optText,
  thumbnail: optText,
  difficulty: optText,
  isPublic: z.boolean(),
  collaborativeModuleName: optText,
  collaborativeModuleEnabled: z.boolean(),
  emotionalPulseEnabled: z.boolean(),
  tutorsEnabled: z.boolean(),
  tutorRoutingMode: text,
  defaultTutorKey: key.nullable(),
  curriculumViewMode: text,
  openLinkLecturesDirectly: z.boolean(),
  enabledLabs: optText,
  startTime: isoDate,
});

export const coursePackageSchema = z.object({
  course: packageCourseSchema,
  categories: z.array(text),
  modules: z.array(packageModuleSchema),
  assignments: z.array(packageAssignmentSchema),
  quizzes: z.array(packageQuizSchema),
  surveys: z.array(packageSurveySchema),
  customLabs: z.array(packageCustomLabSchema),
  labAssignments: z.array(packageLabAssignmentSchema),
  forums: z.array(packageForumSchema),
  tutors: z.array(packageTutorSchema),
  rubrics: z.array(packageRubricSchema),
  files: z.array(packageFileSchema),
});

export const packageManifestSchema = z.object({
  format: z.literal(COURSE_PACKAGE_FORMAT),
  formatVersion: z.number().int().positive(),
  exportedAt: z.string().datetime({ offset: true }),
  exporter: z.object({
    application: z.string(),
    version: z.string(),
  }),
  source: z.object({
    courseId: z.number().int(),
    slug: z.string(),
    title: z.string(),
  }),
});

export type CoursePackage = z.infer<typeof coursePackageSchema>;
export type PackageManifest = z.infer<typeof packageManifestSchema>;
export type PackageFile = z.infer<typeof packageFileSchema>;
export type PackageLecture = z.infer<typeof packageLectureSchema>;
export type PackageSection = z.infer<typeof packageSectionSchema>;
export type PackageAssignment = z.infer<typeof packageAssignmentSchema>;
export type PackageQuiz = z.infer<typeof packageQuizSchema>;
export type PackageSurvey = z.infer<typeof packageSurveySchema>;
export type PackageCustomLab = z.infer<typeof packageCustomLabSchema>;
export type PackageTutor = z.infer<typeof packageTutorSchema>;
export type PackageChatbot = z.infer<typeof packageChatbotSchema>;
export type PackageForum = z.infer<typeof packageForumSchema>;
export type PackageRubric = z.infer<typeof packageRubricSchema>;

/**
 * Referential integrity the type system cannot express: every `xxxKey` must
 * name an entity in the package, and keys must be unique per collection. Run
 * after `coursePackageSchema.parse` and before touching the database.
 */
export const findDanglingReferences = (pkg: CoursePackage): string[] => {
  const problems: string[] = [];
  const collect = (label: string, keys: string[]): Set<string> => {
    const seen = new Set<string>();
    keys.forEach((k) => {
      if (seen.has(k)) problems.push(`duplicate ${label} key "${k}"`);
      seen.add(k);
    });
    return seen;
  };

  const flattenModules = (mods: PackageModule[]): PackageModule[] =>
    mods.flatMap((m) => [m, ...flattenModules(m.children)]);
  const allModules = flattenModules(pkg.modules);

  const moduleKeys = collect('module', allModules.map((m) => m.key));
  const lectureKeys = collect('lecture', allModules.flatMap((m) => m.lectures.map((l) => l.key)));
  const assignmentKeys = collect('assignment', pkg.assignments.map((a) => a.key));
  const surveyKeys = collect('survey', pkg.surveys.map((s) => s.key));
  const labKeys = collect('lab', pkg.customLabs.map((l) => l.key));
  const tutorKeys = collect('tutor', pkg.tutors.map((t) => t.key));
  collect('quiz', pkg.quizzes.map((q) => q.key));

  const check = (label: string, ref: string | null, set: Set<string>) => {
    if (ref != null && !set.has(ref)) problems.push(`${label} refers to unknown key "${ref}"`);
  };

  if (pkg.course.defaultTutorKey != null) check('course.defaultTutorKey', pkg.course.defaultTutorKey, tutorKeys);
  allModules.forEach((m) => {
    m.moduleSurveys.forEach((ms) => check(`module "${m.key}" survey`, ms.surveyKey, surveyKeys));
    m.lectures.forEach((l) =>
      l.sections.forEach((s) => check(`lecture "${l.key}" section`, s.assignmentKey, assignmentKeys)),
    );
  });
  pkg.assignments.forEach((a) => {
    check(`assignment "${a.key}" module`, a.moduleKey, moduleKeys);
    check(`assignment "${a.key}" lecture`, a.lectureKey, lectureKeys);
    check(`assignment "${a.key}" postSurvey`, a.postSurveyKey, surveyKeys);
  });
  pkg.quizzes.forEach((q) => check(`quiz "${q.key}" module`, q.moduleKey, moduleKeys));
  pkg.labAssignments.forEach((la) => {
    check('labAssignment lab', la.labKey, labKeys);
    check('labAssignment module', la.moduleKey, moduleKeys);
    check('labAssignment assignment', la.assignmentKey, assignmentKeys);
  });
  pkg.forums.forEach((f) => check(`forum "${f.title}" module`, f.moduleKey, moduleKeys));

  return problems;
};
