import crypto from 'crypto';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateCourseInput, UpdateCourseInput } from '../utils/validation.js';
import { CourseFilters } from '../types/index.js';
import { learningAnalyticsService } from './learningAnalytics.service.js';
import { courseRoleService } from './courseRole.service.js';
import { prerequisiteService } from './prerequisite.service.js';
import { availabilityWindowWhere } from '../utils/availability.js';

// Context for system event logging
export interface SystemEventContext {
  actorId?: number;
  ipAddress?: string;
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];

/**
 * Derive a lecture's resource kind from its sections so the curriculum can show
 * a distinct icon (folder/url/embed/video/file/image) instead of the generic
 * lesson icon. A "media-as-section" resource is exactly ONE section: a `file`
 * section (→ image vs file by type), or a text section holding a single marker
 * node. Multi-section lectures and plain pages return null (generic icon).
 */
function lectureResourceKind(
  sections?: { type?: string | null; content?: string | null; fileType?: string | null }[],
): string | null {
  if (!sections || sections.length !== 1) return null;
  const s = sections[0];
  if (s.type === 'file') {
    const ft = (s.fileType ?? '').toLowerCase();
    const ext = ft.includes('/') ? ft.split('/').pop() ?? '' : ft.replace(/^\./, '');
    return ft.startsWith('image/') || IMAGE_EXTS.includes(ext) ? 'image' : 'file';
  }
  const content = s.content ?? '';
  if (content.includes('<lecture-folder')) return 'folder';
  if (content.includes('<lecture-url')) return 'url';
  if (content.includes('<lecture-embed')) return 'embed';
  if (content.includes('<lecture-video')) return 'video';
  return null;
}

export class CourseService {
  // Generate a random 8-character alphanumeric activation code (letters + numbers)
  private generateActivationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
    const bytes = crypto.randomBytes(8);
    return Array.from(bytes, b => chars[b % chars.length]).join('');
  }

  /**
   * Issue a fresh activation code, invalidating the one already handed out.
   *
   * Wanted when a code has spread beyond the intended class. activation_code is
   * UNIQUE, so each candidate is checked before it is written rather than
   * letting a collision surface to the instructor as a P2002.
   */
  async regenerateActivationCode(courseId: number, instructorId: number, isAdmin = false) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) {
      throw new AppError('Course not found', 404);
    }
    if (!(await courseRoleService.canEditContent(instructorId, courseId, isAdmin))) {
      throw new AppError('Not authorized to change this course', 403);
    }

    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = this.generateActivationCode();
      const taken = await prisma.course.findFirst({
        where: { activationCode: candidate },
        select: { id: true },
      });
      if (taken) continue;
      return prisma.course.update({
        where: { id: courseId },
        data: { activationCode: candidate },
        select: { id: true, activationCode: true },
      });
    }
    throw new AppError('Could not generate a unique activation code', 500);
  }

  // Generate slug from title
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36);
  }

  /**
   * Drop the activation code from a course payload and expose only whether one
   * exists. A course code is a signup sponsorship (courseCodeSignup.service):
   * anyone holding it can enrol AND, in invite_only/approval registration modes,
   * self-register bypassing the approval queue — so it must never reach a viewer
   * who is not the course's own staff. Public catalog and slug lookups run this;
   * GET /:id does the equivalent inline for its authenticated viewers.
   */
  private stripActivationCode<T extends { activationCode?: string | null }>(course: T) {
    const { activationCode, ...rest } = course;
    return { ...rest, hasActivationCode: !!activationCode };
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
            select: { id: true, fullname: true, avatarUrl: true },
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
      courses: courses.map((c) => this.stripActivationCode(c)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCourseById(id: number, includeUnpublished = false) {
    if (!Number.isInteger(id)) {
      throw new AppError('Course not found', 404);
    }

    const where: any = { id };
    if (!includeUnpublished) {
      where.status = 'published';
    }

    const course = await prisma.course.findFirst({
      where,
      include: {
        instructor: {
          select: { id: true, fullname: true, email: true, avatarUrl: true },
        },
        categories: { include: { category: true } },
        modules: {
          where: includeUnpublished ? {} : { isPublished: true, ...availabilityWindowWhere() },
          orderBy: { orderIndex: 'asc' },
          include: {
            lectures: {
              where: includeUnpublished ? {} : { isPublished: true, ...availabilityWindowWhere() },
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                title: true,
                description: true,
                contentType: true,
                duration: true,
                orderIndex: true,
                isPublished: true,
                isFree: true,
                // Minimal section info to derive the resource kind (folder/url/
                // embed/video/file/image) for the curriculum icon. Section
                // `content` is used only to detect the marker node server-side
                // and is stripped before the response (never shipped to the
                // public page).
                sections: {
                  orderBy: { order: 'asc' },
                  select: { type: true, content: true, fileType: true },
                },
              },
            },
            codeLabs: {
              where: includeUnpublished ? {} : { isPublished: true, ...availabilityWindowWhere() },
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
                ...(includeUnpublished ? {} : { isPublished: true, ...availabilityWindowWhere() }),
                lectureId: null, // exclude lecture-level assignments
              },
              // `orderIndex` is the sort key the curriculum editor's up/down
              // arrows write (moduleService.reorderModuleItems). It MUST be
              // selected as well as ordered by: the course page merges
              // assignments, lectures, quizzes and forums into one list and
              // re-sorts them client-side (ModuleSection.tsx), so an assignment
              // that arrives without the field falls back to 0 and pins itself
              // above every real index — i.e. reordering silently does nothing.
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                title: true,
                description: true,
                points: true,
                dueDate: true,
                gracePeriodDeadline: true,
                isPublished: true,
                submissionType: true,
                moduleId: true,
                orderIndex: true,
                agentRequirements: true,
              },
            },
            labAssignments: {
              // Labs have no draft/availability state today (CustomLab has no
              // isPublished/availableFrom columns), so there is nothing to gate
              // here yet — but if such a flag is ever added, mirror the
              // isPublished + availabilityWindowWhere() gate used by the
              // sibling relations so staged labs don't leak to students.
              where: { assignmentId: null },
              include: {
                lab: {
                  select: { id: true, name: true, labType: true, description: true },
                },
              },
            },
            quizzes: {
              where: includeUnpublished ? {} : { isPublished: true, ...availabilityWindowWhere() },
              // Same sort key, same reason as `assignments` above.
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                title: true,
                description: true,
                isPublished: true,
                moduleId: true,
                orderIndex: true,
                _count: { select: { questions: true } },
              },
            },
            forumThreads: {
              where: includeUnpublished ? {} : { isPublished: true, ...availabilityWindowWhere() },
              orderBy: [{ isPinned: 'desc' }, { orderIndex: 'asc' }],
              select: {
                id: true,
                title: true,
                description: true,
                isPublished: true,
                moduleId: true,
                // Ordered by above, but the client re-sorts across types, so the
                // value has to travel too — see the note on `assignments`.
                orderIndex: true,
                _count: { select: { posts: true } },
              },
            },
            moduleSurveys: {
              // The junction row has no publish flag of its own, so gate on the
              // related survey's isPublished. Without this, draft surveys'
              // title/description/question-count leak to students on the public
              // page (every sibling relation above is already gated).
              where: includeUnpublished ? {} : { survey: { isPublished: true } },
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

    // Derive a lightweight `resourceKind` per lecture for the curriculum icon,
    // then strip section `content` so the public page never receives it.
    for (const m of course.modules as any[]) {
      for (const l of (m.lectures ?? []) as any[]) {
        l.resourceKind = lectureResourceKind(l.sections);
        delete l.sections;
      }
    }

    // Prerequisites live in a relation-less table; fetch + attach so the
    // public course page can show them as links.
    const prerequisites = await prerequisiteService.getPrerequisites(id);
    return { ...course, prerequisites };
  }

  /**
   * Get course by ID with ownership check for unpublished content.
   * Admins can see all unpublished courses.
   * Instructors can only see their own unpublished courses.
   */
  async getCourseByIdWithOwnerCheck(id: number, userId?: number, isAdmin = false, isInstructor = false) {
    // A non-numeric route param (parseInt('abc') === NaN) would otherwise hit
    // Prisma with `id: NaN` and surface as an opaque 500 instead of a 404.
    if (!Number.isInteger(id)) {
      throw new AppError('Course not found', 404);
    }

    // First, get the course without status filter to check ownership
    const course = await prisma.course.findUnique({
      where: { id },
      select: { id: true, instructorId: true, status: true, isPublic: true },
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
    } else if (isInstructor && userId) {
      // Team members (TA, co_instructor, course_admin) can see unpublished content
      const isTeam = await courseRoleService.isTeamMember(userId, id);
      if (isTeam) includeUnpublished = true;
    }

    // If course is unpublished and user doesn't have access, throw 404
    if (course.status !== 'published' && !includeUnpublished) {
      throw new AppError('Course not found', 404);
    }

    // A published-but-private (restricted) course is hidden from non-staff who
    // are not enrolled — otherwise its details are readable by anyone who
    // iterates course ids. Staff (includeUnpublished) always see it.
    if (course.status === 'published' && course.isPublic === false && !includeUnpublished) {
      const enrolled = userId
        ? await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId, courseId: id } },
            select: { id: true },
          })
        : null;
      if (!enrolled) {
        throw new AppError('Course not found', 404);
      }
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
        instructor: { select: { id: true, fullname: true, email: true, avatarUrl: true } },
        categories: { include: { category: true } },
        _count: { select: { enrollments: true } },

        modules: {
          orderBy: { orderIndex: 'asc' },
          include: {
            lectures: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true, title: true, description: true, contentType: true, duration: true,
                orderIndex: true, isPublished: true, isFree: true,
                sections: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true, type: true, order: true, title: true, content: true,
                    fileName: true, fileUrl: true, fileType: true, fileSize: true,
                    chatbotTitle: true, chatbotIntro: true, chatbotImageUrl: true,
                    chatbotSystemPrompt: true, chatbotWelcome: true,
                    assignmentId: true, showDeadline: true, showPoints: true,
                  },
                },
              },
            },
            codeLabs: {
              orderBy: { orderIndex: 'asc' },
              select: { id: true, title: true, description: true, orderIndex: true, isPublished: true },
            },
            quizzes: {
              // `orderIndex` here for the same reason as in getCourseById: the
              // curriculum editor merges all six item types into one flat list
              // and sorts on it (ModuleItem.tsx), so omitting it pins quizzes
              // to the top no matter where the arrows put them.
              orderBy: { orderIndex: 'asc' },
              select: { id: true, title: true, description: true, isPublished: true, orderIndex: true, _count: { select: { questions: true } } },
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

        forumThreads: {
          orderBy: [{ isPinned: 'desc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
          include: { _count: { select: { posts: true } } },
        },
      },
    });

    if (!result) throw new AppError('Course not found', 404);

    // Access check. This payload is the curriculum editor's data — it carries
    // unpublished modules/lectures/quizzes, every section's chatbotSystemPrompt,
    // and each courseTutor's chatbot.systemPrompt. Only staff OF THIS COURSE may
    // see it. Previously the flag gated only the unpublished-course 404, so any
    // instructor could pull another course's prompts and drafts by id. The
    // global isInstructor flag alone is not enough — ownership/team/admin is.
    let isCourseStaff = isAdmin || (isInstructor && result.instructorId === userId);
    if (!isCourseStaff && isInstructor) {
      const isTeam = await courseRoleService.isTeamMember(userId, id);
      if (isTeam) isCourseStaff = true;
    }
    if (!isCourseStaff) {
      throw new AppError('Course not found', 404);
    }

    // Destructure so `course` doesn't carry the extra joined arrays
    const { assignments, courseTutors: rawTutors, labAssignments, forumThreads, ...courseData } = result;
    const forums = forumThreads; // keep legacy key on the API envelope

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

    // Course prerequisites (separate table, no Prisma relation) — attach to
    // the course payload so the setup form can hydrate its multi-select.
    const prerequisites = await prerequisiteService.getPrerequisites(id);
    (courseData as typeof courseData & { prerequisites?: unknown }).prerequisites = prerequisites;

    return { course: courseData, assignments, tutors, labs: labAssignments, forums, surveys };
  }

  async getCourseBySlug(slug: string) {
    const course = await prisma.course.findUnique({
      where: { slug, status: 'published' },
      include: {
        instructor: {
          select: { id: true, fullname: true, avatarUrl: true },
        },
        categories: { include: { category: true } },
        modules: {
          where: { isPublished: true, ...availabilityWindowWhere() },
          orderBy: { orderIndex: 'asc' },
          include: {
            lectures: {
              where: { isPublished: true, ...availabilityWindowWhere() },
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                title: true,
                description: true,
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
    } else if (isInstructor && userId) {
      // Team members (TA, co_instructor, course_admin) can see unpublished content
      const isTeam = await courseRoleService.isTeamMember(userId, course.id);
      if (isTeam) includeUnpublished = true;
    }

    // If course is unpublished and user doesn't have access, throw 404
    if (course.status !== 'published' && !includeUnpublished) {
      throw new AppError('Course not found', 404);
    }

    // Return full course with appropriate visibility. includeUnpublished is
    // exactly "viewer is this course's owner / admin / team member", so it
    // doubles as the gate for revealing the activation code.
    if (includeUnpublished) {
      return prisma.course.findUnique({
        where: { slug },
        include: {
          instructor: {
            select: { id: true, fullname: true, avatarUrl: true },
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

    const publicCourse = await this.getCourseBySlug(slug);
    return this.stripActivationCode(publicCourse);
  }

  async createCourse(instructorId: number, data: CreateCourseInput, context?: SystemEventContext) {
    const slug = this.generateSlug(data.title);
    const { categoryIds, prerequisiteIds, activationCode: providedCode, ...courseData } = data;

    // Use the user-supplied code (uppercased) if non-empty, otherwise auto-generate.
    // Uppercasing is load-bearing, not cosmetic: activation_code is UNIQUE
    // across all courses so that signup can resolve a code to a course
    // (courseCodeSignup.service), and the index is on the stored value. An
    // instructor who picks a code another course already holds gets a 409 from
    // the P2002 branch of error.middleware.
    const activationCode =
      providedCode && providedCode.trim().length > 0
        ? providedCode.trim().toUpperCase()
        : this.generateActivationCode();

    const course = await prisma.course.create({
      data: {
        ...courseData,
        // Blank datetime-local input arrives as '' — store as null.
        startTime: courseData.startTime ? courseData.startTime : null,
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

    if (prerequisiteIds?.length) {
      await prerequisiteService.setPrerequisites(course.id, prerequisiteIds);
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

    if (!(await courseRoleService.canEditContent(instructorId, courseId, isAdmin))) {
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

    const { categoryIds, prerequisiteIds, activationCode, ...courseData } = data;

    // Only touch activationCode when the caller actually sent something
    // non-empty; an empty string means "leave it as is" so we don't wipe
    // the existing code. Uppercased to match the UNIQUE index — see
    // createCourse above.
    const updateData: typeof courseData & { activationCode?: string } = { ...courseData };
    if (typeof activationCode === 'string' && activationCode.trim().length > 0) {
      updateData.activationCode = activationCode.trim().toUpperCase();
    }
    // Normalize the optional start time: '' (cleared field) → null.
    if ('startTime' in updateData) {
      updateData.startTime = updateData.startTime ? updateData.startTime : null;
    }

    const updated = await prisma.course.update({
      where: { id: courseId },
      data: updateData,
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

    if (prerequisiteIds !== undefined) {
      await prerequisiteService.setPrerequisites(courseId, prerequisiteIds);
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

    if (!(await courseRoleService.canEditContent(instructorId, courseId, isAdmin))) {
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

    if (!(await courseRoleService.canEditContent(instructorId, courseId, isAdmin))) {
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

    if (!(await courseRoleService.canEditContent(instructorId, courseId, isAdmin))) {
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
    // Admins see every course regardless of ownership. Instructors see
    // courses they own plus any where they have a team role (TA,
    // co_instructor, course_admin).
    let where: any;
    if (isAdmin) {
      where = {};
    } else {
      const teamRoles = await prisma.courseRole.findMany({
        where: { userId: instructorId },
        select: { courseId: true },
      });
      const teamCourseIds = teamRoles.map(r => r.courseId);
      where = teamCourseIds.length > 0
        ? { OR: [{ instructorId }, { id: { in: teamCourseIds } }] }
        : { instructorId };
    }

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
      const isTeam = await courseRoleService.isTeamMember(instructorId, courseId);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
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

    if (!(await courseRoleService.canEditContent(instructorId, courseId, isAdmin))) {
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
