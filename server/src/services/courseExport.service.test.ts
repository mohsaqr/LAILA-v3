import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../middleware/error.middleware.js';
import { coursePackageSchema, findDanglingReferences } from './coursePackage.schema.js';

vi.mock('../utils/prisma.js', () => ({
  default: {
    course: { findUnique: vi.fn() },
    rubric: { findMany: vi.fn() },
  },
}));
vi.mock('./courseRole.service.js', () => ({
  courseRoleService: { canEditContent: vi.fn() },
}));
vi.mock('../config/buildInfo.js', () => ({ APP_VERSION: '3.13.0-test' }));
// No upload in this graph exists on disk: every URL must come back as missing.
vi.mock('node:fs', () => ({
  default: {
    promises: { stat: vi.fn(async () => { throw new Error('ENOENT'); }) },
    createReadStream: vi.fn(),
  },
}));

import prisma from '../utils/prisma.js';
import { courseRoleService } from './courseRole.service.js';
import { courseExportService } from './courseExport.service.js';

const d = (s: string) => new Date(s);

/** A course graph in the shape `courseInclude` returns it. */
const graph = () => ({
  id: 3,
  title: 'Networks',
  slug: 'networks-mf0a1b2c',
  description: null,
  thumbnail: '/uploads/thumb.png',
  instructorId: 10,
  difficulty: null,
  isPublic: true,
  collaborativeModuleName: null,
  collaborativeModuleEnabled: true,
  emotionalPulseEnabled: false,
  tutorsEnabled: true,
  tutorRoutingMode: 'all',
  defaultTutorId: 55,
  curriculumViewMode: 'mini-cards',
  openLinkLecturesDirectly: true,
  enabledLabs: null,
  startTime: d('2026-09-01T00:00:00.000Z'),
  categories: [{ category: { title: 'SNA' } }],
  courseRoles: [{ userId: 11 }],
  modules: [
    {
      id: 20, title: 'Week 1', description: null, label: null, orderIndex: 0, isPublished: true,
      availableFrom: null, availableUntil: null, interactiveLabs: null,
      lectures: [
        {
          id: 30, title: 'Intro', description: null, content: null, contentType: 'text', videoUrl: null,
          duration: 5, orderIndex: 0, isPublished: true, isFree: false, availableFrom: null, availableUntil: null,
          sections: [
            {
              id: 40, title: null, type: 'assignment', content: null, fileName: null, fileUrl: null, fileType: null,
              fileSize: null, order: 0, chatbotTitle: null, chatbotIntro: null, chatbotImageUrl: null,
              chatbotSystemPrompt: null, chatbotWelcome: null, assignmentId: 60, showDeadline: true, showPoints: true,
            },
          ],
          attachments: [],
        },
      ],
      codeLabs: [
        {
          id: 70, title: 'Lab', description: null, orderIndex: 0, isPublished: false, availableFrom: null,
          availableUntil: null, aiChatbot: { name: 'helper' }, blocks: [],
        },
      ],
      moduleSurveys: [{ surveyId: 80, orderIndex: 0 }],
      children: [
        {
          id: 21, title: 'Week 1b', description: null, label: null, orderIndex: 0, isPublished: true,
          availableFrom: null, availableUntil: null, interactiveLabs: null, lectures: [], codeLabs: [], moduleSurveys: [],
        },
      ],
    },
  ],
  assignments: [
    {
      id: 60, moduleId: 21, lectureId: 30, title: 'Essay', description: null, instructions: null, submissionType: 'text',
      maxFileSize: null, allowedFileTypes: null, dueDate: d('2026-10-01T00:00:00.000Z'), gracePeriodDeadline: null,
      availableFrom: null, availableUntil: null, points: 100, weight: 1, isPublished: false, aiAssisted: false,
      aiPrompt: null, agentRequirements: null, reflectionRequirement: null, postSurveyId: 80, postSurveyRequired: false,
      orderIndex: 0, attachments: [],
      postSurvey: { id: 80, title: 'Exit', description: null, isPublished: true, isAnonymous: false, questions: [] },
    },
  ],
  quizzes: [],
  courseTutors: [
    {
      id: 55, chatbotId: 90, customName: null, customDescription: null, customSystemPrompt: null,
      customWelcomeMessage: null, customPersonality: null, customTemperature: null, isActive: true, displayOrder: 0,
      chatbot: {
        name: 'net-tutor', displayName: 'Net Tutor', description: null, systemPrompt: 'x', category: null,
        welcomeMessage: null, avatarUrl: null, personality: null, personalityPrompt: null, temperature: 0.5,
        suggestedQuestions: null, dosRules: null, dontsRules: null, responseStyle: null, maxTokens: null,
        modelPreference: 'gpt-4o', knowledgeContext: null,
      },
    },
  ],
  labAssignments: [],
  moduleSurveys: [
    { surveyId: 80, survey: { id: 80, title: 'Exit', description: null, isPublished: true, isAnonymous: false, questions: [] } },
  ],
  forumThreads: [
    { id: 1, moduleId: 20, authorId: 10, title: 'Welcome', content: 'Hi', description: null, isPublished: true,
      availableFrom: null, availableUntil: null, allowAnonymous: false, orderIndex: 0, isPinned: true, isLocked: false },
    { id: 2, moduleId: 20, authorId: 11, title: 'TA thread', content: 'Hi', description: null, isPublished: true,
      availableFrom: null, availableUntil: null, allowAnonymous: false, orderIndex: 1, isPinned: false, isLocked: false },
    { id: 3, moduleId: null, authorId: 999, title: 'Student question', content: '?', description: null, isPublished: true,
      availableFrom: null, availableUntil: null, allowAnonymous: false, orderIndex: 2, isPinned: false, isLocked: false },
  ],
});

beforeEach(() => {
  vi.mocked(courseRoleService.canEditContent).mockResolvedValue(true);
  vi.mocked(prisma.course.findUnique).mockResolvedValue(graph() as any);
  vi.mocked(prisma.rubric.findMany).mockResolvedValue([
    { id: 1, title: 'R', description: null, isTemplate: false, criteria: [{ name: 'c', description: null, maxPoints: 1, orderIndex: 0, levels: '[]' }] },
  ] as any);
});

describe('buildPackage', () => {
  it('produces a package that validates against its own schema with no dangling keys', async () => {
    const { pkg, manifest, missingFiles } = await courseExportService.buildPackage(3, 10);
    expect(coursePackageSchema.safeParse(pkg).success).toBe(true);
    expect(findDanglingReferences(pkg)).toEqual([]);
    expect(manifest).toMatchObject({
      format: 'laila-course',
      formatVersion: 1,
      exporter: { application: 'LAILA', version: '3.13.0-test' },
      source: { courseId: 3, slug: 'networks-mf0a1b2c', title: 'Networks' },
    });
    expect(missingFiles).toEqual(['/uploads/thumb.png']);
    expect(pkg.files).toEqual([]);
  });

  it('turns ids into keys everywhere they cross entities', async () => {
    const { pkg } = await courseExportService.buildPackage(3, 10);
    expect(pkg.course.defaultTutorKey).toBe('t55');
    expect(pkg.modules[0].key).toBe('m20');
    expect(pkg.modules[0].children[0].key).toBe('m21');
    expect(pkg.modules[0].lectures[0].sections[0].assignmentKey).toBe('a60');
    expect(pkg.modules[0].moduleSurveys).toEqual([{ surveyKey: 's80', orderIndex: 0 }]);
    expect(pkg.modules[0].codeLabs[0].aiChatbotName).toBe('helper');
    expect(pkg.assignments[0]).toMatchObject({ key: 'a60', moduleKey: 'm21', lectureKey: 'le30', postSurveyKey: 's80' });
    expect(pkg.surveys.map((s) => s.key)).toEqual(['s80']); // once, though referenced twice
    expect(pkg.tutors[0].chatbot.name).toBe('net-tutor');
    expect(pkg.categories).toEqual(['SNA']);
    expect(pkg.rubrics).toHaveLength(1);
  });

  it('serialises dates as ISO strings and nulls', async () => {
    const { pkg } = await courseExportService.buildPackage(3, 10);
    expect(pkg.course.startTime).toBe('2026-09-01T00:00:00.000Z');
    expect(pkg.assignments[0].dueDate).toBe('2026-10-01T00:00:00.000Z');
    expect(pkg.assignments[0].availableFrom).toBeNull();
  });

  it('keeps forum threads opened by staff and leaves student threads behind', async () => {
    const { pkg } = await courseExportService.buildPackage(3, 10);
    expect(pkg.forums.map((f) => f.title)).toEqual(['Welcome', 'TA thread']);
  });

  it('nulls references to modules, lectures and assignments outside the course', async () => {
    const g = graph();
    g.assignments[0].moduleId = 9999; // module of another course / deleted
    g.assignments[0].lectureId = 8888;
    g.modules[0].lectures[0].sections[0].assignmentId = 7777;
    vi.mocked(prisma.course.findUnique).mockResolvedValue(g as any);
    const { pkg } = await courseExportService.buildPackage(3, 10);
    expect(pkg.assignments[0].moduleKey).toBeNull();
    expect(pkg.assignments[0].lectureKey).toBeNull();
    expect(pkg.modules[0].lectures[0].sections[0].assignmentKey).toBeNull();
    expect(findDanglingReferences(pkg)).toEqual([]);
  });

  it('drops a default tutor pointer that no longer matches a tutor', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ ...graph(), defaultTutorId: 1234 } as any);
    const { pkg } = await courseExportService.buildPackage(3, 10);
    expect(pkg.course.defaultTutorKey).toBeNull();
  });

  it('never exports the activation code, instructor id or timestamps', async () => {
    const { pkg } = await courseExportService.buildPackage(3, 10);
    const text = JSON.stringify(pkg);
    expect(text).not.toContain('activationCode');
    expect(text).not.toContain('instructorId');
    expect(text).not.toContain('createdAt');
  });

  it('refuses without edit rights and 404s an unknown course', async () => {
    vi.mocked(courseRoleService.canEditContent).mockResolvedValue(false);
    await expect(courseExportService.buildPackage(3, 10)).rejects.toMatchObject({ statusCode: 403 });
    vi.mocked(courseRoleService.canEditContent).mockResolvedValue(true);
    vi.mocked(prisma.course.findUnique).mockResolvedValue(null);
    await expect(courseExportService.buildPackage(3, 10)).rejects.toBeInstanceOf(AppError);
  });
});

describe('streamZip', () => {
  it('names the download after the course slug without its random suffix', async () => {
    const { fileName, archive } = await courseExportService.streamZip(3, 10);
    expect(fileName).toBe('networks.laila.zip');
    archive.destroy();
  });

  it('keeps a slug that merely ends in a word', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ ...graph(), slug: 'intro-course' } as any);
    const { fileName, archive } = await courseExportService.streamZip(3, 10);
    expect(fileName).toBe('intro-course.laila.zip');
    archive.destroy();
  });
});
