import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['admin', 'common']);
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
      toast.success(t('provider_created'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('failed_to_create_provider'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LLMProvider> }) =>
      llmApi.updateProvider(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      setEditingProvider(null);
      setShowAddModal(false);
      toast.success(t('provider_updated'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('failed_to_update_provider'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: llmApi.deleteProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      toast.success(t('provider_deleted'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('failed_to_delete_provider'));
    },
  });

  const testMutation = useMutation({
    mutationFn: llmApi.testProvider,
    onSuccess: (data) => {
      if (data.success) {
        toast.success(t('connection_successful_latency', { latency: data.latency }));
      } else {
        toast.error(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('connection_test_failed'));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: llmApi.toggleProvider,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      toast.success(data.isEnabled ? t('provider_enabled') : t('provider_disabled'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('failed_to_toggle_provider'));
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: llmApi.setDefaultProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      toast.success(t('default_provider_updated'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('failed_to_set_default'));
    },
  });

  const seedMutation = useMutation({
    mutationFn: llmApi.seedProviders,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      toast.success(t('default_providers_seeded'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('failed_to_seed_providers'));
    },
  });

  const seedModelsMutation = useMutation({
    mutationFn: llmApi.seedModels,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      toast.success(t('models_seeded'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('failed_to_seed_models'));
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
      default: return <AlertCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />;
    }
  };

  if (isLoading) {
    return <Loading text={t('loading_llm_providers')} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('llm_providers')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('configured_providers', { count: providers?.length || 0 })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} loading={seedMutation.isPending}>
            <RefreshCw className="w-4 h-4 mr-1" /> {t('seed_defaults')}
          </Button>
          <Button size="sm" onClick={() => { setEditingProvider(null); setFormData(initialFormData); setShowAddModal(true); }}>
            <Plus className="w-4 h-4 mr-1" /> {t('add_provider')}
          </Button>
        </div>
      </div>

      {/* Providers List */}
      <div className="space-y-3">
        {providers?.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
            <Bot className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{t('no_providers_configured')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('add_provider_or_seed')}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()}>{t('seed_defaults')}</Button>
              <Button size="sm" onClick={() => setShowAddModal(true)}>{t('add_provider')}</Button>
            </div>
          </div>
        ) : (
          providers?.map((provider) => (
            <div key={provider.id} className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${!provider.isEnabled ? 'opacity-60' : ''}`}>
              {/* Provider Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                onClick={() => setExpandedProvider(expandedProvider === provider.id ? null : provider.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${provider.providerType === 'local' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                    {getProviderIcon(provider.providerType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{provider.displayName}</h3>
                      {provider.isDefault && (
                        <span className="px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded flex items-center gap-1">
                          <Star className="w-3 h-3" /> {t('default_label')}
                        </span>
                      )}
                      {!provider.isEnabled && (
                        <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">{t('disabled_label')}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{provider.defaultModel || t('no_default_model')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {getHealthIcon(provider.healthStatus)}
                    <span>{provider.totalRequests} req</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); testMutation.mutate(provider.id); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title={t('test_connection')}>
                      <Play className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(provider.id); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title={provider.isEnabled ? t('disable') : t('enable')}>
                      {provider.isEnabled ? <Power className="w-4 h-4 text-green-500" /> : <PowerOff className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); if (!provider.isDefault) setDefaultMutation.mutate(provider.id); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title={provider.isDefault ? t('default_label') : t('set_as_default')} disabled={provider.isDefault}>
                      {provider.isDefault ? <Star className="w-4 h-4 text-yellow-500" /> : <StarOff className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                    </button>
                    {expandedProvider === provider.id ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedProvider === provider.id && (
                <div className="border-t border-gray-100 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">{t('connection')}</h4>
                      <dl className="space-y-1">
                        <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">{t('url')}</dt><dd className="text-gray-900 dark:text-gray-100 font-mono text-xs truncate max-w-[150px]">{provider.baseUrl || '-'}</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">{t('api_key')}</dt><dd className="text-gray-900 dark:text-gray-100">{provider.apiKey ? '••••••' : t('not_set')}</dd></div>
                      </dl>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">{t('defaults')}</h4>
                      <dl className="space-y-1">
                        <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">{t('temperature')}</dt><dd className="text-gray-900 dark:text-gray-100">{provider.defaultTemperature}</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">{t('max_tokens')}</dt><dd className="text-gray-900 dark:text-gray-100">{provider.defaultMaxTokens}</dd></div>
                      </dl>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">{t('capabilities')}</h4>
                      <div className="flex flex-wrap gap-1">
                        {provider.supportsStreaming && <span className="px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">{t('streaming')}</span>}
                        {provider.supportsVision && <span className="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">{t('vision')}</span>}
                        {provider.supportsFunctionCalling && <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">{t('functions')}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Models */}
                  {provider.models && provider.models.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('models')}</h4>
                        <button onClick={() => seedModelsMutation.mutate(provider.id)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                          {t('seed_models')}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {provider.models.map((model) => (
                          <span key={model.id} className={`px-2 py-0.5 text-xs rounded ${model.isDefault ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                            {model.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(provider)}>
                      <Settings className="w-3 h-3 mr-1" /> {t('common:edit')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => seedModelsMutation.mutate(provider.id)} loading={seedModelsMutation.isPending}>
                      <RefreshCw className="w-3 h-3 mr-1" /> {t('seed_models')}
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={() => { if (confirm(t('confirm_delete_provider'))) deleteMutation.mutate(provider.id); }}>
                      <Trash2 className="w-3 h-3 mr-1" /> {t('common:delete')}
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
        title={editingProvider ? t('edit_provider') : t('add_provider')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingProvider && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('provider_type')}</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {PROVIDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleProviderSelect(option.value)}
                    className={`p-2 text-left border rounded-lg text-sm ${formData.name === option.value ? 'border-gray-900 dark:border-gray-100 bg-gray-50 dark:bg-gray-700' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                  >
                    <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      {getProviderIcon(option.type)}
                      <span className="font-medium">{option.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label={t('display_name')} value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} placeholder="My OpenAI" />
            <Input label={t('default_model')} value={formData.defaultModel} onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })} placeholder="gpt-4o-mini" />
          </div>

          <Input label={t('base_url')} value={formData.baseUrl} onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('api_key')}</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder={editingProvider ? t('leave_empty_keep_existing') : 'sk-...'}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 pr-10"
              />
              <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('temperature')}</label>
              <input type="number" step="0.1" min="0" max="2" value={formData.defaultTemperature} onChange={(e) => setFormData({ ...formData, defaultTemperature: parseFloat(e.target.value) || 0.7 })} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('max_tokens')}</label>
              <input type="number" min="1" value={formData.defaultMaxTokens} onChange={(e) => setFormData({ ...formData, defaultMaxTokens: parseInt(e.target.value) || 2048 })} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100" />
            </div>
          </div>

          {(formData.name === 'ollama' || formData.name === 'lmstudio') && (
            <label className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm text-gray-900 dark:text-gray-100">
              <input type="checkbox" checked={formData.skipTlsVerify} onChange={(e) => setFormData({ ...formData, skipTlsVerify: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600" />
              {t('skip_tls_verification')}
            </label>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => { setShowAddModal(false); setEditingProvider(null); setFormData(initialFormData); }}>{t('common:cancel')}</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending} disabled={!formData.name}>
              {editingProvider ? t('common:update') : t('common:create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
