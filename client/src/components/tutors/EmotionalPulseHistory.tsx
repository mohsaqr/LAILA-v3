import { useQuery } from '@tanstack/react-query';
import { Heart, X, Clock } from 'lucide-react';
import { emotionalPulseApi } from '../../api/emotionalPulse';
import { useTheme } from '../../hooks/useTheme';
import type { EmotionType, EmotionalPulse } from '../../types';

// Emotion color mapping
const EMOTION_COLORS: Record<EmotionType, { bg: string; text: string; darkBg: string; darkText: string }> = {
  productive: { bg: '#dcfce7', text: '#166534', darkBg: 'rgba(34, 197, 94, 0.2)', darkText: '#4ade80' },
  stimulated: { bg: '#fef9c3', text: '#854d0e', darkBg: 'rgba(234, 179, 8, 0.2)', darkText: '#facc15' },
  frustrated: { bg: '#fee2e2', text: '#991b1b', darkBg: 'rgba(239, 68, 68, 0.2)', darkText: '#f87171' },
  learning: { bg: '#dbeafe', text: '#1e40af', darkBg: 'rgba(59, 130, 246, 0.2)', darkText: '#60a5fa' },
  enjoying: { bg: '#fce7f3', text: '#9d174d', darkBg: 'rgba(236, 72, 153, 0.2)', darkText: '#f472b6' },
  bored: { bg: '#f3f4f6', text: '#374151', darkBg: 'rgba(107, 114, 128, 0.2)', darkText: '#9ca3af' },
  quitting: { bg: '#ffedd5', text: '#c2410c', darkBg: 'rgba(249, 115, 22, 0.2)', darkText: '#fb923c' },
};

const EMOTION_LABELS: Record<EmotionType, string> = {
  productive: 'Productive',
  stimulated: 'Stimulated',
  frustrated: 'Frustrated',
  learning: 'Learning',
  enjoying: 'Enjoying',
  bored: 'Bored',
  quitting: 'Quitting',
};

interface EmotionalPulseHistoryProps {
  agentId?: number;
  agentName?: string;
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
  refreshTrigger?: number;
}

export const EmotionalPulseHistory = ({
  agentId,
  agentName,
  isOpen,
  onClose,
  isMobile = false,
  refreshTrigger = 0,
}: EmotionalPulseHistoryProps) => {
  const { isDark } = useTheme();

  // Theme colors
  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgAlt: isDark ? '#111827' : '#f9fafb',
    border: isDark ? '#374151' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    cardBg: isDark ? '#374151' : '#f9fafb',
    accent: isDark ? '#3b82f6' : '#2563eb',
  };

  // Fetch emotional pulse history
  const { data, isLoading } = useQuery({
    queryKey: ['emotionalPulseHistory', agentId, refreshTrigger],
    queryFn: () => emotionalPulseApi.getMyHistory({
      context: 'chatbot',
      agentId,
      limit: 50,
    }),
    enabled: isOpen,
    staleTime: 30000,
  });

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get emotion color
  const getEmotionStyle = (emotion: EmotionType) => {
    const colorSet = EMOTION_COLORS[emotion] || EMOTION_COLORS.bored;
    return {
      backgroundColor: isDark ? colorSet.darkBg : colorSet.bg,
      color: isDark ? colorSet.darkText : colorSet.text,
    };
  };

  // Sidebar content
  const sidebarContent = (
    <div
      className={`flex flex-col h-full ${isMobile ? 'w-full' : 'w-72'}`}
      style={{ backgroundColor: colors.bg }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: colors.border }}
      >
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-500" />
          <div>
            <h3 className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
              Emotional Journey
            </h3>
            {agentName && (
              <p className="text-xs" style={{ color: colors.textSecondary }}>
                with {agentName}
              </p>
            )}
          </div>
        </div>
        {isMobile && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close history"
          >
            <X className="w-5 h-5" style={{ color: colors.textSecondary }} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : !data?.pulses || data.pulses.length === 0 ? (
          <div className="text-center py-8">
            <Heart className="w-12 h-12 mx-auto mb-3" style={{ color: colors.textMuted }} />
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              No emotional pulses yet
            </p>
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
              Share how you're feeling during your session
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.pulses.map((pulse: EmotionalPulse) => (
              <div
                key={pulse.id}
                className="rounded-lg p-3 transition-all hover:scale-[1.02]"
                style={{ backgroundColor: colors.cardBg }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={getEmotionStyle(pulse.emotion)}
                  >
                    {EMOTION_LABELS[pulse.emotion] || pulse.emotion}
                  </span>
                  <div className="flex items-center gap-1" style={{ color: colors.textMuted }}>
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">{formatRelativeTime(pulse.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {data?.total !== undefined && data.total > 0 && (
        <div
          className="px-4 py-3 border-t text-center"
          style={{ borderColor: colors.border }}
        >
          <p className="text-xs" style={{ color: colors.textMuted }}>
            {data.total} pulse{data.total !== 1 ? 's' : ''} recorded
          </p>
        </div>
      )}
    </div>
  );

  // Mobile: Overlay with backdrop
  if (isMobile) {
    if (!isOpen) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
        {/* Sidebar */}
        <div
          className="fixed right-0 top-0 bottom-0 z-50 w-80 max-w-[85vw] shadow-xl transform transition-transform"
          style={{ backgroundColor: colors.bg }}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  // Desktop: Static sidebar
  if (!isOpen) return null;

  return (
    <div
      className="hidden lg:flex flex-col h-full border-l"
      style={{ borderColor: colors.border, backgroundColor: colors.bg }}
    >
      {sidebarContent}
    </div>
  );
};
