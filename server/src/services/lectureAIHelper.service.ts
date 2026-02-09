import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { chatService } from './chat.service.js';
import { createLogger } from '../utils/logger.js';
import { llmService } from './llm.service.js';
import { pdfExtractorService, PDFInfo } from './pdfExtractor.service.js';

const logger = createLogger('lectureAIHelper');

// PDF info for frontend page selection
export interface LecturePDFInfo {
  id: number;
  fileName: string;
  pageCount: number;
  source: 'section' | 'attachment';
  fileUrl: string;
}

// Page ranges for PDF extraction
export interface PDFPageRanges {
  [fileName: string]: string; // e.g., { "Chapter5.pdf": "1-5", "Notes.pdf": "all" }
}

export type LectureAIHelperMode = 'explain' | 'discuss';

// Types for Explain mode threads
export interface ExplainPost {
  id: number;
  parentId: number | null;
  authorType: 'user' | 'ai';
  content: string;
  aiModel?: string | null;
  createdAt: Date;
  replies?: ExplainPost[];
}

export interface ExplainThread {
  id: number;
  question: string;
  createdAt: Date;
  posts: ExplainPost[];
}

interface LectureContext {
  title: string;
  content: string;
  sections: Array<{
    title?: string;
    content?: string;
    type: string;
  }>;
  courseName: string;
  moduleName: string;
  hasPdfContent?: boolean;
}

interface ChatResult {
  reply: string;
  model: string;
  responseTime: number;
  sessionId: string;
}

export class LectureAIHelperService {
  /**
   * Build context from lecture content for AI prompts
   * @param pdfPageRanges - Optional page ranges for PDF extraction
   */
  async buildLectureContext(lectureId: number, pdfPageRanges?: PDFPageRanges): Promise<LectureContext> {
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
        attachments: true,
        module: {
          include: {
            course: {
              select: { title: true },
            },
          },
        },
      },
    });

    if (!lecture) {
      throw new AppError('Lecture not found', 404);
    }

    // Build content from sections
    let content = '';
    if (lecture.content) {
      content = this.stripHtml(lecture.content);
    }

    // Filter text/ai-generated sections for the sections array
    const textSections = lecture.sections.filter(s => s.type === 'text' || s.type === 'ai-generated');
    const sections = textSections.map(section => ({
      title: section.title || undefined,
      content: section.content ? this.stripHtml(section.content) : undefined,
      type: section.type,
    }));

    // Also add text section content to main content
    for (const section of sections) {
      if (section.content) {
        if (section.title) {
          content += `\n\n## ${section.title}\n${section.content}`;
        } else {
          content += `\n\n${section.content}`;
        }
      }
    }

    // Extract PDF content from file sections
    let hasPdfContent = false;

    // Debug: Log all sections to understand what's available
    logger.info({
      lectureId,
      sectionCount: lecture.sections.length,
      sections: lecture.sections.map(s => ({
        id: s.id,
        type: s.type,
        fileType: s.fileType,
        fileName: s.fileName,
        hasFileUrl: !!s.fileUrl
      }))
    }, 'Lecture sections for PDF extraction');

    for (const section of lecture.sections) {
      // Check for PDF files - be more flexible with fileType matching
      const isPdf = section.type === 'file' &&
        section.fileUrl &&
        (section.fileType === 'application/pdf' ||
         section.fileType?.toLowerCase().includes('pdf') ||
         section.fileName?.toLowerCase().endsWith('.pdf'));

      if (isPdf) {
        const fileName = section.fileName || 'PDF Document';
        const pageRange = pdfPageRanges?.[fileName] || 'all';

        logger.info({ lectureId, fileName, fileUrl: section.fileUrl, pageRange }, 'Extracting PDF from section');

        const pdfText = await pdfExtractorService.extractFromUrl(section.fileUrl!, pageRange);
        if (pdfText) {
          hasPdfContent = true;
          const title = section.title || fileName;
          const rangeInfo = pageRange !== 'all' ? ` (pages ${pageRange})` : '';
          content += `\n\n## ${title}${rangeInfo} (PDF)\n${pdfText}`;
          logger.info({ lectureId, fileName, pageRange, textLength: pdfText.length }, 'PDF text extracted from section');
        } else {
          logger.warn({ lectureId, fileName }, 'PDF extraction returned empty text');
        }
      }
    }

    // Extract PDF content from attachments
    logger.info({
      lectureId,
      attachmentCount: lecture.attachments?.length || 0,
      attachments: lecture.attachments?.map(a => ({
        id: a.id,
        fileType: a.fileType,
        fileName: a.fileName,
        hasFileUrl: !!a.fileUrl
      }))
    }, 'Lecture attachments for PDF extraction');

    for (const attachment of lecture.attachments || []) {
      // More flexible PDF detection for attachments
      const isPdf = attachment.fileUrl &&
        (attachment.fileType === 'application/pdf' ||
         attachment.fileType?.toLowerCase().includes('pdf') ||
         attachment.fileName?.toLowerCase().endsWith('.pdf'));

      if (isPdf) {
        const fileName = attachment.fileName;
        const pageRange = pdfPageRanges?.[fileName] || 'all';

        logger.info({ lectureId, fileName, fileUrl: attachment.fileUrl, pageRange }, 'Extracting PDF from attachment');

        const pdfText = await pdfExtractorService.extractFromUrl(attachment.fileUrl, pageRange);
        if (pdfText) {
          hasPdfContent = true;
          const rangeInfo = pageRange !== 'all' ? ` (pages ${pageRange})` : '';
          content += `\n\n## ${fileName}${rangeInfo} (Attachment)\n${pdfText}`;
          logger.info({ lectureId, fileName, pageRange, textLength: pdfText.length }, 'PDF text extracted from attachment');
        } else {
          logger.warn({ lectureId, fileName }, 'PDF extraction from attachment returned empty text');
        }
      }
    }

    logger.info({ lectureId, hasPdfContent, contentLength: content.length }, 'Lecture context built');

    return {
      title: lecture.title,
      content: content.trim(),
      sections,
      courseName: lecture.module.course.title,
      moduleName: lecture.module.title,
      hasPdfContent,
    };
  }

  /**
   * Get PDF information for a lecture (for page selection UI)
   */
  async getPdfInfo(lectureId: number, userId: number, isAdmin = false): Promise<LecturePDFInfo[]> {
    // Verify access
    await this.verifyAccess(lectureId, userId, isAdmin);

    // Fetch all sections and attachments, filter in code for more flexibility
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        sections: {
          where: { type: 'file' },
          orderBy: { order: 'asc' },
        },
        attachments: true,
      },
    });

    if (!lecture) {
      throw new AppError('Lecture not found', 404);
    }

    const pdfInfos: LecturePDFInfo[] = [];

    // Helper to check if a file is a PDF
    const isPdfFile = (fileType?: string | null, fileName?: string | null): boolean => {
      if (fileType === 'application/pdf') return true;
      if (fileType?.toLowerCase().includes('pdf')) return true;
      if (fileName?.toLowerCase().endsWith('.pdf')) return true;
      return false;
    };

    // Get info from PDF sections
    for (const section of lecture.sections) {
      if (section.fileUrl && isPdfFile(section.fileType, section.fileName)) {
        const info = await pdfExtractorService.getPdfInfo(section.fileUrl);
        pdfInfos.push({
          id: section.id,
          fileName: section.fileName || 'PDF Document',
          pageCount: info.pageCount,
          source: 'section',
          fileUrl: section.fileUrl,
        });
      }
    }

    // Get info from PDF attachments
    for (const attachment of lecture.attachments) {
      if (attachment.fileUrl && isPdfFile(attachment.fileType, attachment.fileName)) {
        const info = await pdfExtractorService.getPdfInfo(attachment.fileUrl);
        pdfInfos.push({
          id: attachment.id,
          fileName: attachment.fileName,
          pageCount: info.pageCount,
          source: 'attachment',
          fileUrl: attachment.fileUrl,
        });
      }
    }

    logger.info({ lectureId, pdfCount: pdfInfos.length }, 'PDF info retrieved for lecture');
    return pdfInfos;
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Strip <think> tags and their content from AI responses
   */
  private stripThinkTags(content: string): string {
    // Remove <think>...</think> blocks (including multiline)
    return content
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();
  }

  /**
   * Get system prompt based on mode
   */
  private getSystemPrompt(mode: LectureAIHelperMode, context: LectureContext): string {
    const lectureContent = `
COURSE: ${context.courseName}
MODULE: ${context.moduleName}
LECTURE: ${context.title}

LECTURE CONTENT:
${context.content}
`.trim();

    if (mode === 'explain') {
      return `You are an AI learning assistant helping students understand lecture content.

Your role is to:
- Explain concepts clearly with examples
- Break down complex topics into simpler parts
- Highlight key takeaways and important points
- Keep responses focused and educational
- Use the lecture content as the primary source of truth
- Reference specific parts of the lecture when explaining

Be concise but thorough. Use simple language when possible, and explain technical terms when they appear.

${lectureContent}`;
    }

    // Discuss mode - Socratic method
    return `You are a Socratic tutor engaging students in thoughtful discussion about lecture content.

Your role is to:
- Ask probing questions to deepen understanding
- Encourage critical thinking about the material
- Connect concepts to real-world applications
- Help students discover insights themselves
- Guide students to think beyond the surface level
- Reference the lecture content in your questions

Instead of directly answering, guide students to think through problems. Ask "why" and "how" questions. Challenge assumptions respectfully.

${lectureContent}`;
  }

  /**
   * Verify user has access to lecture (enrolled, instructor, or admin)
   */
  async verifyAccess(lectureId: number, userId: number, isAdmin = false): Promise<{ courseId: number; isInstructor: boolean }> {
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        module: {
          include: {
            course: {
              select: { id: true, instructorId: true },
            },
          },
        },
      },
    });

    if (!lecture) {
      throw new AppError('Lecture not found', 404);
    }

    const courseId = lecture.module.course.id;
    const isInstructor = lecture.module.course.instructorId === userId;

    // Admins and instructors have access
    if (isAdmin || isInstructor) {
      return { courseId, isInstructor };
    }

    // Check enrollment for students
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new AppError('You must be enrolled to use the AI helper', 403);
    }

    return { courseId, isInstructor: false };
  }

  /**
   * Handle chat with AI based on mode
   */
  async chat(
    lectureId: number,
    mode: LectureAIHelperMode,
    message: string,
    userId: number,
    sessionId?: string,
    isAdmin = false
  ): Promise<ChatResult> {
    // Verify access
    await this.verifyAccess(lectureId, userId, isAdmin);

    // Build context
    const context = await this.buildLectureContext(lectureId);

    // Generate session ID if not provided - includes mode for filtering
    const activeSessionId = sessionId || `lecture-ai-${mode}-${lectureId}-${userId}-${Date.now()}`;

    // Get system prompt based on mode
    const systemPrompt = this.getSystemPrompt(mode, context);

    // Get conversation history for this session
    const conversationHistory = await this.getConversationHistory(activeSessionId);

    try {
      const response = await chatService.chat(
        {
          message,
          sessionId: activeSessionId,
          module: `lecture-ai-helper-${lectureId}`,
          systemPrompt,
          conversationHistory,
        },
        userId
      );

      logger.info({
        lectureId,
        mode,
        userId,
        sessionId: activeSessionId,
        responseTime: response.responseTime,
      }, 'Lecture AI helper chat completed');

      return {
        reply: response.reply,
        model: response.model,
        responseTime: response.responseTime,
        sessionId: activeSessionId,
      };
    } catch (error: any) {
      logger.error({ err: error, lectureId, mode }, 'Lecture AI helper chat failed');
      throw new AppError(error.message || 'Failed to get AI response', 500);
    }
  }

  /**
   * Get conversation history for a session
   */
  private async getConversationHistory(sessionId: string): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const logs = await prisma.chatLog.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
      select: { sender: true, message: true },
    });

    return logs.map(log => ({
      role: log.sender === 'User' ? 'user' as const : 'assistant' as const,
      content: log.message,
    }));
  }

  /**
   * Get all sessions for a lecture/user
   */
  async getSessions(lectureId: number, userId: number, isAdmin = false) {
    // Verify access
    await this.verifyAccess(lectureId, userId, isAdmin);

    // Find all unique sessions for this lecture by this user
    const modulePattern = `lecture-ai-helper-${lectureId}`;

    const sessions = await prisma.chatLog.findMany({
      where: {
        userId,
        module: modulePattern,
      },
      select: {
        sessionId: true,
        timestamp: true,
        message: true,
        sender: true,
      },
      orderBy: { timestamp: 'desc' },
    });

    // Group by sessionId and extract metadata
    const sessionMap = new Map<string, {
      sessionId: string;
      mode: LectureAIHelperMode;
      firstMessage: string;
      lastActivity: Date;
      messageCount: number;
    }>();

    for (const log of sessions) {
      if (!log.sessionId) continue;

      const existing = sessionMap.get(log.sessionId);
      if (!existing) {
        // Extract mode from sessionId pattern: lecture-ai-{mode}-{lectureId}-{userId}-{timestamp}
        let mode: LectureAIHelperMode = 'explain';
        const modeMatch = log.sessionId.match(/^lecture-ai-(explain|discuss)-/);
        if (modeMatch) {
          mode = modeMatch[1] as LectureAIHelperMode;
        }

        sessionMap.set(log.sessionId, {
          sessionId: log.sessionId,
          mode,
          firstMessage: log.sender === 'User' ? log.message.slice(0, 100) : '',
          lastActivity: log.timestamp,
          messageCount: 1,
        });
      } else {
        existing.messageCount++;
        // Update first message if this is an earlier user message
        if (log.sender === 'User' && !existing.firstMessage) {
          existing.firstMessage = log.message.slice(0, 100);
        }
      }
    }

    return Array.from(sessionMap.values());
  }

  /**
   * Get chat history for a session (for API)
   */
  async getChatHistory(lectureId: number, sessionId: string, userId: number, isAdmin = false) {
    // Verify access
    await this.verifyAccess(lectureId, userId, isAdmin);

    // Verify session belongs to user
    const sessionCheck = await prisma.chatLog.findFirst({
      where: { sessionId },
      select: { userId: true },
    });

    if (sessionCheck && sessionCheck.userId !== userId) {
      throw new AppError('Not authorized to access this session', 403);
    }

    const logs = await prisma.chatLog.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });

    return logs.map(log => ({
      role: log.sender === 'User' ? 'user' : 'assistant',
      content: log.message,
      timestamp: log.timestamp,
      model: log.aiModel,
    }));
  }

  // ==========================================
  // EXPLAIN MODE - Thread-based Q&A
  // ==========================================

  /**
   * Create a new explain thread with initial question and AI response
   */
  async createExplainThread(
    lectureId: number,
    userId: number,
    question: string,
    isAdmin = false,
    pdfPageRanges?: PDFPageRanges
  ): Promise<ExplainThread> {
    // Verify access
    await this.verifyAccess(lectureId, userId, isAdmin);

    // Build context with optional PDF page ranges
    const context = await this.buildLectureContext(lectureId, pdfPageRanges);
    const systemPrompt = this.getSystemPrompt('explain', context);

    // Get AI response
    const startTime = Date.now();
    let aiResponse: string;
    let aiModel: string;

    try {
      const llmResponse = await llmService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
      });
      const content = llmResponse.choices[0]?.message?.content;
      aiResponse = typeof content === 'string' ? content : 'I apologize, but I was unable to generate a response.';
      // Strip <think> tags from response
      aiResponse = this.stripThinkTags(aiResponse);
      aiModel = llmResponse.model;

      logger.info({
        lectureId,
        userId,
        responseTime: (Date.now() - startTime) / 1000,
      }, 'Explain thread AI response generated');
    } catch (error: any) {
      logger.error({ err: error, lectureId }, 'Explain thread AI response failed');
      throw new AppError(error.message || 'Failed to get AI response', 500);
    }

    // Create thread with user question and AI response posts
    const thread = await prisma.lectureExplainThread.create({
      data: {
        lectureId,
        userId,
        question,
        posts: {
          create: [
            {
              authorType: 'user',
              content: question,
            },
            {
              authorType: 'ai',
              content: aiResponse,
              aiModel,
            },
          ],
        },
      },
      include: {
        posts: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return this.formatThread(thread);
  }

  /**
   * Get all explain threads for a lecture/user
   */
  async getExplainThreads(
    lectureId: number,
    userId: number,
    isAdmin = false
  ): Promise<ExplainThread[]> {
    // Verify access
    await this.verifyAccess(lectureId, userId, isAdmin);

    const threads = await prisma.lectureExplainThread.findMany({
      where: {
        lectureId,
        userId,
      },
      include: {
        posts: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return threads.map(thread => this.formatThread(thread));
  }

  /**
   * Get a single explain thread with all posts
   */
  async getExplainThread(
    lectureId: number,
    threadId: number,
    userId: number,
    isAdmin = false
  ): Promise<ExplainThread> {
    // Verify access
    await this.verifyAccess(lectureId, userId, isAdmin);

    const thread = await prisma.lectureExplainThread.findUnique({
      where: { id: threadId },
      include: {
        posts: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!thread) {
      throw new AppError('Thread not found', 404);
    }

    if (thread.userId !== userId) {
      throw new AppError('Not authorized to access this thread', 403);
    }

    if (thread.lectureId !== lectureId) {
      throw new AppError('Thread does not belong to this lecture', 400);
    }

    return this.formatThread(thread);
  }

  /**
   * Add a follow-up question to an existing thread
   */
  async addFollowUp(
    lectureId: number,
    threadId: number,
    userId: number,
    question: string,
    parentPostId?: number,
    isAdmin = false,
    pdfPageRanges?: PDFPageRanges
  ): Promise<ExplainThread> {
    // Verify access
    await this.verifyAccess(lectureId, userId, isAdmin);

    // Get thread and verify ownership
    const thread = await prisma.lectureExplainThread.findUnique({
      where: { id: threadId },
      include: {
        posts: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!thread) {
      throw new AppError('Thread not found', 404);
    }

    if (thread.userId !== userId) {
      throw new AppError('Not authorized to access this thread', 403);
    }

    if (thread.lectureId !== lectureId) {
      throw new AppError('Thread does not belong to this lecture', 400);
    }

    // Validate parent post if specified
    if (parentPostId) {
      const parentPost = thread.posts.find(p => p.id === parentPostId);
      if (!parentPost) {
        throw new AppError('Parent post not found in this thread', 404);
      }
    }

    // Build context for AI response with optional PDF page ranges
    const context = await this.buildLectureContext(lectureId, pdfPageRanges);
    const systemPrompt = this.getSystemPrompt('explain', context);

    // Build conversation history from thread posts
    const conversationHistory = thread.posts.map(post => ({
      role: post.authorType === 'user' ? 'user' as const : 'assistant' as const,
      content: post.content,
    }));

    // Get AI response
    const startTime = Date.now();
    let aiResponse: string;
    let aiModel: string;

    try {
      const llmResponse = await llmService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: question },
        ],
      });
      const content = llmResponse.choices[0]?.message?.content;
      aiResponse = typeof content === 'string' ? content : 'I apologize, but I was unable to generate a response.';
      // Strip <think> tags from response
      aiResponse = this.stripThinkTags(aiResponse);
      aiModel = llmResponse.model;

      logger.info({
        lectureId,
        threadId,
        userId,
        responseTime: (Date.now() - startTime) / 1000,
      }, 'Explain follow-up AI response generated');
    } catch (error: any) {
      logger.error({ err: error, lectureId, threadId }, 'Explain follow-up AI response failed');
      throw new AppError(error.message || 'Failed to get AI response', 500);
    }

    // Create follow-up posts (user question + AI response)
    await prisma.lectureExplainPost.createMany({
      data: [
        {
          threadId,
          parentId: parentPostId || null,
          authorType: 'user',
          content: question,
        },
        {
          threadId,
          parentId: parentPostId || null,
          authorType: 'ai',
          content: aiResponse,
          aiModel,
        },
      ],
    });

    // Fetch and return updated thread
    const updatedThread = await prisma.lectureExplainThread.findUnique({
      where: { id: threadId },
      include: {
        posts: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return this.formatThread(updatedThread!);
  }

  /**
   * Format thread data for API response
   */
  private formatThread(thread: {
    id: number;
    question: string;
    createdAt: Date;
    posts: Array<{
      id: number;
      parentId: number | null;
      authorType: string;
      content: string;
      aiModel: string | null;
      createdAt: Date;
    }>;
  }): ExplainThread {
    // Build nested post structure
    const postMap = new Map<number, ExplainPost>();
    const rootPosts: ExplainPost[] = [];

    // First pass: create all posts
    thread.posts.forEach(post => {
      postMap.set(post.id, {
        id: post.id,
        parentId: post.parentId,
        authorType: post.authorType as 'user' | 'ai',
        content: post.content,
        aiModel: post.aiModel,
        createdAt: post.createdAt,
        replies: [],
      });
    });

    // Second pass: build tree
    thread.posts.forEach(post => {
      const formatted = postMap.get(post.id)!;
      if (post.parentId && postMap.has(post.parentId)) {
        postMap.get(post.parentId)!.replies!.push(formatted);
      } else {
        rootPosts.push(formatted);
      }
    });

    return {
      id: thread.id,
      question: thread.question,
      createdAt: thread.createdAt,
      posts: rootPosts,
    };
  }
}

export const lectureAIHelperService = new LectureAIHelperService();
