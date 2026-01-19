import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { chatService } from './chat.service.js';

export interface CreateSectionData {
  type: 'text' | 'file' | 'ai-generated' | 'chatbot' | 'assignment';
  title?: string;
  content?: string;
  fileName?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  order?: number;
  // Chatbot fields
  chatbotTitle?: string;
  chatbotIntro?: string;
  chatbotImageUrl?: string | null;
  chatbotSystemPrompt?: string;
  chatbotWelcome?: string;
  // Assignment fields
  assignmentId?: number;
  showDeadline?: boolean;
  showPoints?: boolean;
}

export interface UpdateSectionData {
  title?: string;
  content?: string;
  fileName?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  order?: number;
  // Chatbot fields
  chatbotTitle?: string;
  chatbotIntro?: string;
  chatbotImageUrl?: string | null;
  chatbotSystemPrompt?: string;
  chatbotWelcome?: string;
  // Assignment fields
  assignmentId?: number;
  showDeadline?: boolean;
  showPoints?: boolean;
}

export interface GenerateAIContentRequest {
  prompt: string;
  context?: string;
  lectureId?: number;
}

export class SectionService {
  private async verifyLectureOwnership(lectureId: number, instructorId: number, isAdmin = false) {
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

    return lecture;
  }

  private async verifySectionOwnership(sectionId: number, instructorId: number, isAdmin = false) {
    const section = await prisma.lectureSection.findUnique({
      where: { id: sectionId },
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

    if (!section) {
      throw new AppError('Section not found', 404);
    }

    if (section.lecture.module.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    return section;
  }

  async getSections(lectureId: number) {
    const sections = await prisma.lectureSection.findMany({
      where: { lectureId },
      orderBy: { order: 'asc' },
      include: {
        assignment: true,
      },
    });

    return sections;
  }

  async getCourseAssignmentsForSection(courseId: number) {
    const assignments = await prisma.assignment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        points: true,
        isPublished: true,
        module: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return assignments;
  }

  async createSection(lectureId: number, instructorId: number, data: CreateSectionData, isAdmin = false) {
    await this.verifyLectureOwnership(lectureId, instructorId, isAdmin);

    // Get max order index
    const maxOrder = await prisma.lectureSection.findFirst({
      where: { lectureId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const section = await prisma.lectureSection.create({
      data: {
        lectureId,
        type: data.type,
        title: data.title,
        content: data.content,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize,
        order: data.order ?? (maxOrder?.order ?? -1) + 1,
        // Chatbot fields
        chatbotTitle: data.chatbotTitle,
        chatbotIntro: data.chatbotIntro,
        chatbotImageUrl: data.chatbotImageUrl,
        chatbotSystemPrompt: data.chatbotSystemPrompt,
        chatbotWelcome: data.chatbotWelcome,
        // Assignment fields
        assignmentId: data.assignmentId,
        showDeadline: data.showDeadline,
        showPoints: data.showPoints,
      },
      include: {
        assignment: data.type === 'assignment' ? true : false,
      },
    });

    return section;
  }

  async updateSection(sectionId: number, instructorId: number, data: UpdateSectionData, isAdmin = false) {
    const section = await this.verifySectionOwnership(sectionId, instructorId, isAdmin);

    const updated = await prisma.lectureSection.update({
      where: { id: sectionId },
      data: {
        title: data.title,
        content: data.content,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize,
        order: data.order,
        // Chatbot fields
        chatbotTitle: data.chatbotTitle,
        chatbotIntro: data.chatbotIntro,
        chatbotImageUrl: data.chatbotImageUrl,
        chatbotSystemPrompt: data.chatbotSystemPrompt,
        chatbotWelcome: data.chatbotWelcome,
        // Assignment fields
        assignmentId: data.assignmentId,
        showDeadline: data.showDeadline,
        showPoints: data.showPoints,
      },
      include: {
        assignment: section.type === 'assignment' ? true : false,
      },
    });

    return updated;
  }

  async deleteSection(sectionId: number, instructorId: number, isAdmin = false) {
    await this.verifySectionOwnership(sectionId, instructorId, isAdmin);

    await prisma.lectureSection.delete({
      where: { id: sectionId },
    });

    return { message: 'Section deleted successfully' };
  }

  async reorderSections(lectureId: number, instructorId: number, sectionIds: number[], isAdmin = false) {
    await this.verifyLectureOwnership(lectureId, instructorId, isAdmin);

    // Verify all sections belong to this lecture
    const sections = await prisma.lectureSection.findMany({
      where: { lectureId },
      select: { id: true },
    });

    const existingIds = new Set(sections.map(s => s.id));
    for (const id of sectionIds) {
      if (!existingIds.has(id)) {
        throw new AppError(`Section ${id} does not belong to this lecture`, 400);
      }
    }

    // Update order for each section
    await Promise.all(
      sectionIds.map((id, index) =>
        prisma.lectureSection.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    return { message: 'Sections reordered successfully' };
  }

  async generateAIContent(prompt: string, context?: string): Promise<string> {
    const systemPrompt = `You are an expert educational content creator. Generate well-structured lecture content in Markdown format based on the user's prompt.

Guidelines:
- Use clear headings (##, ###) to organize content
- Include bullet points or numbered lists where appropriate
- Add code examples if relevant (using \`\`\` blocks)
- Keep explanations clear and educational
- Include practical examples when possible
- Aim for comprehensive but concise content

${context ? `Context: ${context}` : ''}`;

    try {
      const response = await chatService.chat({
        message: prompt,
        module: 'content-generator',
        systemPrompt,
      });

      return response.reply;
    } catch (error: any) {
      throw new AppError(error.message || 'Failed to generate AI content', 500);
    }
  }
}

export const sectionService = new SectionService();
