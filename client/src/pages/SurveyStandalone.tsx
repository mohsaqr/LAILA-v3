import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SurveyEmbed } from '../components/survey';
import { useTheme } from '../hooks/useTheme';

export const SurveyStandalone = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { id } = useParams<{ id: string }>();
  const { isDark } = useTheme();
  const surveyId = parseInt(id || '0');

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
      className="min-h-screen py-8 px-4"
      style={{ backgroundColor: isDark ? '#111827' : '#f9fafb' }}
    >
      <div className="max-w-2xl mx-auto">
        <SurveyEmbed
          surveyId={surveyId}
          context="standalone"
          showTitle={true}
        />
      </div>
    </div>
  );
};
