import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, Users, FileText } from 'lucide-react';
import { SurveyResponsesData } from '../../types';
import { surveysApi } from '../../api/surveys';
import { Card, CardHeader, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { useTheme } from '../../hooks/useTheme';

export const SurveyResponses = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const { id: courseId, surveyId } = useParams<{ id: string; surveyId: string }>();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [data, setData] = useState<SurveyResponsesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'individual'>('summary');

  useEffect(() => {
    const fetchData = async () => {
      if (!surveyId) return;
      try {
        setLoading(true);
        const responses = await surveysApi.getResponses(parseInt(surveyId));
        setData(responses);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load responses');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [surveyId]);

  const handleExport = async () => {
    if (!surveyId) return;
    setExporting(true);
    try {
      const blob = await surveysApi.exportResponses(parseInt(surveyId));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `survey-${surveyId}-responses.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to export responses');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-red-600 dark:text-red-400 mb-4">{error || 'No data found'}</p>
            <Button onClick={() => navigate(-1)}>{t('common:go_back')}</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: t('teaching'), href: '/teach' },
          { label: t('surveys'), href: courseId ? `/teach/courses/${courseId}/surveys` : '/teach/surveys' },
          { label: t('responses') },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common:back')}
          </Button>
          <h1
            className="text-2xl font-bold"
            style={{ color: isDark ? '#f3f4f6' : '#111827' }}
          >
            {data.survey.title} - {t('responses')}
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <span
              className="flex items-center gap-1"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
            >
              <Users className="w-4 h-4" />
              {t('responses_stat', { count: data.totalResponses })}
            </span>
            {data.survey.isAnonymous && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                {t('anonymous_badge')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex rounded-lg overflow-hidden border"
            style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
          >
            <button
              onClick={() => setViewMode('summary')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'summary'
                  ? 'bg-blue-600 text-white'
                  : isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t('summary_view')}
            </button>
            <button
              onClick={() => setViewMode('individual')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'individual'
                  ? 'bg-blue-600 text-white'
                  : isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t('individual_view')}
            </button>
          </div>
          <Button onClick={handleExport} loading={exporting} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            {t('export_csv')}
          </Button>
        </div>
      </div>

      {data.totalResponses === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p
              className="text-lg"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
            >
              {t('no_responses_yet')}
            </p>
          </CardBody>
        </Card>
      ) : viewMode === 'summary' ? (
        <div className="space-y-6">
          {data.questionStats.map((stat, index) => (
            <Card key={stat.questionId}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className="text-sm font-medium"
                      style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                    >
                      {t('question_number', { number: index + 1 })}
                    </span>
                    <h3
                      className="font-semibold mt-1"
                      style={{ color: isDark ? '#f3f4f6' : '#111827' }}
                    >
                      {stat.questionText}
                    </h3>
                  </div>
                  <span
                    className="text-sm"
                    style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                  >
                    {t('responses_stat', { count: stat.totalResponses })}
                  </span>
                </div>
              </CardHeader>
              <CardBody>
                {stat.questionType === 'free_text' ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {stat.responses?.map((response, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg"
                        style={{
                          backgroundColor: isDark ? '#111827' : '#f9fafb',
                        }}
                      >
                        <p style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
                          {response}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stat.optionCounts &&
                      Object.entries(stat.optionCounts).map(([option, count]) => {
                        const percentage =
                          stat.totalResponses > 0
                            ? Math.round((count / stat.totalResponses) * 100)
                            : 0;
                        return (
                          <div key={option}>
                            <div className="flex items-center justify-between mb-1">
                              <span style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
                                {option}
                              </span>
                              <span
                                className="text-sm"
                                style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                              >
                                {count} ({percentage}%)
                              </span>
                            </div>
                            <div
                              className="h-3 rounded-full overflow-hidden"
                              style={{
                                backgroundColor: isDark ? '#374151' : '#e5e7eb',
                              }}
                            >
                              <div
                                className="h-full bg-blue-600 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {data.responses.map((response, index) => (
            <Card key={response.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className="text-sm font-medium"
                      style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                    >
                      Response #{index + 1}
                    </span>
                    {!data.survey.isAnonymous && response.user && (
                      <p
                        className="font-medium mt-1"
                        style={{ color: isDark ? '#f3f4f6' : '#111827' }}
                      >
                        {response.user.fullname}
                        <span
                          className="text-sm font-normal ml-2"
                          style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                        >
                          {response.user.email}
                        </span>
                      </p>
                    )}
                  </div>
                  <span
                    className="text-sm"
                    style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                  >
                    {new Date(response.completedAt).toLocaleString()}
                  </span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {response.answers.map((answer, answerIndex) => (
                    <div key={answer.id}>
                      <p
                        className="text-sm font-medium mb-1"
                        style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                      >
                        {answer.question?.questionText || `Question ${answerIndex + 1}`}
                      </p>
                      <p style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
                        {Array.isArray(answer.answerValue)
                          ? answer.answerValue.join(', ')
                          : answer.answerValue}
                      </p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
