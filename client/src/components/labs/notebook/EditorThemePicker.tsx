import { useTranslation } from 'react-i18next';
import { Palette } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import { useEditorTheme } from '../../../hooks/useEditorTheme';
import { LAB_THEMES, resolveTheme } from '../authoring/labEditorThemes';

/**
 * Editor theme picker for the notebook toolbar.
 *
 * A native `<select>` on purpose: it is keyboard and screen-reader correct for
 * free, opens as a real menu on touch, and inherits RTL — none of which the
 * app's custom RowMenu gives without extra work, for a control that is just a
 * one-of-N choice.
 */
export const EditorThemePicker = () => {
  const { t } = useTranslation(['courses']);
  const { isDark } = useTheme();
  const [stored, setStored] = useEditorTheme();

  const active = resolveTheme(stored, isDark);
  const label = t('courses:editor_theme', { defaultValue: 'Editor theme' });

  return (
    <label
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-medium"
      title={label}
    >
      <Palette className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <select
        value={active.id}
        onChange={e => setStored(e.target.value)}
        className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
      >
        {(['light', 'dark'] as const).map(appearance => (
          <optgroup
            key={appearance}
            label={
              appearance === 'light'
                ? t('courses:editor_theme_light', { defaultValue: 'Light' })
                : t('courses:editor_theme_dark', { defaultValue: 'Dark' })
            }
          >
            {LAB_THEMES.filter(th => th.appearance === appearance).map(th => (
              <option key={th.id} value={th.id} className="text-gray-900">
                {th.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
};
