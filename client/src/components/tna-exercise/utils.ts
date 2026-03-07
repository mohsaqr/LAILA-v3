import type { CentralityResult } from 'dynajs';

/** Convert dynajs CentralityResult (Float64Array measures) to component-compatible format (number[] measures). */
export function toCentralityData(raw: CentralityResult): { labels: string[]; measures: Record<string, number[]> } {
  const measures: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(raw.measures)) {
    measures[k] = Array.from(v);
  }
  return { labels: raw.labels, measures };
}
