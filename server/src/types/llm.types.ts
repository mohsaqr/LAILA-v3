// =============================================================================
// LLM PROVIDER TYPES - Comprehensive Type Definitions
// =============================================================================

// Provider Types
export type LLMProviderType = 'cloud' | 'local' | 'custom';

export type LLMProviderName =
  | 'openai'
  | 'gemini'
  | 'anthropic'
  | 'ollama'
  | 'lmstudio'
  | 'azure-openai'
  | 'openrouter'
  | 'together'
  | 'groq'
  | 'mistral'
  | 'cohere'
  | 'custom';

export type LLMModelType = 'chat' | 'completion' | 'embedding' | 'vision' | 'multimodal';

export type LLMHealthStatus = 'healthy' | 'unhealthy' | 'unknown' | 'checking';

export type LLMResponseFormat = 'text' | 'json' | 'json_object';

// =============================================================================
// PROVIDER CONFIGURATION INTERFACES
// =============================================================================

export interface LLMProviderConfig {
  // Identity
  id?: number;
  name: LLMProviderName;
  displayName: string;
  description?: string;
  providerType: LLMProviderType;
  isEnabled: boolean;
  isDefault: boolean;
  priority: number;

  // Connection
  baseUrl?: string;
  apiKey?: string;
  apiVersion?: string;
  organizationId?: string;
  projectId?: string;

  // Default Model
  defaultModel?: string;
  defaultModelId?: string;

  // Generation Defaults
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultTopP: number;
  defaultTopK?: number;
  defaultFrequencyPenalty: number;
  defaultPresencePenalty: number;
  defaultRepeatPenalty?: number;

  // Context & Limits
  maxContextLength?: number;
  maxOutputTokens?: number;
  defaultContextLength?: number;

  // Stop Sequences & Format
  defaultStopSequences?: string[];
  defaultResponseFormat?: LLMResponseFormat;

  // Timeout & Retry
  requestTimeout: number;
  connectTimeout: number;
  maxRetries: number;
  retryDelay: number;
  retryBackoffMultiplier: number;

  // Rate Limiting
  rateLimitRpm?: number;
  rateLimitTpm?: number;
  rateLimitRpd?: number;
  concurrencyLimit: number;

  // Streaming
  supportsStreaming: boolean;
  defaultStreaming: boolean;

  // Features
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsJsonMode: boolean;
  supportsSystemMessage: boolean;
  supportsMultipleSystemMessages: boolean;

  // Proxy & Network
  proxyUrl?: string;
  proxyUsername?: string;
  proxyPassword?: string;
  customHeaders?: Record<string, string>;

  // TLS
  skipTlsVerify: boolean;
  customCaCert?: string;

  // Health Check
  healthCheckEnabled: boolean;
  healthCheckInterval: number;
  lastHealthCheck?: Date;
  healthStatus?: LLMHealthStatus;
  lastError?: string;
  consecutiveFailures: number;

  // Usage
  totalRequests: number;
  totalTokensUsed: number;
  totalErrors: number;
  averageLatency?: number;

  // Metadata
  metadata?: Record<string, unknown>;
  notes?: string;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;

  // Relations
  models?: LLMModelConfig[];
}

export interface LLMModelConfig {
  id?: number;
  providerId: number;
  modelId: string;
  name: string;
  description?: string;

  modelType: LLMModelType;
  isEnabled: boolean;
  isDefault: boolean;

  contextLength?: number;
  maxOutputTokens?: number;

  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultTopP?: number;
  defaultTopK?: number;

  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsJsonMode: boolean;
  supportsStreaming: boolean;

  inputPricePer1M?: number;
  outputPricePer1M?: number;

  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;

  metadata?: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}

// =============================================================================
// REQUEST/RESPONSE INTERFACES
// =============================================================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | LLMContentPart[];
  name?: string;
  functionCall?: LLMFunctionCall;
  toolCalls?: LLMToolCall[];
}

export interface LLMContentPart {
  type: 'text' | 'image_url' | 'image_base64';
  text?: string;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
}

export interface LLMFunctionCall {
  name: string;
  arguments: string;
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: LLMFunctionCall;
}

export interface LLMCompletionRequest {
  // Required
  messages: LLMMessage[];

  // Optional - will use provider/model defaults if not specified
  model?: string;
  provider?: LLMProviderName;

  // Generation parameters - all optional, uses defaults
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repeatPenalty?: number;

  // Stop sequences
  stop?: string[];

  // Response format
  responseFormat?: LLMResponseFormat;

  // Streaming
  stream?: boolean;

  // Function/Tool calling
  functions?: LLMFunction[];
  tools?: LLMTool[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };

  // Seed for reproducibility
  seed?: number;

  // User identifier for rate limiting
  user?: string;

  // Metadata for logging
  metadata?: Record<string, unknown>;
}

export interface LLMFunction {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface LLMTool {
  type: 'function';
  function: LLMFunction;
}

export interface LLMCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  provider: LLMProviderName;

  choices: LLMChoice[];

  usage?: LLMUsage;

  // Timing
  responseTime: number;
  firstTokenTime?: number;

  // Metadata
  systemFingerprint?: string;
}

export interface LLMChoice {
  index: number;
  message: LLMMessage;
  finishReason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter' | null;
  logprobs?: unknown;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: LLMStreamChoice[];
}

export interface LLMStreamChoice {
  index: number;
  delta: Partial<LLMMessage>;
  finishReason: string | null;
}

// =============================================================================
// PROVIDER-SPECIFIC CONFIGURATIONS
// =============================================================================

export interface OpenAIProviderConfig {
  organization?: string;
  project?: string;
  baseUrl?: string;
}

export interface GeminiProviderConfig {
  projectId?: string;
  location?: string;
  safetySettings?: GeminiSafetySettings[];
}

export interface GeminiSafetySettings {
  category: string;
  threshold: string;
}

export interface OllamaProviderConfig {
  baseUrl: string;                    // Default: http://localhost:11434
  keepAlive?: string;                 // e.g., '5m', '1h', '-1' for indefinite
  numCtx?: number;                    // Context window size
  numGpu?: number;                    // Number of GPUs to use
  numThread?: number;                 // Number of threads
  repeatLastN?: number;               // How far back to look for repetitions
  seed?: number;                      // Random seed
  mirostat?: 0 | 1 | 2;              // Mirostat sampling
  mirostatEta?: number;              // Mirostat learning rate
  mirostatTau?: number;              // Mirostat target entropy
  numPredict?: number;               // Max tokens to predict
  tfsZ?: number;                     // Tail free sampling parameter
  typicalP?: number;                 // Typical p sampling
}

export interface LMStudioProviderConfig {
  baseUrl: string;                    // Default: http://localhost:1234/v1
  // LM Studio uses OpenAI-compatible API, so most settings are the same
}

export interface AzureOpenAIProviderConfig {
  resourceName: string;
  deploymentName: string;
  apiVersion: string;                 // e.g., '2024-02-15-preview'
}

export interface AnthropicProviderConfig {
  anthropicVersion?: string;          // e.g., '2023-06-01'
  maxTokensToSample?: number;
}

// =============================================================================
// PROVIDER DEFAULTS
// =============================================================================

export const PROVIDER_DEFAULTS: Record<LLMProviderName, Partial<LLMProviderConfig>> = {
  openai: {
    displayName: 'OpenAI',
    providerType: 'cloud',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    defaultTopP: 1.0,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    requestTimeout: 120000,
    connectTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffMultiplier: 2.0,
    concurrencyLimit: 10,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsJsonMode: true,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: false,
  },
  gemini: {
    displayName: 'Google Gemini',
    providerType: 'cloud',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-1.5-flash',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    defaultTopP: 0.95,
    defaultTopK: 40,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    requestTimeout: 120000,
    connectTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffMultiplier: 2.0,
    concurrencyLimit: 10,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsJsonMode: true,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: false,
  },
  anthropic: {
    displayName: 'Anthropic Claude',
    providerType: 'cloud',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    defaultTemperature: 0.7,
    defaultMaxTokens: 4096,
    defaultTopP: 1.0,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    requestTimeout: 120000,
    connectTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffMultiplier: 2.0,
    concurrencyLimit: 5,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsJsonMode: false,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: false,
  },
  ollama: {
    displayName: 'Ollama (Local)',
    providerType: 'local',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    defaultTopP: 0.9,
    defaultTopK: 40,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    defaultRepeatPenalty: 1.1,
    requestTimeout: 300000,
    connectTimeout: 10000,
    maxRetries: 2,
    retryDelay: 500,
    retryBackoffMultiplier: 1.5,
    concurrencyLimit: 2,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctionCalling: false,
    supportsJsonMode: true,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: true,
    skipTlsVerify: true,
  },
  lmstudio: {
    displayName: 'LM Studio (Local)',
    providerType: 'local',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    defaultTopP: 0.9,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    requestTimeout: 300000,
    connectTimeout: 10000,
    maxRetries: 2,
    retryDelay: 500,
    retryBackoffMultiplier: 1.5,
    concurrencyLimit: 1,
    supportsStreaming: true,
    supportsVision: false,
    supportsFunctionCalling: false,
    supportsJsonMode: false,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: true,
    skipTlsVerify: true,
  },
  'azure-openai': {
    displayName: 'Azure OpenAI',
    providerType: 'cloud',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    defaultTopP: 1.0,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    requestTimeout: 120000,
    connectTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffMultiplier: 2.0,
    concurrencyLimit: 10,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsJsonMode: true,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: false,
  },
  openrouter: {
    displayName: 'OpenRouter',
    providerType: 'cloud',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    defaultTopP: 1.0,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    requestTimeout: 120000,
    connectTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffMultiplier: 2.0,
    concurrencyLimit: 10,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsJsonMode: true,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: false,
  },
  together: {
    displayName: 'Together AI',
    providerType: 'cloud',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    defaultTopP: 0.9,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    requestTimeout: 120000,
    connectTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffMultiplier: 2.0,
    concurrencyLimit: 10,
    supportsStreaming: true,
    supportsVision: false,
    supportsFunctionCalling: false,
    supportsJsonMode: true,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: false,
  },
  groq: {
    displayName: 'Groq',
    providerType: 'cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    defaultTopP: 1.0,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    requestTimeout: 60000,
    connectTimeout: 10000,
    maxRetries: 3,
    retryDelay: 500,
    retryBackoffMultiplier: 2.0,
    concurrencyLimit: 10,
    supportsStreaming: true,
    supportsVision: false,
    supportsFunctionCalling: true,
    supportsJsonMode: true,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: false,
  },
  mistral: {
    displayName: 'Mistral AI',
    providerType: 'cloud',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    defaultTopP: 1.0,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    requestTimeout: 120000,
    connectTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffMultiplier: 2.0,
    concurrencyLimit: 10,
    supportsStreaming: true,
    supportsVision: false,
    supportsFunctionCalling: true,
    supportsJsonMode: true,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: false,
  },
  cohere: {
    displayName: 'Cohere',
    providerType: 'cloud',
    baseUrl: 'https://api.cohere.ai/v1',
    defaultModel: 'command-r-plus',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    defaultTopP: 0.75,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    requestTimeout: 120000,
    connectTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffMultiplier: 2.0,
    concurrencyLimit: 10,
    supportsStreaming: true,
    supportsVision: false,
    supportsFunctionCalling: false,
    supportsJsonMode: false,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: false,
  },
  custom: {
    displayName: 'Custom Provider',
    providerType: 'custom',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    defaultTopP: 1.0,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    requestTimeout: 120000,
    connectTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffMultiplier: 2.0,
    concurrencyLimit: 5,
    supportsStreaming: false,
    supportsVision: false,
    supportsFunctionCalling: false,
    supportsJsonMode: false,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: false,
  },
};

// =============================================================================
// COMMON MODELS BY PROVIDER
// =============================================================================

export const COMMON_MODELS: Record<LLMProviderName, Array<{ modelId: string; name: string; contextLength?: number }>> = {
  openai: [
    { modelId: 'gpt-4o', name: 'GPT-4o', contextLength: 128000 },
    { modelId: 'gpt-4o-mini', name: 'GPT-4o Mini', contextLength: 128000 },
    { modelId: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextLength: 128000 },
    { modelId: 'gpt-4', name: 'GPT-4', contextLength: 8192 },
    { modelId: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextLength: 16385 },
    { modelId: 'o1-preview', name: 'o1 Preview', contextLength: 128000 },
    { modelId: 'o1-mini', name: 'o1 Mini', contextLength: 128000 },
  ],
  gemini: [
    { modelId: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', contextLength: 1000000 },
    { modelId: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextLength: 2000000 },
    { modelId: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextLength: 1000000 },
    { modelId: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', contextLength: 32760 },
  ],
  anthropic: [
    { modelId: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextLength: 200000 },
    { modelId: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextLength: 200000 },
    { modelId: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextLength: 200000 },
  ],
  ollama: [
    { modelId: 'llama3.2', name: 'Llama 3.2', contextLength: 128000 },
    { modelId: 'llama3.2:1b', name: 'Llama 3.2 1B', contextLength: 128000 },
    { modelId: 'llama3.1', name: 'Llama 3.1', contextLength: 128000 },
    { modelId: 'mistral', name: 'Mistral 7B', contextLength: 32000 },
    { modelId: 'mixtral', name: 'Mixtral 8x7B', contextLength: 32000 },
    { modelId: 'codellama', name: 'Code Llama', contextLength: 16000 },
    { modelId: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', contextLength: 128000 },
    { modelId: 'qwen2.5', name: 'Qwen 2.5', contextLength: 128000 },
    { modelId: 'phi3', name: 'Phi-3', contextLength: 128000 },
    { modelId: 'gemma2', name: 'Gemma 2', contextLength: 8192 },
  ],
  lmstudio: [
    { modelId: 'local-model', name: 'Local Model (Auto-detect)', contextLength: 4096 },
  ],
  'azure-openai': [
    { modelId: 'gpt-4o', name: 'GPT-4o', contextLength: 128000 },
    { modelId: 'gpt-4o-mini', name: 'GPT-4o Mini', contextLength: 128000 },
    { modelId: 'gpt-4', name: 'GPT-4', contextLength: 8192 },
    { modelId: 'gpt-35-turbo', name: 'GPT-3.5 Turbo', contextLength: 16385 },
  ],
  openrouter: [
    { modelId: 'openai/gpt-4o', name: 'GPT-4o', contextLength: 128000 },
    { modelId: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', contextLength: 200000 },
    { modelId: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro', contextLength: 2000000 },
    { modelId: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', contextLength: 128000 },
  ],
  together: [
    { modelId: 'meta-llama/Llama-3.2-3B-Instruct-Turbo', name: 'Llama 3.2 3B Turbo', contextLength: 128000 },
    { modelId: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B Turbo', contextLength: 128000 },
    { modelId: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B', contextLength: 32000 },
  ],
  groq: [
    { modelId: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextLength: 128000 },
    { modelId: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', contextLength: 128000 },
    { modelId: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextLength: 32768 },
    { modelId: 'gemma2-9b-it', name: 'Gemma 2 9B', contextLength: 8192 },
  ],
  mistral: [
    { modelId: 'mistral-large-latest', name: 'Mistral Large', contextLength: 128000 },
    { modelId: 'mistral-small-latest', name: 'Mistral Small', contextLength: 32000 },
    { modelId: 'codestral-latest', name: 'Codestral', contextLength: 32000 },
    { modelId: 'open-mixtral-8x22b', name: 'Mixtral 8x22B', contextLength: 64000 },
  ],
  cohere: [
    { modelId: 'command-r-plus', name: 'Command R+', contextLength: 128000 },
    { modelId: 'command-r', name: 'Command R', contextLength: 128000 },
    { modelId: 'command', name: 'Command', contextLength: 4096 },
  ],
  custom: [],
};

// =============================================================================
// VALIDATION SCHEMAS (for Zod)
// =============================================================================

export interface LLMProviderCreateInput {
  name: LLMProviderName;
  displayName?: string;
  description?: string;
  isEnabled?: boolean;
  isDefault?: boolean;
  priority?: number;
  baseUrl?: string;
  apiKey?: string;
  apiVersion?: string;
  organizationId?: string;
  projectId?: string;
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultTopP?: number;
  defaultTopK?: number;
  defaultFrequencyPenalty?: number;
  defaultPresencePenalty?: number;
  defaultRepeatPenalty?: number;
  maxContextLength?: number;
  maxOutputTokens?: number;
  defaultStopSequences?: string[];
  defaultResponseFormat?: LLMResponseFormat;
  requestTimeout?: number;
  connectTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  retryBackoffMultiplier?: number;
  rateLimitRpm?: number;
  rateLimitTpm?: number;
  rateLimitRpd?: number;
  concurrencyLimit?: number;
  defaultStreaming?: boolean;
  proxyUrl?: string;
  proxyUsername?: string;
  proxyPassword?: string;
  customHeaders?: Record<string, string>;
  skipTlsVerify?: boolean;
  customCaCert?: string;
  healthCheckEnabled?: boolean;
  healthCheckInterval?: number;
  metadata?: Record<string, unknown>;
  notes?: string;
}

export interface LLMProviderUpdateInput extends Partial<LLMProviderCreateInput> {
  id: number;
}

export interface LLMModelCreateInput {
  providerId: number;
  modelId: string;
  name: string;
  description?: string;
  modelType?: LLMModelType;
  isEnabled?: boolean;
  isDefault?: boolean;
  contextLength?: number;
  maxOutputTokens?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultTopP?: number;
  defaultTopK?: number;
  supportsVision?: boolean;
  supportsFunctionCalling?: boolean;
  supportsJsonMode?: boolean;
  supportsStreaming?: boolean;
  inputPricePer1M?: number;
  outputPricePer1M?: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export class LLMError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: LLMProviderName,
    public statusCode?: number,
    public retryable: boolean = false,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export type LLMErrorCode =
  | 'PROVIDER_NOT_FOUND'
  | 'PROVIDER_NOT_ENABLED'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_NOT_ENABLED'
  | 'INVALID_API_KEY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CONTEXT_LENGTH_EXCEEDED'
  | 'CONTENT_FILTERED'
  | 'TIMEOUT'
  | 'CONNECTION_ERROR'
  | 'INVALID_REQUEST'
  | 'PROVIDER_ERROR'
  | 'UNSUPPORTED_PARAMETER'
  | 'UNKNOWN_ERROR';

// =============================================================================
// PARAMETER SUPPORT MATRIX
// =============================================================================

/**
 * Defines which parameters each provider/model supports.
 * Used to validate requests and reject unsupported parameters loudly.
 */
export interface ProviderParameterSupport {
  temperature: boolean;
  maxTokens: boolean;
  topP: boolean;
  topK: boolean;
  frequencyPenalty: boolean;
  presencePenalty: boolean;
  repeatPenalty: boolean;
  stop: boolean;
}

/**
 * Parameter support matrix for each provider.
 * 'openai-o1' is a special case for o1/o3 models which have restricted parameters.
 */
export const PARAMETER_SUPPORT: Record<string, ProviderParameterSupport> = {
  openai: {
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: false,
    frequencyPenalty: true,
    presencePenalty: true,
    repeatPenalty: false,
    stop: true,
  },
  'openai-o1': {
    // Special case for o1/o3 models - very restricted parameters
    temperature: false,
    maxTokens: true, // Uses max_completion_tokens instead
    topP: false,
    topK: false,
    frequencyPenalty: false,
    presencePenalty: false,
    repeatPenalty: false,
    stop: false,
  },
  'azure-openai': {
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: false,
    frequencyPenalty: true,
    presencePenalty: true,
    repeatPenalty: false,
    stop: true,
  },
  gemini: {
    temperature: true,
    maxTokens: true, // Maps to maxOutputTokens
    topP: true,
    topK: true,
    frequencyPenalty: false,
    presencePenalty: false,
    repeatPenalty: false,
    stop: true,
  },
  anthropic: {
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: true,
    frequencyPenalty: false,
    presencePenalty: false,
    repeatPenalty: false,
    stop: true,
  },
  ollama: {
    temperature: true,
    maxTokens: true, // Maps to num_predict
    topP: true,
    topK: true,
    frequencyPenalty: false,
    presencePenalty: false,
    repeatPenalty: true, // Ollama uses repeat_penalty instead
    stop: true,
  },
  openrouter: {
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: false,
    frequencyPenalty: true,
    presencePenalty: true,
    repeatPenalty: false,
    stop: true,
  },
  together: {
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: false,
    frequencyPenalty: true,
    presencePenalty: true,
    repeatPenalty: false,
    stop: true,
  },
  groq: {
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: false,
    frequencyPenalty: true,
    presencePenalty: true,
    repeatPenalty: false,
    stop: true,
  },
  mistral: {
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: false,
    frequencyPenalty: false,
    presencePenalty: false,
    repeatPenalty: false,
    stop: true,
  },
  lmstudio: {
    // LM Studio is OpenAI-compatible
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: false,
    frequencyPenalty: true,
    presencePenalty: true,
    repeatPenalty: false,
    stop: true,
  },
  cohere: {
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: true,
    frequencyPenalty: true,
    presencePenalty: true,
    repeatPenalty: false,
    stop: true,
  },
  custom: {
    // Custom providers: allow all, let the provider handle unsupported params
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: true,
    frequencyPenalty: true,
    presencePenalty: true,
    repeatPenalty: true,
    stop: true,
  },
};

/**
 * Get parameter support for a provider, with special handling for o1/o3 models.
 */
export function getParameterSupport(providerName: string, model?: string): ProviderParameterSupport {
  // Check for o1/o3 models first (they have restricted parameters)
  if (model && (model.startsWith('o1-') || model.startsWith('o3-'))) {
    return PARAMETER_SUPPORT['openai-o1'];
  }
  return PARAMETER_SUPPORT[providerName] || PARAMETER_SUPPORT['custom'];
}

/**
 * Human-readable provider names for error messages.
 */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  'openai-o1': 'OpenAI o1/o3 models',
  'azure-openai': 'Azure OpenAI',
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  ollama: 'Ollama',
  openrouter: 'OpenRouter',
  together: 'Together AI',
  groq: 'Groq',
  mistral: 'Mistral AI',
  lmstudio: 'LM Studio',
  cohere: 'Cohere',
  custom: 'Custom Provider',
};
