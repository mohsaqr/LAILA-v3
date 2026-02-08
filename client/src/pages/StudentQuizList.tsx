import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileQuestion, Clock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import apiClient from '../api/client';

interface QuizAttempt {
  attemptNumber: number;
  score?: number;
  status: string;
}

interface StudentQuiz {
  id: number;
  title: string;
  description?: string;
  courseId: number;
  courseName: string;
  timeLimit?: number;
  maxAttempts: number;
  passingScore: number;
  dueDate?: string;
  questionCount: number;
  myAttempts?: QuizAttempt[];
}

export const StudentQuizList = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation(['courses', 'common']);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    accent: '#088F8F',
    success: '#10b981',
    warning: '#f59e0b',
  };

  const { data: quizzes, isLoading } = useQuery({
    queryKey: ['quizzes', 'student'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: StudentQuiz[] }>('/quizzes/student');
      return response.data.data;
    },
  });

  if (isLoading) {
    return <Loading text={t('loading_quiz')} />;
  }

  const getQuizStatus = (quiz: StudentQuiz) => {
    const attempts = quiz.myAttempts || [];
    const completedAttempts = attempts.filter(a => a.status === 'graded');
    const bestScore = completedAttempts.length > 0
      ? Math.max(...completedAttempts.map(a => a.score || 0))
      : null;

    if (bestScore !== null && bestScore >= quiz.passingScore) {
      return { status: 'passed', label: t('passed'), color: colors.success };
    } else if (completedAttempts.length > 0) {
      return { status: 'attempted', label: t('not_passed'), color: colors.warning };
    } else if (attempts.some(a => a.status === 'in_progress')) {
      return { status: 'in_progress', label: t('in_progress'), color: colors.warning };
    }
    return { status: 'not_started', label: t('not_started'), color: colors.textSecondary };
  };

  // Group quizzes by course
  const quizzesByCourse = (quizzes || []).reduce((acc, quiz) => {
    if (!acc[quiz.courseId]) {
      acc[quiz.courseId] = {
        courseName: quiz.courseName,
        quizzes: [],
      };
    }
    acc[quiz.courseId].quizzes.push(quiz);
    return acc;
  }, {} as Record<number, { courseName: string; quizzes: StudentQuiz[] }>);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={[{ label: t('my_quizzes') }]} />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
          {t('my_quizzes')}
        </h1>
        <p className="mt-2" style={{ color: colors.textSecondary }}>
          {t('view_take_quizzes')}
        </p>
      </div>

      {!quizzes || quizzes.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <FileQuestion className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
              {t('no_quizzes_available')}
            </h3>
            <p style={{ color: colors.textSecondary }}>
              {t('quizzes_will_appear')}
            </p>
            <Link to="/courses" className="mt-4 inline-block">
              <button
                className="px-4 py-2 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: colors.accent, color: 'white' }}
              >
                {t('browse_courses')}
              </button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(quizzesByCourse).map(([courseId, { courseName, quizzes: courseQuizzes }]) => (
            <div key={courseId}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: colors.textPrimary }}>
                {courseName}
              </h2>
              <div className="space-y-4">
                {courseQuizzes.map((quiz) => {
                  const quizStatus = getQuizStatus(quiz);
                  const attempts = quiz.myAttempts || [];
                  const attemptCount = attempts.filter(a => a.status === 'graded').length;

                  return (
                    <Link
                      key={quiz.id}
                      to={`/courses/${quiz.courseId}/quizzes/${quiz.id}`}
                      className="block"
                    >
                      <Card className="hover:shadow-lg transition-shadow">
                        <CardBody className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div
                              className="w-12 h-12 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${colors.accent}20` }}
                            >
                              <FileQuestion className="w-6 h-6" style={{ color: colors.accent }} />
                            </div>
                            <div>
                              <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
                                {quiz.title}
                              </h3>
                              {quiz.description && (
                                <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                                  {quiz.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-sm" style={{ color: colors.textSecondary }}>
                                  {t('n_questions', { count: quiz.questionCount })}
                                </span>
                                {quiz.timeLimit && (
                                  <span className="text-sm flex items-center gap-1" style={{ color: colors.textSecondary }}>
                                    <Clock className="w-3 h-3" />
                                    {t('n_min', { count: quiz.timeLimit })}
                                  </span>
                                )}
                                <span className="text-sm" style={{ color: colors.textSecondary }}>
                                  {quiz.maxAttempts === 0
                                    ? t('unlimited_attempts', { current: attemptCount })
                                    : t('n_attempts', { current: attemptCount, max: quiz.maxAttempts })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              {quizStatus.status === 'passed' ? (
                                <CheckCircle className="w-5 h-5" style={{ color: quizStatus.color }} />
                              ) : quizStatus.status === 'attempted' ? (
                                <AlertCircle className="w-5 h-5" style={{ color: quizStatus.color }} />
                              ) : null}
                              <span className="text-sm font-medium" style={{ color: quizStatus.color }}>
                                {quizStatus.label}
                              </span>
                            </div>
                            {quiz.dueDate && (
                              <span className="text-sm" style={{ color: colors.textSecondary }}>
                                {t('due_date', { date: new Date(quiz.dueDate).toLocaleDateString() })}
                              </span>
                            )}
                            <ChevronRight className="w-5 h-5" style={{ color: colors.textSecondary }} />
                          </div>
                        </CardBody>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
