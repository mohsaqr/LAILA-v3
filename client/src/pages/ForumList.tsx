import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Users, Clock, ChevronRight } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import apiClient from '../api/client';

interface ForumListItem {
  id: number;
  title: string;
  description: string | null;
  courseId: number;
  courseName: string;
  threadCount: number;
  lastActivity: string | null;
}

export const ForumList = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation(['courses', 'common']);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    accent: '#088F8F',
  };

  const { data: forums, isLoading } = useQuery({
    queryKey: ['forums', 'all'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: ForumListItem[] }>('/forums');
      return response.data.data;
    },
  });

  if (isLoading) {
    return <Loading text={t('loading_forums')} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={[{ label: t('all_forums') }]} />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
          {t('discussion_forums')}
        </h1>
        <p className="mt-2" style={{ color: colors.textSecondary }}>
          {t('participate_in_discussions')}
        </p>
      </div>

      {!forums || forums.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <MessageSquare className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
              {t('no_forums_available')}
            </h3>
            <p style={{ color: colors.textSecondary }}>
              {t('forums_will_appear')}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {forums.map((forum) => (
            <Link
              key={forum.id}
              to={`/courses/${forum.courseId}/forums/${forum.id}`}
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
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        {forum.courseName}
                      </p>
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
                        <span className="text-sm">{t('n_threads', { count: forum.threadCount })}</span>
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
