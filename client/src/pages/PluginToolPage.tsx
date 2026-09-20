/**
 * A plugin's `course.tool` extension, rendered as a full page inside a course.
 *
 * Routed at `/courses/:courseId/t/:toolPath`. The path segment comes from the
 * manifest's `path`, so a plugin owns a stable URL its own links can point at
 * — which is the difference between a tool and a widget.
 *
 * Resolution is by `path` rather than by extension key, because the key is an
 * implementation detail no one should have to type into a URL.
 */

import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { usePluginExtensions } from '../plugins/usePluginExtensions';
import { PluginSlot } from '../plugins/PluginSlot';
import { Breadcrumb } from '../components/common/Breadcrumb';

export const PluginToolPage = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { courseId, toolPath } = useParams<{ courseId: string; toolPath: string }>();
  const tools = usePluginExtensions('course.tool');

  const tool = tools.find((x) => x.path === toolPath);
  const numericCourseId = courseId ? Number(courseId) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: t('courses', { defaultValue: 'Courses' }), href: '/courses' },
            {
              label: t('course', { defaultValue: 'Course' }),
              href: `/courses/${courseId}`,
            },
            { label: tool?.label ?? t('common:not_found', { defaultValue: 'Not found' }) },
          ]}
        />
      </div>

      {tool ? (
        <>
          <h1 className="mb-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {tool.label}
          </h1>
          {tool.description && (
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{tool.description}</p>
          )}
          <PluginSlot
            extensionKey={tool.key}
            // A tool is one instance per course, so the course is the placement
            // — not a section id, which a tool page does not have.
            instance={{ kind: 'tool', id: tool.path ?? tool.id }}
            courseId={numericCourseId}
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center dark:border-gray-600">
          <p className="text-gray-500 dark:text-gray-400">
            {t('plugin_tool_missing', {
              defaultValue:
                'This tool is not available. The plugin providing it may have been disabled or removed.',
            })}
          </p>
          <Link
            to={`/courses/${courseId}`}
            className="mt-4 inline-flex items-center gap-1 text-sm text-teal-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('back_to_course', { defaultValue: 'Back to the course' })}
          </Link>
        </div>
      )}
    </div>
  );
};

export default PluginToolPage;
