/**
 * D3 renderer for the Student Activity Heatmap and Bubbles views — copied
 * from Carmdash (moodle-tna/src/sidepanel/tabs/activity-tab.ts renderVis).
 * The drawing code (cell layout, jittered per-student bubbles with a seeded
 * PRNG, dominant-state coloring, multiply blending) is verbatim; the seams
 * (container, data, colors, click callbacks) arrive as arguments and the
 * hardcoded label/empty-cell colors became themable options for dark mode.
 */
import type { ActivityGrid, GridStudent } from './activityViews';

export interface AxisFilter { col?: number; row?: number }

export interface GridRenderOptions {
  mode: 'heatmap' | 'swarm';
  timeMode: 'day_hour' | 'week_day' | 'month_day';
  colorMap: Record<string, string>;
  onClickFilter: (filter: AxisFilter, title: string, studentFill?: string) => void;
  labelColor?: string;
  axisColor?: string;
  emptyCellColor?: string;
}

export function renderActivityGrid(
  svgC: HTMLElement,
  data: ActivityGrid,
  options: GridRenderOptions,
): void {
  const { grid, maxTotalCell, maxStudent, xLen, yLen, xLabels, yLabels } = data;
  const { mode, timeMode, colorMap, onClickFilter } = options;
  const labelColor = options.labelColor ?? '#999';
  const axisColor = options.axisColor ?? '#666';
  const emptyCellColor = options.emptyCellColor ?? '#fafafa';

  svgC.innerHTML = '';

  import('d3').then(d3 => {
    // The container may have been unmounted or re-rendered while d3 loaded.
    if (!svgC.isConnected || svgC.innerHTML !== '') return;

    const W = Math.max(svgC.clientWidth || 800, 500);
    // Auto-scale height for matrix depth
    const cellSz = Math.min((W - 50) / xLen, Math.max(20, 360 / Math.max(yLen, 1)));
    const totalH = Math.max(300, yLen * cellSz + 60);

    const margin = { top: 30, right: 10, bottom: 20, left: 40 };
    const width = W - margin.left - margin.right;
    const height = totalH - margin.top - margin.bottom;

    const svg = d3.select(svgC).append('svg')
      .attr('viewBox', `0 0 ${W} ${totalH}`)
      .style('width', '100%').style('height', 'auto');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const gap = 2;
    const cellW = (width - gap * (Math.max(xLen, 1) - 1)) / Math.max(xLen, 1);
    const cellH = (height - gap * (Math.max(yLen, 1) - 1)) / Math.max(yLen, 1);

    for (let h = 0; h < xLen; h++) {
      if (timeMode === 'day_hour' && cellW < 14 && h % 2 !== 0) continue;
      if (timeMode === 'month_day' && cellW < 14 && h % 2 !== 0) continue;
      const txt = g.append('text').attr('x', h * (cellW + gap) + cellW / 2).attr('y', -8)
        .attr('text-anchor', 'middle').attr('font-size', '9').attr('fill', labelColor).text(xLabels[h]);
      txt.style('cursor', 'pointer').on('click', () => onClickFilter({ col: h }, `${xLabels[h]} Total`));
      txt.append('title').text('Click for details');
    }
    yLabels.forEach((d, i) => {
      const txt = g.append('text').attr('x', -8).attr('y', i * (cellH + gap) + cellH / 2 + 3)
        .attr('text-anchor', 'end').attr('font-size', '9').attr('fill', axisColor).text(d);
      txt.style('cursor', 'pointer').on('click', () => onClickFilter({ row: i }, `${d} Total`));
      txt.append('title').text('Click for details');
    });

    for (let dy = 0; dy < yLen; dy++) {
      for (let dx = 0; dx < xLen; dx++) {
        const x = dx * (cellW + gap);
        const y = dy * (cellH + gap);
        const students: GridStudent[] = grid[dy][dx];
        const total = students.reduce((sum, s) => sum + s.count, 0);
        const cellTitleText = `${yLabels[dy]} × ${xLabels[dx]}`;

        if (total === 0) {
          g.append('rect').attr('x', x).attr('y', y).attr('width', cellW).attr('height', cellH)
            .attr('fill', emptyCellColor).attr('rx', 2);
          continue;
        }

        const cellStates: Record<string, number> = {};
        for (const s of students) for (const [st, c] of Object.entries(s.states)) { cellStates[st] = (cellStates[st] ?? 0) + c; }
        let dom = '', domC = 0;
        for (const [st, c] of Object.entries(cellStates)) { if (c > domC) { dom = st; domC = c; } }
        const color = colorMap[dom] ?? '#888';

        if (mode === 'heatmap') {
          const intensity = 0.3 + 0.7 * (total / maxTotalCell);
          g.append('rect').attr('x', x).attr('y', y).attr('width', cellW).attr('height', cellH)
            .attr('fill', color).attr('opacity', intensity).attr('rx', 2)
            .style('cursor', 'pointer')
            .on('click', () => onClickFilter({ row: dy, col: dx }, cellTitleText))
            .append('title').text(cellTitleText + `\n${total} events\n${dom}`);

          if (cellW > 16 && cellH > 14) {
            const bright = d3.hsl(color);
            const textColor = (intensity > 0.55 && bright.l < 0.65) ? '#fff' : '#333';
            g.append('text')
              .attr('x', x + cellW / 2).attr('y', y + cellH / 2 + 3)
              .attr('text-anchor', 'middle')
              .attr('font-size', '9')
              .attr('font-weight', '600').attr('fill', textColor)
              .attr('opacity', 0.9).style('pointer-events', 'none')
              .text(String(total));
          }
        } else {
          g.append('rect').attr('x', x).attr('y', y).attr('width', cellW).attr('height', cellH)
            .attr('fill', 'transparent')
            .style('cursor', 'pointer')
            .on('click', () => onClickFilter({ row: dy, col: dx }, cellTitleText));

          let jSeed = 42 + dy * 100 + dx;
          const sorted = [...students].sort((a, b) => b.count - a.count);
          for (const s of sorted) {
            let sDom = '', sDomC = 0;
            for (const [st, c] of Object.entries(s.states)) { if (c > sDomC) { sDom = st; sDomC = c; } }
            const sColor = colorMap[sDom] ?? '#888';

            jSeed = (jSeed * 16807) % 2147483647;
            const jx = ((jSeed / 2147483647) - 0.5) * cellW * 0.7;
            jSeed = (jSeed * 16807) % 2147483647;
            const jy = ((jSeed / 2147483647) - 0.5) * cellH * 0.7;

            const r = 2 + (s.count / maxStudent) * Math.min(cellW, cellH) * 0.45;

            const circ = g.append('circle')
              .attr('cx', x + cellW / 2 + jx).attr('cy', y + cellH / 2 + jy)
              .attr('r', r)
              .attr('fill', sColor)
              .attr('opacity', 0.35)
              .attr('stroke', '#fff').attr('stroke-width', 0.5).attr('stroke-opacity', 0.4)
              .style('cursor', 'pointer')
              .style('mix-blend-mode', 'multiply');

            circ.on('click', (e: MouseEvent) => {
              e.stopPropagation();
              onClickFilter({ row: dy, col: dx }, `${s.student}: ${cellTitleText}`, s.student);
            });

            circ.append('title').text(`${s.student}\n${s.count} events\n${sDom}`);
          }
        }
      }
    }
  });
}
