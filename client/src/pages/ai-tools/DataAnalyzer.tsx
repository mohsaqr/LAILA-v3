import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BarChart3, Upload, FileSpreadsheet, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { chatApi } from '../../api/chat';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { TextArea, Select } from '../../components/common/Input';

const ANALYSIS_TYPES = [
  { value: 'descriptive', label: 'Descriptive Statistics' },
  { value: 'correlation', label: 'Correlation Analysis' },
  { value: 'trends', label: 'Trend Analysis' },
  { value: 'comparison', label: 'Group Comparison' },
  { value: 'interpretation', label: 'Results Interpretation' },
];

export const DataAnalyzer = () => {
  const { t } = useTranslation(['courses', 'common']);
  const [data, setData] = useState('');
  const [analysisType, setAnalysisType] = useState('descriptive');
  const [question, setQuestion] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState('');

  const handleAnalyze = async () => {
    if (!data.trim()) {
      toast.error('Please enter data to analyze');
      return;
    }

    setIsAnalyzing(true);
    setResult('');

    try {
      const analysisPrompts: Record<string, string> = {
        descriptive: `Calculate and explain descriptive statistics (mean, median, mode, standard deviation, range) for this data.`,
        correlation: `Analyze correlations between variables in this data. Identify strong, moderate, and weak relationships.`,
        trends: `Identify trends and patterns in this data. Look for increases, decreases, cycles, or anomalies.`,
        comparison: `Compare groups or categories in this data. Identify significant differences and similarities.`,
        interpretation: `Provide a comprehensive interpretation of these results in the context of research.`,
      };

      const prompt = `You are a statistical analysis expert. ${analysisPrompts[analysisType]}

DATA:
"""
${data}
"""

${question ? `SPECIFIC QUESTION: ${question}` : ''}

Provide:
1. Analysis results with specific numbers
2. Key findings and insights
3. Statistical significance (where applicable)
4. Limitations and caveats
5. Recommendations for further analysis

Format your response clearly with sections and bullet points.`;

      const response = await chatApi.analyzeData(data, prompt);
      setResult(response.reply);
    } catch (error) {
      toast.error('Failed to analyze data');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePasteSample = () => {
    setData(`Student ID, Pre-Test Score, Post-Test Score, Study Hours, Group
1, 65, 78, 10, Treatment
2, 72, 85, 12, Treatment
3, 58, 71, 8, Treatment
4, 80, 88, 15, Treatment
5, 45, 52, 5, Control
6, 68, 72, 7, Control
7, 55, 58, 6, Control
8, 77, 80, 9, Control
9, 62, 79, 11, Treatment
10, 70, 75, 8, Control`);
    toast.success('Sample data loaded');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link to="/ai-tools">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            {t('back_to_ai_tools')}
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('data_interpreter')}</h1>
          <p className="text-gray-600">{t('data_interpreter_desc')}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Input Section */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('data_input')}</h2>
            <Button variant="ghost" size="sm" onClick={handlePasteSample}>
              {t('load_sample_data')}
            </Button>
          </CardHeader>
          <CardBody className="space-y-4">
            <TextArea
              label={t('paste_your_data')}
              value={data}
              onChange={e => setData(e.target.value)}
              placeholder="Paste your data here in CSV format...

Example:
Student, Score, Group
1, 85, A
2, 72, B
..."
              rows={8}
              className="font-mono text-sm"
            />

            <Select
              label={t('analysis_type')}
              value={analysisType}
              onChange={e => setAnalysisType(e.target.value)}
              options={ANALYSIS_TYPES}
            />

            <TextArea
              label={t('specific_question')}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Any specific question about your data?"
              rows={2}
            />

            <Button
              onClick={handleAnalyze}
              loading={isAnalyzing}
              icon={<TrendingUp className="w-4 h-4" />}
            >
              {t('analyze_data')}
            </Button>
          </CardBody>
        </Card>

        {/* Results */}
        {result && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">{t('analysis_results')}</h2>
            </CardHeader>
            <CardBody>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded-lg text-sm font-sans">
                  {result}
                </pre>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Help */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">{t('data_format_tips')}</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{t('csv_format')}</p>
                  <p className="text-gray-600">{t('csv_format_desc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Upload className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{t('copy_from_excel')}</p>
                  <p className="text-gray-600">{t('copy_from_excel_desc')}</p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
