import { SurveyQuestion as SurveyQuestionType } from '../../types';
import { useTheme } from '../../hooks/useTheme';

interface SurveyQuestionProps {
  question: SurveyQuestionType;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  error?: string;
  questionNumber: number;
}

export const SurveyQuestion = ({
  question,
  value,
  onChange,
  error,
  questionNumber,
}: SurveyQuestionProps) => {
  const { isDark } = useTheme();

  const handleSingleChoiceChange = (option: string) => {
    onChange(option);
  };

  const handleMultipleChoiceChange = (option: string, checked: boolean) => {
    const currentValue = Array.isArray(value) ? value : [];
    if (checked) {
      onChange([...currentValue, option]);
    } else {
      onChange(currentValue.filter(v => v !== option));
    }
  };

  const handleFreeTextChange = (text: string) => {
    onChange(text);
  };

  return (
    <div className="mb-6">
      <div className="mb-3">
        <span
          className="text-sm font-medium"
          style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
        >
          Question {questionNumber}
        </span>
        <p
          className="font-medium mt-1"
          style={{ color: isDark ? '#f3f4f6' : '#111827' }}
        >
          {question.questionText}
          {question.isRequired && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </p>
      </div>

      {question.questionType === 'single_choice' && question.options && (
        <div className="space-y-2">
          {question.options.map((option, index) => (
            <label
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
              style={{
                backgroundColor:
                  value === option
                    ? isDark
                      ? '#374151'
                      : '#eff6ff'
                    : isDark
                    ? '#1f2937'
                    : '#f9fafb',
                borderColor:
                  value === option
                    ? '#3b82f6'
                    : isDark
                    ? '#374151'
                    : '#e5e7eb',
                border: '1px solid',
              }}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={value === option}
                onChange={() => handleSingleChoiceChange(option)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
                {option}
              </span>
            </label>
          ))}
        </div>
      )}

      {question.questionType === 'multiple_choice' && question.options && (
        <div className="space-y-2">
          {question.options.map((option, index) => {
            const currentValues = Array.isArray(value) ? value : [];
            const isChecked = currentValues.includes(option);
            return (
              <label
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                style={{
                  backgroundColor: isChecked
                    ? isDark
                      ? '#374151'
                      : '#eff6ff'
                    : isDark
                    ? '#1f2937'
                    : '#f9fafb',
                  borderColor: isChecked
                    ? '#3b82f6'
                    : isDark
                    ? '#374151'
                    : '#e5e7eb',
                  border: '1px solid',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={e =>
                    handleMultipleChoiceChange(option, e.target.checked)
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
                  {option}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {question.questionType === 'free_text' && (
        <textarea
          value={typeof value === 'string' ? value : ''}
          onChange={e => handleFreeTextChange(e.target.value)}
          placeholder="Enter your response..."
          rows={4}
          className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
          style={{
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderColor: isDark ? '#374151' : '#d1d5db',
            color: isDark ? '#f3f4f6' : '#111827',
          }}
        />
      )}

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};
