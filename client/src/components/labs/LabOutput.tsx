import { useState, useEffect, useCallback } from 'react';
import { Terminal, Image, AlertCircle, Trash2, Brain, Loader2, FileText, Lightbulb, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '../common/Button';
import { useTheme } from '../../hooks/useTheme';
import apiClient from '../../api/client';

interface OutputItem {
  type: 'stdout' | 'stderr' | 'plot' | 'message';
  content: string;
}

interface LabOutputProps {
  outputs: OutputItem[];
  onClear: () => void;
  labId?: number;
  /** The code that was executed — used as context when output is plot-only */
  code?: string;
  /** The template title — added to the AI prompt for context */
  templateTitle?: string;
}

// Storage key for interpretations
const getStorageKey = (labId?: number) => `lab_interpretation_${labId || 'default'}`;

interface StoredInterpretation {
  interpretation: string;
  action: string;
  outputHash: string;
  timestamp: number;
}

// Simple hash function for output content
const hashOutput = (outputs: OutputItem[]): string => {
  const text = outputs
    .filter(o => o.type === 'stdout' || o.type === 'stderr')
    .map(o => o.content)
    .join('');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
};

// AI Interpretation Prompts
const ACTION_PROMPTS = {
  interpret: {
    label: 'Interpret',
    icon: Brain,
    prompt: `Identify the type of analysis (descriptive statistics, group comparison, correlation, regression, etc.). Describe the main findings in formal scientific language. For descriptive tables: report central tendency (M), variability (SD), and sample sizes. For correlations: report r values, direction, strength (weak/moderate/strong), and significance. For group comparisons: report group means, effect sizes (Cohen's d, eta-squared), and test statistics. For frequency tables: report counts, percentages, and any association tests.`,
  },
  explain: {
    label: 'Explain',
    icon: Lightbulb,
    prompt: `Explain what this analysis shows and what the output means. Help the reader understand what was computed and why it matters. Define any technical terms used.`,
  },
};

type ActionType = keyof typeof ACTION_PROMPTS;

export const LabOutput = ({ outputs, onClear, labId, code, templateTitle }: LabOutputProps) => {
  const { isDark } = useTheme();
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [showInterpretPanel, setShowInterpretPanel] = useState(false);

  // Load stored interpretation on mount or when outputs change
  useEffect(() => {
    if (outputs.length === 0) return;

    const storageKey = getStorageKey(labId);
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const data: StoredInterpretation = JSON.parse(stored);
        const currentHash = hashOutput(outputs);

        // Only restore if the output hasn't changed and the action still exists
        if (data.outputHash === currentHash && data.action in ACTION_PROMPTS) {
          setInterpretation(data.interpretation);
          setSelectedAction(data.action as ActionType);
          setShowInterpretPanel(true);
        }
      } catch (e) {
        // Invalid stored data, ignore
      }
    }
  }, [outputs, labId]);

  // Save interpretation to localStorage
  const saveInterpretation = useCallback((text: string, action: ActionType) => {
    const storageKey = getStorageKey(labId);
    const data: StoredInterpretation = {
      interpretation: text,
      action,
      outputHash: hashOutput(outputs),
      timestamp: Date.now(),
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
  }, [labId, outputs]);

  // Clear stored interpretation
  const clearStoredInterpretation = useCallback(() => {
    const storageKey = getStorageKey(labId);
    localStorage.removeItem(storageKey);
  }, [labId]);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    border: isDark ? '#374151' : '#e5e7eb',
    text: isDark ? '#e5e7eb' : '#1f2937',
    textMuted: isDark ? '#9ca3af' : '#6b7280',
    stdout: isDark ? '#e5e7eb' : '#1f2937',
    stderr: isDark ? '#fca5a5' : '#dc2626',
    plotBg: isDark ? '#1f2937' : '#ffffff',
    buttonBg: isDark ? '#374151' : '#f3f4f6',
    buttonActiveBg: isDark ? '#4f46e5' : '#4f46e5',
    interpretBg: isDark ? '#1e3a5f' : '#eff6ff',
    interpretBorder: isDark ? '#1e40af' : '#bfdbfe',
  };

  const getTextOutput = () => {
    return outputs
      .filter(o => o.type === 'stdout' || o.type === 'stderr')
      .map(o => o.content)
      .join('\n');
  };

  const handleInterpret = async (action: ActionType) => {
    const textOutput = getTextOutput();
    const hasPlots = outputs.some(o => o.type === 'plot');
    const hasText = !!textOutput.trim();

    // Need at least text output or code context to work with
    if (!hasText && !code?.trim()) return;

    setSelectedAction(action);
    setIsInterpreting(true);
    setInterpretation(null);
    setShowInterpretPanel(true);

    const actionPrompt = ACTION_PROMPTS[action].prompt;

    const contextParts: string[] = [];
    if (templateTitle) contextParts.push(`Lab step: "${templateTitle}"`);
    if (code?.trim()) contextParts.push(`Code that was executed:\n\`\`\`r\n${code.trim()}\n\`\`\``);
    if (hasPlots && !hasText) contextParts.push(`Note: This code produced ${outputs.filter(o => o.type === 'plot').length} plot(s) but no text output.`);
    if (hasText) contextParts.push(`Text output:\n\`\`\`\n${textOutput}\n\`\`\``);

    const fullPrompt = `You are an expert helping a student understand their lab results.

${actionPrompt}

${contextParts.join('\n\n')}

Provide your response:`;

    try {
      const response = await apiClient.post('/ai/interpret', {
        prompt: fullPrompt,
        context: 'statistics_lab',
      });
      const result = response.data.data?.response || response.data.response || 'No interpretation available.';
      setInterpretation(result);
      // Save to localStorage for persistence
      saveInterpretation(result, action);
    } catch (error: any) {
      console.error('Interpretation error:', error);
      setInterpretation(`Error: ${error.response?.data?.message || error.message || 'Failed to get interpretation. Please try again.'}`);
    } finally {
      setIsInterpreting(false);
    }
  };

  if (outputs.length === 0) {
    return (
      <div
        className="rounded-lg border p-6 text-center"
        style={{ backgroundColor: colors.bg, borderColor: colors.border }}
      >
        <Terminal className="w-8 h-8 mx-auto mb-2" style={{ color: colors.textMuted }} />
        <p className="text-sm" style={{ color: colors.textMuted }}>
          Output will appear here after running code
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: colors.border }}
      >
        {/* Output Header */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b"
          style={{
            backgroundColor: colors.bg,
            borderColor: colors.border,
          }}
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" style={{ color: colors.textMuted }} />
            <span className="text-sm font-medium" style={{ color: colors.text }}>
              Output
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            icon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Clear
          </Button>
        </div>

        {/* Output Content */}
        <div className="p-4 space-y-4" style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff' }}>
          {outputs.map((output, index) => (
            <div key={index}>
              {output.type === 'plot' ? (
                <div
                  className="rounded-lg overflow-hidden border p-2"
                  style={{ backgroundColor: colors.plotBg, borderColor: colors.border }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Image className="w-4 h-4" style={{ color: colors.textMuted }} />
                    <span className="text-xs" style={{ color: colors.textMuted }}>
                      Plot Output
                    </span>
                  </div>
                  <img
                    src={`data:image/png;base64,${output.content}`}
                    alt="R Plot"
                    className="max-w-full h-auto rounded"
                    style={{ maxHeight: '500px', objectFit: 'contain' }}
                  />
                </div>
              ) : output.type === 'stderr' ? (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: colors.stderr }} />
                  <pre
                    className="font-mono text-sm whitespace-pre-wrap break-words flex-1"
                    style={{ color: colors.stderr }}
                  >
                    {output.content}
                  </pre>
                </div>
              ) : (
                <pre
                  className="font-mono text-sm whitespace-pre-wrap break-words"
                  style={{ color: colors.stdout }}
                >
                  {output.content}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Interpretation Section — shown for any output (text or plot) */}
      {outputs.length > 0 && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: colors.border }}
        >
          {/* Interpretation Header */}
          <div
            className="flex items-center justify-between px-4 py-2 border-b"
            style={{
              backgroundColor: colors.bg,
              borderColor: colors.border,
            }}
          >
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              <span className="text-sm font-medium" style={{ color: colors.text }}>
                AI Interpretation
              </span>
            </div>
          </div>

          <div className="p-4 space-y-4" style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff' }}>
            {/* Action Buttons */}
            <div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ACTION_PROMPTS) as ActionType[]).map((action) => {
                  const ActionIcon = ACTION_PROMPTS[action].icon;
                  return (
                    <Button
                      key={action}
                      variant="secondary"
                      size="sm"
                      onClick={() => handleInterpret(action)}
                      disabled={isInterpreting}
                      icon={
                        isInterpreting && selectedAction === action ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ActionIcon className="w-3.5 h-3.5" />
                        )
                      }
                    >
                      {ACTION_PROMPTS[action].label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Interpretation Result */}
            {showInterpretPanel && (
              <div
                className="rounded-lg border p-4 relative"
                style={{
                  backgroundColor: colors.interpretBg,
                  borderColor: colors.interpretBorder,
                }}
              >
                <button
                  onClick={() => {
                    setShowInterpretPanel(false);
                    setInterpretation(null);
                    clearStoredInterpretation();
                  }}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-black/10"
                  title="Close and clear saved interpretation"
                >
                  <X className="w-4 h-4" style={{ color: colors.textMuted }} />
                </button>

                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4" style={{ color: '#3b82f6' }} />
                  <span className="text-sm font-medium" style={{ color: colors.text }}>
                    {selectedAction && ACTION_PROMPTS[selectedAction]?.label}
                  </span>
                </div>

                {isInterpreting ? (
                  <div className="flex items-center gap-2" style={{ color: colors.textMuted }}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing output...</span>
                  </div>
                ) : interpretation ? (
                  <div
                    className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}
                    style={{ color: colors.text }}
                  >
                    <ReactMarkdown
                      components={{
                        // Style headers
                        h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2" style={{ color: colors.text }}>{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2" style={{ color: colors.text }}>{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1" style={{ color: colors.text }}>{children}</h3>,
                        // Style paragraphs
                        p: ({ children }) => <p className="mb-2 text-sm leading-relaxed" style={{ color: colors.text }}>{children}</p>,
                        // Style lists
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 text-sm" style={{ color: colors.text }}>{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 text-sm" style={{ color: colors.text }}>{children}</ol>,
                        li: ({ children }) => <li className="mb-1" style={{ color: colors.text }}>{children}</li>,
                        // Style code
                        code: ({ className, children }) => {
                          const isInline = !className;
                          if (isInline) {
                            return (
                              <code
                                className="px-1 py-0.5 rounded text-xs font-mono"
                                style={{
                                  backgroundColor: isDark ? '#374151' : '#f3f4f6',
                                  color: isDark ? '#f3f4f6' : '#1f2937',
                                }}
                              >
                                {children}
                              </code>
                            );
                          }
                          return <code className={className}>{children}</code>;
                        },
                        pre: ({ children }) => (
                          <pre
                            className="p-3 rounded-lg text-xs overflow-x-auto mb-2"
                            style={{
                              backgroundColor: isDark ? '#0f172a' : '#f3f4f6',
                              color: isDark ? '#e5e7eb' : '#1f2937',
                            }}
                          >
                            {children}
                          </pre>
                        ),
                        // Style bold and italic
                        strong: ({ children }) => <strong className="font-semibold" style={{ color: colors.text }}>{children}</strong>,
                        em: ({ children }) => <em className="italic" style={{ color: colors.text }}>{children}</em>,
                        // Style blockquotes
                        blockquote: ({ children }) => (
                          <blockquote
                            className="border-l-4 pl-3 my-2 italic"
                            style={{
                              borderColor: isDark ? '#4b5563' : '#d1d5db',
                              color: colors.textMuted,
                            }}
                          >
                            {children}
                          </blockquote>
                        ),
                        // Style horizontal rules
                        hr: () => <hr className="my-3" style={{ borderColor: colors.border }} />,
                      }}
                    >
                      {interpretation}
                    </ReactMarkdown>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
