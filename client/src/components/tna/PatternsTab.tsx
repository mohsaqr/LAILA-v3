import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { discoverPatterns } from 'dynajs';
import { contextTree, plotTree, commonPathways, buildHypa } from 'tnaj';
import { Loading } from '../common/Loading';
import { PatternTable } from './PatternTable';
import { drawSimplicialOverlay } from './simplicialOverlay.js';
import { tweakTreeSvg } from '../../utils/treeSvgTweaks';

interface PatternsTabProps {
  sequences: string[][];
  colorMap: Record<string, string>;
  shortEnabled: Record<number, boolean>;
  onShortEnabledChange: (v: Record<number, boolean>) => void;
  longEnabled: Record<number, boolean>;
  onLongEnabledChange: (v: Record<number, boolean>) => void;
}

/** De Bruijn orders pooled for the simplicial view: k = 2,3,4 → paths of 3–5 states */
const SIM_ORDERS = [2, 3, 4];

interface HypaScore {
  path: string;
  observed: number;
  anomaly: string;
  pAdjustedUnder: number;
  pAdjustedOver: number;
}

interface TreeResult {
  svg: string;
  pathways: Array<{ pathway: string; count: number; likelyNext?: string | null; nextProbability?: number | null }>;
}

const SHORT_LENGTHS = [2, 3];
const LONG_LENGTHS = [4, 5, 6, 7];

/** Cap sequences to avoid freezing the browser; sample evenly when too large */
const MAX_SEQS = 1000;
function capSequences(seqs: string[][]): string[][] {
  if (seqs.length <= MAX_SEQS) return seqs;
  const step = seqs.length / MAX_SEQS;
  const sampled: string[][] = [];
  for (let i = 0; i < MAX_SEQS; i++) sampled.push(seqs[Math.floor(i * step)]);
  return sampled;
}

/** Scale minSupport so larger datasets still find patterns */
function adaptiveSupport(n: number): number {
  if (n <= 100) return 0.01;
  return Math.max(0.001, 2 / n);  // at least 2 occurrences
}

export const PatternsTab = ({ sequences, colorMap, shortEnabled, onShortEnabledChange: setShortEnabled, longEnabled, onLongEnabledChange: setLongEnabled }: PatternsTabProps) => {
  const { t } = useTranslation(['admin']);

  const [result, setResult] = useState<{ short: any[]; long: any[]; tree: TreeResult; hypa: HypaScore[] } | null>(null);
  const computeIdRef = useRef(0);

  useEffect(() => {
    if (!sequences?.length) { setResult({ short: [], long: [], tree: { svg: '', pathways: [] }, hypa: [] }); return; }
    const id = ++computeIdRef.current;
    setResult(null); // null = computing
    const timer = setTimeout(() => {
      if (id !== computeIdRef.current) return;

      const capped = capSequences(sequences);
      const minSupport = adaptiveSupport(capped.length);
      let sp: any[] = [];
      let lp: any[] = [];

      const shortLens = SHORT_LENGTHS.filter(l => shortEnabled[l]);
      if (shortLens.length > 0) {
        try { sp = discoverPatterns(capped, { len: shortLens, minSupport, minFreq: 1 }).patterns; } catch { /* ignore */ }
      }

      const longLens = LONG_LENGTHS.filter(l => longEnabled[l]);
      if (longLens.length > 0) {
        try { lp = discoverPatterns(capped, { len: longLens, minSupport, minFreq: 1 }).patterns; } catch { /* ignore */ }
      }

      // Most-frequency tree: variable-order context tree + horizontal SVG.
      let tree: TreeResult = { svg: '', pathways: [] };
      try {
        const ct = contextTree(capped, { maxDepth: 3, minCount: 2 });
        tree = {
          svg: tweakTreeSvg(plotTree(ct, { style: 'horizontal', maxNodes: 40 })),
          pathways: commonPathways(ct, { top: 15 }) as TreeResult['pathways'],
        };
      } catch { /* not enough data for a tree */ }

      // Disentangled simplicial: HYPA anomaly scores pooled over orders 3–5,
      // taking the most anomalous few from EACH order so the range is
      // represented, not just the order that dominates the global rank.
      const hypa: HypaScore[] = [];
      const byPadj = (a: HypaScore, b: HypaScore) =>
        Math.min(a.pAdjustedUnder, a.pAdjustedOver) - Math.min(b.pAdjustedUnder, b.pAdjustedOver);
      for (const k of SIM_ORDERS) {
        try {
          const r = buildHypa(capped, { k, alpha: 0.05, minCount: 1, pAdjustMethod: 'BH' });
          hypa.push(...(r.scores as HypaScore[]).slice().sort(byPadj).slice(0, 4));
        } catch { /* order too high for this data */ }
      }

      if (id === computeIdRef.current) {
        setResult({ short: sp, long: lp, tree, hypa });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [sequences, shortEnabled, longEnabled]);

  /* Draw the simplicial small multiples into the host div after render */
  const simRef = useRef<HTMLDivElement>(null);
  const hypaScores = result?.hypa ?? [];
  useEffect(() => {
    const host = simRef.current;
    if (!host) return;
    host.innerHTML = '';
    if (!hypaScores.length) return;
    try {
      host.style.display = 'grid';
      // min(300px,100%) so the track collapses on narrow screens instead of
      // pushing the dashboard past the viewport (a bare 300px is a hard floor).
      host.style.gridTemplateColumns = 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))';
      host.style.gap = '10px';
      for (const r of hypaScores) {
        const parts = r.path.split(' -> ');
        const pw = { parts, ids: parts.slice(), count: r.observed, order: parts.length, hypa: r };
        const cell = document.createElement('div');
        // Always-white cell: the overlay renderer assumes the notebook's light
        // background, so keep it light in dark mode too rather than restyle it.
        cell.className = 'border border-gray-200 dark:border-gray-600 rounded-lg p-1 bg-white';
        host.appendChild(cell);
        // baseStates:[] → lay out only this pathway's states, isolating each
        // simplex (disentangled), instead of one tangled full-circle overlay.
        drawSimplicialOverlay(cell, [pw], { baseStates: [], colorBy: 'anomaly', height: 340 });
      }
    } catch { /* keep the tab alive if the overlay throws */ }
  }, [hypaScores]);

  if (!result) {
    return <div className="py-16"><Loading text={t('computing_patterns')} /></div>;
  }

  const shortPatterns = result.short;
  const longPatterns = result.long;
  const total = shortPatterns.length + longPatterns.length;

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
        <span className="font-semibold text-gray-800 dark:text-gray-200">{total}</span>{' '}
        {t('patterns_found')}
      </div>

      {/* Most-frequency tree — variable-order prediction suffix tree + likely-next table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
            {t('frequency_tree_title')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('frequency_tree_hint')} · {result.tree.pathways.length} {t('tree_pathways')}
          </p>
        </div>
        {result.tree.svg ? (
          <div className="overflow-x-auto tna-tree-svg" dangerouslySetInnerHTML={{ __html: result.tree.svg }} />
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">{t('no_data')}</div>
        )}
        {result.tree.pathways.length > 0 && (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('tree_pathway')}</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('tree_count')}</th>
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('tree_likely_next')}</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('tree_next_probability')}</th>
                </tr>
              </thead>
              <tbody>
                {result.tree.pathways.map((p, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{p.pathway}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{p.count}</td>
                    <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{p.likelyNext ?? '—'}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {typeof p.nextProbability === 'number' ? p.nextProbability.toFixed(2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      {/* Disentangled simplicial — HYPA-anomalous pathways as isolated simplices */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mt-6">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
            {t('simplicial_title')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('simplicial_hint')} · {hypaScores.filter(s => s.anomaly === 'over').length} {t('simplicial_over')} · {hypaScores.filter(s => s.anomaly === 'under').length} {t('simplicial_under')}
          </p>
        </div>
        {hypaScores.length > 0 ? (
          <div ref={simRef} />
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">{t('no_data')}</div>
        )}
      </div>
    </div>
  );
};
