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
  MessageSquare,
  Send,
  Copy,
} from 'lucide-react';
import { llmApi, LLMProvider } from '../../../api/admin';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Loading } from '../../../components/common/Loading';
import { Modal } from '../../../components/common/Modal';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderFormData {
  provider: string;
  name: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  organizationId: string;
  apiVersion: string;
  // Generation
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultTopP: number;
  defaultFrequencyPenalty: number;
  defaultPresencePenalty: number;
  // Timeouts
  requestTimeout: number;
  connectTimeout: number;
  maxRetries: number;
  retryDelay: number;
  // Rate limiting
  rateLimitRpm: string;
  rateLimitTpm: string;
  concurrencyLimit: number;
  // Advanced
  skipTlsVerify: boolean;
  defaultResponseFormat: string;
  notes: string;
}

const initialFormData: ProviderFormData = {
  provider: '',
  name: '',
  displayName: '',
  baseUrl: '',
  apiKey: '',
  defaultModel: '',
  organizationId: '',
  apiVersion: '',
  defaultTemperature: 0.7,
  defaultMaxTokens: 2048,
  defaultTopP: 1.0,
  defaultFrequencyPenalty: 0,
  defaultPresencePenalty: 0,
  requestTimeout: 120000,
  connectTimeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  rateLimitRpm: '',
  rateLimitTpm: '',
  concurrencyLimit: 5,
  skipTlsVerify: false,
  defaultResponseFormat: '',
  notes: '',
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

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

const Section = ({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50">
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="p-3 space-y-3">{children}</div>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Number Input helper
// ---------------------------------------------------------------------------

const NumberInput = ({ label, value, onChange, ...props }: { label: string; value: number; onChange: (v: number) => void; step?: string; min?: string; max?: string; placeholder?: string }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
    <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100" {...props} />
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LLMPanel = () => {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const [expandedProvider, setExpandedProvider] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [formData, setFormData] = useState<ProviderFormData>(initialFormData);
  const [showApiKey, setShowApiKey] = useState(false);

  // Test chat state
  const [showTestChat, setShowTestChat] = useState(false);
  const [testMessage, setTestMessage] = useState('Hello! Can you briefly introduce yourself?');
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data: providers, isLoading } = useQuery({
    queryKey: ['llmProviders'],
    queryFn: () => llmApi.getProviders(true),
  });

  const { data: defaults } = useQuery({
    queryKey: ['llmDefaults'],
    queryFn: () => llmApi.getDefaults(),
  });

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

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

  const testChatMutation = useMutation({
    mutationFn: ({ provider, model }: { provider?: string; model?: string }) =>
      llmApi.testChat(testMessage, provider, model),
    onSuccess: (data) => {
      setTestResult(data.choices[0]?.message?.content || t('chat_response'));
    },
    onError: (error: any) => {
      setTestResult(null);
      toast.error(error.message || t('chat_test_failed'));
    },
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleProviderSelect = (providerType: string) => {
    const providerDefaults = defaults?.[providerType];
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
      provider: providerType,
      name: '', // auto-generated on server
      displayName: providerDefaults?.displayName || PROVIDER_OPTIONS.find(p => p.value === providerType)?.label || providerType,
      baseUrl: providerDefaults?.baseUrl || defaultUrls[providerType] || '',
      defaultModel: providerDefaults?.defaultModel || defaultModels[providerType] || '',
      defaultTemperature: providerDefaults?.defaultTemperature ?? 0.7,
      defaultMaxTokens: providerDefaults?.defaultMaxTokens ?? 2048,
      defaultTopP: providerDefaults?.defaultTopP ?? 1.0,
      skipTlsVerify: providerType === 'ollama' || providerType === 'lmstudio',
      requestTimeout: providerDefaults?.requestTimeout ?? 120000,
      connectTimeout: providerDefaults?.connectTimeout ?? 30000,
      maxRetries: providerDefaults?.maxRetries ?? 3,
      retryDelay: providerDefaults?.retryDelay ?? 1000,
      concurrencyLimit: providerDefaults?.concurrencyLimit ?? 5,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = {};

    if (editingProvider) {
      // Update: send only changed fields (no provider — immutable)
      if (formData.displayName) payload.displayName = formData.displayName;
      if (formData.baseUrl) payload.baseUrl = formData.baseUrl;
      if (formData.apiKey) payload.apiKey = formData.apiKey;
      if (formData.defaultModel) payload.defaultModel = formData.defaultModel;
      if (formData.organizationId) payload.organizationId = formData.organizationId;
      if (formData.apiVersion) payload.apiVersion = formData.apiVersion;
      payload.defaultTemperature = formData.defaultTemperature;
      payload.defaultMaxTokens = formData.defaultMaxTokens;
      payload.defaultTopP = formData.defaultTopP;
      payload.defaultFrequencyPenalty = formData.defaultFrequencyPenalty;
      payload.defaultPresencePenalty = formData.defaultPresencePenalty;
      payload.requestTimeout = formData.requestTimeout;
      payload.connectTimeout = formData.connectTimeout;
      payload.maxRetries = formData.maxRetries;
      payload.retryDelay = formData.retryDelay;
      if (formData.rateLimitRpm) payload.rateLimitRpm = parseInt(formData.rateLimitRpm);
      if (formData.rateLimitTpm) payload.rateLimitTpm = parseInt(formData.rateLimitTpm);
      payload.concurrencyLimit = formData.concurrencyLimit;
      payload.skipTlsVerify = formData.skipTlsVerify;
      if (formData.defaultResponseFormat) payload.defaultResponseFormat = formData.defaultResponseFormat;
      if (formData.notes) payload.notes = formData.notes;

      updateMutation.mutate({ id: editingProvider.id, data: payload as any });
    } else {
      // Create: send provider (required) + optional name slug
      payload.provider = formData.provider;
      if (formData.name) payload.name = formData.name;
      if (formData.displayName) payload.displayName = formData.displayName;
      if (formData.baseUrl) payload.baseUrl = formData.baseUrl;
      if (formData.apiKey) payload.apiKey = formData.apiKey;
      if (formData.defaultModel) payload.defaultModel = formData.defaultModel;
      if (formData.organizationId) payload.organizationId = formData.organizationId;
      if (formData.apiVersion) payload.apiVersion = formData.apiVersion;
      payload.defaultTemperature = formData.defaultTemperature;
      payload.defaultMaxTokens = formData.defaultMaxTokens;
      payload.defaultTopP = formData.defaultTopP;
      payload.defaultFrequencyPenalty = formData.defaultFrequencyPenalty;
      payload.defaultPresencePenalty = formData.defaultPresencePenalty;
      payload.requestTimeout = formData.requestTimeout;
      payload.connectTimeout = formData.connectTimeout;
      payload.maxRetries = formData.maxRetries;
      payload.retryDelay = formData.retryDelay;
      if (formData.rateLimitRpm) payload.rateLimitRpm = parseInt(formData.rateLimitRpm);
      if (formData.rateLimitTpm) payload.rateLimitTpm = parseInt(formData.rateLimitTpm);
      payload.concurrencyLimit = formData.concurrencyLimit;
      payload.skipTlsVerify = formData.skipTlsVerify;
      if (formData.defaultResponseFormat) payload.defaultResponseFormat = formData.defaultResponseFormat;
      if (formData.notes) payload.notes = formData.notes;

      createMutation.mutate(payload as any);
    }
  };

  const handleEdit = (provider: LLMProvider) => {
    setEditingProvider(provider);
    setFormData({
      provider: provider.provider || provider.name,
      name: provider.name,
      displayName: provider.displayName,
      baseUrl: provider.baseUrl || '',
      apiKey: '',
      defaultModel: provider.defaultModel || '',
      organizationId: (provider as any).organizationId || '',
      apiVersion: (provider as any).apiVersion || '',
      defaultTemperature: provider.defaultTemperature,
      defaultMaxTokens: provider.defaultMaxTokens,
      defaultTopP: provider.defaultTopP,
      defaultFrequencyPenalty: provider.defaultFrequencyPenalty,
      defaultPresencePenalty: provider.defaultPresencePenalty,
      requestTimeout: provider.requestTimeout,
      connectTimeout: provider.connectTimeout,
      maxRetries: provider.maxRetries,
      retryDelay: provider.retryDelay,
      rateLimitRpm: provider.rateLimitRpm?.toString() || '',
      rateLimitTpm: provider.rateLimitTpm?.toString() || '',
      concurrencyLimit: provider.concurrencyLimit,
      skipTlsVerify: provider.skipTlsVerify,
      defaultResponseFormat: (provider as any).defaultResponseFormat || '',
      notes: provider.notes || '',
    });
    setShowAddModal(true);
  };

  const handleDuplicate = (provider: LLMProvider) => {
    setEditingProvider(null); // create mode, not edit
    setFormData({
      provider: provider.provider || provider.name,
      name: '', // auto-generated on server
      displayName: provider.displayName + ' (Copy)',
      baseUrl: provider.baseUrl || '',
      apiKey: '', // never copy secrets
      defaultModel: provider.defaultModel || '',
      organizationId: (provider as any).organizationId || '',
      apiVersion: (provider as any).apiVersion || '',
      defaultTemperature: provider.defaultTemperature,
      defaultMaxTokens: provider.defaultMaxTokens,
      defaultTopP: provider.defaultTopP,
      defaultFrequencyPenalty: provider.defaultFrequencyPenalty,
      defaultPresencePenalty: provider.defaultPresencePenalty,
      requestTimeout: provider.requestTimeout,
      connectTimeout: provider.connectTimeout,
      maxRetries: provider.maxRetries,
      retryDelay: provider.retryDelay,
      rateLimitRpm: provider.rateLimitRpm?.toString() || '',
      rateLimitTpm: provider.rateLimitTpm?.toString() || '',
      concurrencyLimit: provider.concurrencyLimit,
      skipTlsVerify: provider.skipTlsVerify,
      defaultResponseFormat: (provider as any).defaultResponseFormat || '',
      notes: provider.notes || '',
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
          <Button variant="outline" size="sm" onClick={() => setShowTestChat(!showTestChat)}>
            <MessageSquare className="w-4 h-4 mr-1" /> {t('test_chat')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} loading={seedMutation.isPending}>
            <RefreshCw className="w-4 h-4 mr-1" /> {t('seed_defaults')}
          </Button>
          <Button size="sm" onClick={() => { setEditingProvider(null); setFormData(initialFormData); setShowAddModal(true); }}>
            <Plus className="w-4 h-4 mr-1" /> {t('add_provider')}
          </Button>
        </div>
      </div>

      {/* Test Chat Section */}
      {showTestChat && (
        <div className="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('test_chat')}</h3>
          <div className="space-y-3">
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder={t('test_message')}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
              rows={2}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => testChatMutation.mutate({})} loading={testChatMutation.isPending}>
                <Send className="w-3 h-3 mr-1" /> {t('test_default_provider')}
              </Button>
              {providers?.filter(p => p.isEnabled).map(provider => (
                <Button
                  key={provider.id}
                  variant="outline"
                  size="sm"
                  onClick={() => testChatMutation.mutate({ provider: provider.name, model: provider.defaultModel || undefined })}
                  loading={testChatMutation.isPending}
                >
                  {t('test_provider_name', { name: provider.displayName })}
                </Button>
              ))}
            </div>
            {testResult && (
              <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('response_received')}</h4>
                <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{testResult}</p>
              </div>
            )}
          </div>
        </div>
      )}

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
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-mono">{provider.provider || provider.name}</span>
                      {provider.provider && provider.name !== provider.provider && (
                        <span className="mx-1">·</span>
                      )}
                      {provider.provider && provider.name !== provider.provider && (
                        <span className="font-mono">{provider.name}</span>
                      )}
                      <span className="mx-1">·</span>
                      {provider.defaultModel || t('no_default_model')}
                    </p>
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
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">{t('connection_settings')}</h4>
                      <dl className="space-y-1">
                        <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">{t('url')}</dt><dd className="text-gray-900 dark:text-gray-100 font-mono text-xs truncate max-w-[150px]">{provider.baseUrl || '-'}</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">{t('api_key')}</dt><dd className="text-gray-900 dark:text-gray-100">{provider.apiKey ? '••••••' : t('not_set')}</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">{t('provider_type')}</dt><dd className="text-gray-900 dark:text-gray-100">{provider.provider || provider.name}</dd></div>
                      </dl>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">{t('generation_defaults')}</h4>
                      <dl className="space-y-1">
                        <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">{t('temperature')}</dt><dd className="text-gray-900 dark:text-gray-100">{provider.defaultTemperature}</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">{t('max_tokens')}</dt><dd className="text-gray-900 dark:text-gray-100">{provider.defaultMaxTokens}</dd></div>
                        <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">{t('top_p')}</dt><dd className="text-gray-900 dark:text-gray-100">{provider.defaultTopP}</dd></div>
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
                    <Button variant="outline" size="sm" onClick={() => handleDuplicate(provider)}>
                      <Copy className="w-3 h-3 mr-1" /> {t('duplicate')}
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
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Provider Type Selector (create only) */}
          {!editingProvider && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('provider_type')}</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {PROVIDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleProviderSelect(option.value)}
                    className={`p-2 text-left border rounded-lg text-sm ${formData.provider === option.value ? 'border-gray-900 dark:border-gray-100 bg-gray-50 dark:bg-gray-700' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
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

          {/* Identity Section */}
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('display_name')} value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} placeholder="My OpenAI" />
            <div>
              <Input label={t('provider_slug')} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t('provider_slug_hint')} />
              {!editingProvider && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('provider_slug_hint')}</p>}
            </div>
          </div>
          <Input label={t('default_model')} value={formData.defaultModel} onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })} placeholder="gpt-4o-mini" />

          {/* Connection Section */}
          <Section title={t('connection_settings')} defaultOpen={true}>
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
            {(formData.provider === 'openai' || formData.provider === 'azure-openai') && (
              <Input label={t('organization_id')} value={formData.organizationId} onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })} placeholder="org-..." />
            )}
            {formData.provider === 'azure-openai' && (
              <Input label={t('api_version')} value={formData.apiVersion} onChange={(e) => setFormData({ ...formData, apiVersion: e.target.value })} placeholder="2024-02-15-preview" />
            )}
          </Section>

          {/* Generation Defaults */}
          <Section title={t('generation_defaults')} defaultOpen={true}>
            <div className="grid grid-cols-3 gap-3">
              <NumberInput label={t('temperature')} value={formData.defaultTemperature} onChange={(v) => setFormData({ ...formData, defaultTemperature: v })} step="0.1" min="0" max="2" />
              <NumberInput label={t('max_tokens')} value={formData.defaultMaxTokens} onChange={(v) => setFormData({ ...formData, defaultMaxTokens: v })} min="1" />
              <NumberInput label={t('top_p')} value={formData.defaultTopP} onChange={(v) => setFormData({ ...formData, defaultTopP: v })} step="0.05" min="0" max="1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label={t('frequency_penalty')} value={formData.defaultFrequencyPenalty} onChange={(v) => setFormData({ ...formData, defaultFrequencyPenalty: v })} step="0.1" min="-2" max="2" />
              <NumberInput label={t('presence_penalty')} value={formData.defaultPresencePenalty} onChange={(v) => setFormData({ ...formData, defaultPresencePenalty: v })} step="0.1" min="-2" max="2" />
            </div>
          </Section>

          {/* Timeouts & Reliability */}
          <Section title={t('timeouts_reliability')}>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label={t('request_timeout')} value={formData.requestTimeout} onChange={(v) => setFormData({ ...formData, requestTimeout: v })} min="1000" />
              <NumberInput label={t('connect_timeout')} value={formData.connectTimeout} onChange={(v) => setFormData({ ...formData, connectTimeout: v })} min="1000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label={t('max_retries')} value={formData.maxRetries} onChange={(v) => setFormData({ ...formData, maxRetries: v })} min="0" max="10" />
              <NumberInput label={t('retry_delay')} value={formData.retryDelay} onChange={(v) => setFormData({ ...formData, retryDelay: v })} min="0" />
            </div>
          </Section>

          {/* Rate Limiting */}
          <Section title={t('rate_limiting')}>
            <div className="grid grid-cols-3 gap-3">
              <Input label={t('requests_per_minute')} value={formData.rateLimitRpm} onChange={(e) => setFormData({ ...formData, rateLimitRpm: e.target.value })} placeholder="-" />
              <Input label={t('tokens_per_minute')} value={formData.rateLimitTpm} onChange={(e) => setFormData({ ...formData, rateLimitTpm: e.target.value })} placeholder="-" />
              <NumberInput label={t('concurrency_limit')} value={formData.concurrencyLimit} onChange={(v) => setFormData({ ...formData, concurrencyLimit: v })} min="1" />
            </div>
          </Section>

          {/* Advanced */}
          <Section title={t('advanced_settings')}>
            {(formData.provider === 'ollama' || formData.provider === 'lmstudio') && (
              <label className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm text-gray-900 dark:text-gray-100">
                <input type="checkbox" checked={formData.skipTlsVerify} onChange={(e) => setFormData({ ...formData, skipTlsVerify: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600" />
                {t('skip_tls_verification')}
              </label>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('response_format')}</label>
              <select
                value={formData.defaultResponseFormat}
                onChange={(e) => setFormData({ ...formData, defaultResponseFormat: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
              >
                <option value="">{t('common:none')}</option>
                <option value="text">text</option>
                <option value="json">json</option>
                <option value="json_object">json_object</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
                rows={2}
                placeholder={t('notes')}
              />
            </div>
          </Section>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => { setShowAddModal(false); setEditingProvider(null); setFormData(initialFormData); }}>{t('common:cancel')}</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending} disabled={!editingProvider && !formData.provider}>
              {editingProvider ? t('common:update') : t('common:create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
