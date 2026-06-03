/**
 * Catmull-Rom-style smooth-curve path builder shared by the
 * dashboard's line charts. Given an array of points, produces an SVG
 * path string that interpolates between them with cubic Beziers
 * (1/6 tangent ratio — same constants as d3-line's `curveCatmullRom`).
 *
 * Returns an empty string for zero points and a single `M` command
 * for one point so callers don't have to special-case those.
 */
export interface Pt {
  x: number;
  y: number;
}

export function smoothPath(points: Pt[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  const f = (n: number) => n.toFixed(1);
  let d = `M ${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${f(cp1x)} ${f(cp1y)}, ${f(cp2x)} ${f(cp2y)}, ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

/**
 * Round up to a "nice" axis max so a chart's tick labels land on
 * readable numbers (47 → 50, 121 → 150, 6 → 8).
 */
export function niceCeil(v: number): number {
  if (v <= 1) return 1;
  if (v <= 5) return Math.ceil(v);
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / exp;
  if (m <= 1) return 1 * exp;
  if (m <= 2) return 2 * exp;
  if (m <= 2.5) return 2.5 * exp;
  if (m <= 5) return 5 * exp;
  return 10 * exp;
}
