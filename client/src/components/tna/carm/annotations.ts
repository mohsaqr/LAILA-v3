/**
 * Chart annotations — copied from JStats/src/viz/components/annotations.ts.
 */
import type * as d3 from 'd3'
import type { CarmTheme } from './theme.js'
import { EXTENSION_THEME } from './theme.js'

type SVGSelection = d3.Selection<SVGSVGElement, unknown, null, undefined>

export function addSubtitle(
  svg: SVGSelection,
  title: string,
  subtitle: string,
  _width: number,
  theme: CarmTheme = EXTENSION_THEME,
): void {
  if (!title) return

  svg.append('rect')
    .attr('x', 16).attr('y', 8).attr('width', 3).attr('height', 18)
    .attr('rx', 1.5).attr('fill', theme.colors[0] ?? '#4e79a7')

  svg.append('text')
    .attr('x', 24).attr('y', 22)
    .attr('font-family', theme.fontFamily).attr('font-size', theme.fontSizeTitle)
    .attr('font-weight', '700').attr('letter-spacing', '-0.3')
    .attr('fill', theme.text).text(title)

  if (subtitle) {
    svg.append('text')
      .attr('x', 24).attr('y', 36)
      .attr('font-family', theme.fontFamily).attr('font-size', theme.fontSizeSmall)
      .attr('font-style', 'italic').attr('fill', theme.textAnnotation)
      .text(subtitle)
  }
}

export function addCaption(
  svg: SVGSelection,
  text: string,
  _width: number,
  height: number,
  theme: CarmTheme = EXTENSION_THEME,
): void {
  svg.append('text')
    .attr('x', 16).attr('y', height - 6)
    .attr('font-family', theme.fontFamily).attr('font-size', theme.fontSizeSmall - 1)
    .attr('fill', theme.textMuted).style('font-style', 'italic').text(text)
}
