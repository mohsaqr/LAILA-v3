// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { drawSimplicialOverlay } from './simplicialOverlay.js';

describe('drawSimplicialOverlay', () => {
  it('renders one isolated simplex blob into the host element', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const pathway = {
      parts: ['learning', 'assessment', 'help'],
      ids: ['learning', 'assessment', 'help'],
      count: 12,
      order: 3,
      hypa: { anomaly: 'over', pAdjustedOver: 0.01, pAdjustedUnder: 0.99 },
    };

    drawSimplicialOverlay(host, [pathway], { baseStates: [], colorBy: 'anomaly', height: 340 });

    const svg = host.querySelector('svg');
    expect(svg).not.toBeNull();
    // A blob path plus one node circle per state
    expect(host.querySelectorAll('circle').length).toBeGreaterThanOrEqual(3);
    expect(host.querySelectorAll('path').length).toBeGreaterThanOrEqual(1);
    expect(host.textContent).toContain('learning');
  });
});
