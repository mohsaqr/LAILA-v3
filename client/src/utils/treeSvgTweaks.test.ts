import { describe, it, expect } from 'vitest';
import { contextTree, plotTree } from 'tnaj';
import { tweakTreeSvg } from './treeSvgTweaks';

const STATES = ['learning', 'assessment', 'help', 'browsing'];
const seqs = Array.from({ length: 40 }, (_, i) =>
  Array.from({ length: 10 }, (_, j) => STATES[(i * 3 + j * j) % STATES.length]),
);

describe('tweakTreeSvg', () => {
  it('rewrites real plotTree output: proportional radii, opacity, centered labels', () => {
    const svg = plotTree(contextTree(seqs, { maxDepth: 3, minCount: 2 }), {
      style: 'horizontal',
      maxNodes: 40,
    });
    const tweaked = tweakTreeSvg(svg);

    expect(tweaked).not.toBe(svg);
    expect(tweaked).toContain('fill-opacity=');
    expect(tweaked).toContain('text-anchor="middle"');
    // Radii are recomputed into the 3–15 px proportional range
    const radii = [...tweaked.matchAll(/r="([\d.]+)"/g)].map(m => parseFloat(m[1]));
    expect(radii.length).toBeGreaterThan(0);
    expect(Math.max(...radii)).toBeLessThanOrEqual(15);
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(3);
  });

  it('returns non-string / empty input unchanged', () => {
    expect(tweakTreeSvg('')).toBe('');
    expect(tweakTreeSvg(undefined as unknown as string)).toBe(undefined);
  });
});
