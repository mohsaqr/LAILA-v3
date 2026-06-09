import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateLectureInput, UpdateLectureInput } from '../utils/validation.js';
import { activityLogService } from './activityLog.service.js';
import { courseRoleService } from './courseRole.service.js';
import { assertWithinAvailability } from '../utils/availability.js';

export class LectureService {
  private async verifyModuleOwnership(moduleId: number, instructorId: number, isAdmin = false) {
    const module = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: { course: true },
    });

    if (!module) {
      throw new AppError('Module not found', 404);
    }

    if (module.course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, module.course.id);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
    }

    return module;
  }

  async getLectures(moduleId: number) {
    const lectures = await prisma.lecture.findMany({
      where: { moduleId },
      orderBy: { orderIndex: 'asc' },
      include: {
        attachments: true,
        sections: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return lectures;
  }

  /**
   * Get lectures with access check - verifies user is enrolled, instructor, or admin.
   */
  async getLecturesWithAccessCheck(moduleId: number, userId: number, isInstructor: boolean, isAdmin: boolean) {
    // Get the module to find the course
    const module = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: {
        course: {
          select: { id: true, instructorId: true, status: true },
        },
      },
    });

    if (!module) {
      throw new AppError('Module not found', 404);
    }

    // Check if user has access
    const isCourseInstructor = module.course.instructorId === userId;

    let isTeamMember = false;
    if (!isAdmin && !isCourseInstructor) {
      isTeamMember = await courseRoleService.isTeamMember(userId, module.course.id);
      if (!isTeamMember) {
        // Check enrollment for students
        const enrollment = await prisma.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId,
              courseId: module.course.id,
            },
          },
        });

        if (!enrollment) {
          throw new AppError('You must be enrolled to access this content', 403);
        }

        // If course is unpublished and user is just a student, deny access
        if (module.course.status !== 'published') {
          throw new AppError('Course content is not available', 403);
        }
      }
    }

    // Return lectures - instructors, admins, and team members see all, students see published only
    const showUnpublished = isAdmin || isCourseInstructor || isTeamMember;

    const lectures = await prisma.lecture.findMany({
      where: {
        moduleId,
        ...(showUnpublished ? {} : { isPublished: true }),
      },
      orderBy: { orderIndex: 'asc' },
      include: {
        attachments: true,
        sections: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return lectures;
  }

  async getLectureById(lectureId: number, userId?: number, isAdmin = false) {
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        attachments: true,
        sections: {
          orderBy: { order: 'asc' },
          include: {
            assignment: {
              select: { id: true, title: true, dueDate: true, points: true },
            },
          },
        },
        module: {
          include: {
            course: {
              select: { id: true, title: true, instructorId: true },
            },
          },
        },
      },
    });

    if (!lecture) {
      throw new AppError('Lecture not found', 404);
    }

    // Access control. Course staff (admin / owner / team) can always view.
    if (userId && !isAdmin) {
      const courseId = lecture.module.course.id;
      const isOwner = lecture.module.course.instructorId === userId;
      const moduleHidden = (lecture.module as { isPublished?: boolean }).isPublished === false;
      const lectureHidden = lecture.isPublished === false;

      if (moduleHidden || lectureHidden) {
        // Content in a hidden module / unpublished lecture is invisible to
        // students — only course staff may reach it. Treat as not found.
        const isTeam = isOwner ? true : await courseRoleService.isTeamMember(userId, courseId);
        if (!isOwner && !isTeam) {
          throw new AppError('Lecture not found', 404);
        }
      } else if (!isOwner) {
        // Published lecture in a visible module. Non-free content requires
        // enrollment (or team). Enrolled non-staff students are also gated by
        // the instructor-scheduled availability window.
        const isTeam = await courseRoleService.isTeamMember(userId, courseId);
        if (!isTeam) {
          if (!lecture.isFree) {
            const enrollment = await prisma.enrollment.findUnique({
              where: { userId_courseId: { userId, courseId } },
            });
            if (!enrollment) {
              throw new AppError('You must be enrolled to access this lecture', 403);
            }
          }
          // Non-staff viewer (student or guest on a free lecture): enforce window.
          assertWithinAvailability(lecture, 'Lecture');
        }
      }
    }

    // Log lecture view activity (only for authenticated users)
    if (userId) {
      activityLogService.logActivity({
        userId,
        verb: 'viewed',
        objectType: 'lecture',
        objectId: lectureId,
        objectTitle: lecture.title,
        lectureId,
        moduleId: lecture.module.id,
        courseId: lecture.module.course.id,
      }).catch(() => {}); // Non-blocking
    }

    return lecture;
  }

  async createLecture(moduleId: number, instructorId: number, data: CreateLectureInput, isAdmin = false) {
    await this.verifyModuleOwnership(moduleId, instructorId, isAdmin);

    // Get max order index
    const maxOrder = await prisma.lecture.findFirst({
      where: { moduleId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    const lecture = await prisma.lecture.create({
      data: {
        ...data,
        moduleId,
        orderIndex: data.orderIndex ?? (maxOrder?.orderIndex ?? -1) + 1,
      },
      include: {
        attachments: true,
        sections: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return lecture;
  }

  async updateLecture(lectureId: number, instructorId: number, data: UpdateLectureInput, isAdmin = false) {
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        module: {
          include: { course: true },
        },
      },
    });

    if (!lecture) {
      throw new AppError('Lecture not found', 404);
    }

    if (lecture.module.course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, lecture.module.course.id);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
    }

    const updated = await prisma.lecture.update({
      where: { id: lectureId },
      data,
      include: {
        attachments: true,
        sections: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return updated;
  }

  async deleteLecture(lectureId: number, instructorId: number, isAdmin = false) {
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        module: {
          include: { course: true },
        },
      },
    });

    if (!lecture) {
      throw new AppError('Lecture not found', 404);
    }

    if (lecture.module.course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, lecture.module.course.id);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
    }

    await prisma.lecture.delete({
      where: { id: lectureId },
    });

    return { message: 'Lecture deleted successfully' };
  }

  /**
   * Deep-copy a lecture (page) within its own module: the lecture row plus
   * all of its content sections and file attachments. Student-generated data
   * (chatbot conversations / interaction logs) is intentionally NOT copied —
   * a duplicate is authoring content, not learner history.
   *
   * The copy is appended at the end of the module, left unpublished, and its
   * title is suffixed with "(copy)" so it never silently goes live for
   * students.
   */
  async duplicateLecture(lectureId: number, instructorId: number, isAdmin = false) {
    const source = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        module: { include: { course: true } },
        sections: { orderBy: { order: 'asc' }, include: { assignment: true } },
        attachments: true,
      },
    });

    if (!source) {
      throw new AppError('Lecture not found', 404);
    }

    if (source.module.course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, source.module.course.id);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
    }

    // Place the copy right after the last lecture in the same module.
    const maxOrder = await prisma.lecture.findFirst({
      where: { moduleId: source.moduleId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    // Deep-copy any Assignment attached to a section so the duplicate owns its
    // own rows. Sharing a single Assignment across two lectures lets edits or a
    // section deletion on the copy corrupt the original's student submissions.
    // The whole copy (assignment clones + lecture) is one transaction so a
    // failure leaves no orphan rows behind.
    const copy = await prisma.$transaction(async (tx) => {
      const assignmentIdMap = new Map<number, number>();
      for (const s of source.sections) {
        // Clone for any section that carries a real Assignment row, regardless
        // of section type — a section whose type drifted away from 'assignment'
        // can still hold a valid assignmentId we must not share or drop.
        if (!s.assignment || assignmentIdMap.has(s.assignment.id)) {
          continue;
        }
        const a = s.assignment;
        const clone = await tx.assignment.create({
          data: {
            courseId: a.courseId,
            moduleId: a.moduleId,
            title: a.title,
            description: a.description,
            instructions: a.instructions,
            submissionType: a.submissionType,
            maxFileSize: a.maxFileSize,
            allowedFileTypes: a.allowedFileTypes,
            dueDate: a.dueDate,
            gracePeriodDeadline: a.gracePeriodDeadline,
            availableFrom: a.availableFrom,
            availableUntil: a.availableUntil,
            points: a.points,
            weight: a.weight,
            isPublished: false,
            aiAssisted: a.aiAssisted,
            aiPrompt: a.aiPrompt,
            agentRequirements: a.agentRequirements,
            reflectionRequirement: a.reflectionRequirement,
            postSurveyId: a.postSurveyId,
            postSurveyRequired: a.postSurveyRequired,
            orderIndex: a.orderIndex,
          },
        });
        assignmentIdMap.set(a.id, clone.id);
      }

      return tx.lecture.create({
        data: {
          moduleId: source.moduleId,
          title: `${source.title} (copy)`,
          description: source.description,
          content: source.content,
          contentType: source.contentType,
          videoUrl: source.videoUrl,
          duration: source.duration,
          orderIndex: (maxOrder?.orderIndex ?? -1) + 1,
          isPublished: false,
          isFree: source.isFree,
          sections: {
            create: source.sections.map(s => ({
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
              // Prefer the freshly-cloned id; fall back to the original id if
              // (somehow) no clone was made, so a duplicate never silently
              // loses its assignment link. The deleteSection ref-count guard
              // keeps a fallback-shared row from being cascade-deleted.
              assignmentId: s.assignmentId != null
                ? (assignmentIdMap.get(s.assignmentId) ?? s.assignmentId)
                : null,
              showDeadline: s.showDeadline,
              showPoints: s.showPoints,
            })),
          },
          attachments: {
            create: source.attachments.map(a => ({
              fileName: a.fileName,
              fileUrl: a.fileUrl,
              fileType: a.fileType,
              fileSize: a.fileSize,
            })),
          },
        },
        include: {
          attachments: true,
          sections: { orderBy: { order: 'asc' } },
        },
      });
    });

    return copy;
  }

  async reorderLectures(moduleId: number, instructorId: number, lectureIds: number[], isAdmin = false) {
    await this.verifyModuleOwnership(moduleId, instructorId, isAdmin);

    await Promise.all(
      lectureIds.map((id, index) =>
        prisma.lecture.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );

    return { message: 'Lectures reordered successfully' };
  }

  async addAttachment(lectureId: number, instructorId: number, file: {
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize?: number;
  }, isAdmin = false) {
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        module: {
          include: { course: true },
        },
      },
    });

    if (!lecture) {
      throw new AppError('Lecture not found', 404);
    }

    if (lecture.module.course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, lecture.module.course.id);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
    }

    const attachment = await prisma.lectureAttachment.create({
      data: {
        lectureId,
        ...file,
      },
    });

    return attachment;
  }

  async deleteAttachment(attachmentId: number, instructorId: number, isAdmin = false) {
    const attachment = await prisma.lectureAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        lecture: {
          include: {
            module: {
              include: { course: true },
            },
          },
        },
      },
    });

    if (!attachment) {
      throw new AppError('Attachment not found', 404);
    }

    if (attachment.lecture.module.course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, attachment.lecture.module.course.id);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
    }

    await prisma.lectureAttachment.delete({
      where: { id: attachmentId },
    });

    return { message: 'Attachment deleted successfully' };
  }
}

export const lectureService = new LectureService();
