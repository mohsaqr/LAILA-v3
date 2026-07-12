import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Presentation,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { resolveFileUrl } from '../../api/client';
import activityLogger from '../../services/activityLogger';
import { presentationsApi, type SlideManifest } from '../../api/presentations';

/** Learning-activity context for the per-slide events this viewer emits. */
export interface PptxTrackingContext {
  courseId?: number;
  moduleId?: number;
  lectureId?: number;
  fileType?: string | null;
}

interface PptxViewerProps {
  /** Original .pptx URL (already resolved), used for the Download action. */
  url: string;
  fileName: string;
  /** Lecture section id — drives conversion and is the tracked object. */
  sectionId: number;
  onDownload?: (e: React.MouseEvent) => void;
  /** When provided, per-slide activity is logged for this context. */
  tracking?: PptxTrackingContext;
}

type Direction = 'next' | 'prev' | 'jump';
type Status = 'loading' | 'ready' | 'error';

// ~3 minutes of 2s polling before giving up on a slow conversion.
const POLL_MS = 2000;
const MAX_ATTEMPTS = 90;

/**
 * Records per-slide learning activity: a one-time `view`, focused seconds per
 * slide (`slide_dwell`), each navigation (`slide_changed`), and `completed`
 * when the last slide is reached. Dwell counts only while the deck is on screen
 * AND the tab is focused (same model as DocumentActivityTracker).
 */
const usePptxTracking = (
  sectionId: number,
  fileName: string,
  total: number,
  tracking?: PptxTrackingContext,
) => {
  const ref = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(false);
  const cfg = useRef({ fileName, total, tracking });
  cfg.current = { fileName, total, tracking };

  const state = useRef({
    viewed: false,
    current: 1,
    dwellStart: null as number | null,
    accumMs: 0,
    visited: new Set<number>(),
    completed: false,
  });

  const log = useCallback(
    (
      verb: 'viewed' | 'progressed' | 'interacted' | 'completed',
      actionSubtype: string,
      extra: Record<string, unknown>,
      extensionsExtra: Record<string, unknown>,
    ) => {
      const { fileName: fn, total: tot, tracking: ctx } = cfg.current;
      if (!ctx) return;
      activityLogger
        .log({
          verb,
          objectType: 'file',
          objectId: sectionId,
          objectTitle: fn,
          courseId: ctx.courseId,
          moduleId: ctx.moduleId,
          lectureId: ctx.lectureId,
          sectionId,
          actionSubtype,
          ...extra,
          extensions: {
            kind: 'powerpoint',
            fileName: fn,
            fileType: ctx.fileType ?? undefined,
            totalSlides: tot,
            ...extensionsExtra,
          },
        })
        .catch(() => {});
    },
    [sectionId],
  );

  const isActive = () => visibleRef.current && document.visibilityState === 'visible';

  const startDwell = useCallback(() => {
    const s = state.current;
    if (s.dwellStart === null && isActive()) s.dwellStart = performance.now();
  }, []);

  const stopDwell = useCallback(() => {
    const s = state.current;
    if (s.dwellStart !== null) {
      s.accumMs += performance.now() - s.dwellStart;
      s.dwellStart = null;
    }
  }, []);

  const flushDwell = useCallback(
    (slide: number) => {
      stopDwell();
      const seconds = Math.round(state.current.accumMs / 1000);
      if (seconds >= 1) log('progressed', 'presentation.slide_dwell', { duration: seconds }, { slide });
      state.current.accumMs = 0;
    },
    [log, stopDwell],
  );

  const visit = useCallback(
    (slide: number) => {
      const s = state.current;
      const tot = cfg.current.total;
      if (tot <= 0) return;
      s.visited.add(slide);
      if (!s.completed && (slide >= tot || s.visited.size >= tot)) {
        s.completed = true;
        log('completed', 'presentation.completed', { progress: 100 }, { slide });
      }
    },
    [log],
  );

  const activate = useCallback(() => {
    const s = state.current;
    if (!s.viewed && visibleRef.current && cfg.current.total > 0) {
      s.viewed = true;
      log('viewed', 'presentation.view', {}, { slide: s.current });
      visit(s.current);
    }
    if (isActive()) startDwell();
    else stopDwell();
  }, [log, startDwell, stopDwell, visit]);

  const notifyNavigate = useCallback(
    (from: number, to: number, direction: Direction) => {
      flushDwell(from);
      state.current.current = to;
      log('interacted', 'presentation.slide_changed', {}, { from, to, direction });
      visit(to);
      startDwell();
    },
    [flushDwell, log, startDwell, visit],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        visibleRef.current = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        activate();
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(el);

    const onVisibility = () => {
      if (isActive()) startDwell();
      else {
        stopDwell();
        if (document.visibilityState === 'hidden') flushDwell(state.current.current);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      flushDwell(state.current.current);
    };
  }, [activate, flushDwell, startDwell, stopDwell]);

  return { ref, visibleRef, notifyNavigate, activate };
};

/**
 * Inline PowerPoint (.ppt/.pptx) viewer. The server converts the deck to
 * pixel-exact per-slide images (LibreOffice + poppler); this component polls for
 * the result and shows the slides one at a time — LinkedIn-style — with
 * back/forward navigation and per-slide activity tracking. When conversion is
 * unavailable it falls back to a download notice.
 */
export const PptxViewer = ({ url, fileName, sectionId, onDownload, tracking }: PptxViewerProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();

  const [manifest, setManifest] = useState<SlideManifest | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [current, setCurrent] = useState(0);

  const total = manifest?.images?.length ?? 0;
  const { ref, visibleRef, notifyNavigate, activate } = usePptxTracking(sectionId, fileName, total, tracking);

  // Load the slide manifest, polling while the server is still converting.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;

    const poll = async () => {
      try {
        const m = await presentationsApi.getSlides(sectionId);
        if (cancelled) return;
        if (m.status === 'ready' && m.images?.length) {
          setManifest(m);
          setStatus('ready');
        } else if (m.status === 'failed' || attempts++ >= MAX_ATTEMPTS) {
          setStatus('error');
        } else {
          timer = setTimeout(poll, POLL_MS);
        }
      } catch {
        if (cancelled) return;
        if (attempts++ >= MAX_ATTEMPTS) setStatus('error');
        else timer = setTimeout(poll, POLL_MS);
      }
    };

    setStatus('loading');
    setManifest(null);
    setCurrent(0);
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sectionId]);

  // Emit the initial `view` once the deck is ready and on screen.
  useEffect(() => {
    if (status === 'ready') activate();
  }, [status, activate]);

  const goTo = useCallback(
    (to: number, direction: Direction) => {
      setCurrent((prev) => {
        if (to < 0 || to >= total || to === prev) return prev;
        notifyNavigate(prev + 1, to + 1, direction);
        return to;
      });
    },
    [total, notifyNavigate],
  );

  // Keyboard navigation while the deck is on screen.
  useEffect(() => {
    if (status !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      if (!visibleRef.current) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goTo(current + 1, 'next');
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goTo(current - 1, 'prev');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, current, goTo, visibleRef]);

  // ---- theme tokens for the chrome ----
  const border = isDark ? '#374151' : '#e5e7eb';
  const headerBg = isDark ? '#1f2937' : '#ffffff';
  const bodyBg = isDark ? '#111827' : '#f3f4f6';
  const textPrimary = isDark ? '#f3f4f6' : '#111827';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const accent = isDark ? '#fb923c' : '#ea580c';

  const navBtn =
    'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-200 enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  const aspect = manifest?.width && manifest?.height ? `${manifest.width} / ${manifest.height}` : '16 / 9';
  const nextSrc = manifest?.images && current + 1 < total ? resolveFileUrl(manifest.images[current + 1]) : null;

  return (
    <div ref={ref} className="rounded-xl border overflow-hidden" style={{ borderColor: border }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-3.5 py-2.5 border-b"
        style={{ backgroundColor: headerBg, borderColor: border }}
      >
        <span
          aria-hidden="true"
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ backgroundColor: `${accent}1f`, color: accent }}
        >
          <Presentation className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: textPrimary }} title={fileName}>
            {fileName}
          </div>
          <div className="text-xs font-medium" style={{ color: textMuted }}>
            {t('courses:presentation', { defaultValue: 'Presentation' })}
          </div>
        </div>
        <a
          href={url}
          download={fileName || undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDownload}
          aria-label={`${t('common:download', { defaultValue: 'Download' })} ${fileName}`}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('common:download', { defaultValue: 'Download' })}</span>
        </a>
      </div>

      {/* Body */}
      {status === 'loading' && (
        <div
          className="flex flex-col items-center justify-center gap-2 px-6 py-16"
          style={{ backgroundColor: bodyBg }}
        >
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: textMuted }} aria-hidden="true" />
          <p className="text-sm" style={{ color: textMuted }}>
            {t('courses:slide_processing', { defaultValue: 'Preparing slides…' })}
          </p>
        </div>
      )}

      {status === 'error' && (
        <div
          className="flex flex-col items-center justify-center text-center gap-2 px-6 py-10"
          style={{ backgroundColor: bodyBg }}
        >
          <AlertTriangle className="w-7 h-7" style={{ color: textMuted }} aria-hidden="true" />
          <p className="text-sm font-medium" style={{ color: textPrimary }}>
            {t('courses:slide_render_failed', { defaultValue: 'This presentation could not be displayed inline' })}
          </p>
          <p className="text-xs max-w-md" style={{ color: textMuted }}>
            {t('courses:slides_preview_unavailable_hint', {
              defaultValue: 'The presentation can be downloaded and opened in PowerPoint.',
            })}
          </p>
        </div>
      )}

      {status === 'ready' && manifest?.images && (
        <>
          <div className="p-3 sm:p-4" style={{ backgroundColor: bodyBg }}>
            <div
              className="mx-auto max-w-4xl bg-white shadow-sm rounded-lg overflow-hidden"
              style={{ aspectRatio: aspect }}
            >
              <img
                src={resolveFileUrl(manifest.images[current])}
                alt={t('courses:slide_of', {
                  defaultValue: 'Slide {{current}} of {{total}}',
                  current: current + 1,
                  total,
                })}
                className="w-full h-full object-contain"
                draggable={false}
              />
            </div>
            {/* Preload the next slide so navigation feels instant. */}
            {nextSrc && <img src={nextSrc} alt="" className="hidden" aria-hidden="true" />}
          </div>

          {/* Navigation */}
          <div
            className="flex items-center justify-center gap-4 px-3.5 py-2.5 border-t"
            style={{ backgroundColor: headerBg, borderColor: border }}
          >
            <button
              type="button"
              className={navBtn}
              onClick={() => goTo(current - 1, 'prev')}
              disabled={current <= 0}
              aria-label={t('courses:slide_prev', { defaultValue: 'Previous slide' })}
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <span
              className="text-sm font-medium tabular-nums min-w-[64px] text-center"
              style={{ color: textPrimary }}
              aria-live="polite"
            >
              {t('courses:slide_counter', {
                defaultValue: '{{current}} / {{total}}',
                current: current + 1,
                total,
              })}
            </span>
            <button
              type="button"
              className={navBtn}
              onClick={() => goTo(current + 1, 'next')}
              disabled={current >= total - 1}
              aria-label={t('courses:slide_next', { defaultValue: 'Next slide' })}
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
