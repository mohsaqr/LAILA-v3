import { useLayoutEffect } from 'react';

/**
 * Grow a chat textarea with its content, up to `maxRows`, then scroll.
 *
 * Chat inputs were fixed at one row, so a long message scrolled inside a
 * single line and the writer could not see what they had typed. This is the
 * behaviour every messaging app has: the box grows until it would take over the
 * view, then stops and scrolls.
 *
 * Takes the caller's existing ref rather than returning its own — these inputs
 * are already ref'd for focus management, and two refs on one element means
 * merging them at every call site.
 *
 * useLayoutEffect, not useEffect: the height is measured and written before
 * paint, otherwise the box visibly jumps a frame after each keystroke.
 */
export function useAutoGrowTextarea(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxRows = 8
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reset first: scrollHeight only shrinks back if the element is allowed to
    // be smaller than its content, so measuring without this makes the box
    // grow monotonically and never recover when text is deleted.
    el.style.height = 'auto';

    const styles = window.getComputedStyle(el);
    const lineHeight = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.2 || 20;
    const vertical =
      parseFloat(styles.paddingTop) +
      parseFloat(styles.paddingBottom) +
      parseFloat(styles.borderTopWidth) +
      parseFloat(styles.borderBottomWidth);

    const maxHeight = lineHeight * maxRows + vertical;
    const needed = el.scrollHeight;

    // getComputedStyle returns empty strings for an element that is not laid
    // out (inside a `display: none` parent, say), so every parseFloat above
    // yields NaN and this would assign the string "NaNpx" — which the browser
    // discards silently, leaving the height:'auto' set above and overflow
    // hidden, because `needed > NaN` is false. Bail instead of writing garbage.
    if (!Number.isFinite(maxHeight) || !Number.isFinite(needed)) return;

    el.style.height = `${Math.min(needed, maxHeight)}px`;
    el.style.overflowY = needed > maxHeight ? 'auto' : 'hidden';
  }, [ref, value, maxRows]);
}
