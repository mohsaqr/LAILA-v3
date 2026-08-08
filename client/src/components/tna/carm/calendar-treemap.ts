/**
 * Calendar Treemap — monthly/weekly/daily calendar where each day cell contains
 * a mini visualization showing proportional activity for that day.
 *
 * 4 cell styles: treemap | bar | pie | heat
 * Generic: accepts any category labels (states, competencies, resources, components)
 * via the `labels` field. The caller decides what data dimension to show.
 *
 * Navigation: Month ↔ Week ↔ Day with breadcrumb trail, Today button,
 * and click-to-drill (month→week→day).
 *
 * Data shape: { days: string[], labels: string[], series: Record<string, number[]> }
 *   — compatible with PipelineResult.timelineData (alias `states` → `labels`).
 */
import type * as D3 from 'd3'
import { EXTENSION_THEME, applyTheme, getColor } from './theme.js'
import type { CarmTheme } from './theme.js'
import { showTooltip, hideTooltip, escapeHtml } from './carm-tooltip.js'

/** Compute Math.max for large arrays without stack overflow. */
function safeMax(arr: readonly number[], fallback: number = 0): number {
  if (arr.length === 0) return fallback
  let max = -Infinity
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]! > max) max = arr[i]!
  }
  return max === -Infinity ? fallback : max
}

/* ── Public interface ───────────────────────────────────────── */

export type CalendarView = 'month' | 'week' | 'day'
export type CellStyle = 'treemap' | 'bar' | 'pie' | 'heat'

export interface CalendarTreemapConfig {
  readonly title?: string
  readonly width?: number
  readonly height?: number
  readonly theme?: CarmTheme
  /** Color map: label → color hex. Falls back to palette. */
  readonly colorMap?: Record<string, string>
  /** Initial view mode. Default: 'month'. */
  readonly view?: CalendarView
  /** Cell visualization style. Default: 'bar'. */
  readonly cellStyle?: CellStyle
  /** Initial date to center on (ISO string or Date). Default: last day in data. */
  readonly focusDate?: string | Date
  /** Human-readable name for the category dimension (e.g. "States", "Competencies", "Resources"). Default: "categories". */
  readonly categoryLabel?: string
  /** Show a style toggle in the controls bar. Default: true. */
  readonly showStyleToggle?: boolean
  /** Callback when view or focus date changes. */
  readonly onNavigate?: (view: CalendarView, focusDate: string) => void
  /** Callback when a specific day is selected in day view. */
  readonly onDayClick?: (dateKey: string) => void
}

export interface CalendarTreemapData {
  /** Sorted ISO date strings (YYYY-MM-DD). */
  readonly days: string[]
  /** Category labels — can be states, competencies, resources, components, etc. */
  readonly labels: string[]
  /** label → array of counts aligned with days[]. */
  readonly series: Record<string, number[]>
  /** Optional: per-day hourly activity (24 values per day). Key = ISO date. */
  readonly hourly?: Record<string, number[]>
}

export function renderCalendarTreemap(
  container: HTMLElement,
  data: CalendarTreemapData,
  config: CalendarTreemapConfig = {},
): void {
  import('d3').then(d3 => _render(d3, container, data, config))
}

/* ── Internal constants ─────────────────────────────────────── */

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/* ── Day cell ───────────────────────────────────────────────── */

interface Slice { label: string; count: number; pct: number }

interface DayCell {
  readonly date: Date
  readonly dateKey: string
  readonly total: number
  readonly slices: Slice[]
}

function buildDayIndex(data: CalendarTreemapData): Map<string, DayCell> {
  const map = new Map<string, DayCell>()
  data.days.forEach((dk, idx) => {
    const slices: Slice[] = []
    let total = 0
    for (const label of data.labels) {
      const count = data.series[label]?.[idx] ?? 0
      if (count > 0) { slices.push({ label, count, pct: 0 }); total += count }
    }
    const withPct = slices
      .map(s => ({ ...s, pct: total > 0 ? (s.count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count)
    const parts = dk.split('-')
    map.set(dk, {
      date: new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])),
      dateKey: dk, total, slices: withPct,
    })
  })
  return map
}

/* ── Date helpers ───────────────────────────────────────────── */

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  const dates: Date[] = []
  for (let i = 0; i < 42; i++) dates.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  while (dates.length > 28) {
    if (dates.slice(-7).every(d => d.getMonth() !== month)) { dates.splice(-7); continue }
    break
  }
  return dates
}

function getWeekDates(d: Date): Date[] {
  const sun = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + i))
}

/* ── Color helper ───────────────────────────────────────────── */

function lColor(label: string, labelIdx: Map<string, number>, colorMap: Record<string, string> | undefined, theme: CarmTheme): string {
  if (colorMap?.[label]) return colorMap[label]!
  return getColor(labelIdx.get(label) ?? 0, theme)
}

/* ── Tooltip builder ────────────────────────────────────────── */

function buildTip(cell: DayCell, dayStr: string, highlight: string | null, labelIdx: Map<string, number>, colorMap: Record<string, string> | undefined, theme: CarmTheme): string {
  const lines = [`<div style="font-weight:600;margin-bottom:4px">${escapeHtml(dayStr)}</div>`]
  for (const sl of cell.slices.slice(0, 6)) {
    const c = lColor(sl.label, labelIdx, colorMap, theme)
    const bold = sl.label === highlight
    lines.push(`<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;${bold ? 'font-weight:600' : ''}"><span style="color:${c}">\u25A0</span><span>${escapeHtml(sl.label)}</span><strong>${sl.count} (${sl.pct.toFixed(0)}%)</strong></div>`)
  }
  lines.push(`<div style="margin-top:4px;border-top:1px solid rgba(0,0,0,0.1);padding-top:3px;font-size:10px;color:${theme.textMuted}">Total: ${cell.total} events</div>`)
  return lines.join('')
}

/* ══════════════════════════════════════════════════════════════
   Cell renderers — one per CellStyle
   ══════════════════════════════════════════════════════════════ */

type CellRenderer = (
  d3: typeof D3,
  g: D3.Selection<SVGGElement, unknown, null, undefined>,
  cell: DayCell,
  x: number, y: number, w: number, h: number,
  labelIdx: Map<string, number>,
  colorMap: Record<string, string> | undefined,
  theme: CarmTheme,
  dayStr: string,
  maxTotal: number,
) => void

/* ── Treemap ──────────────────────────────────────────────── */

const renderTreemapCell: CellRenderer = (d3, g, cell, x, y, w, h, labelIdx, colorMap, theme, dayStr) => {
  const pad = 2, treeY = y + 14, treeH = h - 16, treeW = w - pad * 2
  if (treeW < 4 || treeH < 4) return

  type LeafDatum = { label: string; count: number; pct: number }
  type RootDatum = { children: LeafDatum[] }

  const root = (d3.hierarchy as unknown as (d: RootDatum) => D3.HierarchyNode<RootDatum>)(
    { children: cell.slices as LeafDatum[] }
  )
    .sum((d: unknown) => (d as Partial<LeafDatum>).count ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  d3.treemap<RootDatum>().size([treeW, treeH]).paddingInner(0.5).paddingOuter(0).round(true)(root)

  const leaves = root.leaves() as unknown as Array<D3.HierarchyRectangularNode<RootDatum>>
  leaves.forEach(leaf => {
    const sl = leaf.data as unknown as LeafDatum
    const lx = x + pad + leaf.x0, ly = treeY + leaf.y0
    const lw = leaf.x1 - leaf.x0, lh = leaf.y1 - leaf.y0
    if (lw < 0.5 || lh < 0.5) return
    const color = lColor(sl.label, labelIdx, colorMap, theme)

    g.append('rect')
      .attr('x', lx).attr('y', ly).attr('width', lw).attr('height', lh)
      .attr('fill', color).attr('opacity', 0.6).attr('rx', 1)
      .on('mouseover', (event: MouseEvent) => { d3.select(event.currentTarget as SVGRectElement).attr('opacity', 0.9); showTooltip(event, buildTip(cell, dayStr, sl.label, labelIdx, colorMap, theme), theme) })
      .on('mousemove', (event: MouseEvent) => showTooltip(event, '', theme))
      .on('mouseout', (event: MouseEvent) => { d3.select(event.currentTarget as SVGRectElement).attr('opacity', 0.6); hideTooltip() })

    if (lw > 22 && lh > 10) {
      const mc = Math.max(2, Math.floor(lw / 5.5))
      const txt = sl.label.length > mc ? sl.label.slice(0, mc - 1) + '\u2026' : sl.label
      g.append('text').attr('x', lx + 2).attr('y', ly + lh / 2 + 3)
        .attr('font-family', theme.fontFamily).attr('font-size', Math.min(8, lh * 0.55, lw / 6))
        .attr('font-weight', '500').attr('fill', 'rgba(255,255,255,0.8)').attr('pointer-events', 'none').text(txt)
    }
  })
}

/* ── Stacked Bar ──────────────────────────────────────────── */

const renderBarCell: CellRenderer = (d3, g, cell, x, y, w, h, labelIdx, colorMap, theme, dayStr) => {
  const pad = 3, barH = Math.min(14, h * 0.18), barY = y + 15, barW = w - pad * 2
  if (barW < 4) return

  let cx = x + pad
  for (const sl of cell.slices) {
    const segW = (sl.count / cell.total) * barW
    if (segW < 0.3) continue
    const color = lColor(sl.label, labelIdx, colorMap, theme)
    g.append('rect').attr('x', cx).attr('y', barY).attr('width', segW).attr('height', barH)
      .attr('fill', color).attr('opacity', 0.7).attr('rx', cx === x + pad ? 3 : 0)
      .on('mouseover', (event: MouseEvent) => { d3.select(event.currentTarget as SVGRectElement).attr('opacity', 1); showTooltip(event, buildTip(cell, dayStr, sl.label, labelIdx, colorMap, theme), theme) })
      .on('mousemove', (event: MouseEvent) => showTooltip(event, '', theme))
      .on('mouseout', (event: MouseEvent) => { d3.select(event.currentTarget as SVGRectElement).attr('opacity', 0.7); hideTooltip() })
    cx += segW
  }

  // Subtle repeat bar for visual density
  if (h > 50) {
    const bar2Y = barY + barH + 2, bar2H = Math.min(6, barH * 0.5)
    cx = x + pad
    for (const sl of cell.slices) {
      const segW = (sl.count / cell.total) * barW
      if (segW < 0.3) continue
      g.append('rect').attr('x', cx).attr('y', bar2Y).attr('width', segW).attr('height', bar2H)
        .attr('fill', lColor(sl.label, labelIdx, colorMap, theme)).attr('opacity', 0.35).attr('rx', cx === x + pad ? 2 : 0)
        .attr('pointer-events', 'none')
      cx += segW
    }
  }

  // Top-1 label
  if (w > 50 && h > 55 && cell.slices[0]) {
    const top = cell.slices[0]!
    g.append('text').attr('x', x + pad).attr('y', barY + barH + (h > 50 ? 18 : 12))
      .attr('font-family', theme.fontFamily).attr('font-size', 8).attr('fill', theme.textMuted)
      .attr('pointer-events', 'none').text(`${top.label} ${top.pct.toFixed(0)}%`)
  }
}

/* ── Pie / Donut ──────────────────────────────────────────── */

const renderPieCell: CellRenderer = (d3, g, cell, x, y, w, h, labelIdx, colorMap, theme, dayStr) => {
  const r = Math.min(w, h - 16) * 0.35
  const cx_ = x + w / 2, cy_ = y + 14 + (h - 14) / 2
  if (r < 5) return

  const innerR = r * 0.45
  const pie = d3.pie<Slice>().value(d => d.count).sort(null).padAngle(0.02)
  const arc = d3.arc<D3.PieArcDatum<Slice>>().innerRadius(innerR).outerRadius(r)
  const arcs = pie(cell.slices)

  arcs.forEach(a => {
    const sl = a.data
    const color = lColor(sl.label, labelIdx, colorMap, theme)
    g.append('path')
      .attr('transform', `translate(${cx_},${cy_})`)
      .attr('d', arc(a) ?? '')
      .attr('fill', color).attr('opacity', 0.65)
      .on('mouseover', (event: MouseEvent) => { d3.select(event.currentTarget as SVGPathElement).attr('opacity', 0.95); showTooltip(event, buildTip(cell, dayStr, sl.label, labelIdx, colorMap, theme), theme) })
      .on('mousemove', (event: MouseEvent) => showTooltip(event, '', theme))
      .on('mouseout', (event: MouseEvent) => { d3.select(event.currentTarget as SVGPathElement).attr('opacity', 0.65); hideTooltip() })
  })

  if (r > 14) {
    g.append('text').attr('x', cx_).attr('y', cy_ + 3).attr('text-anchor', 'middle')
      .attr('font-family', theme.fontFamily).attr('font-size', Math.min(9, r * 0.4))
      .attr('font-weight', '600').attr('fill', theme.textMuted).attr('pointer-events', 'none').text(cell.total)
  }
}

/* ── Heat (dominant state color) ──────────────────────────── */

const renderHeatCell: CellRenderer = (d3, g, cell, x, y, w, h, labelIdx, colorMap, theme, dayStr, maxTotal) => {
  const intensity = maxTotal > 0 ? cell.total / maxTotal : 0
  const top = cell.slices[0]
  const dominantColor = top ? lColor(top.label, labelIdx, colorMap, theme) : theme.colors[0]!
  const bg = d3.interpolateRgb('#ffffff', dominantColor)(Math.min(intensity * 0.85 + 0.15, 0.85))
  const textColor = intensity > 0.35 ? '#fff' : theme.text

  g.append('rect').attr('x', x + 1).attr('y', y + 1).attr('width', w - 2).attr('height', h - 2)
    .attr('fill', bg).attr('rx', 3)
    .on('mouseover', (event: MouseEvent) => { d3.select(event.currentTarget as SVGRectElement).attr('stroke', dominantColor).attr('stroke-width', 1.5); showTooltip(event, buildTip(cell, dayStr, top?.label ?? null, labelIdx, colorMap, theme), theme) })
    .on('mousemove', (event: MouseEvent) => showTooltip(event, '', theme))
    .on('mouseout', (event: MouseEvent) => { d3.select(event.currentTarget as SVGRectElement).attr('stroke', 'none'); hideTooltip() })

  if (w > 30 && h > 30) {
    g.append('text').attr('x', x + w / 2).attr('y', y + h / 2 + 4).attr('text-anchor', 'middle')
      .attr('font-family', theme.fontFamily).attr('font-size', Math.min(12, w / 4.5))
      .attr('font-weight', '700').attr('fill', textColor).attr('pointer-events', 'none').text(cell.total)
  }

  if (top && w > 40 && h > 50) {
    g.append('text').attr('x', x + w / 2).attr('y', y + h / 2 + 17).attr('text-anchor', 'middle')
      .attr('font-family', theme.fontFamily).attr('font-size', 8).attr('font-weight', '500')
      .attr('fill', intensity > 0.3 ? 'rgba(255,255,255,0.8)' : theme.textMuted)
      .attr('pointer-events', 'none').text(top.label)
  }

  if (cell.slices[1] && w > 50 && h > 60) {
    const s2 = cell.slices[1]!
    const c2 = lColor(s2.label, labelIdx, colorMap, theme)
    g.append('circle').attr('cx', x + w / 2 - 3).attr('cy', y + h / 2 + 26).attr('r', 3).attr('fill', c2).attr('opacity', 0.9).attr('pointer-events', 'none')
    g.append('text').attr('x', x + w / 2 + 3).attr('y', y + h / 2 + 29)
      .attr('font-family', theme.fontFamily).attr('font-size', 7)
      .attr('fill', intensity > 0.3 ? 'rgba(255,255,255,0.65)' : theme.textMuted)
      .attr('pointer-events', 'none').text(`${s2.label} ${s2.pct.toFixed(0)}%`)
  }
}

const CELL_RENDERERS: Record<CellStyle, CellRenderer> = {
  treemap: renderTreemapCell,
  bar: renderBarCell,
  pie: renderPieCell,
  heat: renderHeatCell,
}

/* ── Hourly sparkline overlay ─────────────────────────────── */

type CellBounds = { x: number; y: number; w: number; h: number } | null

function drawHourlyOverlay(
  d3: typeof D3,
  g: D3.Selection<SVGGElement, unknown, null, undefined>,
  data: CalendarTreemapData,
  dates: Date[],
  getCellBounds: (dt: Date, idx: number) => CellBounds,
  theme: CarmTheme,
): void {
  if (!data.hourly) return

  dates.forEach((dt, i) => {
    const bounds = getCellBounds(dt, i)
    if (!bounds) return
    const dk = toDateKey(dt), hrs = data.hourly![dk]
    if (!hrs) return
    const localMax = hrs ? safeMax(hrs) : 0
    if (localMax === 0) return
    const pad = 3
    const x = bounds.x + pad, w = bounds.w - pad * 2
    const sparkH = bounds.h * 0.6
    const y = bounds.y + bounds.h - sparkH - pad

    const points = hrs.map((v, j) => ({
      x: x + (j / 23) * w,
      y: y + sparkH - (v / localMax) * sparkH,
    }))

    const area = d3.area<{ x: number; y: number }>()
      .x(p => p.x).y0(y + sparkH).y1(p => p.y).curve(d3.curveMonotoneX)
    g.append('path').attr('d', area(points)!)
      .attr('fill', theme.colors[0]!).attr('opacity', 0.1).attr('pointer-events', 'none')

    const line = d3.line<{ x: number; y: number }>()
      .x(p => p.x).y(p => p.y).curve(d3.curveMonotoneX)
    g.append('path').attr('d', line(points)!)
      .attr('fill', 'none').attr('stroke', theme.colors[0]!)
      .attr('stroke-width', 1.2).attr('stroke-opacity', 0.35).attr('pointer-events', 'none')
  })
}

/* ══════════════════════════════════════════════════════════════
   Main render
   ══════════════════════════════════════════════════════════════ */

function _render(
  d3: typeof D3,
  container: HTMLElement,
  data: CalendarTreemapData,
  config: CalendarTreemapConfig,
): void {
  const theme = config.theme ?? EXTENSION_THEME
  const catLabel = config.categoryLabel ?? 'categories'
  container.innerHTML = ''
  applyTheme(container, theme)

  if (data.days.length === 0) {
    container.innerHTML = '<p style="color:#888;padding:16px">No data</p>'
    return
  }

  const dayIndex = buildDayIndex(data)
  const labelIdx = new Map(data.labels.map((s, i) => [s, i]))

  // Max total for heat normalization
  let maxTotal = 0
  for (const c of dayIndex.values()) { if (c.total > maxTotal) maxTotal = c.total }

  // Focus date — default to the most recent day in data on or before today.
  // Picking the absolute last day in data.days (the previous behavior) lands on
  // future-dated outliers (e.g. Moodle's "Quiz availability set" entries dated to
  // a deadline in the future), opening the calendar on a near-empty future month.
  let focusDate: Date
  if (config.focusDate) {
    focusDate = typeof config.focusDate === 'string' ? new Date(config.focusDate) : config.focusDate
  } else {
    const todayKey = toDateKey(new Date())
    let pickedKey: string | null = null
    for (let i = data.days.length - 1; i >= 0; i--) {
      if (data.days[i]! <= todayKey) { pickedKey = data.days[i]!; break }
    }
    // Fallback: every day in data is in the future → just take the first one.
    if (pickedKey === null) pickedKey = data.days[0]!
    const p = pickedKey.split('-')
    focusDate = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
  }

  let currentView: CalendarView = config.view ?? 'month'
  let currentStyle: CellStyle = config.cellStyle ?? 'bar'
  let currentFocus = focusDate
  const styleBtns = new Map<CellStyle, HTMLButtonElement>()

  // ── Wrapper ──
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:relative;'
  container.appendChild(wrapper)

  // ── Controls bar ──
  const controls = document.createElement('div')
  controls.style.cssText = `display:flex;align-items:center;gap:6px;padding:4px 8px;margin-bottom:2px;font-family:${theme.fontFamily};flex-wrap:wrap;`
  wrapper.appendChild(controls)

  // View toggle pill
  const viewToggle = document.createElement('div')
  viewToggle.style.cssText = `display:flex;border:1px solid ${theme.gridLine};border-radius:6px;overflow:hidden;`
  const views: CalendarView[] = ['month', 'week', 'day']
  const viewBtns = new Map<CalendarView, HTMLButtonElement>()
  for (const v of views) {
    const btn = document.createElement('button')
    btn.textContent = v.charAt(0).toUpperCase() + v.slice(1)
    btn.style.cssText = `padding:4px 12px;border:none;font-size:11px;font-family:${theme.fontFamily};cursor:pointer;transition:all 0.15s;outline:none;`
    btn.addEventListener('click', () => { currentView = v; draw() })
    viewToggle.appendChild(btn)
    viewBtns.set(v, btn)
  }
  controls.appendChild(viewToggle)

  // Nav group
  const navGroup = document.createElement('div')
  navGroup.style.cssText = 'display:flex;align-items:center;gap:4px;flex:1;justify-content:center;'
  const navLeft = document.createElement('button'); navLeft.textContent = '\u25C0'; styleNavBtn(navLeft, theme)
  const titleLabel = document.createElement('span')
  titleLabel.style.cssText = `font-size:13px;font-weight:700;color:${theme.text};letter-spacing:-0.3px;min-width:160px;text-align:center;`
  const navRight = document.createElement('button'); navRight.textContent = '\u25B6'; styleNavBtn(navRight, theme)
  navGroup.appendChild(navLeft); navGroup.appendChild(titleLabel); navGroup.appendChild(navRight)
  controls.appendChild(navGroup)

  // Today button
  const todayBtn = document.createElement('button'); todayBtn.textContent = 'Today'
  todayBtn.style.cssText = `padding:4px 10px;border:1px solid ${theme.gridLine};border-radius:6px;font-size:11px;font-family:${theme.fontFamily};cursor:pointer;background:none;color:${theme.text};transition:all 0.15s;`
  todayBtn.addEventListener('mouseenter', () => { todayBtn.style.background = theme.surface })
  todayBtn.addEventListener('mouseleave', () => { todayBtn.style.background = 'none' })
  todayBtn.addEventListener('click', () => { currentFocus = new Date(); draw() })
  controls.appendChild(todayBtn)

  // Style toggle (icons)
  if (config.showStyleToggle !== false) {
    const styleToggle = document.createElement('div')
    styleToggle.style.cssText = `display:flex;border:1px solid ${theme.gridLine};border-radius:6px;overflow:hidden;margin-left:4px;`
    const styleIcons: [CellStyle, string][] = [['bar', '\u2261'], ['treemap', '\u25A3'], ['pie', '\u25CE'], ['heat', '\u25A8']]
    for (const [s, icon] of styleIcons) {
      const btn = document.createElement('button')
      btn.textContent = icon
      btn.title = s.charAt(0).toUpperCase() + s.slice(1)
      btn.style.cssText = `padding:4px 8px;border:none;font-size:13px;font-family:${theme.fontFamily};cursor:pointer;transition:all 0.15s;outline:none;line-height:1;`
      btn.addEventListener('click', () => { currentStyle = s; draw() })
      styleToggle.appendChild(btn)
      styleBtns.set(s, btn)
    }
    controls.appendChild(styleToggle)
  }

  // ── Breadcrumb ──
  const breadcrumb = document.createElement('div')
  breadcrumb.style.cssText = `font-size:10px;color:${theme.textMuted};padding:0 8px 4px;font-family:${theme.fontFamily};`
  wrapper.appendChild(breadcrumb)

  // ── SVG container ──
  const svgContainer = document.createElement('div')
  wrapper.appendChild(svgContainer)

  // Nav
  navLeft.addEventListener('click', () => { navigate(-1); draw() })
  navRight.addEventListener('click', () => { navigate(1); draw() })

  function navigate(dir: number): void {
    if (currentView === 'month') currentFocus = new Date(currentFocus.getFullYear(), currentFocus.getMonth() + dir, 1)
    else if (currentView === 'week') currentFocus = new Date(currentFocus.getFullYear(), currentFocus.getMonth(), currentFocus.getDate() + dir * 7)
    else currentFocus = new Date(currentFocus.getFullYear(), currentFocus.getMonth(), currentFocus.getDate() + dir)
  }

  function updateBreadcrumb(): void {
    const ms = `${MONTH_NAMES[currentFocus.getMonth()]} ${currentFocus.getFullYear()}`
    const parts: string[] = []
    if (currentView === 'month') {
      parts.push(`<strong>${ms}</strong>`)
    } else if (currentView === 'week') {
      const wk = getWeekDates(currentFocus)
      parts.push(`<a href="#" data-nav="month" style="color:${theme.colors[0]};text-decoration:none">${ms}</a> \u203A <strong>Week of ${wk[0]!.getDate()}\u2013${wk[6]!.getDate()}</strong>`)
    } else {
      const wk = getWeekDates(currentFocus)
      parts.push(`<a href="#" data-nav="month" style="color:${theme.colors[0]};text-decoration:none">${ms}</a> \u203A <a href="#" data-nav="week" style="color:${theme.colors[0]};text-decoration:none">Week ${wk[0]!.getDate()}\u2013${wk[6]!.getDate()}</a> \u203A <strong>${currentFocus.getDate()}</strong>`)
    }
    breadcrumb.innerHTML = parts.join('')
    breadcrumb.querySelectorAll<HTMLAnchorElement>('a[data-nav]').forEach(a => {
      a.addEventListener('click', (e) => { e.preventDefault(); currentView = a.dataset.nav as CalendarView; draw() })
    })
  }

  const draw = (): void => {
    for (const [v, btn] of viewBtns) {
      btn.style.background = v === currentView ? theme.colors[0]! : theme.background
      btn.style.color = v === currentView ? '#fff' : theme.text
    }
    for (const [style, btn] of styleBtns) {
      btn.style.background = style === currentStyle ? theme.colors[0]! : theme.background
      btn.style.color = style === currentStyle ? '#fff' : theme.text
    }
    updateBreadcrumb()
    config.onNavigate?.(currentView, toDateKey(currentFocus))
    if (currentView === 'month') drawMonth()
    else if (currentView === 'week') drawWeek()
    else drawDay()
  }

  /* ── Month view ──────────────────────────────────────────── */

  function drawMonth(): void {
    const year = currentFocus.getFullYear(), month = currentFocus.getMonth()
    titleLabel.textContent = `${MONTH_NAMES[month]} ${year}`
    const dates = getMonthGrid(year, month)
    const nRows = dates.length / 7
    const W = config.width ?? Math.max(container.clientWidth || 600, 400)
    const cellW = Math.floor((W - 2) / 7)
    const headerH = 24
    const renderCell = CELL_RENDERERS[currentStyle]

    // Determine which rows have data
    const rowHasData: boolean[] = []
    for (let r = 0; r < nRows; r++) {
      let hasAny = false
      for (let c = 0; c < 7; c++) {
        const dt = dates[r * 7 + c]!
        if (dt.getMonth() !== month) continue
        const dk = toDateKey(dt), cell = dayIndex.get(dk)
        if (cell && cell.total > 0) { hasAny = true; break }
      }
      rowHasData.push(hasAny)
    }

    // Size full rows based on how many have data; empty rows become a thin line
    const nDataRows = rowHasData.filter(Boolean).length || 1
    const fullCellH = Math.min(120, Math.max(60, Math.floor((config.height ?? 400) / nDataRows)))
    const collapsedH = 14 // just enough for tiny day numbers

    // Build row y-offsets
    const rowY: number[] = []
    const rowH: number[] = []
    let yAccum = 0
    for (let r = 0; r < nRows; r++) {
      rowY.push(yAccum)
      const h = rowHasData[r] ? fullCellH : collapsedH
      rowH.push(h)
      yAccum += h
    }
    const H = headerH + yAccum + 2

    svgContainer.innerHTML = ''
    const svg = d3.select(svgContainer).append('svg').attr('width', W).attr('height', H).style('background', theme.background).style('font-family', theme.fontFamily)
    for (let col = 0; col < 7; col++) {
      svg.append('text').attr('x', col * cellW + cellW / 2).attr('y', 16).attr('text-anchor', 'middle').attr('font-size', 10).attr('font-weight', '600').attr('fill', theme.textMuted).text(DAY_NAMES_SHORT[col]!)
    }
    const g = svg.append('g').attr('transform', `translate(0,${headerH})`)

    dates.forEach((dt, i) => {
      const col = i % 7, row = Math.floor(i / 7), x = col * cellW, y = rowY[row]!, h = rowH[row]!
      const isCur = dt.getMonth() === month
      if (!isCur) return
      const dk = toDateKey(dt), cell = dayIndex.get(dk), has = cell !== undefined && cell.total > 0
      const collapsed = !rowHasData[row]

      if (collapsed) {
        // Thin line with small day numbers
        g.append('line').attr('x1', x).attr('x2', x + cellW).attr('y1', y + collapsedH - 1).attr('y2', y + collapsedH - 1)
          .attr('stroke', theme.gridLine).attr('stroke-width', 0.5)
        g.append('text').attr('x', x + cellW / 2).attr('y', y + 10).attr('text-anchor', 'middle')
          .attr('font-size', 8).attr('fill', theme.textMuted).attr('opacity', 0.5).attr('pointer-events', 'none').text(dt.getDate())
        return
      }

      const bg = g.append('rect').attr('x', x).attr('y', y).attr('width', cellW).attr('height', h)
        .attr('fill', theme.background).attr('stroke', theme.gridLine).attr('stroke-width', 0.5)
        .style('cursor', has ? 'pointer' : 'default')
      if (has) {
        bg.on('mouseover', () => bg.attr('stroke', theme.colors[0]!).attr('stroke-width', 1.5))
          .on('mouseout', () => bg.attr('stroke', theme.gridLine).attr('stroke-width', 0.5))
          .on('click', () => { currentFocus = dt; currentView = 'week'; draw() })
      }

      if (currentStyle !== 'heat') {
        g.append('text').attr('x', x + cellW - 4).attr('y', y + 12).attr('text-anchor', 'end').attr('font-size', 10)
          .attr('font-weight', '600').attr('fill', theme.text).attr('pointer-events', 'none').text(dt.getDate())
        if (has) {
          g.append('text').attr('x', x + 4).attr('y', y + 12).attr('font-size', 8).attr('fill', theme.textMuted).attr('pointer-events', 'none').text(cell.total)
        }
      } else {
        g.append('text').attr('x', x + cellW - 4).attr('y', y + 12).attr('text-anchor', 'end').attr('font-size', 10)
          .attr('font-weight', '600').attr('fill', theme.text).attr('pointer-events', 'none').text(dt.getDate())
      }

      if (has) {
        const dayStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        renderCell(d3, g as unknown as D3.Selection<SVGGElement, unknown, null, undefined>, cell, x, y, cellW, h, labelIdx, config.colorMap, theme, dayStr, maxTotal)
      }
    })

    // Hourly sparkline overlay — only on data rows
    drawHourlyOverlay(d3, g, data, dates, (dt, i) => {
      if (dt.getMonth() !== month) return null
      const row = Math.floor(i / 7)
      if (!rowHasData[row]) return null
      const col = i % 7
      return { x: col * cellW, y: rowY[row]!, w: cellW, h: rowH[row]! }
    }, theme)
  }

  /* ── Week view ───────────────────────────────────────────── */

  function drawWeek(): void {
    const dates = getWeekDates(currentFocus)
    titleLabel.textContent = `${dates[0]!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${dates[6]!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    const W = config.width ?? Math.max(container.clientWidth || 600, 400)
    const cellW = Math.floor((W - 2) / 7)
    const headerH = 32, cellH = Math.max(120, (config.height ?? 300) - headerH), H = headerH + cellH + 2
    const renderCell = CELL_RENDERERS[currentStyle]

    svgContainer.innerHTML = ''
    const svg = d3.select(svgContainer).append('svg').attr('width', W).attr('height', H).style('background', theme.background).style('font-family', theme.fontFamily)
    const g = svg.append('g')

    dates.forEach((dt, col) => {
      const x = col * cellW, dk = toDateKey(dt), cell = dayIndex.get(dk)
      const isToday = dk === toDateKey(new Date()), has = cell !== undefined && cell.total > 0

      g.append('rect').attr('x', x).attr('y', 0).attr('width', cellW).attr('height', headerH)
        .attr('fill', isToday ? theme.colors[0]! + '18' : theme.surface)
        .style('cursor', has ? 'pointer' : 'default')
        .on('click', () => { if (has) { currentFocus = dt; currentView = 'day'; draw() } })
      g.append('text').attr('x', x + cellW / 2).attr('y', 13).attr('text-anchor', 'middle').attr('font-size', 9).attr('font-weight', '600').attr('fill', theme.textMuted).attr('pointer-events', 'none').text(DAY_NAMES_SHORT[dt.getDay()]!)
      g.append('text').attr('x', x + cellW / 2).attr('y', 26).attr('text-anchor', 'middle').attr('font-size', 12).attr('font-weight', '700').attr('fill', isToday ? theme.colors[0]! : theme.text).attr('pointer-events', 'none').text(dt.getDate())

      const bg = g.append('rect').attr('x', x).attr('y', headerH).attr('width', cellW).attr('height', cellH)
        .attr('fill', theme.background).attr('stroke', theme.gridLine).attr('stroke-width', 0.5)
        .style('cursor', has ? 'pointer' : 'default')
      if (has) {
        bg.on('mouseover', () => bg.attr('stroke', theme.colors[0]!).attr('stroke-width', 1.5))
          .on('mouseout', () => bg.attr('stroke', theme.gridLine).attr('stroke-width', 0.5))
          .on('click', () => { currentFocus = dt; currentView = 'day'; draw() })
        const dayStr = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
        renderCell(d3, g as unknown as D3.Selection<SVGGElement, unknown, null, undefined>, cell, x, headerH, cellW, cellH - 14, labelIdx, config.colorMap, theme, dayStr, maxTotal)
        g.append('text').attr('x', x + cellW / 2).attr('y', headerH + cellH - 4).attr('text-anchor', 'middle')
          .attr('font-size', 9).attr('font-weight', '500').attr('fill', theme.textMuted).attr('pointer-events', 'none').text(`${cell.total} events`)
      }
    })

    // Hourly sparkline overlay on week cells
    drawHourlyOverlay(d3, g, data, dates, (_dt, col) => {
      return { x: col * cellW, y: headerH, w: cellW, h: cellH - 14 }
    }, theme)
  }

  /* ── Day view (always uses treemap for full detail) ──────── */

  function drawDay(): void {
    const dk = toDateKey(currentFocus)
    const dayStr = currentFocus.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    titleLabel.textContent = dayStr
    const W = config.width ?? Math.max(container.clientWidth || 600, 400)
    const H = config.height ?? 360
    const cell = dayIndex.get(dk)

    svgContainer.innerHTML = ''
    if (!cell || cell.total === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = `height:${H}px;display:flex;align-items:center;justify-content:center;color:${theme.textMuted};font-size:13px;font-family:${theme.fontFamily};`
      empty.textContent = 'No activity on this day'
      svgContainer.appendChild(empty)
      return
    }

    const legendH = 20
    const svg = d3.select(svgContainer).append('svg').attr('width', W).attr('height', H).style('background', theme.background).style('font-family', theme.fontFamily)
    svg.append('text').attr('x', W / 2).attr('y', 18).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', theme.textMuted).text(`${cell.total} events across ${cell.slices.length} ${catLabel}`)

    const pad = 16, treeY = 28
    renderTreemapCell(d3, svg.append('g') as unknown as D3.Selection<SVGGElement, unknown, null, undefined>,
      cell, pad, treeY, W - pad * 2, H - treeY - pad - legendH, labelIdx, config.colorMap, theme, dayStr, maxTotal)

    let lx = pad
    for (const sl of cell.slices.slice(0, 10)) {
      const color = lColor(sl.label, labelIdx, config.colorMap, theme)
      svg.append('rect').attr('x', lx).attr('y', H - 14).attr('width', 8).attr('height', 8).attr('rx', 2).attr('fill', color).attr('opacity', 0.7)
      svg.append('text').attr('x', lx + 11).attr('y', H - 7).attr('font-family', theme.fontFamily).attr('font-size', 9).attr('fill', theme.textMuted).text(`${sl.label} (${sl.pct.toFixed(0)}%)`)
      lx += sl.label.length * 5.5 + 40
      if (lx > W - 60) break
    }

    config.onDayClick?.(dk)
  }

  draw()
}

/* ── Helpers ────────────────────────────────────────────────── */

function styleNavBtn(btn: HTMLButtonElement, theme: CarmTheme): void {
  btn.style.cssText = `background:none;border:1px solid ${theme.gridLine};border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;color:${theme.text};font-family:${theme.fontFamily};transition:all 0.15s;`
  btn.addEventListener('mouseenter', () => { btn.style.background = theme.surface })
  btn.addEventListener('mouseleave', () => { btn.style.background = 'none' })
}
