/**
 * AI Dataset Generator — modal that lets students describe a dataset
 * in natural language, sends it to the LLM with a hidden system prompt
 * that constrains the output format, parses the result, and returns it.
 *
 * Supports two modes:
 *   - 'tna': generates tabular event-log data (actor, action, timestamp)
 *   - 'sna': generates a weighted edge list (from, to, weight)
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { chatApi } from '../../api/chat';
import type { RawRow } from '../tna-exercise/sampleDatasets';
import type { Edge } from '../sna-exercise/sampleNetworks';

/* ── System prompts (hidden from students) ── */

const TNA_SYSTEM_PROMPT = `You are a dataset generator for Transition Network Analysis (TNA) in a learning analytics context.
Generate a realistic event-log dataset based on the user's description.

Output ONLY a valid JSON object — no markdown fences, no explanation, no text before or after.

Format:
{
  "columns": ["actor", "action", "timestamp"],
  "rows": [
    {"actor": "Student_01", "action": "Reading", "timestamp": "2024-01-15 09:00"},
    {"actor": "Student_01", "action": "Discussing", "timestamp": "2024-01-15 09:12"}
  ]
}

Rules:
- Generate between 100 and 300 rows (never more than 300).
- "actor" values: use short identifiers (Student_01, Student_02, etc.). Between 5 and 30 actors.
- "action" values: use concise activity labels relevant to the user's scenario. Between 4 and 12 unique actions.
- "timestamp" values: chronological, formatted as "YYYY-MM-DD HH:mm".
- Each actor should have multiple events spread over time.
- Make the data realistic — actors should show behavioral patterns, not purely random sequences.
- Output ONLY the JSON object. Any extra text will cause a parse error.`;

const SNA_SYSTEM_PROMPT = `You are a network generator for Social Network Analysis (SNA) in a learning analytics context.
Generate a realistic social network based on the user's description.

Output ONLY a valid JSON object — no markdown fences, no explanation, no text before or after.

Format:
{
  "edges": [
    {"from": "Alice", "to": "Bob", "weight": 3},
    {"from": "Bob", "to": "Charlie", "weight": 1}
  ],
  "directed": true
}

Rules:
- Maximum 50 nodes (never more).
- Use realistic names or short identifiers relevant to the user's description.
- Weights: positive integers between 1 and 10.
- Include enough edges to create an interesting network (density ~0.1-0.4).
- Not every pair needs a connection — real networks are sparse.
- Make the structure realistic — some nodes more central, some peripheral.
- The "directed" field should be true unless the user specifically describes an undirected relationship.
- Output ONLY the JSON object. Any extra text will cause a parse error.`;

/* ── Types ── */

export interface TnaGeneratedData {
  columns: string[];
  rows: RawRow[];
}

export interface SnaGeneratedData {
  edges: Edge[];
  directed: boolean;
}

interface AIDatasetGeneratorProps {
  type: 'tna' | 'sna';
  onClose: () => void;
  onTnaData?: (data: TnaGeneratedData) => void;
  onSnaData?: (data: SnaGeneratedData) => void;
}

/* ── Parsers with validation ── */

function parseTnaResponse(raw: string): TnaGeneratedData {
  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed.columns) || !Array.isArray(parsed.rows)) {
    throw new Error('Missing "columns" or "rows" array');
  }
  if (parsed.rows.length === 0) throw new Error('Empty rows');
  if (parsed.rows.length > 300) parsed.rows = parsed.rows.slice(0, 300);

  // Validate each row has the expected columns
  const cols = parsed.columns as string[];
  const rows: RawRow[] = parsed.rows.map((r: Record<string, string>) => {
    const row: RawRow = {};
    for (const col of cols) {
      row[col] = String(r[col] ?? '');
    }
    return row;
  });

  return { columns: cols, rows };
}

function parseSnaResponse(raw: string): SnaGeneratedData {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed.edges)) {
    throw new Error('Missing "edges" array');
  }
  if (parsed.edges.length === 0) throw new Error('Empty edges');

  // Validate & enforce 50-node limit
  const nodeSet = new Set<string>();
  const edges: Edge[] = [];
  for (const e of parsed.edges) {
    if (!e.from || !e.to) continue;
    nodeSet.add(String(e.from));
    nodeSet.add(String(e.to));
    if (nodeSet.size > 50) break;
    edges.push({
      from: String(e.from),
      to: String(e.to),
      weight: Math.max(1, Math.min(10, Math.round(Number(e.weight) || 1))),
    });
  }

  return {
    edges,
    directed: parsed.directed !== false,
  };
}

/* ── Component ── */

export const AIDatasetGenerator = ({
  type,
  onClose,
  onTnaData,
  onSnaData,
}: AIDatasetGeneratorProps) => {
  const { t } = useTranslation(['courses']);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const maxAttempts = 3;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const response = await chatApi.sendMessage({
        message: prompt.trim(),
        module: `ai-dataset-${type}`,
        systemPrompt: type === 'tna' ? TNA_SYSTEM_PROMPT : SNA_SYSTEM_PROMPT,
      });

      const raw = response.reply;

      if (type === 'tna') {
        const data = parseTnaResponse(raw);
        onTnaData?.(data);
        onClose();
      } else {
        const data = parseSnaResponse(raw);
        onSnaData?.(data);
        onClose();
      }
    } catch (err: any) {
      const nextAttempt = attempt + 1;
      setAttempt(nextAttempt);

      if (nextAttempt >= maxAttempts) {
        setError(t('ai_gen.max_attempts'));
      } else {
        setError(
          t('ai_gen.parse_error', {
            remaining: maxAttempts - nextAttempt,
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const placeholderText =
    type === 'tna'
      ? t('ai_gen.placeholder_tna')
      : t('ai_gen.placeholder_sna');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-lg mx-4 p-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {t('ai_gen.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {type === 'tna' ? t('ai_gen.desc_tna') : t('ai_gen.desc_sna')}
        </p>

        {/* Prompt input */}
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={placeholderText}
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          disabled={loading}
        />

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-[10px] text-gray-400">
            {type === 'tna'
              ? t('ai_gen.limits_tna')
              : t('ai_gen.limits_sna')}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {t('ai_gen.cancel')}
            </button>
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading || attempt >= maxAttempts}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t('ai_gen.generating')}
                </>
              ) : attempt > 0 && attempt < maxAttempts ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {t('ai_gen.retry')}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t('ai_gen.generate')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
