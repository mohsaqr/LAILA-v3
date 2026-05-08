import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { resolveFileUrl } from '../../api/client';
import type { ContinueLearningItem } from '../../api/me';

interface ContinueLearningRailProps {
  items: ContinueLearningItem[];
  /** "X% Complete" template — caller provides via i18n. */
  percentLabel: (percent: number) => string;
}

export const ContinueLearningRail = ({ items, percentLabel }: ContinueLearningRailProps) => {
  const { isDark } = useTheme();
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  // Recompute prev/next availability whenever the user scrolls or the
  // viewport / items change.
  const updateButtons = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateButtons();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateButtons, { passive: true });
    const ro = new ResizeObserver(updateButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateButtons);
      ro.disconnect();
    };
  }, [items.length]);

  if (items.length === 0) return null;

  const scrollByTile = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    // Scroll by the width of the first child + the flex gap (16 px).
    const first = el.querySelector<HTMLElement>('[data-tile]');
    const tileWidth = (first?.offsetWidth ?? 288) + 16;
    el.scrollBy({ left: dir * tileWidth, behavior: 'smooth' });
  };

  const navBtnBase =
    'absolute top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center w-9 h-9 rounded-full shadow-md transition-all disabled:opacity-0 disabled:pointer-events-none';

  return (
    <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
      {/* Prev */}
      <button
        type="button"
        onClick={() => scrollByTile(-1)}
        disabled={!canPrev}
        aria-label="Scroll left"
        className={`${navBtnBase} left-1 sm:left-3`}
        style={{
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
          color: isDark ? '#cbd5e1' : '#374151',
          border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
        }}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Next */}
      <button
        type="button"
        onClick={() => scrollByTile(1)}
        disabled={!canNext}
        aria-label="Scroll right"
        className={`${navBtnBase} right-1 sm:right-3`}
        style={{
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
          color: isDark ? '#cbd5e1' : '#374151',
          border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
        }}
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Track — overflow hidden so the scrollbar never paints; nav
          buttons drive the scroll instead. */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-hidden snap-x snap-mandatory scroll-smooth"
      >
        {items.map(item => {
          const pct = Math.round(item.progress);
          return (
            <Link
              key={item.courseId}
              data-tile
              to={`/courses/${item.courseId}`}
              className="snap-start shrink-0 w-64 sm:w-72 rounded-2xl border overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                borderColor: isDark ? '#374151' : '#f3f4f6',
              }}
            >
              <div
                className="aspect-[16/9] flex items-center justify-center relative"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #088F8F 0%, #14b8a6 100%)',
                }}
              >
                {item.courseThumbnail ? (
                  <img
                    src={resolveFileUrl(item.courseThumbnail) || item.courseThumbnail}
                    alt={item.courseTitle}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <GraduationCap className="w-10 h-10 text-white/80" />
                )}
              </div>
              <div className="p-4">
                <h3
                  className="text-sm font-semibold mb-3 line-clamp-2 min-h-[2.5rem]"
                  style={{ color: isDark ? '#f3f4f6' : '#111827' }}
                >
                  {item.courseTitle}
                </h3>
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    {percentLabel(pct)}
                  </span>
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: isDark ? '#22d3d3' : '#077575' }}
                  >
                    {pct}%
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundImage: 'linear-gradient(90deg, #088F8F 0%, #14b8a6 100%)',
                    }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
