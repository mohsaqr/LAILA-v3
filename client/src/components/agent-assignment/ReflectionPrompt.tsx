/**
 * Reflection Prompt Component
 *
 * Displays contextual reflection prompts during the agent design process.
 * Supports both required and optional reflections.
 */

import { useState } from 'react';
import { MessageCircle, X, Send, Lightbulb } from 'lucide-react';
import { ReflectionPromptTrigger } from '../../types';
import { Button } from '../common/Button';

// Reflection prompts mapped to triggers
const REFLECTION_PROMPTS: Record<
  ReflectionPromptTrigger,
  { id: string; title: string; prompt: string; placeholder: string }
> = {
  role_selected: {
    id: 'role_selected',
    title: 'Role Selection Reflection',
    prompt: 'Why did you choose this role for your agent? How does it fit your learning goals?',
    placeholder: 'Share your reasoning for choosing this particular role...',
  },
  system_prompt_written: {
    id: 'system_prompt_written',
    title: 'System Prompt Reflection',
    prompt:
      'What specific behaviors do you want your agent to exhibit? How will you know if it\'s working well?',
    placeholder: 'Describe the key behaviors you designed for and how you\'ll evaluate them...',
  },
  first_test_completed: {
    id: 'first_test_completed',
    title: 'First Test Reflection',
    prompt: 'Did your agent behave as expected? What surprised you?',
    placeholder: 'Reflect on how your agent performed compared to your expectations...',
  },
  post_test_edit: {
    id: 'post_test_edit',
    title: 'Iteration Reflection',
    prompt: 'What did you learn from testing that led to this change?',
    placeholder: 'Explain what you discovered and how you\'re addressing it...',
  },
  before_submission: {
    id: 'before_submission',
    title: 'Final Design Reflection',
    prompt: 'Summarize the key design decisions you made and why.',
    placeholder: 'Describe your main design choices and the reasoning behind them...',
  },
};

interface ReflectionPromptProps {
  trigger: ReflectionPromptTrigger;
  required?: boolean;
  onSubmit: (promptId: string, response: string) => void;
  onDismiss: (promptId: string) => void;
  inline?: boolean;
}

export const ReflectionPrompt = ({
  trigger,
  required = false,
  onSubmit,
  onDismiss,
  inline = false,
}: ReflectionPromptProps) => {
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const promptConfig = REFLECTION_PROMPTS[trigger];
  if (!promptConfig) return null;

  const handleSubmit = () => {
    if (!response.trim()) return;
    setIsSubmitting(true);
    onSubmit(promptConfig.id, response.trim());
    setIsSubmitting(false);
  };

  const handleDismiss = () => {
    if (required) return;
    onDismiss(promptConfig.id);
  };

  const content = (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-violet-100 rounded-lg">
          <Lightbulb className="w-5 h-5 text-violet-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{promptConfig.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{promptConfig.prompt}</p>
        </div>
        {!required && (
          <button
            onClick={handleDismiss}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder={promptConfig.placeholder}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">
            {required ? 'Required to submit' : 'Optional reflection'}
          </span>
          <span className="text-xs text-gray-400">{response.length} characters</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {!required && (
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Skip
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!response.trim() || isSubmitting}
          loading={isSubmitting}
          icon={<Send className="w-4 h-4" />}
        >
          Submit Reflection
        </Button>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">{content}</div>
    );
  }

  // Modal-style overlay
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
        {content}
      </div>
    </div>
  );
};

// Inline prompt variant for embedding in forms
export const InlineReflectionPrompt = ({
  trigger,
  response,
  onChange,
  required = false,
}: {
  trigger: ReflectionPromptTrigger;
  response: string;
  onChange: (value: string) => void;
  required?: boolean;
}) => {
  const promptConfig = REFLECTION_PROMPTS[trigger];
  if (!promptConfig) return null;

  return (
    <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-1.5 bg-violet-100 rounded-lg">
          <MessageCircle className="w-4 h-4 text-violet-600" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-violet-900">{promptConfig.title}</h4>
          <p className="text-sm text-violet-700 mt-0.5">{promptConfig.prompt}</p>
        </div>
      </div>

      <textarea
        value={response}
        onChange={(e) => onChange(e.target.value)}
        placeholder={promptConfig.placeholder}
        rows={3}
        className="w-full px-3 py-2 bg-white border border-violet-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none"
      />

      <div className="flex items-center justify-between text-xs">
        <span className={required ? 'text-violet-700 font-medium' : 'text-violet-600'}>
          {required ? '* Required to submit' : 'Optional reflection'}
        </span>
        <span className="text-violet-600">{response.length} characters</span>
      </div>
    </div>
  );
};
