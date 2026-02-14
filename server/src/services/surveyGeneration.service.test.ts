import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SurveyGenerationService } from './surveyGeneration.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    systemSetting: {
      findUnique: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
    },
    survey: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    surveyQuestion: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock llm service
vi.mock('./llm.service.js', () => ({
  llmService: {
    chat: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import prisma from '../utils/prisma.js';
import { llmService } from './llm.service.js';

// =============================================================================
// TEST DATA
// =============================================================================

const validAIResponse = JSON.stringify({
  title: 'Course Feedback Survey',
  description: 'Help us improve the course',
  questions: [
    {
      questionText: 'How would you rate the overall course quality?',
      questionType: 'single_choice',
      options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
      isRequired: true,
    },
    {
      questionText: 'What topics would you like to see covered in more depth?',
      questionType: 'free_text',
      options: null,
      isRequired: false,
    },
    {
      questionText: 'Which learning resources were most helpful?',
      questionType: 'multiple_choice',
      options: ['Lectures', 'Assignments', 'Readings', 'Discussions'],
      isRequired: true,
    },
  ],
});

const defaultInput = {
  topic: 'End of semester course evaluation',
  questionCount: 5,
  surveyType: 'course_evaluation' as const,
};

function mockLLMResponse(content: string) {
  vi.mocked(llmService.chat).mockResolvedValue({
    choices: [{ message: { role: 'assistant', content } }],
    provider: 'openai',
    model: 'gpt-4o-mini',
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
  } as any);
}

describe('SurveyGenerationService', () => {
  let service: SurveyGenerationService;

  beforeEach(() => {
    service = new SurveyGenerationService();
    vi.clearAllMocks();

    // Default: no custom settings stored
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(null);
  });

  // ===========================================================================
  // generateSurvey
  // ===========================================================================

  describe('generateSurvey', () => {
    it('should generate a survey with valid questions', async () => {
      mockLLMResponse(validAIResponse);

      const result = await service.generateSurvey(defaultInput);

      expect(result.title).toBe('Course Feedback Survey');
      expect(result.description).toBe('Help us improve the course');
      expect(result.questions).toHaveLength(3);
      expect(result.metadata.topic).toBe(defaultInput.topic);
      expect(result.metadata.surveyType).toBe('course_evaluation');
      expect(result.metadata.generatedCount).toBe(3);
      expect(result.metadata.provider).toBe('openai');
      expect(result.metadata.model).toBe('gpt-4o-mini');
    });

    it('should call llmService.chat with correct parameters', async () => {
      mockLLMResponse(validAIResponse);

      await service.generateSurvey(defaultInput);

      expect(llmService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.4,
          maxTokens: 4000,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
        })
      );
    });

    it('should include survey type in the user prompt', async () => {
      mockLLMResponse(validAIResponse);

      await service.generateSurvey(defaultInput);

      const callArgs = vi.mocked(llmService.chat).mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('course evaluation');
      expect(userMessage?.content).toContain(defaultInput.topic);
    });

    it('should include additional instructions in prompt when provided', async () => {
      mockLLMResponse(validAIResponse);

      await service.generateSurvey({
        ...defaultInput,
        additionalInstructions: 'Focus on group work feedback',
      });

      const callArgs = vi.mocked(llmService.chat).mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('Focus on group work feedback');
    });

    it('should clamp questionCount to max of 15', async () => {
      mockLLMResponse(validAIResponse);

      await service.generateSurvey({ ...defaultInput, questionCount: 50 });

      const callArgs = vi.mocked(llmService.chat).mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('Number of questions: 15');
    });

    it('should clamp questionCount to min of 1', async () => {
      mockLLMResponse(validAIResponse);

      await service.generateSurvey({ ...defaultInput, questionCount: -5 });

      const callArgs = vi.mocked(llmService.chat).mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('Number of questions: 1');
    });

    it('should use custom system prompt from database when available', async () => {
      vi.mocked(prisma.systemSetting.findUnique).mockImplementation(async (args: any) => {
        if (args.where.settingKey === 'survey_generation_system_prompt') {
          return { settingKey: 'survey_generation_system_prompt', settingValue: 'Custom prompt' } as any;
        }
        return null;
      });
      mockLLMResponse(validAIResponse);

      await service.generateSurvey(defaultInput);

      const callArgs = vi.mocked(llmService.chat).mock.calls[0][0];
      const systemMessage = callArgs.messages.find((m: any) => m.role === 'system');
      expect(systemMessage?.content).toContain('Custom prompt');
    });

    it('should throw AppError when AI returns empty response', async () => {
      vi.mocked(llmService.chat).mockResolvedValue({
        choices: [{ message: { role: 'assistant', content: '' } }],
        provider: 'openai',
        model: 'gpt-4o-mini',
      } as any);

      await expect(service.generateSurvey(defaultInput)).rejects.toThrow(AppError);
      await expect(service.generateSurvey(defaultInput)).rejects.toThrow('Empty response from AI');
    });

    it('should throw AppError when AI returns null content', async () => {
      vi.mocked(llmService.chat).mockResolvedValue({
        choices: [{ message: { role: 'assistant', content: null } }],
        provider: 'openai',
        model: 'gpt-4o-mini',
      } as any);

      await expect(service.generateSurvey(defaultInput)).rejects.toThrow('Empty response from AI');
    });

    it('should throw AppError when LLM service fails', async () => {
      vi.mocked(llmService.chat).mockRejectedValue(new Error('Provider unavailable'));

      await expect(service.generateSurvey(defaultInput)).rejects.toThrow(AppError);
      await expect(service.generateSurvey(defaultInput)).rejects.toThrow('Failed to generate survey');
    });

    it('should re-throw AppError as-is', async () => {
      vi.mocked(llmService.chat).mockRejectedValue(new AppError('Rate limited', 429));

      await expect(service.generateSurvey(defaultInput)).rejects.toThrow('Rate limited');
    });

    it('should fallback to topic as title when AI returns no title', async () => {
      mockLLMResponse(JSON.stringify({
        questions: [{
          questionText: 'Rate the course',
          questionType: 'single_choice',
          options: ['Good', 'Bad'],
          isRequired: true,
        }],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.title).toBe(defaultInput.topic);
      expect(result.description).toBe('');
    });
  });

  // ===========================================================================
  // parseAIResponse (tested through generateSurvey)
  // ===========================================================================

  describe('parsing AI responses', () => {
    it('should handle response wrapped in markdown code block', async () => {
      mockLLMResponse('```json\n' + validAIResponse + '\n```');

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions).toHaveLength(3);
    });

    it('should handle response with <think> tags', async () => {
      mockLLMResponse('<think>Let me think about this...</think>' + validAIResponse);

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions).toHaveLength(3);
    });

    it('should handle response with unclosed <think> tag', async () => {
      mockLLMResponse('<think>thinking...\n' + validAIResponse);

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions).toHaveLength(3);
    });

    it('should handle response with surrounding text', async () => {
      mockLLMResponse('Here is the survey:\n' + validAIResponse + '\nHope this helps!');

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions).toHaveLength(3);
    });

    it('should throw AppError when response is not valid JSON', async () => {
      mockLLMResponse('This is not JSON at all');

      await expect(service.generateSurvey(defaultInput)).rejects.toThrow('Failed to parse AI response as JSON');
    });

    it('should handle response with no questions array', async () => {
      mockLLMResponse(JSON.stringify({ title: 'Test', description: 'test' }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions).toHaveLength(0);
    });
  });

  // ===========================================================================
  // validateGeneratedQuestions (tested through generateSurvey)
  // ===========================================================================

  describe('question validation', () => {
    it('should skip questions without questionText', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionType: 'free_text', options: null, isRequired: true },
          { questionText: 'Valid question?', questionType: 'free_text', options: null, isRequired: true },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].questionText).toBe('Valid question?');
    });

    it('should skip choice questions with no options', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 'No options?', questionType: 'single_choice', options: [], isRequired: true },
          { questionText: 'Has options?', questionType: 'single_choice', options: ['A', 'B'], isRequired: true },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].questionText).toBe('Has options?');
    });

    it('should skip choice questions with fewer than 2 valid options', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 'One option?', questionType: 'single_choice', options: ['Only one', ''], isRequired: true },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions).toHaveLength(0);
    });

    it('should allow free_text questions with null options', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 'Share your thoughts', questionType: 'free_text', options: null, isRequired: false },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].options).toBeNull();
      expect(result.questions[0].isRequired).toBe(false);
    });

    it('should normalize "text" questionType to "free_text"', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 'Feedback?', questionType: 'text', options: null, isRequired: true },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions[0].questionType).toBe('free_text');
    });

    it('should normalize "open_ended" questionType to "free_text"', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 'Comments?', questionType: 'open_ended', options: null, isRequired: true },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions[0].questionType).toBe('free_text');
    });

    it('should normalize "freetext" questionType to "free_text"', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 'Thoughts?', questionType: 'freetext', options: null, isRequired: true },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions[0].questionType).toBe('free_text');
    });

    it('should normalize "radio" questionType to "single_choice"', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 'Rate?', questionType: 'radio', options: ['Good', 'Bad'], isRequired: true },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions[0].questionType).toBe('single_choice');
    });

    it('should normalize "likert" questionType to "single_choice"', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 'Agree?', questionType: 'likert', options: ['Agree', 'Disagree'], isRequired: true },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions[0].questionType).toBe('single_choice');
    });

    it('should normalize "checkbox" questionType to "multiple_choice"', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 'Select all?', questionType: 'checkbox', options: ['A', 'B', 'C'], isRequired: true },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions[0].questionType).toBe('multiple_choice');
    });

    it('should default unknown questionType to "single_choice"', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 'Unknown?', questionType: 'matrix_rating', options: ['A', 'B'], isRequired: true },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions[0].questionType).toBe('single_choice');
    });

    it('should default isRequired to true when not specified', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 'Test?', questionType: 'free_text', options: null },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions[0].isRequired).toBe(true);
    });

    it('should trim question text and options', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: '  Padded question?  ', questionType: 'single_choice', options: ['  A  ', '  B  '], isRequired: true },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions[0].questionText).toBe('Padded question?');
      expect(result.questions[0].options).toEqual(['A', 'B']);
    });

    it('should handle non-array questions gracefully', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: 'not an array',
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions).toHaveLength(0);
    });

    it('should handle non-string questionText gracefully', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 123, questionType: 'free_text', options: null },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions).toHaveLength(0);
    });

    it('should convert non-string options to strings', async () => {
      mockLLMResponse(JSON.stringify({
        title: 'Test',
        questions: [
          { questionText: 'Rate 1-5?', questionType: 'single_choice', options: [1, 2, 3, 4, 5], isRequired: true },
        ],
      }));

      const result = await service.generateSurvey(defaultInput);

      expect(result.questions[0].options).toEqual(['1', '2', '3', '4', '5']);
    });
  });

  // ===========================================================================
  // generateAndCreateSurvey
  // ===========================================================================

  describe('generateAndCreateSurvey', () => {
    const mockCreatedSurvey = {
      id: 1,
      title: 'Course Feedback Survey',
      description: 'Help us improve the course',
      courseId: 10,
      createdById: 1,
      isPublished: false,
      isAnonymous: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      questions: [
        {
          id: 1,
          surveyId: 1,
          questionText: 'How would you rate the overall course quality?',
          questionType: 'single_choice',
          options: JSON.stringify(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']),
          isRequired: true,
          orderIndex: 0,
          createdAt: new Date(),
        },
      ],
      _count: { questions: 1, responses: 0 },
    };

    beforeEach(() => {
      mockLLMResponse(validAIResponse);
    });

    it('should create survey and questions in a transaction', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 10,
        instructorId: 1,
      } as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          survey: {
            create: vi.fn().mockResolvedValue({ id: 1 }),
            findUnique: vi.fn().mockResolvedValue(mockCreatedSurvey),
          },
          surveyQuestion: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const result = await service.generateAndCreateSurvey(1, {
        ...defaultInput,
        courseId: 10,
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should create survey as unpublished draft', async () => {
      let surveyCreateData: any;

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          survey: {
            create: vi.fn().mockImplementation((args: any) => {
              surveyCreateData = args.data;
              return { id: 1 };
            }),
            findUnique: vi.fn().mockResolvedValue(mockCreatedSurvey),
          },
          surveyQuestion: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      await service.generateAndCreateSurvey(1, defaultInput);

      expect(surveyCreateData.isPublished).toBe(false);
    });

    it('should set isAnonymous when provided', async () => {
      let surveyCreateData: any;

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          survey: {
            create: vi.fn().mockImplementation((args: any) => {
              surveyCreateData = args.data;
              return { id: 1 };
            }),
            findUnique: vi.fn().mockResolvedValue({ ...mockCreatedSurvey, isAnonymous: true }),
          },
          surveyQuestion: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      await service.generateAndCreateSurvey(1, { ...defaultInput, isAnonymous: true });

      expect(surveyCreateData.isAnonymous).toBe(true);
    });

    it('should parse question options in the response', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          survey: {
            create: vi.fn().mockResolvedValue({ id: 1 }),
            findUnique: vi.fn().mockResolvedValue(mockCreatedSurvey),
          },
          surveyQuestion: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const result = await service.generateAndCreateSurvey(1, defaultInput);

      // Options should be parsed from JSON string
      expect(result!.questions[0].options).toEqual(
        ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']
      );
    });

    it('should verify course ownership when courseId is provided', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 10,
        instructorId: 1,
      } as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          survey: {
            create: vi.fn().mockResolvedValue({ id: 1 }),
            findUnique: vi.fn().mockResolvedValue(mockCreatedSurvey),
          },
          surveyQuestion: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      await service.generateAndCreateSurvey(1, { ...defaultInput, courseId: 10 });

      expect(prisma.course.findUnique).toHaveBeenCalledWith({ where: { id: 10 } });
    });

    it('should throw 404 when course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(
        service.generateAndCreateSurvey(1, { ...defaultInput, courseId: 999 })
      ).rejects.toThrow('Course not found');
    });

    it('should throw 403 when user is not course instructor', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 10,
        instructorId: 99, // Different user
      } as any);

      await expect(
        service.generateAndCreateSurvey(1, { ...defaultInput, courseId: 10 })
      ).rejects.toThrow('Not authorized to create survey for this course');
    });

    it('should allow admin to create survey for any course', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 10,
        instructorId: 99,
      } as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          survey: {
            create: vi.fn().mockResolvedValue({ id: 1 }),
            findUnique: vi.fn().mockResolvedValue(mockCreatedSurvey),
          },
          surveyQuestion: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      // Should not throw with isAdmin=true
      const result = await service.generateAndCreateSurvey(1, { ...defaultInput, courseId: 10 }, true);

      expect(result).toBeDefined();
    });

    it('should skip course check when no courseId is provided', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          survey: {
            create: vi.fn().mockResolvedValue({ id: 1 }),
            findUnique: vi.fn().mockResolvedValue({
              ...mockCreatedSurvey,
              courseId: null,
            }),
          },
          surveyQuestion: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      await service.generateAndCreateSurvey(1, defaultInput);

      expect(prisma.course.findUnique).not.toHaveBeenCalled();
    });

    it('should create questions with correct orderIndex', async () => {
      const questionCreateCalls: any[] = [];

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          survey: {
            create: vi.fn().mockResolvedValue({ id: 1 }),
            findUnique: vi.fn().mockResolvedValue(mockCreatedSurvey),
          },
          surveyQuestion: {
            create: vi.fn().mockImplementation((args: any) => {
              questionCreateCalls.push(args.data);
              return {};
            }),
          },
        };
        return fn(tx);
      });

      await service.generateAndCreateSurvey(1, defaultInput);

      // 3 questions from validAIResponse
      expect(questionCreateCalls).toHaveLength(3);
      expect(questionCreateCalls[0].orderIndex).toBe(0);
      expect(questionCreateCalls[1].orderIndex).toBe(1);
      expect(questionCreateCalls[2].orderIndex).toBe(2);
    });

    it('should stringify options when creating questions', async () => {
      const questionCreateCalls: any[] = [];

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          survey: {
            create: vi.fn().mockResolvedValue({ id: 1 }),
            findUnique: vi.fn().mockResolvedValue(mockCreatedSurvey),
          },
          surveyQuestion: {
            create: vi.fn().mockImplementation((args: any) => {
              questionCreateCalls.push(args.data);
              return {};
            }),
          },
        };
        return fn(tx);
      });

      await service.generateAndCreateSurvey(1, defaultInput);

      // First question (single_choice) should have stringified options
      expect(typeof questionCreateCalls[0].options).toBe('string');
      expect(JSON.parse(questionCreateCalls[0].options)).toEqual(
        ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']
      );

      // Second question (free_text) should have null options
      expect(questionCreateCalls[1].options).toBeNull();
    });

    it('should handle null result from transaction', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          survey: {
            create: vi.fn().mockResolvedValue({ id: 1 }),
            findUnique: vi.fn().mockResolvedValue(null),
          },
          surveyQuestion: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const result = await service.generateAndCreateSurvey(1, defaultInput);

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // Survey type prompts
  // ===========================================================================

  describe('survey types', () => {
    beforeEach(() => {
      mockLLMResponse(validAIResponse);
    });

    it.each([
      'general_feedback',
      'course_evaluation',
      'likert_scale',
      'learning_strategies',
      'custom',
    ] as const)('should include survey type "%s" in prompt', async (surveyType) => {
      await service.generateSurvey({ ...defaultInput, surveyType });

      const callArgs = vi.mocked(llmService.chat).mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain(surveyType.replace('_', ' '));
    });
  });
});
