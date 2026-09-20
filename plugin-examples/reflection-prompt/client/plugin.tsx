/**
 * Reflection Prompt — client half.
 *
 * Ordinary React. `useState` here is LAILA's own React instance, because the
 * SDK's build step rewrote this import to read from the host registry — which
 * is the whole reason a plugin block can be a real component in the real tree
 * instead of an iframe. Nothing in this file knows that happened.
 *
 * Exports two components, named in `laila-plugin.json`:
 *   - `ReflectionBlock` — what a student sees
 *   - `ReflectionEditor` — what a teacher sees while authoring
 */

import { useEffect, useState } from 'react';

/** Props the host passes to every plugin component. */
interface PluginProps {
  laila: {
    context: {
      userId: number;
      role: 'student' | 'instructor' | 'admin';
      courseId: number | null;
      instanceKey: string;
    };
    getState(): Promise<{ data: Record<string, unknown>; completed: boolean }>;
    setState(next: {
      data?: Record<string, unknown>;
      completed?: boolean;
      score?: number | null;
    }): Promise<unknown>;
    getConfig<T>(): Promise<T>;
    setConfig(config: Record<string, unknown>): Promise<void>;
    call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
  };
  config: Record<string, unknown>;
  editing: boolean;
}

interface ReflectionConfig {
  prompt?: string;
  minWords?: number;
  aiFollowUp?: boolean;
}

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export function ReflectionBlock({ laila, config }: PluginProps) {
  const cfg = config as ReflectionConfig;
  const minWords = cfg.minWords ?? 40;

  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore whatever this student wrote before. A block that forgets a draft
  // on navigation is the fastest way to lose a student's trust.
  useEffect(() => {
    let cancelled = false;
    laila
      .getState()
      .then((state) => {
        if (cancelled) return;
        if (typeof state.data.text === 'string') setText(state.data.text);
        setSaved(state.completed);
      })
      .catch(() => {
        /* An unreadable draft is not worth an error; start empty. */
      });
    return () => {
      cancelled = true;
    };
  }, [laila]);

  const words = wordCount(text);
  const longEnough = words >= minWords;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // The plugin's own route does the durable work and the AI follow-up…
      const result = await laila.call<{ followUp: string | null }>('/submit', {
        method: 'POST',
        body: {
          instanceKey: laila.context.instanceKey,
          courseId: laila.context.courseId,
          text,
          aiFollowUp: !!cfg.aiFollowUp,
        },
      });
      // …and the host's own state store records completion, which is what the
      // gradebook and the export read.
      await laila.setState({ data: { text }, completed: true, score: 1 });
      setFollowUp(result.followUp);
      setSaved(true);
    } catch {
      setError('Could not save your reflection. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="my-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <p className="mb-2 font-medium text-gray-900 dark:text-gray-100">
        {cfg.prompt ?? 'What is one thing that changed in your thinking this week?'}
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        disabled={busy}
        aria-label="Your reflection"
        className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
      />

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={longEnough ? 'text-green-600' : 'text-gray-500'}>
          {words} / {minWords} words
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!longEnough || busy}
          className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {saved ? 'Update' : 'Submit'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {saved && !error && (
        <p className="mt-2 text-xs text-green-600">Saved. Thank you for reflecting.</p>
      )}
      {followUp && (
        <div className="mt-3 rounded-md bg-teal-50 p-3 text-sm dark:bg-teal-950/40">
          <span className="font-medium">A question back: </span>
          {followUp}
        </div>
      )}
    </div>
  );
}

/**
 * The authoring view.
 *
 * A plugin that only needs simple fields can omit this entirely and let the
 * host render a form from the manifest's `settings`. This one ships an editor
 * to show the shape — and because a live word-count preview is worth more than
 * a generic number input.
 */
export function ReflectionEditor({ laila, config }: PluginProps) {
  const cfg = config as ReflectionConfig;
  const [prompt, setPrompt] = useState(cfg.prompt ?? '');
  const [minWords, setMinWords] = useState(cfg.minWords ?? 40);
  const [aiFollowUp, setAiFollowUp] = useState(!!cfg.aiFollowUp);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const save = async (next: Partial<ReflectionConfig>) => {
    const merged = { prompt, minWords, aiFollowUp, ...next };
    setStatus('saving');
    try {
      await laila.setConfig(merged);
      setStatus('saved');
    } catch {
      setStatus('idle');
    }
  };

  return (
    <div className="my-3 space-y-3 rounded-lg border border-amber-300 bg-amber-50/50 p-4 dark:border-amber-700/60 dark:bg-amber-950/20">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
        Reflection settings
      </p>

      <label className="block text-sm">
        <span className="mb-1 block text-gray-700 dark:text-gray-300">Prompt</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={() => save({ prompt })}
          rows={2}
          className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-gray-700 dark:text-gray-300">Minimum words</span>
        <input
          type="number"
          min={0}
          max={500}
          value={minWords}
          onChange={(e) => setMinWords(Number(e.target.value))}
          onBlur={() => save({ minWords })}
          className="w-24 rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={aiFollowUp}
          onChange={(e) => {
            setAiFollowUp(e.target.checked);
            void save({ aiFollowUp: e.target.checked });
          }}
        />
        <span className="text-gray-700 dark:text-gray-300">Ask an AI follow-up question</span>
      </label>

      {status === 'saved' && <p className="text-xs text-green-600">Settings saved.</p>}
    </div>
  );
}
