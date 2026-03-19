/**
 * LabAIAssistant — collapsible AI explanation panel for TNA/SNA analysis tabs.
 *
 * Assignment context: explains concepts only, never answers or solves.
 * Single "Explain this" chip + freeform question input.
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, ChevronDown, ChevronRight, Send, RefreshCw } from 'lucide-react';
import { chatApi } from '../../api/chat';

const TNA_SYSTEM_PROMPT = `You are a learning tutor for Transition Network Analysis (TNA).
The student is completing a graded assignment involving TNA analysis.

IMPORTANT: Do NOT solve the assignment or provide direct answers. Your role is to explain concepts only.
- Explain what the analysis type means and how to interpret it in general
- Define technical terms (centrality, transitions, pruning, etc.) in plain language
- Ask guiding questions that help the student think — do NOT answer for them
- Never say "your answer is" or "the result shows X" in a way that removes the need for student analysis
- Keep responses to 2–3 short paragraphs`;

const SNA_SYSTEM_PROMPT = `You are a learning tutor for Social Network Analysis (SNA).
The student is completing a graded assignment involving SNA analysis.

IMPORTANT: Do NOT solve the assignment or provide direct answers. Your role is to explain concepts only.
- Explain what the analysis type means and how to interpret it in general
- Define technical terms (density, centrality, communities, etc.) in plain language
- Ask guiding questions that help the student think — do NOT answer for them
- Never say "your answer is" or "the result shows X" in a way that removes the need for student analysis
- Keep responses to 2–3 short paragraphs`;

interface LabAIAssistantProps {
  context: string;
  data?: string;
  labType: 'tna' | 'sna';
  analysisKey: string;
}

export const LabAIAssistant = ({ context, data, labType, analysisKey }: LabAIAssistantProps) => {
  const { t } = useTranslation(['courses']);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpanded(false);
    setInput('');
    setResponse(null);
    setError(null);
  }, [analysisKey, context, data]);

  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [response]);

  const handleSubmit = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    const systemPrompt = labType === 'tna' ? TNA_SYSTEM_PROMPT : SNA_SYSTEM_PROMPT;
    const contextBlock = `Current analysis: ${context}${data ? `\n\nContext data:\n${data}` : ''}`;
    try {
      const result = await chatApi.sendMessage({
        message: q,
        module: `lab-ai-${labType}-${analysisKey}`,
        context: contextBlock,
        systemPrompt,
      });
      setResponse(result.reply);
    } catch {
      setError('Could not reach the AI. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(input);
  };

  const isTna = labType === 'tna';
  const borderColor = isTna
    ? 'border-indigo-200 dark:border-indigo-800'
    : 'border-violet-200 dark:border-violet-800';
  const toggleCls = isTna
    ? `bg-indigo-50 dark:bg-indigo-950/30 ${borderColor} text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50`
    : `bg-violet-50 dark:bg-violet-950/30 ${borderColor} text-violet-700 dark:text-violet-300 hover:bg-violet-50`;
  const iconCls = isTna ? 'text-indigo-500' : 'text-violet-500';
  const chevronCls = isTna ? 'text-indigo-400' : 'text-violet-400';
  const chipCls = isTna
    ? `px-3 py-1 rounded-full text-xs border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300
       bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors
       disabled:opacity-40 disabled:cursor-not-allowed`
    : `px-3 py-1 rounded-full text-xs border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300
       bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors
       disabled:opacity-40 disabled:cursor-not-allowed`;
  const sendBtnCls = isTna
    ? 'p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
    : 'p-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  return (
    <div>
      {/* Toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-center gap-3 px-5 py-3 rounded-xl border text-left transition-colors ${toggleCls}`}
      >
        <Sparkles className={`w-4 h-4 flex-shrink-0 ${iconCls}`} />
        <span className="flex-1 text-sm font-semibold">{t('courses:lab_ai_ask')}</span>
        {expanded
          ? <ChevronDown className={`w-4 h-4 ${chevronCls}`} />
          : <ChevronRight className={`w-4 h-4 ${chevronCls}`} />
        }
      </button>

      {/* Panel */}
      {expanded && (
        <div className={`rounded-b-xl border-x border-b ${borderColor} bg-white dark:bg-gray-800 p-4 space-y-3`}>
          {/* Single explain chip */}
          <button
            onClick={() => handleSubmit(t('courses:lab_ai_explain'))}
            disabled={loading}
            className={chipCls}
          >
            {t('courses:lab_ai_explain')}
          </button>

          {/* Freeform input */}
          <form onSubmit={handleFormSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t('courses:lab_ai_placeholder')}
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" disabled={!input.trim() || loading} className={sendBtnCls}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>

          {loading && (
            <div className={`flex items-center gap-2 text-xs ${isTna ? 'text-indigo-500' : 'text-violet-500'}`}>
              <RefreshCw className="w-3 h-3 animate-spin" />
              {t('courses:lab_ai_thinking')}
            </div>
          )}

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          {response && (
            <div ref={responseRef} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">AI Tutor</p>
              <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{response}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
