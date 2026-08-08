/**
 * Multi-line chart — copied from JStats/src/viz/plots/line-chart.ts.
 * Adapted for extension: imports from local theme/tooltip/annotations.
 * LAILA adaptations: optional `seriesColors` map (label → hex) so callers can
 * align series colors with the dashboard palette; fixed the stacked-area
 * tooltip total (upstream double-counted every series but the first).
 */
import type * as D3 from 'd3'
import { EXTENSION_THEME, applyTheme, getColor } from './theme.js'
import type { CarmTheme } from './theme.js'
import { addSubtitle } from './annotations.js'
import { showTooltip, hideTooltip, formatTooltipRow } from './carm-tooltip.js'

export interface LineChartConfig {
  readonly showArea?: boolean
  readonly stackedArea?: boolean
  readonly showDots?: boolean
  readonly lineWidth?: number
  readonly showLegend?: boolean
  readonly legendPosition?: 'bottom' | 'top-right'
  readonly curveMethod?: 'linear' | 'catmull-rom' | 'step' | 'monotone'
  readonly dotSize?: number
  readonly title?: string
  readonly xLabel?: string
  readonly yLabel?: string
  readonly width?: number
  readonly height?: number
  readonly theme?: CarmTheme
  readonly onSeriesClick?: (label: string) => void
  /** Format x-axis tick labels (e.g. format Unix ms timestamps as dates). */
  readonly xTickFormat?: (value: number) => string
  /** Per-series colors by label; falls back to the theme palette. */
  readonly seriesColors?: Record<string, string>
}

export interface LineChartSeries {
  readonly label: string
  readonly x: readonly number[]
  readonly y: readonly number[]
}

export interface LineChartData {
  readonly series: readonly LineChartSeries[]
}

export function renderLineChart(
  container: HTMLElement,
  data: LineChartData,
  config: LineChartConfig = {},
): void {
  import('d3').then(d3 => renderLineChartD3(d3, container, data, config))
}

function renderLineChartD3(
  d3: typeof D3,
  container: HTMLElement,
  data: LineChartData,
  config: LineChartConfig,
): void {
  if (data.series.length === 0) return

  const theme = config.theme ?? EXTENSION_THEME
  const legendPos = config.legendPosition ?? 'bottom'
  const legendBottomH = legendPos === 'bottom' && data.series.length > 1 && config.showLegend !== false ? 28 : 0
  const W = config.width ?? Math.max(container.clientWidth || 400, 300)
  const H = config.height ?? 300
  const margin = { top: theme.marginTop, right: theme.marginRight + 16, bottom: theme.marginBottom + legendBottomH, left: theme.marginLeft }
  const width = W - margin.left - margin.right
  const height = H - margin.top - margin.bottom
  const showArea = config.showArea ?? false
  const dotSize = config.dotSize ?? 3

  container.innerHTML = ''
  applyTheme(container, theme)

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H).style('background', theme.background)

  addSubtitle(svg, config.title ?? 'Line Chart', '', W, theme)

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const allX = data.series.flatMap(s => [...s.x])
  const [xMin, xMax] = d3.extent(allX) as [number, number]
  const xPad = (xMax - xMin) * 0.05
  const stacked = config.stackedArea ?? false

  const curveFactory: D3.CurveFactory = (() => {
    switch (config.curveMethod) {
      case 'linear': return d3.curveLinear
      case 'step': return d3.curveStep
      case 'monotone': return d3.curveMonotoneX
      case 'catmull-rom':
      default: return d3.curveCatmullRom
    }
  })()

  // For stacked area, compute cumulative y values
  // Each series is [x, y0, y1] where y0 = baseline, y1 = baseline + value
  const sortedXs = Array.from(new Set(allX)).sort((a, b) => a - b)

  let yMax: number
  if (stacked) {
    // Build per-x value lookup for each series
    const seriesAtX: number[][] = sortedXs.map(x => {
      return data.series.map(s => {
        const idx = s.x.indexOf(x)
        return idx >= 0 ? (s.y[idx] ?? 0) : 0
      })
    })
    // Stack totals
    yMax = seriesAtX.reduce((m, vals) => Math.max(m, vals.reduce((a, b) => a + b, 0)), 0)
  } else {
    const allY = data.series.flatMap(s => [...s.y])
    yMax = d3.max(allY) ?? 0
  }
  const yPad = yMax * 0.1

  const xScale = d3.scaleLinear().domain([xMin - xPad, xMax + xPad]).range([0, width]).nice()
  const yScale = d3.scaleLinear().domain([0, yMax + yPad]).range([height, 0]).nice()

  // Grid
  g.selectAll('.grid').data(yScale.ticks(5)).join('line')
    .attr('x1', 0).attr('x2', width)
    .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
    .attr('stroke', theme.gridLine).attr('stroke-width', 1)

  const onClick = config.onSeriesClick
  const clickCursor = onClick ? 'pointer' : 'default'

  if (stacked) {
    // Build stacked layers: for each x, compute [y0, y1] per series
    const layers: { x: number; y0: number; y1: number }[][] = data.series.map(() => [])
    for (const x of sortedXs) {
      let baseline = 0
      for (let si = data.series.length - 1; si >= 0; si--) {
        const s = data.series[si]!
        const idx = s.x.indexOf(x)
        const val = idx >= 0 ? (s.y[idx] ?? 0) : 0
        layers[si]!.push({ x, y0: baseline, y1: baseline + val })
        baseline += val
      }
    }

    // Draw from bottom (last series) to top (first series) so top series renders in front
    for (let si = data.series.length - 1; si >= 0; si--) {
      const s = data.series[si]!
      const color = config.seriesColors?.[s.label] ?? getColor(si, theme)
      const layer = layers[si]!

      const areaGen = d3.area<{ x: number; y0: number; y1: number }>()
        .x(d => xScale(d.x)).y0(d => yScale(d.y0)).y1(d => yScale(d.y1)).curve(curveFactory)
      const areaPath = g.append('path').datum(layer).attr('d', areaGen)
        .attr('fill', color).attr('opacity', 0.85).style('cursor', clickCursor)
      if (onClick) {
        areaPath.on('click', () => onClick(s.label))
          .on('mouseenter', function () { d3.select(this).attr('opacity', 1) })
          .on('mouseleave', function () { d3.select(this).attr('opacity', 0.85) })
      }

      // Top edge line
      const lineGen = d3.line<{ x: number; y0: number; y1: number }>()
        .x(d => xScale(d.x)).y(d => yScale(d.y1)).curve(curveFactory)
      g.append('path').datum(layer).attr('d', lineGen)
        .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1)
        .style('pointer-events', 'none')
    }

    // Tooltips: invisible overlay rects per x position
    const bandW = width / sortedXs.length
    sortedXs.forEach((x, xi) => {
      const vals = data.series.map((s, si) => {
        const layer = layers[si]![xi]!
        return formatTooltipRow(s.label, layer.y1 - layer.y0)
      }).join('')
      // Series 0 is the topmost layer, so its y1 is already the full stack height.
      const total = layers[0]![xi]!.y1
      g.append('rect')
        .attr('x', xScale(x) - bandW / 2).attr('y', 0).attr('width', bandW).attr('height', height)
        .attr('fill', 'transparent')
        .on('mouseover', (event: MouseEvent) => {
          showTooltip(event, formatTooltipRow('Total', Math.round(total)) + vals, theme)
        })
        .on('mouseout', hideTooltip)
    })
  } else {
    data.series.forEach((s, si) => {
      if (s.x.length === 0 || s.y.length === 0) return
      const color = config.seriesColors?.[s.label] ?? getColor(si, theme)
      const pts = s.x.map((x, i) => [x, s.y[i] ?? 0] as [number, number])
        .sort((a, b) => a[0] - b[0])

      if (showArea) {
        const areaPath = g.append('path').datum(pts)
          .attr('d', d3.area<[number, number]>()
            .x(d => xScale(d[0])).y0(yScale(0)).y1(d => yScale(d[1])).curve(curveFactory))
          .attr('fill', color).attr('opacity', theme.ciOpacity).style('cursor', clickCursor)
        if (onClick) {
          areaPath.on('click', () => onClick(s.label))
            .on('mouseenter', function () { d3.select(this).attr('opacity', theme.ciOpacity + 0.15) })
            .on('mouseleave', function () { d3.select(this).attr('opacity', theme.ciOpacity) })
        }
      }

      const linePath = g.append('path').datum(pts)
        .attr('d', d3.line<[number, number]>()
          .x(d => xScale(d[0])).y(d => yScale(d[1])).curve(curveFactory))
        .attr('fill', 'none').attr('stroke', color).attr('stroke-width', config.lineWidth ?? 2)
        .style('cursor', clickCursor)
      if (onClick) {
        // Invisible wider stroke for easier clicking
        g.append('path').datum(pts)
          .attr('d', d3.line<[number, number]>()
            .x(d => xScale(d[0])).y(d => yScale(d[1])).curve(curveFactory))
          .attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 12)
          .style('cursor', 'pointer')
          .on('click', () => onClick(s.label))
          .on('mouseenter', () => linePath.attr('stroke-width', (config.lineWidth ?? 2) + 2))
          .on('mouseleave', () => linePath.attr('stroke-width', config.lineWidth ?? 2))
      }

      if (config.showDots !== false) {
        pts.forEach(([x, y]) => {
          const dot = g.append('circle')
            .attr('cx', xScale(x)).attr('cy', yScale(y)).attr('r', dotSize)
            .attr('fill', color).attr('stroke', theme.background).attr('stroke-width', 1.5)
            .style('cursor', clickCursor)
            .on('mouseover', (event: MouseEvent) => {
              showTooltip(event, [
                formatTooltipRow('Series', s.label),
                formatTooltipRow('Day', x),
                formatTooltipRow('Events', y),
              ].join(''), theme)
            })
            .on('mouseout', hideTooltip)
          if (onClick) dot.on('click', () => onClick(s.label))
        })
      }
    })
  }

  // Axes
  const xAxis = d3.axisBottom(xScale).ticks(6)
  if (config.xTickFormat) xAxis.tickFormat((d) => config.xTickFormat!(Number(d)))
  g.append('g').attr('transform', `translate(0,${height})`).call(xAxis)
    .selectAll('text').attr('fill', theme.text).attr('font-family', theme.fontFamily).attr('font-size', theme.fontSize)
  g.append('g').call(d3.axisLeft(yScale).ticks(5))
    .selectAll('text').attr('fill', theme.text).attr('font-family', theme.fontFamily).attr('font-size', theme.fontSize)

  if (config.xLabel) {
    g.append('text').attr('x', width / 2).attr('y', height + 38)
      .attr('text-anchor', 'middle').attr('font-family', theme.fontFamily).attr('font-size', theme.fontSize)
      .attr('fill', theme.text).text(config.xLabel)
  }
  if (config.yLabel) {
    g.append('text').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -40)
      .attr('text-anchor', 'middle').attr('font-family', theme.fontFamily).attr('font-size', theme.fontSize)
      .attr('fill', theme.text).text(config.yLabel)
  }

  // Legend
  if (config.showLegend !== false && data.series.length > 1) {
    if (legendPos === 'top-right') {
      data.series.forEach((s, i) => {
        const color = getColor(i, theme)
        const lx = width - 120, ly = i * 18 + 8
        const legG = g.append('g').style('cursor', clickCursor)
        legG.append('line').attr('x1', lx).attr('x2', lx + 20).attr('y1', ly).attr('y2', ly)
          .attr('stroke', color).attr('stroke-width', 2)
        legG.append('circle').attr('cx', lx + 10).attr('cy', ly).attr('r', 3)
          .attr('fill', color).attr('stroke', theme.background).attr('stroke-width', 1)
        legG.append('text').attr('x', lx + 24).attr('y', ly + 4)
          .attr('font-family', theme.fontFamily).attr('font-size', theme.fontSizeSmall)
          .attr('fill', theme.text).text(s.label)
        if (onClick) legG.on('click', () => onClick(s.label))
      })
    } else {
      const legendY = H - legendBottomH + 4
      let lx = margin.left
      data.series.forEach((s, i) => {
        const color = getColor(i, theme)
        const legG = svg.append('g').style('cursor', clickCursor)
        legG.append('line').attr('x1', lx).attr('x2', lx + 20).attr('y1', legendY + 5).attr('y2', legendY + 5)
          .attr('stroke', color).attr('stroke-width', 2)
        legG.append('text').attr('x', lx + 24).attr('y', legendY + 9)
          .attr('font-family', theme.fontFamily).attr('font-size', theme.fontSizeSmall)
          .attr('fill', theme.text).text(s.label)
        if (onClick) legG.on('click', () => onClick(s.label))
        lx += 28 + s.label.length * 6.5 + 16
      })
    }
  }
}
