/**
 * Every plugin `dashboard.widget`, rendered as a strip of panels.
 *
 * Drop this into any analytics view and installed plugins contribute panels to
 * it. Renders nothing at all when no plugin provides a widget, so it is safe to
 * place unconditionally — a dashboard should not grow an empty "Plugins"
 * heading on an instance that has none.
 *
 * Each widget gets its own `PluginSlot`, so its error boundary is its own: one
 * plugin's broken chart does not take the others — or the dashboard — with it.
 */

import { useTranslation } from 'react-i18next';
import { usePluginExtensions } from './usePluginExtensions';
import { PluginSlot } from './PluginSlot';

export interface PluginWidgetsProps {
  /** The course these widgets describe, or null on an instance-wide dashboard. */
  courseId?: number | null;
  /** Heading shown above the strip; omit for none. */
  title?: string;
  className?: string;
}

export const PluginWidgets = ({ courseId = null, title, className }: PluginWidgetsProps) => {
  const { t } = useTranslation(['common']);
  const widgets = usePluginExtensions('dashboard.widget');

  if (!widgets.length) return null;

  return (
    <section className={className} aria-label={t('plugin_widgets', { defaultValue: 'Plugin panels' })}>
      {title && (
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {widgets.map((widget) => (
          <div
            key={widget.key}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
          >
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {widget.label}
            </h3>
            <PluginSlot
              extensionKey={widget.key}
              // One widget instance per course (or per instance dashboard, id 0),
              // so its stored state is scoped the way a dashboard panel expects.
              instance={{ kind: 'course', id: courseId ?? 0 }}
              courseId={courseId}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export default PluginWidgets;
