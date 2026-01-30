import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  GraduationCap,
  Users,
  Plus,
  Settings,
  BookOpen,
  Edit,
  BarChart3,
  CheckCircle,
  PlayCircle,
} from 'lucide-react';
import { coursesApi } from '../api/courses';
import { enrollmentsApi } from '../api/enrollments';
import { Card, CardBody } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { Course, Enrollment } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

// Theme colors helper
const getThemeColors = (isDark: boolean) => ({
  textPrimary: isDark ? '#f3f4f6' : '#111827',
  textSecondary: isDark ? '#9ca3af' : '#6b7280',
  textMuted: isDark ? '#6b7280' : '#9ca3af',
  border: isDark ? '#374151' : '#e5e7eb',
  bgSecondary: isDark ? '#374151' : '#f3f4f6',
  inputBg: isDark ? '#1f2937' : '#ffffff',
});

export const Catalog = () => {
  const { isAuthenticated, isInstructor, isAdmin, viewAsRole } = useAuth();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter'); // 'enrolled' | 'completed' | null
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [page, setPage] = useState(1);

  const canCreateCourses = isInstructor || isAdmin;

  // Fetch user's enrollments when filter is active
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['myEnrollments'],
    queryFn: () => enrollmentsApi.getMyEnrollments(),
    enabled: isAuthenticated && (filter === 'enrolled' || filter === 'completed'),
  });

  // Fetch instructor's own courses if they are an instructor or admin
  // Include viewAsRole in query key so cache is separate per view mode
  const { data: myCourses, isLoading: myCoursesLoading } = useQuery({
    queryKey: ['myCourses', viewAsRole],
    queryFn: () => coursesApi.getMyCourses(),
    enabled: isAuthenticated && canCreateCourses,
  });

  // Fetch public course catalog
  const { data, isLoading } = useQuery({
    queryKey: ['courses', { search, category, difficulty, page }],
    queryFn: () => coursesApi.getCourses({ search, category, difficulty, page, limit: 12 }),
  });

  const categories = ['Research Methods', 'AI & Technology', 'Data Science', 'Academic Writing'];
  const difficulties = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>Courses</h1>
          <p className="mt-1" style={{ color: colors.textSecondary }}>
            {canCreateCourses
              ? 'Manage your courses and discover new ones'
              : 'Discover AI-powered courses to enhance your learning'}
          </p>
        </div>
        {canCreateCourses && (
          <Link to="/teach/create">
            <Button icon={<Plus className="w-4 h-4" />}>Create Course</Button>
          </Link>
        )}
      </div>

      {/* Filter Tabs */}
      {isAuthenticated && (
        <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setSearchParams({})}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              !filter
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <GraduationCap className="w-4 h-4 inline mr-1.5" />
            All Courses
          </button>
          <button
            onClick={() => setSearchParams({ filter: 'enrolled' })}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === 'enrolled'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <PlayCircle className="w-4 h-4 inline mr-1.5" />
            My Enrolled
          </button>
          <button
            onClick={() => setSearchParams({ filter: 'completed' })}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === 'completed'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <CheckCircle className="w-4 h-4 inline mr-1.5" />
            Completed
          </button>
        </div>
      )}

      {/* Filtered Courses (Enrolled/Completed) */}
      {filter && isAuthenticated && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
            {filter === 'enrolled' ? (
              <>
                <PlayCircle className="w-5 h-5 text-primary-500" />
                My Enrolled Courses
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                Completed Courses
              </>
            )}
          </h2>
          {enrollmentsLoading ? (
            <Loading text="Loading your courses..." />
          ) : enrollments && enrollments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrollments
                .filter((enrollment: Enrollment) =>
                  filter === 'completed' ? enrollment.progress === 100 : true
                )
                .map((enrollment: Enrollment) => (
                  <EnrolledCourseCard key={enrollment.id} enrollment={enrollment} />
                ))}
            </div>
          ) : (
            <Card>
              <CardBody className="text-center py-8">
                <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {filter === 'completed' ? 'No completed courses yet' : 'No enrolled courses yet'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  {filter === 'completed'
                    ? 'Complete a course to see it here'
                    : 'Browse the catalog and enroll in a course to get started'}
                </p>
                <button
                  onClick={() => setSearchParams({})}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium text-sm"
                >
                  Browse Catalog
                </button>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* My Courses Section - For instructors and admins */}
      {canCreateCourses && !filter && (
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
            <BookOpen className="w-5 h-5 text-primary-500" />
            My Courses
          </h2>
          {myCoursesLoading ? (
            <Loading text="Loading your courses..." />
          ) : myCourses && myCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myCourses.map((course: Course) => (
                <InstructorCourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <Card>
              <CardBody className="text-center py-8">
                <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">No courses yet</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Create your first course to get started</p>
                <Link to="/teach/create">
                  <Button size="sm" icon={<Plus className="w-4 h-4" />}>
                    Create Course
                  </Button>
                </Link>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Course Catalog Section - Hide when filter is active */}
      {!filter && (
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
          <GraduationCap className="w-5 h-5 text-primary-500" />
          Course Catalog
        </h2>

        {/* Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search courses..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-11"
            />
          </div>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Levels</option>
            {difficulties.map((diff) => (
              <option key={diff.value} value={diff.value}>
                {diff.label}
              </option>
            ))}
          </select>
        </div>

        {/* Course Grid */}
        {isLoading ? (
          <Loading text="Loading courses..." />
        ) : data?.courses && data.courses.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.courses.map((course: Course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>

            {/* Pagination */}
            {data.pagination && data.pagination.totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-4 py-2 rounded-lg ${
                      p === page
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardBody className="text-center py-12">
              <GraduationCap className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No courses found</h3>
              <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filters</p>
            </CardBody>
          </Card>
        )}
      </div>
      )}
    </div>
  );
};

// Card for enrolled courses
const EnrolledCourseCard = ({ enrollment }: { enrollment: Enrollment }) => {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const course = enrollment.course;
  if (!course) return null;

  const progress = enrollment.progress || 0;
  const isCompleted = progress === 100;

  return (
    <Link to={`/courses/${course.id}/player`}>
      <Card hover className="h-full">
        {/* Thumbnail */}
        <div className="h-32 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-t-xl flex items-center justify-center relative">
          {course.thumbnail ? (
            <img
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-full object-cover rounded-t-xl"
            />
          ) : (
            <GraduationCap className="w-12 h-12 text-white/80" />
          )}
          {/* Progress badge */}
          <span
            className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded ${
              isCompleted
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {isCompleted ? 'Completed' : `${Math.round(progress)}% Complete`}
          </span>
        </div>

        <CardBody>
          {/* Title */}
          <h3 className="font-semibold mb-2 line-clamp-2" style={{ color: colors.textPrimary }}>{course.title}</h3>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}>
              <div
                className={`h-full rounded-full transition-all ${isCompleted ? 'bg-green-500' : 'bg-primary-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Continue button */}
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: colors.textSecondary }}>{course.instructor?.fullname}</span>
            <span className="text-primary-600 dark:text-primary-400 font-medium">
              {isCompleted ? 'Review' : 'Continue'} →
            </span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
};

// Card for instructor's own courses with management options
const InstructorCourseCard = ({ course }: { course: Course }) => {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  return (
    <Card className="h-full">
      {/* Thumbnail */}
      <div className="h-32 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-t-xl flex items-center justify-center relative">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt={course.title}
            className="w-full h-full object-cover rounded-t-xl"
          />
        ) : (
          <GraduationCap className="w-12 h-12 text-white/80" />
        )}
        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded ${
            course.status === 'published'
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {course.status === 'published' ? 'Published' : 'Draft'}
        </span>
      </div>

      <CardBody className="flex flex-col">
        {/* Title */}
        <h3 className="font-semibold mb-2 line-clamp-2" style={{ color: colors.textPrimary }}>{course.title}</h3>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm mb-4" style={{ color: colors.textSecondary }}>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {course._count?.enrollments || 0} students
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            {course._count?.modules || 0} modules
          </span>
        </div>

        {/* Actions */}
        <div className="mt-auto flex gap-2">
          <Link to={`/teach/courses/${course.id}/curriculum`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full" icon={<Edit className="w-4 h-4" />}>
              Edit
            </Button>
          </Link>
          <Link to={`/teach/courses/${course.id}/edit`} title="Settings">
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </Link>
          <Link to={`/courses/${course.id}`} title="View Course">
            <Button variant="ghost" size="sm">
              <BarChart3 className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
};

// Card for catalog courses
const CourseCard = ({ course }: { course: Course }) => {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const difficultyColors: Record<string, string> = {
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-red-100 text-red-700',
  };

  return (
    <Link to={`/courses/${course.id}`}>
      <Card hover className="h-full">
        {/* Thumbnail */}
        <div className="h-40 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-t-xl flex items-center justify-center">
          {course.thumbnail ? (
            <img
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-full object-cover rounded-t-xl"
            />
          ) : (
            <GraduationCap className="w-16 h-16 text-white/80" />
          )}
        </div>

        <CardBody>
          {/* Category & Difficulty */}
          <div className="flex items-center gap-2 mb-3">
            {course.category && (
              <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded">
                {course.category}
              </span>
            )}
            {course.difficulty && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${difficultyColors[course.difficulty] || ''}`}
              >
                {course.difficulty}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold mb-2 line-clamp-2" style={{ color: colors.textPrimary }}>{course.title}</h3>

          {/* Description */}
          <p className="text-sm mb-4 line-clamp-2" style={{ color: colors.textSecondary }}>{course.description}</p>

          {/* Footer */}
          <div className="flex items-center justify-between text-sm" style={{ color: colors.textSecondary }}>
            <span>{course.instructor?.fullname}</span>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{course._count?.enrollments || 0}</span>
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
};
