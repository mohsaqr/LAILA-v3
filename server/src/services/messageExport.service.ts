import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import prisma from '../utils/prisma.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface MessageExportFilters {
  startDate?: Date;
  endDate?: Date;
  systemType?: 'chatbot' | 'tutor' | 'agent';
  courseId?: number;
  userId?: number;
  page?: number;
  limit?: number;
}

export interface UnifiedMessage {
  id: string;
  timestamp: Date;
  systemType: 'chatbot' | 'tutor' | 'agent';
  sessionId: string | null;
  userId: number | null;
  userEmail: string | null;
  userFullname: string | null;
  role: string;
  content: string;
  courseId: number | null;
  courseTitle: string | null;
  moduleId: number | null;
  moduleTitle: string | null;
  lectureId: number | null;
  lectureTitle: string | null;
  sectionId: number | null;
  contextName: string | null;
  aiModel: string | null;
  aiProvider: string | null;
  temperature: number | null;
  maxTokens: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  responseTimeMs: number | null;
  systemPrompt: string | null;
  conversationId: number | null;
  messageIndex: number | null;
  routingReason: string | null;
  routingConfidence: number | null;
  synthesizedFrom: string | null;
  agentName: string | null;
  agentVersion: number | null;
  // Client context
  deviceType: string | null;
  browserName: string | null;
  ipAddress: string | null;
}

export interface MessageStats {
  total: number;
  chatbot: number;
  tutor: number;
  agent: number;
  uniqueUsers: number;
  avgResponseTimeMs: number | null;
  totalTokens: number;
  byModel: Array<{ model: string; count: number }>;
  byCourse: Array<{ courseId: number; courseTitle: string; count: number }>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTimestamp(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toISOString();
}

function formatTimestampReadable(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ============================================================================
// MESSAGE EXPORT SERVICE
// ============================================================================

export class MessageExportService {
  /**
   * Get unified messages from all 3 systems with full context
   */
  async getUnifiedMessages(filters: MessageExportFilters = {}): Promise<{
    messages: UnifiedMessage[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;

    // Build date filters
    const dateFilter = this.buildDateFilter(filters);

    // Get messages from all 3 systems in parallel (or just one if filtered)
    const [chatbotMessages, tutorMessages, agentMessages] = await Promise.all([
      (!filters.systemType || filters.systemType === 'chatbot')
        ? this.getChatbotMessages(filters, dateFilter)
        : [],
      (!filters.systemType || filters.systemType === 'tutor')
        ? this.getTutorMessages(filters, dateFilter)
        : [],
      (!filters.systemType || filters.systemType === 'agent')
        ? this.getAgentMessages(filters, dateFilter)
        : [],
    ]);

    // Combine and sort by timestamp descending
    let allMessages = [
      ...chatbotMessages,
      ...tutorMessages,
      ...agentMessages,
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = allMessages.length;

    // Apply pagination
    const offset = (page - 1) * limit;
    allMessages = allMessages.slice(offset, offset + limit);

    return {
      messages: allMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get statistics across all message systems
   */
  async getStats(filters: MessageExportFilters = {}): Promise<MessageStats> {
    const dateFilter = this.buildDateFilter(filters);

    // Get counts from all 3 systems
    const [chatbotCount, tutorCount, agentCount] = await Promise.all([
      this.getChatbotMessageCount(filters, dateFilter),
      this.getTutorMessageCount(filters, dateFilter),
      this.getAgentMessageCount(filters, dateFilter),
    ]);

    // Get unique user count
    const [chatbotUsers, tutorUsers, agentUsers] = await Promise.all([
      this.getChatbotUniqueUsers(filters, dateFilter),
      this.getTutorUniqueUsers(filters, dateFilter),
      this.getAgentUniqueUsers(filters, dateFilter),
    ]);

    const uniqueUserIds = new Set([...chatbotUsers, ...tutorUsers, ...agentUsers]);

    // Get token and response time stats
    const [chatbotStats, tutorStats, agentStats] = await Promise.all([
      this.getChatbotStats(filters, dateFilter),
      this.getTutorStats(filters, dateFilter),
      this.getAgentStats(filters, dateFilter),
    ]);

    const totalTokens = (chatbotStats.totalTokens || 0) + (tutorStats.totalTokens || 0) + (agentStats.totalTokens || 0);

    // Calculate weighted average response time
    const totalResponses = (chatbotStats.responseCount || 0) + (tutorStats.responseCount || 0) + (agentStats.responseCount || 0);
    const totalResponseTime =
      (chatbotStats.totalResponseTime || 0) +
      (tutorStats.totalResponseTime || 0) +
      (agentStats.totalResponseTime || 0);
    const avgResponseTimeMs = totalResponses > 0 ? totalResponseTime / totalResponses : null;

    // Get by model stats
    const byModel = await this.getModelStats(filters, dateFilter);

    // Get by course stats
    const byCourse = await this.getCourseStats(filters, dateFilter);

    return {
      total: chatbotCount + tutorCount + agentCount,
      chatbot: chatbotCount,
      tutor: tutorCount,
      agent: agentCount,
      uniqueUsers: uniqueUserIds.size,
      avgResponseTimeMs,
      totalTokens,
      byModel,
      byCourse,
    };
  }

  /**
   * Export unified messages to CSV
   */
  async exportCSV(filters: MessageExportFilters = {}): Promise<string> {
    // Get all messages without pagination for export
    const allFilters = { ...filters, page: 1, limit: 1000000 };
    const { messages } = await this.getUnifiedMessages(allFilters);

    const data = messages.map(msg => ({
      id: msg.id,
      timestamp: formatTimestamp(msg.timestamp),
      timestamp_readable: formatTimestampReadable(msg.timestamp),
      system_type: msg.systemType,
      session_id: msg.sessionId || '',
      user_id: msg.userId || '',
      user_email: msg.userEmail || '',
      user_fullname: msg.userFullname || '',
      role: msg.role,
      content: msg.content,
      course_id: msg.courseId || '',
      course_title: msg.courseTitle || '',
      module_id: msg.moduleId || '',
      module_title: msg.moduleTitle || '',
      lecture_id: msg.lectureId || '',
      lecture_title: msg.lectureTitle || '',
      section_id: msg.sectionId || '',
      context_name: msg.contextName || '',
      ai_model: msg.aiModel || '',
      ai_provider: msg.aiProvider || '',
      temperature: msg.temperature ?? '',
      max_tokens: msg.maxTokens ?? '',
      prompt_tokens: msg.promptTokens ?? '',
      completion_tokens: msg.completionTokens ?? '',
      total_tokens: msg.totalTokens ?? '',
      response_time_ms: msg.responseTimeMs ?? '',
      system_prompt: msg.systemPrompt || '',
      conversation_id: msg.conversationId || '',
      message_index: msg.messageIndex ?? '',
      routing_reason: msg.routingReason || '',
      routing_confidence: msg.routingConfidence ?? '',
      synthesized_from: msg.synthesizedFrom || '',
      agent_name: msg.agentName || '',
      agent_version: msg.agentVersion ?? '',
      device_type: msg.deviceType || '',
      browser_name: msg.browserName || '',
      ip_address: msg.ipAddress || '',
    }));

    return stringify(data, { header: true });
  }

  /**
   * Export unified messages to Excel with multiple sheets
   */
  async exportExcel(filters: MessageExportFilters = {}): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LAILA Message Export';
    workbook.created = new Date();

    // Get all messages for each system
    const chatbotFilters = { ...filters, systemType: 'chatbot' as const, page: 1, limit: 1000000 };
    const tutorFilters = { ...filters, systemType: 'tutor' as const, page: 1, limit: 1000000 };
    const agentFilters = { ...filters, systemType: 'agent' as const, page: 1, limit: 1000000 };
    const allFilters = { ...filters, page: 1, limit: 1000000 };

    const [allMessages, chatbotMessages, tutorMessages, agentMessages, stats] = await Promise.all([
      this.getUnifiedMessages(allFilters),
      this.getUnifiedMessages(chatbotFilters),
      this.getUnifiedMessages(tutorFilters),
      this.getUnifiedMessages(agentFilters),
      this.getStats(filters),
    ]);

    // Sheet 1: All Messages (unified view)
    const allSheet = workbook.addWorksheet('All Messages');
    allSheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'System', key: 'systemType', width: 10 },
      { header: 'Session ID', key: 'sessionId', width: 20 },
      { header: 'Conversation ID', key: 'conversationId', width: 15 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'User Name', key: 'userFullname', width: 20 },
      { header: 'Role', key: 'role', width: 10 },
      { header: 'Content', key: 'content', width: 60 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Course', key: 'courseTitle', width: 25 },
      { header: 'Module ID', key: 'moduleId', width: 10 },
      { header: 'Module', key: 'moduleTitle', width: 20 },
      { header: 'Lecture ID', key: 'lectureId', width: 10 },
      { header: 'Lecture', key: 'lectureTitle', width: 20 },
      { header: 'Section ID', key: 'sectionId', width: 10 },
      { header: 'Context/Chatbot', key: 'contextName', width: 20 },
      { header: 'AI Model', key: 'aiModel', width: 20 },
      { header: 'AI Provider', key: 'aiProvider', width: 15 },
      { header: 'Temperature', key: 'temperature', width: 12 },
      { header: 'Prompt Tokens', key: 'promptTokens', width: 12 },
      { header: 'Completion Tokens', key: 'completionTokens', width: 15 },
      { header: 'Total Tokens', key: 'totalTokens', width: 12 },
      { header: 'Response Time (ms)', key: 'responseTimeMs', width: 15 },
      { header: 'System Prompt', key: 'systemPrompt', width: 50 },
      { header: 'Device Type', key: 'deviceType', width: 12 },
      { header: 'Browser', key: 'browserName', width: 15 },
      { header: 'IP Address', key: 'ipAddress', width: 15 },
    ];
    allMessages.messages.forEach(msg => {
      allSheet.addRow({
        ...msg,
        timestamp: formatTimestampReadable(msg.timestamp),
      });
    });

    // Sheet 2: Chatbot Messages
    const chatbotSheet = workbook.addWorksheet('Chatbot Messages');
    chatbotSheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Session ID', key: 'sessionId', width: 20 },
      { header: 'Conversation ID', key: 'conversationId', width: 15 },
      { header: 'Message Index', key: 'messageIndex', width: 12 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'User Name', key: 'userFullname', width: 20 },
      { header: 'Role', key: 'role', width: 10 },
      { header: 'Content', key: 'content', width: 60 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Course', key: 'courseTitle', width: 25 },
      { header: 'Module ID', key: 'moduleId', width: 10 },
      { header: 'Module', key: 'moduleTitle', width: 20 },
      { header: 'Lecture ID', key: 'lectureId', width: 10 },
      { header: 'Lecture', key: 'lectureTitle', width: 20 },
      { header: 'Section ID', key: 'sectionId', width: 10 },
      { header: 'Chatbot Name', key: 'contextName', width: 20 },
      { header: 'AI Model', key: 'aiModel', width: 20 },
      { header: 'AI Provider', key: 'aiProvider', width: 15 },
      { header: 'Prompt Tokens', key: 'promptTokens', width: 12 },
      { header: 'Completion Tokens', key: 'completionTokens', width: 15 },
      { header: 'Total Tokens', key: 'totalTokens', width: 12 },
      { header: 'Response Time (ms)', key: 'responseTimeMs', width: 15 },
      { header: 'System Prompt', key: 'systemPrompt', width: 50 },
      { header: 'Device Type', key: 'deviceType', width: 12 },
      { header: 'Browser', key: 'browserName', width: 15 },
      { header: 'IP Address', key: 'ipAddress', width: 15 },
    ];
    chatbotMessages.messages.forEach(msg => {
      chatbotSheet.addRow({
        ...msg,
        timestamp: formatTimestampReadable(msg.timestamp),
      });
    });

    // Sheet 3: Tutor Messages
    const tutorSheet = workbook.addWorksheet('Tutor Messages');
    tutorSheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Session ID', key: 'sessionId', width: 20 },
      { header: 'Conversation ID', key: 'conversationId', width: 15 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'User Name', key: 'userFullname', width: 20 },
      { header: 'Role', key: 'role', width: 10 },
      { header: 'Content', key: 'content', width: 60 },
      { header: 'Tutor/Agent', key: 'contextName', width: 20 },
      { header: 'AI Model', key: 'aiModel', width: 20 },
      { header: 'AI Provider', key: 'aiProvider', width: 15 },
      { header: 'Temperature', key: 'temperature', width: 12 },
      { header: 'Prompt Tokens', key: 'promptTokens', width: 12 },
      { header: 'Completion Tokens', key: 'completionTokens', width: 15 },
      { header: 'Total Tokens', key: 'totalTokens', width: 12 },
      { header: 'Response Time (ms)', key: 'responseTimeMs', width: 15 },
      { header: 'Routing Reason', key: 'routingReason', width: 25 },
      { header: 'Routing Confidence', key: 'routingConfidence', width: 15 },
      { header: 'Synthesized From', key: 'synthesizedFrom', width: 30 },
      { header: 'Device Type', key: 'deviceType', width: 12 },
      { header: 'IP Address', key: 'ipAddress', width: 15 },
    ];
    tutorMessages.messages.forEach(msg => {
      tutorSheet.addRow({
        ...msg,
        timestamp: formatTimestampReadable(msg.timestamp),
      });
    });

    // Sheet 4: Agent Test Messages
    const agentSheet = workbook.addWorksheet('Agent Test Messages');
    agentSheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Session ID', key: 'sessionId', width: 20 },
      { header: 'Conversation ID', key: 'conversationId', width: 15 },
      { header: 'Message Index', key: 'messageIndex', width: 12 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'User Name', key: 'userFullname', width: 20 },
      { header: 'Role', key: 'role', width: 10 },
      { header: 'Content', key: 'content', width: 60 },
      { header: 'Course ID', key: 'courseId', width: 10 },
      { header: 'Course', key: 'courseTitle', width: 25 },
      { header: 'Agent Name', key: 'agentName', width: 20 },
      { header: 'Agent Version', key: 'agentVersion', width: 12 },
      { header: 'AI Model', key: 'aiModel', width: 20 },
      { header: 'AI Provider', key: 'aiProvider', width: 15 },
      { header: 'Temperature', key: 'temperature', width: 12 },
      { header: 'Prompt Tokens', key: 'promptTokens', width: 12 },
      { header: 'Completion Tokens', key: 'completionTokens', width: 15 },
      { header: 'Total Tokens', key: 'totalTokens', width: 12 },
      { header: 'Response Time (ms)', key: 'responseTimeMs', width: 15 },
      { header: 'System Prompt', key: 'systemPrompt', width: 50 },
      { header: 'Device Type', key: 'deviceType', width: 12 },
      { header: 'Browser', key: 'browserName', width: 15 },
      { header: 'IP Address', key: 'ipAddress', width: 15 },
    ];
    agentMessages.messages.forEach(msg => {
      agentSheet.addRow({
        ...msg,
        timestamp: formatTimestampReadable(msg.timestamp),
      });
    });

    // Sheet 5: Summary Statistics
    const summarySheet = workbook.addWorksheet('Summary Statistics');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 30 },
    ];
    summarySheet.addRow({ metric: 'Total Messages', value: stats.total });
    summarySheet.addRow({ metric: 'Chatbot Messages', value: stats.chatbot });
    summarySheet.addRow({ metric: 'Tutor Messages', value: stats.tutor });
    summarySheet.addRow({ metric: 'Agent Test Messages', value: stats.agent });
    summarySheet.addRow({ metric: 'Unique Users', value: stats.uniqueUsers });
    summarySheet.addRow({ metric: 'Avg Response Time (ms)', value: stats.avgResponseTimeMs?.toFixed(2) || 'N/A' });
    summarySheet.addRow({ metric: 'Total Tokens Used', value: stats.totalTokens });
    summarySheet.addRow({ metric: '', value: '' });
    summarySheet.addRow({ metric: 'Messages by Model', value: '' });
    stats.byModel.forEach(item => {
      summarySheet.addRow({ metric: `  ${item.model || 'Unknown'}`, value: item.count });
    });
    summarySheet.addRow({ metric: '', value: '' });
    summarySheet.addRow({ metric: 'Messages by Course', value: '' });
    stats.byCourse.forEach(item => {
      summarySheet.addRow({ metric: `  ${item.courseTitle || 'Unknown'}`, value: item.count });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ============================================================================
  // PRIVATE: Chatbot Messages
  // ============================================================================

  private async getChatbotMessages(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<UnifiedMessage[]> {
    // Use ChatbotInteractionLog which has ALL the data (content, AI metrics, context)
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.timestamp = dateFilter;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.courseId) {
      where.courseId = filters.courseId;
    }
    // Only get logs that have message content (message_sent or message_received events)
    where.OR = [
      { eventType: 'message_sent', messageContent: { not: null } },
      { eventType: 'message_received', responseContent: { not: null } },
    ];

    const logs = await prisma.chatbotInteractionLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    // Convert each log into message entries
    const messages: UnifiedMessage[] = [];

    for (const log of logs) {
      // Create user message entry if present
      if (log.messageContent && log.eventType === 'message_sent') {
        messages.push({
          id: `chatbot-user-${log.id}`,
          timestamp: log.timestamp,
          systemType: 'chatbot' as const,
          sessionId: log.sessionId,
          userId: log.userId,
          userEmail: log.userEmail,
          userFullname: log.userFullname,
          role: 'user',
          content: log.messageContent,
          courseId: log.courseId,
          courseTitle: log.courseTitle,
          moduleId: log.moduleId,
          moduleTitle: log.moduleTitle,
          lectureId: log.lectureId,
          lectureTitle: log.lectureTitle,
          sectionId: log.sectionId,
          contextName: log.chatbotTitle,
          aiModel: null,
          aiProvider: null,
          temperature: null,
          maxTokens: null,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          responseTimeMs: null,
          systemPrompt: log.chatbotSystemPrompt,
          conversationId: log.conversationId,
          messageIndex: log.messageIndex,
          routingReason: null,
          routingConfidence: null,
          synthesizedFrom: null,
          agentName: null,
          agentVersion: null,
          deviceType: log.deviceType,
          browserName: log.browserName,
          ipAddress: log.ipAddress,
        });
      }

      // Create assistant message entry if present
      if (log.responseContent && log.eventType === 'message_received') {
        messages.push({
          id: `chatbot-assistant-${log.id}`,
          timestamp: log.timestamp,
          systemType: 'chatbot' as const,
          sessionId: log.sessionId,
          userId: log.userId,
          userEmail: log.userEmail,
          userFullname: log.userFullname,
          role: 'assistant',
          content: log.responseContent,
          courseId: log.courseId,
          courseTitle: log.courseTitle,
          moduleId: log.moduleId,
          moduleTitle: log.moduleTitle,
          lectureId: log.lectureId,
          lectureTitle: log.lectureTitle,
          sectionId: log.sectionId,
          contextName: log.chatbotTitle,
          aiModel: log.aiModel,
          aiProvider: log.aiProvider,
          temperature: null,
          maxTokens: null,
          promptTokens: log.promptTokens,
          completionTokens: log.completionTokens,
          totalTokens: log.totalTokens,
          responseTimeMs: log.responseTime ? Math.round(log.responseTime * 1000) : null,
          systemPrompt: log.chatbotSystemPrompt,
          conversationId: log.conversationId,
          messageIndex: log.messageIndex,
          routingReason: null,
          routingConfidence: null,
          synthesizedFrom: null,
          agentName: null,
          agentVersion: null,
          deviceType: log.deviceType,
          browserName: log.browserName,
          ipAddress: log.ipAddress,
        });
      }
    }

    return messages;
  }

  private async getChatbotMessageCount(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<number> {
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.timestamp = dateFilter;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.courseId) {
      where.courseId = filters.courseId;
    }
    // Count both user messages and assistant responses
    where.OR = [
      { eventType: 'message_sent', messageContent: { not: null } },
      { eventType: 'message_received', responseContent: { not: null } },
    ];

    return prisma.chatbotInteractionLog.count({ where });
  }

  private async getChatbotUniqueUsers(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<number[]> {
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.timestamp = dateFilter;
    }
    if (filters.courseId) {
      where.courseId = filters.courseId;
    }
    where.userId = { not: null };

    const logs = await prisma.chatbotInteractionLog.findMany({
      where,
      select: { userId: true },
      distinct: ['userId'],
    });

    return logs.map(l => l.userId).filter((id): id is number => id !== null);
  }

  private async getChatbotStats(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<{ totalTokens: number; totalResponseTime: number; responseCount: number }> {
    // Chatbot messages don't store tokens directly, get from interaction logs
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.timestamp = dateFilter;
    }
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.userId) where.userId = filters.userId;

    const logs = await prisma.chatbotInteractionLog.findMany({
      where,
      select: {
        totalTokens: true,
        responseTime: true,
      },
    });

    const totalTokens = logs.reduce((sum, log) => sum + (log.totalTokens || 0), 0);
    const responseLogs = logs.filter(log => log.responseTime !== null);
    const totalResponseTime = responseLogs.reduce((sum, log) => sum + ((log.responseTime || 0) * 1000), 0); // Convert to ms

    return { totalTokens, totalResponseTime, responseCount: responseLogs.length };
  }

  // ============================================================================
  // PRIVATE: Tutor Messages
  // ============================================================================

  private async getTutorMessages(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<UnifiedMessage[]> {
    // Use TutorInteractionLog which has full data including device info
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.timestamp = dateFilter;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    // Only get logs that have message content (message_sent or message_received events)
    where.OR = [
      { eventType: 'message_sent', userMessage: { not: null } },
      { eventType: 'message_received', assistantMessage: { not: null } },
    ];

    const logs = await prisma.tutorInteractionLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    // Get unique user IDs to fetch user info
    const userIds = [...new Set(logs.map(l => l.userId).filter((id): id is number => id !== null))];
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, fullname: true },
        })
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    // Convert each log into message entries
    const messages: UnifiedMessage[] = [];

    for (const log of logs) {
      const user = userMap.get(log.userId);

      // Create user message entry if present
      if (log.userMessage && log.eventType === 'message_sent') {
        messages.push({
          id: `tutor-user-${log.id}`,
          timestamp: log.timestamp,
          systemType: 'tutor' as const,
          sessionId: log.sessionId?.toString() || null,
          userId: log.userId,
          userEmail: user?.email || null,
          userFullname: user?.fullname || null,
          role: 'user',
          content: log.userMessage,
          courseId: null, // Tutor doesn't have course context
          courseTitle: null,
          moduleId: null,
          moduleTitle: null,
          lectureId: null,
          lectureTitle: null,
          sectionId: null,
          contextName: log.chatbotDisplayName || log.chatbotName || null,
          aiModel: null,
          aiProvider: null,
          temperature: null,
          maxTokens: null,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          responseTimeMs: null,
          systemPrompt: null,
          conversationId: log.conversationId,
          messageIndex: null,
          routingReason: null,
          routingConfidence: null,
          synthesizedFrom: null,
          agentName: null,
          agentVersion: null,
          deviceType: log.deviceType,
          browserName: null, // TutorInteractionLog doesn't have browserName
          ipAddress: log.ipAddress,
        });
      }

      // Create assistant message entry if present
      if (log.assistantMessage && log.eventType === 'message_received') {
        messages.push({
          id: `tutor-assistant-${log.id}`,
          timestamp: log.timestamp,
          systemType: 'tutor' as const,
          sessionId: log.sessionId?.toString() || null,
          userId: log.userId,
          userEmail: user?.email || null,
          userFullname: user?.fullname || null,
          role: 'assistant',
          content: log.assistantMessage,
          courseId: null,
          courseTitle: null,
          moduleId: null,
          moduleTitle: null,
          lectureId: null,
          lectureTitle: null,
          sectionId: null,
          contextName: log.chatbotDisplayName || log.chatbotName || null,
          aiModel: log.aiModel,
          aiProvider: log.aiProvider,
          temperature: null,
          maxTokens: null,
          promptTokens: log.promptTokens,
          completionTokens: log.completionTokens,
          totalTokens: log.totalTokens,
          responseTimeMs: log.responseTimeMs,
          systemPrompt: null,
          conversationId: log.conversationId,
          messageIndex: null,
          routingReason: log.routingReason,
          routingConfidence: log.routingConfidence,
          synthesizedFrom: null, // Not stored in interaction log
          agentName: null,
          agentVersion: null,
          deviceType: log.deviceType,
          browserName: null,
          ipAddress: log.ipAddress,
        });
      }
    }

    return messages;
  }

  private async getTutorMessageCount(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<number> {
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.timestamp = dateFilter;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    // Count both user messages and assistant responses
    where.OR = [
      { eventType: 'message_sent', userMessage: { not: null } },
      { eventType: 'message_received', assistantMessage: { not: null } },
    ];

    return prisma.tutorInteractionLog.count({ where });
  }

  private async getTutorUniqueUsers(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<number[]> {
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.timestamp = dateFilter;
    }

    const logs = await prisma.tutorInteractionLog.findMany({
      where,
      select: { userId: true },
      distinct: ['userId'],
    });

    return logs.map(l => l.userId).filter((id): id is number => id !== null);
  }

  private async getTutorStats(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<{ totalTokens: number; totalResponseTime: number; responseCount: number }> {
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.timestamp = dateFilter;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }

    const logs = await prisma.tutorInteractionLog.findMany({
      where: { ...where, eventType: 'message_received' },
      select: {
        totalTokens: true,
        responseTimeMs: true,
      },
    });

    const totalTokens = logs.reduce((sum, log) => sum + (log.totalTokens || 0), 0);
    const responseLogs = logs.filter(log => log.responseTimeMs !== null);
    const totalResponseTime = responseLogs.reduce((sum, log) => sum + (log.responseTimeMs || 0), 0);

    return { totalTokens, totalResponseTime, responseCount: responseLogs.length };
  }

  // ============================================================================
  // PRIVATE: Agent Test Messages
  // ============================================================================

  private async getAgentMessages(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<UnifiedMessage[]> {
    // Use AgentTestInteractionLog which has full data including device info
    // Note: Agent logs store BOTH messageContent and responseContent in 'message_received' events
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.timestamp = dateFilter;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.courseId) {
      where.courseId = filters.courseId;
    }
    // Get message_received events which contain both user message and assistant response
    where.eventType = 'message_received';

    const logs = await prisma.agentTestInteractionLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    // Convert each log into TWO message entries (user + assistant)
    const messages: UnifiedMessage[] = [];

    for (const log of logs) {
      // Create user message entry (from messageContent)
      if (log.messageContent) {
        messages.push({
          id: `agent-user-${log.id}`,
          timestamp: log.timestamp,
          systemType: 'agent' as const,
          sessionId: log.sessionId,
          userId: log.userId,
          userEmail: log.userEmail,
          userFullname: log.userFullname,
          role: 'user',
          content: log.messageContent,
          courseId: log.courseId,
          courseTitle: log.courseTitle,
          moduleId: null, // Agent tests don't have module context - they have assignments
          moduleTitle: log.assignmentTitle, // Show assignment title in module field
          lectureId: null,
          lectureTitle: null,
          sectionId: null,
          contextName: log.agentTitle || log.agentName || null,
          aiModel: null,
          aiProvider: null,
          temperature: null,
          maxTokens: null,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          responseTimeMs: null,
          systemPrompt: null,
          conversationId: log.conversationId,
          messageIndex: log.messageIndex,
          routingReason: null,
          routingConfidence: null,
          synthesizedFrom: null,
          agentName: log.agentName,
          agentVersion: log.agentVersion,
          deviceType: log.deviceType,
          browserName: log.browserName,
          ipAddress: log.ipAddress,
        });
      }

      // Create assistant message entry (from responseContent)
      if (log.responseContent) {
        messages.push({
          id: `agent-assistant-${log.id}`,
          timestamp: log.timestamp,
          systemType: 'agent' as const,
          sessionId: log.sessionId,
          userId: log.userId,
          userEmail: log.userEmail,
          userFullname: log.userFullname,
          role: 'assistant',
          content: log.responseContent,
          courseId: log.courseId,
          courseTitle: log.courseTitle,
          moduleId: null,
          moduleTitle: log.assignmentTitle,
          lectureId: null,
          lectureTitle: null,
          sectionId: null,
          contextName: log.agentTitle || log.agentName || null,
          aiModel: log.aiModel,
          aiProvider: log.aiProvider,
          temperature: null,
          maxTokens: null,
          promptTokens: log.promptTokens,
          completionTokens: log.completionTokens,
          totalTokens: log.totalTokens,
          responseTimeMs: log.responseTime ? Math.round(log.responseTime * 1000) : null, // Convert seconds to ms
          systemPrompt: null,
          conversationId: log.conversationId,
          messageIndex: log.messageIndex,
          routingReason: null,
          routingConfidence: null,
          synthesizedFrom: null,
          agentName: log.agentName,
          agentVersion: log.agentVersion,
          deviceType: log.deviceType,
          browserName: log.browserName,
          ipAddress: log.ipAddress,
        });
      }
    }

    return messages;
  }

  private async getAgentMessageCount(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<number> {
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.timestamp = dateFilter;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.courseId) {
      where.courseId = filters.courseId;
    }
    // Each message_received event contains both user message and assistant response
    where.eventType = 'message_received';

    const logCount = await prisma.agentTestInteractionLog.count({ where });
    // Each log entry represents 2 messages (user + assistant)
    return logCount * 2;
  }

  private async getAgentUniqueUsers(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<number[]> {
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.timestamp = dateFilter;
    }
    if (filters.courseId) {
      where.courseId = filters.courseId;
    }
    where.userId = { not: null };

    const logs = await prisma.agentTestInteractionLog.findMany({
      where,
      select: { userId: true },
      distinct: ['userId'],
    });

    return logs.map(l => l.userId).filter((id): id is number => id !== null);
  }

  private async getAgentStats(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<{ totalTokens: number; totalResponseTime: number; responseCount: number }> {
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.timestamp = dateFilter;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.courseId) {
      where.courseId = filters.courseId;
    }

    const logs = await prisma.agentTestInteractionLog.findMany({
      where: { ...where, eventType: 'message_received' },
      select: {
        totalTokens: true,
        responseTime: true, // In seconds (Float)
      },
    });

    const totalTokens = logs.reduce((sum, log) => sum + (log.totalTokens || 0), 0);
    const responseLogs = logs.filter(log => log.responseTime !== null);
    // Convert responseTime from seconds to ms
    const totalResponseTime = responseLogs.reduce((sum, log) => sum + ((log.responseTime || 0) * 1000), 0);

    return { totalTokens, totalResponseTime, responseCount: responseLogs.length };
  }

  // ============================================================================
  // PRIVATE: Aggregations
  // ============================================================================

  private async getModelStats(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<Array<{ model: string; count: number }>> {
    // Get model stats from tutor and agent messages (they store model info)
    const tutorWhere: Record<string, unknown> = { role: 'assistant', aiModel: { not: null } };
    const agentWhere: Record<string, unknown> = { role: 'assistant', aiModel: { not: null } };

    if (dateFilter.gte || dateFilter.lte) {
      tutorWhere.createdAt = dateFilter;
      agentWhere.createdAt = dateFilter;
    }

    const [tutorModels, agentModels, chatbotModels] = await Promise.all([
      prisma.tutorMessage.groupBy({
        by: ['aiModel'],
        where: tutorWhere,
        _count: { id: true },
      }),
      prisma.agentTestMessage.groupBy({
        by: ['aiModel'],
        where: agentWhere,
        _count: { id: true },
      }),
      // Get from interaction logs for chatbot
      prisma.chatbotInteractionLog.groupBy({
        by: ['aiModel'],
        where: {
          ...(dateFilter.gte || dateFilter.lte ? { timestamp: dateFilter } : {}),
          aiModel: { not: null },
        },
        _count: { id: true },
      }),
    ]);

    // Combine and aggregate
    const modelMap = new Map<string, number>();

    tutorModels.forEach(item => {
      const model = item.aiModel || 'unknown';
      modelMap.set(model, (modelMap.get(model) || 0) + item._count.id);
    });

    agentModels.forEach(item => {
      const model = item.aiModel || 'unknown';
      modelMap.set(model, (modelMap.get(model) || 0) + item._count.id);
    });

    chatbotModels.forEach(item => {
      const model = item.aiModel || 'unknown';
      modelMap.set(model, (modelMap.get(model) || 0) + item._count.id);
    });

    return Array.from(modelMap.entries())
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count);
  }

  private async getCourseStats(
    filters: MessageExportFilters,
    dateFilter: { gte?: Date; lte?: Date }
  ): Promise<Array<{ courseId: number; courseTitle: string; count: number }>> {
    // Get course stats from chatbot and agent (tutor doesn't have course context)
    const chatbotWhere: Record<string, unknown> = {};
    const agentWhere: Record<string, unknown> = {};

    if (dateFilter.gte || dateFilter.lte) {
      chatbotWhere.timestamp = dateFilter;
      agentWhere.createdAt = dateFilter;
    }
    if (filters.courseId) {
      chatbotWhere.courseId = filters.courseId;
      agentWhere.conversation = { agentConfig: { assignment: { courseId: filters.courseId } } };
    }

    const chatbotLogs = await prisma.chatbotInteractionLog.groupBy({
      by: ['courseId', 'courseTitle'],
      where: { ...chatbotWhere, courseId: { not: null } },
      _count: { id: true },
    });

    // For agent, need to count via messages
    const agentMessages = await prisma.agentTestMessage.findMany({
      where: agentWhere,
      include: {
        conversation: {
          include: {
            agentConfig: {
              include: {
                assignment: {
                  include: { course: { select: { id: true, title: true } } },
                },
              },
            },
          },
        },
      },
    });

    const courseMap = new Map<number, { title: string; count: number }>();

    chatbotLogs.forEach(item => {
      if (item.courseId) {
        const existing = courseMap.get(item.courseId);
        courseMap.set(item.courseId, {
          title: item.courseTitle || existing?.title || 'Unknown',
          count: (existing?.count || 0) + item._count.id,
        });
      }
    });

    agentMessages.forEach(msg => {
      const course = msg.conversation.agentConfig.assignment.course;
      if (course) {
        const existing = courseMap.get(course.id);
        courseMap.set(course.id, {
          title: course.title,
          count: (existing?.count || 0) + 1,
        });
      }
    });

    return Array.from(courseMap.entries())
      .map(([courseId, data]) => ({ courseId, courseTitle: data.title, count: data.count }))
      .sort((a, b) => b.count - a.count);
  }

  // ============================================================================
  // PRIVATE: Helpers
  // ============================================================================

  private buildDateFilter(filters: MessageExportFilters): { gte?: Date; lte?: Date } {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (filters.startDate) dateFilter.gte = filters.startDate;
    if (filters.endDate) dateFilter.lte = filters.endDate;
    return dateFilter;
  }
}

export const messageExportService = new MessageExportService();
