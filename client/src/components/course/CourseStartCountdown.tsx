import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CourseStartCountdownProps {
  /** ISO start time of the course. */
  startTime: string;
  /** Fired once the start time is reached (so the page can reveal content). */
  onElapsed?: () => void;
}

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const computeRemaining = (target: number): Remaining => {
  const total = Math.max(0, target - Date.now());
  const seconds = Math.floor(total / 1000) % 60;
  const minutes = Math.floor(total / (1000 * 60)) % 60;
  const hours = Math.floor(total / (1000 * 60 * 60)) % 24;
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  return { days, hours, minutes, seconds, total };
};

/**
 * Shown on the course page in place of the curriculum when a course hasn't
 * started yet: a minimal "content unlocks soon" card with a live countdown.
 */
export const CourseStartCountdown = ({ startTime, onElapsed }: CourseStartCountdownProps) => {
  const { t, i18n } = useTranslation(['courses', 'common']);
  const target = new Date(startTime).getTime();
  const [remaining, setRemaining] = useState<Remaining>(() => computeRemaining(target));

  useEffect(() => {
    if (remaining.total <= 0) {
      onElapsed?.();
      return;
    }
    const id = setInterval(() => {
      const next = computeRemaining(target);
      setRemaining(next);
      if (next.total <= 0) {
        clearInterval(id);
        onElapsed?.();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const units = [
    { value: remaining.days, label: t('countdown_days', { defaultValue: 'Days' }) },
    { value: remaining.hours, label: t('countdown_hours', { defaultValue: 'Hours' }) },
    { value: remaining.minutes, label: t('countdown_minutes', { defaultValue: 'Minutes' }) },
    { value: remaining.seconds, label: t('countdown_seconds', { defaultValue: 'Seconds' }) },
  ];

  const startLabel = new Date(startTime).toLocaleString(i18n.language, {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    <div className="flex flex-col items-center text-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-12 sm:py-16">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
        {t('course_not_started_title', { defaultValue: 'This course hasn’t started yet' })}
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        {t('course_not_started_desc', { defaultValue: 'The content unlocks when the course begins.' })}
      </p>

      {/* Dark, minimal countdown bar */}
      <div className="mt-8 inline-flex items-stretch gap-0 rounded-2xl bg-gray-900 px-4 py-5 sm:px-6 sm:py-6">
        {units.map((u, i) => (
          <div key={u.label} className="flex items-stretch">
            {i > 0 && <span className="w-px self-stretch bg-white/15 mx-3 sm:mx-5" />}
            <div className="flex flex-col items-center min-w-[58px] sm:min-w-[76px]">
              <span className="text-3xl sm:text-4xl font-bold tabular-nums text-white leading-none">
                {String(u.value).padStart(2, '0')}
              </span>
              <span className="mt-2 text-[11px] sm:text-xs font-medium text-gray-400">
                {u.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        {t('starts_on', { defaultValue: 'Starts on' })} <span className="font-medium text-gray-700 dark:text-gray-200">{startLabel}</span>
      </p>
    </div>
  );
};
