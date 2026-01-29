/**
 * Prompt Block Service
 *
 * Handles CRUD operations for customizable prompt building blocks.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Types
export interface CreatePromptBlockInput {
  category: string;
  label: string;
  promptText: string;
  description?: string;
  popular?: boolean;
  orderIndex?: number;
}

export interface UpdatePromptBlockInput {
  category?: string;
  label?: string;
  promptText?: string;
  description?: string;
  popular?: boolean;
  isActive?: boolean;
  orderIndex?: number;
}

export interface CreateCategoryInput {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  orderIndex?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  icon?: string;
  orderIndex?: number;
  isActive?: boolean;
}

// Default categories if none exist
const DEFAULT_CATEGORIES = [
  { slug: 'persona', name: 'Persona', description: 'Define who your agent is', icon: 'User', orderIndex: 0 },
  { slug: 'tone', name: 'Tone & Style', description: 'Set communication style', icon: 'MessageCircle', orderIndex: 1 },
  { slug: 'behavior', name: 'Behaviors', description: 'Define what your agent should do', icon: 'Sparkles', orderIndex: 2 },
  { slug: 'constraint', name: 'Constraints', description: "Define what your agent shouldn't do", icon: 'Shield', orderIndex: 3 },
  { slug: 'format', name: 'Response Format', description: 'Structure how responses are formatted', icon: 'Layout', orderIndex: 4 },
  { slug: 'knowledge', name: 'Knowledge Bounds', description: 'Limit expertise scope', icon: 'BookOpen', orderIndex: 5 },
];

// Default blocks
const DEFAULT_BLOCKS = [
  // Persona blocks
  { category: 'persona', label: 'Patient Tutor', promptText: 'You are a patient tutor who takes time to ensure understanding.', description: 'Takes time, never rushes through explanations', popular: true, orderIndex: 0 },
  { category: 'persona', label: 'Study Partner', promptText: 'You are a supportive study partner who learns alongside the student.', description: 'Collaborative approach to learning together', orderIndex: 1 },
  { category: 'persona', label: 'Coach', promptText: 'You are an encouraging coach who helps students reach their potential.', description: 'Motivational and goal-oriented approach', popular: true, orderIndex: 2 },
  { category: 'persona', label: 'Mentor', promptText: 'You are a wise mentor who shares both knowledge and experience.', description: 'Experienced guide with practical wisdom', orderIndex: 3 },
  { category: 'persona', label: 'Subject Expert', promptText: 'You are a knowledgeable expert in your field who provides accurate, in-depth information.', description: 'Authority on the subject matter', orderIndex: 4 },
  { category: 'persona', label: 'Peer Helper', promptText: 'You are a friendly peer who explains things at the same level as the student.', description: 'Relatable, same-level explanation style', orderIndex: 5 },

  // Tone blocks
  { category: 'tone', label: 'Encouraging', promptText: 'Use encouraging and supportive language. Celebrate progress and effort.', description: 'Positive reinforcement and motivation', popular: true, orderIndex: 0 },
  { category: 'tone', label: 'Professional', promptText: 'Maintain a professional and respectful tone throughout the conversation.', description: 'Formal but approachable', orderIndex: 1 },
  { category: 'tone', label: 'Casual & Friendly', promptText: 'Be casual and friendly, like talking to a friend who happens to know a lot.', description: 'Relaxed, conversational style', orderIndex: 2 },
  { category: 'tone', label: 'Socratic', promptText: 'Use the Socratic method - guide understanding through thoughtful questions rather than direct answers.', description: 'Question-based learning approach', popular: true, orderIndex: 3 },
  { category: 'tone', label: 'Patient & Calm', promptText: 'Always remain patient and calm, even when explaining difficult concepts repeatedly.', description: 'Never shows frustration', orderIndex: 4 },
  { category: 'tone', label: 'Enthusiastic', promptText: 'Show genuine enthusiasm for the subject matter and the student\'s learning journey.', description: 'Passionate about the topic', orderIndex: 5 },

  // Behavior blocks
  { category: 'behavior', label: 'Ask Follow-up Questions', promptText: 'Ask follow-up questions to check understanding and encourage deeper thinking.', description: 'Verify comprehension actively', popular: true, orderIndex: 0 },
  { category: 'behavior', label: 'Provide Examples', promptText: 'Always provide concrete examples to illustrate abstract concepts.', description: 'Make concepts tangible', popular: true, orderIndex: 1 },
  { category: 'behavior', label: 'Break Down Complex Topics', promptText: 'Break down complex topics into smaller, manageable pieces.', description: 'Simplify without oversimplifying', orderIndex: 2 },
  { category: 'behavior', label: 'Connect to Prior Knowledge', promptText: 'Connect new information to concepts the student already knows.', description: 'Build on existing understanding', orderIndex: 3 },
  { category: 'behavior', label: 'Encourage Questions', promptText: 'Actively encourage questions and make it safe to ask anything.', description: 'Create a safe learning environment', orderIndex: 4 },
  { category: 'behavior', label: 'Summarize Key Points', promptText: 'Summarize key points at the end of explanations to reinforce learning.', description: 'Reinforce important concepts', orderIndex: 5 },
  { category: 'behavior', label: 'Use Analogies', promptText: 'Use relatable analogies and metaphors to explain difficult concepts.', description: 'Make abstract concepts concrete', orderIndex: 6 },
  { category: 'behavior', label: 'Scaffold Learning', promptText: 'Provide scaffolded support - give hints and guidance before revealing answers.', description: 'Graduated assistance approach', orderIndex: 7 },

  // Constraint blocks
  { category: 'constraint', label: 'No Direct Answers', promptText: 'Never give direct answers to homework or test questions. Guide the student to discover the answer themselves.', description: 'Promote independent thinking', popular: true, orderIndex: 0 },
  { category: 'constraint', label: 'Stay On Topic', promptText: 'Stay focused on the subject matter. Politely redirect off-topic conversations.', description: 'Maintain focus on learning goals', orderIndex: 1 },
  { category: 'constraint', label: 'No Jargon', promptText: 'Avoid technical jargon unless necessary. When using specialized terms, always explain them.', description: 'Keep language accessible', popular: true, orderIndex: 2 },
  { category: 'constraint', label: 'Age-Appropriate', promptText: 'Keep all content and examples age-appropriate for the target audience.', description: 'Suitable for the audience level', orderIndex: 3 },
  { category: 'constraint', label: 'No Assumptions', promptText: 'Don\'t assume prior knowledge. Start explanations from foundational concepts when needed.', description: 'Explain from basics when needed', orderIndex: 4 },
  { category: 'constraint', label: 'Respect Boundaries', promptText: 'Respect intellectual boundaries - don\'t overwhelm with too much information at once.', description: 'Manageable information chunks', orderIndex: 5 },

  // Format blocks
  { category: 'format', label: 'Use Bullet Points', promptText: 'Use bullet points and numbered lists to organize information clearly.', description: 'Structured, scannable responses', popular: true, orderIndex: 0 },
  { category: 'format', label: 'Step-by-Step', promptText: 'Present processes and procedures as clear, numbered steps.', description: 'Sequential instructions', orderIndex: 1 },
  { category: 'format', label: 'Short Paragraphs', promptText: 'Keep paragraphs short and focused on one idea each.', description: 'Easy to read and digest', orderIndex: 2 },
  { category: 'format', label: 'Include Summaries', promptText: 'Include brief summaries at the end of longer explanations.', description: 'Recap key points', orderIndex: 3 },
  { category: 'format', label: 'Use Headers', promptText: 'Use clear headers and sections to organize longer responses.', description: 'Well-structured content', orderIndex: 4 },
  { category: 'format', label: 'Highlight Key Terms', promptText: 'Highlight or emphasize key terms and important concepts.', description: 'Draw attention to important info', orderIndex: 5 },

  // Knowledge blocks
  { category: 'knowledge', label: 'Admit Limitations', promptText: 'If you don\'t know something or are uncertain, admit it honestly rather than guessing.', description: 'Honest about knowledge limits', popular: true, orderIndex: 0 },
  { category: 'knowledge', label: 'Suggest Resources', promptText: 'When appropriate, suggest additional resources for deeper learning.', description: 'Guide to further learning', orderIndex: 1 },
  { category: 'knowledge', label: 'Stay Current', promptText: 'Acknowledge when information might be outdated and suggest verifying current facts.', description: 'Aware of knowledge currency', orderIndex: 2 },
  { category: 'knowledge', label: 'Multiple Perspectives', promptText: 'Present multiple perspectives on topics where different viewpoints exist.', description: 'Balanced, fair presentation', orderIndex: 3 },
  { category: 'knowledge', label: 'Cite Sources', promptText: 'When making factual claims, indicate where information comes from when possible.', description: 'Support claims with sources', orderIndex: 4 },
  { category: 'knowledge', label: 'Practical Application', promptText: 'Connect theoretical knowledge to practical, real-world applications.', description: 'Show relevance to real life', orderIndex: 5 },
];

export const promptBlockService = {
  // ==================== BLOCKS ====================

  /**
   * Get all active blocks, optionally filtered by category
   */
  async getAllBlocks(category?: string) {
    const where: Prisma.PromptBlockWhereInput = { isActive: true };
    if (category) {
      where.category = category;
    }

    return prisma.promptBlock.findMany({
      where,
      orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }],
    });
  },

  /**
   * Get all blocks including inactive (admin only)
   */
  async getAllBlocksAdmin() {
    return prisma.promptBlock.findMany({
      orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }],
    });
  },

  /**
   * Get a single block by ID
   */
  async getBlockById(id: number) {
    return prisma.promptBlock.findUnique({
      where: { id },
    });
  },

  /**
   * Create a new block
   */
  async createBlock(data: CreatePromptBlockInput, createdById?: number) {
    return prisma.promptBlock.create({
      data: {
        category: data.category,
        label: data.label,
        promptText: data.promptText,
        description: data.description,
        popular: data.popular ?? false,
        orderIndex: data.orderIndex ?? 0,
        createdById,
      },
    });
  },

  /**
   * Update a block
   */
  async updateBlock(id: number, data: UpdatePromptBlockInput) {
    return prisma.promptBlock.update({
      where: { id },
      data,
    });
  },

  /**
   * Soft delete a block (set isActive to false)
   */
  async deleteBlock(id: number) {
    return prisma.promptBlock.update({
      where: { id },
      data: { isActive: false },
    });
  },

  /**
   * Hard delete a block
   */
  async hardDeleteBlock(id: number) {
    return prisma.promptBlock.delete({
      where: { id },
    });
  },

  /**
   * Reorder blocks within a category
   */
  async reorderBlocks(blockIds: number[]) {
    const updates = blockIds.map((id, index) =>
      prisma.promptBlock.update({
        where: { id },
        data: { orderIndex: index },
      })
    );
    return prisma.$transaction(updates);
  },

  // ==================== CATEGORIES ====================

  /**
   * Get all active categories
   */
  async getAllCategories() {
    return prisma.promptBlockCategory.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
    });
  },

  /**
   * Get all categories including inactive (admin only)
   */
  async getAllCategoriesAdmin() {
    return prisma.promptBlockCategory.findMany({
      orderBy: { orderIndex: 'asc' },
    });
  },

  /**
   * Get a category by slug
   */
  async getCategoryBySlug(slug: string) {
    return prisma.promptBlockCategory.findUnique({
      where: { slug },
    });
  },

  /**
   * Create a new category
   */
  async createCategory(data: CreateCategoryInput) {
    return prisma.promptBlockCategory.create({
      data,
    });
  },

  /**
   * Update a category
   */
  async updateCategory(id: number, data: UpdateCategoryInput) {
    return prisma.promptBlockCategory.update({
      where: { id },
      data,
    });
  },

  /**
   * Soft delete a category
   */
  async deleteCategory(id: number) {
    return prisma.promptBlockCategory.update({
      where: { id },
      data: { isActive: false },
    });
  },

  /**
   * Reorder categories
   */
  async reorderCategories(categoryIds: number[]) {
    const updates = categoryIds.map((id, index) =>
      prisma.promptBlockCategory.update({
        where: { id },
        data: { orderIndex: index },
      })
    );
    return prisma.$transaction(updates);
  },

  // ==================== SEEDING ====================

  /**
   * Seed default categories and blocks if none exist
   */
  async seedDefaults() {
    // Check if categories exist
    const categoryCount = await prisma.promptBlockCategory.count();
    if (categoryCount === 0) {
      console.log('Seeding default prompt block categories...');
      await prisma.promptBlockCategory.createMany({
        data: DEFAULT_CATEGORIES,
      });
    }

    // Check if blocks exist
    const blockCount = await prisma.promptBlock.count();
    if (blockCount === 0) {
      console.log('Seeding default prompt blocks...');
      await prisma.promptBlock.createMany({
        data: DEFAULT_BLOCKS,
      });
    }

    return {
      categoriesSeeded: categoryCount === 0,
      blocksSeeded: blockCount === 0,
    };
  },

  /**
   * Get blocks and categories together (for student UI)
   */
  async getBlocksWithCategories() {
    const [categories, blocks] = await Promise.all([
      this.getAllCategories(),
      this.getAllBlocks(),
    ]);

    return { categories, blocks };
  },
};
