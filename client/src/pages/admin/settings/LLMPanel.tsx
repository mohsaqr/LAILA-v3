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
import { llmApi, LLMProvider } from '../../../api/admin';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Loading } from '../../../components/common/Loading';
import { Modal } from '../../../components/common/Modal';
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

export const LLMPanel = () => {
  const queryClient = useQueryClient();
  const [expandedProvider, setExpandedProvider] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [formData, setFormData] = useState<ProviderFormData>(initialFormData);
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: providers, isLoading } = useQuery({
    queryKey: ['llmProviders'],
    queryFn: () => llmApi.getProviders(true),
  });

  const { data: defaults } = useQuery({
    queryKey: ['llmDefaults'],
    queryFn: () => llmApi.getDefaults(),
  });

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
      setShowAddModal(false);
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

  const handleProviderSelect = (name: string) => {
    const providerDefaults = defaults?.[name];
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
    const payload: Record<string, any> = { name: formData.name };
    if (formData.displayName) payload.displayName = formData.displayName;
    if (formData.baseUrl) payload.baseUrl = formData.baseUrl;
    if (formData.apiKey) payload.apiKey = formData.apiKey;
    if (formData.defaultModel) payload.defaultModel = formData.defaultModel;
    if (formData.defaultTemperature !== undefined) payload.defaultTemperature = formData.defaultTemperature;
    if (formData.defaultMaxTokens) payload.defaultMaxTokens = formData.defaultMaxTokens;
    if (formData.skipTlsVerify) payload.skipTlsVerify = formData.skipTlsVerify;

    if (editingProvider) {
      updateMutation.mutate({ id: editingProvider.id, data: payload as any });
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
      apiKey: '',
      defaultModel: provider.defaultModel || '',
      defaultTemperature: provider.defaultTemperature,
      defaultMaxTokens: provider.defaultMaxTokens,
      skipTlsVerify: provider.skipTlsVerify,
    });
    setShowAddModal(true);
  };

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'cloud': return <Cloud className="w-4 h-4" />;
      case 'local': return <Server className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getHealthIcon = (status?: string) => {
    switch (status) {
      case 'healthy': return <Check className="w-4 h-4 text-green-500" />;
      case 'unhealthy': return <X className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return <Loading text="Loading LLM providers..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">LLM Providers</h2>
          <p className="text-sm text-gray-500">{providers?.length || 0} configured providers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} loading={seedMutation.isPending}>
            <RefreshCw className="w-4 h-4 mr-1" /> Seed Defaults
          </Button>
          <Button size="sm" onClick={() => { setEditingProvider(null); setFormData(initialFormData); setShowAddModal(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Add Provider
          </Button>
        </div>
      </div>

      {/* Providers List */}
      <div className="space-y-3">
        {providers?.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <Bot className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No providers configured</h3>
            <p className="text-sm text-gray-500 mb-4">Add an LLM provider or seed the defaults to get started.</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()}>Seed Defaults</Button>
              <Button size="sm" onClick={() => setShowAddModal(true)}>Add Provider</Button>
            </div>
          </div>
        ) : (
          providers?.map((provider) => (
            <div key={provider.id} className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${!provider.isEnabled ? 'opacity-60' : ''}`}>
              {/* Provider Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedProvider(expandedProvider === provider.id ? null : provider.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${provider.providerType === 'local' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                    {getProviderIcon(provider.providerType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">{provider.displayName}</h3>
                      {provider.isDefault && (
                        <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded flex items-center gap-1">
                          <Star className="w-3 h-3" /> Default
                        </span>
                      )}
                      {!provider.isEnabled && (
                        <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">Disabled</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{provider.defaultModel || 'No default model'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    {getHealthIcon(provider.healthStatus)}
                    <span>{provider.totalRequests} req</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); testMutation.mutate(provider.id); }} className="p-1.5 hover:bg-gray-100 rounded" title="Test">
                      <Play className="w-4 h-4 text-gray-400" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(provider.id); }} className="p-1.5 hover:bg-gray-100 rounded" title={provider.isEnabled ? 'Disable' : 'Enable'}>
                      {provider.isEnabled ? <Power className="w-4 h-4 text-green-500" /> : <PowerOff className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); if (!provider.isDefault) setDefaultMutation.mutate(provider.id); }} className="p-1.5 hover:bg-gray-100 rounded" title={provider.isDefault ? 'Default' : 'Set as default'} disabled={provider.isDefault}>
                      {provider.isDefault ? <Star className="w-4 h-4 text-yellow-500" /> : <StarOff className="w-4 h-4 text-gray-400" />}
                    </button>
                    {expandedProvider === provider.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedProvider === provider.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Connection</h4>
                      <dl className="space-y-1">
                        <div className="flex justify-between"><dt className="text-gray-500">URL</dt><dd className="text-gray-900 font-mono text-xs truncate max-w-[150px]">{provider.baseUrl || '-'}</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500">API Key</dt><dd className="text-gray-900">{provider.apiKey ? '••••••' : 'Not set'}</dd></div>
                      </dl>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Defaults</h4>
                      <dl className="space-y-1">
                        <div className="flex justify-between"><dt className="text-gray-500">Temperature</dt><dd className="text-gray-900">{provider.defaultTemperature}</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500">Max Tokens</dt><dd className="text-gray-900">{provider.defaultMaxTokens}</dd></div>
                      </dl>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Capabilities</h4>
                      <div className="flex flex-wrap gap-1">
                        {provider.supportsStreaming && <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">Streaming</span>}
                        {provider.supportsVision && <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Vision</span>}
                        {provider.supportsFunctionCalling && <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Functions</span>}
                      </div>
                    </div>
                  </div>

                  {/* Models */}
                  {provider.models && provider.models.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-medium text-gray-500 uppercase">Models</h4>
                        <button onClick={() => seedModelsMutation.mutate(provider.id)} className="text-xs text-gray-500 hover:text-gray-700">
                          Seed Models
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {provider.models.map((model) => (
                          <span key={model.id} className={`px-2 py-0.5 text-xs rounded ${model.isDefault ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>
                            {model.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(provider)}>
                      <Settings className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => seedModelsMutation.mutate(provider.id)} loading={seedModelsMutation.isPending}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Seed Models
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => { if (confirm('Delete this provider?')) deleteMutation.mutate(provider.id); }}>
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingProvider(null); setFormData(initialFormData); }}
        title={editingProvider ? 'Edit Provider' : 'Add Provider'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingProvider && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Provider Type</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {PROVIDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleProviderSelect(option.value)}
                    className={`p-2 text-left border rounded-lg text-sm ${formData.name === option.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center gap-2">
                      {getProviderIcon(option.type)}
                      <span className="font-medium">{option.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Display Name" value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} placeholder="My OpenAI" />
            <Input label="Default Model" value={formData.defaultModel} onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })} placeholder="gpt-4o-mini" />
          </div>

          <Input label="Base URL" value={formData.baseUrl} onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder={editingProvider ? 'Leave empty to keep existing' : 'sk-...'}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 pr-10"
              />
              <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
              <input type="number" step="0.1" min="0" max="2" value={formData.defaultTemperature} onChange={(e) => setFormData({ ...formData, defaultTemperature: parseFloat(e.target.value) || 0.7 })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
              <input type="number" min="1" value={formData.defaultMaxTokens} onChange={(e) => setFormData({ ...formData, defaultMaxTokens: parseInt(e.target.value) || 2048 })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          {(formData.name === 'ollama' || formData.name === 'lmstudio') && (
            <label className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg text-sm">
              <input type="checkbox" checked={formData.skipTlsVerify} onChange={(e) => setFormData({ ...formData, skipTlsVerify: e.target.checked })} className="rounded border-gray-300" />
              Skip TLS verification (for local providers)
            </label>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={() => { setShowAddModal(false); setEditingProvider(null); setFormData(initialFormData); }}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending} disabled={!formData.name}>
              {editingProvider ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
