import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  PlayCircle,
  Layers,
  FlaskConical,
  FileQuestion,
  ClipboardList,
  MessageSquare,
  Sparkles,
  Bot,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export type ContentType = 'lecture' | 'video' | 'mixed' | 'lab' | 'quiz' | 'assignment' | 'forum' | 'ai' | 'ai_agent';
export type ContentCardSize = 'mini' | 'icon' | 'normal';

interface ContentCardProps {
  type: ContentType;
  title: string;
  subtitle?: string;
  metadata?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: ContentCardSize;
}

// Config without labels - labels added in component with translations
const contentConfigBase: Record<ContentType, {
  icon: React.ElementType;
  labelKey: string;
  bgLight: string;
  bgDark: string;
  textLight: string;
  textDark: string;
  borderLight: string;
  borderDark: string;
}> = {
  lecture: {
    icon: FileText,
    labelKey: 'content_lecture',
    bgLight: 'bg-blue-50',
    bgDark: 'rgba(59, 130, 246, 0.15)',
    textLight: '#2563eb',
    textDark: '#93c5fd',
    borderLight: '#bfdbfe',
    borderDark: 'rgba(59, 130, 246, 0.3)',
  },
  video: {
    icon: PlayCircle,
    labelKey: 'content_video',
    bgLight: 'bg-purple-50',
    bgDark: 'rgba(139, 92, 246, 0.15)',
    textLight: '#7c3aed',
    textDark: '#c4b5fd',
    borderLight: '#ddd6fe',
    borderDark: 'rgba(139, 92, 246, 0.3)',
  },
  mixed: {
    icon: Layers,
    labelKey: 'content_mixed',
    bgLight: 'bg-slate-50',
    bgDark: 'rgba(100, 116, 139, 0.15)',
    textLight: '#475569',
    textDark: '#94a3b8',
    borderLight: '#e2e8f0',
    borderDark: 'rgba(100, 116, 139, 0.3)',
  },
  lab: {
    icon: FlaskConical,
    labelKey: 'content_code_lab',
    bgLight: 'bg-indigo-50',
    bgDark: 'rgba(99, 102, 241, 0.15)',
    textLight: '#4f46e5',
    textDark: '#a5b4fc',
    borderLight: '#c7d2fe',
    borderDark: 'rgba(99, 102, 241, 0.3)',
  },
  quiz: {
    icon: FileQuestion,
    labelKey: 'content_quiz',
    bgLight: 'bg-emerald-50',
    bgDark: 'rgba(16, 185, 129, 0.15)',
    textLight: '#059669',
    textDark: '#6ee7b7',
    borderLight: '#a7f3d0',
    borderDark: 'rgba(16, 185, 129, 0.3)',
  },
  assignment: {
    icon: ClipboardList,
    labelKey: 'content_assignment',
    bgLight: 'bg-amber-50',
    bgDark: 'rgba(245, 158, 11, 0.15)',
    textLight: '#d97706',
    textDark: '#fcd34d',
    borderLight: '#fde68a',
    borderDark: 'rgba(245, 158, 11, 0.3)',
  },
  ai_agent: {
    icon: Bot,
    labelKey: 'content_ai_agent',
    bgLight: 'bg-teal-50',
    bgDark: 'rgba(8, 143, 143, 0.15)',
    textLight: '#0d9488',
    textDark: '#5eead4',
    borderLight: '#99f6e4',
    borderDark: 'rgba(8, 143, 143, 0.3)',
  },
  forum: {
    icon: MessageSquare,
    labelKey: 'content_forum',
    bgLight: 'bg-cyan-50',
    bgDark: 'rgba(6, 182, 212, 0.15)',
    textLight: '#0891b2',
    textDark: '#67e8f9',
    borderLight: '#a5f3fc',
    borderDark: 'rgba(6, 182, 212, 0.3)',
  },
  ai: {
    icon: Sparkles,
    labelKey: 'content_ai',
    bgLight: 'bg-teal-50',
    bgDark: 'rgba(20, 184, 166, 0.15)',
    textLight: '#0d9488',
    textDark: '#5eead4',
    borderLight: '#99f6e4',
    borderDark: 'rgba(20, 184, 166, 0.3)',
  },
};

// Helper to get truncated title for mini cards
const getTruncatedTitle = (title: string, maxWords: number = 2): string => {
  const words = title.split(' ');
  if (words.length <= maxWords) return title;
  return words.slice(0, maxWords).join(' ');
};

export const ContentCard = ({
  type,
  title,
  subtitle: _subtitle,
  metadata,
  href,
  onClick,
  disabled = false,
  size = 'normal',
}: ContentCardProps) => {
  const { t } = useTranslation(['courses']);
  const { isDark } = useTheme();
  const config = contentConfigBase[type];
  const Icon = config.icon;
  const label = t(config.labelKey);

  const cardStyles: React.CSSProperties = {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderColor: isDark ? config.borderDark : config.borderLight,
  };

  const iconBgStyle: React.CSSProperties = {
    backgroundColor: isDark ? config.bgDark : undefined,
  };

  const iconTextStyle: React.CSSProperties = {
    color: isDark ? config.textDark : config.textLight,
  };

  // Consistent icon size across all modes
  const iconSize = 18;
  const iconContainerSize = 36;

  // Mini size: Compact cards with icon + title
  if (size === 'mini') {
    const miniContent = (
      <div
        className={`p-3 rounded-lg border transition-all flex flex-col items-center text-center ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
        }`}
        style={{ ...cardStyles, width: '140px', minHeight: '100px' }}
        onClick={!disabled && !href ? onClick : undefined}
        title={title}
      >
        <div
          className={`rounded-lg flex items-center justify-center mb-2 flex-shrink-0 ${!isDark ? config.bgLight : ''}`}
          style={{ ...iconBgStyle, width: iconContainerSize, height: iconContainerSize }}
        >
          <Icon style={{ ...iconTextStyle, width: iconSize, height: iconSize }} />
        </div>
        <span
          className="text-sm font-medium leading-snug line-clamp-3 flex-1"
          style={{ color: isDark ? '#f3f4f6' : '#111827' }}
        >
          {title}
        </span>
      </div>
    );

    if (href && !disabled) {
      return <Link to={href}>{miniContent}</Link>;
    }
    return miniContent;
  }

  // Icon size: Icon above title, clean minimal style
  if (size === 'icon') {
    const iconContent = (
      <div
        className={`p-3 rounded-lg border transition-all flex flex-col items-center justify-center text-center ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
        }`}
        style={{ ...cardStyles, minWidth: '80px', minHeight: '80px' }}
        onClick={!disabled && !href ? onClick : undefined}
        title={title}
      >
        <div
          className={`rounded-lg flex items-center justify-center mb-2 ${!isDark ? config.bgLight : ''}`}
          style={{ ...iconBgStyle, width: iconContainerSize, height: iconContainerSize }}
        >
          <Icon style={{ ...iconTextStyle, width: iconSize, height: iconSize }} />
        </div>
        <span
          className="text-xs font-medium leading-tight line-clamp-2"
          style={{ color: isDark ? '#f3f4f6' : '#111827' }}
        >
          {title}
        </span>
      </div>
    );

    if (href && !disabled) {
      return <Link to={href}>{iconContent}</Link>;
    }
    return iconContent;
  }

  // Normal size: Original layout
  const cardContent = (
    <div
      className={`p-3 rounded-lg border transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
      }`}
      style={cardStyles}
      onClick={!disabled && !href ? onClick : undefined}
    >
      {/* Icon */}
      <div
        className={`rounded-lg flex items-center justify-center mb-2 ${
          !isDark ? config.bgLight : ''
        }`}
        style={{ ...iconBgStyle, width: iconContainerSize, height: iconContainerSize }}
      >
        <Icon style={{ ...iconTextStyle, width: iconSize, height: iconSize }} />
      </div>

      {/* Content */}
      <h3
        className="font-medium text-sm line-clamp-2 mb-1"
        style={{ color: isDark ? '#f3f4f6' : '#111827' }}
      >
        {title}
      </h3>

      {/* Footer: label + metadata */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: isDark ? config.bgDark : undefined,
            color: isDark ? config.textDark : config.textLight,
          }}
          {...(!isDark && { className: `text-[10px] font-medium px-1.5 py-0.5 rounded ${config.bgLight}` })}
        >
          {label}
        </span>
        {metadata && (
          <span
            className="text-[10px] truncate"
            style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
          >
            {metadata}
          </span>
        )}
      </div>
    </div>
  );

  if (href && !disabled) {
    return <Link to={href}>{cardContent}</Link>;
  }

  return cardContent;
};

export default ContentCard;
