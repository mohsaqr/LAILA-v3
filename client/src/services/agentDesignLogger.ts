/**
 * Agent Design Logger Service
 *
 * Comprehensive logging service for tracking student design decisions
 * during the AI agent builder process. Implements event batching,
 * session tracking, and automatic flushing.
 */

import {
  AgentDesignEvent,
  AgentDesignEventType,
  AgentDesignEventCategory,
  AgentConfigFormData,
} from '../types';
import apiClient from '../api/client';

// Generate UUID using crypto API (browser-native)
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Event category mapping
const EVENT_CATEGORY_MAP: Record<AgentDesignEventType, AgentDesignEventCategory> = {
  design_session_start: 'session',
  design_session_end: 'session',
  design_session_pause: 'session',
  design_session_resume: 'session',
  tab_switch: 'navigation',
  tab_time_recorded: 'navigation',
  field_focus: 'field',
  field_blur: 'field',
  field_change: 'field',
  field_paste: 'field',
  field_clear: 'field',
  role_selected: 'template',
  template_viewed: 'template',
  template_applied: 'template',
  template_modified: 'template',
  personality_selected: 'template',
  suggestion_viewed: 'template',
  suggestion_applied: 'template',
  prompt_block_selected: 'template',
  prompt_block_removed: 'template',
  prompt_blocks_reordered: 'template',
  prompt_block_custom_added: 'template',
  rule_added: 'rule',
  rule_removed: 'rule',
  rule_edited: 'rule',
  rule_reordered: 'rule',
  test_conversation_started: 'test',
  test_message_sent: 'test',
  test_response_received: 'test',
  test_conversation_reset: 'test',
  post_test_edit: 'test',
  reflection_prompt_shown: 'reflection',
  reflection_dismissed: 'reflection',
  reflection_submitted: 'reflection',
  draft_saved: 'save',
  submission_attempted: 'save',
  submission_completed: 'save',
  unsubmit_requested: 'save',
};

// Tab types
type TabType = 'identity' | 'behavior' | 'advanced' | 'test' | 'dataset';

// Browser/device detection helpers
function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Unknown';
}

// Word count helper
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export class AgentDesignLogger {
  private sessionId: string;
  private designSessionId: string;
  private userId: number;
  private assignmentId: number;
  private agentConfigId: number | null = null;
  private eventQueue: AgentDesignEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private isActive = false;
  private sessionStartTime: number = 0;
  private currentTab: TabType = 'identity';
  private tabStartTime: number = 0;
  private lastTestConversationId: number | null = null;
  private hasTestedAgent = false;
  private currentVersion = 1;

  // Flush settings
  private readonly FLUSH_INTERVAL = 10000; // 10 seconds
  private readonly BATCH_SIZE = 50; // Max events per batch

  // A "sitting" = one continuous period of work on the assignment. Two opens
  // of the same assignment within this wall-clock gap count as the same
  // sitting; beyond it, the next open is a new sitting (distinct
  // designSessionId). 10 minutes is generous enough to span coffee breaks,
  // router transitions, and tab-close-reopen loops without undercounting.
  private readonly SITTING_GAP_MS = 10 * 60 * 1000;

  // localStorage persistence: a fresh mount reads this to decide whether to
  // resume the previous sitting or start a new one. See loadSitting() /
  // saveSitting() / clearSitting() below.
  private readonly storageKey: string;

  constructor(userId: number, assignmentId: number) {
    this.sessionId = localStorage.getItem('session_id') || generateUUID();
    localStorage.setItem('session_id', this.sessionId);
    this.designSessionId = generateUUID();
    this.userId = userId;
    this.assignmentId = assignmentId;
    this.storageKey = `agentDesign:sitting:${userId}:${assignmentId}`;

    // Bind visibility change handler
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  // ---------- sitting persistence ----------

  private loadSitting(): {
    designSessionId: string;
    sessionStartTime: number;
    lastActiveAt: number;
  } | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        typeof parsed?.designSessionId === 'string' &&
        typeof parsed?.sessionStartTime === 'number' &&
        typeof parsed?.lastActiveAt === 'number'
      ) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private saveSitting(lastActiveAt: number = Date.now()): void {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          designSessionId: this.designSessionId,
          sessionStartTime: this.sessionStartTime,
          lastActiveAt,
        })
      );
    } catch {
      // ignore quota / privacy-mode failures
    }
  }

  /**
   * Start a design sitting. If the localStorage entry for this user+
   * assignment is fresh (within SITTING_GAP_MS of its last activity), the
   * previous sitting is resumed: same designSessionId, same sessionStartTime,
   * no new design_session_start event is emitted. Otherwise — and
   * specifically when the previous sitting was stale — a synthetic
   * design_session_end is emitted for the old sitting using its persisted
   * timing (so the timeline shows the correct duration), then a new sitting
   * starts with a fresh id.
   */
  startSession(agentConfigId?: number, version?: number): void {
    if (this.isActive) {
      if (agentConfigId) this.agentConfigId = agentConfigId;
      if (version) this.currentVersion = version;
      return;
    }

    const now = Date.now();
    const persisted = this.loadSitting();
    const isFresh = persisted && now - persisted.lastActiveAt < this.SITTING_GAP_MS;

    if (isFresh && persisted) {
      // Resume the existing sitting — same id, same start time.
      this.designSessionId = persisted.designSessionId;
      this.sessionStartTime = persisted.sessionStartTime;
    } else {
      // Previous sitting went stale → emit a synthetic end for it before
      // starting the new one, so the timeline closes the old sitting with
      // its real duration. We restore the old ids temporarily for the log.
      if (persisted) {
        const prevId = this.designSessionId;
        const prevStart = this.sessionStartTime;
        this.designSessionId = persisted.designSessionId;
        this.sessionStartTime = persisted.sessionStartTime;
        const elapsed = Math.floor(
          (persisted.lastActiveAt - persisted.sessionStartTime) / 1000
        );
        // This event must be emittable even though isActive is false.
        this.emitUnsafe('design_session_end', {
          totalDesignTime: elapsed,
          timestamp: new Date(persisted.lastActiveAt),
        });
        this.designSessionId = prevId;
        this.sessionStartTime = prevStart;
      }

      // New sitting.
      this.designSessionId = generateUUID();
      this.sessionStartTime = now;
    }

    this.isActive = true;
    this.tabStartTime = now;

    if (agentConfigId) this.agentConfigId = agentConfigId;
    if (version) this.currentVersion = version;

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    this.flushInterval = setInterval(() => this.flush(), this.FLUSH_INTERVAL);

    if (!isFresh) {
      this.logEvent('design_session_start');
    }
    this.saveSitting(now);
  }

  /**
   * Pause the current sitting without emitting design_session_end. The
   * sitting is persisted to localStorage; if the same (user, assignment)
   * opens again within SITTING_GAP_MS, the next startSession() resumes it.
   * design_session_end is only emitted from handleBeforeUnload (reliable
   * tab-close signal) or from startSession() when it detects a stale
   * sitting. This avoids the "phantom short sitting" that the old debounced
   * approach produced whenever a remount landed outside the debounce window.
   */
  async endSession(): Promise<void> {
    if (!this.isActive) return;

    this.recordTabTime();
    this.saveSitting(Date.now());

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    await this.flush(true);
    this.isActive = false;
  }

  /**
   * Set agent config ID (after creation)
   */
  setAgentConfigId(id: number): void {
    this.agentConfigId = id;
  }

  /**
   * Update current version
   */
  setVersion(version: number): void {
    this.currentVersion = version;
  }

  /**
   * Log a design event
   */
  logEvent(
    eventType: AgentDesignEventType,
    data: Partial<AgentDesignEvent> = {}
  ): void {
    if (!this.isActive && eventType !== 'design_session_start') return;
    this.emitUnsafe(eventType, data);
    // Refresh the persisted sitting so subsequent mounts see recent activity.
    this.saveSitting(Date.now());
  }

  /**
   * Emit an event without the isActive guard. Used internally for synthetic
   * close-out events that are produced while transitioning sittings (see
   * startSession's stale-sitting branch).
   */
  private emitUnsafe(
    eventType: AgentDesignEventType,
    data: Partial<AgentDesignEvent> = {}
  ): void {
    const event: AgentDesignEvent = {
      userId: this.userId,
      assignmentId: this.assignmentId,
      agentConfigId: this.agentConfigId || undefined,
      sessionId: this.sessionId,
      designSessionId: this.designSessionId,
      eventType,
      eventCategory: EVENT_CATEGORY_MAP[eventType],
      timestamp: new Date(),
      version: this.currentVersion,
      activeTab: this.currentTab,
      totalDesignTime: Math.floor((Date.now() - this.sessionStartTime) / 1000),
      deviceType: getDeviceType(),
      browserName: getBrowserName(),
      userAgent: navigator.userAgent,
      ...data,
    };

    this.eventQueue.push(event);

    if (this.eventQueue.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  // ==================== Tab Navigation ====================

  /**
   * Log tab switch
   */
  switchTab(newTab: TabType): void {
    if (newTab === this.currentTab) return;

    // Record time on previous tab
    this.recordTabTime();

    const previousTab = this.currentTab;
    this.currentTab = newTab;
    this.tabStartTime = Date.now();

    this.logEvent('tab_switch', {
      previousValue: previousTab,
      newValue: newTab,
    });
  }

  private recordTabTime(): void {
    const timeOnTab = Math.floor((Date.now() - this.tabStartTime) / 1000);
    if (timeOnTab > 0) {
      this.logEvent('tab_time_recorded', {
        activeTab: this.currentTab,
        timeOnTab,
      });
    }
  }

  // ==================== Field Interactions ====================

  /**
   * Log field focus
   */
  logFieldFocus(fieldName: string): void {
    this.logEvent('field_focus', { fieldName });
  }

  /**
   * Log field blur
   */
  logFieldBlur(fieldName: string, value: string): void {
    this.logEvent('field_blur', {
      fieldName,
      characterCount: value.length,
      wordCount: countWords(value),
    });
  }

  /**
   * Log field change
   */
  logFieldChange(
    fieldName: string,
    previousValue: string,
    newValue: string,
    changeType: 'type' | 'paste' | 'select' | 'toggle' | 'click' = 'type'
  ): void {
    this.logEvent('field_change', {
      fieldName,
      previousValue: previousValue.substring(0, 500), // Truncate for storage
      newValue: newValue.substring(0, 500),
      changeType,
      characterCount: newValue.length,
      wordCount: countWords(newValue),
    });
  }

  /**
   * Log field paste
   */
  logFieldPaste(fieldName: string, pastedContent: string): void {
    this.logEvent('field_paste', {
      fieldName,
      newValue: pastedContent.substring(0, 500),
      changeType: 'paste',
      characterCount: pastedContent.length,
      wordCount: countWords(pastedContent),
    });
  }

  /**
   * Log field clear
   */
  logFieldClear(fieldName: string, previousValue: string): void {
    this.logEvent('field_clear', {
      fieldName,
      previousValue: previousValue.substring(0, 500),
      changeType: 'delete',
    });
  }

  // ==================== Template & Role Events ====================

  /**
   * Log role selection
   */
  logRoleSelected(roleId: string, roleName: string): void {
    this.logEvent('role_selected', {
      roleSelected: roleId,
      templateName: roleName,
      usedTemplate: true,
    });
  }

  /**
   * Log template application
   */
  logTemplateApplied(templateName: string, fieldName: string): void {
    this.logEvent('template_applied', {
      templateName,
      fieldName,
      usedTemplate: true,
    });
  }

  /**
   * Log template modification (editing after applying)
   */
  logTemplateModified(templateName: string, fieldName: string): void {
    this.logEvent('template_modified', {
      templateName,
      fieldName,
    });
  }

  /**
   * Log personality selection
   */
  logPersonalitySelected(personalityId: string, personalityName: string): void {
    this.logEvent('personality_selected', {
      personalitySelected: personalityId,
      templateName: personalityName,
    });
  }

  /**
   * Log suggestion applied
   */
  logSuggestionApplied(source: string, fieldName: string): void {
    this.logEvent('suggestion_applied', {
      usedSuggestion: true,
      suggestionSource: source,
      fieldName,
    });
  }

  // ==================== Prompt Block Events ====================

  /**
   * Log prompt block selected
   */
  logPromptBlockSelected(
    blockId: string,
    blockCategory: string,
    selectedBlockIds: string[]
  ): void {
    this.logEvent('prompt_block_selected', {
      promptBlockId: blockId,
      promptBlockCategory: blockCategory,
      selectedBlockIds,
    });
  }

  /**
   * Log prompt block removed
   */
  logPromptBlockRemoved(
    blockId: string,
    blockCategory: string,
    selectedBlockIds: string[]
  ): void {
    this.logEvent('prompt_block_removed', {
      promptBlockId: blockId,
      promptBlockCategory: blockCategory,
      selectedBlockIds,
    });
  }

  /**
   * Log prompt blocks reordered
   */
  logPromptBlocksReordered(selectedBlockIds: string[]): void {
    this.logEvent('prompt_blocks_reordered', {
      selectedBlockIds,
    });
  }

  /**
   * Log custom prompt block added
   */
  logPromptBlockCustomAdded(customText: string): void {
    this.logEvent('prompt_block_custom_added', {
      newValue: customText.substring(0, 500),
      characterCount: customText.length,
      wordCount: countWords(customText),
    });
  }

  // ==================== Rule Events ====================

  /**
   * Log rule added
   */
  logRuleAdded(ruleType: 'do' | 'dont', ruleContent: string): void {
    this.logEvent('rule_added', {
      fieldName: ruleType === 'do' ? 'dosRules' : 'dontsRules',
      newValue: ruleContent,
    });
  }

  /**
   * Log rule removed
   */
  logRuleRemoved(ruleType: 'do' | 'dont', ruleContent: string): void {
    this.logEvent('rule_removed', {
      fieldName: ruleType === 'do' ? 'dosRules' : 'dontsRules',
      previousValue: ruleContent,
    });
  }

  /**
   * Log rule edited
   */
  logRuleEdited(
    ruleType: 'do' | 'dont',
    previousContent: string,
    newContent: string
  ): void {
    this.logEvent('rule_edited', {
      fieldName: ruleType === 'do' ? 'dosRules' : 'dontsRules',
      previousValue: previousContent,
      newValue: newContent,
    });
  }

  // ==================== Test Events ====================

  /**
   * Log test conversation started
   */
  logTestStarted(conversationId: number): void {
    this.lastTestConversationId = conversationId;
    this.hasTestedAgent = true;
    this.logEvent('test_conversation_started', {
      testConversationId: conversationId,
    });
  }

  /**
   * Log test message sent
   */
  logTestMessageSent(conversationId: number, messageCount: number): void {
    this.logEvent('test_message_sent', {
      testConversationId: conversationId,
      testMessageCount: messageCount,
    });
  }

  /**
   * Log test response received
   */
  logTestResponseReceived(conversationId: number, messageCount: number): void {
    this.logEvent('test_response_received', {
      testConversationId: conversationId,
      testMessageCount: messageCount,
    });
  }

  /**
   * Log test conversation reset
   */
  logTestReset(): void {
    this.logEvent('test_conversation_reset', {
      testConversationId: this.lastTestConversationId || undefined,
    });
    this.lastTestConversationId = null;
  }

  /**
   * Log edit made after testing
   */
  logPostTestEdit(fieldName: string): void {
    if (this.hasTestedAgent) {
      this.logEvent('post_test_edit', {
        fieldName,
        testConversationId: this.lastTestConversationId || undefined,
      });
    }
  }

  // ==================== Reflection Events ====================

  /**
   * Log reflection prompt shown
   */
  logReflectionShown(promptId: string, promptText: string): void {
    this.logEvent('reflection_prompt_shown', {
      reflectionPromptId: promptId,
      reflectionPromptText: promptText,
    });
  }

  /**
   * Log reflection dismissed
   */
  logReflectionDismissed(promptId: string): void {
    this.logEvent('reflection_dismissed', {
      reflectionPromptId: promptId,
      reflectionDismissed: true,
    });
  }

  /**
   * Log reflection submitted
   */
  logReflectionSubmitted(promptId: string, response: string): void {
    this.logEvent('reflection_submitted', {
      reflectionPromptId: promptId,
      reflectionResponse: response,
      reflectionDismissed: false,
    });
  }

  // ==================== Save Events ====================

  // Save/submit events are force-flushed immediately. Without this, a
  // student submitting and then navigating away within the 10-second flush
  // interval would lose the submission_completed row and the timeline would
  // show no submission event.

  logDraftSaved(config: Partial<AgentConfigFormData>): void {
    this.logEvent('draft_saved', {
      agentConfigSnapshot: config as Record<string, unknown>,
    });
    void this.flush(true);
  }

  logSubmissionAttempted(): void {
    this.logEvent('submission_attempted');
    void this.flush(true);
  }

  logSubmissionCompleted(config: Partial<AgentConfigFormData>): void {
    this.logEvent('submission_completed', {
      agentConfigSnapshot: config as Record<string, unknown>,
      totalDesignTime: Math.floor((Date.now() - this.sessionStartTime) / 1000),
    });
    void this.flush(true);
  }

  logUnsubmitRequested(): void {
    this.logEvent('unsubmit_requested');
    void this.flush(true);
  }

  // ==================== Event Handlers ====================

  private handleVisibilityChange(): void {
    // Browser-tab hide/show is not a new sitting — don't emit session events.
    // We still rebase tab-time tracking so time-per-tab stays accurate.
    if (document.hidden) {
      this.recordTabTime();
      this.flush();
    } else {
      this.tabStartTime = Date.now();
    }
  }

  private handleBeforeUnload(): void {
    // Reliable tab-close signal — finalize synchronously via sendBeacon.
    if (!this.isActive) return;

    this.recordTabTime();
    this.logEvent('design_session_end', {
      totalDesignTime: Math.floor((Date.now() - this.sessionStartTime) / 1000),
    });
    this.saveSitting(Date.now());
    this.flushSync();
    this.isActive = false;
  }

  // ==================== Flush Methods ====================

  /**
   * Flush events to server (async)
   */
  async flush(force = false): Promise<void> {
    if (this.eventQueue.length === 0) return;
    if (!force && this.eventQueue.length < 5) return; // Don't flush tiny batches unless forced

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await apiClient.post('/agent-design-logs/batch', {
        events: eventsToSend,
      });
    } catch (error) {
      // On failure, put events back in queue (at the front)
      console.error('Failed to flush design events:', error);
      this.eventQueue = [...eventsToSend, ...this.eventQueue];
    }
  }

  /**
   * Synchronous flush using sendBeacon (for beforeunload)
   */
  private flushSync(): void {
    if (this.eventQueue.length === 0) return;

    const data = JSON.stringify({ events: this.eventQueue });
    navigator.sendBeacon('/api/agent-design-logs/batch', data);
    this.eventQueue = [];
  }

  // ==================== Utility Methods ====================

  /**
   * Get current design session stats
   */
  getSessionStats(): {
    totalTime: number;
    hasTestedAgent: boolean;
    eventCount: number;
  } {
    return {
      totalTime: Math.floor((Date.now() - this.sessionStartTime) / 1000),
      hasTestedAgent: this.hasTestedAgent,
      eventCount: this.eventQueue.length,
    };
  }
}

// Singleton factory
let currentLogger: AgentDesignLogger | null = null;

export function getDesignLogger(
  userId: number,
  assignmentId: number
): AgentDesignLogger {
  if (
    !currentLogger ||
    currentLogger['userId'] !== userId ||
    currentLogger['assignmentId'] !== assignmentId
  ) {
    // End previous session if exists
    if (currentLogger) {
      currentLogger.endSession();
    }
    currentLogger = new AgentDesignLogger(userId, assignmentId);
  }
  return currentLogger;
}

export function endCurrentDesignSession(): void {
  if (currentLogger) {
    currentLogger.endSession();
    currentLogger = null;
  }
}
