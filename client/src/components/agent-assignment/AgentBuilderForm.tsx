import { useState, useEffect } from 'react';
import { Bot, Image, MessageSquare } from 'lucide-react';
import { Input, TextArea } from '../common/Input';
import { Card, CardBody, CardHeader } from '../common/Card';
import { Button } from '../common/Button';
import { SystemPromptField } from './SystemPromptField';
import { DosDoNtsEditor } from './DosDoNtsEditor';
import { AgentConfigFormData, StudentAgentConfig } from '../../types';

interface AgentBuilderFormProps {
  initialData?: StudentAgentConfig | null;
  onSave: (data: AgentConfigFormData) => void;
  isSaving: boolean;
  disabled?: boolean;
}

export const AgentBuilderForm = ({
  initialData,
  onSave,
  isSaving,
  disabled = false,
}: AgentBuilderFormProps) => {
  const [formData, setFormData] = useState<AgentConfigFormData>({
    agentName: '',
    personaDescription: '',
    systemPrompt: '',
    dosRules: [],
    dontsRules: [],
    welcomeMessage: '',
    avatarImageUrl: null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with existing data
  useEffect(() => {
    if (initialData) {
      setFormData({
        agentName: initialData.agentName,
        personaDescription: initialData.personaDescription || '',
        systemPrompt: initialData.systemPrompt,
        dosRules: initialData.dosRules || [],
        dontsRules: initialData.dontsRules || [],
        welcomeMessage: initialData.welcomeMessage || '',
        avatarImageUrl: initialData.avatarImageUrl,
      });
    }
  }, [initialData]);

  const handleChange = <K extends keyof AgentConfigFormData>(
    field: K,
    value: AgentConfigFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is changed
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.agentName.trim()) {
      newErrors.agentName = 'Agent name is required';
    } else if (formData.agentName.length > 100) {
      newErrors.agentName = 'Agent name must be less than 100 characters';
    }

    if (!formData.systemPrompt.trim()) {
      newErrors.systemPrompt = 'System prompt is required';
    } else if (formData.systemPrompt.length < 10) {
      newErrors.systemPrompt = 'System prompt must be at least 10 characters';
    }

    if (formData.avatarImageUrl) {
      try {
        new URL(formData.avatarImageUrl);
      } catch {
        newErrors.avatarImageUrl = 'Please enter a valid URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-gray-900">Agent Identity</h2>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input
            label="Agent Name"
            value={formData.agentName}
            onChange={(e) => handleChange('agentName', e.target.value)}
            placeholder="E.g., Career Coach, Study Buddy, Writing Helper"
            error={errors.agentName}
            disabled={disabled}
            required
          />

          <TextArea
            label="Persona Description"
            value={formData.personaDescription}
            onChange={(e) => handleChange('personaDescription', e.target.value)}
            placeholder="A brief description of who your agent is (shown to users)"
            rows={2}
            disabled={disabled}
            helpText="This is a short intro that users will see when they start chatting."
          />

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
                    handleChange('avatarImageUrl', e.target.value || null)
                  }
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
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
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
            <p className="text-sm text-gray-500">
              Optional: Provide a URL to an image for your agent's avatar.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-gray-900">Agent Behavior</h2>
          </div>
        </CardHeader>
        <CardBody className="space-y-6">
          <SystemPromptField
            value={formData.systemPrompt}
            onChange={(value) => handleChange('systemPrompt', value)}
            error={errors.systemPrompt}
          />

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">
              Behavioral Rules (Optional)
            </h3>
            <DosDoNtsEditor
              dosRules={formData.dosRules || []}
              dontsRules={formData.dontsRules || []}
              onDosChange={(rules) => handleChange('dosRules', rules)}
              onDontsChange={(rules) => handleChange('dontsRules', rules)}
            />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <TextArea
              label="Welcome Message"
              value={formData.welcomeMessage}
              onChange={(e) => handleChange('welcomeMessage', e.target.value)}
              placeholder="Hi! I'm your career coach. How can I help you today?"
              rows={3}
              disabled={disabled}
              helpText="The first message your agent will send when starting a conversation."
            />
          </div>
        </CardBody>
      </Card>

      {/* Save Button */}
      {!disabled && (
        <div className="flex justify-end">
          <Button type="submit" loading={isSaving} size="lg">
            {initialData ? 'Save Changes' : 'Create Agent'}
          </Button>
        </div>
      )}
    </form>
  );
};
