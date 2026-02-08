import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Code,
  FileText,
  ChevronRight,
  ChevronDown as ChevronDownIcon,
} from 'lucide-react';
import { CodeBlock, UpdateCodeBlockData } from '../../types';
import { TextArea } from '../common/Input';

interface CodeBlockEditorProps {
  block: CodeBlock;
  index: number;
  totalBlocks: number;
  onUpdate: (blockId: number, data: UpdateCodeBlockData) => void;
  onDelete: (blockId: number) => void;
  onMoveUp: (blockId: number) => void;
  onMoveDown: (blockId: number) => void;
}

export const CodeBlockEditor = ({
  block,
  index,
  totalBlocks,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: CodeBlockEditorProps) => {
  const { t } = useTranslation(['teaching']);
  const [isExpanded, setIsExpanded] = useState(true);
  const [localTitle, setLocalTitle] = useState(block.title);
  const [localInstructions, setLocalInstructions] = useState(block.instructions || '');
  const [localStarterCode, setLocalStarterCode] = useState(block.starterCode || '');

  // Update local state when block changes
  useEffect(() => {
    setLocalTitle(block.title);
    setLocalInstructions(block.instructions || '');
    setLocalStarterCode(block.starterCode || '');
  }, [block]);

  // Debounced save on blur
  const handleTitleBlur = () => {
    if (localTitle !== block.title) {
      onUpdate(block.id, { title: localTitle });
    }
  };

  const handleInstructionsBlur = () => {
    if (localInstructions !== (block.instructions || '')) {
      onUpdate(block.id, { instructions: localInstructions });
    }
  };

  const handleStarterCodeBlur = () => {
    if (localStarterCode !== (block.starterCode || '')) {
      onUpdate(block.id, { starterCode: localStarterCode });
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Block Header */}
      <div className="flex items-center gap-3 p-3 bg-emerald-50 border-b border-emerald-100">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded hover:bg-emerald-100 transition-colors"
        >
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4 text-emerald-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-emerald-600" />
          )}
        </button>

        <div className="flex items-center justify-center w-6 h-6 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={localTitle}
            onChange={e => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="w-full bg-transparent border-none p-0 text-sm font-medium text-gray-900 focus:outline-none focus:ring-0"
            placeholder={t('block_title_placeholder')}
          />
        </div>

        {/* Reorder buttons */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onMoveUp(block.id)}
            disabled={index === 0}
            className="p-1 rounded hover:bg-emerald-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={t('move_up')}
          >
            <ChevronUp className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => onMoveDown(block.id)}
            disabled={index === totalBlocks - 1}
            className="p-1 rounded hover:bg-emerald-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={t('move_down')}
          >
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Delete button */}
        <button
          onClick={() => onDelete(block.id)}
          className="p-1.5 rounded hover:bg-red-100 transition-colors"
          title={t('delete_block')}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>

      {/* Block Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Instructions */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 text-gray-400" />
              {t('instructions')}
            </label>
            <TextArea
              value={localInstructions}
              onChange={e => setLocalInstructions(e.target.value)}
              onBlur={handleInstructionsBlur}
              placeholder={t('instructions_placeholder')}
              rows={3}
              className="text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              {t('supports_markdown')}
            </p>
          </div>

          {/* Starter Code */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Code className="w-4 h-4 text-gray-400" />
              {t('starter_code')}
            </label>
            <textarea
              value={localStarterCode}
              onChange={e => setLocalStarterCode(e.target.value)}
              onBlur={handleStarterCodeBlur}
              placeholder={t('starter_code_placeholder')}
              rows={8}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
              spellCheck={false}
            />
            <p className="text-xs text-gray-400 mt-1">
              {t('starter_code_help')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
