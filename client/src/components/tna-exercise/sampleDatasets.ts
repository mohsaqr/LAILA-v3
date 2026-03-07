/** Pre-loaded example datasets for the TNA exercise — raw event-log format.
 *  Each dataset is programmatically generated with a seeded PRNG for determinism. */

export interface RawRow {
  [column: string]: string;
}

export interface SampleDataset {
  key: string;
  i18nTitle: string;
  i18nDesc: string;
  gradient: string;
  icon: 'book' | 'gamepad' | 'share2';
  columns: string[];
  rows: RawRow[];
  /** Suggested column mappings */
  defaults: { actor: string; action: string; time: string };
}

/* ------------------------------------------------------------------ */
/*  Seeded PRNG — mulberry32                                          */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Pick from a weighted distribution. `weights` values must sum to ~1. */
function weightedPick(
  rand: () => number,
  weights: Record<string, number>,
): string {
  const r = rand();
  let cum = 0;
  for (const [key, w] of Object.entries(weights)) {
    cum += w;
    if (r < cum) return key;
  }
  // Fallback to last key (handles floating-point rounding)
  const keys = Object.keys(weights);
  return keys[keys.length - 1];
}

/** Zero-pad a number to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Format a Date as 'YYYY-MM-DD HH:mm'. */
function fmtDate(d: Date): string {
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

/** Produce an integer in [min, max] (inclusive). */
function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/* ------------------------------------------------------------------ */
/*  Generic event generator                                           */
/* ------------------------------------------------------------------ */

interface GeneratorConfig {
  seed: number;
  actorPrefix: string;
  actorCount: number;
  minEvents: number;
  maxEvents: number;
  states: string[];
  startState: string;
  /** If provided, the sequence is forced to end with this state. */
  endState?: string;
  transitions: Record<string, Record<string, number>>;
  columns: string[];
  actorCol: string;
  actionCol: string;
  timeCol: string;
  /** Produce extra column values for each event row. */
  extraCols?: (rand: () => number, action: string) => Record<string, string>;
  startDate: string; // 'YYYY-MM-DD'
}

function generateEvents(cfg: GeneratorConfig): RawRow[] {
  const rand = mulberry32(cfg.seed);
  const rows: RawRow[] = [];
  const baseDate = new Date(`${cfg.startDate}T00:00:00`);

  for (let i = 1; i <= cfg.actorCount; i++) {
    const actorId = `${cfg.actorPrefix}_${i}`;
    const eventCount = randInt(rand, cfg.minEvents, cfg.maxEvents);

    // Random session start: 0-6 days offset, hour 6-20, minute 0-59
    const sessionStart = new Date(baseDate.getTime());
    sessionStart.setDate(sessionStart.getDate() + randInt(rand, 0, 6));
    sessionStart.setHours(randInt(rand, 6, 20), randInt(rand, 0, 59), 0, 0);

    let ts = new Date(sessionStart.getTime());
    let currentState = cfg.startState;

    for (let e = 0; e < eventCount; e++) {
      // On the last event, force endState if specified
      const action =
        e === eventCount - 1 && cfg.endState
          ? cfg.endState
          : e === 0
            ? currentState
            : weightedPick(rand, cfg.transitions[currentState] || {});

      const extra = cfg.extraCols ? cfg.extraCols(rand, action) : {};
      const row: RawRow = {
        [cfg.actorCol]: actorId,
        [cfg.actionCol]: action,
        ...extra,
        [cfg.timeCol]: fmtDate(ts),
      };
      rows.push(row);

      currentState = action;
      // Advance 3-10 minutes
      ts = new Date(ts.getTime() + randInt(rand, 3, 10) * 60_000);
    }
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/*  Dataset 1 — Online Learning                                       */
/* ------------------------------------------------------------------ */

const ONLINE_LEARNING_ROWS = generateEvents({
  seed: 42,
  actorPrefix: 'student',
  actorCount: 200,
  minEvents: 8,
  maxEvents: 15,
  states: ['login', 'view', 'download', 'quiz', 'submit', 'forum', 'reply', 'logout'],
  startState: 'login',
  endState: 'logout',
  transitions: {
    login:    { view: 0.8, download: 0.1, quiz: 0.1 },
    view:     { view: 0.30, download: 0.15, quiz: 0.20, forum: 0.10, logout: 0.10, submit: 0.05, reply: 0.10 },
    download: { view: 0.50, quiz: 0.20, forum: 0.10, download: 0.10, logout: 0.10 },
    quiz:     { submit: 0.85, view: 0.10, logout: 0.05 },
    submit:   { view: 0.40, quiz: 0.15, forum: 0.15, download: 0.10, logout: 0.20 },
    forum:    { reply: 0.60, view: 0.20, forum: 0.10, logout: 0.10 },
    reply:    { view: 0.35, forum: 0.25, quiz: 0.15, download: 0.10, logout: 0.15 },
    logout:   { login: 1.0 }, // should not be reached mid-sequence
  },
  columns: ['student', 'action', 'resource', 'timestamp'],
  actorCol: 'student',
  actionCol: 'action',
  timeCol: 'timestamp',
  extraCols: (rand, action) => {
    const resources: Record<string, string[]> = {
      login:    ['portal'],
      view:     ['lecture1', 'lecture2', 'lecture3', 'lecture4', 'lecture5'],
      download: ['slides1', 'slides2', 'slides3', 'notes1', 'notes2'],
      quiz:     ['quiz1', 'quiz2', 'quiz3'],
      submit:   ['quiz1', 'quiz2', 'quiz3'],
      forum:    ['thread1', 'thread2', 'thread3', 'thread4'],
      reply:    ['thread1', 'thread2', 'thread3', 'thread4'],
      logout:   ['portal'],
    };
    const opts = resources[action] || ['unknown'];
    return { resource: opts[randInt(rand, 0, opts.length - 1)] };
  },
  startDate: '2025-01-10',
});

const ONLINE_LEARNING: SampleDataset = {
  key: 'online-learning',
  i18nTitle: 'exercise.ds_online_title',
  i18nDesc: 'exercise.ds_online_desc',
  gradient: 'from-blue-500 to-indigo-600',
  icon: 'book',
  columns: ['student', 'action', 'resource', 'timestamp'],
  defaults: { actor: 'student', action: 'action', time: 'timestamp' },
  rows: ONLINE_LEARNING_ROWS,
};

/* ------------------------------------------------------------------ */
/*  Dataset 2 — Social Media                                          */
/* ------------------------------------------------------------------ */

const SOCIAL_MEDIA_ROWS = generateEvents({
  seed: 137,
  actorPrefix: 'user',
  actorCount: 250,
  minEvents: 6,
  maxEvents: 12,
  states: ['scroll', 'like', 'comment', 'share', 'post', 'search', 'follow'],
  startState: 'scroll',
  transitions: {
    scroll:  { scroll: 0.30, like: 0.25, comment: 0.10, share: 0.08, post: 0.07, search: 0.12, follow: 0.08 },
    like:    { scroll: 0.50, like: 0.10, comment: 0.15, share: 0.10, search: 0.08, follow: 0.07 },
    comment: { scroll: 0.45, like: 0.15, comment: 0.05, share: 0.10, search: 0.15, follow: 0.10 },
    share:   { scroll: 0.55, like: 0.10, comment: 0.10, post: 0.10, search: 0.10, follow: 0.05 },
    post:    { scroll: 0.50, like: 0.05, comment: 0.10, share: 0.05, search: 0.20, follow: 0.10 },
    search:  { scroll: 0.40, like: 0.10, follow: 0.20, comment: 0.05, post: 0.10, search: 0.15 },
    follow:  { scroll: 0.50, like: 0.15, comment: 0.10, search: 0.15, post: 0.05, share: 0.05 },
  },
  columns: ['user', 'action', 'content_type', 'timestamp'],
  actorCol: 'user',
  actionCol: 'action',
  timeCol: 'timestamp',
  extraCols: (rand, action) => {
    const contentTypes: Record<string, string[]> = {
      scroll:  ['feed'],
      like:    ['photo', 'video', 'article', 'reel'],
      comment: ['photo', 'video', 'article', 'reel'],
      share:   ['photo', 'video', 'article'],
      post:    ['text', 'photo', 'video', 'story'],
      search:  ['users', 'tags', 'places'],
      follow:  ['user', 'page', 'topic'],
    };
    const opts = contentTypes[action] || ['unknown'];
    return { content_type: opts[randInt(rand, 0, opts.length - 1)] };
  },
  startDate: '2025-01-10',
});

const SOCIAL_MEDIA: SampleDataset = {
  key: 'social-media',
  i18nTitle: 'exercise.ds_social_title',
  i18nDesc: 'exercise.ds_social_desc',
  gradient: 'from-pink-500 to-rose-600',
  icon: 'share2',
  columns: ['user', 'action', 'content_type', 'timestamp'],
  defaults: { actor: 'user', action: 'action', time: 'timestamp' },
  rows: SOCIAL_MEDIA_ROWS,
};

/* ------------------------------------------------------------------ */
/*  Dataset 3 — Game Actions                                          */
/* ------------------------------------------------------------------ */

const GAME_ROWS = generateEvents({
  seed: 256,
  actorPrefix: 'player',
  actorCount: 200,
  minEvents: 8,
  maxEvents: 15,
  states: ['explore', 'fight', 'loot', 'craft', 'trade', 'rest', 'quest'],
  startState: 'explore',
  transitions: {
    explore: { fight: 0.35, explore: 0.20, quest: 0.15, loot: 0.10, craft: 0.10, rest: 0.10 },
    fight:   { loot: 0.45, fight: 0.15, explore: 0.15, rest: 0.10, quest: 0.10, craft: 0.05 },
    loot:    { explore: 0.25, fight: 0.15, craft: 0.25, trade: 0.15, quest: 0.10, rest: 0.10 },
    craft:   { trade: 0.40, craft: 0.10, explore: 0.20, quest: 0.10, rest: 0.10, fight: 0.10 },
    trade:   { explore: 0.30, craft: 0.15, quest: 0.20, fight: 0.15, rest: 0.10, trade: 0.10 },
    rest:    { explore: 0.35, quest: 0.25, craft: 0.15, fight: 0.15, trade: 0.10 },
    quest:   { fight: 0.30, explore: 0.25, loot: 0.15, quest: 0.10, rest: 0.10, craft: 0.10 },
  },
  columns: ['player', 'action', 'zone', 'timestamp'],
  actorCol: 'player',
  actionCol: 'action',
  timeCol: 'timestamp',
  extraCols: (rand, action) => {
    const zones: Record<string, string[]> = {
      explore: ['forest', 'cave', 'desert', 'mountain', 'swamp'],
      fight:   ['forest', 'cave', 'desert', 'mountain', 'arena'],
      loot:    ['forest', 'cave', 'desert', 'dungeon'],
      craft:   ['town', 'camp', 'workshop'],
      trade:   ['town', 'market', 'port'],
      rest:    ['town', 'camp', 'inn'],
      quest:   ['town', 'forest', 'cave', 'castle'],
    };
    const opts = zones[action] || ['unknown'];
    return { zone: opts[randInt(rand, 0, opts.length - 1)] };
  },
  startDate: '2025-01-10',
});

const GAME_ACTIONS: SampleDataset = {
  key: 'game',
  i18nTitle: 'exercise.ds_game_title',
  i18nDesc: 'exercise.ds_game_desc',
  gradient: 'from-emerald-500 to-teal-600',
  icon: 'gamepad',
  columns: ['player', 'action', 'zone', 'timestamp'],
  defaults: { actor: 'player', action: 'action', time: 'timestamp' },
  rows: GAME_ROWS,
};

/* ------------------------------------------------------------------ */
/*  Exports                                                           */
/* ------------------------------------------------------------------ */

export const SAMPLE_DATASETS: SampleDataset[] = [
  ONLINE_LEARNING,
  SOCIAL_MEDIA,
  GAME_ACTIONS,
];

export const getDatasetByKey = (key: string): SampleDataset | undefined =>
  SAMPLE_DATASETS.find((d) => d.key === key);

/** Build sequences from raw rows given column role assignments. */
export function buildSequences(
  rows: RawRow[],
  actorCol: string,
  actionCol: string,
  timeCol: string,
): { sequences: string[][]; labels: string[] } {
  // Sort by actor then time
  const sorted = [...rows].sort((a, b) => {
    const actorCmp = (a[actorCol] || '').localeCompare(b[actorCol] || '');
    if (actorCmp !== 0) return actorCmp;
    return (a[timeCol] || '').localeCompare(b[timeCol] || '');
  });

  // Group by actor
  const groups: Record<string, string[]> = {};
  for (const row of sorted) {
    const actor = row[actorCol];
    const action = row[actionCol];
    if (!actor || !action) continue;
    if (!groups[actor]) groups[actor] = [];
    groups[actor].push(action);
  }

  const sequences = Object.values(groups).filter((s) => s.length >= 2);
  const labelSet = new Set<string>();
  for (const s of sequences) for (const v of s) labelSet.add(v);
  return { sequences, labels: [...labelSet].sort() };
}
