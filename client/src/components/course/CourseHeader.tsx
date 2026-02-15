import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, BookOpen, PlayCircle, Edit, Settings, PenSquare } from 'lucide-react';
import { Button } from '../common/Button';

interface CourseHeaderProps {
  course: {
    id: number;
    title: string;
    description?: string;
    category?: string;
    instructor?: { fullname: string };
    modules?: { lectures?: unknown[] }[];
    _count?: { enrollments?: number };
  };
  isEnrolled: boolean;
  hasAccess: boolean;
  isAuthenticated: boolean;
  showInstructorControls: boolean;
  isActualAdmin: boolean;
  onEnroll: () => void;
  isEnrolling: boolean;
}

export const CourseHeader = ({
  course,
  hasAccess,
  isAuthenticated,
  showInstructorControls,
  isActualAdmin,
  onEnroll,
  isEnrolling,
}: CourseHeaderProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const totalLectures = course.modules?.reduce((sum, m) => sum + (m.lectures?.length || 0), 0) || 0;

  return (
    <>
      {/* Instructor Toolbar - Prominent Edit Banner */}
      {(showInstructorControls || isActualAdmin) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <PenSquare className="w-5 h-5" />
              <span className="font-medium">{t('instructor_view')}</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={`/teach/courses/${course.id}/curriculum`}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                <Edit className="w-4 h-4" />
                {t('edit_course')}
              </Link>
              <Link
                to={`/teach/courses/${course.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                <Settings className="w-4 h-4" />
                {t('common:settings')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="gradient-bg text-white py-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl md:text-2xl font-bold mb-2">{course.title}</h1>
        {course.description && (
          <p className="text-white/90 mb-3 text-sm md:text-base line-clamp-2">{course.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" /> {t('x_students', { count: course._count?.enrollments || 0 })}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" /> {t('x_modules', { count: course.modules?.length || 0 })}
          </span>
          <span className="flex items-center gap-1">
            <PlayCircle className="w-4 h-4" /> {t('x_lessons', { count: totalLectures })}
          </span>
          {course.instructor && <span>{t('by_instructor', { name: course.instructor.fullname })}</span>}
        </div>

        {/* Action buttons for non-enrolled users */}
        {!hasAccess && (
          <div className="mt-4 flex flex-wrap gap-3">
            {isAuthenticated ? (
              <Button
                onClick={onEnroll}
                loading={isEnrolling}
                className="bg-white text-primary-600 hover:bg-gray-100"
              >
                {t('enroll_now_free')}
              </Button>
            ) : (
              <Link
                to="/login"
                className="btn bg-white text-primary-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-medium"
              >
                {t('sign_in_to_enroll')}
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default CourseHeader;
