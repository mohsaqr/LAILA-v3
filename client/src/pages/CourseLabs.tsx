/**
 * Course Labs page — shows interactive labs available within a course context.
 * Accessible at /courses/:courseId/labs
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Network, Users, ArrowRight, ArrowLeft, FlaskConical } from 'lucide-react';
import { coursesApi } from '../api/courses';
import { useTheme } from '../hooks/useTheme';

export const CourseLabs = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(parseInt(courseId!)),
    enabled: !!courseId,
  });

  const enabledLabs = (course as any)?.enabledLabs as string | null | undefined;
  const enabledSet = new Set(enabledLabs ? enabledLabs.split(',').map((s: string) => s.trim()) : []);

  const allLabs = [
    {
      key: 'tna',
      title: t('exercise.title'),
      description: t('exercise.subtitle'),
      icon: Network,
      gradient: 'from-blue-500 to-indigo-600',
      badgeBg: isDark ? 'rgba(96,165,250,0.2)' : '#dbeafe',
      badgeText: isDark ? '#93c5fd' : '#2563eb',
      path: `/courses/${courseId}/tna-exercise`,
    },
    {
      key: 'sna',
      title: t('sna.title'),
      description: t('sna.subtitle'),
      icon: Users,
      gradient: 'from-violet-500 to-purple-600',
      badgeBg: isDark ? 'rgba(167,139,250,0.2)' : '#ede9fe',
      badgeText: isDark ? '#c4b5fd' : '#7c3aed',
      path: `/courses/${courseId}/sna-exercise`,
    },
  ];

  const labs = allLabs.filter(l => enabledSet.has(l.key));

  return (
    <div className="min-h-screen" style={{ backgroundColor: isDark ? '#111827' : '#f3f4f6' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to={`/courses/${courseId}`}
            className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {t('course_interactive_labs')}
            </h1>
            {course && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{course.title}</p>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {t('course_interactive_labs_desc')}
        </p>

        {/* Lab Cards */}
        <div className="grid sm:grid-cols-2 gap-6">
          {labs.map(lab => {
            const Icon = lab.icon;
            return (
              <button
                key={lab.key}
                onClick={() => navigate(lab.path)}
                className="text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all overflow-hidden group"
              >
                <div className={`h-1.5 bg-gradient-to-r ${lab.gradient}`} />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${lab.gradient} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ backgroundColor: lab.badgeBg, color: lab.badgeText }}
                    >
                      {t('interactive')}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {lab.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                    {lab.description}
                  </p>
                  <div className="flex items-center justify-end">
                    <span className={`inline-flex items-center gap-1 text-sm font-medium bg-gradient-to-r ${lab.gradient} bg-clip-text text-transparent`}>
                      {t('exercise.start')}
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
