import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Avatar } from './Avatar';
import { resolveFileUrl } from '../../api/client';

export interface CourseCompletionListItem {
  courseId: number;
  courseTitle: string;
  completionPct: number;
  studentCount: number;
  participants: Array<{
    id: number;
    fullname: string | null;
    avatarUrl: string | null;
  }>;
}

interface CourseCompletionListProps {
  items: CourseCompletionListItem[];
  /** Optional override for each row's destination — defaults to the course curriculum page. */
  getHref?: (item: CourseCompletionListItem) => string;
  className?: string;
}

const STRIPE_COLORS = ['#0d9488', '#a855f7', '#f59e0b', '#ec4899', '#0ea5e9', '#10b981', '#ef4444'];

/**
 * Vertical list of courses with a coloured left stripe per row, the
 * course title, a per-course progress bar with completion %, and an
 * avatar stack of up to 5 enrolled students with a "+N" overflow chip.
 * Each row is a link to the course's curriculum.
 */
export const CourseCompletionList = ({ items, getHref, className = '' }: CourseCompletionListProps) => {
  const { isDark } = useTheme();
  if (items.length === 0) return null;

  const colors = {
    rowBg: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
    rowHover: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
    border: isDark ? '#1f2937' : '#f3f4f6',
    title: isDark ? '#f3f4f6' : '#111827',
    sub: isDark ? '#9ca3af' : '#6b7280',
    track: isDark ? '#374151' : '#e5e7eb',
    chevron: isDark ? '#6b7280' : '#9ca3af',
    overflowBg: isDark ? '#374151' : '#e5e7eb',
    overflowFg: isDark ? '#e5e7eb' : '#374151',
    ring: isDark ? '#1f2937' : '#ffffff',
  };

  return (
    <ul className={`space-y-2 ${className}`}>
      {items.map((c, i) => {
        const stripe = STRIPE_COLORS[i % STRIPE_COLORS.length];
        const href = getHref ? getHref(c) : `/teach/courses/${c.courseId}/curriculum`;
        const overflow = Math.max(0, c.studentCount - c.participants.length);
        return (
          <li key={c.courseId}>
            <Link
              to={href}
              className="group flex items-stretch gap-0 rounded-lg border overflow-hidden transition-colors"
              style={{
                backgroundColor: colors.rowBg,
                borderColor: colors.border,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = colors.rowHover;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = colors.rowBg;
              }}
            >
              {/* Left coloured stripe */}
              <div className="w-1 flex-shrink-0" style={{ backgroundColor: stripe }} />

              <div className="flex-1 min-w-0 px-3 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: colors.title }}>
                    {c.courseTitle}
                  </p>
                  <p className="text-xs truncate" style={{ color: colors.sub }}>
                    {c.studentCount === 1
                      ? '1 student enrolled'
                      : `${c.studentCount} students enrolled`}
                  </p>

                  {/* Progress + completion */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div
                      className="flex-1 h-1 rounded-full overflow-hidden"
                      style={{ backgroundColor: colors.track }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(0, Math.min(100, c.completionPct))}%`,
                          background: `linear-gradient(90deg, ${stripe}, ${stripe}cc)`,
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-medium tabular-nums whitespace-nowrap"
                      style={{ color: colors.title }}
                    >
                      {c.completionPct}%
                    </span>
                  </div>
                </div>

                {/* Avatars + chevron */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {c.participants.length > 0 && (
                    <AvatarStack
                      participants={c.participants}
                      overflow={overflow}
                      ringColor={colors.ring}
                      overflowBg={colors.overflowBg}
                      overflowFg={colors.overflowFg}
                    />
                  )}
                  <ChevronRight
                    className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                    style={{ color: colors.chevron }}
                  />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

function AvatarStack({
  participants,
  overflow,
  ringColor,
  overflowBg,
  overflowFg,
}: {
  participants: CourseCompletionListItem['participants'];
  overflow: number;
  ringColor: string;
  overflowBg: string;
  overflowFg: string;
}) {
  return (
    <div className="flex -space-x-1.5">
      {participants.slice(0, 5).map(p => (
        <span
          key={p.id}
          className="rounded-full"
          style={{ boxShadow: `0 0 0 1.5px ${ringColor}` }}
          title={p.fullname ?? undefined}
        >
          <Avatar
            src={p.avatarUrl ? resolveFileUrl(p.avatarUrl) : null}
            name={p.fullname || '?'}
            size="xs"
          />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold"
          style={{
            backgroundColor: overflowBg,
            color: overflowFg,
            boxShadow: `0 0 0 1.5px ${ringColor}`,
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
