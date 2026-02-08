import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileQuestion, Clock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../common/Card';
import { Loading } from '../common/Loading';
import apiClient from '../../api/client';

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

interface CourseQuizzesProps {
  courseId: number;
}

export const CourseQuizzes = ({ courseId }: CourseQuizzesProps) => {
  const { isDark } = useTheme();

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    accent: '#088F8F',
    success: '#10b981',
    warning: '#f59e0b',
  };

  const { data: quizzes, isLoading } = useQuery({
    queryKey: ['quizzes', 'course', courseId],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Quiz[] }>(`/quizzes/course/${courseId}`);
      return response.data.data;
    },
  });

  if (isLoading) {
    return <Loading text="Loading quizzes..." />;
  }

  const getQuizStatus = (quiz: Quiz) => {
    const attempts = quiz.myAttempts || [];
    const completedAttempts = attempts.filter(a => a.status === 'graded');
    const bestScore = completedAttempts.length > 0
      ? Math.max(...completedAttempts.map(a => a.score || 0))
      : null;

    if (bestScore !== null && bestScore >= quiz.passingScore) {
      return { status: 'passed', label: 'Passed', color: colors.success };
    } else if (completedAttempts.length > 0) {
      return { status: 'attempted', label: 'Not Passed', color: colors.warning };
    } else if (attempts.some(a => a.status === 'in_progress')) {
      return { status: 'in_progress', label: 'In Progress', color: colors.warning };
    }
    return { status: 'not_started', label: 'Not Started', color: colors.textSecondary };
  };

  if (!quizzes || quizzes.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <FileQuestion className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textMuted }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
            No Quizzes Available
          </h3>
          <p style={{ color: colors.textSecondary }}>
            This course doesn't have any quizzes yet.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
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
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${colors.accent}20` }}
                  >
                    <FileQuestion className="w-6 h-6" style={{ color: colors.accent }} />
                  </div>
                  <div>
                    <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
                      {quiz.title}
                    </h3>
                    {quiz.description && (
                      <p className="text-sm mt-1 line-clamp-2" style={{ color: colors.textSecondary }}>
                        {quiz.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-sm" style={{ color: colors.textSecondary }}>
                        {quiz._count?.questions || 0} questions
                      </span>
                      {quiz.timeLimit && (
                        <span className="text-sm flex items-center gap-1" style={{ color: colors.textSecondary }}>
                          <Clock className="w-3 h-3" />
                          {quiz.timeLimit} min
                        </span>
                      )}
                      <span className="text-sm" style={{ color: colors.textSecondary }}>
                        {attemptCount}/{quiz.maxAttempts === 0 ? '∞' : quiz.maxAttempts} attempts
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
                    <span className="text-sm hidden sm:block" style={{ color: colors.textSecondary }}>
                      Due: {new Date(quiz.dueDate).toLocaleDateString()}
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
  );
};

export default CourseQuizzes;
