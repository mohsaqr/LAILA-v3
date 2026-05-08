import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
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
 * Wraps any block to provide drag handle (left), kebab menu (right),
 * native HTML5 drag-and-drop wiring, and a top "drop here" indicator.
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
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const muted = isDark ? '#6b7280' : '#9ca3af';
  const accent = '#0d9488';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={onDragOverGap}
      onDrop={onDropGap}
      className="group relative"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      {/* Drop indicator above the block */}
      <div
        aria-hidden="true"
        className="absolute -top-1.5 left-0 right-0 h-0.5 rounded-full transition-opacity pointer-events-none"
        style={{
          backgroundColor: accent,
          opacity: isDropTarget ? 1 : 0,
        }}
      />

      <div
        className="relative pr-8"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {children}

        {/* Right-side menu — also acts as the drag affordance */}
        <div
          className="absolute right-0 top-1.5 transition-opacity"
          style={{ opacity: hover || menuOpen ? 1 : 0 }}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              aria-label={t('common:more_options', { defaultValue: 'More options' })}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md"
              style={{ color: muted }}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  className="absolute right-0 mt-1 w-36 rounded-lg shadow-lg py-1 z-20 text-sm"
                  style={{
                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                  }}
                >
                  <button
                    type="button"
                    disabled={isFirst}
                    onClick={() => { onMoveUp(); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    style={{ color: isDark ? '#cbd5e1' : '#374151' }}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    {t('common:move_up', { defaultValue: 'Move up' })}
                  </button>
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => { onMoveDown(); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    style={{ color: isDark ? '#cbd5e1' : '#374151' }}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    {t('common:move_down', { defaultValue: 'Move down' })}
                  </button>
                  <div
                    className="my-1 mx-2 border-t"
                    style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
                  />
                  <button
                    type="button"
                    onClick={() => { onDelete(); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-red-600 dark:text-red-400 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('common:delete', { defaultValue: 'Delete' })}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
