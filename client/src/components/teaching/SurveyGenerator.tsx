import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { surveysApi } from '../../api/surveys';
import { Survey, SurveyGenerationType } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface SurveyGeneratorProps {
  courseId?: number;
  isOpen: boolean;
  onClose: () => void;
  onSurveyGenerated: (survey: Survey) => void;
}

const SURVEY_TYPES: { value: SurveyGenerationType; labelKey: string }[] = [
  { value: 'general_feedback', labelKey: 'survey_type_general_feedback' },
  { value: 'course_evaluation', labelKey: 'survey_type_course_evaluation' },
  { value: 'likert_scale', labelKey: 'survey_type_likert_scale' },
  { value: 'learning_strategies', labelKey: 'survey_type_learning_strategies' },
  { value: 'custom', labelKey: 'survey_type_custom' },
];

export const SurveyGenerator = ({
  courseId,
  isOpen,
  onClose,
  onSurveyGenerated,
}: SurveyGeneratorProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const { isDark } = useTheme();

  // Form state
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [surveyType, setSurveyType] = useState<SurveyGenerationType>('general_feedback');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [showAdditional, setShowAdditional] = useState(false);

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgInput: isDark ? '#374151' : '#ffffff',
  };

  const generateMutation = useMutation({
    mutationFn: () =>
      surveysApi.generateSurvey({
        topic,
        questionCount,
        surveyType,
        courseId,
        isAnonymous,
        additionalInstructions: additionalInstructions || undefined,
      }),
    onSuccess: (survey) => {
      toast.success(
        t('survey_generated_success', { count: survey._count?.questions || survey.questions?.length || 0 })
      );
      onSurveyGenerated(survey);
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('survey_generation_failed'));
    },
  });

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast.error(t('topic_required'));
      return;
    }
    generateMutation.mutate();
  };

  const handleClose = () => {
    setTopic('');
    setQuestionCount(5);
    setSurveyType('general_feedback');
    setIsAnonymous(false);
    setAdditionalInstructions('');
    setShowAdditional(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('generate_survey_title')}
      size="md"
    >
      <div className="space-y-4">
        {/* Topic */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
            {t('survey_topic_label')} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('survey_topic_placeholder')}
            rows={2}
            className="w-full px-3 py-2 rounded-lg"
            style={{
              backgroundColor: colors.bgInput,
              borderColor: colors.border,
              borderWidth: 1,
              color: colors.textPrimary,
            }}
          />
        </div>

        {/* Survey Type */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
            {t('survey_type_label')}
          </label>
          <select
            value={surveyType}
            onChange={(e) => setSurveyType(e.target.value as SurveyGenerationType)}
            className="w-full px-3 py-2 rounded-lg"
            style={{
              backgroundColor: colors.bgInput,
              borderColor: colors.border,
              borderWidth: 1,
              color: colors.textPrimary,
            }}
          >
            {SURVEY_TYPES.map(({ value, labelKey }) => (
              <option key={value} value={value}>
                {t(labelKey)}
              </option>
            ))}
          </select>
        </div>

        {/* Question Count */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
            {t('question_count_label')}
          </label>
          <input
            type="range"
            min={1}
            max={15}
            value={questionCount}
            onChange={(e) => setQuestionCount(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="text-center text-sm" style={{ color: colors.textSecondary }}>
            {questionCount}
          </div>
        </div>

        {/* Anonymous */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm" style={{ color: colors.textPrimary }}>
            {t('anonymous_responses_desc')}
          </span>
        </label>

        {/* Additional Instructions (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdditional(!showAdditional)}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: colors.textSecondary }}
          >
            {showAdditional ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {t('additional_instructions_label')} ({t('common:optional')})
          </button>
          {showAdditional && (
            <textarea
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              placeholder={t('additional_instructions_placeholder')}
              rows={3}
              maxLength={1000}
              className="w-full px-3 py-2 rounded-lg mt-2"
              style={{
                backgroundColor: colors.bgInput,
                borderColor: colors.border,
                borderWidth: 1,
                color: colors.textPrimary,
              }}
            />
          )}
        </div>

        {/* Generate Button */}
        <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: colors.border }}>
          <Button variant="ghost" onClick={handleClose}>
            {t('common:cancel')}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !topic.trim()}
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('generating_survey')}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {t('generate_survey_button')}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
