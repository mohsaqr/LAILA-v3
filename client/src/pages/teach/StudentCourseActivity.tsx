import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Mail, User } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { enrollmentManagementApi } from '../../api/enrollmentManagement';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Dashboard } from '../admin/Dashboard';
import activityLogger from '../../services/activityLogger';

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

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  // Source the student's name/email/enrollment metadata from the roster
  // payload, which already includes `user: { id, fullname, email }` and is
  // accessible to instructors. The /users/:id endpoint refuses non-admins
  // for any user other than self, so it can't fulfil this need.
  const { data: enrollmentData } = useQuery({
    queryKey: ['courseEnrollments', courseId, 1, ''],
    queryFn: () => enrollmentManagementApi.getCourseEnrollments(courseId, 1, 1000, undefined),
    enabled: !!courseId,
    staleTime: 30_000,
  });
  const enrollment = enrollmentData?.enrollments.find((e) => e.user?.id === userId);
  const student = enrollment?.user;

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
  breadcrumbItems.push({
    label: student?.fullname || `User ${userId}`,
  });

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

      {/* Student header card — instructor-oriented identity + enrollment
          metadata, distinct from the student's own self-view of analytics. */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-primary-600 dark:text-primary-300" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                  {student?.fullname ?? `User ${userId}`}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{student?.email ?? ''}</span>
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

      {/* Learning analytics for this student in this course. The activity-log
          view is reachable from the roster's "Log" button — keeping it as a
          tab here would just duplicate that path. Dashboard hides its own
          course/student selectors when fixedCourseId/fixedUserId are passed,
          locking the view to this single (course, student) pair. */}
      <Dashboard mode="instructor" fixedCourseId={courseId} fixedUserId={userId} />
    </div>
  );
};
