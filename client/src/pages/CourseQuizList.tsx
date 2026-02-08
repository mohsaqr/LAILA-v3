import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileQuestion, Clock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { buildCourseBreadcrumb } from '../utils/breadcrumbs';
import apiClient from '../api/client';

interface QuizAttempt {
  attemptNumber: number;
  score?: number;
  status: string;
}

interface Quiz {
  id: number;
  title: string;
  description?: string;
  timeLimit?: number;
  maxAttempts: number;
  passingScore: number;
  isPublished: boolean;
  dueDate?: string;
  _count?: { questions: number };
  myAttempts?: QuizAttempt[];
}

interface CourseInfo {
  id: number;
  title: string;
}

export const CourseQuizList = () => {
  const { t } = useTranslation(['courses']);
  const { courseId } = useParams<{ courseId: string }>();
  const { isDark } = useTheme();

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

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: CourseInfo }>(`/courses/${courseId}`);
      return response.data.data;
    },
  });

  const { data: quizzes, isLoading } = useQuery({
    queryKey: ['quizzes', 'course', courseId],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Quiz[] }>(`/quizzes/course/${courseId}`);
      return response.data.data;
    },
  });

  if (isLoading) {
    return <Loading text={t('loading_quizzes')} />;
  }

  const getQuizStatus = (quiz: Quiz) => {
    const attempts = quiz.myAttempts || [];
    const completedAttempts = attempts.filter(a => a.status === 'graded');
    const bestScore = completedAttempts.length > 0
      ? Math.max(...completedAttempts.map(a => a.score || 0))
      : null;

    if (bestScore !== null && bestScore >= quiz.passingScore) {
      return { status: 'passed', label: t('quiz_passed'), color: colors.success };
    } else if (completedAttempts.length > 0) {
      return { status: 'attempted', label: t('quiz_not_passed'), color: colors.warning };
    } else if (attempts.some(a => a.status === 'in_progress')) {
      return { status: 'in_progress', label: t('quiz_in_progress'), color: colors.warning };
    }
    return { status: 'not_started', label: t('quiz_not_started'), color: colors.textSecondary };
  };

  const breadcrumbItems = [
    ...buildCourseBreadcrumb(courseId!, course?.title || t('course')),
    { label: t('quizzes') },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
          {t('course_quizzes')}
        </h1>
        {course && (
          <p className="mt-2" style={{ color: colors.textSecondary }}>
            {t('quizzes_for_course', { title: course.title })}
          </p>
        )}
      </div>

      {!quizzes || quizzes.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <FileQuestion className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
              {t('no_quizzes_available')}
            </h3>
            <p style={{ color: colors.textSecondary }}>
              {t('no_quizzes_description')}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => {
            const quizStatus = getQuizStatus(quiz);
            const attempts = quiz.myAttempts || [];
            const attemptCount = attempts.filter(a => a.status === 'graded').length;

            return (
              <Link
                key={quiz.id}
                to={`/courses/${courseId}/quizzes/${quiz.id}`}
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
                            {t('x_questions', { count: quiz._count?.questions || 0 })}
                          </span>
                          {quiz.timeLimit && (
                            <span className="text-sm flex items-center gap-1" style={{ color: colors.textSecondary }}>
                              <Clock className="w-3 h-3" />
                              {t('x_min', { count: quiz.timeLimit })}
                            </span>
                          )}
                          <span className="text-sm" style={{ color: colors.textSecondary }}>
                            {t('attempts_count', { current: attemptCount, max: quiz.maxAttempts === 0 ? '∞' : quiz.maxAttempts })}
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
                          {t('due_date_short', { date: new Date(quiz.dueDate).toLocaleDateString() })}
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
      )}
    </div>
  );
};
