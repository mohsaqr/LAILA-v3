// =============================================================================
// AI TUTORS TYPES
// =============================================================================

// Session types
export interface TutorSessionData {
  id: number;
  userId: number;
  mode: TutorMode;
  activeAgentId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TutorMode = 'manual' | 'router' | 'collaborative' | 'random';

// Conversation types
export interface TutorConversationData {
  id: number;
  sessionId: number;
  chatbotId: number;
  lastMessageAt: Date | null;
  messageCount: number;
  createdAt: Date;
}

export interface ConversationWithPreview extends TutorConversationData {
  chatbot: {
    id: number;
    name: string;
    displayName: string;
    description: string | null;
    avatarUrl: string | null;
    welcomeMessage: string | null;
    personality: string | null;
  };
  lastMessage?: {
    role: string;
    content: string;
    createdAt: Date;
  } | null;
}

// Message types
export interface TutorMessageData {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  aiModel?: string | null;
  aiProvider?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  responseTimeMs?: number | null;
  temperature?: number | null;
  routingReason?: string | null;
  routingConfidence?: number | null;
  synthesizedFrom?: string | null;
  createdAt: Date;
}

export interface TutorMessageResponse {
  userMessage: TutorMessageData;
  assistantMessage: TutorMessageData;
  routingInfo?: RoutingInfo;
  collaborativeInfo?: CollaborativeInfo;
}

// Router mode types
export interface RoutingInfo {
  selectedAgent: {
    id: number;
    name: string;
    displayName: string;
  };
  reason: string;
  confidence: number;
  alternatives?: Array<{
    agentId: number;
    agentName: string;
    score: number;
  }>;
}

// Collaborative mode types
export type CollaborativeStyle = 'parallel' | 'sequential' | 'debate' | 'random';

export interface CollaborativeSettings {
  style: CollaborativeStyle;
  selectedAgentIds?: number[]; // Specific agents to include
  maxAgents?: number; // Limit number of responders (default 3)
  maxResponseLength?: number; // Max chars per response (default 500)
  showIndividualResponses?: boolean; // Show each tutor's response
}

export interface AgentContribution {
  agentId: number;
  agentName: string;
  agentDisplayName: string;
  avatarUrl?: string | null;
  contribution: string;
  responseTimeMs: number;
  round?: number; // For debate/sequential modes
}

export interface CollaborativeInfo {
  style: CollaborativeStyle;
  agentContributions: AgentContribution[];
  synthesis?: string; // Optional synthesized response
  mentionedAgents?: string[];
  totalRounds?: number; // For debate mode
}

// Agent types
export interface TutorAgent {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  welcomeMessage: string | null;
  personality: string | null;
  temperature: number | null;
  systemPrompt: string;
  isActive: boolean;
}

// Session response types
export interface TutorSessionResponse {
  session: TutorSessionData;
  conversations: ConversationWithPreview[];
  agents: TutorAgent[];
}

// Logging types
export type TutorEventType =
  | 'session_start'
  | 'session_end'
  | 'mode_change'
  | 'agent_switch'
  | 'message_sent'
  | 'message_received'
  | 'conversation_clear'
  | 'error';

export interface TutorInteractionLogData {
  userId: number;
  sessionId?: number;
  conversationId?: number;
  messageId?: number;
  chatbotId?: number;
  chatbotName?: string;
  chatbotDisplayName?: string;
  eventType: TutorEventType;
  userMessage?: string;
  assistantMessage?: string;
  messageCharCount?: number;
  responseCharCount?: number;
  mode?: TutorMode;
  aiModel?: string;
  aiProvider?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  responseTimeMs?: number;
  routingReason?: string;
  routingConfidence?: number;
  routingAlternatives?: string;
  agentContributions?: string;
  errorMessage?: string;
  errorCode?: string;
  errorStack?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
}

// Request types
export interface SendMessageRequest {
  message: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  collaborativeSettings?: CollaborativeSettings;
}

export interface UpdateModeRequest {
  mode: TutorMode;
}

export interface SetActiveAgentRequest {
  chatbotId: number;
}
