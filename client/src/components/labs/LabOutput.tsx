import { useState } from 'react';
import { Terminal, Image, AlertCircle, Trash2, Brain, Loader2, FileText, Lightbulb, PenTool, List, AlertTriangle, ArrowRight, X } from 'lucide-react';
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
}

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
  write: {
    label: 'Write Report',
    icon: PenTool,
    prompt: `Write publication-ready text with clearly labeled **Methods** and **Results** sections. In **Methods**: describe the statistical approach used, cite R (R Core Team, 2024) and relevant packages. In **Results**: write polished paragraphs (not bullet points) in past tense. Report all statistics in APA format: M = X.XX, SD = X.XX, t(df) = X.XX, p = .XXX, d = X.XX. For correlations: r(df) = .XX, p = .XXX. For ANOVA: F(df1, df2) = X.XX, p = .XXX, eta-sq = .XX. End with a **References** section citing R and packages used.`,
  },
  summarize: {
    label: 'Summarize',
    icon: List,
    prompt: `Provide a brief summary (2-4 sentences) of the key findings. Focus on the most important takeaways. Mention effect sizes and practical significance, not just p-values.`,
  },
  critique: {
    label: 'Critique',
    icon: AlertTriangle,
    prompt: `Provide a critical evaluation including: 1. Potential limitations of the analysis. 2. Assumptions that may be violated. 3. Alternative approaches that could be considered. 4. What the results do NOT tell us.`,
  },
  suggest: {
    label: 'Suggest Next',
    icon: ArrowRight,
    prompt: `Based on these results, suggest appropriate follow-up analyses. Consider: additional variables to examine, alternative statistical approaches, replication needs, or theoretical implications.`,
  },
};

const STYLE_PROMPTS = {
  scientific: {
    label: 'Scientific',
    description: 'APA style with effect sizes and confidence intervals',
    prompt: 'Use APA style. Be precise about effect sizes, confidence intervals, and statistical significance. Mention practical significance, not just statistical significance.',
  },
  simple: {
    label: 'Simple',
    description: 'Plain language for anyone',
    prompt: 'Use plain language that anyone can understand. Avoid jargon. Use analogies if helpful. Focus on what the results MEAN, not the numbers.',
  },
  detailed: {
    label: 'Detailed',
    description: 'Comprehensive with all details',
    prompt: 'Be comprehensive. Include: what the test does, key assumptions, interpretation of all statistics, effect sizes, limitations, and caveats.',
  },
  brief: {
    label: 'Brief',
    description: '2-3 sentences max',
    prompt: 'Be concise. Just the key takeaway in 2-3 sentences maximum.',
  },
};

type ActionType = keyof typeof ACTION_PROMPTS;
type StyleType = keyof typeof STYLE_PROMPTS;

export const LabOutput = ({ outputs, onClear }: LabOutputProps) => {
  const { isDark } = useTheme();
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StyleType>('scientific');
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [showInterpretPanel, setShowInterpretPanel] = useState(false);

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
    if (!textOutput.trim()) return;

    setSelectedAction(action);
    setIsInterpreting(true);
    setInterpretation(null);
    setShowInterpretPanel(true);

    const actionPrompt = ACTION_PROMPTS[action].prompt;
    const stylePrompt = STYLE_PROMPTS[selectedStyle].prompt;

    const fullPrompt = `You are a statistics expert helping interpret R output. ${stylePrompt}

${actionPrompt}

Here is the R output to analyze:

\`\`\`
${textOutput}
\`\`\`

Provide your response:`;

    try {
      const response = await apiClient.post('/ai/interpret', {
        prompt: fullPrompt,
        context: 'statistics_lab',
      });
      setInterpretation(response.data.data?.response || response.data.response || 'No interpretation available.');
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

      {/* AI Interpretation Section */}
      {outputs.some(o => o.type === 'stdout') && (
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
            {/* Style Selection */}
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: colors.textMuted }}>
                Output Style
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STYLE_PROMPTS) as StyleType[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => setSelectedStyle(style)}
                    className="px-3 py-1.5 text-xs rounded-full transition-colors"
                    style={{
                      backgroundColor: selectedStyle === style ? colors.buttonActiveBg : colors.buttonBg,
                      color: selectedStyle === style ? '#ffffff' : colors.text,
                    }}
                    title={STYLE_PROMPTS[style].description}
                  >
                    {STYLE_PROMPTS[style].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: colors.textMuted }}>
                Analysis Action
              </label>
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
                  }}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-black/10"
                >
                  <X className="w-4 h-4" style={{ color: colors.textMuted }} />
                </button>

                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4" style={{ color: '#3b82f6' }} />
                  <span className="text-sm font-medium" style={{ color: colors.text }}>
                    {selectedAction && ACTION_PROMPTS[selectedAction].label} ({STYLE_PROMPTS[selectedStyle].label})
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
