import { describe, it, expect, vi, beforeEach } from 'vitest';

// What actually reaches the model is the only thing that matters here: the bug
// this covers is "the tutor knows nothing about the course", and the fix is a
// block of text in the system prompt. Nothing asserted that before.

vi.mock('../utils/prisma.js', () => ({
  default: {
    lectureSection: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    chatbotConversation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    chatbotConversationMessage: { create: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock('./chat.service.js', () => ({ chatService: { chat: vi.fn() } }));
vi.mock('./courseContext.service.js', () => ({ buildCourseContext: vi.fn() }));
// logActivity is chained with .then().catch() as fire-and-forget, so the mock
// has to return a promise or sendMessage throws on undefined.then.
vi.mock('./activityLog.service.js', () => ({
  activityLogService: { logActivity: vi.fn().mockResolvedValue(undefined) },
}));

import prisma from '../utils/prisma.js';
import { chatService } from './chat.service.js';
import { buildCourseContext } from './courseContext.service.js';
import { chatbotConversationService } from './chatbotConversation.service.js';

const SECTION = {
  id: 5,
  lectureId: 9,
  type: 'chatbot',
  chatbotTitle: 'Helper',
  chatbotSystemPrompt: 'You are a teaching assistant.',
  lecture: {
    id: 9,
    title: 'What is LA?',
    module: {
      id: 3,
      title: 'Foundations',
      course: { id: 1, title: 'Learning Analytics' },
    },
  },
};

/** The system prompt handed to the LLM for the last call. */
const sentPrompt = () => (vi.mocked(chatService.chat).mock.calls[0][0] as any).systemPrompt as string;

describe('chatbotConversationService.sendMessage — course context in the prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(SECTION as any);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1, status: 'active' } as any);
    vi.mocked(prisma.chatbotConversation.findUnique).mockResolvedValue({ id: 77 } as any);
    vi.mocked(prisma.chatbotConversationMessage.create).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prisma.chatbotConversationMessage.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.chatbotConversation.update).mockResolvedValue({ id: 77 } as any);
    vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Sure!', model: 'm', responseTime: 1 } as any);
    vi.mocked(buildCourseContext).mockResolvedValue(
      'Course: Learning Analytics\nTopics covered in this course:\n1. Foundations'
    );
  });

  it('puts the course outline in the system prompt', async () => {
    await chatbotConversationService.sendMessage(5, 42, { message: 'What does this course cover?' });

    expect(buildCourseContext).toHaveBeenCalledWith(1);
    expect(sentPrompt()).toContain('Topics covered in this course:');
    expect(sentPrompt()).toContain('Foundations');
  });

  it('keeps the section persona and the student position alongside it', async () => {
    await chatbotConversationService.sendMessage(5, 42, { message: 'hi' });

    // The outline says what the course covers; these say where the student is.
    expect(sentPrompt()).toContain('You are a teaching assistant.');
    expect(sentPrompt()).toContain('Module: Foundations');
    expect(sentPrompt()).toContain('Lesson: What is LA?');
  });

  it('still names the course when the outline comes back empty', async () => {
    vi.mocked(buildCourseContext).mockResolvedValue('');

    await chatbotConversationService.sendMessage(5, 42, { message: 'hi' });

    // Interpolating '' unguarded dropped the course name entirely — worse than
    // the behaviour this change set out to fix.
    expect(sentPrompt()).toContain('Learning Analytics');
  });

  it('builds the context before storing the user message', async () => {
    // Ordering matters: buildCourseContext is a DB read. If it throws after the
    // write, the message is saved with no reply and the student's retry stores
    // it twice, which then shows up in the history window.
    vi.mocked(buildCourseContext).mockRejectedValue(new Error('db down'));

    await expect(
      chatbotConversationService.sendMessage(5, 42, { message: 'hi' })
    ).rejects.toThrow();

    expect(prisma.chatbotConversationMessage.create).not.toHaveBeenCalled();
  });
});
