// =============================================================================
// SURVEY GENERATION SERVICE - AI-Powered Survey Question Generation
// =============================================================================

import prisma from '../utils/prisma.js';
import { llmService } from './llm.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('survey-generation');

// =============================================================================
// TYPES
// =============================================================================

export type SurveyType =
  | 'general_feedback'
  | 'course_evaluation'
  | 'likert_scale'
  | 'learning_strategies'
  | 'custom';

export interface SurveyGenerationInput {
  topic: string;
  questionCount: number;       // 1-15
  surveyType: SurveyType;
  courseId?: number;
  isAnonymous?: boolean;
  additionalInstructions?: string;
}

export interface GeneratedSurveyQuestion {
  questionText: string;
  questionType: 'single_choice' | 'multiple_choice' | 'free_text';
  options: string[] | null;
  isRequired: boolean;
}

export interface SurveyGenerationResult {
  title: string;
  description: string;
  questions: GeneratedSurveyQuestion[];
  metadata: {
    topic: string;
    surveyType: SurveyType;
    requestedCount: number;
    generatedCount: number;
    provider?: string;
    model?: string;
  };
}

// =============================================================================
// DEFAULT PROMPTS
// =============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are an expert pedagogical survey designer for educational settings. Generate high-quality survey questions.

GUIDELINES:
1. Write clear, unambiguous questions that avoid leading or biased language
2. Use appropriate question types: single_choice for one-answer questions, multiple_choice when multiple answers apply, free_text for open-ended feedback
3. For Likert scale questions, use single_choice with a consistent 5-point scale (e.g., Strongly Disagree, Disagree, Neutral, Agree, Strongly Agree)
4. Include a mix of question types unless a specific type is requested
5. Questions should be relevant to the educational context
6. Avoid double-barreled questions (asking two things in one question)
7. Keep questions concise and easy to understand
8. Order questions logically, from general to specific`;

const DEFAULT_FORMAT_INSTRUCTIONS = `OUTPUT FORMAT (JSON):
{
  "title": "Survey title",
  "description": "Brief survey description",
  "questions": [{
    "questionText": "Question text?",
    "questionType": "single_choice",
    "options": ["Option A", "Option B", "Option C"],
    "isRequired": true
  }]
}

IMPORTANT RULES:
- questionType must be one of: "single_choice", "multiple_choice", "free_text"
- For "free_text" questions, options must be null
- For choice questions, options must be a non-empty array of strings
- isRequired should be true for most questions, false for optional ones
- Return ONLY valid JSON, no markdown formatting`;

const SURVEY_TYPE_PROMPTS: Record<SurveyType, string> = {
  general_feedback: `Generate a general feedback survey with a mix of question types. Include questions about overall satisfaction, specific aspects, and open-ended feedback opportunities.`,
  course_evaluation: `Generate a course evaluation survey focused on teaching quality, content relevance, workload appropriateness, engagement level, and areas for improvement. Use mostly Likert scale questions with a few open-ended questions.`,
  likert_scale: `Generate a survey using exclusively single_choice questions with a 5-point Likert scale: "Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree". All questions should measure agreement with statements.`,
  learning_strategies: `Generate a survey about learning strategies, study habits, metacognition, and self-regulation. Include questions about how students approach learning, time management, note-taking, collaboration, and self-assessment.`,
  custom: `Generate a survey based on the additional instructions provided. Follow the user's specific requirements for question types and content.`,
};

const DEFAULT_SETTINGS = {
  maxQuestions: 15,
  temperature: 0.4,
};

// =============================================================================
// SURVEY GENERATION SERVICE CLASS
// =============================================================================

export class SurveyGenerationService {
  // ===========================================================================
  // SETTINGS MANAGEMENT
  // ===========================================================================

  private async getSystemPrompt(): Promise<string> {
    const setting = await prisma.systemSetting.findUnique({
      where: { settingKey: 'survey_generation_system_prompt' },
    });
    return setting?.settingValue || DEFAULT_SYSTEM_PROMPT;
  }

  private async getFormatInstructions(): Promise<string> {
    const setting = await prisma.systemSetting.findUnique({
      where: { settingKey: 'survey_generation_format_instructions' },
    });
    return setting?.settingValue || DEFAULT_FORMAT_INSTRUCTIONS;
  }

  // ===========================================================================
  // SURVEY GENERATION
  // ===========================================================================

  async generateSurvey(input: SurveyGenerationInput): Promise<SurveyGenerationResult> {
    const [systemPrompt, formatInstructions] = await Promise.all([
      this.getSystemPrompt(),
      this.getFormatInstructions(),
    ]);

    const questionCount = Math.min(Math.max(input.questionCount, 1), DEFAULT_SETTINGS.maxQuestions);
    const userPrompt = this.buildGenerationPrompt({
      topic: input.topic,
      questionCount,
      surveyType: input.surveyType,
      additionalInstructions: input.additionalInstructions,
    });

    logger.info({ topic: input.topic, questionCount, surveyType: input.surveyType }, 'Generating survey');

    try {
      const response = await llmService.chat({
        messages: [
          { role: 'system', content: `${systemPrompt}\n\n${formatInstructions}` },
          { role: 'user', content: userPrompt },
        ],
        temperature: DEFAULT_SETTINGS.temperature,
        maxTokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AppError('Empty response from AI', 500);
      }

      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
      const parsedResponse = this.parseAIResponse(contentStr);
      const validatedQuestions = this.validateGeneratedQuestions(parsedResponse.questions);

      logger.info({
        topic: input.topic,
        requested: questionCount,
        generated: validatedQuestions.length,
      }, 'Survey generation complete');

      return {
        title: parsedResponse.title || input.topic,
        description: parsedResponse.description || '',
        questions: validatedQuestions,
        metadata: {
          topic: input.topic,
          surveyType: input.surveyType,
          requestedCount: questionCount,
          generatedCount: validatedQuestions.length,
          provider: response.provider,
          model: response.model,
        },
      };
    } catch (error: any) {
      logger.error({ error: error.message, topic: input.topic }, 'Survey generation failed');
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to generate survey: ${error.message}`, 500);
    }
  }

  async generateAndCreateSurvey(
    userId: number,
    input: SurveyGenerationInput,
    isAdmin = false
  ) {
    // Verify course ownership if courseId provided
    if (input.courseId) {
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
      });

      if (!course) {
        throw new AppError('Course not found', 404);
      }

      if (course.instructorId !== userId && !isAdmin) {
        throw new AppError('Not authorized to create survey for this course', 403);
      }
    }

    const result = await this.generateSurvey(input);

    // Create survey and all questions in a transaction
    const survey = await prisma.$transaction(async (tx) => {
      const newSurvey = await tx.survey.create({
        data: {
          title: result.title,
          description: result.description || null,
          courseId: input.courseId || null,
          createdById: userId,
          isPublished: false,
          isAnonymous: input.isAnonymous ?? false,
        },
      });

      // Create all questions
      for (let i = 0; i < result.questions.length; i++) {
        const q = result.questions[i];
        await tx.surveyQuestion.create({
          data: {
            surveyId: newSurvey.id,
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options ? JSON.stringify(q.options) : null,
            isRequired: q.isRequired,
            orderIndex: i,
          },
        });
      }

      return tx.survey.findUnique({
        where: { id: newSurvey.id },
        include: {
          questions: {
            orderBy: { orderIndex: 'asc' },
          },
          _count: {
            select: { questions: true, responses: true },
          },
        },
      });
    });

    // Parse options from JSON for response
    if (survey && survey.questions) {
      const questionsWithParsedOptions = survey.questions.map(q => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
      }));
      return { ...survey, questions: questionsWithParsedOptions };
    }

    return survey;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private buildGenerationPrompt(params: {
    topic: string;
    questionCount: number;
    surveyType: SurveyType;
    additionalInstructions?: string;
  }): string {
    const typePrompt = SURVEY_TYPE_PROMPTS[params.surveyType];

    let prompt = `Generate a survey about: ${params.topic}

SURVEY TYPE: ${params.surveyType.replace('_', ' ')}
${typePrompt}

PARAMETERS:
- Number of questions: ${params.questionCount}`;

    if (params.additionalInstructions) {
      prompt += `\n\nADDITIONAL INSTRUCTIONS:\n${params.additionalInstructions}`;
    }

    return prompt;
  }

  private parseAIResponse(content: string): { title: string; description: string; questions: any[] } {
    let jsonStr = content;

    // Remove <think>...</think> tags
    jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
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

    logger.debug({ jsonStrLength: jsonStr.length, jsonStrPreview: jsonStr.slice(0, 200) }, 'Attempting to parse JSON');

    try {
      const parsed = JSON.parse(jsonStr);

      return {
        title: parsed.title || '',
        description: parsed.description || '',
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      };
    } catch (e) {
      logger.error({ content: content.slice(0, 1000), jsonStr: jsonStr.slice(0, 500) }, 'Failed to parse AI response');
      throw new AppError('Failed to parse AI response as JSON', 500);
    }
  }

  private validateGeneratedQuestions(questions: any[]): GeneratedSurveyQuestion[] {
    if (!Array.isArray(questions)) {
      return [];
    }

    const validTypes = ['single_choice', 'multiple_choice', 'free_text'];

    return questions
      .map((q, idx) => {
        if (!q.questionText || typeof q.questionText !== 'string') {
          logger.warn({ questionIndex: idx }, 'Skipping question: missing questionText');
          return null;
        }

        // Normalize question type
        let questionType = q.questionType;
        if (!validTypes.includes(questionType)) {
          // Try to map common variations
          if (questionType === 'text' || questionType === 'open_ended' || questionType === 'freetext') {
            questionType = 'free_text';
          } else if (questionType === 'radio' || questionType === 'likert') {
            questionType = 'single_choice';
          } else if (questionType === 'checkbox') {
            questionType = 'multiple_choice';
          } else {
            questionType = 'single_choice'; // Default
          }
        }

        // Validate options based on question type
        let options: string[] | null = null;
        if (questionType !== 'free_text') {
          if (!Array.isArray(q.options) || q.options.length === 0) {
            logger.warn({ questionIndex: idx }, 'Choice question missing options, skipping');
            return null;
          }
          const filtered = q.options.map((o: any) => String(o).trim()).filter(Boolean);
          if (filtered.length < 2) {
            logger.warn({ questionIndex: idx }, 'Choice question has fewer than 2 options, skipping');
            return null;
          }
          options = filtered;
        }

        return {
          questionText: q.questionText.trim(),
          questionType: questionType as GeneratedSurveyQuestion['questionType'],
          options,
          isRequired: q.isRequired !== false, // Default to true
        };
      })
      .filter((q): q is GeneratedSurveyQuestion => q !== null);
  }
}

export const surveyGenerationService = new SurveyGenerationService();
