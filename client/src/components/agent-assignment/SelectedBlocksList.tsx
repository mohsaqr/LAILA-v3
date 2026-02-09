/**
 * Selected Blocks List Component
 *
 * Displays selected prompt blocks with the ability to reorder
 * and remove them. Shows a preview of the generated prompt.
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GripVertical, X, Eye, EyeOff, Copy, Check, Loader2 } from 'lucide-react';
import { PromptBlock, PromptBlockCategory } from '../../types';
import { promptBlocksApi } from '../../api/promptBlocks';
import { PROMPT_BLOCKS, getCategoryInfo } from '../../config/promptBlocks';

interface SelectedBlocksListProps {
  selectedBlockIds: string[];
  onReorder: (blockIds: string[]) => void;
  onRemove: (blockId: string) => void;
  disabled?: boolean;
}

// Generate prompt from block objects
function generatePromptFromBlocks(blocks: PromptBlock[]): string {
  if (blocks.length === 0) return '';

  const grouped: Record<string, PromptBlock[]> = {};
  blocks.forEach((block) => {
    if (!grouped[block.category]) {
      grouped[block.category] = [];
    }
    grouped[block.category].push(block);
  });

  const sections: string[] = [];

  if (grouped.persona?.length) {
    sections.push(grouped.persona.map((b) => b.promptText).join(' '));
  }
  if (grouped.tone?.length) {
    sections.push(grouped.tone.map((b) => b.promptText).join(' '));
  }
  if (grouped.behavior?.length) {
    const behaviors = grouped.behavior.map((b) => `- ${b.promptText}`).join('\n');
    sections.push(`\nWhen helping students:\n${behaviors}`);
  }
  if (grouped.constraint?.length) {
    const constraints = grouped.constraint.map((b) => `- ${b.promptText}`).join('\n');
    sections.push(`\nImportant guidelines:\n${constraints}`);
  }
  if (grouped.format?.length) {
    const formats = grouped.format.map((b) => `- ${b.promptText}`).join('\n');
    sections.push(`\nResponse formatting:\n${formats}`);
  }
  if (grouped.knowledge?.length) {
    const knowledge = grouped.knowledge.map((b) => `- ${b.promptText}`).join('\n');
    sections.push(`\nKnowledge guidelines:\n${knowledge}`);
  }

  return sections.join('\n\n').trim();
}

export const SelectedBlocksList = ({
  selectedBlockIds,
  onReorder,
  onRemove,
  disabled = false,
}: SelectedBlocksListProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [copied, setCopied] = useState(false);

  // Fetch blocks from API
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['promptBlocks'],
    queryFn: promptBlocksApi.getBlocksWithCategories,
    staleTime: 5 * 60 * 1000,
  });

  // Build a lookup map for both API and static blocks
  const blockLookup = useMemo(() => {
    const lookup = new Map<string, PromptBlock>();

    // Add static blocks
    PROMPT_BLOCKS.forEach((block) => {
      lookup.set(block.id, block);
    });

    // Add API blocks (with db_ prefix)
    if (apiData?.blocks) {
      apiData.blocks.forEach((apiBlock) => {
        lookup.set(`db_${apiBlock.id}`, {
          id: `db_${apiBlock.id}`,
          category: apiBlock.category as PromptBlockCategory,
          label: apiBlock.label,
          promptText: apiBlock.promptText,
          description: apiBlock.description || '',
          popular: apiBlock.popular,
        });
      });
    }

    return lookup;
  }, [apiData]);

  // Category lookup
  const categoryLookup = useMemo(() => {
    const lookup = new Map<string, { name: string }>();

    // Add default categories
    ['persona', 'tone', 'behavior', 'constraint', 'format', 'knowledge'].forEach((cat) => {
      const info = getCategoryInfo(cat as PromptBlockCategory);
      if (info) {
        lookup.set(cat, info);
      }
    });

    // Add API categories
    if (apiData?.categories) {
      apiData.categories.forEach((cat) => {
        lookup.set(cat.slug, { name: cat.name });
      });
    }

    return lookup;
  }, [apiData]);

  // Get blocks in order
  const blocks = useMemo(() => {
    return selectedBlockIds
      .map((id) => blockLookup.get(id))
      .filter((block): block is PromptBlock => !!block);
  }, [selectedBlockIds, blockLookup]);

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newBlockIds = [...selectedBlockIds];
    const [draggedId] = newBlockIds.splice(draggedIndex, 1);
    newBlockIds.splice(index, 0, draggedId);
    onReorder(newBlockIds);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const generatedPrompt = generatePromptFromBlocks(blocks);

  const handleCopy = useCallback(async () => {
    if (!generatedPrompt) return;
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [generatedPrompt]);

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-violet-600 mr-2" />
        <span className="text-sm text-gray-500">Loading blocks...</span>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-500">
          No blocks selected. Choose blocks from above to build your prompt.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selected Blocks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">Selected Blocks</h4>
          <span className="text-xs text-gray-500">Drag to reorder</span>
        </div>
        <div className="space-y-1">
          {blocks.map((block, index) => {
            const categoryInfo = categoryLookup.get(block.category);
            return (
              <div
                key={block.id}
                draggable={!disabled}
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 p-2 bg-white border rounded-lg ${
                  draggedIndex === index ? 'opacity-50 border-violet-400' : 'border-gray-200'
                } ${disabled ? '' : 'cursor-move hover:border-gray-300'}`}
              >
                {!disabled && (
                  <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{block.label}</span>
                    <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">
                      {categoryInfo?.name || block.category}
                    </span>
                  </div>
                </div>
                {!disabled && (
                  <button
                    onClick={() => onRemove(block.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove block"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Generated Prompt Preview */}
      <div className="border border-violet-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="w-full flex items-center justify-between px-4 py-2 bg-violet-50 hover:bg-violet-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            {showPreview ? (
              <Eye className="w-4 h-4 text-violet-600" />
            ) : (
              <EyeOff className="w-4 h-4 text-violet-600" />
            )}
            <span className="text-sm font-medium text-violet-900">Generated Prompt Preview</span>
          </div>
          <span className="text-xs text-violet-600">
            {showPreview ? 'Hide' : 'Show'}
          </span>
        </button>

        {showPreview && (
          <div className="p-4 bg-white">
            <div className="relative">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">
                {generatedPrompt}
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This prompt is auto-generated from your selected blocks. You can customize it further in the system prompt field below.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
