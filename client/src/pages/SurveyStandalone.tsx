import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SurveyEmbed } from '../components/survey';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { coursesApi } from '../api/courses';
import { surveysApi } from '../api/surveys';
import { useTheme } from '../hooks/useTheme';

export const SurveyStandalone = () => {
  const { t } = useTranslation(['courses', 'common', 'navigation']);
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { isDark } = useTheme();
  const surveyId = parseInt(id || '0');
  const moduleId = searchParams.get('moduleId') ? parseInt(searchParams.get('moduleId')!) : undefined;
  const courseId = searchParams.get('courseId') ? parseInt(searchParams.get('courseId')!) : undefined;

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId!),
    enabled: !!courseId,
  });

  const { data: survey } = useQuery({
    queryKey: ['survey', surveyId],
    queryFn: () => surveysApi.getSurveyById(surveyId),
    enabled: !!surveyId,
  });

  if (!surveyId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('invalid_survey')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('survey_not_found')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: isDark ? '#111827' : '#f9fafb' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(courseId || survey) && (
          <div className="mb-6">
            <Breadcrumb
              homeHref="/"
              items={[
                { label: t('navigation:courses'), href: '/courses' },
                ...(courseId && course
                  ? [{ label: course.title, href: `/courses/${courseId}` }]
                  : []),
                ...(survey ? [{ label: survey.title }] : []),
              ]}
            />
          </div>
        )}
        <SurveyEmbed
          surveyId={surveyId}
          context={moduleId ? 'module' : 'standalone'}
          moduleId={moduleId}
          showTitle={true}
        />
      </div>
    </div>
  );
};
