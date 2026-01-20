import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { TextArea } from '../common/Input';

interface SystemPromptFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const PROMPT_TIPS = [
  {
    title: 'Define the persona clearly',
    description: 'Start with "You are..." to establish identity. E.g., "You are a friendly career counselor with 10 years of experience."',
  },
  {
    title: 'Set the tone and style',
    description: 'Specify how the agent should communicate. E.g., "Speak in a warm, encouraging tone. Use simple language."',
  },
  {
    title: 'Define knowledge boundaries',
    description: 'Be clear about what the agent knows. E.g., "You specialize in tech careers and have knowledge up to 2024."',
  },
  {
    title: 'Add conversation guidelines',
    description: 'Include how to handle common scenarios. E.g., "Ask clarifying questions before giving advice."',
  },
  {
    title: 'Include example responses',
    description: 'Show the agent how to respond. E.g., "When asked about salary, respond with ranges and factors to consider."',
  },
];

const EXAMPLE_PROMPTS = [
  {
    title: 'Career Advisor',
    prompt: `You are a supportive career advisor helping students explore career options.

Your approach:
- Listen actively and ask thoughtful follow-up questions
- Provide balanced perspectives on different career paths
- Share practical tips based on industry knowledge
- Encourage self-reflection about interests and values

When giving advice:
- Consider the student's background and goals
- Suggest concrete next steps
- Be realistic but encouraging`,
  },
  {
    title: 'Study Buddy',
    prompt: `You are an encouraging study buddy helping students learn effectively.

Your style:
- Break down complex topics into simple parts
- Use analogies and real-world examples
- Ask questions to check understanding
- Celebrate progress and effort

Remember to:
- Be patient with confusion
- Offer multiple explanations if needed
- Suggest study techniques when helpful`,
  },
];

export const SystemPromptField = ({ value, onChange, error }: SystemPromptFieldProps) => {
  const [showTips, setShowTips] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const insertExample = (prompt: string) => {
    onChange(prompt);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          System Prompt <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={() => setShowTips(!showTips)}
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <HelpCircle className="w-4 h-4" />
          {showTips ? 'Hide tips' : 'Writing tips'}
        </button>
      </div>

      {showTips && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-blue-900 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Tips for writing a good system prompt
          </h4>
          <ul className="space-y-2">
            {PROMPT_TIPS.map((tip, index) => (
              <li key={index} className="text-sm">
                <span className="font-medium text-blue-800">{tip.title}:</span>{' '}
                <span className="text-blue-700">{tip.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe your agent's personality, knowledge, and how it should behave..."
        rows={8}
        error={error}
        helpText="This is the core instruction that defines how your agent behaves."
      />

      <div className="border border-gray-200 rounded-lg">
        <button
          type="button"
          onClick={() => setShowExamples(!showExamples)}
          className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
        >
          <span>Example prompts to get started</span>
          {showExamples ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showExamples && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            {EXAMPLE_PROMPTS.map((example, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-gray-900">{example.title}</h5>
                  <button
                    type="button"
                    onClick={() => insertExample(example.prompt)}
                    className="text-xs text-primary-600 hover:text-primary-700 px-2 py-1 border border-primary-300 rounded hover:bg-primary-50"
                  >
                    Use this
                  </button>
                </div>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white p-2 rounded border border-gray-200 max-h-32 overflow-y-auto">
                  {example.prompt}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
