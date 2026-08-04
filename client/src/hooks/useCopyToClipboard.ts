import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Copy text to the clipboard with the app's transient "Copied" feedback.
 *
 * The clipboard API is permission-gated and rejects in insecure contexts, in
 * some embedded webviews, and when the document is not focused. A lab is the
 * wrong place to throw for that: the text is already on screen and selectable,
 * so a failed copy returns `false` and leaves the UI alone rather than
 * interrupting a student mid-exercise.
 *
 * `copy` is referentially stable, so passing it to a memoized child does not
 * defeat the memo.
 */
export const useCopyToClipboard = (resetMs = 1500) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Without this a copy just before unmount leaves a timer that fires into a
  // dead component.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return false;
      }
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), resetMs);
      return true;
    },
    [resetMs]
  );

  return { copied, copy };
};
