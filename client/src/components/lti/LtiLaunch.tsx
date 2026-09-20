/**
 * Launching an LTI tool from inside a lesson.
 *
 * ## Why this is not just an iframe with a `src`
 *
 * A launch begins with an authenticated **POST** to `/api/lti/launch`, and the
 * server answers with an auto-submitting HTML form aimed at the tool. An iframe
 * `src` cannot carry the JWT (an iframe sends no Authorization header), and the
 * response is HTML to execute rather than a URL to visit.
 *
 * So: axios fetches the HTML with the token attached, and it is handed to the
 * iframe through `srcdoc`. The form inside then submits cross-origin to the
 * tool, exactly as `response_mode=form_post` intends, and the signed token
 * never appears in a URL — where it would land in browser history, proxy logs
 * and `Referer` headers.
 *
 * ## The failure this is most likely to hit
 *
 * `frame-src` must include the tool's origin. It is not dynamic: nginx serves
 * the SPA from disk and the header is baked at generation time, so an admin
 * adds the origin to `EXTRA_FRAME_SRC` and regenerates. Until then the browser
 * blocks the frame silently — a blank box with a console error the student
 * never sees. The notice below says so rather than leaving a blank box.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import apiClient from '../../api/client';

export interface LtiLaunchProps {
  toolId: string;
  toolName: string;
  courseId?: number | null;
  sectionId?: number | null;
  /** Frame height in px. */
  height?: number;
}

export const LtiLaunch = ({
  toolId,
  toolName,
  courseId = null,
  sectionId = null,
  height = 600,
}: LtiLaunchProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Deliberately not automatic. A launch discloses the learner to a third party
  // and starts a session there; doing that the instant a lesson scrolls into
  // view is not a decision the student made.
  const start = async () => {
    setStarted(true);
    setError(null);
    try {
      const res = await apiClient.post<string>(
        '/lti/launch',
        { toolId, courseId, sectionId },
        { responseType: 'text' },
      );
      setHtml(res.data);
    } catch (err) {
      const detail =
        (err as { response?: { data?: { error_description?: string; error?: string } } }).response
          ?.data;
      setError(
        detail?.error_description ??
          t('lti_launch_failed', { defaultValue: 'This tool could not be opened.' }),
      );
      setStarted(false);
    }
  };

  // A blocked frame is silent — no load event, no error the page can catch. If
  // nothing has rendered a little after the srcdoc was set, say what is most
  // likely wrong instead of leaving a blank rectangle.
  const [maybeBlocked, setMaybeBlocked] = useState(false);
  useEffect(() => {
    if (!html) return;
    setMaybeBlocked(false);
    const timer = setTimeout(() => {
      try {
        const doc = frameRef.current?.contentDocument;
        // Still showing our own auto-submit form means the POST never left.
        if (doc && doc.forms.length > 0) setMaybeBlocked(true);
      } catch {
        // A cross-origin document means the launch navigated — success.
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [html]);

  if (error) {
    return (
      <div
        role="alert"
        className="my-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-300"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{toolName}</p>
            <p className="opacity-90">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="my-3 rounded-lg border border-gray-200 p-6 text-center dark:border-gray-700">
        <p className="mb-1 font-medium text-gray-900 dark:text-gray-100">{toolName}</p>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {t('lti_launch_notice', {
            defaultValue:
              'This opens an external tool. Your name and course may be shared with it.',
          })}
        </p>
        <button
          type="button"
          onClick={start}
          disabled={started}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {started ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          )}
          {t('lti_open_tool', { defaultValue: 'Open {{name}}', name: toolName })}
        </button>
      </div>
    );
  }

  return (
    <div className="my-3">
      <iframe
        ref={frameRef}
        srcDoc={html}
        title={toolName}
        style={{ height }}
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
        // allow-forms is what makes the auto-submit work; allow-same-origin is
        // required for the tool's own session cookies once it has loaded.
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="fullscreen; microphone; camera"
      />
      {maybeBlocked && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {t('lti_frame_blocked', {
            defaultValue:
              'The tool has not appeared. An administrator may need to allow its address to be framed (EXTRA_FRAME_SRC).',
          })}
        </p>
      )}
    </div>
  );
};

export default LtiLaunch;
