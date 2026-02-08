import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Users, Clock, ChevronRight } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../common/Card';
import { Loading } from '../common/Loading';
import apiClient from '../../api/client';

interface Forum {
  id: number;
  title: string;
  description: string | null;
  isPublished: boolean;
  _count?: { threads: number };
  lastActivity?: string | null;
}

interface CourseForumsProps {
  courseId: number;
}

export const CourseForums = ({ courseId }: CourseForumsProps) => {
  const { isDark } = useTheme();

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    accent: '#088F8F',
  };

  const { data: forums, isLoading } = useQuery({
    queryKey: ['forums', 'course', courseId],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Forum[] }>(`/forums/course/${courseId}`);
      return response.data.data;
    },
  });

  if (isLoading) {
    return <Loading text="Loading forums..." />;
  }

  if (!forums || forums.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <MessageSquare className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textMuted }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
            No Forums Available
          </h3>
          <p style={{ color: colors.textSecondary }}>
            This course doesn't have any active discussion forums yet.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
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
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${colors.accent}20` }}
                >
                  <MessageSquare className="w-6 h-6" style={{ color: colors.accent }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
                    {forum.title}
                  </h3>
                  {forum.description && (
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: colors.textSecondary }}>
                      {forum.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center hidden sm:block">
                  <div className="flex items-center gap-1" style={{ color: colors.textSecondary }}>
                    <Users className="w-4 h-4" />
                    <span className="text-sm">{forum._count?.threads || 0} threads</span>
                  </div>
                </div>
                {forum.lastActivity && (
                  <div className="text-center hidden md:block">
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
  );
};

export default CourseForums;
