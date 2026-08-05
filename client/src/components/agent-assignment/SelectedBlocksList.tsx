/**
 * Selected Blocks List Component
 *
 * Displays selected prompt blocks with the ability to reorder
 * and remove them. Shows a preview of the generated prompt.
 */

import { useState, useCallback, useMemo } from 'react';
import { GripVertical, X, Eye, EyeOff, Copy, Check, Loader2 } from 'lucide-react';
import { generatePromptFromBlocks, usePromptBlockLookup } from './usePromptBlocks';

interface SelectedBlocksListProps {
  selectedBlockIds: string[];
  onReorder: (blockIds: string[]) => void;
  onRemove: (blockId: string) => void;
  disabled?: boolean;
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

  const {
    categories: categoryLookup,
    resolve: resolveBlocks,
    isLoading,
  } = usePromptBlockLookup();

  // Ids are all that is persisted; resolve them against the catalogue.
  const blocks = useMemo(() => resolveBlocks(selectedBlockIds), [resolveBlocks, selectedBlockIds]);

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
