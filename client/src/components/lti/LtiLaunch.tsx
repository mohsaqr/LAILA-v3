/**
 * Launching an LTI tool from inside a lesson.
 *
 * ## Two steps, not one
 *
 * An authenticated **POST** to `/api/lti/launch` creates the launch and returns
 * a `startUrl`; the iframe then *navigates* to that URL. The POST carries the
 * JWT (an iframe navigation cannot), and the GET renders the auto-submitting
 * form under its own Content-Security-Policy.
 *
 * ## Why not srcdoc, which is what this did first
 *
 * The original version fetched the HTML with axios and injected it via
 * `srcdoc`. That cannot work, and the reason is worth writing down: **a srcdoc
 * iframe inherits the embedder's CSP**, so the tailored policy the server sends
 * with that HTML is never consulted. The SPA's policy applies instead, and it
 * carries `form-action 'self'` — which blocks the cross-origin POST to the
 * tool — and `script-src-attr 'none'`, which blocked the auto-submit. The
 * learner saw a permanently empty box. Verified in Chromium: *"Sending form
 * data to '<tool>' violates … form-action 'self'"*.
 *
 * A real navigation is governed by the response's own headers, so the launch
 * document can allow exactly the one origin it must post to and nothing else.
 * The signed token still never appears in a URL — it is a hidden field in the
 * form body of that response.
 *
 * ## The failure this is still most likely to hit
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
  const [startUrl, setStartUrl] = useState<string | null>(null);
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
      const res = await apiClient.post<{ data: { startUrl: string } }>('/lti/launch', {
        toolId,
        courseId,
        sectionId,
      });
      const url = res.data?.data?.startUrl;
      if (!url) throw new Error('no startUrl in launch response');
      setStartUrl(url);
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
    if (!startUrl) return;
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
  }, [startUrl]);

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

  if (!startUrl) {
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
        src={startUrl}
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
