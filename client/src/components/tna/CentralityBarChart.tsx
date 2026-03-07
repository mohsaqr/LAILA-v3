import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface CentralityData {
  labels: string[];
  measures: Record<string, number[]>;
}

interface CentralityBarChartProps {
  centralityData: CentralityData;
  colorMap: Record<string, string>;
}

const MEASURE_COLORS: Record<string, string> = {
  InStrength: 'rgba(74, 144, 217, 0.8)',
};

const MEASURE_I18N: Record<string, string> = {
  InStrength: 'in_strength',
};

export const CentralityBarChart = ({ centralityData, colorMap }: CentralityBarChartProps) => {
  const { t } = useTranslation(['admin']);
  const { labels, measures } = centralityData;
  const measureKeys = Object.keys(measures).filter(k => measures[k]?.length > 0);
  const [activeMeasure, setActiveMeasure] = useState(measureKeys[0] ?? 'InStrength');

  const values = measures[activeMeasure] ?? [];
  const maxVal = useMemo(() => Math.max(...values, 1e-6), [values]);

  const barHeight = 26;
  const gap = 5;
  const margin = { top: 10, right: 55, bottom: 10, left: 100 };
  const svgWidth = 600;
  const plotW = svgWidth - margin.left - margin.right;
  const svgHeight = margin.top + margin.bottom + labels.length * (barHeight + gap);

  return (
    <div>
      {/* Measure tabs */}
      <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs mb-3 w-fit">
        {measureKeys.map(key => (
          <button key={key}
            onClick={() => setActiveMeasure(key)}
            className={`px-3 py-1 transition-colors ${activeMeasure === key
              ? 'bg-primary-600 text-white'
              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
            {t(MEASURE_I18N[key] ?? key)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} className="mx-auto">
          <g transform={`translate(${margin.left},${margin.top})`}>
            {labels.map((label, li) => {
              const val = values[li] ?? 0;
              const barW = (val / maxVal) * plotW;
              const y = li * (barHeight + gap);
              return (
                <g key={label}>
                  {/* Color dot */}
                  <circle cx={-margin.left + 12} cy={y + barHeight / 2} r={4}
                    fill={colorMap[label] ?? '#888'} />
                  {/* Label */}
                  <text x={-8} y={y + barHeight / 2 + 4} textAnchor="end"
                    className="fill-gray-700 dark:fill-gray-300" fontSize={11}>
                    {label.length > 12 ? label.slice(0, 11) + '\u2026' : label}
                  </text>
                  {/* Bar */}
                  <rect x={0} y={y} width={Math.max(barW, 1)} height={barHeight}
                    fill={MEASURE_COLORS[activeMeasure] ?? '#888'} rx={3}>
                    <title>{`${label}: ${val.toFixed(4)}`}</title>
                  </rect>
                  {/* Value label */}
                  <text x={Math.max(barW, 1) + 4} y={y + barHeight / 2 + 4}
                    className="fill-gray-500 dark:fill-gray-400" fontSize={10} textAnchor="start">
                    {val.toFixed(3)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};
