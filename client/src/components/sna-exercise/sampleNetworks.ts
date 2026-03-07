/** Pre-loaded sample social network datasets.
 *  Primary format: weighted edge list.
 *  Adjacency matrix derived for dynajs model building. */

export interface Edge {
  from: string;
  to: string;
  weight: number;
}

export interface SampleNetwork {
  key: string;
  i18nTitle: string;
  i18nDesc: string;
  gradient: string;
  icon: 'users' | 'microscope' | 'message-circle';
  labels: string[];
  edges: Edge[];
  matrix: number[][];
  directed: boolean;
}

/* ── Seeded PRNG — mulberry32 ── */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/** Convert matrix to edge list. */
function matrixToEdges(matrix: number[][], labels: string[], directed: boolean): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix.length; j++) {
      if (i === j) continue;
      if (!directed && j <= i) continue;
      if (matrix[i][j] > 0) {
        edges.push({ from: labels[i], to: labels[j], weight: matrix[i][j] });
      }
    }
  }
  return edges;
}

/* ── Dataset 1: Classroom Friendship (15 students, directed binary) ── */
const STUDENT_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Elijah', 'Sophia', 'James',
  'Isabella', 'Lucas', 'Mia', 'Mason', 'Charlotte', 'Ethan', 'Amelia',
];

function generateClassroom(): { labels: string[]; matrix: number[][] } {
  const rand = mulberry32(42);
  const n = 15;
  const labels = STUDENT_NAMES.slice(0, n);
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    const nFriends = randInt(rand, 2, 5);
    const friends = new Set<number>();
    while (friends.size < nFriends) {
      const j = randInt(rand, 0, n - 1);
      if (j !== i) friends.add(j);
    }
    for (const j of friends) matrix[i][j] = 1;
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (matrix[i][j] === 1 && matrix[j][i] === 0 && rand() < 0.4) matrix[j][i] = 1;
    }
  }
  return { labels, matrix };
}

/* ── Dataset 2: Research Collaboration (20 researchers, weighted undirected) ── */
const RESEARCHER_NAMES = [
  'Chen', 'Patel', 'Kim', 'Garcia', 'Muller', 'Silva', 'Ahmed', 'Tanaka',
  'Ivanov', 'Lopez', 'Wang', 'Singh', 'Rossi', 'Sato', 'Ali',
  'Park', 'Johansson', 'Santos', 'Nguyen', 'Fischer',
];

function generateResearch(): { labels: string[]; matrix: number[][] } {
  const rand = mulberry32(137);
  const n = 20;
  const labels = RESEARCHER_NAMES.slice(0, n);
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  const groups = [[0,1,2,3,4,5,6], [7,8,9,10,11,12], [13,14,15,16,17,18,19]];
  for (const group of groups) {
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) {
        if (rand() < 0.55) {
          const w = randInt(rand, 1, 8);
          matrix[group[a]][group[b]] = w;
          matrix[group[b]][group[a]] = w;
        }
      }
    }
  }
  for (let gi = 0; gi < groups.length; gi++) {
    for (let gj = gi + 1; gj < groups.length; gj++) {
      const bridgeCount = randInt(rand, 1, 3);
      for (let k = 0; k < bridgeCount; k++) {
        const a = groups[gi][randInt(rand, 0, groups[gi].length - 1)];
        const b = groups[gj][randInt(rand, 0, groups[gj].length - 1)];
        if (matrix[a][b] === 0) {
          const w = randInt(rand, 1, 3);
          matrix[a][b] = w;
          matrix[b][a] = w;
        }
      }
    }
  }
  return { labels, matrix };
}

/* ── Dataset 3: Online Forum Interactions (18 users, directed weighted) ── */
const FORUM_NAMES = [
  'Alex', 'Jordan', 'Sam', 'Riley', 'Casey', 'Morgan', 'Taylor', 'Quinn',
  'Avery', 'Blake', 'Drew', 'Sage', 'Reese', 'Skyler', 'Jamie',
  'Dakota', 'Finley', 'Rowan',
];

function generateForum(): { labels: string[]; matrix: number[][] } {
  const rand = mulberry32(256);
  const n = 18;
  const labels = FORUM_NAMES.slice(0, n);
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const activity = Array.from({ length: n }, () => rand() < 0.15 ? 'hub' : rand() < 0.5 ? 'moderate' : 'low');

  for (let i = 0; i < n; i++) {
    const maxReplies = activity[i] === 'hub' ? 10 : activity[i] === 'moderate' ? 5 : 2;
    const nTargets = randInt(rand, 1, Math.min(maxReplies, n - 1));
    const targets = new Set<number>();
    while (targets.size < nTargets) {
      const j = randInt(rand, 0, n - 1);
      if (j !== i) targets.add(j);
    }
    for (const j of targets) {
      const weight = activity[i] === 'hub' ? randInt(rand, 2, 12)
        : activity[i] === 'moderate' ? randInt(rand, 1, 6)
        : randInt(rand, 1, 3);
      matrix[i][j] = weight;
    }
  }
  return { labels, matrix };
}

/* ── Instantiate ── */
const classroom = generateClassroom();
const research = generateResearch();
const forum = generateForum();

const CLASSROOM: SampleNetwork = {
  key: 'classroom',
  i18nTitle: 'sna.ds_classroom_title',
  i18nDesc: 'sna.ds_classroom_desc',
  gradient: 'from-violet-500 to-purple-600',
  icon: 'users',
  ...classroom,
  edges: matrixToEdges(classroom.matrix, classroom.labels, true),
  directed: true,
};

const RESEARCH: SampleNetwork = {
  key: 'research',
  i18nTitle: 'sna.ds_research_title',
  i18nDesc: 'sna.ds_research_desc',
  gradient: 'from-cyan-500 to-blue-600',
  icon: 'microscope',
  ...research,
  edges: matrixToEdges(research.matrix, research.labels, false),
  directed: false,
};

const FORUM: SampleNetwork = {
  key: 'forum',
  i18nTitle: 'sna.ds_forum_title',
  i18nDesc: 'sna.ds_forum_desc',
  gradient: 'from-orange-500 to-red-600',
  icon: 'message-circle',
  ...forum,
  edges: matrixToEdges(forum.matrix, forum.labels, true),
  directed: true,
};

export const SAMPLE_NETWORKS: SampleNetwork[] = [CLASSROOM, RESEARCH, FORUM];

export const getNetworkByKey = (key: string): SampleNetwork | undefined =>
  SAMPLE_NETWORKS.find(d => d.key === key);

/** Build labels + adjacency matrix from a raw edge list. */
export function edgesToMatrix(edges: Edge[], directed: boolean): { labels: string[]; matrix: number[][] } {
  const labelSet = new Set<string>();
  for (const e of edges) { labelSet.add(e.from); labelSet.add(e.to); }
  const labels = [...labelSet].sort();
  const idx: Record<string, number> = {};
  labels.forEach((l, i) => { idx[l] = i; });
  const n = labels.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (const e of edges) {
    matrix[idx[e.from]][idx[e.to]] += e.weight;
    if (!directed) matrix[idx[e.to]][idx[e.from]] += e.weight;
  }
  return { labels, matrix };
}

/** Compute graph-level metrics from an adjacency matrix. */
export function graphMetrics(matrix: number[][], directed: boolean) {
  const n = matrix.length;
  let nEdges = 0;
  let totalWeight = 0;
  let reciprocated = 0;
  let totalPairs = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (matrix[i][j] > 0) { nEdges++; totalWeight += matrix[i][j]; }
    }
  }

  if (directed) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (matrix[i][j] > 0 || matrix[j][i] > 0) {
          totalPairs++;
          if (matrix[i][j] > 0 && matrix[j][i] > 0) reciprocated++;
        }
      }
    }
  }

  if (!directed) nEdges = nEdges / 2;

  const maxEdges = directed ? n * (n - 1) : (n * (n - 1)) / 2;
  const density = maxEdges > 0 ? nEdges / maxEdges : 0;
  const avgDegree = n > 0 ? (directed ? nEdges : nEdges * 2) / n : 0;
  const avgWeight = nEdges > 0 ? totalWeight / (directed ? nEdges : nEdges * 2) : 0;
  const reciprocity = totalPairs > 0 ? reciprocated / totalPairs : 0;

  return {
    nNodes: n,
    nEdges,
    density,
    avgDegree: Math.round(avgDegree * 100) / 100,
    avgWeight: Math.round(avgWeight * 100) / 100,
    reciprocity: directed ? Math.round(reciprocity * 100) / 100 : null,
  };
}
