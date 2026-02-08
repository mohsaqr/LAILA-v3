import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Bot, X } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { ForumAgentSelector } from './ForumAgentSelector';
import { Button } from '../common/Button';
import type { TutorAgent } from '../../api/forums';

interface ForumReplyInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onAiRequest?: (agent: TutorAgent) => void;
  agents: TutorAgent[];
  placeholder?: string;
  disabled?: boolean;
  isSubmitting?: boolean;
  isAiLoading?: boolean;
  replyingToName?: string;
  onCancelReply?: () => void;
  showAgentSelector?: boolean;
}

export const ForumReplyInput = ({
  value,
  onChange,
  onSubmit,
  onAiRequest,
  agents,
  placeholder,
  disabled = false,
  isSubmitting = false,
  isAiLoading = false,
  replyingToName,
  onCancelReply,
  showAgentSelector = true,
}: ForumReplyInputProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();
  const effectivePlaceholder = placeholder || t('write_your_reply');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [selectedAgent, setSelectedAgent] = useState<TutorAgent | null>(null);
  const [showAgentChips, setShowAgentChips] = useState(false);

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgInput: isDark ? '#374151' : '#ffffff',
    bgHover: isDark ? '#4b5563' : '#f3f4f6',
    border: isDark ? '#4b5563' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    accent: '#0891b2',
  };

  // Filter agents based on mention query
  const filteredAgents = agents.filter(agent =>
    agent.displayName.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    agent.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // Detect @mention while typing
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Check for @mention pattern
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentionDropdown(true);

      // Calculate dropdown position based on @ symbol position
      if (textareaRef.current) {
        // Simple positioning - show below the textarea
        const rect = textareaRef.current.getBoundingClientRect();
        setMentionPosition({
          top: rect.height + 4,
          left: 0,
        });
      }
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
    }

    // Show agent chips if @mention detected anywhere in text
    const hasAtMention = /@\w+/.test(newValue);
    if (hasAtMention && !showAgentChips) {
      setShowAgentChips(true);
    }
  }, [onChange, showAgentChips]);

  // Handle agent selection from dropdown
  const handleMentionSelect = (agent: TutorAgent) => {
    if (!textareaRef.current) return;

    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);

    // Replace @partial with @AgentName
    const newTextBefore = textBeforeCursor.replace(/@\w*$/, `@${agent.displayName} `);
    const newValue = newTextBefore + textAfterCursor;

    onChange(newValue);
    setShowMentionDropdown(false);
    setMentionQuery('');
    setSelectedAgent(agent);
    setShowAgentChips(true);

    // Focus back on textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = newTextBefore.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle agent selection from chips
  const handleAgentChipSelect = (agent: TutorAgent) => {
    setSelectedAgent(agent);
    if (onAiRequest) {
      onAiRequest(agent);
    }
  };

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionDropdown && filteredAgents.length > 0) {
      if (e.key === 'Escape') {
        setShowMentionDropdown(false);
        e.preventDefault();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        handleMentionSelect(filteredAgents[0]);
        e.preventDefault();
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Submit on Enter (without Shift)
      e.preventDefault();
      if (value.trim() && !isSubmitting) {
        onSubmit();
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowMentionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-3">
      {/* Replying to indicator */}
      {replyingToName && (
        <div className="flex items-center gap-2 text-sm" style={{ color: colors.textSecondary }}>
          <span>{t('replying_to')} <strong style={{ color: colors.textPrimary }}>{replyingToName}</strong></span>
          {onCancelReply && (
            <button
              onClick={onCancelReply}
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title={t('cancel_reply')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Textarea with mention dropdown */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={effectivePlaceholder}
          rows={4}
          disabled={disabled || isSubmitting || isAiLoading}
          className="w-full px-3 py-2 rounded-lg resize-none"
          style={{
            backgroundColor: colors.bgInput,
            borderColor: colors.border,
            borderWidth: 1,
            color: colors.textPrimary,
            opacity: (disabled || isAiLoading) ? 0.6 : 1,
          }}
        />

        {/* @mention dropdown */}
        {showMentionDropdown && filteredAgents.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-64 rounded-lg shadow-lg border overflow-hidden"
            style={{
              top: mentionPosition.top,
              left: mentionPosition.left,
              backgroundColor: colors.bg,
              borderColor: colors.border,
            }}
          >
            <div className="px-3 py-2 border-b text-xs font-medium" style={{
              borderColor: colors.border,
              color: colors.textSecondary
            }}>
              <Bot size={12} className="inline mr-1" />
              {t('ai_tutors')}
            </div>
            {filteredAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleMentionSelect(agent)}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                style={{ color: colors.textPrimary }}
              >
                {agent.avatarUrl ? (
                  <img src={agent.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.accent }}
                  >
                    <Bot size={14} className="text-white" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium">{agent.displayName}</div>
                  {agent.description && (
                    <div className="text-xs" style={{ color: colors.textSecondary }}>
                      {agent.description.slice(0, 40)}...
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Agent selector chips (shown when @ detected or Ask AI clicked) */}
      {showAgentSelector && showAgentChips && agents.length > 0 && (
        <ForumAgentSelector
          agents={agents}
          onSelect={handleAgentChipSelect}
          selectedAgent={selectedAgent}
          disabled={isSubmitting || isAiLoading}
          isLoading={isAiLoading}
          compact
        />
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Ask AI toggle button */}
          {showAgentSelector && agents.length > 0 && !showAgentChips && (
            <button
              onClick={() => setShowAgentChips(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: isDark ? 'rgba(8, 145, 178, 0.1)' : 'rgba(8, 145, 178, 0.1)',
                color: colors.accent,
              }}
              disabled={disabled || isAiLoading}
            >
              <Bot size={16} />
              {t('ask_ai')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancelReply && (
            <Button variant="ghost" size="sm" onClick={onCancelReply} disabled={isSubmitting}>
              {t('common:cancel')}
            </Button>
          )}
          <Button
            onClick={onSubmit}
            disabled={!value.trim() || isSubmitting || isAiLoading}
            size="sm"
          >
            <Send size={16} />
            {isSubmitting ? t('posting') : t('post_reply')}
          </Button>
        </div>
      </div>
    </div>
  );
};
