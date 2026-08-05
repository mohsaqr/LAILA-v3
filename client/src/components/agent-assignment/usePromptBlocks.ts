/**
 * Shared resolution of prompt-block ids to prompt-block objects.
 *
 * A selected block is persisted as an id only (`selectedPromptBlocks` is a
 * JSON array of strings). Ids come from two catalogues: the static one in
 * `config/promptBlocks.ts`, and the admin-editable rows in the database, whose
 * ids are prefixed `db_` so the two namespaces cannot collide.
 *
 * This lives in one place because AgentAdvancedTab used to keep its own Map,
 * filled only by clicks made in the current session. A config loaded from the
 * server therefore resolved to nothing, and editing the block list rebuilt the
 * system prompt from an empty set — silently discarding it — while the preview
 * in SelectedBlocksList (which did resolve against the real catalogue) went on
 * showing the prompt the student expected.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PromptBlock, PromptBlockCategory } from '../../types';
import { promptBlocksApi } from '../../api/promptBlocks';
import { PROMPT_BLOCKS, getCategoryInfo } from '../../config/promptBlocks';

const DEFAULT_CATEGORIES: PromptBlockCategory[] = [
  'persona',
  'tone',
  'behavior',
  'constraint',
  'format',
  'knowledge',
];

/**
 * Build the system prompt from an *ordered* list of blocks.
 *
 * Order within a category follows the caller's order; the categories
 * themselves are emitted in a fixed pedagogical order (who the agent is, then
 * how it sounds, then what it does, then what it must not do).
 */
export function generatePromptFromBlocks(blocks: PromptBlock[]): string {
  if (blocks.length === 0) return '';

  const grouped: Record<string, PromptBlock[]> = {};
  blocks.forEach((block) => {
    (grouped[block.category] ||= []).push(block);
  });

  const sections: string[] = [];

  if (grouped.persona?.length) {
    sections.push(grouped.persona.map((b) => b.promptText).join(' '));
  }
  if (grouped.tone?.length) {
    sections.push(grouped.tone.map((b) => b.promptText).join(' '));
  }
  if (grouped.behavior?.length) {
    sections.push(`\nWhen helping students:\n${grouped.behavior.map((b) => `- ${b.promptText}`).join('\n')}`);
  }
  if (grouped.constraint?.length) {
    sections.push(`\nImportant guidelines:\n${grouped.constraint.map((b) => `- ${b.promptText}`).join('\n')}`);
  }
  if (grouped.format?.length) {
    sections.push(`\nResponse formatting:\n${grouped.format.map((b) => `- ${b.promptText}`).join('\n')}`);
  }
  if (grouped.knowledge?.length) {
    sections.push(`\nKnowledge guidelines:\n${grouped.knowledge.map((b) => `- ${b.promptText}`).join('\n')}`);
  }

  return sections.join('\n\n').trim();
}

export interface PromptBlockLookup {
  /** id -> block, across both the static and database catalogues. */
  blocks: Map<string, PromptBlock>;
  /** category slug -> display name. */
  categories: Map<string, { name: string }>;
  /** Resolve ids to blocks, preserving order and dropping unknown ids. */
  resolve: (blockIds: string[]) => PromptBlock[];
  isLoading: boolean;
}

export const usePromptBlockLookup = (): PromptBlockLookup => {
  // Same query key and staleTime as every other consumer, so TanStack serves
  // all of them from one request.
  const { data, isLoading } = useQuery({
    queryKey: ['promptBlocks'],
    queryFn: promptBlocksApi.getBlocksWithCategories,
    staleTime: 5 * 60 * 1000,
  });

  const blocks = useMemo(() => {
    const lookup = new Map<string, PromptBlock>();
    PROMPT_BLOCKS.forEach((block) => lookup.set(block.id, block));
    data?.blocks?.forEach((apiBlock) => {
      lookup.set(`db_${apiBlock.id}`, {
        id: `db_${apiBlock.id}`,
        category: apiBlock.category as PromptBlockCategory,
        label: apiBlock.label,
        promptText: apiBlock.promptText,
        description: apiBlock.description || '',
        popular: apiBlock.popular,
      });
    });
    return lookup;
  }, [data]);

  const categories = useMemo(() => {
    const lookup = new Map<string, { name: string }>();
    DEFAULT_CATEGORIES.forEach((cat) => {
      const info = getCategoryInfo(cat);
      if (info) lookup.set(cat, info);
    });
    data?.categories?.forEach((cat) => lookup.set(cat.slug, { name: cat.name }));
    return lookup;
  }, [data]);

  const resolve = useMemo(
    () => (blockIds: string[]) =>
      blockIds
        .map((id) => blocks.get(id))
        .filter((block): block is PromptBlock => !!block),
    [blocks]
  );

  return { blocks, categories, resolve, isLoading };
};
