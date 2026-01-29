/**
 * Agent Identity Tab Component
 *
 * First tab of the enhanced agent builder containing:
 * - Pedagogical role selector
 * - Agent name
 * - Persona description
 * - Avatar URL
 * - Welcome message
 */

import { Bot, Image } from 'lucide-react';
import { Input, TextArea } from '../common/Input';
import { AgentConfigFormData, PedagogicalRoleConfig } from '../../types';
import { PedagogicalRoleSelector } from './PedagogicalRoleSelector';
import { AgentDesignLogger } from '../../services/agentDesignLogger';

interface AgentIdentityTabProps {
  formData: AgentConfigFormData;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: <K extends keyof AgentConfigFormData>(
    field: K,
    value: AgentConfigFormData[K]
  ) => void;
  onRoleSelect: (role: PedagogicalRoleConfig) => void;
  logger?: AgentDesignLogger | null;
}

export const AgentIdentityTab = ({
  formData,
  errors,
  disabled = false,
  onChange,
  onRoleSelect,
  logger,
}: AgentIdentityTabProps) => {
  const handleFieldFocus = (fieldName: string) => {
    logger?.logFieldFocus(fieldName);
  };

  const handleFieldBlur = (fieldName: string, value: string) => {
    logger?.logFieldBlur(fieldName, value);
  };

  const handleFieldChange = (
    fieldName: keyof AgentConfigFormData,
    value: string,
    previousValue: string
  ) => {
    onChange(fieldName, value as AgentConfigFormData[typeof fieldName]);
    if (value !== previousValue) {
      logger?.logFieldChange(fieldName, previousValue, value);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pedagogical Role Selector */}
      <PedagogicalRoleSelector
        selectedRole={formData.pedagogicalRole || null}
        onRoleSelect={onRoleSelect}
        disabled={disabled}
      />

      {/* Agent Name & Title */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Input
            label="Agent Name"
            value={formData.agentName}
            onChange={(e) => handleFieldChange('agentName', e.target.value, formData.agentName)}
            onFocus={() => handleFieldFocus('agentName')}
            onBlur={() => handleFieldBlur('agentName', formData.agentName)}
            placeholder="E.g., Maya, Sam, Alex"
            error={errors.agentName}
            disabled={disabled}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Give your agent a memorable name.
          </p>
        </div>
        <div>
          <Input
            label="Agent Title"
            value={formData.agentTitle || ''}
            onChange={(e) => handleFieldChange('agentTitle', e.target.value, formData.agentTitle || '')}
            onFocus={() => handleFieldFocus('agentTitle')}
            onBlur={() => handleFieldBlur('agentTitle', formData.agentTitle || '')}
            placeholder="E.g., Writing Coach, Study Buddy"
            disabled={disabled}
          />
          <p className="text-xs text-gray-500 mt-1">
            A role title for your agent.
          </p>
        </div>
      </div>

      {/* Persona Description */}
      <div>
        <TextArea
          label="Persona Description"
          value={formData.personaDescription || ''}
          onChange={(e) =>
            handleFieldChange('personaDescription', e.target.value, formData.personaDescription || '')
          }
          onFocus={() => handleFieldFocus('personaDescription')}
          onBlur={() => handleFieldBlur('personaDescription', formData.personaDescription || '')}
          placeholder="A brief description of who your agent is and what they do (shown to users)"
          rows={2}
          disabled={disabled}
        />
        <p className="text-xs text-gray-500 mt-1">
          This short intro helps users understand what your agent can help with.
        </p>
      </div>

      {/* Avatar URL */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          Avatar Image URL
        </label>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="url"
              value={formData.avatarImageUrl || ''}
              onChange={(e) =>
                handleFieldChange('avatarImageUrl', e.target.value || '', formData.avatarImageUrl || '')
              }
              onFocus={() => handleFieldFocus('avatarImageUrl')}
              onBlur={() => handleFieldBlur('avatarImageUrl', formData.avatarImageUrl || '')}
              placeholder="https://example.com/avatar.png"
              disabled={disabled}
              className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all ${
                errors.avatarImageUrl
                  ? 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
              }`}
            />
            {errors.avatarImageUrl && (
              <p className="text-sm text-red-500 mt-1">{errors.avatarImageUrl}</p>
            )}
          </div>
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 flex-shrink-0">
            {formData.avatarImageUrl ? (
              <img
                src={formData.avatarImageUrl}
                alt="Avatar preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Image className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Optional: Add a profile image for your agent. Use a direct image URL.
        </p>
      </div>

      {/* Welcome Message */}
      <div>
        <TextArea
          label="Welcome Message"
          value={formData.welcomeMessage || ''}
          onChange={(e) =>
            handleFieldChange('welcomeMessage', e.target.value, formData.welcomeMessage || '')
          }
          onFocus={() => handleFieldFocus('welcomeMessage')}
          onBlur={() => handleFieldBlur('welcomeMessage', formData.welcomeMessage || '')}
          placeholder="Hi! I'm here to help you learn. What would you like to explore today?"
          rows={3}
          disabled={disabled}
        />
        <p className="text-xs text-gray-500 mt-1">
          The first message your agent sends when a conversation starts.
        </p>
      </div>

      {/* Preview Card */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg border border-violet-200 p-4">
        <h3 className="text-sm font-medium text-violet-900 mb-3">Preview</h3>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-200 flex items-center justify-center overflow-hidden flex-shrink-0">
            {formData.avatarImageUrl ? (
              <img
                src={formData.avatarImageUrl}
                alt="Agent"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Bot className="w-5 h-5 text-violet-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-gray-900">
                {formData.agentName || 'Your Agent'}
              </span>
              {formData.agentTitle && (
                <span className="text-xs text-violet-600 font-medium">
                  {formData.agentTitle}
                </span>
              )}
            </div>
            {formData.personaDescription && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                {formData.personaDescription}
              </p>
            )}
            {formData.welcomeMessage && (
              <div className="mt-2 bg-white rounded-lg p-2 text-sm text-gray-700 border border-violet-100">
                {formData.welcomeMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
