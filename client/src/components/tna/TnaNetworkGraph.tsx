import { useMemo } from 'react';
import type { TNA } from 'tnaj';

const NODE_COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f',
];

const EDGE_COLOR = '#4a7fba';
const ARROW_COLOR = '#3a6a9f';
const ARROW_SIZE = 10;
const EDGE_WIDTH_MIN = 0.6;
const EDGE_WIDTH_MAX = 2.8;
const EDGE_OPACITY_MIN = 0.2;
const EDGE_OPACITY_MAX = 0.55;
const EDGE_LABEL_COLOR = '#555566';
const EDGE_CURVATURE = 22;

interface TnaNetworkGraphProps {
  model: TNA;
  showSelfLoops?: boolean;
  showEdgeLabels?: boolean;
  nodeRadius?: number;
  height?: number;
}

function arrowPoly(
  tipX: number, tipY: number, dx: number, dy: number, arrowSize: number,
): string {
  const halfW = arrowSize / 2;
  const baseX = tipX - dx * arrowSize;
  const baseY = tipY - dy * arrowSize;
  const lx = baseX - dy * halfW;
  const ly = baseY + dx * halfW;
  const rx = baseX + dy * halfW;
  const ry = baseY - dx * halfW;
  return `${tipX},${tipY} ${lx},${ly} ${rx},${ry}`;
}

function computeEdgePath(
  sx: number, sy: number, tx: number, ty: number,
  curvature: number, nodeRadius: number,
) {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const mx = (sx + tx) / 2 + px * curvature;
  const my = (sy + ty) / 2 + py * curvature;

  const sdx = mx - sx;
  const sdy = my - sy;
  const slen = Math.sqrt(sdx * sdx + sdy * sdy);
  const startX = sx + (sdx / slen) * nodeRadius;
  const startY = sy + (sdy / slen) * nodeRadius;

  const edx = tx - mx;
  const edy = ty - my;
  const elen = Math.sqrt(edx * edx + edy * edy);
  const eux = edx / elen;
  const euy = edy / elen;

  const tipX = tx - eux * nodeRadius;
  const tipY = ty - euy * nodeRadius;
  const endX = tx - eux * (nodeRadius + 8);
  const endY = ty - euy * (nodeRadius + 8);

  const t = 0.55;
  const labelX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * mx + t * t * endX;
  const labelY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * my + t * t * endY;

  return {
    path: `M${startX},${startY} Q${mx},${my} ${endX},${endY}`,
    tipX, tipY, tipDx: eux, tipDy: euy, labelX, labelY,
  };
}

function computeSelfLoop(
  nodeX: number, nodeY: number, centroidX: number, centroidY: number,
  nodeRadius: number,
) {
  const loopR = nodeRadius * 0.55;

  let dirX = nodeX - centroidX;
  let dirY = nodeY - centroidY;
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
  dirX /= dirLen;
  dirY /= dirLen;

  const loopCX = nodeX + dirX * (nodeRadius + loopR);
  const loopCY = nodeY + dirY * (nodeRadius + loopR);

  const toNodeAngle = Math.atan2(nodeY - loopCY, nodeX - loopCX);
  const gapHalf = 0.4;
  const startAngle = toNodeAngle + gapHalf;
  const endAngle = toNodeAngle - gapHalf + 2 * Math.PI;

  const sx = loopCX + loopR * Math.cos(startAngle);
  const sy = loopCY + loopR * Math.sin(startAngle);
  const ex = loopCX + loopR * Math.cos(endAngle);
  const ey = loopCY + loopR * Math.sin(endAngle);

  const adx = nodeX - ex;
  const ady = nodeY - ey;
  const al = Math.sqrt(adx * adx + ady * ady) || 1;

  const labelX = loopCX + dirX * (loopR + 6);
  const labelY = loopCY + dirY * (loopR + 6);

  return {
    path: `M${sx},${sy} A${loopR},${loopR} 0 1,0 ${ex},${ey}`,
    arrowTipX: ex, arrowTipY: ey,
    arrowDx: adx / al, arrowDy: ady / al,
    labelX, labelY,
  };
}

function donutArc(rimRadius: number, frac: number): string {
  if (frac <= 0) return '';
  if (frac >= 0.9999) {
    return [
      `M 0 ${-rimRadius}`,
      `A ${rimRadius} ${rimRadius} 0 1 1 0 ${rimRadius}`,
      `A ${rimRadius} ${rimRadius} 0 1 1 0 ${-rimRadius}`,
    ].join(' ');
  }
  const angle = frac * 2 * Math.PI;
  const startX = 0;
  const startY = -rimRadius;
  const endX = rimRadius * Math.sin(angle);
  const endY = -rimRadius * Math.cos(angle);
  const largeArc = angle > Math.PI ? 1 : 0;
  return `M ${startX} ${startY} A ${rimRadius} ${rimRadius} 0 ${largeArc} 1 ${endX} ${endY}`;
}

export const TnaNetworkGraph = ({
  model,
  showSelfLoops = true,
  showEdgeLabels = false,
  nodeRadius = 35,
  height = 500,
}: TnaNetworkGraphProps) => {
  const { labels, weights, inits } = model;

  const svgW = 960;
  const svgH = height;
  const cx = svgW / 2;
  const cy = svgH / 2;
  const padding = nodeRadius + 45;
  const layoutRadius = Math.min(cx, cy) - padding;

  const colors = useMemo(
    () => labels.map((_, i) => NODE_COLORS[i % NODE_COLORS.length]),
    [labels],
  );

  const nodePositions = useMemo(() => {
    return labels.map((_, i) => {
      const angle = (2 * Math.PI * i) / labels.length - Math.PI / 2;
      return {
        x: cx + layoutRadius * Math.cos(angle),
        y: cy + layoutRadius * Math.sin(angle),
      };
    });
  }, [labels, cx, cy, layoutRadius]);

  const { edges, bidir } = useMemo(() => {
    const result: { from: number; to: number; weight: number }[] = [];
    for (let i = 0; i < labels.length; i++) {
      for (let j = 0; j < labels.length; j++) {
        if (i === j) continue;
        const w = weights.get(i, j);
        if (w > 0) result.push({ from: i, to: j, weight: w });
      }
    }

    const bidirSet = new Set<string>();
    for (const e of result) {
      if (result.find(r => r.from === e.to && r.to === e.from)) {
        bidirSet.add(`${e.from}-${e.to}`);
      }
    }

    return { edges: result, bidir: bidirSet };
  }, [labels, weights]);

  const selfLoops = useMemo(() => {
    if (!showSelfLoops) return [];
    const loops: { idx: number; weight: number }[] = [];
    for (let i = 0; i < labels.length; i++) {
      const w = weights.get(i, i);
      if (w > 0) loops.push({ idx: i, weight: w });
    }
    return loops;
  }, [labels, weights, showSelfLoops]);

  const globalMaxW = useMemo(() => {
    const allW = [...edges.map(e => e.weight), ...selfLoops.map(s => s.weight)];
    return Math.max(...allW, 1e-6);
  }, [edges, selfLoops]);

  const widthScale = (w: number) =>
    EDGE_WIDTH_MIN + (w / globalMaxW) * (EDGE_WIDTH_MAX - EDGE_WIDTH_MIN);
  const opacityScale = (w: number) =>
    EDGE_OPACITY_MIN + (w / globalMaxW) * (EDGE_OPACITY_MAX - EDGE_OPACITY_MIN);

  const rimWidth = nodeRadius * 0.18;
  const rimRadius = nodeRadius + rimWidth * 0.7;

  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`}>
        {/* Self-loops */}
        {selfLoops.map(({ idx, weight }) => {
          const pos = nodePositions[idx];
          const loop = computeSelfLoop(pos.x, pos.y, cx, cy, nodeRadius);
          const op = Math.min(opacityScale(weight) + 0.15, 1);
          const sw = Math.max(widthScale(weight), 1.2);
          return (
            <g key={`self-${idx}`}>
              <path
                d={loop.path}
                fill="none"
                stroke={EDGE_COLOR}
                strokeWidth={sw}
                strokeOpacity={op}
                strokeLinecap="round"
              >
                <title>{`${labels[idx]} → ${labels[idx]}: ${weight.toFixed(3)}`}</title>
              </path>
              <polygon
                points={arrowPoly(loop.arrowTipX, loop.arrowTipY, loop.arrowDx, loop.arrowDy, ARROW_SIZE)}
                fill={ARROW_COLOR}
                opacity={op}
              />
              {showEdgeLabels && (
                <text
                  x={loop.labelX}
                  y={loop.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={7}
                  fill={EDGE_LABEL_COLOR}
                  pointerEvents="none"
                >
                  {weight.toFixed(2).replace(/^0\./, '.')}
                </text>
              )}
            </g>
          );
        })}

        {/* Edges */}
        {edges.map(({ from, to, weight }) => {
          const p1 = nodePositions[from];
          const p2 = nodePositions[to];
          const isBidir = bidir.has(`${from}-${to}`);
          const curvature = isBidir ? EDGE_CURVATURE : 0;

          const result = computeEdgePath(p1.x, p1.y, p2.x, p2.y, curvature, nodeRadius);
          if (!result) return null;

          const op = opacityScale(weight);

          return (
            <g key={`${from}-${to}`}>
              <path
                d={result.path}
                fill="none"
                stroke={EDGE_COLOR}
                strokeWidth={widthScale(weight)}
                strokeOpacity={op}
                strokeLinecap="round"
              >
                <title>{`${labels[from]} → ${labels[to]}: ${weight.toFixed(3)}`}</title>
              </path>
              <polygon
                points={arrowPoly(result.tipX, result.tipY, result.tipDx, result.tipDy, ARROW_SIZE)}
                fill={ARROW_COLOR}
                opacity={Math.min(op + 0.15, 1)}
              />
              {showEdgeLabels && (
                <text
                  x={result.labelX}
                  y={result.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={7}
                  fill={EDGE_LABEL_COLOR}
                  pointerEvents="none"
                >
                  {weight.toFixed(2).replace(/^0\./, '.')}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {labels.map((label, i) => {
          const pos = nodePositions[i];
          const color = colors[i]!;
          const initFrac = inits[i] ?? 0;

          return (
            <g key={label} transform={`translate(${pos.x},${pos.y})`}>
              <circle
                r={rimRadius}
                fill="none"
                stroke="#e0e0e0"
                strokeWidth={rimWidth}
              />
              {initFrac > 0 && (
                <path
                  d={donutArc(rimRadius, initFrac)}
                  fill="none"
                  stroke={color}
                  strokeWidth={rimWidth}
                  strokeLinecap="butt"
                />
              )}
              <circle
                r={nodeRadius}
                fill={color}
                stroke="#ffffff"
                strokeWidth={2.5}
                opacity={0.9}
              >
                <title>{`${label} (init: ${(initFrac * 100).toFixed(1)}%)`}</title>
              </circle>
              <text
                y={1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize={label.length > 8 ? 9 : 11}
                fontWeight={600}
                pointerEvents="none"
              >
                {label.length > 12 ? label.slice(0, 11) + '\u2026' : label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
