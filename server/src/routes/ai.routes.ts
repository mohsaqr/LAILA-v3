import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { llmService } from '../services/llm.service.js';
import { z } from 'zod';

const router = Router();

// Validation schema for interpretation requests
const interpretSchema = z.object({
  prompt: z.string().min(1),
  context: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
});

/**
 * Strip thinking tags from model responses
 * Some models output internal reasoning in <think>...</think> tags
 */
const stripThinkingTags = (content: string): string => {
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
};

/**
 * POST /api/ai/interpret
 * Interpret R output using AI
 */
router.post('/interpret', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { prompt, model, provider } = interpretSchema.parse(req.body);

  try {
    const response = await llmService.chat({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model,
      provider: provider as any,
      temperature: 0.3, // Lower temperature for more consistent interpretations
      maxTokens: 2000,
    });

    // Strip any thinking tags from the response
    const messageContent = response.choices[0]?.message?.content;
    const rawContent = typeof messageContent === 'string' ? messageContent : 'No interpretation available.';
    const content = stripThinkingTags(rawContent);

    res.json({
      success: true,
      data: {
        response: content,
        model: response.model,
        provider: response.provider,
        usage: response.usage,
      },
    });
  } catch (error: any) {
    console.error('AI interpretation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get AI interpretation',
    });
  }
}));

export default router;
