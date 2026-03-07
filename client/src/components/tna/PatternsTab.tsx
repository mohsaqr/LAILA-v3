import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { discoverPatterns } from 'dynajs';
import { PatternTable } from './PatternTable';

interface PatternsTabProps {
  sequences: string[][];
  colorMap: Record<string, string>;
  shortEnabled: Record<number, boolean>;
  onShortEnabledChange: (v: Record<number, boolean>) => void;
  longEnabled: Record<number, boolean>;
  onLongEnabledChange: (v: Record<number, boolean>) => void;
}

const SHORT_LENGTHS = [2, 3];
const LONG_LENGTHS = [4, 5, 6, 7];

export const PatternsTab = ({ sequences, colorMap, shortEnabled, onShortEnabledChange: setShortEnabled, longEnabled, onLongEnabledChange: setLongEnabled }: PatternsTabProps) => {
  const { t } = useTranslation(['admin']);

  const shortPatterns = useMemo(() => {
    const lens = SHORT_LENGTHS.filter(l => shortEnabled[l]);
    if (!sequences?.length || lens.length === 0) return [];
    try {
      return discoverPatterns(sequences, { len: lens }).patterns;
    } catch { return []; }
  }, [sequences, shortEnabled]);

  const longPatterns = useMemo(() => {
    const lens = LONG_LENGTHS.filter(l => longEnabled[l]);
    if (!sequences?.length || lens.length === 0) return [];
    try {
      return discoverPatterns(sequences, { len: lens }).patterns;
    } catch { return []; }
  }, [sequences, longEnabled]);

  const total = shortPatterns.length + longPatterns.length;

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
        <span className="font-semibold text-gray-800 dark:text-gray-200">{total}</span>{' '}
        {t('patterns_found')}
      </div>

      {/* Two cards side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Short patterns */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                {t('pattern_lengths')} 2–3
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {shortPatterns.length} {t('patterns_found')}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {SHORT_LENGTHS.map(len => (
                <button key={len}
                  onClick={() => setShortEnabled({ ...shortEnabled, [len]: !shortEnabled[len] })}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                    shortEnabled[len]
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}>
                  {len}
                </button>
              ))}
            </div>
          </div>
          {shortPatterns.length > 0 ? (
            <PatternTable patterns={shortPatterns} colorMap={colorMap} />
          ) : (
            <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">{t('no_data')}</div>
          )}
        </div>

        {/* Long patterns */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                {t('pattern_lengths')} 4–7
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {longPatterns.length} {t('patterns_found')}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {LONG_LENGTHS.map(len => (
                <button key={len}
                  onClick={() => setLongEnabled({ ...longEnabled, [len]: !longEnabled[len] })}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                    longEnabled[len]
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}>
                  {len}
                </button>
              ))}
            </div>
          </div>
          {longPatterns.length > 0 ? (
            <PatternTable patterns={longPatterns} colorMap={colorMap} />
          ) : (
            <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">{t('no_data')}</div>
          )}
        </div>
      </div>
    </div>
  );
};
