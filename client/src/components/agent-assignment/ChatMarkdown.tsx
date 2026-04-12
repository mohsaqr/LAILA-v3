import ReactMarkdown from 'react-markdown';
import { Download, Copy, Check, Network, GitBranch } from 'lucide-react';
import { useState, useMemo } from 'react';
import { buildModel, layout as dynaLayout } from 'dynajs';
import type { TNA, LayoutAlgorithm } from 'dynajs';
import { TnaNetworkGraph } from '../tna/TnaNetworkGraph';
import { edgesToMatrix, type Edge } from '../sna-exercise/sampleNetworks';
import { computeAllCentralities } from '../sna-exercise/utils';
import { createColorMap } from '../tna/colorFix';

interface ChatMarkdownProps {
  content: string;
}

type VizMode = null | 'sna' | 'tna';

function parseCSVRows(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
  return { headers, rows };
}

function buildSNAModel(text: string): { model: TNA; positions: { x: number; y: number }[]; colorMap: Record<string, string> } | null {
  const { headers, rows } = parseCSVRows(text);
  if (rows.length === 0) return null;

  // Try to find from/to/weight columns
  const h = headers.map(s => s.toLowerCase());
  const fromIdx = h.findIndex(c => ['from', 'source', 'source_id', 'actor1', 'node1'].includes(c));
  const toIdx = h.findIndex(c => ['to', 'target', 'target_id', 'actor2', 'node2'].includes(c));
  const weightIdx = h.findIndex(c => ['weight', 'value', 'strength', 'count'].includes(c));

  const edges: Edge[] = [];
  for (const row of rows) {
    const from = row[fromIdx >= 0 ? fromIdx : 0] || '';
    const to = row[toIdx >= 0 ? toIdx : 1] || '';
    const weight = weightIdx >= 0 ? parseFloat(row[weightIdx]) || 1 : 1;
    if (from && to) edges.push({ from, to, weight });
  }
  if (edges.length === 0) return null;

  const { labels, matrix } = edgesToMatrix(edges, true);
  try {
    const model = buildModel(matrix, { type: 'matrix', labels, scaling: null });
    const result = dynaLayout(model, { algorithm: 'fr' });
    const size = 400;
    const pad = 40;
    const positions = Array.from({ length: result.labels.length }, (_, i) => ({
      x: pad + result.x[i]! * (size - 2 * pad),
      y: pad + result.y[i]! * (size - 2 * pad),
    }));
    const colorMap = createColorMap(labels);
    return { model, positions, colorMap };
  } catch { return null; }
}

function buildTNAModel(text: string): { model: TNA; colorMap: Record<string, string> } | null {
  const { headers, rows } = parseCSVRows(text);
  if (rows.length < 3) return null;

  // Try to find actor/action columns
  const h = headers.map(s => s.toLowerCase());
  const actorIdx = h.findIndex(c => ['actor', 'student', 'user', 'student_id', 'user_id', 'source_id', 'id'].includes(c));
  const actionIdx = h.findIndex(c => ['action', 'activity', 'event', 'verb', 'behavior', 'state', 'species', 'type'].includes(c));

  if (actorIdx < 0 && actionIdx < 0) return null;

  // Build sequences grouped by actor
  const seqMap: Record<string, string[]> = {};
  for (const row of rows) {
    const actor = row[actorIdx >= 0 ? actorIdx : 0] || 'unknown';
    const action = row[actionIdx >= 0 ? actionIdx : 1] || '';
    if (!action) continue;
    if (!seqMap[actor]) seqMap[actor] = [];
    seqMap[actor].push(action);
  }

  const sequences = Object.values(seqMap).filter(s => s.length >= 2);
  if (sequences.length === 0) return null;

  // Build labels
  const labelSet = new Set<string>();
  for (const seq of sequences) for (const s of seq) labelSet.add(s);
  const labels = [...labelSet].sort();

  // Build transition matrix
  const n = labels.length;
  const idx: Record<string, number> = {};
  labels.forEach((l, i) => { idx[l] = i; });
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (const seq of sequences) {
    for (let i = 0; i < seq.length - 1; i++) {
      matrix[idx[seq[i]]][idx[seq[i + 1]]]++;
    }
  }

  // Normalize to probabilities
  for (let i = 0; i < n; i++) {
    const rowSum = matrix[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) for (let j = 0; j < n; j++) matrix[i][j] /= rowSum;
  }

  try {
    const model = buildModel(matrix, { type: 'matrix', labels, scaling: null });
    const colorMap = createColorMap(labels);
    return { model, colorMap };
  } catch { return null; }
}

const LAYOUT_OPTIONS: { value: LayoutAlgorithm; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'fr', label: 'Force-directed' },
  { value: 'kamada-kawai', label: 'Kamada-Kawai' },
  { value: 'spectral', label: 'Spectral' },
  { value: 'concentric', label: 'Concentric' },
  { value: 'grid', label: 'Grid' },
  { value: 'random', label: 'Random' },
];

const SIZE_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'InStrength', label: 'In-Strength' },
  { value: 'OutStrength', label: 'Out-Strength' },
  { value: 'InDegree', label: 'In-Degree' },
  { value: 'OutDegree', label: 'Out-Degree' },
  { value: 'Betweenness', label: 'Betweenness' },
];

const InlineViz = ({ text, mode }: { text: string; mode: 'sna' | 'tna' }) => {
  const [layout, setLayout] = useState<LayoutAlgorithm>('fr');
  const [nodeRadius, setNodeRadius] = useState(22);
  const [nodeSizeBy, setNodeSizeBy] = useState('fixed');
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [showSelfLoops, setShowSelfLoops] = useState(false);
  const [showNodeLabels, setShowNodeLabels] = useState(true);
  const [edgeWidth, setEdgeWidth] = useState(2);
  const [directed, setDirected] = useState(true);

  const baseResult = useMemo(() => {
    if (mode === 'sna') return buildSNAModel(text);
    return buildTNAModel(text);
  }, [text, mode]);

  const centralityData = useMemo(() => {
    if (!baseResult) return null;
    const { labels, weights } = baseResult.model;
    const n = labels.length;
    const matrix: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => weights.get(i, j))
    );
    return computeAllCentralities(matrix, labels);
  }, [baseResult]);

  const positions = useMemo(() => {
    if (!baseResult) return undefined;
    try {
      const result = dynaLayout(baseResult.model, { algorithm: layout });
      const size = 450;
      const pad = 40;
      return Array.from({ length: result.labels.length }, (_, i) => ({
        x: pad + result.x[i]! * (size - 2 * pad),
        y: pad + result.y[i]! * (size - 2 * pad),
      }));
    } catch { return undefined; }
  }, [baseResult, layout]);

  if (!baseResult) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
        Could not build {mode === 'sna' ? 'network' : 'transition'} model from this data.
        {mode === 'sna' ? ' Expected columns: from/source, to/target, weight (optional).' : ' Expected columns: actor/student, action/activity.'}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 mt-2 overflow-hidden">
      {/* Title */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {mode === 'sna' ? 'Social Network Analysis' : 'Transition Network Analysis'}
        </span>
      </div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-gray-100 text-[11px]">
        <label className="flex items-center gap-1">
          <span className="text-gray-500">Layout</span>
          <select value={layout} onChange={e => setLayout(e.target.value as LayoutAlgorithm)}
            className="px-1.5 py-0.5 rounded border border-gray-200 bg-white text-[11px]">
            {LAYOUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-gray-500">Size by</span>
          <select value={nodeSizeBy} onChange={e => setNodeSizeBy(e.target.value)}
            className="px-1.5 py-0.5 rounded border border-gray-200 bg-white text-[11px]">
            {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-gray-500">Node</span>
          <input type="range" min={12} max={40} value={nodeRadius}
            onChange={e => setNodeRadius(Number(e.target.value))} className="w-14 h-1 accent-violet-600" />
          <span className="text-gray-400 tabular-nums w-4">{nodeRadius}</span>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-gray-500">Edge</span>
          <input type="range" min={1} max={12} step={0.5} value={edgeWidth}
            onChange={e => setEdgeWidth(Number(e.target.value))} className="w-14 h-1 accent-violet-600" />
          <span className="text-gray-400 tabular-nums w-4">{edgeWidth}</span>
        </label>
        <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showEdgeLabels} onChange={e => setShowEdgeLabels(e.target.checked)}
            className="rounded w-3 h-3 text-violet-600" />
          Weights
        </label>
        <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showNodeLabels} onChange={e => setShowNodeLabels(e.target.checked)}
            className="rounded w-3 h-3 text-violet-600" />
          Labels
        </label>
        <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showSelfLoops} onChange={e => setShowSelfLoops(e.target.checked)}
            className="rounded w-3 h-3 text-violet-600" />
          Self-loops
        </label>
        {mode === 'sna' && (
          <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
            <input type="checkbox" checked={!directed} onChange={e => setDirected(!e.target.checked)}
              className="rounded w-3 h-3 text-violet-600" />
            Undirected
          </label>
        )}
      </div>
      {/* Graph */}
      <TnaNetworkGraph
        model={baseResult.model}
        showSelfLoops={showSelfLoops}
        showEdgeLabels={showEdgeLabels}
        showNodeLabels={showNodeLabels}
        nodeRadius={nodeRadius}
        height={450}
        colorMap={baseResult.colorMap}
        centralityData={centralityData ?? undefined}
        nodeSizeMetric={nodeSizeBy !== 'fixed' ? nodeSizeBy : undefined}
        externalPositions={positions}
        maxEdgeWidth={edgeWidth}
        directed={directed}
      />
    </div>
  );
};

const CodeBlock = ({ className, children }: { className?: string; children?: React.ReactNode }) => {
  const [copied, setCopied] = useState(false);
  const [vizMode, setVizMode] = useState<VizMode>(null);
  const text = String(children).replace(/\n$/, '');
  const lang = className?.replace('language-', '') || '';
  const isCSV = lang === 'csv' || ((lang === '' || lang === 'plaintext' || lang === 'text') && isLikelyCSV(text));

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataset-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-t-lg border border-b-0 border-gray-200 dark:border-gray-600">
        <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">{lang || (isCSV ? 'csv' : 'code')}</span>
        <div className="flex items-center gap-1">
          {isCSV && (
            <>
              <button
                onClick={() => setVizMode(vizMode === 'sna' ? null : 'sna')}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${vizMode === 'sna' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-violet-600 hover:bg-violet-50'}`}
                title="Visualize as SNA network"
              >
                <span className="flex items-center gap-1"><Network className="w-3 h-3" />SNA</span>
              </button>
              <button
                onClick={() => setVizMode(vizMode === 'tna' ? null : 'tna')}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${vizMode === 'tna' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
                title="Visualize as TNA network"
              >
                <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" />TNA</span>
              </button>
              <button onClick={handleDownload} className="p-1 text-gray-400 hover:text-violet-600 rounded transition-colors" title="Download CSV">
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button onClick={handleCopy} className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors" title="Copy">
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <pre className="!mt-0 !rounded-t-none"><code className={className}>{text}</code></pre>
      {isCSV && (
        <div className="px-3 py-1.5 bg-green-50 border border-t-0 border-gray-200 rounded-b-lg text-[11px] text-green-700 flex items-center gap-1.5">
          <Check className="w-3 h-3" />
          Dataset saved to your Datasets list
        </div>
      )}
      {vizMode && isCSV && <InlineViz text={text} mode={vizMode} />}
    </div>
  );
};

function isLikelyCSV(text: string): boolean {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return false;
  const headerCommas = (lines[0].match(/,/g) || []).length;
  if (headerCommas === 0) return false;
  return lines.slice(1, Math.min(5, lines.length)).every(line => {
    const commas = (line.match(/,/g) || []).length;
    return commas === headerCommas;
  });
}

export const ChatMarkdown = ({ content }: ChatMarkdownProps) => {
  return (
    <ReactMarkdown
      components={{
        pre: ({ children }) => <>{children}</>,
        code: ({ className, children }) => {
          const isInline = !className && !String(children).includes('\n');
          if (isInline) {
            return <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-mono">{children}</code>;
          }
          return <CodeBlock className={className}>{children}</CodeBlock>;
        },
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
        h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-left font-semibold border-b border-gray-200 dark:border-gray-600">{children}</th>,
        td: ({ children }) => <td className="px-2 py-1 border-b border-gray-100 dark:border-gray-700">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
