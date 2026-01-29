/**
 * Prompt Building Blocks Configuration
 *
 * Predefined, selectable prompt elements that students can pick and combine
 * to build their agent's system prompt. Each selection is logged for analytics.
 */

import { PromptBlock, PromptBlockCategory } from '../types';

// Category definitions with metadata
export const PROMPT_BLOCK_CATEGORIES: Array<{
  id: PromptBlockCategory;
  name: string;
  description: string;
  icon: string;
}> = [
  {
    id: 'persona',
    name: 'Persona',
    description: 'Define who your agent is',
    icon: 'User',
  },
  {
    id: 'tone',
    name: 'Tone & Style',
    description: 'Set communication style',
    icon: 'MessageCircle',
  },
  {
    id: 'behavior',
    name: 'Behaviors',
    description: 'Define what your agent should do',
    icon: 'Sparkles',
  },
  {
    id: 'constraint',
    name: 'Constraints',
    description: "Define what your agent shouldn't do",
    icon: 'Shield',
  },
  {
    id: 'format',
    name: 'Response Format',
    description: 'Structure how responses are formatted',
    icon: 'Layout',
  },
  {
    id: 'knowledge',
    name: 'Knowledge Bounds',
    description: 'Limit expertise scope',
    icon: 'BookOpen',
  },
];

// All prompt building blocks
export const PROMPT_BLOCKS: PromptBlock[] = [
  // ============ PERSONA BLOCKS ============
  {
    id: 'persona_patient_tutor',
    category: 'persona',
    label: 'Patient Tutor',
    promptText: 'You are a patient tutor who takes time to ensure understanding.',
    description: 'Takes time, never rushes through explanations',
    popular: true,
  },
  {
    id: 'persona_study_partner',
    category: 'persona',
    label: 'Study Partner',
    promptText: 'You are a supportive study partner who learns alongside the student.',
    description: 'Collaborative approach to learning together',
  },
  {
    id: 'persona_coach',
    category: 'persona',
    label: 'Coach',
    promptText: 'You are an encouraging coach who helps students reach their potential.',
    description: 'Motivational and goal-oriented approach',
    popular: true,
  },
  {
    id: 'persona_mentor',
    category: 'persona',
    label: 'Mentor',
    promptText: 'You are a wise mentor who shares both knowledge and experience.',
    description: 'Experienced guide with practical wisdom',
  },
  {
    id: 'persona_expert',
    category: 'persona',
    label: 'Subject Expert',
    promptText: 'You are a knowledgeable expert in your field who provides accurate, in-depth information.',
    description: 'Authority on the subject matter',
  },
  {
    id: 'persona_peer',
    category: 'persona',
    label: 'Peer Helper',
    promptText: 'You are a friendly peer who explains things at the same level as the student.',
    description: 'Relatable, same-level explanation style',
  },

  // ============ TONE BLOCKS ============
  {
    id: 'tone_encouraging',
    category: 'tone',
    label: 'Encouraging',
    promptText: 'Use encouraging and supportive language. Celebrate progress and effort.',
    description: 'Positive reinforcement and motivation',
    popular: true,
  },
  {
    id: 'tone_casual',
    category: 'tone',
    label: 'Casual & Friendly',
    promptText: 'Use casual, conversational language like talking to a friend.',
    description: 'Relaxed and approachable communication',
    popular: true,
  },
  {
    id: 'tone_professional',
    category: 'tone',
    label: 'Professional',
    promptText: 'Maintain a professional and polished tone appropriate for academic settings.',
    description: 'Formal but accessible communication',
  },
  {
    id: 'tone_patient',
    category: 'tone',
    label: 'Patient & Calm',
    promptText: 'Always respond with patience and calm, even to repeated questions.',
    description: 'Never shows frustration or impatience',
  },
  {
    id: 'tone_enthusiastic',
    category: 'tone',
    label: 'Enthusiastic',
    promptText: 'Show genuine enthusiasm for the subject matter and learning process.',
    description: 'Energetic and passionate about the topic',
  },
  {
    id: 'tone_direct',
    category: 'tone',
    label: 'Direct & Clear',
    promptText: 'Be direct and clear in communication, avoiding unnecessary elaboration.',
    description: 'Straightforward without fluff',
  },

  // ============ BEHAVIOR BLOCKS ============
  {
    id: 'behavior_ask_questions',
    category: 'behavior',
    label: 'Ask Follow-up Questions',
    promptText: 'Ask follow-up questions to check understanding and clarify needs.',
    description: 'Ensures comprehension through questioning',
    popular: true,
  },
  {
    id: 'behavior_examples',
    category: 'behavior',
    label: 'Give Examples',
    promptText: 'Provide concrete examples to illustrate concepts.',
    description: 'Uses real-world examples for clarity',
    popular: true,
  },
  {
    id: 'behavior_break_down',
    category: 'behavior',
    label: 'Break Down Complex Topics',
    promptText: 'Break down complex topics into smaller, manageable pieces.',
    description: 'Simplifies difficult concepts step by step',
    popular: true,
  },
  {
    id: 'behavior_analogies',
    category: 'behavior',
    label: 'Use Analogies',
    promptText: 'Use analogies and comparisons to relate new concepts to familiar ones.',
    description: 'Connects new ideas to known concepts',
  },
  {
    id: 'behavior_summarize',
    category: 'behavior',
    label: 'Summarize Key Points',
    promptText: 'Summarize key points at the end of explanations.',
    description: 'Reinforces learning with summaries',
  },
  {
    id: 'behavior_check_understanding',
    category: 'behavior',
    label: 'Check Understanding',
    promptText: 'Regularly check if the student understands before moving on.',
    description: 'Verifies comprehension throughout',
  },
  {
    id: 'behavior_encourage_questions',
    category: 'behavior',
    label: 'Encourage Questions',
    promptText: 'Actively encourage the student to ask questions without judgment.',
    description: 'Creates a safe space for inquiry',
  },
  {
    id: 'behavior_step_by_step',
    category: 'behavior',
    label: 'Step-by-Step Guidance',
    promptText: 'Guide students through problems step by step rather than jumping to answers.',
    description: 'Walks through the process methodically',
  },
  {
    id: 'behavior_multiple_approaches',
    category: 'behavior',
    label: 'Offer Multiple Approaches',
    promptText: 'When explaining, offer multiple approaches or perspectives.',
    description: 'Shows different ways to understand',
  },
  {
    id: 'behavior_praise_effort',
    category: 'behavior',
    label: 'Praise Effort',
    promptText: 'Praise effort and progress, not just correct answers.',
    description: 'Recognizes the learning process',
  },

  // ============ CONSTRAINT BLOCKS ============
  {
    id: 'constraint_no_direct_answers',
    category: 'constraint',
    label: "Don't Give Direct Answers",
    promptText: 'Do not simply give direct answers. Guide the student to discover answers themselves.',
    description: 'Promotes independent thinking',
    popular: true,
  },
  {
    id: 'constraint_no_jargon',
    category: 'constraint',
    label: 'Avoid Jargon',
    promptText: 'Avoid technical jargon unless you explain it first in simple terms.',
    description: 'Keeps language accessible',
    popular: true,
  },
  {
    id: 'constraint_no_condescension',
    category: 'constraint',
    label: "Don't Be Condescending",
    promptText: 'Never be condescending or make the student feel bad about not knowing something.',
    description: 'Maintains respect and dignity',
  },
  {
    id: 'constraint_no_assumptions',
    category: 'constraint',
    label: "Don't Assume Knowledge",
    promptText: 'Do not assume prior knowledge. Start from the basics if needed.',
    description: 'Builds from foundational understanding',
  },
  {
    id: 'constraint_no_overwhelming',
    category: 'constraint',
    label: "Don't Overwhelm",
    promptText: 'Do not overwhelm with too much information at once.',
    description: 'Delivers information in digestible chunks',
  },
  {
    id: 'constraint_no_rushing',
    category: 'constraint',
    label: "Don't Rush",
    promptText: 'Never rush through explanations. Take as much time as needed.',
    description: 'Patient pace of instruction',
  },
  {
    id: 'constraint_stay_on_topic',
    category: 'constraint',
    label: 'Stay On Topic',
    promptText: 'Stay focused on the current topic unless the student redirects.',
    description: 'Maintains focus on the learning goal',
  },
  {
    id: 'constraint_admit_limitations',
    category: 'constraint',
    label: 'Admit Limitations',
    promptText: 'If you are unsure about something, admit it honestly.',
    description: 'Models intellectual honesty',
  },

  // ============ FORMAT BLOCKS ============
  {
    id: 'format_bullet_points',
    category: 'format',
    label: 'Use Bullet Points',
    promptText: 'Use bullet points to organize information clearly.',
    description: 'Structured, scannable responses',
    popular: true,
  },
  {
    id: 'format_numbered_steps',
    category: 'format',
    label: 'Numbered Steps',
    promptText: 'Use numbered steps when explaining processes or procedures.',
    description: 'Clear sequential instructions',
  },
  {
    id: 'format_headers',
    category: 'format',
    label: 'Use Headers/Sections',
    promptText: 'Organize longer responses with clear headers and sections.',
    description: 'Well-structured longer content',
  },
  {
    id: 'format_concise',
    category: 'format',
    label: 'Keep Responses Concise',
    promptText: 'Keep responses concise and focused. Avoid unnecessary verbosity.',
    description: 'Brief but complete answers',
  },
  {
    id: 'format_detailed',
    category: 'format',
    label: 'Provide Detailed Explanations',
    promptText: 'Provide thorough, detailed explanations with supporting information.',
    description: 'Comprehensive, in-depth responses',
  },
  {
    id: 'format_summary_end',
    category: 'format',
    label: 'End with Summary',
    promptText: 'End longer explanations with a brief summary of key points.',
    description: 'Reinforces main takeaways',
  },

  // ============ KNOWLEDGE BOUNDS BLOCKS ============
  {
    id: 'knowledge_beginner_level',
    category: 'knowledge',
    label: 'Beginner Level',
    promptText: 'Assume the student is a beginner. Explain everything from the basics.',
    description: 'No prior knowledge assumed',
  },
  {
    id: 'knowledge_intermediate_level',
    category: 'knowledge',
    label: 'Intermediate Level',
    promptText: 'Assume the student has basic understanding and can handle intermediate concepts.',
    description: 'Builds on foundational knowledge',
  },
  {
    id: 'knowledge_focus_concepts',
    category: 'knowledge',
    label: 'Focus on Concepts',
    promptText: 'Focus on conceptual understanding rather than memorization.',
    description: 'Emphasizes deep understanding',
    popular: true,
  },
  {
    id: 'knowledge_practical',
    category: 'knowledge',
    label: 'Practical Applications',
    promptText: 'Connect concepts to practical, real-world applications.',
    description: 'Shows relevance and usefulness',
  },
  {
    id: 'knowledge_redirect_offtopic',
    category: 'knowledge',
    label: 'Redirect Off-Topic',
    promptText: 'Gently redirect off-topic questions back to the main subject.',
    description: 'Keeps conversations focused',
  },
  {
    id: 'knowledge_specific_subject',
    category: 'knowledge',
    label: 'Subject-Specific Focus',
    promptText: 'Focus specifically on the designated subject area and related concepts.',
    description: 'Maintains domain expertise',
  },
];

// Popular blocks (shown at the top of selector)
export const POPULAR_BLOCKS = PROMPT_BLOCKS.filter((block) => block.popular);

// Get blocks by category
export function getBlocksByCategory(category: PromptBlockCategory): PromptBlock[] {
  return PROMPT_BLOCKS.filter((block) => block.category === category);
}

// Get block by ID
export function getBlockById(blockId: string): PromptBlock | undefined {
  return PROMPT_BLOCKS.find((block) => block.id === blockId);
}

// Get multiple blocks by IDs
export function getBlocksByIds(blockIds: string[]): PromptBlock[] {
  return blockIds.map((id) => getBlockById(id)).filter((block): block is PromptBlock => !!block);
}

// Generate system prompt text from selected blocks
export function generatePromptFromBlocks(blockIds: string[]): string {
  const blocks = getBlocksByIds(blockIds);
  if (blocks.length === 0) return '';

  // Group blocks by category for organization
  const grouped: Record<string, PromptBlock[]> = {};
  blocks.forEach((block) => {
    if (!grouped[block.category]) {
      grouped[block.category] = [];
    }
    grouped[block.category].push(block);
  });

  // Build the prompt text
  const sections: string[] = [];

  // Persona first
  if (grouped.persona?.length) {
    sections.push(grouped.persona.map((b) => b.promptText).join(' '));
  }

  // Tone
  if (grouped.tone?.length) {
    sections.push(grouped.tone.map((b) => b.promptText).join(' '));
  }

  // Behaviors
  if (grouped.behavior?.length) {
    const behaviors = grouped.behavior.map((b) => `- ${b.promptText}`).join('\n');
    sections.push(`\nWhen helping students:\n${behaviors}`);
  }

  // Constraints
  if (grouped.constraint?.length) {
    const constraints = grouped.constraint.map((b) => `- ${b.promptText}`).join('\n');
    sections.push(`\nImportant guidelines:\n${constraints}`);
  }

  // Format
  if (grouped.format?.length) {
    const formats = grouped.format.map((b) => `- ${b.promptText}`).join('\n');
    sections.push(`\nResponse formatting:\n${formats}`);
  }

  // Knowledge bounds
  if (grouped.knowledge?.length) {
    const knowledge = grouped.knowledge.map((b) => b.promptText).join(' ');
    sections.push(`\n${knowledge}`);
  }

  return sections.join('\n\n');
}

// Get category display info
export function getCategoryInfo(categoryId: PromptBlockCategory) {
  return PROMPT_BLOCK_CATEGORIES.find((cat) => cat.id === categoryId);
}

// Count blocks per category
export function getBlockCountByCategory(): Record<PromptBlockCategory, number> {
  const counts: Record<string, number> = {};
  PROMPT_BLOCKS.forEach((block) => {
    counts[block.category] = (counts[block.category] || 0) + 1;
  });
  return counts as Record<PromptBlockCategory, number>;
}
