import { useState, useMemo, useRef, useCallback } from 'react';
import type { TNA } from 'dynajs';
import { createColorMap } from './colorFix';

interface CentralityData {
  labels: string[];
  measures: Record<string, number[]>;
}

const EDGE_COLOR = '#2B4C7E';
const ARROW_COLOR = '#2B4C7E';
const EDGE_LABEL_COLOR = '#2B4C7E';
const ARROW_LEN = 7;
const ARROW_HALF_W = 3.5;
const EDGE_WIDTH_MIN = 0.3;
const EDGE_WIDTH_MAX = 4;
const EDGE_OPACITY_MIN = 0.7;
const EDGE_OPACITY_MAX = 1.0;
const EDGE_CURVATURE = 22;

type ModelType = 'relative' | 'frequency' | 'co-occurrence' | 'attention';

interface TnaNetworkGraphProps {
  model: TNA;
  showSelfLoops?: boolean;
  showEdgeLabels?: boolean;
  nodeRadius?: number;
  height?: number;
  colorMap?: Record<string, string>;
  centralityData?: CentralityData;
  nodeSizeMetric?: string;
  modelType?: ModelType;
  /** External node positions — if provided, overrides internal circle layout. */
  externalPositions?: { x: number; y: number }[];
  /** Maximum edge stroke width (default 4). */
  maxEdgeWidth?: number;
  /** Override directed/undirected (if undefined, inferred from modelType). */
  directed?: boolean;
  /** Whether to show node labels (default true). */
  showNodeLabels?: boolean;
  /** Custom font size for node labels. */
  nodeFontSize?: number;
}

function fmtWeight(w: number): string {
  if (Number.isInteger(w)) return String(w);
  return w.toFixed(2).replace(/^0\./, '.');
}

function arrowPoly(tipX: number, tipY: number, dx: number, dy: number): string {
  const baseX = tipX - dx * ARROW_LEN;
  const baseY = tipY - dy * ARROW_LEN;
  const lx = baseX - dy * ARROW_HALF_W;
  const ly = baseY + dx * ARROW_HALF_W;
  const rx = baseX + dy * ARROW_HALF_W;
  const ry = baseY - dx * ARROW_HALF_W;
  return `${tipX},${tipY} ${lx},${ly} ${rx},${ry}`;
}

function computeEdgePath(
  sx: number, sy: number, tx: number, ty: number,
  curvature: number, sourceRadius: number, targetRadius: number, hasArrow: boolean,
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
  const startX = sx + (sdx / slen) * sourceRadius;
  const startY = sy + (sdy / slen) * sourceRadius;

  const edx = tx - mx;
  const edy = ty - my;
  const elen = Math.sqrt(edx * edx + edy * edy);
  const eux = edx / elen;
  const euy = edy / elen;

  const tipX = tx - eux * targetRadius;
  const tipY = ty - euy * targetRadius;
  const arrowGap = hasArrow ? 8 : 0;
  const endX = tx - eux * (targetRadius + arrowGap);
  const endY = ty - euy * (targetRadius + arrowGap);

  const t = 0.55;
  const labelX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * mx + t * t * endX;
  const labelY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * my + t * t * endY;

  return { path: `M${startX},${startY} Q${mx},${my} ${endX},${endY}`, tipX, tipY, tipDx: eux, tipDy: euy, labelX, labelY };
}

function computeSelfLoop(
  nodeX: number, nodeY: number, centroidX: number, centroidY: number,
  nodeRadius: number,
) {
  // Outward direction: from graph centroid through the node, so the loop
  // always bulges away from the rest of the graph. Fallback to straight-up
  // when the node sits exactly on the centroid.
  let ox = nodeX - centroidX;
  let oy = nodeY - centroidY;
  const olen = Math.sqrt(ox * ox + oy * oy);
  if (olen < 1e-3) { ox = 0; oy = -1; } else { ox /= olen; oy /= olen; }

  const baseAngle = Math.atan2(oy, ox);
  // ~28° between the two anchor points on the node perimeter — wide enough
  // for a clearly visible loop, narrow enough that the teardrop stays tidy.
  const spread = 0.5;
  const a1 = baseAngle - spread;
  const a2 = baseAngle + spread;

  const sx = nodeX + nodeRadius * Math.cos(a1);
  const sy = nodeY + nodeRadius * Math.sin(a1);
  const ex = nodeX + nodeRadius * Math.cos(a2);
  const ey = nodeY + nodeRadius * Math.sin(a2);

  // Control-point distance: large enough to form a visible bulge scaled
  // with the node. Minimum of 22px prevents collapse on very small nodes.
  const bulge = Math.max(nodeRadius * 2.4, 22);
  const c1x = nodeX + bulge * Math.cos(a1);
  const c1y = nodeY + bulge * Math.sin(a1);
  const c2x = nodeX + bulge * Math.cos(a2);
  const c2y = nodeY + bulge * Math.sin(a2);

  // Tangent at the end-point of a cubic Bezier is (end - c2). That's the
  // direction the curve is travelling when it hits the node perimeter, so
  // it's also the correct orientation for the incoming arrowhead.
  let adx = ex - c2x;
  let ady = ey - c2y;
  const al = Math.sqrt(adx * adx + ady * ady) || 1;
  adx /= al; ady /= al;

  // Label sits just beyond the bulge apex along the outward axis.
  const labelX = nodeX + (bulge + 10) * Math.cos(baseAngle);
  const labelY = nodeY + (bulge + 10) * Math.sin(baseAngle);

  return {
    path: `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`,
    arrowTipX: ex, arrowTipY: ey,
    arrowDx: adx, arrowDy: ady,
    labelX, labelY,
  };
}

export const TnaNetworkGraph = ({
  model,
  showSelfLoops = false,
  showEdgeLabels = true,
  nodeRadius: baseNodeRadius = 25,
  height = 500,
  colorMap: externalColorMap,
  centralityData,
  nodeSizeMetric = 'fixed',
  modelType,
  externalPositions,
  maxEdgeWidth = EDGE_WIDTH_MAX,
  directed,
  showNodeLabels = true,
  nodeFontSize,
}: TnaNetworkGraphProps) => {
  const { labels, weights, inits } = model;
  const isUndirected = directed !== undefined ? !directed : modelType === 'co-occurrence';
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  // Drag state
  const [draggedPositions, setDraggedPositions] = useState<Record<number, { x: number; y: number }>>({});
  const [draggingNode, setDraggingNode] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const svgH = height;
  const svgW = svgH;
  const cx = svgW / 2;
  const cy = svgH / 2;

  const colors = useMemo(() => {
    if (externalColorMap) return labels.map(l => externalColorMap[l] ?? '#888');
    const map = createColorMap(labels);
    return labels.map(l => map[l]);
  }, [labels, externalColorMap]);

  const nodeScales = useMemo(() => {
    if (nodeSizeMetric === 'fixed' || !centralityData) {
      return labels.map(() => 1);
    }
    const values = centralityData.measures[nodeSizeMetric];
    if (!values) return labels.map(() => 1);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < values.length; i++) {
      if (values[i] < min) min = values[i];
      if (values[i] > max) max = values[i];
    }
    const range = max - min || 1;
    return labels.map((_, i) => 0.6 + ((values[i] - min) / range) * 0.8);
  }, [centralityData, nodeSizeMetric, labels]);

  const maxNodeScale = Math.max(...nodeScales);
  const padding = baseNodeRadius * maxNodeScale + 10;
  const layoutRadius = Math.min(cx, cy) - padding;

  // Layout positions (reset drag when layout changes)
  const layoutPositions = useMemo(() => {
    setDraggedPositions({});
    if (externalPositions && externalPositions.length === labels.length) return externalPositions;
    return labels.map((_, i) => {
      const angle = (2 * Math.PI * i) / labels.length - Math.PI / 2;
      return { x: cx + layoutRadius * Math.cos(angle), y: cy + layoutRadius * Math.sin(angle) };
    });
  }, [labels, cx, cy, layoutRadius, externalPositions]);

  // Merge layout positions with any drag overrides
  const nodePositions = useMemo(() => {
    if (Object.keys(draggedPositions).length === 0) return layoutPositions;
    return layoutPositions.map((pos, i) => draggedPositions[i] ?? pos);
  }, [layoutPositions, draggedPositions]);

  // Drag handlers
  const screenToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handlePointerDown = useCallback((idx: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingNode(idx);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingNode === null) return;
    const { x, y } = screenToSvg(e.clientX, e.clientY);
    setDraggedPositions(prev => ({ ...prev, [draggingNode]: { x, y } }));
  }, [draggingNode, screenToSvg]);

  const handlePointerUp = useCallback(() => {
    setDraggingNode(null);
  }, []);

  const { edges, bidir } = useMemo(() => {
    const result: { from: number; to: number; weight: number }[] = [];
    if (isUndirected) {
      // Undirected: only add each pair once (i < j), average the two directions
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const wij = weights.get(i, j);
          const wji = weights.get(j, i);
          const w = (wij + wji) / 2;
          if (w > 0) result.push({ from: i, to: j, weight: w });
        }
      }
      return { edges: result, bidir: new Set<string>() };
    }
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
  }, [labels, weights, isUndirected]);

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

  // For attention model, compute min-max normalized weights for display labels
  const { normalizeWeight } = useMemo(() => {
    const allW = [...edges.map(e => e.weight), ...selfLoops.map(s => s.weight)];
    const mn = allW.length > 0 ? Math.min(...allW) : 0;
    const range = globalMaxW - mn || 1;
    const normalize = modelType === 'attention'
      ? (w: number) => (w - mn) / range
      : (w: number) => w;
    return { normalizeWeight: normalize };
  }, [edges, selfLoops, globalMaxW, modelType]);

  const widthScale = (w: number) => EDGE_WIDTH_MIN + (w / globalMaxW) * (maxEdgeWidth - EDGE_WIDTH_MIN);
  const opacityScale = (w: number) => EDGE_OPACITY_MIN + (w / globalMaxW) * (EDGE_OPACITY_MAX - EDGE_OPACITY_MIN);

  // Responsive viewBox computed from node positions
  const viewBox = useMemo(() => {
    if (nodePositions.length === 0) return `0 0 ${svgW} ${svgH}`;
    const maxR = baseNodeRadius * maxNodeScale;
    const pad = maxR + 20;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of nodePositions) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
  }, [nodePositions, baseNodeRadius, maxNodeScale, svgW, svgH]);

  return (
    <div className="overflow-x-auto">
      <svg width="100%" height={svgH} ref={svgRef} viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet" className="mx-auto max-w-full"
        style={{ touchAction: 'none' }}
        onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
        {selfLoops.map(({ idx, weight }) => {
          const nodeRadius = baseNodeRadius * nodeScales[idx];
          const pos = nodePositions[idx];
          const loop = computeSelfLoop(pos.x, pos.y, cx, cy, nodeRadius);
          const op = opacityScale(weight);
          const sw = widthScale(weight);
          const key = `self-${idx}`;
          const isHovered = hoveredEdge === key;
          return (
            <g key={key}>
              <path d={loop.path} fill="none" stroke={isHovered ? '#e15759' : EDGE_COLOR}
                strokeWidth={sw} strokeOpacity={isHovered ? 0.85 : op} strokeLinecap="round"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredEdge(key)} onMouseLeave={() => setHoveredEdge(null)}>
                <title>{`${labels[idx]} → ${labels[idx]}: ${weight.toFixed(4)}`}</title>
              </path>
              {!isUndirected && (
                <polygon points={arrowPoly(loop.arrowTipX, loop.arrowTipY, loop.arrowDx, loop.arrowDy)}
                  fill={ARROW_COLOR} opacity={Math.min(op + 0.15, 1)} />
              )}
              {showEdgeLabels && (
                <text x={loop.labelX} y={loop.labelY} textAnchor="middle" dominantBaseline="middle"
                  fontSize={9} fill={EDGE_LABEL_COLOR} pointerEvents="none"
                  style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 3, strokeLinejoin: 'round' } as React.CSSProperties}>
                  {fmtWeight(normalizeWeight(weight))}
                </text>
              )}
            </g>
          );
        })}

        {edges.map(({ from, to, weight }) => {
          const p1 = nodePositions[from];
          const p2 = nodePositions[to];
          const isBidir = bidir.has(`${from}-${to}`);
          const curvature = isUndirected ? 0 : (isBidir ? EDGE_CURVATURE : 0);
          const sourceR = baseNodeRadius * nodeScales[from];
          const targetR = baseNodeRadius * nodeScales[to];
          const result = computeEdgePath(p1.x, p1.y, p2.x, p2.y, curvature, sourceR, targetR, !isUndirected);
          if (!result) return null;
          const op = opacityScale(weight);
          const key = `${from}-${to}`;
          const isHovered = hoveredEdge === key;
          const arrow = isUndirected ? '—' : '→';
          const displayW = normalizeWeight(weight);
          return (
            <g key={key}>
              <path d={result.path} fill="none" stroke={isHovered ? '#e15759' : EDGE_COLOR}
                strokeWidth={widthScale(weight)} strokeOpacity={isHovered ? 0.85 : op}
                strokeLinecap="round" style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredEdge(key)} onMouseLeave={() => setHoveredEdge(null)}>
                <title>{`${labels[from]} ${arrow} ${labels[to]}: ${displayW.toFixed(4)}`}</title>
              </path>
              {!isUndirected && (
                <polygon points={arrowPoly(result.tipX, result.tipY, result.tipDx, result.tipDy)}
                  fill={ARROW_COLOR} opacity={Math.min(op + 0.15, 1)} />
              )}
              {showEdgeLabels && (
                <text x={result.labelX} y={result.labelY} textAnchor="middle" dominantBaseline="middle"
                  fontSize={9} fill={EDGE_LABEL_COLOR} pointerEvents="none"
                  style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 3, strokeLinejoin: 'round' } as React.CSSProperties}>
                  {fmtWeight(displayW)}
                </text>
              )}
            </g>
          );
        })}

        {labels.map((label, i) => {
          const pos = nodePositions[i];
          const nodeRadius = baseNodeRadius * nodeScales[i];
          const color = colors[i]!;
          const isHovered = hoveredNode === i;
          const isDragging = draggingNode === i;
          const customFontSize = nodeFontSize ?? (label.length > 10 ? 8 : label.length > 7 ? 9 : 11);
          return (
            <g key={label} transform={`translate(${pos.x},${pos.y})`}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              onMouseEnter={() => setHoveredNode(i)} onMouseLeave={() => setHoveredNode(null)}
              onPointerDown={e => handlePointerDown(i, e)}>
              <circle r={nodeRadius} fill={color} stroke={isHovered ? '#333333' : '#999999'}
                strokeWidth={isHovered ? 3 : 2}>
                <title>{`${label} (init: ${((inits[i] ?? 0) * 100).toFixed(1)}%)`}</title>
              </circle>
              {showNodeLabels && (
                <text y={1} textAnchor="middle" dominantBaseline="middle" fill="#ffffff"
                  fontSize={customFontSize} fontWeight={600}
                  pointerEvents="none"
                  style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.3)', strokeWidth: 2, strokeLinejoin: 'round' } as React.CSSProperties}>
                  {label.length > 12 ? label.slice(0, 11) + '\u2026' : label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
