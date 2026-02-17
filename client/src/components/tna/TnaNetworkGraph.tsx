import { useMemo } from 'react';
import type { TNA } from 'tnaj';
import { createColorMap } from 'tnaj';

interface TnaNetworkGraphProps {
  model: TNA;
}

export const TnaNetworkGraph = ({ model }: TnaNetworkGraphProps) => {
  const { labels, weights } = model;
  const colorMap = useMemo(() => createColorMap(labels), [labels]);

  const svgSize = 500;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const radius = svgSize * 0.35;
  const nodeRadius = 22;

  // Node positions in a circle
  const nodePositions = useMemo(() => {
    return labels.map((_, i) => {
      const angle = (2 * Math.PI * i) / labels.length - Math.PI / 2;
      return {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
  }, [labels, cx, cy, radius]);

  // Edges: collect non-zero weights
  const edges = useMemo(() => {
    const result: { from: number; to: number; weight: number }[] = [];
    const maxW = weights.max();

    for (let i = 0; i < labels.length; i++) {
      for (let j = 0; j < labels.length; j++) {
        if (i === j) continue; // skip self-loops
        const w = weights.get(i, j);
        if (w > 0) {
          result.push({ from: i, to: j, weight: w / (maxW || 1) });
        }
      }
    }
    return result;
  }, [labels, weights]);

  // Arrow marker ID
  const markerId = 'arrowhead-tna';

  return (
    <div className="overflow-x-auto flex justify-center">
      <svg width={svgSize} height={svgSize}>
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 6"
            refX={10}
            refY={3}
            markerWidth={8}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 3 L 0 6 z" className="fill-gray-500 dark:fill-gray-400" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map(({ from, to, weight }) => {
          const p1 = nodePositions[from];
          const p2 = nodePositions[to];

          // Calculate direction
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return null;
          const nx = dx / dist;
          const ny = dy / dist;

          // Start/end offset by node radius
          const startX = p1.x + nx * (nodeRadius + 2);
          const startY = p1.y + ny * (nodeRadius + 2);
          const endX = p2.x - nx * (nodeRadius + 6);
          const endY = p2.y - ny * (nodeRadius + 6);

          // Curve control point (offset perpendicular)
          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;
          const curveOffset = dist * 0.15;
          const ctrlX = midX - ny * curveOffset;
          const ctrlY = midY + nx * curveOffset;

          const strokeWidth = Math.max(1, weight * 4);
          const opacity = 0.3 + weight * 0.6;

          return (
            <g key={`${from}-${to}`}>
              <path
                d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`}
                fill="none"
                stroke={colorMap[labels[from]]}
                strokeWidth={strokeWidth}
                opacity={opacity}
                markerEnd={`url(#${markerId})`}
              >
                <title>{`${labels[from]} → ${labels[to]}: ${(weights.get(from, to)).toFixed(3)}`}</title>
              </path>
            </g>
          );
        })}

        {/* Nodes */}
        {labels.map((label, i) => {
          const pos = nodePositions[i];
          return (
            <g key={label}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={nodeRadius}
                fill={colorMap[label]}
                stroke="white"
                strokeWidth={2}
                opacity={0.9}
              />
              <text
                x={pos.x}
                y={pos.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={label.length > 8 ? 8 : 10}
                fontWeight={600}
              >
                {label.length > 10 ? label.slice(0, 9) + '\u2026' : label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
