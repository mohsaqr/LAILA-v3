import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { MessageSquare, Users, Clock, ChevronRight } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { buildCourseBreadcrumb } from '../utils/breadcrumbs';
import apiClient from '../api/client';

interface Forum {
  id: number;
  title: string;
  description: string | null;
  isPublished: boolean;
  _count?: { threads: number };
  lastActivity?: string | null;
}

interface CourseInfo {
  id: number;
  title: string;
}

export const CourseForumList = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    accent: '#088F8F',
  };

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: CourseInfo }>(`/courses/${courseId}`);
      return response.data.data;
    },
  });

  const { data: forums, isLoading } = useQuery({
    queryKey: ['forums', 'course', courseId],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Forum[] }>(`/forums/course/${courseId}`);
      return response.data.data;
    },
  });

  if (isLoading) {
    return <Loading text={t('loading_forums')} />;
  }

  const breadcrumbItems = [
    ...buildCourseBreadcrumb(courseId!, course?.title || t('course')),
    { label: t('forums') },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
          {t('course_forums_title')}
        </h1>
        {course && (
          <p className="mt-2" style={{ color: colors.textSecondary }}>
            {t('discussion_forums_for', { title: course.title })}
          </p>
        )}
      </div>

      {!forums || forums.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <MessageSquare className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
              {t('no_forums_available_title')}
            </h3>
            <p style={{ color: colors.textSecondary }}>
              {t('no_forums_available_description')}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {forums.map((forum) => (
            <Link
              key={forum.id}
              to={`/courses/${courseId}/forums/${forum.id}`}
              className="block"
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardBody className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${colors.accent}20` }}
                    >
                      <MessageSquare className="w-6 h-6" style={{ color: colors.accent }} />
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
                        {forum.title}
                      </h3>
                      {forum.description && (
                        <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                          {forum.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="flex items-center gap-1" style={{ color: colors.textSecondary }}>
                        <Users className="w-4 h-4" />
                        <span className="text-sm">{forum._count?.threads || 0} {t('threads')}</span>
                      </div>
                    </div>
                    {forum.lastActivity && (
                      <div className="text-center">
                        <div className="flex items-center gap-1" style={{ color: colors.textSecondary }}>
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">
                            {new Date(forum.lastActivity).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )}
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
