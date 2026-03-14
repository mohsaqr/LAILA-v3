import crypto from 'crypto';
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
  // Generate a random 8-character alphanumeric activation code (letters + numbers)
  private generateActivationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
    const bytes = crypto.randomBytes(8);
    return Array.from(bytes, b => chars[b % chars.length]).join('');
  }

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

    if (filters.categoryIds?.length) {
      where.categories = { some: { categoryId: { in: filters.categoryIds } } };
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
          categories: { include: { category: true } },
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
        categories: { include: { category: true } },
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
            assignments: {
              where: {
                ...(includeUnpublished ? {} : { isPublished: true }),
                lectureId: null, // exclude lecture-level assignments
              },
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                title: true,
                points: true,
                dueDate: true,
                isPublished: true,
                submissionType: true,
                moduleId: true,
              },
            },
            quizzes: {
              where: includeUnpublished ? {} : { isPublished: true },
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                title: true,
                description: true,
                isPublished: true,
                moduleId: true,
                _count: { select: { questions: true } },
              },
            },
            forums: {
              where: includeUnpublished ? {} : { isPublished: true },
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                title: true,
                description: true,
                isPublished: true,
                moduleId: true,
                _count: { select: { threads: true } },
              },
            },
            moduleSurveys: {
              include: {
                survey: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    isPublished: true,
                    _count: { select: { questions: true } },
                  },
                },
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

  /**
   * Get course by ID with ownership check for unpublished content.
   * Admins can see all unpublished courses.
   * Instructors can only see their own unpublished courses.
   */
  async getCourseByIdWithOwnerCheck(id: number, userId?: number, isAdmin = false, isInstructor = false) {
    // First, get the course without status filter to check ownership
    const course = await prisma.course.findUnique({
      where: { id },
      select: { id: true, instructorId: true, status: true },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Determine if we should include unpublished content
    let includeUnpublished = false;
    if (isAdmin) {
      // Admins can see all unpublished content
      includeUnpublished = true;
    } else if (isInstructor && course.instructorId === userId) {
      // Instructors can only see unpublished content for their own courses
      includeUnpublished = true;
    }

    // If course is unpublished and user doesn't have access, throw 404
    if (course.status !== 'published' && !includeUnpublished) {
      throw new AppError('Course not found', 404);
    }

    return this.getCourseById(id, includeUnpublished);
  }

  /**
   * Get all data needed by CurriculumEditor in a SINGLE database query.
   * Returns course (with modules/lectures/codeLabs), assignments, tutors, labs, and forums.
   */
  async getCourseDetails(id: number, userId: number, isAdmin = false, isInstructor = false) {
    // Ownership check (inline, no extra query needed – we check after the main fetch)
    const result = await prisma.course.findUnique({
      where: { id },
      include: {
        instructor: { select: { id: true, fullname: true, email: true } },
        categories: { include: { category: true } },
        _count: { select: { enrollments: true } },

        modules: {
          orderBy: { orderIndex: 'asc' },
          include: {
            lectures: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true, title: true, contentType: true, duration: true,
                orderIndex: true, isPublished: true, isFree: true,
                sections: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true, type: true, fileName: true, fileUrl: true, fileType: true, order: true,
                  },
                },
              },
            },
            codeLabs: {
              orderBy: { orderIndex: 'asc' },
              select: { id: true, title: true, description: true, orderIndex: true, isPublished: true },
            },
            quizzes: {
              orderBy: { createdAt: 'asc' },
              select: { id: true, title: true, description: true, isPublished: true, _count: { select: { questions: true } } },
            },
            moduleSurveys: {
              include: {
                survey: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    isPublished: true,
                    _count: { select: { questions: true, responses: true } },
                  },
                },
              },
            },
          },
        },

        assignments: {
          orderBy: { createdAt: 'asc' },
          include: {
            module: { select: { id: true, title: true } },
            _count: { select: { submissions: true } },
          },
        },

        courseTutors: {
          orderBy: { displayOrder: 'asc' },
          include: {
            chatbot: {
              select: {
                id: true, name: true, displayName: true, description: true,
                systemPrompt: true, welcomeMessage: true, avatarUrl: true,
                personality: true, temperature: true,
              },
            },
            _count: { select: { conversations: true } },
            conversations: { select: { _count: { select: { messages: true } } } },
          },
        },

        labAssignments: {
          include: {
            lab: {
              include: {
                creator: { select: { id: true, fullname: true } },
                _count: { select: { templates: true } },
              },
            },
            module: { select: { id: true, title: true } },
          },
        },

        forums: {
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'desc' }],
          include: { _count: { select: { threads: true } } },
        },
      },
    });

    if (!result) throw new AppError('Course not found', 404);

    // Access check
    const canSeeUnpublished = isAdmin || (isInstructor && result.instructorId === userId);
    if (result.status !== 'published' && !canSeeUnpublished) {
      throw new AppError('Course not found', 404);
    }

    // Destructure so `course` doesn't carry the extra joined arrays
    const { assignments, courseTutors: rawTutors, labAssignments, forums, ...courseData } = result;

    // Compute totalMessages per tutor from nested counts (avoids N+1)
    const tutors = rawTutors.map(({ conversations, ...tutor }) => ({
      ...tutor,
      totalMessages: conversations.reduce((sum: number, c: any) => sum + (c._count?.messages ?? 0), 0),
    }));

    // Fetch all surveys by this instructor (for "Add Survey" modal in curriculum editor)
    const surveys = await prisma.survey.findMany({
      where: isAdmin ? {} : { createdById: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        isPublished: true,
        _count: { select: { questions: true, responses: true } },
      },
    });

    return { course: courseData, assignments, tutors, labs: labAssignments, forums, surveys };
  }

  async getCourseBySlug(slug: string) {
    const course = await prisma.course.findUnique({
      where: { slug, status: 'published' },
      include: {
        instructor: {
          select: { id: true, fullname: true },
        },
        categories: { include: { category: true } },
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

  /**
   * Get course by slug with ownership check for unpublished content.
   * Admins can see all unpublished courses.
   * Instructors can only see their own unpublished courses.
   */
  async getCourseBySlugWithOwnerCheck(slug: string, userId?: number, isAdmin = false, isInstructor = false) {
    // First, get the course without status filter to check ownership
    const course = await prisma.course.findUnique({
      where: { slug },
      select: { id: true, instructorId: true, status: true },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Determine if we should include unpublished content
    let includeUnpublished = false;
    if (isAdmin) {
      // Admins can see all unpublished content
      includeUnpublished = true;
    } else if (isInstructor && course.instructorId === userId) {
      // Instructors can only see unpublished content for their own courses
      includeUnpublished = true;
    }

    // If course is unpublished and user doesn't have access, throw 404
    if (course.status !== 'published' && !includeUnpublished) {
      throw new AppError('Course not found', 404);
    }

    // Return full course with appropriate visibility
    if (includeUnpublished) {
      return prisma.course.findUnique({
        where: { slug },
        include: {
          instructor: {
            select: { id: true, fullname: true },
          },
          categories: { include: { category: true } },
          modules: {
            orderBy: { orderIndex: 'asc' },
            include: {
              lectures: {
                orderBy: { orderIndex: 'asc' },
                select: {
                  id: true,
                  title: true,
                  contentType: true,
                  duration: true,
                  isFree: true,
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
    }

    return this.getCourseBySlug(slug);
  }

  async createCourse(instructorId: number, data: CreateCourseInput, context?: SystemEventContext) {
    const slug = this.generateSlug(data.title);
    const { categoryIds, ...courseData } = data;

    const activationCode = this.generateActivationCode();

    const course = await prisma.course.create({
      data: {
        ...courseData,
        slug,
        instructorId,
        activationCode,
      },
      include: {
        instructor: {
          select: { id: true, fullname: true },
        },
        categories: { include: { category: true } },
      },
    });

    if (categoryIds?.length) {
      await prisma.courseCategory.createMany({
        data: categoryIds.map(categoryId => ({ courseId: course.id, categoryId })),
      });
    }

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
        newValues: { title: course.title, description: course.description, difficulty: course.difficulty },
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
      difficulty: course.difficulty,
      status: course.status,
      isPublic: course.isPublic,
    };

    const { categoryIds, ...courseData } = data;

    const updated = await prisma.course.update({
      where: { id: courseId },
      data: courseData,
      include: {
        instructor: {
          select: { id: true, fullname: true },
        },
        categories: { include: { category: true } },
      },
    });

    if (categoryIds !== undefined) {
      await prisma.courseCategory.deleteMany({ where: { courseId } });
      if (categoryIds.length) {
        await prisma.courseCategory.createMany({
          data: categoryIds.map(categoryId => ({ courseId, categoryId })),
        });
      }
    }

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

  async getInstructorCourses(instructorId: number, _isAdmin = false) {
    // Always filter by instructorId — admins should only see their own courses on the teach dashboard
    const where = { instructorId };

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
      tutorRoutingMode?: 'free' | 'all' | 'single' | 'smart' | 'collaborative' | 'random';
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
