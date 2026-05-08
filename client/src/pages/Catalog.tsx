import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Search,
  GraduationCap,
  ChevronDown,
  X,
} from 'lucide-react';
import { coursesApi } from '../api/courses';
import { categoriesApi } from '../api/categories';
import { meApi } from '../api/me';
import { adminApi } from '../api/admin';
import { Card, CardBody } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import {
  CatalogStatsCard,
  ContinueLearningRail,
  CourseCardV2,
} from '../components/courses';
import type { Course, Category } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { activityLogger } from '../services/activityLogger';

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

const getThemeColors = (isDark: boolean) => ({
  textPrimary: isDark ? '#f3f4f6' : '#111827',
  textSecondary: isDark ? '#9ca3af' : '#6b7280',
});

export const Catalog = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { user, isAuthenticated, isInstructor, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  const [search, setSearch] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [difficulty, setDifficulty] = useState('');
  const [page, setPage] = useState(1);

  const canCreateCourses = isInstructor || isAdmin;

  useEffect(() => {
    activityLogger.log({ verb: 'viewed', objectType: 'catalog', objectTitle: 'Course Catalog' });
  }, []);

  // Stats: admins → platform-wide; instructors (non-admin) → scoped to their courses.
  const { data: adminStats, isLoading: adminStatsLoading } = useQuery({
    queryKey: ['admin', 'dashboardOverview', 'catalog'],
    queryFn: () => adminApi.getDashboardOverview(),
    enabled: isAuthenticated && isAdmin,
  });
  const { data: teachStats, isLoading: teachStatsLoading } = useQuery({
    queryKey: ['me', 'teachingOverview', 'catalog'],
    queryFn: () => meApi.getTeachingOverview(),
    enabled: isAuthenticated && isInstructor && !isAdmin,
  });

  // Continue Learning rail — for any signed-in user with in-progress enrollments.
  const { data: continueRail } = useQuery({
    queryKey: ['me', 'continueLearning', 'catalog'],
    queryFn: () => meApi.getContinueLearning(),
    enabled: isAuthenticated,
  });

  const { data: categoriesList } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['courses', { search, categoryIds, difficulty, page }],
    queryFn: () => coursesApi.getCourses({
      search,
      categoryIds: categoryIds.length ? categoryIds : undefined,
      difficulty,
      page,
      limit: 12,
    }),
  });

  // Look up the current user's progress per courseId so cards can render
  // a progress bar when the viewer is enrolled.
  const progressByCourseId = useMemo(() => {
    const map = new Map<number, number>();
    (continueRail ?? []).forEach(item => map.set(item.courseId, item.progress));
    return map;
  }, [continueRail]);

  // Log search with debounce (fires 800ms after user stops typing)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!search.trim()) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      activityLogger.logCatalogSearched(search.trim());
    }, 800);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  useEffect(() => {
    if (categoryIds.length > 0) {
      const names = (categoriesList || []).filter(c => categoryIds.includes(c.id)).map(c => c.title);
      activityLogger.logCatalogFiltered({ filterType: 'category', categoryIds, categoryNames: names });
    }
  }, [categoryIds, categoriesList]);

  useEffect(() => {
    if (difficulty) {
      activityLogger.logCatalogFiltered({ filterType: 'difficulty', difficulty });
    }
  }, [difficulty]);

  const difficulties = [
    { value: 'beginner', label: t('beginner') },
    { value: 'intermediate', label: t('intermediate') },
    { value: 'advanced', label: t('advanced') },
  ];

  const totalCourses = isAdmin
    ? adminStats?.kpis.totalCourses ?? 0
    : teachStats?.kpis.totalCourses ?? 0;
  const totalStudents = isAdmin
    ? adminStats?.kpis.totalUsers ?? 0
    : teachStats?.kpis.totalStudents ?? 0;
  const statsLoading = isAdmin ? adminStatsLoading : teachStatsLoading;

  // Rail shows only in-progress courses. The progress map (passed to
  // CourseCardV2) keeps every enrolled course so a finished one still
  // shows its 100 % bar on its catalog card — it just doesn't compete
  // for space in the "continue learning" rail.
  const railItems = (continueRail ?? []).filter(item => item.progress < 100);
  const showRail = isAuthenticated && railItems.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-4">
        <Breadcrumb items={[{ label: t('courses') }]} />
      </div>

      {canCreateCourses && (
        <div className="mb-6 md:mb-8">
          <CatalogStatsCard
            totalCourses={totalCourses}
            totalStudents={totalStudents}
            totalCoursesLabel={t('courses')}
            totalStudentsLabel={t('students')}
            createLabel={t('create_course')}
            loading={statsLoading}
          />
        </div>
      )}

      {showRail && (
        <div className="mb-8 md:mb-10">
          <h2
            className="text-lg sm:text-xl font-semibold mb-4"
            style={{ color: colors.textPrimary }}
          >
            {t('continue_learning')}
          </h2>
          <ContinueLearningRail
            items={railItems}
            percentLabel={(percent) => t('percent_complete', { percent })}
          />
        </div>
      )}

      <div>
        <div className="mb-5 flex flex-col md:flex-row gap-3 md:gap-4">
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
          <div className="w-full md:w-64">
            <CategoryMultiSelect
              allCategories={categoriesList || []}
              selectedIds={categoryIds}
              onChange={(ids) => { setCategoryIds(ids); setPage(1); }}
            />
          </div>
          <div className="w-full md:w-48">
            <SearchableSelect
              options={difficulties}
              value={difficulty}
              onChange={(val) => { setDifficulty(val); setPage(1); }}
              placeholder={t('all_levels')}
            />
          </div>
        </div>

        {isLoading ? (
          <Loading text={t('loading_courses')} />
        ) : data?.courses && data.courses.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {data.courses.map((course: Course) => {
                const courseProgress = progressByCourseId.get(course.id);
                return (
                  <CourseCardV2
                    key={course.id}
                    course={course}
                    progress={courseProgress ?? null}
                    canManage={isAdmin || course.instructorId === user?.id}
                    studentsLabel={(count) => t('n_students', { count })}
                    progressLabel={t('progress')}
                    manageLabel={t('manage')}
                  />
                );
              })}
            </div>

            {data.pagination && data.pagination.totalPages > 1 && (
              <div className="mt-6 md:mt-8 flex flex-wrap justify-center gap-2">
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
            <CardBody className="text-center py-8 sm:py-12">
              <GraduationCap className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('no_courses')}</h3>
              <p className="text-gray-500 dark:text-gray-400">{t('try_adjusting_search')}</p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
};
