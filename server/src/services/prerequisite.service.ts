import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('prerequisite');

export interface AddPrerequisiteInput {
  prerequisiteCourseId: number;
  isRequired?: boolean;
  minProgress?: number;
}

class PrerequisiteService {
  /**
   * Get prerequisites for a course
   */
  async getPrerequisites(courseId: number) {
    const prerequisites = await prisma.coursePrerequisite.findMany({
      where: { courseId },
    });

    // Get course info for each prerequisite
    const prereqCourseIds = prerequisites.map(p => p.prerequisiteCourseId);
    const courses = await prisma.course.findMany({
      where: { id: { in: prereqCourseIds } },
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnail: true,
      },
    });

    const courseMap = new Map(courses.map(c => [c.id, c]));

    return prerequisites.map(p => ({
      ...p,
      prerequisiteCourse: courseMap.get(p.prerequisiteCourseId),
    }));
  }

  /**
   * Add a prerequisite to a course
   */
  async addPrerequisite(courseId: number, instructorId: number, data: AddPrerequisiteInput, isAdmin = false) {
    // Verify course ownership
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) throw new AppError('Course not found', 404);
    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    // Verify prerequisite course exists
    const prereqCourse = await prisma.course.findUnique({
      where: { id: data.prerequisiteCourseId },
    });

    if (!prereqCourse) throw new AppError('Prerequisite course not found', 404);

    // Prevent self-reference
    if (courseId === data.prerequisiteCourseId) {
      throw new AppError('Course cannot be its own prerequisite', 400);
    }

    // Check for circular dependencies
    const hasCircular = await this.checkCircularDependency(courseId, data.prerequisiteCourseId);
    if (hasCircular) {
      throw new AppError('This would create a circular dependency', 400);
    }

    // Check if already exists
    const existing = await prisma.coursePrerequisite.findUnique({
      where: {
        courseId_prerequisiteCourseId: {
          courseId,
          prerequisiteCourseId: data.prerequisiteCourseId,
        },
      },
    });

    if (existing) {
      throw new AppError('This prerequisite already exists', 400);
    }

    const prerequisite = await prisma.coursePrerequisite.create({
      data: {
        courseId,
        prerequisiteCourseId: data.prerequisiteCourseId,
        isRequired: data.isRequired ?? true,
        minProgress: data.minProgress ?? 100,
      },
    });

    logger.info({ courseId, prerequisiteCourseId: data.prerequisiteCourseId }, 'Prerequisite added');
    return prerequisite;
  }

  /**
   * Update a prerequisite
   */
  async updatePrerequisite(
    courseId: number,
    prerequisiteCourseId: number,
    instructorId: number,
    data: Partial<AddPrerequisiteInput>,
    isAdmin = false
  ) {
    // Verify course ownership
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) throw new AppError('Course not found', 404);
    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const existing = await prisma.coursePrerequisite.findUnique({
      where: {
        courseId_prerequisiteCourseId: {
          courseId,
          prerequisiteCourseId,
        },
      },
    });

    if (!existing) throw new AppError('Prerequisite not found', 404);

    return prisma.coursePrerequisite.update({
      where: {
        courseId_prerequisiteCourseId: {
          courseId,
          prerequisiteCourseId,
        },
      },
      data: {
        isRequired: data.isRequired,
        minProgress: data.minProgress,
      },
    });
  }

  /**
   * Remove a prerequisite
   */
  async removePrerequisite(courseId: number, prerequisiteCourseId: number, instructorId: number, isAdmin = false) {
    // Verify course ownership
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) throw new AppError('Course not found', 404);
    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    await prisma.coursePrerequisite.delete({
      where: {
        courseId_prerequisiteCourseId: {
          courseId,
          prerequisiteCourseId,
        },
      },
    });

    logger.info({ courseId, prerequisiteCourseId }, 'Prerequisite removed');
    return { message: 'Prerequisite removed' };
  }

  /**
   * Replace the full set of prerequisites for a course in one call (used by
   * the course setup form's multi-select). Ownership is assumed to be checked
   * by the caller (course service). Self-references and ids that don't exist
   * are dropped; duplicates are collapsed.
   */
  async setPrerequisites(courseId: number, prerequisiteCourseIds: number[]) {
    const unique = [...new Set(prerequisiteCourseIds)].filter(id => id !== courseId);

    // Keep only ids that point at real courses.
    const existing = unique.length
      ? await prisma.course.findMany({
          where: { id: { in: unique } },
          select: { id: true },
        })
      : [];
    const validIds = existing.map(c => c.id);

    // Drop any prerequisite that would create a cycle (e.g. A requires B while
    // B already transitively requires A). Without this, the setup form can
    // plant a reciprocal cycle that a later addPrerequisite/checkPrerequisites
    // call would detonate.
    const safeIds: number[] = [];
    const adjacencyCache = new Map<number, number[]>();
    for (const prereqId of validIds) {
      const wouldCycle = await this.checkCircularDependency(courseId, prereqId, new Set(), adjacencyCache);
      if (!wouldCycle) safeIds.push(prereqId);
    }

    await prisma.$transaction([
      prisma.coursePrerequisite.deleteMany({ where: { courseId } }),
      ...(safeIds.length
        ? [
            prisma.coursePrerequisite.createMany({
              data: safeIds.map(prerequisiteCourseId => ({ courseId, prerequisiteCourseId })),
            }),
          ]
        : []),
    ]);

    logger.info({ courseId, count: safeIds.length }, 'Prerequisites set');
    return safeIds;
  }

  /**
   * Check if a user meets prerequisites for a course
   */
  async checkPrerequisites(courseId: number, userId: number) {
    const prerequisites = await prisma.coursePrerequisite.findMany({
      where: { courseId },
    });

    if (prerequisites.length === 0) {
      return { met: true, prerequisites: [] };
    }

    const results = await Promise.all(
      prerequisites.map(async (prereq) => {
        // Get user's enrollment in the prerequisite course
        const enrollment = await prisma.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId,
              courseId: prereq.prerequisiteCourseId,
            },
          },
          include: {
            course: {
              include: {
                modules: {
                  include: {
                    lectures: { select: { id: true } },
                  },
                },
              },
            },
            lectureProgress: {
              where: { isCompleted: true },
            },
          },
        });

        // Get course info
        const prereqCourse = await prisma.course.findUnique({
          where: { id: prereq.prerequisiteCourseId },
          select: { id: true, title: true, slug: true },
        });

        if (!enrollment) {
          return {
            prerequisiteCourse: prereqCourse,
            isRequired: prereq.isRequired,
            minProgress: prereq.minProgress,
            enrolled: false,
            progress: 0,
            met: !prereq.isRequired, // Only fails if required
          };
        }

        // Calculate progress
        const totalLectures = enrollment.course.modules.reduce(
          (acc, m) => acc + m.lectures.length,
          0
        );
        const completedLectures = enrollment.lectureProgress.length;
        const progress = totalLectures > 0
          ? Math.round((completedLectures / totalLectures) * 100)
          : 0;

        const met = progress >= prereq.minProgress || !prereq.isRequired;

        return {
          prerequisiteCourse: prereqCourse,
          isRequired: prereq.isRequired,
          minProgress: prereq.minProgress,
          enrolled: true,
          progress,
          met,
        };
      })
    );

    // Check if all required prerequisites are met
    const allMet = results.every(r => r.met);

    return {
      met: allMet,
      prerequisites: results,
    };
  }

  /**
   * Check for circular dependencies
   */
  private async checkCircularDependency(
    courseId: number,
    newPrereqId: number,
    visited: Set<number> = new Set(),
    // Per-call adjacency cache (course -> its prerequisite course ids). Shared
    // across the prereq walks of one setPrerequisites call so a node touched by
    // several candidates is fetched once instead of re-queried per walk.
    cache: Map<number, number[]> = new Map(),
  ): Promise<boolean> {
    // Guard against pre-existing cyclic data: never expand the same course
    // twice, otherwise a cycle that does not pass through courseId (e.g.
    // B -> C -> B) would recurse until the stack overflows.
    if (visited.has(newPrereqId)) {
      return false;
    }
    visited.add(newPrereqId);

    // Get all prerequisites of the new prerequisite course (cached per call).
    let prereqIds = cache.get(newPrereqId);
    if (!prereqIds) {
      const rows = await prisma.coursePrerequisite.findMany({
        where: { courseId: newPrereqId },
        select: { prerequisiteCourseId: true },
      });
      prereqIds = rows.map(r => r.prerequisiteCourseId);
      cache.set(newPrereqId, prereqIds);
    }

    // If new prereq has courseId as its prereq, it's circular
    if (prereqIds.includes(courseId)) {
      return true;
    }

    // Recursively check
    for (const prereqId of prereqIds) {
      const isCircular = await this.checkCircularDependency(courseId, prereqId, visited, cache);
      if (isCircular) return true;
    }

    return false;
  }
}

export const prerequisiteService = new PrerequisiteService();
