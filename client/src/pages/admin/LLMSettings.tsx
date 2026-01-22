import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Settings,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Cloud,
  Server,
  Zap,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Play,
  Star,
  StarOff,
  Power,
  PowerOff,
} from 'lucide-react';
import { llmApi, LLMProvider } from '../../api/admin';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Loading } from '../../components/common/Loading';
import { Modal } from '../../components/common/Modal';
import toast from 'react-hot-toast';

interface ProviderFormData {
  name: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  skipTlsVerify: boolean;
}

const initialFormData: ProviderFormData = {
  name: '',
  displayName: '',
  baseUrl: '',
  apiKey: '',
  defaultModel: '',
  defaultTemperature: 0.7,
  defaultMaxTokens: 2048,
  skipTlsVerify: false,
};

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI', type: 'cloud' },
  { value: 'gemini', label: 'Google Gemini', type: 'cloud' },
  { value: 'anthropic', label: 'Anthropic Claude', type: 'cloud' },
  { value: 'ollama', label: 'Ollama (Local)', type: 'local' },
  { value: 'lmstudio', label: 'LM Studio (Local)', type: 'local' },
  { value: 'groq', label: 'Groq', type: 'cloud' },
  { value: 'mistral', label: 'Mistral AI', type: 'cloud' },
  { value: 'openrouter', label: 'OpenRouter', type: 'cloud' },
  { value: 'together', label: 'Together AI', type: 'cloud' },
  { value: 'azure-openai', label: 'Azure OpenAI', type: 'cloud' },
  { value: 'custom', label: 'Custom Provider', type: 'custom' },
];

export const LLMSettings = () => {
  const queryClient = useQueryClient();
  const [expandedProvider, setExpandedProvider] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [formData, setFormData] = useState<ProviderFormData>(initialFormData);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testMessage, setTestMessage] = useState('Hello! Can you briefly introduce yourself?');
  const [testResult, setTestResult] = useState<string | null>(null);

  // Queries
  const { data: providers, isLoading } = useQuery({
    queryKey: ['llmProviders'],
    queryFn: () => llmApi.getProviders(true),
  });

  const { data: defaults } = useQuery({
    queryKey: ['llmDefaults'],
    queryFn: () => llmApi.getDefaults(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: llmApi.createProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      setShowAddModal(false);
      setFormData(initialFormData);
      toast.success('Provider created');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create provider');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LLMProvider> }) =>
      llmApi.updateProvider(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      setEditingProvider(null);
      toast.success('Provider updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update provider');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: llmApi.deleteProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      toast.success('Provider deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete provider');
    },
  });

  const testMutation = useMutation({
    mutationFn: llmApi.testProvider,
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Connection successful (${data.latency}ms)`);
      } else {
        toast.error(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Connection test failed');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: llmApi.toggleProvider,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      toast.success(`Provider ${data.isEnabled ? 'enabled' : 'disabled'}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to toggle provider');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: llmApi.setDefaultProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      toast.success('Default provider updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to set default provider');
    },
  });

  const seedMutation = useMutation({
    mutationFn: llmApi.seedProviders,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      toast.success('Default providers seeded');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to seed providers');
    },
  });

  const seedModelsMutation = useMutation({
    mutationFn: llmApi.seedModels,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      toast.success('Models seeded');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to seed models');
    },
  });

  const testChatMutation = useMutation({
    mutationFn: ({ provider, model }: { provider?: string; model?: string }) =>
      llmApi.testChat(testMessage, provider, model),
    onSuccess: (data) => {
      setTestResult(data.choices[0]?.message?.content || 'No response');
      toast.success(`Response received (${data.responseTime}ms)`);
    },
    onError: (error: any) => {
      setTestResult(null);
      toast.error(error.message || 'Chat test failed');
    },
  });

  const handleProviderSelect = (name: string) => {
    const providerDefaults = defaults?.[name];

    // Default URLs for common providers
    const defaultUrls: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      gemini: 'https://generativelanguage.googleapis.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      ollama: 'http://localhost:11434',
      lmstudio: 'http://localhost:1234/v1',
      groq: 'https://api.groq.com/openai/v1',
      mistral: 'https://api.mistral.ai/v1',
      openrouter: 'https://openrouter.ai/api/v1',
      together: 'https://api.together.xyz/v1',
      'azure-openai': 'https://YOUR_RESOURCE.openai.azure.com',
    };

    // Default models for common providers
    const defaultModels: Record<string, string> = {
      openai: 'gpt-4o-mini',
      gemini: 'gemini-pro',
      anthropic: 'claude-3-haiku-20240307',
      ollama: 'llama2',
      lmstudio: 'local-model',
      groq: 'llama-3.1-8b-instant',
      mistral: 'mistral-small-latest',
      openrouter: 'openai/gpt-4o-mini',
      together: 'meta-llama/Llama-3-8b-chat-hf',
    };

    setFormData({
      ...initialFormData,
      name,
      displayName: providerDefaults?.displayName || PROVIDER_OPTIONS.find(p => p.value === name)?.label || name,
      baseUrl: providerDefaults?.baseUrl || defaultUrls[name] || '',
      defaultModel: providerDefaults?.defaultModel || defaultModels[name] || '',
      defaultTemperature: providerDefaults?.defaultTemperature ?? 0.7,
      defaultMaxTokens: providerDefaults?.defaultMaxTokens ?? 2048,
      skipTlsVerify: name === 'ollama' || name === 'lmstudio',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Only send non-empty values
    const payload: Record<string, any> = {
      name: formData.name,
    };

    if (formData.displayName) payload.displayName = formData.displayName;
    if (formData.baseUrl) payload.baseUrl = formData.baseUrl;
    if (formData.apiKey) payload.apiKey = formData.apiKey;
    if (formData.defaultModel) payload.defaultModel = formData.defaultModel;
    if (formData.defaultTemperature !== undefined) payload.defaultTemperature = formData.defaultTemperature;
    if (formData.defaultMaxTokens) payload.defaultMaxTokens = formData.defaultMaxTokens;
    if (formData.skipTlsVerify) payload.skipTlsVerify = formData.skipTlsVerify;

    if (editingProvider) {
      updateMutation.mutate({
        id: editingProvider.id,
        data: payload as any,
      });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const handleEdit = (provider: LLMProvider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      displayName: provider.displayName,
      baseUrl: provider.baseUrl || '',
      apiKey: '', // Don't prefill API key for security
      defaultModel: provider.defaultModel || '',
      defaultTemperature: provider.defaultTemperature,
      defaultMaxTokens: provider.defaultMaxTokens,
      skipTlsVerify: provider.skipTlsVerify,
    });
    setShowAddModal(true);
  };

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'cloud':
        return <Cloud className="w-4 h-4" />;
      case 'local':
        return <Server className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const getHealthIcon = (status?: string) => {
    switch (status) {
      case 'healthy':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'unhealthy':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return <Loading fullScreen text="Loading LLM settings..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary-500" />
            LLM Provider Settings
          </h1>
          <p className="text-gray-600 mt-1">
            Configure AI providers including OpenAI, Gemini, Ollama, and LM Studio
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => seedMutation.mutate()}
            loading={seedMutation.isPending}
          >
            Seed Defaults
          </Button>
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingProvider(null);
              setFormData(initialFormData);
              setShowAddModal(true);
            }}
          >
            Add Provider
          </Button>
        </div>
      </div>

      {/* Providers List */}
      <div className="space-y-4">
        {providers?.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No providers configured</h3>
              <p className="text-gray-500 mb-4">
                Get started by adding an LLM provider or seeding the defaults.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => seedMutation.mutate()}>
                  Seed Defaults
                </Button>
                <Button onClick={() => setShowAddModal(true)}>Add Provider</Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          providers?.map((provider) => (
            <Card key={provider.id} className={!provider.isEnabled ? 'opacity-60' : ''}>
              <CardBody className="p-0">
                {/* Provider Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() =>
                    setExpandedProvider(expandedProvider === provider.id ? null : provider.id)
                  }
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        provider.providerType === 'local'
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {getProviderIcon(provider.providerType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{provider.displayName}</h3>
                        {provider.isDefault && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" /> Default
                          </span>
                        )}
                        {!provider.isEnabled && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {provider.defaultModel || 'No default model'} · {provider.providerType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {getHealthIcon(provider.healthStatus)}
                      <span>
                        {provider.totalRequests} requests · {provider.totalTokensUsed} tokens
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          testMutation.mutate(provider.id);
                        }}
                        loading={testMutation.isPending}
                        title="Test connection"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMutation.mutate(provider.id);
                        }}
                        title={provider.isEnabled ? 'Disable' : 'Enable'}
                      >
                        {provider.isEnabled ? (
                          <Power className="w-4 h-4 text-green-500" />
                        ) : (
                          <PowerOff className="w-4 h-4 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!provider.isDefault) {
                            setDefaultMutation.mutate(provider.id);
                          }
                        }}
                        title={provider.isDefault ? 'Default provider' : 'Set as default'}
                        disabled={provider.isDefault}
                      >
                        {provider.isDefault ? (
                          <Star className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <StarOff className="w-4 h-4 text-gray-400" />
                        )}
                      </Button>
                      {expandedProvider === provider.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedProvider === provider.id && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Connection Settings */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Connection</h4>
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Base URL</dt>
                            <dd className="text-gray-900 font-mono text-xs">
                              {provider.baseUrl || '-'}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">API Key</dt>
                            <dd className="text-gray-900">
                              {provider.apiKey ? '••••••••' : 'Not set'}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Request Timeout</dt>
                            <dd className="text-gray-900">{provider.requestTimeout}ms</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Max Retries</dt>
                            <dd className="text-gray-900">{provider.maxRetries}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Generation Defaults */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Generation Defaults</h4>
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Temperature</dt>
                            <dd className="text-gray-900">{provider.defaultTemperature}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Max Tokens</dt>
                            <dd className="text-gray-900">{provider.defaultMaxTokens}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Top P</dt>
                            <dd className="text-gray-900">{provider.defaultTopP}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Frequency Penalty</dt>
                            <dd className="text-gray-900">{provider.defaultFrequencyPenalty}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Capabilities */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Capabilities</h4>
                        <div className="flex flex-wrap gap-2">
                          {provider.supportsStreaming && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                              Streaming
                            </span>
                          )}
                          {provider.supportsVision && (
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                              Vision
                            </span>
                          )}
                          {provider.supportsFunctionCalling && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                              Function Calling
                            </span>
                          )}
                          {provider.supportsJsonMode && (
                            <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded">
                              JSON Mode
                            </span>
                          )}
                        </div>
                        {provider.lastError && (
                          <div className="mt-4 p-2 bg-red-50 text-red-600 text-xs rounded">
                            Last error: {provider.lastError}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Models */}
                    {provider.models && provider.models.length > 0 && (
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900">Models</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => seedModelsMutation.mutate(provider.id)}
                            loading={seedModelsMutation.isPending}
                          >
                            Seed Common Models
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {provider.models.map((model) => (
                            <span
                              key={model.id}
                              className={`px-3 py-1 text-sm rounded-full ${
                                model.isDefault
                                  ? 'bg-primary-100 text-primary-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {model.name}
                              {model.contextLength && (
                                <span className="text-xs ml-1 opacity-60">
                                  ({Math.round(model.contextLength / 1000)}K)
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-6 flex gap-2 pt-4 border-t border-gray-200">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(provider)}>
                        <Settings className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => seedModelsMutation.mutate(provider.id)}
                        loading={seedModelsMutation.isPending}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" /> Seed Models
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this provider?')) {
                            deleteMutation.mutate(provider.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          ))
        )}
      </div>

      {/* Test Chat Section */}
      <Card className="mt-8">
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Test Chat</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Message</label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => testChatMutation.mutate({})}
                loading={testChatMutation.isPending}
              >
                Test Default Provider
              </Button>
              {providers?.filter((p) => p.isEnabled).map((provider) => (
                <Button
                  key={provider.id}
                  variant="outline"
                  onClick={() =>
                    testChatMutation.mutate({
                      provider: provider.name,
                      model: provider.defaultModel || undefined,
                    })
                  }
                  loading={testChatMutation.isPending}
                >
                  Test {provider.displayName}
                </Button>
              ))}
            </div>
            {testResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Response:</h4>
                <p className="text-gray-900 whitespace-pre-wrap">{testResult}</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Add/Edit Provider Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingProvider(null);
          setFormData(initialFormData);
        }}
        title={editingProvider ? 'Edit Provider' : 'Add Provider'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Provider Selection (only for new) */}
          {!editingProvider && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Provider Type</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PROVIDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleProviderSelect(option.value)}
                    className={`p-3 text-left border rounded-lg transition-colors ${
                      formData.name === option.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {getProviderIcon(option.type)}
                      <span className="font-medium text-sm">{option.label}</span>
                    </div>
                    <span className="text-xs text-gray-500 capitalize">{option.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Basic Settings */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Display Name"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="My OpenAI"
            />
            <Input
              label="Default Model"
              value={formData.defaultModel}
              onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })}
              placeholder="gpt-4o-mini"
            />
          </div>

          {/* Connection Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Connection</h4>
            <Input
              label="Base URL"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              placeholder={formData.name === 'ollama' ? 'http://localhost:11434' : formData.name === 'lmstudio' ? 'http://localhost:1234/v1' : 'https://api.openai.com/v1'}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder={editingProvider ? 'Leave empty to keep existing' : (formData.name === 'ollama' || formData.name === 'lmstudio') ? 'Not required for local' : 'sk-...'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Generation Defaults */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Defaults</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.defaultTemperature}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultTemperature: parseFloat(e.target.value) || 0.7 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
                <input
                  type="number"
                  min="1"
                  value={formData.defaultMaxTokens}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultMaxTokens: parseInt(e.target.value) || 2048 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Local Provider Options */}
          {(formData.name === 'ollama' || formData.name === 'lmstudio') && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
              <input
                type="checkbox"
                id="skipTlsVerify"
                checked={formData.skipTlsVerify}
                onChange={(e) => setFormData({ ...formData, skipTlsVerify: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="skipTlsVerify" className="text-sm text-gray-700">
                Skip TLS verification (recommended for local providers)
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setEditingProvider(null);
                setFormData(initialFormData);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={!formData.name}
            >
              {editingProvider ? 'Update Provider' : 'Create Provider'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
