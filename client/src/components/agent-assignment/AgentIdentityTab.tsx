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

import { useState, useRef } from 'react';
import { Bot, Image, Upload, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input, TextArea } from '../common/Input';
import { AgentConfigFormData, PedagogicalRoleConfig } from '../../types';
import { PedagogicalRoleSelector } from './PedagogicalRoleSelector';
import { AgentDesignLogger } from '../../services/agentDesignLogger';
import { uploadsApi } from '../../api/uploads';
import { resolveFileUrl } from '../../api/client';

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

const AvatarUpload = ({
  avatarUrl,
  disabled,
  onChange,
}: {
  avatarUrl: string | null;
  disabled: boolean;
  onChange: (url: string) => void;
}) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files (PNG, JPG) are allowed');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error('Image must be less than 1 MB');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadsApi.uploadAgentAvatar(file);
      onChange(result.url);
    } catch {
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const resolvedUrl = avatarUrl ? resolveFileUrl(avatarUrl) : null;

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">Avatar Image</label>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-gray-200 flex-shrink-0">
          {resolvedUrl ? (
            <img src={resolvedUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <Image className="w-6 h-6 text-gray-400" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Remove
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500">Optional. PNG or JPG, max 1 MB.</p>
    </div>
  );
};

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

      {/* Avatar Upload */}
      <AvatarUpload
        avatarUrl={formData.avatarImageUrl ?? null}
        disabled={disabled}
        onChange={(url) => handleFieldChange('avatarImageUrl', url, formData.avatarImageUrl || '')}
      />

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
