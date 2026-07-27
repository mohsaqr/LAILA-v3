import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Send, X, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatApi, chatbotsApi } from '../../../api/chat';
import { LabCell } from '../authoring/cell';

export interface AICellContext {
  cell: LabCell;
  code: string;
  error: string | null;
  /** Text output of the cell's last run, truncated — grounding for "why is this wrong". */
  output?: string;
}

interface LabAIPanelProps {
  /** Instructor-attached chatbot; omitted → a neutral default tutor persona. */
  chatbotId?: number;
  labName: string;
  language: 'r' | 'python';
  /** Cell the student asked about; refreshed on every "Ask AI" click. */
  cellContext: AICellContext | null;
  isOpen: boolean;
  onClose: () => void;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Chat panel for the lab's attached AI assistant. The instructor picks which
 * chatbot (if any) serves a lab; its persona drives the conversation, and each
 * "Ask AI" click grounds it in the current cell's code and error.
 */
export const LabAIPanel = ({
  chatbotId,
  labName,
  language,
  cellContext,
  isOpen,
  onClose,
}: LabAIPanelProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: chatbot } = useQuery({
    queryKey: ['chatbot', chatbotId],
    queryFn: () => chatbotsApi.getChatbotById(chatbotId!),
    enabled: chatbotId != null,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Seed a question when the student clicks Ask AI on a failing cell.
  useEffect(() => {
    if (isOpen && cellContext?.error && !input) {
      setInput(
        t('courses:ai_error_seed', {
          defaultValue: 'I got an error running this cell — can you help me understand it?',
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellContext, isOpen]);

  if (!isOpen) return null;

  const contextBlock = cellContext
    ? `\n\nThe student is currently working on the cell "${cellContext.cell.title}".` +
      `\nInstructions: ${cellContext.cell.prose || '(none)'}` +
      `\nTheir current ${language === 'python' ? 'Python' : 'R'} code:\n\`\`\`${language}\n${cellContext.code}\n\`\`\`` +
      (cellContext.output ? `\nOutput of their last run:\n${cellContext.output}` : '') +
      (cellContext.error ? `\nThe last run failed with:\n${cellContext.error}` : '')
    : '';

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    const history = messages.slice(-20);
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setSending(true);
    try {
      const res = await chatApi.sendMessage({
        message: text,
        module: 'lab-assistant',
        // When a chatbot is attached its stored persona is applied server-side;
        // otherwise this generic tutor prompt is used. The chatbot's prompt
        // text never reaches the client.
        chatbotId,
        systemPrompt: chatbotId
          ? undefined
          : `You are a helpful ${language === 'python' ? 'Python' : 'R'} tutor helping a student in a coding lab. Guide the student toward understanding; prefer hints over full solutions unless they are clearly stuck.`,
        context: `The student is inside the lab "${labName}".` + contextBlock,
        conversationHistory: history,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: t('courses:ai_error', {
            defaultValue: 'Sorry, I could not reach the AI service. Please try again.',
          }),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-y-0 ltr:right-0 rtl:left-0 z-[60] w-full sm:w-[26rem] flex flex-col bg-white dark:bg-gray-800 ltr:border-l rtl:border-r border-gray-200 dark:border-gray-700 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-violet-50 to-white dark:from-violet-900/20 dark:to-gray-800">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/50">
          <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-300" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {chatbot?.displayName ??
              t('courses:ai_assistant', { defaultValue: 'AI Assistant' })}
          </p>
          {cellContext && (
            <p className="text-xs text-gray-400 truncate">
              {t('courses:ai_context_cell', {
                title: cellContext.cell.title,
                defaultValue: 'Looking at: {{title}}',
              })}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">
            {chatbot?.description ??
              t('courses:ai_welcome', {
                defaultValue: 'Ask me anything about this lab — I can see the cell you are working on.',
              })}
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-auto bg-emerald-600 text-white rounded-br-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm'
            }`}
          >
            {m.role === 'assistant' ? (
              <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:overflow-x-auto">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ) : (
              m.content
            )}
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('courses:ai_thinking', { defaultValue: 'Thinking…' })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder={t('courses:ai_placeholder', { defaultValue: 'Ask about your code…' })}
            className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
