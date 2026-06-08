import { useTranslation } from 'react-i18next';
import { CalendarClock } from 'lucide-react';
import { Input, TextArea } from '../../common/Input';
import { Toggle } from '../../common/Toggle';

/** The essential metadata every resource shares. Dates are kept as
 *  `datetime-local` strings here; the modal converts them to ISO on submit. */
export interface ResourceMeta {
  title: string;
  description: string;
  isPublished: boolean;
  scheduleAvailability: boolean;
  availableFrom: string;
  availableUntil: string;
}

export const emptyResourceMeta = (): ResourceMeta => ({
  title: '',
  description: '',
  isPublished: true,
  scheduleAvailability: false,
  availableFrom: '',
  availableUntil: '',
});

/** The common fields a create API receives — dates as ISO (or null). */
export interface ResourceMetaPayload {
  title: string;
  description: string;
  isPublished: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
}

const toIso = (local: string): string | null => {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Convert the form meta into a create payload (ISO dates, only when scheduled). */
export const resourceMetaToPayload = (m: ResourceMeta): ResourceMetaPayload => ({
  title: m.title.trim(),
  description: m.description.trim(),
  isPublished: m.isPublished,
  availableFrom: m.scheduleAvailability ? toIso(m.availableFrom) : null,
  availableUntil: m.scheduleAvailability ? toIso(m.availableUntil) : null,
});

/**
 * Whether the availability window is valid: when scheduling is on and both
 * ends are set, `until` must be strictly after `from`. Empty ends are allowed
 * (open-ended). The modal uses this to gate the Create button and show an
 * inline message.
 */
export const availabilityIsValid = (m: ResourceMeta): boolean => {
  if (!m.scheduleAvailability) return true;
  const from = toIso(m.availableFrom);
  const until = toIso(m.availableUntil);
  if (from && until) return new Date(until).getTime() > new Date(from).getTime();
  return true;
};

interface ResourceMetaFieldsProps {
  value: ResourceMeta;
  onChange: (next: ResourceMeta) => void;
  /** Optional label override for the title field (e.g. "Lesson title"). */
  titleLabel?: string;
  titlePlaceholder?: string;
}

/**
 * Shared, consistent block of the common resource fields: Title, Description,
 * a Visible/Draft toggle (→ `isPublished`), and an availability window that is
 * OFF by default and reveals From/Until date pickers when enabled. Embedded by
 * every add-resource modal so each one looks and behaves the same.
 */
/** `Date` → a `datetime-local`-friendly string ("2026-06-08T14:30") in local time. */
const toLocalInput = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const ResourceMetaFields = ({ value, onChange, titleLabel, titlePlaceholder }: ResourceMetaFieldsProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const set = <K extends keyof ResourceMeta>(key: K, v: ResourceMeta[K]) => onChange({ ...value, [key]: v });

  // Which preset is currently active (derived from the field values).
  const preset: 'now' | 'custom' =
    value.scheduleAvailability && !value.availableFrom ? 'now' : 'custom';
  const applyNow = () =>
    onChange({ ...value, scheduleAvailability: true, availableFrom: '', availableUntil: value.availableUntil });
  const applyFromNow = () =>
    onChange({ ...value, scheduleAvailability: true, availableFrom: toLocalInput(new Date()) });

  const datesValid = availabilityIsValid(value);

  return (
    <div className="space-y-4">
      <Input
        label={titleLabel ?? t('common:title', { defaultValue: 'Title' })}
        value={value.title}
        onChange={e => set('title', e.target.value)}
        placeholder={titlePlaceholder}
        required
        autoFocus
      />

      <TextArea
        label={t('common:description', { defaultValue: 'Description' })}
        value={value.description}
        onChange={e => set('description', e.target.value)}
        rows={2}
        placeholder={t('description_placeholder', { defaultValue: 'Add a short description (shown on the course page)…' })}
      />

      <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('visible_to_students', { defaultValue: 'Visible to students' })}
        </span>
        <Toggle
          checked={value.isPublished}
          onChange={v => set('isPublished', v)}
          onLabel={t('common:visible', { defaultValue: 'Visible' })}
          offLabel={t('common:draft', { defaultValue: 'Draft' })}
        />
      </div>

      {/* Availability window — disabled by default. */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            <CalendarClock className="w-4 h-4 text-gray-400" />
            {t('schedule_availability', { defaultValue: 'Schedule availability' })}
          </span>
          <Toggle checked={value.scheduleAvailability} onChange={v => set('scheduleAvailability', v)} />
        </div>
        {value.scheduleAvailability && (
          <>
            {/* Quick presets above the date inputs. */}
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                { key: 'now', label: t('availability_now', { defaultValue: 'Available now' }), onClick: applyNow, active: preset === 'now' },
                { key: 'course_start', label: t('availability_course_start', { defaultValue: 'From now' }), onClick: applyFromNow, active: preset === 'custom' && !!value.availableFrom },
                { key: 'custom', label: t('availability_custom', { defaultValue: 'Custom' }), onClick: applyFromNow, active: preset === 'custom' },
              ] as const).map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={p.onClick}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                    p.active
                      ? 'border-teal-400 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-500'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="datetime-local"
                label={t('available_from', { defaultValue: 'Available from' })}
                value={value.availableFrom}
                onChange={e => set('availableFrom', e.target.value)}
              />
              <Input
                type="datetime-local"
                label={t('available_until', { defaultValue: 'Available until' })}
                value={value.availableUntil}
                onChange={e => set('availableUntil', e.target.value)}
              />
            </div>
            {!datesValid && (
              <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                {t('availability_until_after_from', { defaultValue: '“Available until” must be after “Available from”.' })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
