import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Activity as ActivityIcon, ArrowLeft, BarChart3, Mail, User } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { usersApi } from '../../api/users';
import { enrollmentManagementApi } from '../../api/enrollmentManagement';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ActivityLogsTab } from '../admin/logs/ActivityLogsTab';
import { Dashboard } from '../admin/Dashboard';
import activityLogger from '../../services/activityLogger';

type TabId = 'log' | 'analytics';

const formatDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '-';

export const StudentCourseActivity = () => {
  const { courseId: courseIdParam, userId: userIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const userId = Number(userIdParam);
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('log');
  const [exportStatus, setExportStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getUserById(userId),
    enabled: !!userId,
  });

  // Find this student's enrollment record for the course to surface
  // enrollment date and last-access time in the header.
  const { data: enrollments } = useQuery({
    queryKey: ['courseEnrollments', courseId, 1, ''],
    queryFn: () => enrollmentManagementApi.getCourseEnrollments(courseId, 1, 1000, undefined),
    enabled: !!courseId,
    staleTime: 30_000,
  });
  const enrollment = enrollments?.enrollments.find((e) => e.user?.id === userId);

  useEffect(() => {
    if (courseId && userId) {
      activityLogger.log({
        verb: 'viewed',
        objectType: 'analytics',
        objectId: userId,
        objectTitle: 'Student Course Activity',
        courseId,
        actionSubtype: 'teach.student_activity_viewed',
        extensions: { studentUserId: userId },
      });
    }
  }, [courseId, userId]);

  const breadcrumbItems = buildTeachingBreadcrumb(
    courseId,
    course?.title,
    t('teaching:students', { defaultValue: 'Students' })
  );
  // Extend with the student's name
  breadcrumbItems.push({
    label: user?.fullname || `User ${userId}`,
  });

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'log',
      label: t('teaching:activity_log', { defaultValue: 'Activity Log' }),
      icon: <ActivityIcon className="w-4 h-4" />,
    },
    {
      id: 'analytics',
      label: t('teaching:analytics', { defaultValue: 'Analytics' }),
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-6">
        <Breadcrumb homeHref="/" items={breadcrumbItems} />
      </div>

      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate(`/teach/courses/${courseId}/students`)}
        >
          {t('teaching:back_to_students', { defaultValue: 'Back to students' })}
        </Button>
      </div>

      {/* Student header card — instructor-oriented, distinct from the
          student's own self-view of analytics. */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-primary-600 dark:text-primary-300" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                  {user?.fullname ?? `User ${userId}`}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{user?.email ?? ''}</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t('teaching:enrolled', { defaultValue: 'Enrolled' })}
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDate(enrollment?.enrolledAt)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t('teaching:last_access', { defaultValue: 'Last access' })}
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDate(enrollment?.lastAccessAt)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t('teaching:progress', { defaultValue: 'Progress' })}
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {enrollment ? `${Math.round(enrollment.progress ?? 0)}%` : '-'}
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — same DATA scope as the student's self-view
          (fixedCourseId + student's userId), but reached through the
          instructor-owned /teach/* route tree. */}
      {activeTab === 'log' && (
        <ActivityLogsTab
          exportStatus={exportStatus}
          setExportStatus={setExportStatus}
          fixedCourseId={courseId}
          initialUserId={userId}
        />
      )}

      {activeTab === 'analytics' && (
        <Dashboard mode="instructor" fixedCourseId={courseId} fixedUserId={userId} />
      )}
    </div>
  );
};
