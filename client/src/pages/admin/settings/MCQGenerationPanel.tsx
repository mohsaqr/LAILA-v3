import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Save,
  RotateCcw,
  Loader2,
  PlayCircle,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../../api/client';
import { ApiResponse } from '../../../types';
import { useTheme } from '../../../hooks/useTheme';
import { Card, CardBody } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';

interface MCQGenerationSettings {
  systemPrompt: string;
  formatInstructions: string;
  defaults: {
    optionCount: number;
    maxQuestions: number;
    defaultDifficulty: string;
    includeExplanations: boolean;
    temperature: number;
  };
}

interface GeneratedQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  difficulty: string;
}

// API functions
const getMCQSettings = async (): Promise<MCQGenerationSettings> => {
  const response = await apiClient.get<ApiResponse<MCQGenerationSettings>>('/settings/mcq-generation');
  return response.data.data!;
};

const updateMCQSettings = async (settings: Partial<MCQGenerationSettings>): Promise<MCQGenerationSettings> => {
  const response = await apiClient.put<ApiResponse<MCQGenerationSettings>>('/settings/mcq-generation', settings);
  return response.data.data!;
};

const testMCQGeneration = async (topic: string): Promise<{ questions: GeneratedQuestion[] }> => {
  const response = await apiClient.post<ApiResponse<{ questions: GeneratedQuestion[] }>>('/settings/mcq-generation/test', { topic });
  return response.data.data!;
};

// Default values for reset
const DEFAULT_SYSTEM_PROMPT = `You are an expert educational assessment designer. Generate high-quality multiple choice questions (MCQs).

GUIDELINES:
1. Test comprehension and application, not just recall
2. All distractors should be plausible but clearly wrong
3. Avoid "all/none of the above" options
4. Keep questions clear and unambiguous
5. Ensure only one option is definitively correct
6. Match the difficulty level requested
7. For 'easy' questions: test basic understanding and recall
8. For 'medium' questions: test application and comprehension
9. For 'hard' questions: test analysis, synthesis, and evaluation`;

const DEFAULT_FORMAT_INSTRUCTIONS = `OUTPUT FORMAT (JSON):
{
  "questions": [{
    "questionText": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Brief explanation of why this is correct",
    "difficulty": "medium"
  }]
}

IMPORTANT RULES:
- correctAnswer must EXACTLY match one of the options strings
- Each question must have the specified number of options
- All options must be unique and plausible
- Return ONLY valid JSON, no markdown formatting`;

const DEFAULT_SETTINGS = {
  optionCount: 4,
  maxQuestions: 10,
  defaultDifficulty: 'medium',
  includeExplanations: true,
  temperature: 0.4,
};

export const MCQGenerationPanel = () => {
  const { t } = useTranslation(['admin', 'common']);
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  const [testTopic, setTestTopic] = useState('Machine Learning basics');
  const [testResults, setTestResults] = useState<GeneratedQuestion[] | null>(null);

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgSecondary: isDark ? '#374151' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgInput: isDark ? '#374151' : '#ffffff',
  };

  // Fetch settings
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['mcq-generation-settings'],
    queryFn: getMCQSettings,
  });

  // Form state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [formatInstructions, setFormatInstructions] = useState('');
  const [optionCount, setOptionCount] = useState(4);
  const [maxQuestions, setMaxQuestions] = useState(10);
  const [defaultDifficulty, setDefaultDifficulty] = useState('medium');
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [temperature, setTemperature] = useState(0.4);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form when settings load
  useState(() => {
    if (settings) {
      setSystemPrompt(settings.systemPrompt);
      setFormatInstructions(settings.formatInstructions);
      setOptionCount(settings.defaults.optionCount);
      setMaxQuestions(settings.defaults.maxQuestions);
      setDefaultDifficulty(settings.defaults.defaultDifficulty);
      setIncludeExplanations(settings.defaults.includeExplanations);
      setTemperature(settings.defaults.temperature);
    }
  });

  // Update form when settings change
  if (settings && !hasChanges && systemPrompt !== settings.systemPrompt) {
    setSystemPrompt(settings.systemPrompt);
    setFormatInstructions(settings.formatInstructions);
    setOptionCount(settings.defaults.optionCount);
    setMaxQuestions(settings.defaults.maxQuestions);
    setDefaultDifficulty(settings.defaults.defaultDifficulty);
    setIncludeExplanations(settings.defaults.includeExplanations);
    setTemperature(settings.defaults.temperature);
  }

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: updateMCQSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcq-generation-settings'] });
      toast.success(t('mcq_settings_saved'));
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_save_settings'));
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: () => testMCQGeneration(testTopic),
    onSuccess: (data) => {
      setTestResults(data.questions);
      toast.success(t('test_generation_success'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('test_generation_failed'));
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      systemPrompt,
      formatInstructions,
      defaults: {
        optionCount,
        maxQuestions,
        defaultDifficulty,
        includeExplanations,
        temperature,
      },
    });
  };

  const handleResetDefaults = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setFormatInstructions(DEFAULT_FORMAT_INSTRUCTIONS);
    setOptionCount(DEFAULT_SETTINGS.optionCount);
    setMaxQuestions(DEFAULT_SETTINGS.maxQuestions);
    setDefaultDifficulty(DEFAULT_SETTINGS.defaultDifficulty);
    setIncludeExplanations(DEFAULT_SETTINGS.includeExplanations);
    setTemperature(DEFAULT_SETTINGS.temperature);
    setHasChanges(true);
  };

  const handleFieldChange = () => {
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.textSecondary }} />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p style={{ color: colors.textPrimary }}>{t('failed_load_settings')}</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: isDark ? '#4f46e5' : '#eef2ff' }}
          >
            <Sparkles className="w-5 h-5" style={{ color: isDark ? '#a5b4fc' : '#4f46e5' }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {t('mcq_generation_settings')}
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              {t('mcq_settings_description')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleResetDefaults}>
            <RotateCcw size={16} />
            {t('reset_defaults')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {t('common:save')}
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div
        className="flex items-start gap-3 p-4 rounded-lg"
        style={{ backgroundColor: colors.bgSecondary }}
      >
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: colors.textSecondary }} />
        <p className="text-sm" style={{ color: colors.textSecondary }}>
          {t('mcq_settings_info')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Prompts */}
        <div className="space-y-6">
          {/* System Prompt */}
          <Card>
            <CardBody>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                {t('system_prompt_label')}
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => {
                  setSystemPrompt(e.target.value);
                  handleFieldChange();
                }}
                rows={12}
                className="w-full px-3 py-2 rounded-lg font-mono text-sm"
                style={{
                  backgroundColor: colors.bgInput,
                  borderColor: colors.border,
                  borderWidth: 1,
                  color: colors.textPrimary,
                }}
              />
              <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                {t('system_prompt_help')}
              </p>
            </CardBody>
          </Card>

          {/* Format Instructions */}
          <Card>
            <CardBody>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                {t('format_instructions_label')}
              </label>
              <textarea
                value={formatInstructions}
                onChange={(e) => {
                  setFormatInstructions(e.target.value);
                  handleFieldChange();
                }}
                rows={10}
                className="w-full px-3 py-2 rounded-lg font-mono text-sm"
                style={{
                  backgroundColor: colors.bgInput,
                  borderColor: colors.border,
                  borderWidth: 1,
                  color: colors.textPrimary,
                }}
              />
              <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                {t('format_instructions_help')}
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Right Column - Defaults & Test */}
        <div className="space-y-6">
          {/* Default Settings */}
          <Card>
            <CardBody>
              <h3 className="text-sm font-medium mb-4" style={{ color: colors.textPrimary }}>
                {t('default_settings')}
              </h3>
              <div className="space-y-4">
                {/* Option Count */}
                <div>
                  <label className="block text-sm mb-1" style={{ color: colors.textSecondary }}>
                    {t('default_option_count')}
                  </label>
                  <select
                    value={optionCount}
                    onChange={(e) => {
                      setOptionCount(parseInt(e.target.value));
                      handleFieldChange();
                    }}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: colors.bgInput,
                      borderColor: colors.border,
                      borderWidth: 1,
                      color: colors.textPrimary,
                    }}
                  >
                    <option value={3}>3 options</option>
                    <option value={4}>4 options</option>
                    <option value={5}>5 options</option>
                  </select>
                </div>

                {/* Max Questions */}
                <div>
                  <label className="block text-sm mb-1" style={{ color: colors.textSecondary }}>
                    {t('max_questions_per_request')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={maxQuestions}
                    onChange={(e) => {
                      setMaxQuestions(parseInt(e.target.value) || 10);
                      handleFieldChange();
                    }}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: colors.bgInput,
                      borderColor: colors.border,
                      borderWidth: 1,
                      color: colors.textPrimary,
                    }}
                  />
                </div>

                {/* Default Difficulty */}
                <div>
                  <label className="block text-sm mb-1" style={{ color: colors.textSecondary }}>
                    {t('default_difficulty')}
                  </label>
                  <select
                    value={defaultDifficulty}
                    onChange={(e) => {
                      setDefaultDifficulty(e.target.value);
                      handleFieldChange();
                    }}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: colors.bgInput,
                      borderColor: colors.border,
                      borderWidth: 1,
                      color: colors.textPrimary,
                    }}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-sm mb-1" style={{ color: colors.textSecondary }}>
                    {t('temperature')} ({temperature})
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => {
                      setTemperature(parseFloat(e.target.value));
                      handleFieldChange();
                    }}
                    className="w-full"
                  />
                  <p className="text-xs" style={{ color: colors.textSecondary }}>
                    {t('temperature_help')}
                  </p>
                </div>

                {/* Include Explanations */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeExplanations}
                    onChange={(e) => {
                      setIncludeExplanations(e.target.checked);
                      handleFieldChange();
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm" style={{ color: colors.textPrimary }}>
                    {t('include_explanations_default')}
                  </span>
                </label>
              </div>
            </CardBody>
          </Card>

          {/* Test Generation */}
          <Card>
            <CardBody>
              <h3 className="text-sm font-medium mb-4" style={{ color: colors.textPrimary }}>
                {t('test_generation')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: colors.textSecondary }}>
                    {t('test_topic')}
                  </label>
                  <input
                    type="text"
                    value={testTopic}
                    onChange={(e) => setTestTopic(e.target.value)}
                    placeholder={t('test_topic_placeholder')}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: colors.bgInput,
                      borderColor: colors.border,
                      borderWidth: 1,
                      color: colors.textPrimary,
                    }}
                  />
                </div>
                <Button
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending || !testTopic.trim()}
                  className="w-full"
                >
                  {testMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('generating')}
                    </>
                  ) : (
                    <>
                      <PlayCircle size={16} />
                      {t('test_generation_button')}
                    </>
                  )}
                </Button>

                {/* Test Results */}
                {testResults && testResults.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                      {t('test_results')} ({testResults.length} questions)
                    </h4>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {testResults.map((q, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg text-sm"
                          style={{
                            backgroundColor: colors.bgSecondary,
                            borderColor: colors.border,
                            borderWidth: 1,
                          }}
                        >
                          <p className="font-medium mb-2" style={{ color: colors.textPrimary }}>
                            {idx + 1}. {q.questionText}
                          </p>
                          <div className="space-y-1">
                            {q.options.map((opt, optIdx) => (
                              <div
                                key={optIdx}
                                className="flex items-center gap-2 text-xs"
                                style={{ color: colors.textSecondary }}
                              >
                                {opt === q.correctAnswer ? (
                                  <CheckCircle size={12} className="text-green-500" />
                                ) : (
                                  <span className="w-3" />
                                )}
                                <span className={opt === q.correctAnswer ? 'font-medium text-green-600' : ''}>
                                  {opt}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
