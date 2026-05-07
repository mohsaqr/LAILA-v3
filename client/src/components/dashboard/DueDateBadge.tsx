import { useTranslation } from 'react-i18next';

interface DueDateBadgeProps {
  date: string | Date | null | undefined;
  className?: string;
}

const dayDiff = (d: Date) => Math.round((d.getTime() - Date.now()) / 86_400_000);

/**
 * Small relative-time badge for due dates. Color encodes urgency:
 * red = overdue, amber = due within 2 days, gray = future.
 */
export const DueDateBadge = ({ date, className = '' }: DueDateBadgeProps) => {
  const { t } = useTranslation(['common']);
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  const days = dayDiff(d);

  let label: string;
  let style: { bg: string; fg: string };
  if (days < 0) {
    label = t('common:overdue_x_days', { defaultValue: 'Overdue · {{days}}d', days: Math.abs(days) });
    style = { bg: 'rgba(239,68,68,0.12)', fg: '#b91c1c' };
  } else if (days === 0) {
    label = t('common:due_today', { defaultValue: 'Due today' });
    style = { bg: 'rgba(245,158,11,0.15)', fg: '#92400e' };
  } else if (days <= 2) {
    label = t('common:due_in_x_days', { defaultValue: 'Due in {{days}}d', days });
    style = { bg: 'rgba(245,158,11,0.15)', fg: '#92400e' };
  } else {
    label = t('common:due_in_x_days', { defaultValue: 'Due in {{days}}d', days });
    style = { bg: 'rgba(107,114,128,0.12)', fg: '#374151' };
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {label}
    </span>
  );
};
