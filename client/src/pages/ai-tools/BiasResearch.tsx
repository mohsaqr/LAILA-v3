import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { chatApi } from '../../api/chat';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { TextArea, Select } from '../../components/common/Input';

const BIAS_TYPES = [
  { value: 'general', label: 'General Bias Analysis' },
  { value: 'gender', label: 'Gender Bias' },
  { value: 'racial', label: 'Racial/Ethnic Bias' },
  { value: 'cultural', label: 'Cultural Bias' },
  { value: 'confirmation', label: 'Confirmation Bias' },
  { value: 'selection', label: 'Selection Bias' },
];

interface BiasResult {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export const BiasResearch = () => {
  const [text, setText] = useState('');
  const [biasType, setBiasType] = useState('general');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<BiasResult[]>([]);
  const [summary, setSummary] = useState('');

  const handleAnalyze = async () => {
    if (!text.trim()) {
      toast.error('Please enter text to analyze');
      return;
    }

    setIsAnalyzing(true);
    setResults([]);
    setSummary('');

    try {
      const prompt = `You are an expert in detecting bias in academic and research texts. Analyze the following text for ${
        biasType === 'general' ? 'any type of bias' : `${biasType} bias`
      }.

TEXT TO ANALYZE:
"""
${text}
"""

Provide your analysis in the following JSON format:
{
  "summary": "A brief overall assessment of bias in the text",
  "biases": [
    {
      "type": "Type of bias detected",
      "severity": "low|medium|high",
      "description": "Specific description of the bias found",
      "suggestion": "How to address or mitigate this bias"
    }
  ]
}

If no significant bias is detected, return an empty biases array with an appropriate summary.`;

      const response = await chatApi.sendMessage({
        message: prompt,
        module: 'bias-research',
      });

      // Try to parse the JSON response
      try {
        const jsonMatch = response.reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setSummary(parsed.summary || '');
          setResults(parsed.biases || []);
        } else {
          setSummary(response.reply);
        }
      } catch {
        setSummary(response.reply);
      }
    } catch (error) {
      toast.error('Failed to analyze text');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link to="/ai-tools">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to AI Tools
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
          <Scale className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bias Research Platform</h1>
          <p className="text-gray-600">Analyze text for potential biases in academic research</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Text Analysis</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <Select
              label="Bias Type to Detect"
              value={biasType}
              onChange={e => setBiasType(e.target.value)}
              options={BIAS_TYPES}
            />

            <TextArea
              label="Text to Analyze"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste your research text, vignette, or survey question here..."
              rows={8}
            />

            <Button
              onClick={handleAnalyze}
              loading={isAnalyzing}
              icon={<Scale className="w-4 h-4" />}
            >
              Analyze for Bias
            </Button>
          </CardBody>
        </Card>

        {/* Results */}
        {(summary || results.length > 0) && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Analysis Results</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Summary */}
              {summary && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Summary</h3>
                  <p className="text-blue-800">{summary}</p>
                </div>
              )}

              {/* Individual Bias Results */}
              {results.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900">Detected Issues</h3>
                  {results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border ${getSeverityColor(result.severity)}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{result.type}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${getSeverityColor(
                            result.severity
                          )}`}
                        >
                          {result.severity}
                        </span>
                      </div>
                      <p className="text-sm mb-2">{result.description}</p>
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{result.suggestion}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                summary && (
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <p className="text-green-800">No significant bias detected in the text.</p>
                  </div>
                )
              )}
            </CardBody>
          </Card>
        )}

        {/* Info */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">About Bias Detection</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-600">
                <p className="mb-2">
                  This tool uses AI to help identify potential biases in text. It's designed to
                  assist researchers in creating more inclusive and balanced content.
                </p>
                <p>
                  <strong>Note:</strong> AI analysis should be used as a starting point for review,
                  not as a definitive assessment. Always apply human judgment and domain expertise.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
