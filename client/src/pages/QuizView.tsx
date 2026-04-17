import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Timer,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { quizzesApi, StartAttemptResponse } from '../api/quizzes';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { buildQuizBreadcrumb } from '../utils/breadcrumbs';
import { sanitizeHtml } from '../utils/sanitize';
import { activityLogger } from '../services/activityLogger';
import { useTracker } from '../services/tracker';
import { TrackedContent } from '../components/common/TrackedContent';

export const QuizView = () => {
  const { courseId, quizId } = useParams<{ courseId: string; quizId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const parsedQuizId = parseInt(quizId!, 10);
  const { isDark } = useTheme();
  const { t } = useTranslation(['courses', 'common']);
  const track = useTracker('quiz');

  const [attemptData, setAttemptData] = useState<StartAttemptResponse | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Use cached course data (already fetched by RequireEnrollment wrapper)
  const course = queryClient.getQueryData<any>(['course', courseId]);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgSelected: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    borderSelected: isDark ? '#3b82f6' : '#3b82f6',
    bgHover: isDark ? '#374151' : '#f3f4f6',
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    textGreen: isDark ? '#86efac' : '#15803d',
    bgRed: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
    textRed: isDark ? '#fca5a5' : '#dc2626',
  };

  // Start or resume attempt (POST but idempotent — returns existing in-progress attempt)
  const { data: startData, isLoading: attemptLoading, error: attemptError } = useQuery({
    queryKey: ['quizAttempt', parsedQuizId],
    queryFn: () => quizzesApi.startAttempt(parsedQuizId),
    staleTime: Infinity,
    retry: false,
  });

  // Save answer
  const saveAnswerMutation = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: number; answer: string }) =>
      quizzesApi.saveAnswer(attemptData!.attempt.id, questionId, answer),
  });

  // Submit attempt
  const submitAttemptMutation = useMutation({
    mutationFn: () => quizzesApi.submitAttempt(attemptData!.attempt.id),
    onSuccess: (result) => {
      queryClient.removeQueries({ queryKey: ['quizAttempt', parsedQuizId] });
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      activityLogger.logQuizSubmitted(parsedQuizId, attemptData?.quiz?.title, parseInt(courseId!), result.pointsEarned, result.pointsTotal);
      toast.success(t('quiz_submitted_score', { score: result.score?.toFixed(1) }));
      navigate(`/courses/${courseId}/quizzes/${quizId}/results/${result.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_submit_quiz'));
      setIsSubmitting(false);
    },
  });

  // Populate state when attempt data arrives
  useEffect(() => {
    if (startData && !attemptData) {
      setAttemptData(startData);
      activityLogger.logQuizStarted(parsedQuizId, startData.quiz.title, parseInt(courseId!));
      const savedAnswers: Record<number, string> = {};
      startData.questions.forEach(q => {
        if (q.savedAnswer) {
          savedAnswers[q.id] = q.savedAnswer;
        }
      });
      setAnswers(savedAnswers);

      if (startData.quiz.timeLimit) {
        const elapsed = (Date.now() - new Date(startData.attempt.startedAt).getTime()) / 1000 / 60;
        const remaining = Math.max(0, startData.quiz.timeLimit - elapsed);
        setTimeRemaining(Math.floor(remaining * 60));
      }
    }
  }, [startData]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          // Auto-submit when time runs out
          setIsSubmitting(true);
          submitAttemptMutation.mutate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const handleAnswerChange = useCallback((questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    // Auto-save answer
    saveAnswerMutation.mutate({ questionId, answer });
    const question = attemptData?.questions.find(q => q.id === questionId);
    track('answer_changed', { verb: 'interacted', objectType: 'quiz', objectId: parsedQuizId, courseId: parseInt(courseId!, 10), payload: { questionId, questionType: question?.questionType } });
  }, [saveAnswerMutation, attemptData, track, parsedQuizId, courseId]);

  const handleSubmitClick = () => {
    if (isSubmitting) return;
    track('submit_clicked', { verb: 'interacted', objectType: 'quiz', objectId: parsedQuizId, courseId: parseInt(courseId!, 10) });
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = () => {
    track('submit_confirmed', { verb: 'submitted', objectType: 'quiz', objectId: parsedQuizId, courseId: parseInt(courseId!, 10) });
    setShowSubmitModal(false);
    setIsSubmitting(true);
    submitAttemptMutation.mutate();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (attemptLoading) {
    return <Loading text={t('loading_quiz')} />;
  }

  if (attemptError || !attemptData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <Card>
          <CardBody>
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p style={{ color: colors.textPrimary }}>{t('failed_load_quiz')}</p>
            <Button onClick={() => navigate(-1)} className="mt-4">{t('go_back')}</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const currentQuestion = attemptData.questions[currentQuestionIndex];
  const progress = Object.keys(answers).length / attemptData.questions.length * 100;
  const breadcrumbItems = buildQuizBreadcrumb(courseId!, course?.title || 'Course', attemptData.quiz.title);

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb navigation */}
        <div className="mb-6">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        {/* Header with timer and progress */}
        <div
          className="sticky top-0 z-10 rounded-lg p-4 mb-6 shadow-sm"
          style={{ backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                {attemptData.quiz.title}
              </h1>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                {t('question_of_total', { current: currentQuestionIndex + 1, total: attemptData.questions.length })}
              </p>
            </div>

            {attemptData.quiz.instructions && (
              <TrackedContent context="quiz" courseId={parseInt(courseId!, 10)} objectId={parsedQuizId} objectTitle={attemptData.quiz.title}>
                <div
                  className="text-sm max-w-xl line-clamp-2"
                  style={{ color: colors.textSecondary }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(attemptData.quiz.instructions) }}
                />
              </TrackedContent>
            )}

            {timeRemaining !== null && (
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  timeRemaining < 60 ? 'animate-pulse' : ''
                }`}
                style={{
                  backgroundColor: timeRemaining < 60 ? colors.bgRed : colors.bgGreen,
                  color: timeRemaining < 60 ? colors.textRed : colors.textGreen,
                }}
              >
                <Timer size={20} />
                <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 rounded-full" style={{ backgroundColor: colors.border }}>
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <Card className="mb-6">
          <CardBody>
            <div className="mb-6">
              <div className="flex items-start gap-3 mb-4">
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white bg-blue-500 font-semibold"
                >
                  {currentQuestionIndex + 1}
                </span>
                <div>
                  <p className="text-lg font-medium" style={{ color: colors.textPrimary }}>
                    {currentQuestion.questionText}
                  </p>
                  <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                    {currentQuestion.points === 1
                      ? t('n_points_single', { count: currentQuestion.points })
                      : t('n_points_plural', { count: currentQuestion.points })}
                  </p>
                </div>
              </div>

              {/* Answer options */}
              <div className="space-y-3 mt-6">
                {currentQuestion.questionType === 'multiple_choice' && currentQuestion.options?.map((option, idx) => (
                  <label
                    key={idx}
                    className="flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-all"
                    style={{
                      backgroundColor: answers[currentQuestion.id] === option ? colors.bgSelected : 'transparent',
                      borderWidth: 2,
                      borderColor: answers[currentQuestion.id] === option ? colors.borderSelected : colors.border,
                    }}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={option}
                      checked={answers[currentQuestion.id] === option}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      className="w-4 h-4 text-blue-500"
                    />
                    <span style={{ color: colors.textPrimary }}>{option}</span>
                  </label>
                ))}

                {currentQuestion.questionType === 'true_false' && (
                  <>
                    {[{ value: 'true', label: t('true') }, { value: 'false', label: t('false') }].map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-all"
                        style={{
                          backgroundColor: answers[currentQuestion.id] === option.value ? colors.bgSelected : 'transparent',
                          borderWidth: 2,
                          borderColor: answers[currentQuestion.id] === option.value ? colors.borderSelected : colors.border,
                        }}
                      >
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          value={option.value}
                          checked={answers[currentQuestion.id] === option.value}
                          onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                          className="w-4 h-4 text-blue-500"
                        />
                        <span style={{ color: colors.textPrimary }}>{option.label}</span>
                      </label>
                    ))}
                  </>
                )}

                {(currentQuestion.questionType === 'short_answer' || currentQuestion.questionType === 'fill_in_blank') && (
                  <input
                    type="text"
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder={t('type_your_answer')}
                    className="w-full p-4 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    style={{
                      backgroundColor: colors.bgCard,
                      borderWidth: 2,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    }}
                  />
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Navigation and question grid */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="secondary"
            onClick={() => { track('previous_question', { verb: 'interacted', objectType: 'quiz', objectId: parsedQuizId, courseId: parseInt(courseId!, 10), payload: { fromIndex: currentQuestionIndex, toIndex: currentQuestionIndex - 1 } }); setCurrentQuestionIndex(prev => Math.max(0, prev - 1)); }}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft size={20} />
            {t('previous')}
          </Button>

          <div className="flex flex-wrap gap-2 justify-center">
            {attemptData.questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => { track('question_jumped', { verb: 'interacted', objectType: 'quiz', objectId: parsedQuizId, courseId: parseInt(courseId!, 10), payload: { fromIndex: currentQuestionIndex, toIndex: idx } }); setCurrentQuestionIndex(idx); }}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                  idx === currentQuestionIndex ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                }`}
                style={{
                  backgroundColor: answers[q.id] ? colors.bgGreen : colors.border,
                  color: answers[q.id] ? colors.textGreen : colors.textSecondary,
                }}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            onClick={() => { track('next_question', { verb: 'interacted', objectType: 'quiz', objectId: parsedQuizId, courseId: parseInt(courseId!, 10), payload: { fromIndex: currentQuestionIndex, toIndex: currentQuestionIndex + 1 } }); setCurrentQuestionIndex(prev => Math.min(attemptData.questions.length - 1, prev + 1)); }}
            disabled={currentQuestionIndex === attemptData.questions.length - 1}
          >
            {t('next')}
            <ChevronRight size={20} />
          </Button>
        </div>

        {/* Submit button */}
        <div className="flex justify-center">
          <Button
            onClick={handleSubmitClick}
            disabled={isSubmitting}
            className="px-8 py-3"
          >
            {isSubmitting ? (
              <>{t('submitting')}</>
            ) : (
              <>
                <Send size={20} />
                {t('submit_quiz')}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title={t('confirm_submit')}
        size="sm"
      >
        <div className="p-4 space-y-4">
          {(() => {
            const totalQuestions = attemptData?.questions.length || 0;
            const answeredCount = Object.keys(answers).length;
            const unansweredCount = totalQuestions - answeredCount;
            return (
              <>
                <div className="flex items-start gap-3">
                  {unansweredCount > 0 ? (
                    <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium" style={{ color: colors.textPrimary }}>
                      {unansweredCount > 0
                        ? t('submit_with_unanswered', { count: unansweredCount })
                        : t('all_questions_answered')}
                    </p>
                    <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                      {t('answered_of_total', { answered: answeredCount, total: totalQuestions })}
                    </p>
                  </div>
                </div>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  {t('submit_warning')}
                </p>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="secondary" onClick={() => { track('submit_cancelled', { verb: 'interacted', objectType: 'quiz', objectId: parsedQuizId, courseId: parseInt(courseId!, 10) }); setShowSubmitModal(false); }}>
                    {t('common:cancel')}
                  </Button>
                  <Button onClick={handleConfirmSubmit}>
                    <Send size={16} />
                    {t('submit_quiz')}
                  </Button>
                </div>
              </>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
};
