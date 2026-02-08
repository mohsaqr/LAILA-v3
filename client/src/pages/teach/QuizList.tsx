import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileQuestion, Clock, Users, ChevronRight, Plus } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import apiClient from '../../api/client';

interface QuizListItem {
  id: number;
  title: string;
  courseId: number;
  courseName: string;
  moduleId: number | null;
  timeLimit: number | null;
  isPublished: boolean;
  attemptCount: number;
  questionCount: number;
}

export const QuizList = () => {
  const { isDark } = useTheme();

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    accent: '#088F8F',
    warning: '#f59e0b',
  };

  const { data: quizzes, isLoading } = useQuery({
    queryKey: ['quizzes', 'instructor'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: QuizListItem[] }>('/quizzes/instructor');
      return response.data.data;
    },
  });

  if (isLoading) {
    return <Loading text="Loading quizzes..." />;
  }

  const breadcrumbItems = buildTeachingBreadcrumb(undefined, undefined, 'All Quizzes');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
            Quiz Manager
          </h1>
          <p className="mt-2" style={{ color: colors.textSecondary }}>
            Manage quizzes across all your courses
          </p>
        </div>
      </div>

      {!quizzes || quizzes.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <FileQuestion className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
              No Quizzes Created
            </h3>
            <p style={{ color: colors.textSecondary }}>
              Create quizzes from your course curriculum pages.
            </p>
            <Link to="/courses" className="mt-4 inline-block">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Go to Courses
              </Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <Link
              key={quiz.id}
              to={`/teach/courses/${quiz.courseId}/quizzes/${quiz.id}`}
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
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
                          {quiz.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            quiz.isPublished
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}
                        >
                          {quiz.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        {quiz.courseName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                        {quiz.questionCount}
                      </p>
                      <p className="text-xs" style={{ color: colors.textSecondary }}>
                        Questions
                      </p>
                    </div>
                    {quiz.timeLimit && (
                      <div className="flex items-center gap-1" style={{ color: colors.textSecondary }}>
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">{quiz.timeLimit} min</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1" style={{ color: colors.textSecondary }}>
                      <Users className="w-4 h-4" />
                      <span className="text-sm">{quiz.attemptCount} attempts</span>
                    </div>
                    <ChevronRight className="w-5 h-5" style={{ color: colors.textSecondary }} />
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
