import type { CentralityResult } from 'dynajs';

/** Convert dynajs CentralityResult (Float64Array) to plain number[]. */
export function toCentralityData(raw: CentralityResult): { labels: string[]; measures: Record<string, number[]> } {
  const measures: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(raw.measures)) {
    measures[k] = Array.from(v);
  }
  return { labels: raw.labels, measures };
}

/* ── All centralities from raw adjacency matrix ── */

/** Brandes' algorithm for betweenness centrality (unweighted shortest paths). */
function brandesBetweenness(matrix: number[][], n: number): number[] {
  const CB = new Array(n).fill(0);

  for (let s = 0; s < n; s++) {
    const stack: number[] = [];
    const P: number[][] = Array.from({ length: n }, () => []);
    const sigma = new Array(n).fill(0);
    sigma[s] = 1;
    const d = new Array(n).fill(-1);
    d[s] = 0;

    const Q: number[] = [s];
    let qi = 0;
    while (qi < Q.length) {
      const v = Q[qi++];
      stack.push(v);
      for (let w = 0; w < n; w++) {
        if (v === w || matrix[v][w] <= 0) continue;
        if (d[w] < 0) { Q.push(w); d[w] = d[v] + 1; }
        if (d[w] === d[v] + 1) { sigma[w] += sigma[v]; P[w].push(v); }
      }
    }

    const delta = new Array(n).fill(0);
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of P[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) CB[w] += delta[w];
    }
  }

  return CB;
}

/** Closeness centrality (inverse sum of shortest distances). */
function closenessCentrality(matrix: number[][], n: number): number[] {
  const closeness = new Array(n).fill(0);

  for (let s = 0; s < n; s++) {
    // BFS shortest distances
    const d = new Array(n).fill(-1);
    d[s] = 0;
    const Q: number[] = [s];
    let qi = 0;
    let totalDist = 0;
    let reachable = 0;

    while (qi < Q.length) {
      const v = Q[qi++];
      for (let w = 0; w < n; w++) {
        if (v === w || matrix[v][w] <= 0) continue;
        if (d[w] < 0) { d[w] = d[v] + 1; Q.push(w); totalDist += d[w]; reachable++; }
      }
    }

    closeness[s] = reachable > 0 ? reachable / totalDist : 0;
  }

  return closeness;
}

/** Compute all SNA centrality measures from an adjacency matrix. */
export function computeAllCentralities(matrix: number[][], labels: string[]): {
  labels: string[];
  measures: Record<string, number[]>;
} {
  const n = matrix.length;
  const degree = new Array(n).fill(0);
  const inDegree = new Array(n).fill(0);
  const outDegree = new Array(n).fill(0);
  const inStrength = new Array(n).fill(0);
  const outStrength = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (matrix[i][j] > 0) {
        outDegree[i]++;
        outStrength[i] += matrix[i][j];
        inDegree[j]++;
        inStrength[j] += matrix[i][j];
      }
    }
    degree[i] = inDegree[i] + outDegree[i];
  }

  const betweenness = brandesBetweenness(matrix, n);
  const closeness = closenessCentrality(matrix, n);

  return {
    labels,
    measures: {
      Degree: degree,
      InDegree: inDegree,
      OutDegree: outDegree,
      InStrength: inStrength,
      OutStrength: outStrength,
      Betweenness: betweenness,
      Closeness: closeness,
    },
  };
}

/* ── Community detection algorithms ── */

export type CommunityMethod = 'label-propagation' | 'modularity-greedy' | 'walktrap' | 'girvan-newman' | 'spectral';

export function detectCommunities(matrix: number[][], method: CommunityMethod = 'label-propagation'): { assignments: number[]; k: number } {
  switch (method) {
    case 'modularity-greedy': return modularityGreedy(matrix);
    case 'walktrap': return walktrapCommunities(matrix);
    case 'girvan-newman': return girvanNewman(matrix);
    case 'spectral': return spectralCommunities(matrix);
    case 'label-propagation':
    default: return labelPropagation(matrix);
  }
}

/** Label propagation community detection. */
function labelPropagation(matrix: number[][]): { assignments: number[]; k: number } {
  const n = matrix.length;
  const labels = Array.from({ length: n }, (_, i) => i);

  // Seeded deterministic shuffle
  function seededShuffle(arr: number[], seed: number): number[] {
    const out = [...arr];
    let s = seed;
    const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  for (let iter = 0; iter < 50; iter++) {
    let changed = false;
    const order = seededShuffle(Array.from({ length: n }, (_, i) => i), 42 + iter);

    for (const i of order) {
      const counts: Record<number, number> = {};
      for (let j = 0; j < n; j++) {
        const w = (matrix[i][j] || 0) + (matrix[j][i] || 0);
        if (w > 0 && i !== j) counts[labels[j]] = (counts[labels[j]] || 0) + w;
      }
      if (Object.keys(counts).length > 0) {
        let maxCount = -1;
        let bestLabel = labels[i];
        for (const [lbl, cnt] of Object.entries(counts)) {
          if (cnt > maxCount) { maxCount = cnt; bestLabel = parseInt(lbl); }
        }
        if (bestLabel !== labels[i]) { labels[i] = bestLabel; changed = true; }
      }
    }
    if (!changed) break;
  }

  // Renumber to 0, 1, 2, ...
  const unique = [...new Set(labels)].sort((a, b) => a - b);
  const assignments = labels.map(l => unique.indexOf(l));
  return { assignments, k: unique.length };
}

/** Greedy modularity optimization (agglomerative, Clauset-Newman-Moore style). */
function modularityGreedy(matrix: number[][]): { assignments: number[]; k: number } {
  const n = matrix.length;
  // Symmetrize for modularity
  const w: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (matrix[i][j] || 0) + (matrix[j][i] || 0)),
  );
  let totalW = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) totalW += w[i][j];
  if (totalW === 0) return { assignments: Array.from({ length: n }, (_, i) => i), k: n };
  const m2 = totalW; // sum of all edge weights (each counted once since we symmetrized but only sum upper triangle)

  // Each node starts in its own community
  const comm = Array.from({ length: n }, (_, i) => i);
  const strength = Array.from({ length: n }, (_, i) => {
    let s = 0; for (let j = 0; j < n; j++) s += w[i][j]; return s;
  });

  // Track community → set of nodes
  const members: Map<number, Set<number>> = new Map();
  for (let i = 0; i < n; i++) members.set(i, new Set([i]));

  // Greedily merge the pair that gives biggest modularity gain
  for (let step = 0; step < n - 1; step++) {
    let bestDQ = -Infinity;
    let bestA = -1, bestB = -1;

    const activeComms = [...members.keys()];
    for (let ci = 0; ci < activeComms.length; ci++) {
      for (let cj = ci + 1; cj < activeComms.length; cj++) {
        const ca = activeComms[ci], cb = activeComms[cj];
        const nodesA = members.get(ca)!;
        const nodesB = members.get(cb)!;

        // e_ab = sum of weights between communities / m2
        let eab = 0;
        for (const a of nodesA) for (const b of nodesB) eab += w[a][b];
        // a_a, a_b = sum of strengths / (2*m2)
        let sa = 0, sb = 0;
        for (const a of nodesA) sa += strength[a];
        for (const b of nodesB) sb += strength[b];

        const dQ = eab / m2 - (sa * sb) / (2 * m2 * m2);
        if (dQ > bestDQ) { bestDQ = dQ; bestA = ca; bestB = cb; }
      }
    }

    if (bestDQ <= 0 || bestA < 0) break;

    // Merge bestB into bestA
    const nodesB = members.get(bestB)!;
    const nodesA = members.get(bestA)!;
    for (const node of nodesB) { nodesA.add(node); comm[node] = bestA; }
    members.delete(bestB);
  }

  // Renumber
  const unique = [...new Set(comm)].sort((a, b) => a - b);
  const assignments = comm.map(c => unique.indexOf(c));
  return { assignments, k: unique.length };
}

/** Walktrap-inspired community detection using short random walks. */
function walktrapCommunities(matrix: number[][]): { assignments: number[]; k: number } {
  const n = matrix.length;
  // Symmetrize
  const w: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (matrix[i][j] || 0) + (matrix[j][i] || 0)),
  );
  const deg = Array.from({ length: n }, (_, i) => {
    let s = 0; for (let j = 0; j < n; j++) s += w[i][j]; return s;
  });

  // Transition matrix row-normalized
  const T: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => deg[i] > 0 ? w[i][j] / deg[i] : 0),
  );

  // Compute T^t for t=4 (short walk)
  const walkLen = 4;
  let P = T.map(r => [...r]);
  for (let step = 1; step < walkLen; step++) {
    const next: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++)
          next[i][j] += P[i][k] * T[k][j];
    P = next;
  }

  // Distance between nodes i,j based on walk probabilities
  // d(i,j) = sqrt(sum_k (P[i][k] - P[j][k])^2 / deg[k])
  function walkDist(i: number, j: number): number {
    let s = 0;
    for (let k = 0; k < n; k++) {
      if (deg[k] === 0) continue;
      const diff = P[i][k] - P[j][k];
      s += (diff * diff) / deg[k];
    }
    return Math.sqrt(s);
  }

  // Agglomerative clustering using walk distance
  const comm = Array.from({ length: n }, (_, i) => i);
  const memberSets: Map<number, Set<number>> = new Map();
  for (let i = 0; i < n; i++) memberSets.set(i, new Set([i]));

  // Precompute pairwise distances
  const dist: Map<string, number> = new Map();
  const activeComms = () => [...memberSets.keys()];

  function commDist(ca: number, cb: number): number {
    const key = ca < cb ? `${ca}-${cb}` : `${cb}-${ca}`;
    let d = dist.get(key);
    if (d !== undefined) return d;
    const na = memberSets.get(ca)!, nb = memberSets.get(cb)!;
    let total = 0, count = 0;
    for (const a of na) for (const b of nb) { total += walkDist(a, b); count++; }
    d = count > 0 ? total / count : Infinity;
    dist.set(key, d);
    return d;
  }

  // Merge until we find a good modularity or reach a minimum
  let bestAssignments = [...comm];
  let bestModularity = -Infinity;

  for (let step = 0; step < n - 1; step++) {
    const comms = activeComms();
    if (comms.length <= 1) break;

    let bestD = Infinity, bestA = -1, bestB = -1;
    for (let ci = 0; ci < comms.length; ci++) {
      for (let cj = ci + 1; cj < comms.length; cj++) {
        const d = commDist(comms[ci], comms[cj]);
        if (d < bestD) { bestD = d; bestA = comms[ci]; bestB = comms[cj]; }
      }
    }
    if (bestA < 0) break;

    // Merge bestB into bestA
    const nb = memberSets.get(bestB)!;
    const na = memberSets.get(bestA)!;
    for (const node of nb) { na.add(node); comm[node] = bestA; }
    memberSets.delete(bestB);
    // Invalidate cached distances involving bestA or bestB
    for (const key of dist.keys()) {
      if (key.includes(`${bestA}`) || key.includes(`${bestB}`)) dist.delete(key);
    }

    // Compute modularity for current partition
    let totalW = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) totalW += w[i][j];
    if (totalW > 0) {
      let Q = 0;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (comm[i] === comm[j]) {
            Q += w[i][j] - (deg[i] * deg[j]) / (2 * totalW);
          }
        }
      }
      Q /= totalW;
      if (Q > bestModularity) {
        bestModularity = Q;
        bestAssignments = [...comm];
      }
    }
  }

  // Use partition with best modularity
  const unique = [...new Set(bestAssignments)].sort((a, b) => a - b);
  const assignments = bestAssignments.map(c => unique.indexOf(c));
  return { assignments, k: unique.length };
}

/** Girvan-Newman: iteratively remove edge with highest betweenness, pick best modularity. */
function girvanNewman(matrix: number[][]): { assignments: number[]; k: number } {
  const n = matrix.length;
  // Work on a symmetrized copy
  const adj: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (matrix[i][j] || 0) + (matrix[j][i] || 0)),
  );
  const deg = (m: number[][]) => m.map((_, i) => {
    let s = 0; for (let j = 0; j < n; j++) if (j !== i) s += m[i][j]; return s;
  });

  function getComponents(m: number[][]): number[] {
    const comp = new Array(n).fill(-1);
    let cid = 0;
    for (let s = 0; s < n; s++) {
      if (comp[s] >= 0) continue;
      comp[s] = cid;
      const q = [s]; let qi = 0;
      while (qi < q.length) {
        const v = q[qi++];
        for (let w = 0; w < n; w++) {
          if (comp[w] < 0 && m[v][w] > 0) { comp[w] = cid; q.push(w); }
        }
      }
      cid++;
    }
    return comp;
  }

  function modularity(comp: number[], m: number[][]): number {
    const d = deg(m);
    let totalW = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) totalW += m[i][j];
    if (totalW === 0) return 0;
    let Q = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (comp[i] === comp[j]) Q += m[i][j] - (d[i] * d[j]) / (2 * totalW);
    }
    return Q / totalW;
  }

  // Edge betweenness via Brandes on undirected weighted graph
  function edgeBetweenness(m: number[][]): number[][] {
    const eb: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let s = 0; s < n; s++) {
      const stack: number[] = [];
      const P: number[][] = Array.from({ length: n }, () => []);
      const sigma = new Array(n).fill(0); sigma[s] = 1;
      const d = new Array(n).fill(-1); d[s] = 0;
      const Q = [s]; let qi = 0;
      while (qi < Q.length) {
        const v = Q[qi++]; stack.push(v);
        for (let w = 0; w < n; w++) {
          if (v === w || m[v][w] <= 0) continue;
          if (d[w] < 0) { Q.push(w); d[w] = d[v] + 1; }
          if (d[w] === d[v] + 1) { sigma[w] += sigma[v]; P[w].push(v); }
        }
      }
      const delta = new Array(n).fill(0);
      while (stack.length > 0) {
        const w = stack.pop()!;
        for (const v of P[w]) {
          const c = (sigma[v] / sigma[w]) * (1 + delta[w]);
          eb[v][w] += c; eb[w][v] += c;
          delta[v] += c;
        }
      }
    }
    // Each edge counted twice (from both endpoints as source), halve
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) eb[i][j] /= 2;
    return eb;
  }

  let bestComp = getComponents(adj);
  let bestQ = modularity(bestComp, adj);

  // Remove edges iteratively (limited iterations to keep it fast)
  const maxIter = Math.min(n * n, 200);
  for (let iter = 0; iter < maxIter; iter++) {
    const eb = edgeBetweenness(adj);
    let maxEB = 0, mi = -1, mj = -1;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (adj[i][j] > 0 && eb[i][j] > maxEB) { maxEB = eb[i][j]; mi = i; mj = j; }
    }
    if (mi < 0) break;
    adj[mi][mj] = 0; adj[mj][mi] = 0;

    const comp = getComponents(adj);
    const Q = modularity(comp, adj);
    if (Q > bestQ) { bestQ = Q; bestComp = comp; }
  }

  const unique = [...new Set(bestComp)].sort((a, b) => a - b);
  return { assignments: bestComp.map(c => unique.indexOf(c)), k: unique.length };
}

/** Spectral community detection using the Fiedler vector of the Laplacian. */
function spectralCommunities(matrix: number[][]): { assignments: number[]; k: number } {
  const n = matrix.length;
  // Symmetrize
  const w: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (matrix[i][j] || 0) + (matrix[j][i] || 0)),
  );
  const deg = Array.from({ length: n }, (_, i) => {
    let s = 0; for (let j = 0; j < n; j++) s += w[i][j]; return s;
  });

  // Power iteration to find smallest non-trivial eigenvector (Fiedler vector)
  // We use inverse iteration with shift: find eigenvector of (L - sigma*I)^-1
  // Instead, use simpler approach: deflate the constant eigenvector and power iterate
  // on -L to find the eigenvector with largest eigenvalue of -L (= smallest of L after 0)

  // Actually, let's just do a few iterations of the normalized approach:
  // Start with random vector orthogonal to the all-ones vector
  let v = Array.from({ length: n }, (_, i) => Math.sin(i * 2.71828 + 0.5));
  // Remove component along all-ones
  const removeConst = (vec: number[]) => {
    const mean = vec.reduce((a, b) => a + b, 0) / n;
    return vec.map(x => x - mean);
  };
  const normalize = (vec: number[]) => {
    const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
    return vec.map(x => x / norm);
  };

  v = normalize(removeConst(v));

  // Inverse power iteration: solve L*x = v approximately using Jacobi iterations
  // This converges to the eigenvector with smallest non-zero eigenvalue
  for (let power = 0; power < 100; power++) {
    // Multiply by pseudo-inverse approximation: use (D^-1 * (D - L)) = D^-1 * W
    // which is the random walk matrix. Its second eigenvector = Fiedler of normalized Laplacian
    const next = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      if (deg[i] === 0) { next[i] = v[i]; continue; }
      let s = 0;
      for (let j = 0; j < n; j++) s += w[i][j] * v[j];
      next[i] = s / deg[i];
    }
    v = normalize(removeConst(next));
  }

  // Split into 2 groups by sign of Fiedler vector
  const assignments2 = v.map(x => x >= 0 ? 0 : 1);

  // Try splitting each group recursively for up to 2 more levels
  // to find the partition with best modularity
  let totalW = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) totalW += w[i][j];

  function modQ(asgn: number[]): number {
    if (totalW === 0) return 0;
    let Q = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (asgn[i] === asgn[j]) Q += w[i][j] - (deg[i] * deg[j]) / (2 * totalW);
    }
    return Q / totalW;
  }

  // Just use the 2-way split
  const unique = [...new Set(assignments2)].sort((a, b) => a - b);
  const finalK = unique.length;

  // If modularity is negative or 0, every node gets its own? No, just return 2-way
  const Q2 = modQ(assignments2);
  if (Q2 <= 0 && finalK <= 1) {
    return { assignments: new Array(n).fill(0), k: 1 };
  }

  return { assignments: assignments2.map(c => unique.indexOf(c)), k: finalK };
}

/* ── Layout algorithms ── */

export type LayoutType = 'circle' | 'grid' | 'random' | 'force' | 'concentric' | 'spectral' | 'kamada-kawai' | 'star' | 'hierarchical';

export function computeLayout(
  type: LayoutType,
  n: number,
  matrix: number[][],
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number }[] {
  switch (type) {
    case 'grid': return gridLayout(n, cx, cy, radius);
    case 'random': return randomLayout(n, cx, cy, radius);
    case 'force': return forceLayout(n, matrix, cx, cy, radius);
    case 'concentric': return concentricLayout(n, matrix, cx, cy, radius);
    case 'spectral': return spectralLayout(n, matrix, cx, cy, radius);
    case 'kamada-kawai': return kamadaKawaiLayout(n, matrix, cx, cy, radius);
    case 'star': return starLayout(n, matrix, cx, cy, radius);
    case 'hierarchical': return hierarchicalLayout(n, matrix, cx, cy, radius);
    case 'circle':
    default: return circleLayout(n, cx, cy, radius);
  }
}

function circleLayout(n: number, cx: number, cy: number, r: number) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

function gridLayout(n: number, cx: number, cy: number, r: number) {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cellW = (r * 2) / cols;
  const cellH = (r * 2) / rows;
  const startX = cx - r + cellW / 2;
  const startY = cy - r + cellH / 2;
  return Array.from({ length: n }, (_, i) => ({
    x: startX + (i % cols) * cellW,
    y: startY + Math.floor(i / cols) * cellH,
  }));
}

function randomLayout(n: number, cx: number, cy: number, r: number) {
  // Deterministic seeded positions
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  return Array.from({ length: n }, () => ({
    x: cx + (rand() - 0.5) * r * 1.8,
    y: cy + (rand() - 0.5) * r * 1.8,
  }));
}

function forceLayout(n: number, matrix: number[][], cx: number, cy: number, r: number) {
  // Fruchterman-Reingold force-directed layout
  const area = (r * 2) * (r * 2);
  const k = Math.sqrt(area / Math.max(n, 1));
  // Initialize with circle
  const pos = circleLayout(n, cx, cy, r * 0.8);
  const iterations = 200;
  let temp = r * 0.3;
  const coolRate = temp / (iterations + 1);

  for (let iter = 0; iter < iterations; iter++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));

    // Repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const repF = (k * k) / dist;
        const rx = (dx / dist) * repF;
        const ry = (dy / dist) * repF;
        disp[i].x += rx; disp[i].y += ry;
        disp[j].x -= rx; disp[j].y -= ry;
      }
    }

    // Attraction along edges
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j || matrix[i][j] <= 0) continue;
        const dx = pos[j].x - pos[i].x;
        const dy = pos[j].y - pos[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const attF = (dist * dist) / k;
        const ax = (dx / dist) * attF * 0.5;
        const ay = (dy / dist) * attF * 0.5;
        disp[i].x += ax; disp[i].y += ay;
        disp[j].x -= ax; disp[j].y -= ay;
      }
    }

    // Gravity towards center to prevent drift
    for (let i = 0; i < n; i++) {
      const dx = cx - pos[i].x;
      const dy = cy - pos[i].y;
      disp[i].x += dx * 0.01;
      disp[i].y += dy * 0.01;
    }

    // Apply displacements clamped by temperature
    const pad = 30;
    for (let i = 0; i < n; i++) {
      const mag = Math.sqrt(disp[i].x ** 2 + disp[i].y ** 2) || 1;
      const scale = Math.min(mag, temp) / mag;
      pos[i].x += disp[i].x * scale;
      pos[i].y += disp[i].y * scale;
      pos[i].x = Math.max(cx - r + pad, Math.min(cx + r - pad, pos[i].x));
      pos[i].y = Math.max(cy - r + pad, Math.min(cy + r - pad, pos[i].y));
    }

    temp -= coolRate;
  }
  return pos;
}

function concentricLayout(n: number, matrix: number[][], cx: number, cy: number, r: number) {
  // Sort nodes by total degree, place highest-degree nodes in center
  const degrees = Array.from({ length: n }, (_, i) => {
    let d = 0;
    for (let j = 0; j < n; j++) { if (i !== j && (matrix[i][j] > 0 || matrix[j][i] > 0)) d++; }
    return { idx: i, deg: d };
  }).sort((a, b) => b.deg - a.deg);

  // Split into 3 rings: center (top 20%), middle (next 40%), outer (rest)
  const ring1 = Math.max(1, Math.ceil(n * 0.2));
  const ring2 = Math.max(1, Math.ceil(n * 0.4));

  const pos: { x: number; y: number }[] = new Array(n);
  const rings = [
    { items: degrees.slice(0, ring1), radius: r * 0.2 },
    { items: degrees.slice(ring1, ring1 + ring2), radius: r * 0.6 },
    { items: degrees.slice(ring1 + ring2), radius: r * 0.95 },
  ];

  for (const { items, radius } of rings) {
    items.forEach(({ idx }, i) => {
      if (items.length === 1) {
        pos[idx] = { x: cx, y: cy };
      } else {
        const angle = (2 * Math.PI * i) / items.length - Math.PI / 2;
        pos[idx] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
      }
    });
  }

  return pos;
}

function spectralLayout(n: number, matrix: number[][], cx: number, cy: number, r: number) {
  // Two smallest non-trivial eigenvectors of the graph Laplacian as x,y.
  const w: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (matrix[i][j] || 0) + (matrix[j][i] || 0)),
  );
  const deg = w.map(row => row.reduce((a, b) => a + b, 0));

  const removeConst = (v: number[]) => {
    const mean = v.reduce((a, b) => a + b, 0) / n;
    return v.map(x => x - mean);
  };
  const normalize = (v: number[]) => {
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
    return v.map(x => x / norm);
  };
  const deflate = (v: number[], u: number[]) => {
    const dot = v.reduce((s, vi, i) => s + vi * u[i], 0);
    return v.map((vi, i) => vi - dot * u[i]);
  };
  const powerIterate = (init: number[], deflectors: number[][]) => {
    let v = normalize(removeConst(init));
    for (let iter = 0; iter < 150; iter++) {
      const next = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        if (deg[i] === 0) { next[i] = v[i]; continue; }
        let s = 0;
        for (let j = 0; j < n; j++) s += w[i][j] * v[j];
        next[i] = s / deg[i];
      }
      let result = removeConst(next);
      for (const d of deflectors) result = deflate(result, d);
      v = normalize(result);
    }
    return v;
  };

  const v1 = powerIterate(Array.from({ length: n }, (_, i) => Math.sin(i * 2.71828 + 0.5)), []);
  const v2 = powerIterate(Array.from({ length: n }, (_, i) => Math.cos(i * 1.61803 + 0.3)), [v1]);

  const pad = 30;
  const usable = r - pad;
  const minX = Math.min(...v1), maxX = Math.max(...v1);
  const minY = Math.min(...v2), maxY = Math.max(...v2);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  return Array.from({ length: n }, (_, i) => ({
    x: cx + ((v1[i] - minX) / rangeX - 0.5) * usable * 2,
    y: cy + ((v2[i] - minY) / rangeY - 0.5) * usable * 2,
  }));
}

function kamadaKawaiLayout(n: number, matrix: number[][], cx: number, cy: number, r: number) {
  // Spring model minimizing energy based on graph-theoretic shortest-path distances.
  const dist: number[][] = Array.from({ length: n }, () => new Array(n).fill(Infinity));
  for (let s = 0; s < n; s++) {
    dist[s][s] = 0;
    const q = [s];
    let qi = 0;
    while (qi < q.length) {
      const v = q[qi++];
      for (let w = 0; w < n; w++) {
        if (dist[s][w] < Infinity || w === v) continue;
        if (matrix[v][w] > 0 || matrix[w][v] > 0) { dist[s][w] = dist[s][v] + 1; q.push(w); }
      }
    }
  }
  let maxDist = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (dist[i][j] < Infinity && dist[i][j] > maxDist) maxDist = dist[i][j];
  const fallback = maxDist + 1;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (dist[i][j] === Infinity) dist[i][j] = fallback;

  const L0 = (r * 1.6) / Math.max(maxDist, 1);
  const pos = circleLayout(n, cx, cy, r * 0.6);

  for (let iter = 0; iter < 300; iter++) {
    const step = 0.1 * (1 - iter / 300);
    for (let i = 0; i < n; i++) {
      let gx = 0, gy = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const ideal = dist[i][j] * L0;
        const k = 1 / (dist[i][j] * dist[i][j]);
        const force = k * (d - ideal) / d;
        gx += force * dx;
        gy += force * dy;
      }
      pos[i].x -= step * gx;
      pos[i].y -= step * gy;
    }
  }

  const pad = 30;
  let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
  for (const p of pos) { mnX = Math.min(mnX, p.x); mxX = Math.max(mxX, p.x); mnY = Math.min(mnY, p.y); mxY = Math.max(mxY, p.y); }
  const rX = mxX - mnX || 1, rY = mxY - mnY || 1;
  const usable = r - pad;
  return pos.map(p => ({
    x: cx + ((p.x - mnX) / rX - 0.5) * usable * 2,
    y: cy + ((p.y - mnY) / rY - 0.5) * usable * 2,
  }));
}

function starLayout(n: number, matrix: number[][], cx: number, cy: number, r: number) {
  // Hub node (highest degree) at center, neighbors on inner ring, rest on outer ring.
  const degrees = Array.from({ length: n }, (_, i) => {
    let d = 0;
    for (let j = 0; j < n; j++) if (i !== j && (matrix[i][j] > 0 || matrix[j][i] > 0)) d++;
    return d;
  });
  const hub = degrees.indexOf(Math.max(...degrees));

  const pos: { x: number; y: number }[] = new Array(n);
  pos[hub] = { x: cx, y: cy };

  const neighbors: number[] = [];
  const others: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === hub) continue;
    if (matrix[hub][i] > 0 || matrix[i][hub] > 0) neighbors.push(i);
    else others.push(i);
  }

  const innerR = r * 0.5;
  neighbors.forEach((idx, i) => {
    const angle = (2 * Math.PI * i) / neighbors.length - Math.PI / 2;
    pos[idx] = { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) };
  });

  if (others.length > 0) {
    const outerR = r * 0.92;
    others.forEach((idx, i) => {
      const angle = (2 * Math.PI * i) / others.length - Math.PI / 2;
      pos[idx] = { x: cx + outerR * Math.cos(angle), y: cy + outerR * Math.sin(angle) };
    });
  }

  return pos;
}

function hierarchicalLayout(n: number, matrix: number[][], cx: number, cy: number, r: number) {
  // BFS-layered: root = highest-degree node, layers by BFS depth, top to bottom.
  const degrees = Array.from({ length: n }, (_, i) => {
    let d = 0;
    for (let j = 0; j < n; j++) if (i !== j && (matrix[i][j] > 0 || matrix[j][i] > 0)) d++;
    return d;
  });
  const root = degrees.indexOf(Math.max(...degrees));

  const layer = new Array(n).fill(-1);
  layer[root] = 0;
  const queue = [root];
  let qi = 0;
  while (qi < queue.length) {
    const v = queue[qi++];
    for (let w = 0; w < n; w++) {
      if (layer[w] >= 0 || w === v) continue;
      if (matrix[v][w] > 0 || matrix[w][v] > 0) { layer[w] = layer[v] + 1; queue.push(w); }
    }
  }
  let maxLayer = Math.max(...layer.filter(l => l >= 0), 0);
  for (let i = 0; i < n; i++) if (layer[i] < 0) layer[i] = ++maxLayer;

  const layers: number[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (let i = 0; i < n; i++) layers[layer[i]].push(i);

  const pos: { x: number; y: number }[] = new Array(n);
  const pad = 30;
  const usableH = (r - pad) * 2;
  const usableW = (r - pad) * 2;
  const layerCount = maxLayer + 1;
  const layerSpacing = layerCount > 1 ? usableH / (layerCount - 1) : 0;
  const topY = cy - usableH / 2;

  for (let l = 0; l < layerCount; l++) {
    const nodes = layers[l];
    const y = layerCount > 1 ? topY + l * layerSpacing : cy;
    const nodeSpacing = nodes.length > 1 ? usableW / (nodes.length - 1) : 0;
    const startX = cx - (nodes.length > 1 ? usableW / 2 : 0);
    nodes.forEach((idx, i) => { pos[idx] = { x: startX + i * nodeSpacing, y }; });
  }

  return pos;
}
