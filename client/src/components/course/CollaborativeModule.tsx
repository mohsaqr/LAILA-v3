import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bot, Sparkles, Settings, MessageSquare, ChevronRight } from 'lucide-react';
import { courseTutorApi } from '../../api/courseTutor';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../common/Card';

interface CollaborativeModuleProps {
  courseId: number;
  courseTitle?: string;
  moduleName?: string;
  isInstructor?: boolean;
}

export const CollaborativeModule = ({ courseId, moduleName, isInstructor }: CollaborativeModuleProps) => {
  const { t } = useTranslation(['courses']);
  const { isDark } = useTheme();

  // Theme colors
  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  // Fetch tutors for this course (just to get count and check availability)
  const { data: tutors, isLoading } = useQuery({
    queryKey: ['studentCourseTutors', courseId],
    queryFn: () => courseTutorApi.getStudentTutors(courseId),
  });

  // No tutors available
  if (!isLoading && (!tutors || tutors.length === 0)) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <Bot className="w-10 h-10 mx-auto mb-2" style={{ color: colors.textMuted }} />
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            {t('no_ai_tutors_available')}
          </p>
        </CardBody>
      </Card>
    );
  }

  const displayName = moduleName || t('collaborative_module');
  const tutorCount = tutors?.length || 0;

  return (
    <div>
      {/* Header with Manage link for instructors */}
      {isInstructor && (
        <div className="flex items-center justify-end mb-2">
          <Link
            to={`/teach/courses/${courseId}/tutors`}
            className="text-xs text-primary-600 hover:underline flex items-center gap-1"
          >
            <Settings className="w-3 h-3" />
            {t('manage_tutors')}
          </Link>
        </div>
      )}

      {/* Single Collaborative Module Card */}
      <Link
        to={`/ai-tutors?courseId=${courseId}`}
        className="block"
      >
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-2 border-transparent hover:border-violet-300 dark:hover:border-violet-700">
          <CardBody className="p-4">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-lg flex-shrink-0">
                <Sparkles className="w-7 h-7" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base" style={{ color: colors.textPrimary }}>
                  {displayName}
                </h3>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  {t('x_ai_tutors_ready_help', { count: tutorCount })}
                </p>
              </div>

              {/* Action indicator */}
              <div className="flex items-center gap-1 text-violet-500">
                <MessageSquare className="w-5 h-5" />
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>

            {/* Tutor avatars preview */}
            {tutors && tutors.length > 0 && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: colors.border }}>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {tutors.slice(0, 5).map((tutor, i) => (
                      <div
                        key={tutor.courseTutorId}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-gray-800"
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
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                    ))}
                    {tutors.length > 5 && (
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium border-2 border-white dark:border-gray-800" style={{ color: colors.textSecondary }}>
                        +{tutors.length - 5}
                      </div>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: colors.textMuted }}>
                    {t('click_to_start_chatting')}
                  </span>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </Link>
    </div>
  );
};

export default CollaborativeModule;
