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
  Network,
  ListChecks,
  Folder,
  Link as LinkIcon,
  MonitorPlay,
  FileUp,
  Image as ImageIcon,
  EyeOff,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export type ContentType = 'lecture' | 'video' | 'mixed' | 'lab' | 'quiz' | 'assignment' | 'forum' | 'ai' | 'ai_agent' | 'interactive_lab' | 'survey' | 'folder' | 'url' | 'embed' | 'file' | 'image';
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
  /** Marks an unpublished item — only shown to course staff, with a badge. */
  hidden?: boolean;
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
  interactive_lab: {
    icon: Network,
    labelKey: 'content_interactive_lab',
    bgLight: 'bg-violet-50',
    bgDark: 'rgba(139, 92, 246, 0.15)',
    textLight: '#7c3aed',
    textDark: '#c4b5fd',
    borderLight: '#ddd6fe',
    borderDark: 'rgba(139, 92, 246, 0.3)',
  },
  survey: {
    icon: ListChecks,
    labelKey: 'content_survey',
    bgLight: 'bg-rose-50',
    bgDark: 'rgba(244, 63, 94, 0.15)',
    textLight: '#e11d48',
    textDark: '#fb7185',
    borderLight: '#fecdd3',
    borderDark: 'rgba(244, 63, 94, 0.3)',
  },
  folder: {
    icon: Folder,
    labelKey: 'content_folder',
    bgLight: 'bg-amber-50',
    bgDark: 'rgba(245, 158, 11, 0.15)',
    textLight: '#d97706',
    textDark: '#fcd34d',
    borderLight: '#fde68a',
    borderDark: 'rgba(245, 158, 11, 0.3)',
  },
  url: {
    icon: LinkIcon,
    labelKey: 'content_url',
    bgLight: 'bg-sky-50',
    bgDark: 'rgba(2, 132, 199, 0.15)',
    textLight: '#0284c7',
    textDark: '#7dd3fc',
    borderLight: '#bae6fd',
    borderDark: 'rgba(2, 132, 199, 0.3)',
  },
  embed: {
    icon: MonitorPlay,
    labelKey: 'content_embed',
    bgLight: 'bg-violet-50',
    bgDark: 'rgba(139, 92, 246, 0.15)',
    textLight: '#7c3aed',
    textDark: '#c4b5fd',
    borderLight: '#ddd6fe',
    borderDark: 'rgba(139, 92, 246, 0.3)',
  },
  file: {
    icon: FileUp,
    labelKey: 'content_file',
    bgLight: 'bg-teal-50',
    bgDark: 'rgba(13, 148, 136, 0.15)',
    textLight: '#0d9488',
    textDark: '#5eead4',
    borderLight: '#99f6e4',
    borderDark: 'rgba(13, 148, 136, 0.3)',
  },
  image: {
    icon: ImageIcon,
    labelKey: 'content_image',
    bgLight: 'bg-cyan-50',
    bgDark: 'rgba(8, 145, 178, 0.15)',
    textLight: '#0891b2',
    textDark: '#67e8f9',
    borderLight: '#a5f3fc',
    borderDark: 'rgba(8, 145, 178, 0.3)',
  },
};

export const ContentCard = ({
  type,
  title,
  subtitle,
  metadata,
  href,
  onClick,
  disabled = false,
  size = 'normal',
  hidden = false,
}: ContentCardProps) => {
  const { t } = useTranslation(['courses']);
  const { isDark } = useTheme();
  const config = contentConfigBase[type];
  const Icon = config.icon;
  const label = t(config.labelKey);

  // Small "Hidden" badge for unpublished items (course staff only).
  const hiddenBadge = hidden ? (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
      style={{
        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
        color: isDark ? '#fcd34d' : '#b45309',
      }}
    >
      <EyeOff className="w-3 h-3" />
      {t('hidden', { defaultValue: 'Hidden' })}
    </span>
  ) : null;

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

  // Shared focus-visible ring for clickable cards (keyboard accessibility).
  const focusRing =
    'focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900';

  // Mini size: Compact cards with icon + title
  if (size === 'mini') {
    const interactive = !disabled && !href;
    const miniContent = (
      // `h-full` is what makes a row of cards line up. The grid stretches the
      // ITEM — which is the <Link> below, not this div — so without it the
      // border stops at the content and every card ends at a different height.
      <div
        className={`h-full w-full p-3 rounded-lg border transition-all flex flex-col items-center text-center ${focusRing} ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
        }`}
        style={{ ...cardStyles, minHeight: '100px' }}
        onClick={interactive ? onClick : undefined}
        onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-disabled={disabled || undefined}
        title={title}
      >
        <div
          className={`rounded-lg flex items-center justify-center mb-2 flex-shrink-0 ${!isDark ? config.bgLight : ''}`}
          style={{ ...iconBgStyle, width: iconContainerSize, height: iconContainerSize }}
        >
          <Icon style={{ ...iconTextStyle, width: iconSize, height: iconSize }} />
        </div>
        <span
          className="text-sm font-medium leading-snug line-clamp-2 break-words w-full"
          style={{ color: isDark ? '#f3f4f6' : '#111827' }}
        >
          {title}
        </span>
        {subtitle && (
          <span
            className="text-[11px] leading-snug line-clamp-2 mt-1 break-words w-full"
            style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
          >
            {subtitle}
          </span>
        )}
        {/* `mt-auto` sits the badge on the floor of the card, so the badges of
            a row align with each other instead of floating under titles of
            differing length. */}
        {hiddenBadge && <div className="mt-auto pt-1.5">{hiddenBadge}</div>}
      </div>
    );

    if (href && !disabled) {
      return <Link to={href} className={`block h-full rounded-lg ${focusRing}`}>{miniContent}</Link>;
    }
    return miniContent;
  }

  // Icon size: Icon above title, clean minimal style
  if (size === 'icon') {
    const interactive = !disabled && !href;
    const iconContent = (
      // Deliberately NOT `justify-center`: once the cards are equal height,
      // centring would push the icon down by however tall that card's own text
      // is, so the icons across a row would no longer line up.
      <div
        className={`h-full w-full p-3 rounded-lg border transition-all flex flex-col items-center text-center ${focusRing} ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
        }`}
        style={{ ...cardStyles, minWidth: '80px', minHeight: '80px' }}
        onClick={interactive ? onClick : undefined}
        onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-disabled={disabled || undefined}
        title={title}
      >
        <div
          className={`rounded-lg flex items-center justify-center mb-2 ${!isDark ? config.bgLight : ''}`}
          style={{ ...iconBgStyle, width: iconContainerSize, height: iconContainerSize }}
        >
          <Icon style={{ ...iconTextStyle, width: iconSize, height: iconSize }} />
        </div>
        <span
          className="text-xs font-medium leading-tight line-clamp-2 break-words w-full"
          style={{ color: isDark ? '#f3f4f6' : '#111827' }}
        >
          {title}
        </span>
        {hiddenBadge && <div className="mt-auto pt-1.5">{hiddenBadge}</div>}
      </div>
    );

    if (href && !disabled) {
      return <Link to={href} className={`block h-full rounded-lg ${focusRing}`}>{iconContent}</Link>;
    }
    return iconContent;
  }

  // Normal size: Original layout
  const interactiveNormal = !disabled && !href;
  const cardContent = (
    <div
      className={`h-full w-full p-3 rounded-lg border transition-all flex flex-col ${focusRing} ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
      }`}
      style={cardStyles}
      onClick={interactiveNormal ? onClick : undefined}
      onKeyDown={interactiveNormal ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      role={interactiveNormal ? 'button' : undefined}
      tabIndex={interactiveNormal ? 0 : undefined}
      aria-disabled={disabled || undefined}
      title={title}
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

      {/* Optional one/two-line description */}
      {subtitle && (
        <p
          className="text-xs line-clamp-2 mb-1"
          style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
        >
          {subtitle}
        </p>
      )}

      {/* Footer: label + metadata. `mt-auto` keeps it on the bottom edge so the
          type pills of a row align, however many lines the title took. */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-2">
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${!isDark ? config.bgLight : ''}`}
            style={{
              backgroundColor: isDark ? config.bgDark : undefined,
              color: isDark ? config.textDark : config.textLight,
            }}
          >
            {label}
          </span>
          {hiddenBadge}
        </span>
        {metadata && (
          <span
            className="text-[10px] truncate min-w-0"
            style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
          >
            {metadata}
          </span>
        )}
      </div>
    </div>
  );

  if (href && !disabled) {
    return <Link to={href} className={`block h-full rounded-lg ${focusRing}`}>{cardContent}</Link>;
  }

  return cardContent;
};

export default ContentCard;
