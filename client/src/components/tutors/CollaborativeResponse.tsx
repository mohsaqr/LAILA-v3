import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../../hooks/useTheme';
import { TutorTypingIndicator } from './TutorTypingIndicator';
import type { AgentContribution } from '../../types/tutor';

// Inline keyframes for fade-in animation
const fadeInStyle = {
  animation: 'fadeSlideIn 0.4s ease-out forwards',
};

// Add keyframes to document head once
if (typeof document !== 'undefined' && !document.getElementById('collab-response-styles')) {
  const style = document.createElement('style');
  style.id = 'collab-response-styles';
  style.textContent = `
    @keyframes fadeSlideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
}

interface CollaborativeResponseProps {
  contributions: AgentContribution[];
  style?: string;
  onAllRevealed?: () => void;
  /** Show all contributions immediately (for loaded history) */
  immediate?: boolean;
}

/**
 * Displays collaborative responses one by one with staggered timing
 * Creates a chat-like experience where each tutor "types" their response
 */
export const CollaborativeResponse = ({
  contributions,
  style,
  onAllRevealed,
  immediate = false,
}: CollaborativeResponseProps) => {
  const { isDark } = useTheme();
  const { t } = useTranslation(['tutors']);
  // If immediate, show all at once; otherwise start at 0 and reveal progressively
  const [revealedCount, setRevealedCount] = useState(immediate ? contributions.length : 0);
  const [isTyping, setIsTyping] = useState(!immediate);
  const [nextTutorName, setNextTutorName] = useState<string | null>(null);

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    bubbleBg: isDark ? '#374151' : '#f3f4f6',
    avatarBg: isDark ? '#4b5563' : '#e5e7eb',
  };

  const getPersonalityGradient = (agentName: string) => {
    const name = agentName.toLowerCase();
    if (name.includes('socratic')) return 'from-purple-500 to-indigo-500';
    if (name.includes('friendly') || name.includes('beatrice')) return 'from-green-500 to-emerald-500';
    if (name.includes('carmen') || name.includes('casual')) return 'from-orange-500 to-amber-500';
    if (name.includes('project') || name.includes('helper')) return 'from-blue-500 to-cyan-500';
    if (name.includes('laila')) return 'from-pink-500 to-rose-500';
    return 'from-gray-500 to-gray-600';
  };

  useEffect(() => {
    // Skip animation if immediate mode
    if (immediate) {
      setIsTyping(false);
      return;
    }

    // All revealed - done
    if (revealedCount >= contributions.length) {
      setIsTyping(false);
      setNextTutorName(null);
      onAllRevealed?.();
      return;
    }

    // Show typing indicator for next tutor
    setNextTutorName(contributions[revealedCount].agentDisplayName);
    setIsTyping(true);

    // Delay before revealing: shorter for first, random 1-4s for rest
    const delay = revealedCount === 0 ? 800 : (1000 + Math.random() * 3000);
    const timer = setTimeout(() => {
      setRevealedCount(prev => prev + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [revealedCount, contributions.length, onAllRevealed, immediate]);

  return (
    <div className="space-y-4">
      {/* Style badge */}
      {style && (
        <div className="text-xs px-2 py-1 rounded-full inline-block"
          style={{
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
            color: isDark ? '#60a5fa' : '#2563eb',
          }}>
          {style === 'parallel' && `⚡ ${t('parallel_responses')}`}
          {style === 'sequential' && `→ ${t('sequential_chain')}`}
          {style === 'debate' && `⚔️ ${t('debate_mode')}`}
          {style === 'random' && `🎲 ${t('random_selection')}`}
        </div>
      )}

      {/* Revealed contributions */}
      {contributions.slice(0, revealedCount).map((contrib, idx) => (
        <div key={idx} className="flex items-start gap-3" style={fadeInStyle}>
          {/* Avatar */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${getPersonalityGradient(contrib.agentName)} text-white`}
          >
            {contrib.avatarUrl ? (
              <img
                src={contrib.avatarUrl}
                alt={contrib.agentDisplayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <Bot className="w-4 h-4" />
            )}
          </div>

          {/* Message */}
          <div className="flex-1 max-w-[85%]">
            {/* Name and round */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                {contrib.agentDisplayName}
              </span>
              {contrib.round && (
                <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: isDark ? '#374151' : '#e5e7eb',
                    color: colors.textSecondary,
                  }}>
                  {t('round', { number: contrib.round })}
                </span>
              )}
            </div>

            {/* Content bubble */}
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-md prose prose-sm max-w-none dark:prose-invert"
              style={{ backgroundColor: colors.bubbleBg, color: colors.textPrimary }}
            >
              <ReactMarkdown
                components={{
                  // Render markdown properly
                  h1: ({ children }) => <p className="font-bold text-base mb-1">{children}</p>,
                  h2: ({ children }) => <p className="font-bold mb-1">{children}</p>,
                  h3: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  hr: () => <hr className="my-2 border-gray-300 dark:border-gray-600" />,
                  table: () => null, // Skip tables
                  code: ({ children }) => <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{children}</code>,
                  pre: ({ children }) => <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto my-1">{children}</pre>,
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="text-sm">{children}</li>,
                  a: ({ href, children }) => <a href={href} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                }}
              >
                {contrib.contribution}
              </ReactMarkdown>
            </div>

            {/* Response time */}
            <div className="text-xs mt-1" style={{ color: colors.textSecondary }}>
              {(contrib.responseTimeMs / 1000).toFixed(1)}s
            </div>
          </div>
        </div>
      ))}

      {/* Typing indicator for next tutor */}
      {isTyping && revealedCount < contributions.length && nextTutorName && (
        <TutorTypingIndicator agentName={nextTutorName} />
      )}
    </div>
  );
};
