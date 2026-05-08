import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Type, FileUp, Bot } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import type { LectureSection } from '../../../types';

type InsertableType = Extract<LectureSection['type'], 'text' | 'file' | 'chatbot'>;

interface InlineInserterProps {
  onInsert: (type: InsertableType) => void;
}

/**
 * The "+ Text · + File · + Chatbot" affordance shown between blocks.
 * Renders as a slim hover-revealed strip; clicking expands into three
 * pill buttons. Click any pill to insert at this position.
 */
export const InlineInserter = ({ onInsert }: InlineInserterProps) => {
  const { t } = useTranslation('teaching');
  const { isDark } = useTheme();
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);

  const showActions = hover || open;
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const muted = isDark ? '#6b7280' : '#9ca3af';
  const accent = '#0d9488';

  const items: Array<{ type: InsertableType; icon: typeof Type; label: string; color: string }> = [
    { type: 'text',    icon: Type,   label: t('block_text',    { defaultValue: 'Text' }),    color: isDark ? '#cbd5e1' : '#374151' },
    { type: 'file',    icon: FileUp, label: t('block_file',    { defaultValue: 'File' }),    color: isDark ? '#5eead4' : '#0d9488' },
    { type: 'chatbot', icon: Bot,    label: t('block_chatbot', { defaultValue: 'Chatbot' }), color: isDark ? '#c4b5fd' : '#7c3aed' },
  ];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative h-7 flex items-center justify-center my-1 px-8"
    >
      {/* Always-visible faint divider */}
      <div
        aria-hidden="true"
        className="absolute left-8 right-8 h-px transition-opacity"
        style={{
          backgroundColor: dividerColor,
          opacity: showActions ? 0 : 1,
        }}
      />

      {showActions && (
        <div className="flex items-center gap-1.5">
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
              style={{
                color: muted,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6',
              }}
            >
              <Plus className="w-3 h-3" />
              {t('add_block', { defaultValue: 'Add block' })}
            </button>
          ) : (
            items.map(({ type, icon: Icon, label, color }) => (
              <button
                key={type}
                type="button"
                onClick={() => { onInsert(type); setOpen(false); }}
                onBlur={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all hover:-translate-y-0.5"
                style={{
                  color,
                  borderColor: isDark ? '#374151' : '#e5e7eb',
                  backgroundColor: isDark ? '#1f2937' : '#ffffff',
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: type === 'text' ? muted : (type === 'file' ? accent : '#7c3aed') }} />
                {label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
