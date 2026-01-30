import { useState, useEffect, useCallback } from 'react';
import { emotionalPulseApi } from '../../api/emotionalPulse';
import { useTheme } from '../../hooks/useTheme';
import type { EmotionType, EmotionalPulseContext } from '../../types';

const DEFAULT_EMOTIONS: EmotionType[] = [
  'productive',
  'stimulated',
  'frustrated',
  'learning',
  'enjoying',
  'bored',
  'quitting',
];

const EMOTION_LABELS: Record<EmotionType, string> = {
  productive: 'Productive',
  stimulated: 'Stimulated',
  frustrated: 'Frustrated',
  learning: 'Learning',
  enjoying: 'Enjoying',
  bored: 'Bored',
  quitting: 'Quitting',
};

const EMOTION_EMOJIS: Record<EmotionType, string> = {
  productive: '',
  stimulated: '',
  frustrated: '',
  learning: '',
  enjoying: '',
  bored: '',
  quitting: '',
};

interface EmotionalPulseWidgetProps {
  context?: EmotionalPulseContext;
  contextId?: number;
  agentId?: number;
  cooldownMs?: number;
  emotions?: EmotionType[];
  compact?: boolean;
  onPulse?: (emotion: EmotionType) => void;
}

export const EmotionalPulseWidget = ({
  context = 'chatbot',
  contextId,
  agentId,
  cooldownMs = 10000,
  emotions = DEFAULT_EMOTIONS,
  compact = false,
  onPulse,
}: EmotionalPulseWidgetProps) => {
  const { isDark } = useTheme();
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionType | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Theme colors
  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgAlt: isDark ? '#374151' : '#f9fafb',
    border: isDark ? '#4b5563' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    chipBg: isDark ? '#374151' : '#f3f4f6',
    chipBgHover: isDark ? '#4b5563' : '#e5e7eb',
    chipBgSelected: isDark ? '#3b82f6' : '#2563eb',
    chipText: isDark ? '#e5e7eb' : '#374151',
    chipTextSelected: '#ffffff',
    chipBgDisabled: isDark ? '#1f2937' : '#f9fafb',
    chipTextDisabled: isDark ? '#4b5563' : '#d1d5db',
  };

  // Cooldown timer
  useEffect(() => {
    if (!isDisabled || cooldownRemaining <= 0) return;

    const interval = setInterval(() => {
      setCooldownRemaining((prev) => {
        const newValue = prev - 1000;
        if (newValue <= 0) {
          setIsDisabled(false);
          setSelectedEmotion(null);
          return 0;
        }
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isDisabled, cooldownRemaining]);

  const handleEmotionClick = useCallback(
    async (emotion: EmotionType) => {
      if (isDisabled || isSubmitting) return;

      setIsSubmitting(true);
      setSelectedEmotion(emotion);

      try {
        await emotionalPulseApi.logPulse({
          emotion,
          context,
          contextId,
          agentId,
        });

        // Start cooldown
        setIsDisabled(true);
        setCooldownRemaining(cooldownMs);

        // Callback
        if (onPulse) {
          onPulse(emotion);
        }
      } catch (error) {
        console.error('Failed to log emotional pulse:', error);
        // Reset on error so user can try again
        setSelectedEmotion(null);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isDisabled, isSubmitting, context, contextId, agentId, cooldownMs, onPulse]
  );

  const formatCooldown = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  return (
    <div
      className={`px-4 ${compact ? 'py-2' : 'py-3'} border-t`}
      style={{ borderColor: colors.border, backgroundColor: colors.bg }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`${compact ? 'text-xs' : 'text-sm'} font-medium`}
          style={{ color: colors.textSecondary }}
        >
          {isDisabled ? 'Thanks for sharing!' : 'How are you feeling?'}
        </span>
        {isDisabled && cooldownRemaining > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
              color: isDark ? '#60a5fa' : '#2563eb',
            }}
          >
            {formatCooldown(cooldownRemaining)}
          </span>
        )}
      </div>

      {/* Emotion Chips */}
      <div className="flex flex-wrap gap-2">
        {emotions.map((emotion) => {
          const isSelected = selectedEmotion === emotion;
          const chipDisabled = isDisabled && !isSelected;

          return (
            <button
              key={emotion}
              onClick={() => handleEmotionClick(emotion)}
              disabled={isDisabled || isSubmitting}
              className={`
                ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}
                rounded-full font-medium transition-all duration-200
                ${isDisabled ? 'cursor-default' : 'cursor-pointer'}
                ${!isDisabled && !isSelected ? 'hover:scale-105' : ''}
                focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500
              `}
              style={{
                backgroundColor: isSelected
                  ? colors.chipBgSelected
                  : chipDisabled
                  ? colors.chipBgDisabled
                  : colors.chipBg,
                color: isSelected
                  ? colors.chipTextSelected
                  : chipDisabled
                  ? colors.chipTextDisabled
                  : colors.chipText,
                border: isSelected
                  ? `2px solid ${colors.chipBgSelected}`
                  : `1px solid ${chipDisabled ? colors.chipBgDisabled : colors.border}`,
                opacity: chipDisabled ? 0.5 : 1,
              }}
              aria-pressed={isSelected}
              aria-disabled={isDisabled}
            >
              {EMOTION_EMOJIS[emotion] && (
                <span className="mr-1">{EMOTION_EMOJIS[emotion]}</span>
              )}
              {EMOTION_LABELS[emotion]}
            </button>
          );
        })}
      </div>
    </div>
  );
};
