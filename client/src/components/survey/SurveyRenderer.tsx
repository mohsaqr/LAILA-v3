import { useState } from 'react';
import { Survey, SurveyContext, SubmitSurveyAnswerData } from '../../types';
import { surveysApi } from '../../api/surveys';
import { SurveyQuestion } from './SurveyQuestion';
import { Button } from '../common/Button';
import { useTheme } from '../../hooks/useTheme';
import { activityLogger } from '../../services/activityLogger';

interface SurveyRendererProps {
  survey: Survey;
  context?: SurveyContext;
  contextId?: number;
  moduleId?: number;
  courseId?: number;
  onComplete?: () => void;
  compact?: boolean;
}

export const SurveyRenderer = ({
  survey,
  context = 'standalone',
  contextId,
  moduleId,
  courseId,
  onComplete,
  compact = false,
}: SurveyRendererProps) => {
  const { isDark } = useTheme();
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleAnswerChange = (questionId: number, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    // Clear error when user starts answering
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const validateAnswers = (): boolean => {
    const newErrors: Record<number, string> = {};

    survey.questions?.forEach(question => {
      if (question.isRequired) {
        const answer = answers[question.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          newErrors[question.id] = 'This question is required';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateAnswers()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formattedAnswers: SubmitSurveyAnswerData[] = Object.entries(answers)
        .filter(([_, value]) => value && (typeof value === 'string' ? value.trim() : value.length > 0))
        .map(([questionId, answerValue]) => ({
          questionId: parseInt(questionId),
          answerValue,
        }));

      await surveysApi.submitResponse(survey.id, {
        context,
        contextId,
        moduleId,
        answers: formattedAnswers,
      });

      activityLogger.logSurveySubmitted(survey.id, survey.title, courseId, { context, contextId, questionCount: survey.questions?.length });
      onComplete?.();
    } catch (error: any) {
      setSubmitError(error.response?.data?.message || 'Failed to submit survey');
    } finally {
      setSubmitting(false);
    }
  };

  const questions = survey.questions || [];

  return (
    <div>
      {compact && survey.description && (
        <p
          className="text-sm mb-4"
          style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
        >
          {survey.description}
        </p>
      )}

      <div className={compact ? '' : 'space-y-6'}>
        {questions.map((question, index) => (
          <SurveyQuestion
            key={question.id}
            question={question}
            value={answers[question.id] || (question.questionType === 'multiple_choice' ? [] : '')}
            onChange={value => handleAnswerChange(question.id, value)}
            error={errors[question.id]}
            questionNumber={index + 1}
          />
        ))}
      </div>

      {submitError && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          {submitError}
        </div>
      )}

      <div className={`mt-6 ${compact ? '' : ''}`}>
        <Button
          onClick={handleSubmit}
          loading={submitting}
          disabled={submitting}
          className={compact ? 'w-full' : ''}
        >
          Submit Survey
        </Button>
      </div>
    </div>
  );
};
