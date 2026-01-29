/**
 * Prompt Block Selector Component
 *
 * Allows students to select predefined prompt building blocks
 * organized by category with expand/collapse functionality.
 * Fetches blocks from API with fallback to static config.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  MessageCircle,
  Sparkles,
  Shield,
  Layout,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Check,
  Star,
  Loader2,
} from 'lucide-react';
import { PromptBlock, PromptBlockCategory } from '../../types';
import { promptBlocksApi, PromptBlockFromApi, PromptBlockCategoryFromApi } from '../../api/promptBlocks';
import {
  PROMPT_BLOCK_CATEGORIES,
  POPULAR_BLOCKS,
  getBlocksByCategory,
} from '../../config/promptBlocks';

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  persona: User,
  tone: MessageCircle,
  behavior: Sparkles,
  constraint: Shield,
  format: Layout,
  knowledge: BookOpen,
};

// Convert API block to internal format
const convertApiBlock = (apiBlock: PromptBlockFromApi): PromptBlock => ({
  id: `db_${apiBlock.id}`, // Prefix to distinguish from static blocks
  category: apiBlock.category as PromptBlockCategory,
  label: apiBlock.label,
  promptText: apiBlock.promptText,
  description: apiBlock.description || '',
  popular: apiBlock.popular,
});

// Convert API category to internal format
const convertApiCategory = (apiCategory: PromptBlockCategoryFromApi) => ({
  id: apiCategory.slug as PromptBlockCategory,
  name: apiCategory.name,
  description: apiCategory.description || '',
  icon: apiCategory.icon || 'Sparkles',
});

interface PromptBlockSelectorProps {
  selectedBlockIds: string[];
  onBlockSelect: (block: PromptBlock) => void;
  onBlockRemove: (blockId: string) => void;
  disabled?: boolean;
}

export const PromptBlockSelector = ({
  selectedBlockIds,
  onBlockSelect,
  onBlockRemove,
  disabled = false,
}: PromptBlockSelectorProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<PromptBlockCategory>>(
    new Set()
  );

  // Fetch blocks from API
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['promptBlocks'],
    queryFn: promptBlocksApi.getBlocksWithCategories,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Use API data if available, otherwise fall back to static config
  const hasApiData = apiData && apiData.blocks.length > 0;

  const categories = hasApiData
    ? apiData.categories.map(convertApiCategory)
    : PROMPT_BLOCK_CATEGORIES;

  const allBlocks = hasApiData
    ? apiData.blocks.map(convertApiBlock)
    : [];

  const getBlocksForCategory = (categoryId: PromptBlockCategory): PromptBlock[] => {
    if (hasApiData) {
      return allBlocks.filter(b => b.category === categoryId);
    }
    return getBlocksByCategory(categoryId);
  };

  const popularBlocks = hasApiData
    ? allBlocks.filter(b => b.popular)
    : POPULAR_BLOCKS;

  const toggleCategory = (category: PromptBlockCategory) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleBlockClick = (block: PromptBlock) => {
    if (disabled) return;

    if (selectedBlockIds.includes(block.id)) {
      onBlockRemove(block.id);
    } else {
      onBlockSelect(block);
    }
  };

  const getSelectedCountForCategory = (categoryId: PromptBlockCategory): number => {
    const blocks = getBlocksForCategory(categoryId);
    return blocks.filter((b) => selectedBlockIds.includes(b.id)).length;
  };

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-lg p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-violet-600 mr-2" />
        <span className="text-sm text-gray-500">Loading prompt blocks...</span>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <h3 className="text-sm font-medium text-gray-900">Prompt Building Blocks</h3>
          <span className="text-xs text-gray-500">
            {selectedBlockIds.length} selected
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Select blocks to automatically build your system prompt
        </p>
      </div>

      {/* Popular Blocks */}
      {popularBlocks.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 bg-violet-50/50">
          <div className="flex items-center gap-1.5 mb-2">
            <Star className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium text-gray-700">Popular</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {popularBlocks.map((block) => {
              const isSelected = selectedBlockIds.includes(block.id);
              return (
                <button
                  key={block.id}
                  onClick={() => handleBlockClick(block)}
                  disabled={disabled}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-violet-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-700 hover:border-violet-300 hover:bg-violet-50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={block.description}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  {block.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Accordions */}
      <div className="divide-y divide-gray-100">
        {categories.map((category) => {
          const Icon = CATEGORY_ICONS[category.id] || Sparkles;
          const isExpanded = expandedCategories.has(category.id);
          const selectedCount = getSelectedCountForCategory(category.id);
          const blocks = getBlocksForCategory(category.id);

          return (
            <div key={category.id}>
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{category.name}</span>
                  {selectedCount > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-violet-100 text-violet-700 rounded-full">
                      {selectedCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{blocks.length} blocks</span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Category Blocks */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  <p className="text-xs text-gray-500 mb-2">{category.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {blocks.map((block) => {
                      const isSelected = selectedBlockIds.includes(block.id);
                      return (
                        <button
                          key={block.id}
                          onClick={() => handleBlockClick(block)}
                          disabled={disabled}
                          className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'bg-violet-50 border-violet-300'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? 'bg-violet-600 border-violet-600 text-white'
                                : 'border-gray-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900">{block.label}</div>
                            <p className="text-xs text-gray-500 line-clamp-2">{block.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {selectedBlockIds.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            {selectedBlockIds.length} block{selectedBlockIds.length !== 1 ? 's' : ''} selected.
            These will be combined into your system prompt.
          </p>
        </div>
      )}
    </div>
  );
};
