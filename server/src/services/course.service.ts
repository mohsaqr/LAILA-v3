import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateCourseInput, UpdateCourseInput } from '../utils/validation.js';
import { CourseFilters } from '../types/index.js';
import { learningAnalyticsService } from './learningAnalytics.service.js';

// Context for system event logging
export interface SystemEventContext {
  actorId?: number;
  ipAddress?: string;
}

export class CourseService {
  // Generate slug from title
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36);
  }

  async getCourses(filters: CourseFilters, page = 1, limit = 10) {
    const where: any = {
      status: 'published',
      isPublic: true,
    };

    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.difficulty) {
      where.difficulty = filters.difficulty;
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          instructor: {
            select: { id: true, fullname: true },
          },
          _count: {
            select: { enrollments: true, modules: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.course.count({ where }),
    ]);

    return {
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCourseById(id: number, includeUnpublished = false) {
    const where: any = { id };
    if (!includeUnpublished) {
      where.status = 'published';
    }

    const course = await prisma.course.findFirst({
      where,
      include: {
        instructor: {
          select: { id: true, fullname: true, email: true },
        },
        modules: {
          where: includeUnpublished ? {} : { isPublished: true },
          orderBy: { orderIndex: 'asc' },
          include: {
            lectures: {
              where: includeUnpublished ? {} : { isPublished: true },
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                title: true,
                contentType: true,
                duration: true,
                orderIndex: true,
                isPublished: true,
                isFree: true,
              },
            },
            codeLabs: {
              where: includeUnpublished ? {} : { isPublished: true },
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                title: true,
                description: true,
                orderIndex: true,
                isPublished: true,
              },
            },
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    return course;
  }

  async getCourseBySlug(slug: string) {
    const course = await prisma.course.findUnique({
      where: { slug, status: 'published' },
      include: {
        instructor: {
          select: { id: true, fullname: true },
        },
        modules: {
          where: { isPublished: true },
          orderBy: { orderIndex: 'asc' },
          include: {
            lectures: {
              where: { isPublished: true },
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                title: true,
                contentType: true,
                duration: true,
                isFree: true,
              },
            },
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    return course;
  }

  async createCourse(instructorId: number, data: CreateCourseInput, context?: SystemEventContext) {
    const slug = this.generateSlug(data.title);

    const course = await prisma.course.create({
      data: {
        ...data,
        slug,
        instructorId,
      },
      include: {
        instructor: {
          select: { id: true, fullname: true },
        },
      },
    });

    // Log course creation event
    try {
      await learningAnalyticsService.logSystemEvent({
        actorId: context?.actorId || instructorId,
        eventType: 'course_create',
        eventCategory: 'content_mgmt',
        changeType: 'create',
        targetType: 'course',
        targetId: course.id,
        targetTitle: course.title,
        courseId: course.id,
        newValues: { title: course.title, description: course.description, category: course.category, difficulty: course.difficulty },
      }, context?.ipAddress);
    } catch (error) {
      console.error('Failed to log course create event:', error);
    }

    return course;
  }

  async updateCourse(courseId: number, instructorId: number, data: UpdateCourseInput, isAdmin = false, context?: SystemEventContext) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized to update this course', 403);
    }

    // Store previous values for logging
    const previousValues = {
      title: course.title,
      description: course.description,
      category: course.category,
      difficulty: course.difficulty,
      status: course.status,
      isPublic: course.isPublic,
    };

    const updated = await prisma.course.update({
      where: { id: courseId },
      data,
      include: {
        instructor: {
          select: { id: true, fullname: true },
        },
      },
    });

    // Log course update event
    try {
      await learningAnalyticsService.logSystemEvent({
        actorId: context?.actorId || instructorId,
        eventType: 'course_update',
        eventCategory: 'content_mgmt',
        changeType: 'update',
        targetType: 'course',
        targetId: course.id,
        targetTitle: updated.title,
        courseId: course.id,
        previousValues,
        newValues: data,
      }, context?.ipAddress);
    } catch (error) {
      console.error('Failed to log course update event:', error);
    }

    return updated;
  }

  async deleteCourse(courseId: number, instructorId: number, isAdmin = false, context?: SystemEventContext) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized to delete this course', 403);
    }

    await prisma.course.delete({
      where: { id: courseId },
    });

    // Log course deletion event
    try {
      await learningAnalyticsService.logSystemEvent({
        actorId: context?.actorId || instructorId,
        eventType: 'course_delete',
        eventCategory: 'content_mgmt',
        changeType: 'delete',
        targetType: 'course',
        targetId: course.id,
        targetTitle: course.title,
        courseId: course.id,
        previousValues: { title: course.title, description: course.description },
      }, context?.ipAddress);
    } catch (error) {
      console.error('Failed to log course delete event:', error);
    }

    return { message: 'Course deleted successfully' };
  }

  async publishCourse(courseId: number, instructorId: number, isAdmin = false, context?: SystemEventContext) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: { lectures: true },
        },
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized to publish this course', 403);
    }

    // Check if course has content
    const hasContent = course.modules.some(m => m.lectures.length > 0);
    if (!hasContent) {
      throw new AppError('Course must have at least one lecture to publish', 400);
    }

    const updated = await prisma.course.update({
      where: { id: courseId },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });

    // Log course publish event
    try {
      await learningAnalyticsService.logSystemEvent({
        actorId: context?.actorId || instructorId,
        eventType: 'course_publish',
        eventCategory: 'content_mgmt',
        changeType: 'publish',
        targetType: 'course',
        targetId: course.id,
        targetTitle: course.title,
        courseId: course.id,
        previousValues: { status: course.status },
        newValues: { status: 'published' },
      }, context?.ipAddress);
    } catch (error) {
      console.error('Failed to log course publish event:', error);
    }

    return updated;
  }

  async unpublishCourse(courseId: number, instructorId: number, isAdmin = false, context?: SystemEventContext) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const updated = await prisma.course.update({
      where: { id: courseId },
      data: { status: 'draft' },
    });

    // Log course unpublish event
    try {
      await learningAnalyticsService.logSystemEvent({
        actorId: context?.actorId || instructorId,
        eventType: 'course_unpublish',
        eventCategory: 'content_mgmt',
        changeType: 'unpublish',
        targetType: 'course',
        targetId: course.id,
        targetTitle: course.title,
        courseId: course.id,
        previousValues: { status: course.status },
        newValues: { status: 'draft' },
      }, context?.ipAddress);
    } catch (error) {
      console.error('Failed to log course unpublish event:', error);
    }

    return updated;
  }

  async getInstructorCourses(instructorId: number, isAdmin = false) {
    // Admins see all courses, instructors see only their own
    const where = isAdmin ? {} : { instructorId };

    const courses = await prisma.course.findMany({
      where,
      include: {
        instructor: {
          select: { id: true, fullname: true },
        },
        _count: {
          select: { enrollments: true, modules: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return courses;
  }

  async getCourseStudents(courseId: number, instructorId: number, isAdmin = false) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: {
          select: { id: true, fullname: true, email: true },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    return enrollments;
  }

  async updateAISettings(
    courseId: number,
    instructorId: number,
    settings: {
      collaborativeModuleName?: string;
      collaborativeModuleEnabled?: boolean;
      emotionalPulseEnabled?: boolean;
      tutorRoutingMode?: 'free' | 'all' | 'single' | 'smart';
      defaultTutorId?: number | null;
    },
    isAdmin = false,
    context?: SystemEventContext
  ) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized to update this course', 403);
    }

    // Store previous values for logging
    const previousValues = {
      collaborativeModuleName: (course as any).collaborativeModuleName,
      collaborativeModuleEnabled: (course as any).collaborativeModuleEnabled,
      emotionalPulseEnabled: (course as any).emotionalPulseEnabled,
      tutorRoutingMode: (course as any).tutorRoutingMode,
      defaultTutorId: (course as any).defaultTutorId,
    };

    // Build update data only with defined values
    const updateData: Record<string, any> = {};
    if (settings.collaborativeModuleName !== undefined) {
      updateData.collaborativeModuleName = settings.collaborativeModuleName || null;
    }
    if (settings.collaborativeModuleEnabled !== undefined) {
      updateData.collaborativeModuleEnabled = settings.collaborativeModuleEnabled;
    }
    if (settings.emotionalPulseEnabled !== undefined) {
      updateData.emotionalPulseEnabled = settings.emotionalPulseEnabled;
    }
    if (settings.tutorRoutingMode !== undefined) {
      updateData.tutorRoutingMode = settings.tutorRoutingMode;
    }
    if (settings.defaultTutorId !== undefined) {
      updateData.defaultTutorId = settings.defaultTutorId;
    }

    const updated = await prisma.course.update({
      where: { id: courseId },
      data: updateData,
    });

    // Log AI settings update event
    try {
      await learningAnalyticsService.logSystemEvent({
        actorId: context?.actorId || instructorId,
        eventType: 'course_ai_settings_update',
        eventCategory: 'content_mgmt',
        changeType: 'update',
        targetType: 'course',
        targetId: course.id,
        targetTitle: course.title,
        courseId: course.id,
        previousValues,
        newValues: settings,
      }, context?.ipAddress);
    } catch (error) {
      console.error('Failed to log AI settings update event:', error);
    }

    return updated;
  }
}

export const courseService = new CourseService();
