import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  GraduationCap,
  Users,
  Plus,
  Settings,
  BookOpen,
  Edit,
  Eye,
  CheckCircle,
  PlayCircle,
  ChevronDown,
  X,
} from 'lucide-react';
import { coursesApi } from '../api/courses';
import { enrollmentsApi } from '../api/enrollments';
import { categoriesApi } from '../api/categories';
import { Card, CardBody } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { Course, Enrollment, Category } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

// ─── Searchable multi-select for categories ───────────────────────────────────

const CategoryMultiSelect = ({
  allCategories,
  selectedIds,
  onChange,
}: {
  allCategories: Category[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = allCategories.filter(c => selectedIds.includes(c.id));
  const filtered = allCategories.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: number) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(o => !o)}
        className={`min-h-[42px] w-full px-3 py-2 flex flex-wrap items-center gap-1.5 rounded-lg border cursor-pointer transition-colors bg-white dark:bg-gray-800 ${
          open
            ? 'border-primary-500 ring-2 ring-primary-500/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
        }`}
      >
        {selected.length === 0 ? (
          <span className="text-sm text-gray-400 dark:text-gray-500 flex-1">All categories</span>
        ) : (
          selected.map(cat => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
            >
              {cat.title}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onChange(selectedIds.filter(x => x !== cat.id)); }}
                className="hover:text-primary-900 dark:hover:text-primary-100"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search categories…"
                className="w-full pl-7 pr-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-2 text-sm text-gray-400 dark:text-gray-500">No results</li>
            ) : (
              filtered.map(cat => {
                const checked = selectedIds.includes(cat.id);
                return (
                  <li
                    key={cat.id}
                    onClick={() => toggle(cat.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors ${
                      checked
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    }`}
                  >
                    <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-primary-500 border-primary-500' : 'border-gray-300 dark:border-gray-600'}`}>
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {cat.title}
                  </li>
                );
              })
            )}
          </ul>

          {selectedIds.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs text-gray-400">{selectedIds.length} selected</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onChange([]); }}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Searchable single-select (matches CategoryMultiSelect style) ────────────

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedOption = options.find(o => o.value === value);
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(o => !o)}
        className={`min-h-[42px] w-full px-3 py-2 flex items-center gap-1.5 rounded-lg border cursor-pointer transition-colors bg-white dark:bg-gray-800 ${
          open
            ? 'border-primary-500 ring-2 ring-primary-500/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
        }`}
      >
        {selectedOption ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
            {selectedOption.label}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(''); }}
              className="hover:text-primary-900 dark:hover:text-primary-100"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500 flex-1">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search…`}
                className="w-full pl-7 pr-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-2 text-sm text-gray-400 dark:text-gray-500">No results</li>
            ) : (
              filtered.map(opt => {
                const checked = opt.value === value;
                return (
                  <li
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors ${
                      checked
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    }`}
                  >
                    <span className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center transition-colors ${checked ? 'bg-primary-500 border-primary-500' : 'border-gray-300 dark:border-gray-600'}`}>
                      {checked && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    {opt.label}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

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
  const { t } = useTranslation(['courses', 'common']);
  const { isAuthenticated, isInstructor, isAdmin, viewAsRole } = useAuth();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter'); // 'enrolled' | 'completed' | null
  const [search, setSearch] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
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

  // Fetch categories for filter dropdown
  const { data: categoriesList } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
  });

  // Fetch public course catalog
  const { data, isLoading } = useQuery({
    queryKey: ['courses', { search, categoryIds, difficulty, page }],
    queryFn: () => coursesApi.getCourses({ search, categoryIds: categoryIds.length ? categoryIds : undefined, difficulty, page, limit: 12 }),
  });
  const difficulties = [
    { value: 'beginner', label: t('beginner') },
    { value: 'intermediate', label: t('intermediate') },
    { value: 'advanced', label: t('advanced') },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb items={[{ label: t('courses') }]} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>{t('courses')}</h1>
          <p className="mt-1" style={{ color: colors.textSecondary }}>
            {canCreateCourses
              ? t('manage_discover_courses')
              : t('discover_ai_courses')}
          </p>
        </div>
        {canCreateCourses && (
          <Link to="/teach/create">
            <Button icon={<Plus className="w-4 h-4" />}>{t('create_course')}</Button>
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
            {t('all_courses')}
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
            {t('my_enrolled')}
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
            {t('completed')}
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
                {t('my_enrolled_courses')}
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                {t('completed_courses')}
              </>
            )}
          </h2>
          {enrollmentsLoading ? (
            <Loading text={t('loading_courses')} />
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
                  {filter === 'completed' ? t('no_completed_courses') : t('no_enrolled_courses')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  {filter === 'completed'
                    ? t('complete_course_to_see')
                    : t('browse_enroll_get_started')}
                </p>
                <button
                  onClick={() => setSearchParams({})}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium text-sm"
                >
                  {t('browse_catalog')}
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
            {t('my_courses')}
          </h2>
          {myCoursesLoading ? (
            <Loading text={t('loading_courses')} />
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
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{t('no_courses_yet')}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{t('create_first_course')}</p>
                <Link to="/teach/create">
                  <Button size="sm" icon={<Plus className="w-4 h-4" />}>
                    {t('create_course')}
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
          {t('course_catalog')}
        </h2>

        {/* Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder={t('search_courses')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-11"
            />
          </div>

          <div className="w-64">
            <CategoryMultiSelect
              allCategories={categoriesList || []}
              selectedIds={categoryIds}
              onChange={(ids) => { setCategoryIds(ids); setPage(1); }}
            />
          </div>

          <div className="w-48">
            <SearchableSelect
              options={difficulties}
              value={difficulty}
              onChange={(val) => { setDifficulty(val); setPage(1); }}
              placeholder={t('all_levels')}
            />
          </div>
        </div>

        {/* Course Grid */}
        {isLoading ? (
          <Loading text={t('loading_courses')} />
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('no_courses')}</h3>
              <p className="text-gray-500 dark:text-gray-400">{t('try_adjusting_search')}</p>
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
  const { t } = useTranslation(['courses']);
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const course = enrollment.course;
  if (!course) return null;

  const progress = enrollment.progress || 0;
  const isCompleted = progress === 100;

  return (
    <Link to={`/courses/${course.id}`}>
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
            {isCompleted ? t('completed') : t('percent_complete', { percent: Math.round(progress) })}
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
              {isCompleted ? t('review') : t('continue')} →
            </span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
};

// Card for instructor's own courses with management options
const InstructorCourseCard = ({ course }: { course: Course }) => {
  const { t } = useTranslation(['courses', 'common']);
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
          {course.status === 'published' ? t('common:published') : t('common:draft')}
        </span>
      </div>

      <CardBody className="flex flex-col">
        {/* Title */}
        <h3 className="font-semibold mb-2 line-clamp-2" style={{ color: colors.textPrimary }}>{course.title}</h3>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm mb-4" style={{ color: colors.textSecondary }}>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {t('n_students', { count: course._count?.enrollments || 0 })}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            {t('n_modules', { count: course._count?.modules || 0 })}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-auto flex gap-2">
          <Link to={`/courses/${course.id}`} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Eye className="w-4 h-4" />
            {t('view_course')}
          </Link>
          <Link to={`/teach/courses/${course.id}/curriculum`} title={t('common:edit')} className="inline-flex items-center justify-center px-2 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Edit className="w-4 h-4" />
          </Link>
          <Link to={`/teach/courses/${course.id}/edit`} title={t('settings:settings')} className="inline-flex items-center justify-center px-2 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </CardBody>
    </Card>
  );
};

// Card for catalog courses
const CourseCard = ({ course }: { course: Course }) => {
  const { t } = useTranslation(['courses']);
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const difficultyColors: Record<string, string> = {
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-red-100 text-red-700',
  };

  const difficultyLabels: Record<string, string> = {
    beginner: t('beginner'),
    intermediate: t('intermediate'),
    advanced: t('advanced'),
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
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {course.categories?.slice(0, 2).map(cc => (
              <span key={cc.category.id} className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded">
                {cc.category.title}
              </span>
            ))}
            {course.difficulty && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${difficultyColors[course.difficulty] || ''}`}
              >
                {difficultyLabels[course.difficulty] || course.difficulty}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold mb-2 line-clamp-2" style={{ color: colors.textPrimary }}>{course.title}</h3>

          {/* Description */}
          <p className="text-sm mb-4 line-clamp-2" style={{ color: colors.textSecondary }}>{course.description?.replace(/<[^>]*>/g, '') || ''}</p>

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
