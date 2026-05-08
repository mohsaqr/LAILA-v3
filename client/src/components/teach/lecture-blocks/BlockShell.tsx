import { useTranslation } from 'react-i18next';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';

interface BlockShellProps {
  children: React.ReactNode;
  isFirst: boolean;
  isLast: boolean;
  /** Native HTML5 drag handlers — owned by parent so it can mutate the order. */
  onDragStart: (e: React.DragEvent<HTMLElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLElement>) => void;
  onDragOverGap: (e: React.DragEvent<HTMLElement>) => void;
  onDropGap: (e: React.DragEvent<HTMLElement>) => void;
  isDragging: boolean;
  isDropTarget: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

/**
 * Wraps any block. Up / down / delete icons sit always-visible in a
 * compact toolbar at the top-right, above the block content. Drop
 * indicator (2-px teal bar) renders just above the block when it's
 * the active drop target.
 */
export const BlockShell = ({
  children,
  isFirst,
  isLast,
  onDragStart,
  onDragEnd,
  onDragOverGap,
  onDropGap,
  isDragging,
  isDropTarget,
  onMoveUp,
  onMoveDown,
  onDelete,
}: BlockShellProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const { isDark } = useTheme();

  const muted = isDark ? '#6b7280' : '#9ca3af';
  const subtle = isDark ? '#9ca3af' : '#6b7280';
  const accent = '#0d9488';
  const iconBtn =
    'inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div
      onDragOver={onDragOverGap}
      onDrop={onDropGap}
      className="relative"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      {/* Drop indicator above the block */}
      <div
        aria-hidden="true"
        className="absolute -top-1 left-0 right-0 h-0.5 rounded-full transition-opacity pointer-events-none"
        style={{
          backgroundColor: accent,
          opacity: isDropTarget ? 1 : 0,
        }}
      />

      {/* Always-visible per-block toolbar */}
      <div className="flex items-center justify-end gap-0.5 mb-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label={t('common:move_up', { defaultValue: 'Move up' })}
          title={t('common:move_up', { defaultValue: 'Move up' })}
          className={`${iconBtn} hover:bg-black/5 dark:hover:bg-white/5`}
          style={{ color: subtle }}
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label={t('common:move_down', { defaultValue: 'Move down' })}
          title={t('common:move_down', { defaultValue: 'Move down' })}
          className={`${iconBtn} hover:bg-black/5 dark:hover:bg-white/5`}
          style={{ color: subtle }}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('common:delete', { defaultValue: 'Delete' })}
          title={t('common:delete', { defaultValue: 'Delete' })}
          className={`${iconBtn} text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {children}
      </div>

      {/* Reference muted to keep the variable used (it's used by hover styles via subtle). */}
      <span aria-hidden="true" className="hidden" style={{ color: muted }} />
    </div>
  );
};
