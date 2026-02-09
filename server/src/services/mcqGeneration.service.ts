// =============================================================================
// MCQ GENERATION SERVICE - AI-Powered Quiz Question Generation
// =============================================================================

import prisma from '../utils/prisma.js';
import { llmService } from './llm.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('mcq-generation');

// =============================================================================
// TYPES
// =============================================================================

export interface MCQGenerationInput {
  topic: string;
  content?: string;        // Optional source content
  questionCount: number;   // 1-10
  difficulty?: 'easy' | 'medium' | 'hard';
  optionCount?: number;    // 3-5, default 4
  includeExplanations?: boolean;
  courseContext?: string;
}

export interface GeneratedMCQ {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  difficulty: string;
}

export interface MCQGenerationResult {
  questions: GeneratedMCQ[];
  metadata: {
    topic: string;
    requestedCount: number;
    generatedCount: number;
    difficulty: string;
    provider?: string;
    model?: string;
  };
}

export interface MCQGenerationSettings {
  systemPrompt: string;
  formatInstructions: string;
  defaults: {
    optionCount: number;
    maxQuestions: number;
    defaultDifficulty: string;
    includeExplanations: boolean;
    temperature: number;
  };
}

// =============================================================================
// DEFAULT PROMPTS
// =============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are an expert educational assessment designer. Generate high-quality multiple choice questions (MCQs).

GUIDELINES:
1. Test comprehension and application, not just recall
2. All distractors should be plausible but clearly wrong
3. Avoid "all/none of the above" options
4. Keep questions clear and unambiguous
5. Ensure only one option is definitively correct
6. Match the difficulty level requested
7. For 'easy' questions: test basic understanding and recall
8. For 'medium' questions: test application and comprehension
9. For 'hard' questions: test analysis, synthesis, and evaluation`;

const DEFAULT_FORMAT_INSTRUCTIONS = `OUTPUT FORMAT (JSON):
{
  "questions": [{
    "questionText": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Brief explanation of why this is correct",
    "difficulty": "medium"
  }]
}

IMPORTANT RULES:
- correctAnswer must EXACTLY match one of the options strings
- Each question must have the specified number of options
- All options must be unique and plausible
- Return ONLY valid JSON, no markdown formatting`;

const DEFAULT_MCQ_SETTINGS = {
  optionCount: 4,
  maxQuestions: 10,
  defaultDifficulty: 'medium',
  includeExplanations: true,
  temperature: 0.4,
};

// =============================================================================
// MCQ GENERATION SERVICE CLASS
// =============================================================================

export class MCQGenerationService {
  // ===========================================================================
  // SETTINGS MANAGEMENT
  // ===========================================================================

  async getGenerationSettings(): Promise<MCQGenerationSettings> {
    const [systemPromptSetting, formatSetting, defaultsSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { settingKey: 'mcq_generation_system_prompt' } }),
      prisma.systemSetting.findUnique({ where: { settingKey: 'mcq_generation_format_instructions' } }),
      prisma.systemSetting.findUnique({ where: { settingKey: 'mcq_generation_defaults' } }),
    ]);

    return {
      systemPrompt: systemPromptSetting?.settingValue || DEFAULT_SYSTEM_PROMPT,
      formatInstructions: formatSetting?.settingValue || DEFAULT_FORMAT_INSTRUCTIONS,
      defaults: defaultsSetting?.settingValue
        ? JSON.parse(defaultsSetting.settingValue)
        : DEFAULT_MCQ_SETTINGS,
    };
  }

  async updateGenerationSettings(settings: Partial<MCQGenerationSettings>): Promise<MCQGenerationSettings> {
    const updates: Promise<any>[] = [];

    if (settings.systemPrompt !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { settingKey: 'mcq_generation_system_prompt' },
          create: {
            settingKey: 'mcq_generation_system_prompt',
            settingValue: settings.systemPrompt,
            settingType: 'text',
            description: 'System prompt for MCQ generation AI',
          },
          update: { settingValue: settings.systemPrompt },
        })
      );
    }

    if (settings.formatInstructions !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { settingKey: 'mcq_generation_format_instructions' },
          create: {
            settingKey: 'mcq_generation_format_instructions',
            settingValue: settings.formatInstructions,
            settingType: 'text',
            description: 'Format instructions for MCQ generation AI output',
          },
          update: { settingValue: settings.formatInstructions },
        })
      );
    }

    if (settings.defaults !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { settingKey: 'mcq_generation_defaults' },
          create: {
            settingKey: 'mcq_generation_defaults',
            settingValue: JSON.stringify(settings.defaults),
            settingType: 'json',
            description: 'Default settings for MCQ generation',
          },
          update: { settingValue: JSON.stringify(settings.defaults) },
        })
      );
    }

    await Promise.all(updates);
    return this.getGenerationSettings();
  }

  // ===========================================================================
  // MCQ GENERATION
  // ===========================================================================

  async generateQuestions(input: MCQGenerationInput): Promise<MCQGenerationResult> {
    const settings = await this.getGenerationSettings();

    // Validate and sanitize input
    const questionCount = Math.min(Math.max(input.questionCount, 1), settings.defaults.maxQuestions);
    const optionCount = input.optionCount || settings.defaults.optionCount;
    const difficulty = input.difficulty || settings.defaults.defaultDifficulty;
    const includeExplanations = input.includeExplanations ?? settings.defaults.includeExplanations;

    // Build the prompt
    const userPrompt = this.buildGenerationPrompt({
      topic: input.topic,
      content: input.content,
      questionCount,
      difficulty,
      optionCount,
      includeExplanations,
      courseContext: input.courseContext,
    });

    logger.info({ topic: input.topic, questionCount, difficulty }, 'Generating MCQs');

    try {
      // Call LLM service
      const response = await llmService.chat({
        messages: [
          { role: 'system', content: `${settings.systemPrompt}\n\n${settings.formatInstructions}` },
          { role: 'user', content: userPrompt },
        ],
        temperature: settings.defaults.temperature,
        maxTokens: 4000, // Allow for longer responses with multiple questions
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AppError('Empty response from AI', 500);
      }

      // Parse the JSON response
      const parsedResponse = this.parseAIResponse(content);

      // Validate questions
      const validatedQuestions = this.validateGeneratedQuestions(parsedResponse.questions, optionCount);

      logger.info({
        topic: input.topic,
        requested: questionCount,
        generated: validatedQuestions.length
      }, 'MCQ generation complete');

      return {
        questions: validatedQuestions,
        metadata: {
          topic: input.topic,
          requestedCount: questionCount,
          generatedCount: validatedQuestions.length,
          difficulty,
          provider: response.provider,
          model: response.model,
        },
      };

    } catch (error: any) {
      logger.error({ error: error.message, topic: input.topic }, 'MCQ generation failed');
      throw new AppError(`Failed to generate questions: ${error.message}`, 500);
    }
  }

  /**
   * Generate practice questions for a lecture (student self-study)
   */
  async generatePracticeQuestions(
    lectureId: number,
    userId: number,
    options: { questionCount: number; difficulty?: string }
  ): Promise<GeneratedMCQ[]> {
    // Fetch lecture content
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        module: {
          include: {
            course: {
              select: { id: true, title: true },
            },
          },
        },
        sections: {
          where: { type: { in: ['text', 'ai-generated'] } },
          select: { content: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!lecture) {
      throw new AppError('Lecture not found', 404);
    }

    // Verify user is enrolled in the course
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: lecture.module.courseId,
        },
      },
    });

    if (!enrollment) {
      throw new AppError('You must be enrolled in this course to practice', 403);
    }

    // Combine lecture content
    const lectureContent = [
      lecture.content || '',
      ...lecture.sections.map((s: { content: string | null }) => s.content || ''),
    ].filter(Boolean).join('\n\n');

    if (!lectureContent.trim()) {
      throw new AppError('Lecture has no content to generate questions from', 400);
    }

    // Generate questions using lecture content
    const result = await this.generateQuestions({
      topic: lecture.title,
      content: lectureContent,
      questionCount: Math.min(options.questionCount, 10),
      difficulty: (options.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
      includeExplanations: true,
      courseContext: lecture.module.course.title,
    });

    return result.questions;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private buildGenerationPrompt(params: {
    topic: string;
    content?: string;
    questionCount: number;
    difficulty: string;
    optionCount: number;
    includeExplanations: boolean;
    courseContext?: string;
  }): string {
    let prompt = `Generate ${params.questionCount} multiple choice question${params.questionCount > 1 ? 's' : ''} about: ${params.topic}

PARAMETERS:
- Number of questions: ${params.questionCount}
- Difficulty level: ${params.difficulty}
- Options per question: ${params.optionCount}
- Include explanations: ${params.includeExplanations ? 'yes' : 'no'}`;

    if (params.courseContext) {
      prompt += `\n- Course context: ${params.courseContext}`;
    }

    if (params.content) {
      prompt += `\n\nSOURCE CONTENT TO BASE QUESTIONS ON:
---
${params.content.slice(0, 8000)}
---

Generate questions that test understanding of the key concepts from this content.`;
    }

    return prompt;
  }

  private parseAIResponse(content: string): { questions: any[] } {
    // Try to extract JSON from the response
    let jsonStr = content;

    // Remove <think>...</think> tags (Claude's thinking output)
    // Handle both closed and unclosed think tags
    jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    // Also remove unclosed <think> tags (everything from <think> to the first JSON)
    if (jsonStr.includes('<think>')) {
      const thinkStart = jsonStr.indexOf('<think>');
      const jsonStart = jsonStr.indexOf('{');
      if (jsonStart > thinkStart) {
        jsonStr = jsonStr.substring(jsonStart);
      }
    }

    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    // Log what we're trying to parse for debugging
    logger.debug({ jsonStrLength: jsonStr.length, jsonStrPreview: jsonStr.slice(0, 200) }, 'Attempting to parse JSON');

    try {
      const parsed = JSON.parse(jsonStr);

      // Handle various response formats
      if (Array.isArray(parsed)) {
        return { questions: parsed };
      }
      if (parsed.questions && Array.isArray(parsed.questions)) {
        return parsed;
      }

      throw new Error('Invalid response format');
    } catch (e) {
      logger.error({ content: content.slice(0, 1000), jsonStr: jsonStr.slice(0, 500) }, 'Failed to parse AI response');
      throw new AppError('Failed to parse AI response as JSON', 500);
    }
  }

  validateGeneratedQuestions(questions: any[], expectedOptions: number): GeneratedMCQ[] {
    if (!Array.isArray(questions)) {
      return [];
    }

    return questions
      .map((q, idx) => {
        // Skip invalid questions
        if (!q.questionText || !Array.isArray(q.options) || !q.correctAnswer) {
          logger.warn({ questionIndex: idx }, 'Skipping invalid question');
          return null;
        }

        // Ensure correctAnswer matches one of the options
        const normalizedCorrect = q.correctAnswer.trim();
        const matchingOption = q.options.find(
          (opt: string) => opt.trim().toLowerCase() === normalizedCorrect.toLowerCase()
        );

        if (!matchingOption) {
          logger.warn({
            questionIndex: idx,
            correctAnswer: q.correctAnswer,
            options: q.options
          }, 'Correct answer does not match any option');

          // Check if correctAnswer is a letter reference (A, B, C, D) or "Option X"
          const letterMatch = normalizedCorrect.match(/^(?:option\s*)?([a-d])$/i);
          if (letterMatch) {
            // Convert letter to index (A=0, B=1, C=2, D=3)
            const letterIndex = letterMatch[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
            if (letterIndex >= 0 && letterIndex < q.options.length) {
              // Use the actual option text as the correct answer
              q.correctAnswer = q.options[letterIndex];
              logger.info({ questionIndex: idx, resolvedAnswer: q.correctAnswer }, 'Resolved letter reference to actual option');
            } else {
              // Invalid index, skip this question
              logger.warn({ questionIndex: idx }, 'Could not resolve letter reference, skipping question');
              return null;
            }
          } else {
            // Try to fix by adding the correct answer as an option if we have room
            // But only if it looks like actual content, not a placeholder
            if (!normalizedCorrect.match(/^option\s*[a-d]$/i)) {
              if (q.options.length < expectedOptions) {
                q.options.push(normalizedCorrect);
              } else {
                // Replace the last option with the correct answer
                q.options[q.options.length - 1] = normalizedCorrect;
              }
            } else {
              // It's a placeholder we can't resolve, skip
              logger.warn({ questionIndex: idx }, 'Unresolvable placeholder answer, skipping question');
              return null;
            }
          }
        }

        // Use the potentially resolved correctAnswer from q
        const finalCorrectAnswer = typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : normalizedCorrect;

        return {
          questionText: q.questionText.trim(),
          options: q.options.map((o: string) => o.trim()),
          correctAnswer: finalCorrectAnswer,
          explanation: q.explanation?.trim(),
          difficulty: q.difficulty || 'medium',
        };
      })
      .filter((q): q is GeneratedMCQ => q !== null);
  }
}

export const mcqGenerationService = new MCQGenerationService();
