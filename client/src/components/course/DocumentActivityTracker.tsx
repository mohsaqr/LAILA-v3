import { useEffect, useRef } from 'react';
import activityLogger from '../../services/activityLogger';

export interface DocumentActivityContext {
  courseId?: number;
  moduleId?: number;
  lectureId?: number;
  sectionId: number;
  /** The presentation/document file name — logged as the object title. */
  fileName: string;
  fileType?: string | null;
  /** Coarse document kind for analytics filtering. */
  kind: 'powerpoint' | 'pdf';
}

interface DocumentActivityTrackerProps {
  ctx: DocumentActivityContext;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps an inline document/presentation viewer and records the learning
 * activity that is actually observable from our origin:
 *
 *   - presentation.view   — fired once when the viewer scrolls into view
 *   - presentation.dwell  — seconds the viewer was visible AND the tab focused
 *   - presentation.engaged — fired once when the user clicks into the embedded
 *                            viewer (the parent window blurs to the iframe)
 *
 * Per-slide page, scroll-within-deck and zoom are NOT observable: those happen
 * inside the cross-origin Google viewer iframe (PowerPoint) or the browser's
 * built-in PDF viewer, which the same-origin policy hides from our scripts.
 *
 * Course / lecture / section titles are enriched server-side from the IDs, so
 * we only pass identifiers plus the file name here.
 */
export const DocumentActivityTracker = ({ ctx, className, children }: DocumentActivityTrackerProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const base = {
      objectType: 'file' as const,
      objectId: ctx.sectionId,
      objectTitle: ctx.fileName,
      courseId: ctx.courseId,
      moduleId: ctx.moduleId,
      lectureId: ctx.lectureId,
      sectionId: ctx.sectionId,
      extensions: { kind: ctx.kind, fileName: ctx.fileName, fileType: ctx.fileType ?? undefined },
    };

    let viewed = false;
    let engaged = false;
    let visible = false;
    let dwellStart: number | null = null;
    let dwellAccumMs = 0;

    const startDwell = () => {
      if (dwellStart === null) dwellStart = performance.now();
    };
    const stopDwell = () => {
      if (dwellStart !== null) {
        dwellAccumMs += performance.now() - dwellStart;
        dwellStart = null;
      }
    };
    const flushDwell = () => {
      stopDwell();
      const seconds = Math.round(dwellAccumMs / 1000);
      if (seconds >= 1) {
        activityLogger
          .log({ verb: 'progressed', actionSubtype: 'presentation.dwell', duration: seconds, ...base })
          .catch(() => {});
        dwellAccumMs = 0;
      }
    };
    // Active = on screen and the tab is in the foreground.
    const evaluate = () => {
      if (visible && document.visibilityState === 'visible') startDwell();
      else stopDwell();
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        if (visible && !viewed) {
          viewed = true;
          activityLogger.log({ verb: 'viewed', actionSubtype: 'presentation.view', ...base }).catch(() => {});
        }
        evaluate();
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(el);

    const onVisibilityChange = () => {
      evaluate();
      if (document.visibilityState === 'hidden') flushDwell();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Clicking inside the embedded viewer blurs the parent window and moves
    // focus to the iframe — the one interaction signal we can observe.
    const onWindowBlur = () => {
      if (engaged || !visible) return;
      const active = document.activeElement;
      if (active && active.tagName === 'IFRAME' && el.contains(active)) {
        engaged = true;
        activityLogger.log({ verb: 'interacted', actionSubtype: 'presentation.engaged', ...base }).catch(() => {});
      }
    };
    window.addEventListener('blur', onWindowBlur);

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      flushDwell();
    };
  }, [ctx.sectionId, ctx.courseId, ctx.moduleId, ctx.lectureId, ctx.fileName, ctx.fileType, ctx.kind]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
};
