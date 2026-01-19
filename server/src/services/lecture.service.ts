import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateLectureInput, UpdateLectureInput } from '../utils/validation.js';

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
      throw new AppError('Not authorized', 403);
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

  async getLectureById(lectureId: number, userId?: number) {
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        attachments: true,
        sections: {
          orderBy: { order: 'asc' },
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

    // Check if user has access (enrolled or free lecture or instructor)
    if (userId && !lecture.isFree) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: lecture.module.course.id,
          },
        },
      });

      const isInstructor = lecture.module.course.instructorId === userId;

      if (!enrollment && !isInstructor) {
        throw new AppError('You must be enrolled to access this lecture', 403);
      }
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
      throw new AppError('Not authorized', 403);
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
      throw new AppError('Not authorized', 403);
    }

    await prisma.lecture.delete({
      where: { id: lectureId },
    });

    return { message: 'Lecture deleted successfully' };
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
      throw new AppError('Not authorized', 403);
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
      throw new AppError('Not authorized', 403);
    }

    await prisma.lectureAttachment.delete({
      where: { id: attachmentId },
    });

    return { message: 'Attachment deleted successfully' };
  }
}

export const lectureService = new LectureService();
