/**
 * Video activity tracking built on the xAPI Video Profile, via the
 * `xapi-youtube` package (github:hanieas/xapi-youtube).
 *
 * The package is a browser library that wires the YouTube IFrame API to the
 * xAPI Video Profile and emits statements (initialized / played / paused /
 * seeked / playback-rate-changed / completed / abandoned / terminated).
 * Upstream it posts those statements straight to an LRS; here we shim its
 * `ADL.XAPIWrapper.sendStatement` so every statement is funnelled into our
 * own `activityLogger` instead — the same batch pipeline the rest of the app
 * uses.
 *
 * Two entry points, one for each lesson video kind:
 *   - {@link trackYouTubeEmbed}  — embedded YouTube videos, driven by the
 *     package's own statement engine over the YouTube IFrame API.
 *   - {@link trackUploadedVideo} — uploaded HTML5 `<video>` files. The package
 *     only understands YouTube, so we reproduce the exact same Video Profile
 *     event model over native media events, reusing the package's vocabulary.
 *
 * Both also emit a coarse `video.watch_tick` (`progressed`) every 30s of real
 * playback, preserving the "how far did the student get" signal we already had.
 */
import 'xapi-youtube/videoprofile';
import 'xapi-youtube';
import { activityLogger, type ActivityVerb } from './activityLogger';

// ---------------------------------------------------------------------------
// Minimal typings for the globals the package and the YouTube IFrame API set.
// ---------------------------------------------------------------------------

interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YTStateEvent {
  data: number;
  target: YTPlayer;
}

interface YTPlayerOptions {
  events: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: YTStateEvent) => void;
    onPlaybackRateChange?: (event: YTStateEvent) => void;
  };
}

interface YTNamespace {
  Player: new (el: HTMLElement | string, opts: YTPlayerOptions) => YTPlayer;
}

/** A raw xAPI statement as produced by the package's statement engine. */
interface XapiStatement {
  verb: { id: string; display: Record<string, string> };
  result?: { duration?: string; completion?: boolean; extensions?: Record<string, unknown> };
  object?: { _laila?: StatementHook } & Record<string, unknown>;
}

interface XapiEngine {
  changeConfig(cfg: { actor: object; object: object; context: object }): void;
  onStateChange(event: YTStateEvent): void;
  onPlaybackRateChange(event: YTStateEvent): void;
}

/** Per-tracker hook smuggled through the statement's `object` so the single
 *  global `sendStatement` shim can route a statement back to its tracker. */
interface StatementHook {
  onStatement(stmt: XapiStatement): void;
}

interface VideoProfileEntry {
  '@id': string;
  prefLabel?: Record<string, string>;
}

interface ADLNamespace {
  videoprofile?: {
    verbs: Record<string, VideoProfileEntry>;
    references: Record<string, VideoProfileEntry>;
  };
  XAPIWrapper?: { lrs: { endpoint: string; auth: string }; sendStatement(stmt: XapiStatement): void };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
    ADL?: ADLNamespace;
    XAPIYoutubeStatements?: new () => XapiEngine;
    player?: YTPlayer;
  }
}

// ---------------------------------------------------------------------------
// Context + verb vocabulary
// ---------------------------------------------------------------------------

export interface VideoXapiContext {
  courseId?: number;
  lectureId?: number;
  sectionId?: number;
  title?: string;
  src?: string;
  mode: 'file' | 'embed';
}

type VerbKey =
  | 'initialized'
  | 'played'
  | 'paused'
  | 'seeked'
  | 'playback_rate_changed'
  | 'completed'
  | 'abandoned'
  | 'terminated';

interface VerbMeta {
  /** Canonical xAPI Video Profile verb IRI. */
  iri: string;
  /** Human-readable verb, as the package displays it. */
  display: string;
  /** Fine-grained subtype stored on the log row (`video.*`). */
  actionSubtype: string;
  /** Coarse verb from the 10-verb taxonomy the TNA pipeline understands. */
  verb: ActivityVerb;
}

/** Fallback IRIs (used if the profile object isn't available for any reason). */
const FALLBACK_IRI: Record<VerbKey, string> = {
  initialized: 'http://adlnet.gov/expapi/verbs/initialized',
  played: 'https://w3id.org/xapi/video/verbs/played',
  paused: 'https://w3id.org/xapi/video/verbs/paused',
  seeked: 'https://w3id.org/xapi/video/verbs/seeked',
  playback_rate_changed: 'http://adlnet.gov/expapi/verbs/interacted',
  completed: 'http://adlnet.gov/expapi/verbs/completed',
  terminated: 'http://adlnet.gov/expapi/verbs/terminated',
  abandoned: 'https://w3id.org/xapi/adl/verbs/abandoned',
};

const profile = () => (typeof window !== 'undefined' ? window.ADL?.videoprofile : undefined);

const iriFor = (key: VerbKey): string => {
  const p = profile();
  switch (key) {
    case 'played': return p?.verbs.played?.['@id'] ?? FALLBACK_IRI.played;
    case 'paused': return p?.verbs.paused?.['@id'] ?? FALLBACK_IRI.paused;
    case 'seeked': return p?.verbs.seeked?.['@id'] ?? FALLBACK_IRI.seeked;
    case 'playback_rate_changed': return p?.references.interacted?.['@id'] ?? FALLBACK_IRI.playback_rate_changed;
    case 'initialized': return p?.references.initialized?.['@id'] ?? FALLBACK_IRI.initialized;
    case 'completed': return p?.references.completed?.['@id'] ?? FALLBACK_IRI.completed;
    case 'terminated': return p?.references.terminated?.['@id'] ?? FALLBACK_IRI.terminated;
    case 'abandoned': return p?.references.abandoned?.['@id'] ?? FALLBACK_IRI.abandoned;
  }
};

// The `verb` here is the xAPI Video Profile verb itself — surfaced directly in
// the activity log's Verb column. `progressed` is reserved for the periodic
// watch heartbeat (see emitTick), which is the "how far did they get" signal.
const VERB_META: Record<VerbKey, Omit<VerbMeta, 'iri'>> = {
  initialized:           { display: 'initialized',            actionSubtype: 'video.initialized',           verb: 'initialized' },
  played:                { display: 'played',                 actionSubtype: 'video.played',                verb: 'played' },
  paused:                { display: 'paused',                 actionSubtype: 'video.paused',                verb: 'paused' },
  seeked:                { display: 'seeked',                 actionSubtype: 'video.seeked',                verb: 'seeked' },
  playback_rate_changed: { display: 'playback-rate-changed',  actionSubtype: 'video.playback_rate_changed', verb: 'interacted' },
  completed:             { display: 'completed',              actionSubtype: 'video.completed',             verb: 'completed' },
  abandoned:             { display: 'abandoned',              actionSubtype: 'video.abandoned',             verb: 'abandoned' },
  terminated:            { display: 'terminated',             actionSubtype: 'video.terminated',            verb: 'terminated' },
};

/** Reverse lookup: verb IRI → our verb key. Built lazily so it reflects the
 *  loaded profile, falling back to the static IRIs. */
let iriToKeyCache: Map<string, VerbKey> | null = null;
const keyForIri = (iri: string): VerbKey | undefined => {
  if (!iriToKeyCache) {
    iriToKeyCache = new Map();
    (Object.keys(VERB_META) as VerbKey[]).forEach(k => {
      iriToKeyCache!.set(iriFor(k), k);
      iriToKeyCache!.set(FALLBACK_IRI[k], k);
    });
  }
  return iriToKeyCache.get(iri);
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface EventData {
  /** Current playhead position in the video, in seconds. */
  position?: number;
  /** Seconds actually watched this session (NOT the video's total length). */
  duration?: number;
  /** The video's total length in seconds (stored on extensions). */
  videoLength?: number;
  progress?: number;
  speed?: number;
  completion?: boolean;
}

/** Parse the package's `"PT12.34S"` ISO-8601 duration into whole seconds. */
const parseISOSeconds = (iso?: string): number | undefined => {
  if (!iso) return undefined;
  const m = /PT([\d.]+)S/.exec(iso);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.round(n) : undefined;
};

const emit = (key: VerbKey, ctx: VideoXapiContext, data: EventData = {}): void => {
  const meta = VERB_META[key];
  activityLogger.log({
    verb: meta.verb,
    objectType: 'video',
    objectId: ctx.sectionId,
    objectTitle: ctx.title,
    courseId: ctx.courseId,
    lectureId: ctx.lectureId,
    sectionId: ctx.sectionId,
    duration: data.duration,
    progress: data.progress,
    success: key === 'completed' ? true : undefined,
    actionSubtype: meta.actionSubtype,
    extensions: {
      xapiVerb: iriFor(key),
      xapiVerbDisplay: meta.display,
      mode: ctx.mode,
      src: ctx.src,
      position: data.position,
      videoLength: data.videoLength,
      playbackRate: data.speed,
      completion: data.completion,
    },
  });
};

/** Coarse progress heartbeat — preserves the original `video.watch_tick`. */
const emitTick = (ctx: VideoXapiContext, data: EventData): void => {
  activityLogger.log({
    verb: 'progressed',
    objectType: 'video',
    objectId: ctx.sectionId,
    objectTitle: ctx.title,
    courseId: ctx.courseId,
    lectureId: ctx.lectureId,
    sectionId: ctx.sectionId,
    duration: data.duration,
    progress: data.progress,
    actionSubtype: 'video.watch_tick',
    extensions: { mode: ctx.mode, src: ctx.src, position: data.position, videoLength: data.videoLength },
  });
};

/** True when this embed URL is a YouTube embed the IFrame API can drive. */
export const isYouTubeEmbed = (src: string): boolean =>
  /(?:www\.)?youtube(?:-nocookie)?\.com\/embed\//.test(src);

/** Ensure a YouTube embed URL carries `enablejsapi=1` so the IFrame API can
 *  attach to the already-rendered iframe. */
export const withJsApi = (src: string): string => {
  if (!isYouTubeEmbed(src) || /[?&]enablejsapi=1\b/.test(src)) return src;
  return src + (src.includes('?') ? '&' : '?') + 'enablejsapi=1';
};

const WATCH_TICK_MS = 30000;

// ---------------------------------------------------------------------------
// xAPIWrapper shim — installed once, routes every package statement to us.
// ---------------------------------------------------------------------------

let bridgeInstalled = false;
const ensureBridge = (): void => {
  if (bridgeInstalled || typeof window === 'undefined') return;
  const adl = (window.ADL = window.ADL || {});
  adl.XAPIWrapper = {
    // Present only so the package never trips over a missing LRS config; we
    // never actually POST here (its abandoned/terminated path is bypassed —
    // see trackYouTubeEmbed, which registers its own exit handler).
    lrs: { endpoint: '', auth: '' },
    sendStatement(stmt: XapiStatement) {
      try {
        stmt?.object?._laila?.onStatement(stmt);
      } catch {
        /* never let a logging hiccup bubble into playback */
      }
    },
  };
  bridgeInstalled = true;
};

// ---------------------------------------------------------------------------
// YouTube IFrame API loader (shared, loaded at most once)
// ---------------------------------------------------------------------------

let ytApiPromise: Promise<YTNamespace | null> | null = null;
const loadYouTubeApi = (): Promise<YTNamespace | null> => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise(resolve => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT ?? null);
    };
    if (!document.querySelector('script[data-yt-iframe-api]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.dataset.ytIframeApi = '1';
      document.head.appendChild(s);
    }
  });
  return ytApiPromise;
};

// ---------------------------------------------------------------------------
// Public: embedded YouTube videos (driven by the package's engine)
// ---------------------------------------------------------------------------

export function trackYouTubeEmbed(iframe: HTMLIFrameElement, ctx: VideoXapiContext): () => void {
  ensureBridge();
  const Engine = window.XAPIYoutubeStatements;
  if (!Engine) return () => {};

  let disposed = false;
  let player: YTPlayer | null = null;
  let started = false;
  let completed = false;
  let tick: ReturnType<typeof setInterval> | null = null;

  // Watch time = wall-clock seconds the video actually spent playing, NOT the
  // video's total length and NOT the playhead position.
  let watchedMs = 0;
  let lastPlayStart: number | null = null;
  const accrue = (): void => {
    if (lastPlayStart != null) {
      watchedMs += Date.now() - lastPlayStart;
      lastPlayStart = null;
    }
  };
  const watchedSeconds = (): number =>
    Math.round((watchedMs + (lastPlayStart != null ? Date.now() - lastPlayStart : 0)) / 1000);

  const currentPosition = (): number | undefined =>
    player ? Math.round(player.getCurrentTime()) : undefined;
  const totalLength = (): number | undefined => {
    const d = player?.getDuration();
    return d && Number.isFinite(d) ? Math.round(d) : undefined;
  };
  const progressPct = (pos?: number): number | undefined => {
    const d = player?.getDuration();
    if (!d || !pos) return undefined;
    return Math.min(100, Math.round((pos / d) * 100));
  };

  // Each statement the engine produces lands here via the global shim.
  const onStatement = (stmt: XapiStatement): void => {
    const key = keyForIri(stmt.verb?.id);
    if (!key) return;
    const ext = stmt.result?.extensions ?? {};
    const isoPos =
      (ext['resultExt:resumed'] as string | undefined) ??
      (ext['resultExt:paused'] as string | undefined) ??
      (ext['resultExt:seeked'] as string | undefined);
    const position = parseISOSeconds(isoPos) ?? currentPosition();
    const speed = typeof ext['resultExt:speed'] === 'number' ? (ext['resultExt:speed'] as number) : undefined;
    if (key === 'played') {
      started = true;
      lastPlayStart = Date.now();
    }
    if (key === 'paused' || key === 'completed') accrue();
    if (key === 'completed') completed = true;
    emit(key, ctx, {
      position,
      speed,
      duration: watchedSeconds(),
      videoLength: parseISOSeconds(stmt.result?.duration) ?? totalLength(),
      progress: key === 'completed' ? 100 : progressPct(position),
      completion: stmt.result?.completion,
    });
  };

  const engine = new Engine();
  // Smuggle the per-tracker hook through `object` so the single global
  // `sendStatement` shim can hand the statement back to *this* tracker.
  engine.changeConfig({ actor: {}, context: {}, object: { _laila: { onStatement } } });

  const onExit = (): void => {
    if (!started) return;
    accrue();
    const position = currentPosition();
    emit(completed ? 'terminated' : 'abandoned', ctx, {
      position,
      duration: watchedSeconds(),
      videoLength: totalLength(),
      progress: progressPct(position),
    });
  };
  window.addEventListener('beforeunload', onExit);

  loadYouTubeApi().then(YT => {
    if (disposed || !YT) return;
    player = new YT.Player(iframe, {
      events: {
        onStateChange: event => {
          // The engine reads the *global* `player`; point it at ours first.
          window.player = event.target;
          engine.onStateChange(event);
        },
        onPlaybackRateChange: event => {
          window.player = event.target;
          engine.onPlaybackRateChange(event);
        },
        onReady: () => {
          tick = setInterval(() => {
            // 1 === YT.PlayerState.PLAYING
            if (player?.getPlayerState() === 1) {
              const position = currentPosition();
              emitTick(ctx, {
                position,
                duration: watchedSeconds(),
                videoLength: totalLength(),
                progress: progressPct(position),
              });
            }
          }, WATCH_TICK_MS);
        },
      },
    });
  });

  return () => {
    disposed = true;
    if (tick) clearInterval(tick);
    window.removeEventListener('beforeunload', onExit);
    onExit(); // SPA navigation away counts as abandoned/terminated too.
    try {
      player?.destroy();
    } catch {
      /* iframe may already be gone */
    }
  };
}

// ---------------------------------------------------------------------------
// Public: uploaded HTML5 <video> (Video Profile reproduced over native events)
// ---------------------------------------------------------------------------

export function trackUploadedVideo(el: HTMLVideoElement, ctx: VideoXapiContext): () => void {
  let started = false;
  let completed = false;
  let initialized = false;

  // Watch time = wall-clock seconds actually spent playing, NOT the file's
  // total length and NOT the playhead position.
  let watchedMs = 0;
  let lastPlayStart: number | null = null;
  const accrue = (): void => {
    if (lastPlayStart != null) {
      watchedMs += Date.now() - lastPlayStart;
      lastPlayStart = null;
    }
  };
  const watchedSeconds = (): number =>
    Math.round((watchedMs + (lastPlayStart != null ? Date.now() - lastPlayStart : 0)) / 1000);

  const videoLength = (): number | undefined =>
    Number.isFinite(el.duration) ? Math.round(el.duration) : undefined;
  const position = (): number => Math.round(el.currentTime);
  const progress = (): number | undefined =>
    el.duration ? Math.min(100, Math.round((el.currentTime / el.duration) * 100)) : undefined;

  const onLoadedMetadata = (): void => {
    if (initialized) return;
    initialized = true;
    emit('initialized', ctx, { duration: 0, videoLength: videoLength() });
  };
  const onPlay = (): void => {
    started = true;
    lastPlayStart = Date.now();
    emit('played', ctx, { position: position(), duration: watchedSeconds(), videoLength: videoLength(), progress: progress() });
  };
  const onPause = (): void => {
    // Native `pause` also fires while seeking and right before `ended`; the
    // Video Profile treats those separately, so suppress them here.
    if (el.ended || el.seeking) return;
    accrue();
    emit('paused', ctx, { position: position(), duration: watchedSeconds(), videoLength: videoLength(), progress: progress() });
  };
  const onSeeked = (): void => {
    emit('seeked', ctx, { position: position(), duration: watchedSeconds(), videoLength: videoLength(), progress: progress() });
  };
  const onRateChange = (): void => {
    emit('playback_rate_changed', ctx, { position: position(), duration: watchedSeconds(), speed: el.playbackRate });
  };
  const onEnded = (): void => {
    accrue();
    completed = true;
    emit('completed', ctx, { position: position(), duration: watchedSeconds(), videoLength: videoLength(), progress: 100, completion: true });
  };
  const onExit = (): void => {
    if (!started) return;
    accrue();
    emit(completed ? 'terminated' : 'abandoned', ctx, {
      position: position(),
      duration: watchedSeconds(),
      videoLength: videoLength(),
      progress: progress(),
    });
  };

  const tick = setInterval(() => {
    if (!el.paused && !el.ended) {
      emitTick(ctx, { position: position(), duration: watchedSeconds(), videoLength: videoLength(), progress: progress() });
    }
  }, WATCH_TICK_MS);

  el.addEventListener('loadedmetadata', onLoadedMetadata);
  el.addEventListener('play', onPlay);
  el.addEventListener('pause', onPause);
  el.addEventListener('seeked', onSeeked);
  el.addEventListener('ratechange', onRateChange);
  el.addEventListener('ended', onEnded);
  window.addEventListener('beforeunload', onExit);

  // If metadata is already available (fast cache), fire initialized now.
  if (el.readyState >= 1) onLoadedMetadata();

  return () => {
    clearInterval(tick);
    el.removeEventListener('loadedmetadata', onLoadedMetadata);
    el.removeEventListener('play', onPlay);
    el.removeEventListener('pause', onPause);
    el.removeEventListener('seeked', onSeeked);
    el.removeEventListener('ratechange', onRateChange);
    el.removeEventListener('ended', onEnded);
    window.removeEventListener('beforeunload', onExit);
    onExit(); // SPA navigation away counts as abandoned/terminated too.
  };
}
