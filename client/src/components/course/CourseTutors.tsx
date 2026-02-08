import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bot, Sparkles, Settings, MessageSquare, ChevronRight } from 'lucide-react';
import { courseTutorApi } from '../../api/courseTutor';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../common/Card';
import { Loading } from '../common/Loading';

interface CourseTutorsProps {
  courseId: number;
  moduleName?: string;
  isInstructor?: boolean;
}

export const CourseTutors = ({ courseId, moduleName, isInstructor }: CourseTutorsProps) => {
  const { isDark } = useTheme();

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  // Fetch tutors for this course
  const { data: tutors, isLoading } = useQuery({
    queryKey: ['studentCourseTutors', courseId],
    queryFn: () => courseTutorApi.getStudentTutors(courseId),
  });

  if (isLoading) {
    return <Loading text="Loading AI tutors..." />;
  }

  // No tutors available
  if (!tutors || tutors.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <Bot className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textMuted }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
            No AI Tutors Available
          </h3>
          <p style={{ color: colors.textSecondary }}>
            This course doesn't have any AI tutors configured yet.
          </p>
        </CardBody>
      </Card>
    );
  }

  const displayName = moduleName || 'AI Tutors';

  return (
    <div className="space-y-4">
      {/* Header with Manage link for instructors */}
      {isInstructor && (
        <div className="flex items-center justify-end">
          <Link
            to={`/teach/courses/${courseId}/tutors`}
            className="text-sm text-primary-600 hover:underline flex items-center gap-1"
          >
            <Settings className="w-4 h-4" />
            Manage Tutors
          </Link>
        </div>
      )}

      {/* Main Collaborative Module Card */}
      <Link
        to={`/ai-tutors?courseId=${courseId}`}
        className="block"
      >
        <Card className="hover:shadow-lg transition-shadow border-2 border-transparent hover:border-violet-300 dark:hover:border-violet-700">
          <CardBody className="p-6">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-lg flex-shrink-0">
                <Sparkles className="w-8 h-8" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg" style={{ color: colors.textPrimary }}>
                  {displayName}
                </h3>
                <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                  {tutors.length} AI tutor{tutors.length !== 1 ? 's' : ''} ready to help you learn
                </p>
              </div>

              {/* Action indicator */}
              <div className="flex items-center gap-1 text-violet-500">
                <MessageSquare className="w-5 h-5" />
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>

            {/* Tutor avatars preview */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {tutors.slice(0, 5).map((tutor, i) => (
                    <div
                      key={tutor.courseTutorId}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium border-2 border-white dark:border-gray-800"
                      style={{ zIndex: 5 - i }}
                      title={tutor.displayName}
                    >
                      {tutor.avatarUrl ? (
                        <img
                          src={tutor.avatarUrl}
                          alt={tutor.displayName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <Bot className="w-5 h-5" />
                      )}
                    </div>
                  ))}
                  {tutors.length > 5 && (
                    <div
                      className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium border-2 border-white dark:border-gray-800"
                      style={{ color: colors.textSecondary }}
                    >
                      +{tutors.length - 5}
                    </div>
                  )}
                </div>
                <span className="text-sm" style={{ color: colors.textMuted }}>
                  Click to start chatting with AI tutors
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      </Link>

      {/* Individual Tutor Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {tutors.map((tutor) => (
          <Link
            key={tutor.courseTutorId}
            to={`/ai-tutors?courseId=${courseId}&tutorId=${tutor.courseTutorId}`}
            className="block"
          >
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardBody className="flex items-center gap-3 p-4">
                <div
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white flex-shrink-0"
                >
                  {tutor.avatarUrl ? (
                    <img
                      src={tutor.avatarUrl}
                      alt={tutor.displayName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <Bot className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium" style={{ color: colors.textPrimary }}>
                    {tutor.displayName}
                  </h4>
                  {tutor.description && (
                    <p className="text-sm line-clamp-1" style={{ color: colors.textSecondary }}>
                      {tutor.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: colors.textMuted }} />
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CourseTutors;
