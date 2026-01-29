/**
 * Agent Behavior Tab Component
 *
 * Second tab of the enhanced agent builder containing:
 * - Personality style selector
 * - Personality prompt (editable)
 * - Response style selector
 * - Do's/Don'ts rules editor
 * - Suggested questions
 */

import { useState } from 'react';
import { Sparkles, MessageCircle, Plus, X } from 'lucide-react';
import { TextArea } from '../common/Input';
import { AgentConfigFormData, PersonalityType, ResponseStyleType } from '../../types';
import { PERSONALITY_PRESETS, RESPONSE_STYLES, getPersonalityById } from '../../config/pedagogicalRoles';
import { DosDoNtsEditor } from './DosDoNtsEditor';
import { AgentDesignLogger } from '../../services/agentDesignLogger';

interface AgentBehaviorTabProps {
  formData: AgentConfigFormData;
  disabled?: boolean;
  onChange: <K extends keyof AgentConfigFormData>(
    field: K,
    value: AgentConfigFormData[K]
  ) => void;
  logger?: AgentDesignLogger | null;
}

export const AgentBehaviorTab = ({
  formData,
  disabled = false,
  onChange,
  logger,
}: AgentBehaviorTabProps) => {
  const [newQuestion, setNewQuestion] = useState('');

  // Handle personality selection
  const handlePersonalitySelect = (personalityId: PersonalityType) => {
    const personality = getPersonalityById(personalityId);
    if (!personality) return;

    onChange('personality', personalityId);
    if (personalityId !== 'custom') {
      onChange('personalityPrompt', personality.prompt);
    }
    logger?.logPersonalitySelected(personalityId, personality.name);
  };

  // Handle response style selection
  const handleResponseStyleSelect = (styleId: ResponseStyleType) => {
    onChange('responseStyle', styleId);
    logger?.logFieldChange('responseStyle', formData.responseStyle || '', styleId);
  };

  // Handle suggested questions
  const handleAddQuestion = () => {
    if (!newQuestion.trim()) return;
    const questions = formData.suggestedQuestions || [];
    onChange('suggestedQuestions', [...questions, newQuestion.trim()]);
    setNewQuestion('');
    logger?.logFieldChange('suggestedQuestions', '', newQuestion.trim());
  };

  const handleRemoveQuestion = (index: number) => {
    const questions = formData.suggestedQuestions || [];
    const removed = questions[index];
    onChange(
      'suggestedQuestions',
      questions.filter((_, i) => i !== index)
    );
    logger?.logFieldChange('suggestedQuestions', removed, '');
  };

  // Handle rules changes with logging
  const handleDosChange = (rules: string[]) => {
    onChange('dosRules', rules);
  };

  const handleDontsChange = (rules: string[]) => {
    onChange('dontsRules', rules);
  };

  return (
    <div className="space-y-6">
      {/* Personality Style Selector */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <label className="text-sm font-medium text-gray-700">Personality Style</label>
        </div>
        <p className="text-sm text-gray-500">
          Choose how your agent communicates with users.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {PERSONALITY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePersonalitySelect(preset.id)}
              disabled={disabled}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                formData.personality === preset.id
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="font-medium text-sm text-gray-900">{preset.name}</div>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{preset.description}</p>
            </button>
          ))}
        </div>

        {/* Personality Prompt (editable) */}
        {formData.personality && (
          <div className="mt-3">
            <TextArea
              label="Personality Instructions"
              value={formData.personalityPrompt || ''}
              onChange={(e) => {
                onChange('personalityPrompt', e.target.value);
                if (formData.personality !== 'custom') {
                  // Switch to custom if they edit
                  onChange('personality', 'custom');
                }
              }}
              placeholder="Describe how your agent should communicate..."
              rows={3}
              disabled={disabled}
            />
            <p className="text-xs text-gray-500 mt-1">
              Customize these instructions to fine-tune your agent's communication style.
            </p>
          </div>
        )}
      </div>

      {/* Response Style Selector */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-violet-600" />
          <label className="text-sm font-medium text-gray-700">Response Style</label>
        </div>
        <p className="text-sm text-gray-500">
          How detailed should your agent's responses be?
        </p>

        <div className="flex gap-3">
          {RESPONSE_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => handleResponseStyleSelect(style.id)}
              disabled={disabled}
              className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                formData.responseStyle === style.id
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="font-medium text-sm text-gray-900">{style.name}</div>
              <p className="text-xs text-gray-500 mt-0.5">{style.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Behavioral Rules */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-1">Behavioral Rules</h3>
          <p className="text-sm text-gray-500">
            Define what your agent should and shouldn't do.
          </p>
        </div>
        <DosDoNtsEditor
          dosRules={formData.dosRules || []}
          dontsRules={formData.dontsRules || []}
          onDosChange={handleDosChange}
          onDontsChange={handleDontsChange}
          disabled={disabled}
        />
      </div>

      {/* Suggested Questions */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-1">Suggested Questions</h3>
          <p className="text-sm text-gray-500">
            Conversation starters that users can click to begin chatting.
          </p>
        </div>

        <div className="space-y-2">
          {(formData.suggestedQuestions || []).map((question, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-gray-50 rounded-lg p-2"
            >
              <span className="flex-1 text-sm text-gray-700">{question}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveQuestion(index)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {!disabled && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddQuestion();
                  }
                }}
                placeholder="Add a suggested question..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
              />
              <button
                type="button"
                onClick={handleAddQuestion}
                disabled={!newQuestion.trim()}
                className="px-3 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {(formData.suggestedQuestions?.length || 0) === 0 && (
          <p className="text-xs text-gray-400 italic">
            No suggested questions yet. Add some to help users start conversations.
          </p>
        )}
      </div>
    </div>
  );
};
