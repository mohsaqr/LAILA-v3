/**
 * Carm theme — copied from JStats/src/viz/themes/default.ts.
 * Compact variant for Chrome extension sidepanel.
 */

export const CARM_PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
  '#59a14f', '#af7aa1', '#ff9da7', '#9c755f',
] as const

export interface CarmTheme {
  readonly background: string
  readonly surface: string
  readonly text: string
  readonly textMuted: string
  readonly textAnnotation: string
  readonly gridLine: string
  readonly axisLine: string
  readonly colors: readonly string[]
  readonly fontFamily: string
  readonly fontFamilyMono: string
  readonly fontSize: number
  readonly fontSizeSmall: number
  readonly fontSizeTitle: number
  readonly marginTop: number
  readonly marginRight: number
  readonly marginBottom: number
  readonly marginLeft: number
  readonly pointOpacity: number
  readonly violinOpacity: number
  readonly ciOpacity: number
}

/** Compact theme for extension panels. */
export const EXTENSION_THEME: CarmTheme = {
  background: '#ffffff',
  surface: '#f8f9fa',
  text: '#1a1a2e',
  textMuted: '#6c757d',
  textAnnotation: '#495057',
  gridLine: '#eaeef3',
  axisLine: '#c4cdd6',
  colors: CARM_PALETTE,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontFamilyMono: "Menlo, Consolas, monospace",
  fontSize: 11,
  fontSizeSmall: 10,
  fontSizeTitle: 13,
  marginTop: 40,
  marginRight: 16,
  marginBottom: 48,
  marginLeft: 48,
  pointOpacity: 0.55,
  violinOpacity: 0.72,
  ciOpacity: 0.15,
}

export function applyTheme(container: HTMLElement, theme: CarmTheme): void {
  container.style.background = theme.background
}

export function getColor(index: number, theme: CarmTheme = EXTENSION_THEME): string {
  return theme.colors[index % theme.colors.length]!
}
