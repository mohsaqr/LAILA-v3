import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CentralityResult, CentralityMeasure } from 'tnaj';

const DISPLAY_MEASURES: { key: CentralityMeasure; i18nKey: string }[] = [
  { key: 'OutStrength', i18nKey: 'out_strength' },
  { key: 'InStrength', i18nKey: 'in_strength' },
  { key: 'Betweenness', i18nKey: 'betweenness' },
  { key: 'Closeness', i18nKey: 'closeness' },
  { key: 'Clustering', i18nKey: 'clustering_coeff' },
];

interface TnaCentralityTableProps {
  centralityData: CentralityResult;
  colorMap: Record<string, string>;
}

export const TnaCentralityTable = ({ centralityData, colorMap }: TnaCentralityTableProps) => {
  const { t } = useTranslation(['admin']);
  const [sortBy, setSortBy] = useState<CentralityMeasure>('OutStrength');
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo(() => {
    const { labels, measures } = centralityData;
    return labels.map((label, i) => {
      const values: Record<CentralityMeasure, number> = {} as Record<CentralityMeasure, number>;
      for (const { key } of DISPLAY_MEASURES) {
        values[key] = measures[key]?.[i] ?? 0;
      }
      return { label, values };
    });
  }, [centralityData]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const diff = a.values[sortBy] - b.values[sortBy];
      return sortAsc ? diff : -diff;
    });
  }, [rows, sortBy, sortAsc]);

  const handleSort = (measure: CentralityMeasure) => {
    if (sortBy === measure) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(measure);
      setSortAsc(false);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-300">
              {t('verb')}
            </th>
            {DISPLAY_MEASURES.map(({ key, i18nKey }) => (
              <th
                key={key}
                className="text-right py-2 px-3 font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white select-none"
                onClick={() => handleSort(key)}
              >
                {t(i18nKey)}
                {sortBy === key && (
                  <span className="ml-1">{sortAsc ? '\u25B2' : '\u25BC'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ label, values }) => (
            <tr
              key={label}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <td className="py-1.5 px-3 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colorMap[label] ?? '#888' }}
                />
                {label}
              </td>
              {DISPLAY_MEASURES.map(({ key }) => (
                <td key={key} className="text-right py-1.5 px-3 tabular-nums text-gray-600 dark:text-gray-400">
                  {values[key].toFixed(3)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
