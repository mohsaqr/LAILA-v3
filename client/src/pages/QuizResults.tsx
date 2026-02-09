import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Award,
  Clock,
} from 'lucide-react';
import { quizzesApi } from '../api/quizzes';
import { coursesApi } from '../api/courses';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { buildQuizBreadcrumb } from '../utils/breadcrumbs';

export const QuizResults = () => {
  const { courseId, attemptId } = useParams<{ courseId: string; quizId: string; attemptId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(['courses', 'common']);
  const parsedAttemptId = parseInt(attemptId!, 10);
  const { isDark } = useTheme();

  // Fetch course info for breadcrumbs
  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(parseInt(courseId!)),
    enabled: !!courseId,
  });

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    textGreen: isDark ? '#86efac' : '#15803d',
    borderGreen: isDark ? 'rgba(34, 197, 94, 0.5)' : '#86efac',
    bgRed: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
    textRed: isDark ? '#fca5a5' : '#dc2626',
    borderRed: isDark ? 'rgba(239, 68, 68, 0.5)' : '#fca5a5',
    bgYellow: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textYellow: isDark ? '#fcd34d' : '#d97706',
  };

  const { data: results, isLoading, error } = useQuery({
    queryKey: ['quizResults', attemptId],
    queryFn: () => quizzesApi.getAttemptResults(parsedAttemptId),
  });

  if (isLoading) {
    return <Loading text={t('loading_results')} />;
  }

  if (error || !results) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <Card>
          <CardBody className="text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p style={{ color: colors.textPrimary }}>{t('results_not_available')}</p>
            <Button onClick={() => navigate(`/courses/${courseId}`)} className="mt-4">
              {t('return_to_course')}
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const { attempt, quiz, results: questionResults } = results;
  const correctCount = questionResults.filter(r => r.isCorrect).length;
  const totalQuestions = questionResults.length;
  const breadcrumbItems = [
    ...buildQuizBreadcrumb(courseId!, course?.title || t('course'), quiz.title),
    { label: t('results') },
  ];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-4xl mx-auto px-4">
        {/* Breadcrumb navigation */}
        <div className="mb-6">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        {/* Summary Card */}
        <Card className="mb-8">
          <CardBody>
            <div className="text-center">
              <div
                className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 ${
                  attempt.passed ? 'bg-green-100' : 'bg-red-100'
                }`}
              >
                {attempt.passed ? (
                  <Award className="w-12 h-12 text-green-600" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-600" />
                )}
              </div>

              <h1 className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>
                {quiz.title}
              </h1>

              <p
                className="text-lg font-medium mb-4"
                style={{ color: attempt.passed ? colors.textGreen : colors.textRed }}
              >
                {attempt.passed ? t('congratulations_passed') : t('did_not_pass')}
              </p>

              {/* Score display */}
              <div className="text-5xl font-bold mb-2" style={{ color: colors.textPrimary }}>
                {attempt.score?.toFixed(1)}%
              </div>
              <p className="text-sm mb-6" style={{ color: colors.textSecondary }}>
                {t('passing_score', { score: quiz.passingScore })}
              </p>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: colors.bgGreen }}
                >
                  <CheckCircle className="w-6 h-6 mx-auto mb-2" style={{ color: colors.textGreen }} />
                  <div className="text-2xl font-bold" style={{ color: colors.textGreen }}>
                    {correctCount}
                  </div>
                  <div className="text-xs" style={{ color: colors.textGreen }}>{t('correct')}</div>
                </div>

                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: colors.bgRed }}
                >
                  <XCircle className="w-6 h-6 mx-auto mb-2" style={{ color: colors.textRed }} />
                  <div className="text-2xl font-bold" style={{ color: colors.textRed }}>
                    {totalQuestions - correctCount}
                  </div>
                  <div className="text-xs" style={{ color: colors.textRed }}>{t('incorrect')}</div>
                </div>

                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: colors.bgYellow }}
                >
                  <Clock className="w-6 h-6 mx-auto mb-2" style={{ color: colors.textYellow }} />
                  <div className="text-2xl font-bold" style={{ color: colors.textYellow }}>
                    {attempt.timeTaken ? formatTime(attempt.timeTaken) : '-'}
                  </div>
                  <div className="text-xs" style={{ color: colors.textYellow }}>{t('time_taken')}</div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Question Results */}
        <h2 className="text-xl font-semibold mb-4" style={{ color: colors.textPrimary }}>
          {t('question_review')}
        </h2>

        <div className="space-y-4">
          {questionResults.map((result, idx) => (
            <Card
              key={result.question.id}
              className="overflow-hidden"
              style={{
                borderColor: result.isCorrect ? colors.borderGreen : colors.borderRed,
                borderWidth: 2,
              }}
            >
              <CardBody>
                <div className="flex items-start gap-3">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      result.isCorrect ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  >
                    {result.isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-white" />
                    ) : (
                      <XCircle className="w-5 h-5 text-white" />
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="font-medium mb-2" style={{ color: colors.textPrimary }}>
                      {idx + 1}. {result.question.questionText}
                    </p>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span style={{ color: colors.textSecondary }}>{t('your_answer')}</span>
                        <span
                          className="font-medium"
                          style={{ color: result.isCorrect ? colors.textGreen : colors.textRed }}
                        >
                          {result.userAnswer || t('no_answer')}
                        </span>
                      </div>

                      {!result.isCorrect && (
                        <div className="flex items-start gap-2">
                          <span style={{ color: colors.textSecondary }}>{t('correct_answer')}</span>
                          <span className="font-medium" style={{ color: colors.textGreen }}>
                            {result.question.correctAnswer}
                          </span>
                        </div>
                      )}

                      {result.question.explanation && (
                        <div
                          className="mt-3 p-3 rounded-lg"
                          style={{ backgroundColor: colors.bg }}
                        >
                          <p className="text-sm" style={{ color: colors.textSecondary }}>
                            <strong>{t('explanation')}</strong> {result.question.explanation}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-xs" style={{ color: colors.textSecondary }}>
                      {t('points_awarded', { awarded: result.pointsAwarded, total: result.question.points })}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-center gap-4">
          <Button variant="secondary" onClick={() => navigate(`/courses/${courseId}`)}>
            {t('return_to_course')}
          </Button>
        </div>
      </div>
    </div>
  );
};
