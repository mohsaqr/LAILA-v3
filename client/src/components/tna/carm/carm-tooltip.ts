/**
 * Hover tooltip — copied from JStats/src/viz/components/tooltip.ts.
 */
import type { CarmTheme } from './theme.js'
import { EXTENSION_THEME } from './theme.js'

let tooltipEl: HTMLDivElement | null = null

function ensureTooltip(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div')
    tooltipEl.id = 'carm-tooltip'
    tooltipEl.style.cssText = `
      position: fixed; pointer-events: none; z-index: 9999;
      padding: 8px 12px; border-radius: 6px; font-size: 12px;
      line-height: 1.5; max-width: 240px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      opacity: 0; transition: opacity 0.15s ease;
    `
    document.body.appendChild(tooltipEl)
  }
  return tooltipEl
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function showTooltip(
  event: MouseEvent,
  content: string,
  theme: CarmTheme = EXTENSION_THEME,
): void {
  const el = ensureTooltip()
  if (content) el.innerHTML = content
  el.style.background = theme.surface
  el.style.color = theme.text
  el.style.border = `1px solid ${theme.gridLine}`
  el.style.fontFamily = theme.fontFamily
  const x = event.clientX + 14
  const y = event.clientY - 28
  el.style.left = `${Math.min(x, window.innerWidth - 248)}px`
  el.style.top = `${Math.max(y, 8)}px`
  el.style.display = 'block'
  el.style.opacity = '1'
}

export function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.style.opacity = '0'
    setTimeout(() => { if (tooltipEl && tooltipEl.style.opacity === '0') tooltipEl.style.display = 'none' }, 150)
  }
}

export function formatTooltipRow(label: string, value: string | number): string {
  const safeLabel = escapeHtml(label)
  const safeValue = typeof value === 'number' ? value.toFixed(2) : escapeHtml(value)
  return `<div style="display:flex;justify-content:space-between;gap:12px">
    <span style="opacity:0.7">${safeLabel}</span><strong>${safeValue}</strong></div>`
}
