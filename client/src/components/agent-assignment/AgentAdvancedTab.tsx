/**
 * Agent Advanced Tab Component
 *
 * Third tab of the enhanced agent builder containing:
 * - Prompt building blocks selector
 * - System prompt with guided templates
 * - Temperature control with educational labels
 * - Knowledge context field
 * - Tips panel
 */

import { useState, useCallback, useRef } from 'react';
import { Settings, Thermometer, BookOpen, Lightbulb, Info, Blocks } from 'lucide-react';
import { TextArea } from '../common/Input';
import { AgentConfigFormData, PromptBlock } from '../../types';
import { SystemPromptField } from './SystemPromptField';
import { PromptBlockSelector } from './PromptBlockSelector';
import { SelectedBlocksList } from './SelectedBlocksList';
import { AgentDesignLogger } from '../../services/agentDesignLogger';

interface AgentAdvancedTabProps {
  formData: AgentConfigFormData;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: <K extends keyof AgentConfigFormData>(
    field: K,
    value: AgentConfigFormData[K]
  ) => void;
  logger?: AgentDesignLogger | null;
}

// Temperature labels for educational context
const TEMPERATURE_LABELS = [
  { value: 0, label: 'Very Focused', description: 'Consistent, predictable responses' },
  { value: 0.3, label: 'Focused', description: 'Mostly consistent with slight variation' },
  { value: 0.5, label: 'Balanced', description: 'Good balance of consistency and creativity' },
  { value: 0.7, label: 'Creative', description: 'More varied and creative responses' },
  { value: 1, label: 'Very Creative', description: 'Highly varied, exploratory responses' },
];

const getTemperatureLabel = (value: number): { label: string; description: string } => {
  if (value <= 0.15) return TEMPERATURE_LABELS[0];
  if (value <= 0.4) return TEMPERATURE_LABELS[1];
  if (value <= 0.6) return TEMPERATURE_LABELS[2];
  if (value <= 0.85) return TEMPERATURE_LABELS[3];
  return TEMPERATURE_LABELS[4];
};

// Generate prompt from block objects directly
function generatePromptFromBlockObjects(blocks: PromptBlock[]): string {
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
    const knowledge = grouped.knowledge.map((b) => `- ${b.promptText}`).join('\n');
    sections.push(`\nKnowledge guidelines:\n${knowledge}`);
  }

  return sections.join('\n\n').trim();
}

export const AgentAdvancedTab = ({
  formData,
  errors,
  disabled = false,
  onChange,
  logger,
}: AgentAdvancedTabProps) => {
  const [showTips, setShowTips] = useState(true);
  const [showBlockSelector, setShowBlockSelector] = useState(true);

  // Store selected blocks with their full data
  const selectedBlocksRef = useRef<Map<string, PromptBlock>>(new Map());

  const temperatureValue = formData.temperature ?? 0.7;
  const tempInfo = getTemperatureLabel(temperatureValue);
  const selectedBlockIds = formData.selectedPromptBlocks || [];

  const handleSystemPromptChange = (value: string) => {
    const previousValue = formData.systemPrompt;
    onChange('systemPrompt', value);
    if (value !== previousValue) {
      logger?.logFieldChange('systemPrompt', previousValue, value);
    }
  };

  const handleTemperatureChange = (value: number) => {
    const previousValue = formData.temperature?.toString() || '0.7';
    onChange('temperature', value);
    logger?.logFieldChange('temperature', previousValue, value.toString());
  };

  const handleKnowledgeContextChange = (value: string) => {
    const previousValue = formData.knowledgeContext || '';
    onChange('knowledgeContext', value);
    if (value !== previousValue) {
      logger?.logFieldChange('knowledgeContext', previousValue, value);
    }
  };

  // Get ordered blocks from the map
  const getOrderedBlocks = (blockIds: string[]): PromptBlock[] => {
    return blockIds
      .map((id) => selectedBlocksRef.current.get(id))
      .filter((block): block is PromptBlock => !!block);
  };

  // Prompt block handlers
  const handleBlockSelect = useCallback(
    (block: PromptBlock) => {
      // Store the full block data
      selectedBlocksRef.current.set(block.id, block);

      const newBlockIds = [...selectedBlockIds, block.id];
      onChange('selectedPromptBlocks', newBlockIds);

      // Update system prompt with generated content from blocks
      const blocks = getOrderedBlocks(newBlockIds);
      const generatedPrompt = generatePromptFromBlockObjects(blocks);
      if (generatedPrompt) {
        onChange('systemPrompt', generatedPrompt);
      }

      logger?.logPromptBlockSelected(block.id, block.category, newBlockIds);
    },
    [selectedBlockIds, onChange, logger]
  );

  const handleBlockRemove = useCallback(
    (blockId: string) => {
      const block = selectedBlocksRef.current.get(blockId);
      selectedBlocksRef.current.delete(blockId);

      const newBlockIds = selectedBlockIds.filter((id) => id !== blockId);
      onChange('selectedPromptBlocks', newBlockIds);

      // Update system prompt
      const blocks = getOrderedBlocks(newBlockIds);
      const generatedPrompt = generatePromptFromBlockObjects(blocks);
      onChange('systemPrompt', generatedPrompt || formData.systemPrompt);

      logger?.logPromptBlockRemoved(blockId, block?.category || '', newBlockIds);
    },
    [selectedBlockIds, onChange, formData.systemPrompt, logger]
  );

  const handleBlocksReorder = useCallback(
    (newBlockIds: string[]) => {
      onChange('selectedPromptBlocks', newBlockIds);

      // Update system prompt with new order
      const blocks = getOrderedBlocks(newBlockIds);
      const generatedPrompt = generatePromptFromBlockObjects(blocks);
      if (generatedPrompt) {
        onChange('systemPrompt', generatedPrompt);
      }

      logger?.logPromptBlocksReordered(newBlockIds);
    },
    [onChange, logger]
  );

  return (
    <div className="space-y-6">
      {/* Prompt Building Blocks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Blocks className="w-4 h-4 text-violet-600" />
            <label className="text-sm font-medium text-gray-700">Prompt Building Blocks</label>
            <span className="text-xs text-gray-500">(Optional)</span>
          </div>
          <button
            type="button"
            onClick={() => setShowBlockSelector(!showBlockSelector)}
            className="text-xs text-violet-600 hover:text-violet-700"
          >
            {showBlockSelector ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Select pre-built prompt elements to quickly build your agent's behavior. Selected blocks will auto-generate your system prompt.
        </p>

        {showBlockSelector && (
          <div className="space-y-4">
            <PromptBlockSelector
              selectedBlockIds={selectedBlockIds}
              onBlockSelect={handleBlockSelect}
              onBlockRemove={handleBlockRemove}
              disabled={disabled}
            />

            {selectedBlockIds.length > 0 && (
              <SelectedBlocksList
                selectedBlockIds={selectedBlockIds}
                onReorder={handleBlocksReorder}
                onRemove={handleBlockRemove}
                disabled={disabled}
              />
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs text-gray-500">or write your own</span>
        </div>
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-violet-600" />
          <label className="text-sm font-medium text-gray-700">System Prompt</label>
        </div>
        <p className="text-sm text-gray-500">
          {selectedBlockIds.length > 0
            ? 'This prompt is auto-generated from your selected blocks. You can customize it further below.'
            : 'The core instructions that define how your agent behaves. This is the most important field.'}
        </p>
        <SystemPromptField
          value={formData.systemPrompt}
          onChange={handleSystemPromptChange}
          error={errors.systemPrompt}
          disabled={disabled}
        />
      </div>

      {/* Temperature Control */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-violet-600" />
          <label className="text-sm font-medium text-gray-700">Response Creativity</label>
        </div>
        <p className="text-sm text-gray-500">
          Controls how creative vs. consistent your agent's responses will be.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">{tempInfo.label}</span>
            <span className="text-sm text-gray-500">{temperatureValue.toFixed(1)}</span>
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperatureValue}
            onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />

          <div className="flex justify-between text-xs text-gray-400">
            <span>Focused</span>
            <span>Creative</span>
          </div>

          <p className="text-xs text-gray-600">{tempInfo.description}</p>
        </div>

        <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            <strong>Tip:</strong> For educational agents, a value around 0.5-0.7 works well.
            Lower values are better for factual/technical content, higher values for creative tasks.
          </p>
        </div>
      </div>

      {/* Knowledge Context */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-violet-600" />
          <label className="text-sm font-medium text-gray-700">Knowledge Context</label>
        </div>
        <p className="text-sm text-gray-500">
          Additional domain knowledge or expertise your agent should have.
        </p>
        <TextArea
          value={formData.knowledgeContext || ''}
          onChange={(e) => handleKnowledgeContextChange(e.target.value)}
          placeholder="E.g., This agent specializes in introductory biology concepts, focusing on cell biology and genetics for first-year students..."
          rows={4}
          disabled={disabled}
        />
        <p className="text-xs text-gray-400">
          Describe the subject area, level of expertise, or specific knowledge your agent should demonstrate.
        </p>
      </div>

      {/* Tips Panel */}
      <div className="border border-amber-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTips(!showTips)}
          className="w-full flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Writing Tips</span>
          </div>
          <span className="text-xs text-amber-600">{showTips ? 'Hide' : 'Show'}</span>
        </button>

        {showTips && (
          <div className="p-4 bg-white space-y-3">
            <div>
              <h4 className="text-sm font-medium text-gray-800">System Prompt Best Practices:</h4>
              <ul className="mt-2 text-sm text-gray-600 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">1.</span>
                  <span>Start by defining who the agent is and their primary purpose</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">2.</span>
                  <span>Be specific about the tone and communication style</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">3.</span>
                  <span>Include examples of how to handle common scenarios</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">4.</span>
                  <span>Define boundaries - what the agent should avoid doing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">5.</span>
                  <span>Test iteratively and refine based on responses</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-800 mb-2">Example Structure:</h4>
              <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap">
{`You are [Role Name], a [brief description].

Your primary goal is to [main objective].

When interacting with users:
- [Communication style point 1]
- [Communication style point 2]
- [Communication style point 3]

You should:
- [Key behavior 1]
- [Key behavior 2]

You should avoid:
- [Limitation 1]
- [Limitation 2]`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
