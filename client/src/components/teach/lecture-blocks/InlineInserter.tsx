import { useTranslation } from 'react-i18next';
import { Plus, Type, FileUp, Bot } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import type { LectureSection } from '../../../types';

type InsertableType = Extract<LectureSection['type'], 'text' | 'file' | 'chatbot'>;

interface InlineInserterProps {
  onInsert: (type: InsertableType) => void;
  /** Hide the Text pill — the section above is already a text block, so
      the user can keep typing instead of opening a second one. */
  omitText?: boolean;
}

/**
 * Always-visible "+ Text · + File · + Chatbot" pill row between blocks.
 * Click any pill to insert that block type at this position.
 */
export const InlineInserter = ({ onInsert, omitText = false }: InlineInserterProps) => {
  const { t } = useTranslation('teaching');
  const { isDark } = useTheme();

  const muted = isDark ? '#9ca3af' : '#6b7280';

  const allItems: Array<{ type: InsertableType; icon: typeof Type; label: string; color: string; bg: string }> = [
    {
      type: 'text',
      icon: Type,
      label: t('block_text', { defaultValue: 'Text' }),
      color: isDark ? '#cbd5e1' : '#374151',
      bg: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6',
    },
    {
      type: 'file',
      icon: FileUp,
      label: t('block_file', { defaultValue: 'File' }),
      color: isDark ? '#5eead4' : '#0d9488',
      bg: isDark ? 'rgba(20,184,166,0.10)' : '#f0fdfa',
    },
    {
      type: 'chatbot',
      icon: Bot,
      label: t('block_chatbot', { defaultValue: 'Chatbot' }),
      color: isDark ? '#c4b5fd' : '#7c3aed',
      bg: isDark ? 'rgba(167,139,250,0.10)' : '#faf5ff',
    },
  ];
  const items = omitText ? allItems.filter(i => i.type !== 'text') : allItems;

  return (
    <div className="flex items-center gap-2 my-2">
      <span
        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: muted }}
      >
        <Plus className="w-3 h-3" />
        {t('add_block', { defaultValue: 'Add' })}
      </span>
      {items.map(({ type, icon: Icon, label, color, bg }) => (
        <button
          key={type}
          type="button"
          onClick={() => onInsert(type)}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all hover:-translate-y-0.5"
          style={{ color, backgroundColor: bg }}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
};
