// =============================================================================
// AI TUTORS TYPES (Frontend)
// =============================================================================

// Mode types
export type TutorMode = 'manual' | 'router' | 'collaborative' | 'random';

// Session types
export interface TutorSession {
  id: number;
  userId: number;
  mode: TutorMode;
  activeAgentId: number | null;
  createdAt: string;
  updatedAt: string;
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

// Conversation types
export interface TutorConversation {
  id: number;
  sessionId: number;
  chatbotId: number;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
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
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
  } | null;
}

// Message types
export interface TutorMessage {
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
  createdAt: string;
}

// Response types
export interface TutorSessionResponse {
  session: TutorSession;
  conversations: TutorConversation[];
  agents: TutorAgent[];
}

export interface TutorConversationWithMessages {
  id: number;
  sessionId: number;
  chatbotId: number;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
  messages: TutorMessage[];
}

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

// Collaborative mode styles
export type CollaborativeStyle = 'parallel' | 'sequential' | 'debate' | 'random';

export interface CollaborativeSettings {
  style: CollaborativeStyle;
  selectedAgentIds?: number[];
  maxAgents?: number;
  maxResponseLength?: number; // Max chars per response (default 500)
  showIndividualResponses?: boolean;
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
  synthesis?: string;
  mentionedAgents?: string[];
  totalRounds?: number;
}

export interface TutorMessageResponse {
  userMessage: TutorMessage;
  assistantMessage: TutorMessage;
  routingInfo?: RoutingInfo;
  collaborativeInfo?: CollaborativeInfo;
}

// Stats types
export interface TutorStats {
  totalSessions: number;
  totalMessages: number;
  messagesByMode: Array<{
    mode: TutorMode | null;
    count: number;
  }>;
  messagesByAgent: Array<{
    agent: string | null;
    count: number;
  }>;
  avgResponseTimeMs: number | null;
}

// Log types
export interface TutorInteractionLog {
  id: number;
  userId: number;
  sessionId: number | null;
  conversationId: number | null;
  messageId: number | null;
  chatbotId: number | null;
  chatbotName: string | null;
  chatbotDisplayName: string | null;
  eventType: string;
  userMessage: string | null;
  assistantMessage: string | null;
  messageCharCount: number | null;
  responseCharCount: number | null;
  mode: TutorMode | null;
  aiModel: string | null;
  aiProvider: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  responseTimeMs: number | null;
  routingReason: string | null;
  routingConfidence: number | null;
  routingAlternatives: string | null;
  agentContributions: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  errorStack: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceType: string | null;
  timestamp: string;
}
