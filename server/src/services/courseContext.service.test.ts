import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/prisma.js', () => ({
  default: {
    course: { findUnique: vi.fn() },
  },
}));

import prisma from '../utils/prisma.js';
import {
  buildCourseContext,
  invalidateCourseContext,
  MAX_MODULES,
  MAX_LECTURES_PER_MODULE,
  MAX_DESCRIPTION_CHARS,
} from './courseContext.service.js';

const course = (over: Record<string, unknown> = {}) => ({
  title: 'Learning Analytics',
  description: 'An introduction to analysing educational data.',
  modules: [
    { title: 'Foundations', lectures: [{ title: 'What is LA?' }, { title: 'Ethics' }] },
    { title: 'Networks', lectures: [{ title: 'SNA basics' }] },
  ],
  ...over,
});

describe('buildCourseContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateCourseContext();
  });

  it('includes the title, description and every module and lesson heading', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(course() as any);

    const ctx = await buildCourseContext(1);

    expect(ctx).toContain('Learning Analytics');
    expect(ctx).toContain('An introduction to analysing educational data.');
    expect(ctx).toContain('Foundations');
    expect(ctx).toContain('What is LA?');
    expect(ctx).toContain('Ethics');
    expect(ctx).toContain('Networks');
    expect(ctx).toContain('SNA basics');
  });

  it('asks only for published modules and lessons', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(course() as any);

    await buildCourseContext(1);

    // A tutor quoting unreleased material leaks instructor drafts to students.
    const args = vi.mocked(prisma.course.findUnique).mock.calls[0][0] as any;
    expect(args.select.modules.where).toEqual({ isPublished: true });
    expect(args.select.modules.select.lectures.where).toEqual({ isPublished: true });
  });

  it('bounds how much is pulled into every prompt', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(course() as any);

    await buildCourseContext(1);

    const args = vi.mocked(prisma.course.findUnique).mock.calls[0][0] as any;
    expect(args.select.modules.take).toBe(MAX_MODULES);
    expect(args.select.modules.select.lectures.take).toBe(MAX_LECTURES_PER_MODULE);
  });

  it('truncates a very long description', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(
      course({ description: 'x'.repeat(MAX_DESCRIPTION_CHARS + 500) }) as any
    );

    const ctx = await buildCourseContext(1);
    const about = ctx.split('\n').find(l => l.startsWith('About:'))!;

    expect(about.length).toBeLessThanOrEqual('About: '.length + MAX_DESCRIPTION_CHARS);
    expect(about.endsWith('…')).toBe(true);
  });

  it('tells the model the outline is not the full material', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(course() as any);

    // Without this the model answers past the syllabus and presents it as
    // course content — the original complaint, just better informed.
    expect(await buildCourseContext(1)).toMatch(/outline, not the full material/i);
  });

  it('still works for a course with no description or modules', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(
      course({ description: null, modules: [] }) as any
    );

    const ctx = await buildCourseContext(1);

    expect(ctx).toContain('Learning Analytics');
    expect(ctx).not.toContain('About:');
    expect(ctx).not.toContain('Topics covered');
  });

  it('returns an empty string for a missing course rather than throwing', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(null as any);

    // Callers append this to a system prompt; a throw would take down the chat.
    expect(await buildCourseContext(999)).toBe('');
  });

  it('caches per course so it is not rebuilt on every message', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(course() as any);

    await buildCourseContext(1);
    await buildCourseContext(1);
    await buildCourseContext(1);

    expect(prisma.course.findUnique).toHaveBeenCalledTimes(1);
  });

  it('rebuilds after the course is invalidated', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(course() as any);

    await buildCourseContext(1);
    invalidateCourseContext(1);
    await buildCourseContext(1);

    expect(prisma.course.findUnique).toHaveBeenCalledTimes(2);
  });

  it('does not serve one course the other course cached block', async () => {
    vi.mocked(prisma.course.findUnique)
      .mockResolvedValueOnce(course() as any)
      .mockResolvedValueOnce(course({ title: 'Statistics' }) as any);

    const first = await buildCourseContext(1);
    const second = await buildCourseContext(2);

    expect(first).toContain('Learning Analytics');
    expect(second).toContain('Statistics');
  });
});
