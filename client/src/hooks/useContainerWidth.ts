import { useRef, useState, useEffect } from 'react';

export function useContainerWidth(fallback = 600) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth || fallback);
    return () => ro.disconnect();
  }, [fallback]);

  return { ref, width };
}
