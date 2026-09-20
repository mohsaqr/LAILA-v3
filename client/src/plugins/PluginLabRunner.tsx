/**
 * A lab whose type comes from a plugin.
 *
 * `LabRunner` is built entirely around WebR/Pyodide code cells — it installs a
 * language runtime, tracks which cell was last run, and captures its output for
 * submission. A plugin lab is not a notebook at all, so it takes none of that
 * machinery: it gets page chrome and a `PluginSlot`, and the plugin owns
 * everything inside.
 *
 * The teacher's authoring view is the same component with `editing` set, which
 * is how `lecture.block` works too — one rule for the whole plugin system
 * rather than a second convention for labs.
 */

import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Puzzle } from 'lucide-react';
import { coursesApi } from '../api/courses';
import { useAuthStore } from '../store/authStore';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { PluginSlot } from './PluginSlot';
import { usePluginExtension } from './usePluginExtensions';

/** The fields this runner needs; the lab row carries plenty more. */
export interface PluginLabShape {
  id: number;
  name: string;
  description?: string | null;
  labType: string;
  createdBy?: number;
}

export const PluginLabRunner = ({ lab }: { lab: PluginLabShape }) => {
  const { t } = useTranslation(['courses', 'common']);
  const [searchParams] = useSearchParams();
  const courseIdParam = searchParams.get('courseId');
  const courseId = courseIdParam ? Number(courseIdParam) : null;

  const extension = usePluginExtension(lab.labType);

  // Same reactive pattern the code-lab runner uses: subscribing to viewAsRole
  // means "view as student" strips authoring powers, including on your own lab.
  const currentUser = useAuthStore((s) => s.user);
  useAuthStore((s) => s.viewAsRole);
  const { isAdmin, isInstructor } = useAuthStore((s) => s.getEffectiveRole)();
  const canEdit = !!currentUser && (isAdmin || (isInstructor && lab.createdBy === currentUser.id));

  const { data: course } = useQuery({
    queryKey: ['course', courseId == null ? null : String(courseId)],
    queryFn: () => coursesApi.getCourseById(courseId!),
    enabled: courseId != null,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Breadcrumb
          items={[
            ...(course
              ? [
                  { label: t('courses', { defaultValue: 'Courses' }), href: '/courses' },
                  { label: course.title, href: `/courses/${courseId}` },
                ]
              : [{ label: t('labs', { defaultValue: 'Labs' }), href: '/labs' }]),
            { label: lab.name },
          ]}
        />
      </div>

      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
          <Puzzle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          {lab.name}
        </h1>
        {lab.description && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{lab.description}</p>
        )}
        {extension && (
          <p className="mt-1 text-xs text-gray-500">
            {extension.label} · {extension.pluginName}
          </p>
        )}
      </header>

      <PluginSlot
        extensionKey={lab.labType}
        instance={{ kind: 'lab', id: lab.id }}
        courseId={courseId}
        editing={canEdit}
        fallback={
          <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center dark:border-gray-600">
            <p className="text-gray-500 dark:text-gray-400">
              {t('plugin_lab_missing', {
                defaultValue:
                  'This lab needs a plugin that is not currently available. Its saved work is untouched — ask an administrator to enable the plugin.',
              })}
            </p>
            <Link
              to="/labs"
              className="mt-4 inline-flex items-center gap-1 text-sm text-teal-600 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t('back_to_labs', { defaultValue: 'Back to labs' })}
            </Link>
          </div>
        }
      />
    </div>
  );
};

export default PluginLabRunner;
