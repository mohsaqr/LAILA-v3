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
import activityLogger from './activityLogger';

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

// Event types that are deliberately NOT bridged into LearningActivityLog
// even though they are still written to AgentDesignEventLog for the
// instructor-only design timeline. These are cursor/visibility mechanics
// that would pollute the admin Activity tab and TNA sequences with noise:
// focus/blur fire on every input touch, tab_time_recorded duplicates
// tab_switch, template_viewed / suggestion_viewed fire on hover previews,
// and session pause/resume happen on every browser-tab hide/show.
const BRIDGE_SKIP_EVENT_TYPES: ReadonlySet<string> = new Set([
  'field_focus',
  'field_blur',
  'tab_time_recorded',
  'template_viewed',
  'suggestion_viewed',
  'design_session_pause',
  'design_session_resume',
  // `design_session_start` is emitted directly from the builder page's
  // mount useEffect via activityLogger.log() so the "page opened" row
  // is produced exactly once per mount regardless of sitting continuity
  // or effect-dep re-runs. The internal event is still written to
  // AgentDesignEventLog for the instructor timeline.
  'design_session_start',
  // `submission_completed` fires on the submit mutation's onSuccess, but
  // the click itself already produces `submission_attempted` →
  // `submitted`/`assignment_agent`, which is the canonical "student
  // submitted" signal. Bridging the completion event would double-log
  // the submit click as `submitted` + `completed`.
  'submission_completed',
]);

// Dotted subtype namespace used when each design event is bridged into
// LearningActivityLog via activityLogger.track(). Admins can then filter the
// Activity Logs tab by `agent_design.*` or any specific leaf, and the 10-verb
// TNA pipeline keeps working (verbs come from SUBTYPE_VERB_MAP).
const EVENT_TYPE_SUBTYPE: Record<AgentDesignEventType, string> = {
  design_session_start: 'agent_design.session.start',
  design_session_end: 'agent_design.session.end',
  design_session_pause: 'agent_design.session.pause',
  design_session_resume: 'agent_design.session.resume',
  tab_switch: 'agent_design.tab.switch',
  tab_time_recorded: 'agent_design.tab.time_recorded',
  field_focus: 'agent_design.field.focus',
  field_blur: 'agent_design.field.blur',
  field_change: 'agent_design.field.change',
  field_paste: 'agent_design.field.paste',
  field_clear: 'agent_design.field.clear',
  role_selected: 'agent_design.role.selected',
  template_viewed: 'agent_design.template.viewed',
  template_applied: 'agent_design.template.applied',
  template_modified: 'agent_design.template.modified',
  personality_selected: 'agent_design.personality.selected',
  suggestion_viewed: 'agent_design.suggestion.viewed',
  suggestion_applied: 'agent_design.suggestion.applied',
  prompt_block_selected: 'agent_design.prompt_block.selected',
  prompt_block_removed: 'agent_design.prompt_block.removed',
  prompt_blocks_reordered: 'agent_design.prompt_block.reordered',
  prompt_block_custom_added: 'agent_design.prompt_block.custom_added',
  rule_added: 'agent_design.rule.added',
  rule_removed: 'agent_design.rule.removed',
  rule_edited: 'agent_design.rule.edited',
  rule_reordered: 'agent_design.rule.reordered',
  test_conversation_started: 'agent_design.test.conversation_started',
  test_message_sent: 'agent_design.test.message_sent',
  test_response_received: 'agent_design.test.response_received',
  test_conversation_reset: 'agent_design.test.conversation_reset',
  post_test_edit: 'agent_design.test.post_test_edit',
  draft_saved: 'agent_design.save.draft',
  submission_attempted: 'agent_design.save.submission_attempted',
  submission_completed: 'agent_design.save.submission_completed',
  unsubmit_requested: 'agent_design.save.unsubmit_requested',
};

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
  // Optional course context — when set, every bridged LearningActivityLog
  // row carries courseId so the admin Activity tab / TNA can filter by
  // course. Set via setCourseContext() from the builder page once the
  // assignment data has loaded.
  private courseId: number | null = null;

  // Per-field coalescing for `field_change` events. We keep the
  // first-seen previousValue and the latest newValue per fieldName while
  // the student is actively typing, and only flush ONE event when they
  // leave the field (blur), when an idle debounce fires, or when the
  // sitting ends. This turns a 50-keystroke edit into a single log row.
  private pendingFieldChanges: Map<
    string,
    {
      firstPrevious: string;
      latestNew: string;
      changeType: 'type' | 'paste' | 'select' | 'toggle' | 'click';
      timer: ReturnType<typeof setTimeout> | null;
    }
  > = new Map();
  private readonly FIELD_CHANGE_DEBOUNCE_MS = 1500;

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

    // Always emit a `design_session_start` event on every page open, even
    // when we're resuming a sitting within the SITTING_GAP_MS window. The
    // sitting-continuity model (same designSessionId, same sessionStartTime)
    // is preserved for timing analytics, but admins still get one
    // `started` row in the activity log every time the student actually
    // opens the builder.
    this.logEvent('design_session_start');
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

    this.flushAllPendingFieldChanges();
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
   * Attach the course this agent assignment belongs to. When set, every
   * bridged LearningActivityLog row carries `courseId`, so the admin Activity
   * Logs tab and the TNA dashboard can filter by course.
   */
  setCourseContext(courseId: number | null | undefined): void {
    this.courseId = courseId ?? null;
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

    // Dual-write to LearningActivityLog so admins without instructor access
    // can see the full agent-builder journey in admin/logs/activity and so
    // the TNA pipeline can sequence every field edit, role pick, template
    // application, test message, etc.
    this.bridgeToActivityLog(event);

    if (this.eventQueue.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Map an AgentDesignEvent onto the unified activity log. Best-effort — any
   * failure here must not break the primary design-log write path.
   */
  private bridgeToActivityLog(event: AgentDesignEvent): void {
    try {
      // Skip cursor / visibility mechanics that would flood the admin
      // Activity tab and TNA. Granular timeline still gets them via the
      // AgentDesignEventLog write path.
      if (BRIDGE_SKIP_EVENT_TYPES.has(event.eventType)) return;

      const actionSubtype = EVENT_TYPE_SUBTYPE[event.eventType];
      if (!actionSubtype) return;

      // Flatten every known AgentDesignEvent field into extensions so the
      // admin Activity tab sees the full context without joining another
      // table. Undefined entries are dropped.
      const ext: Record<string, unknown> = {
        assignmentId: this.assignmentId,
        agentConfigId: this.agentConfigId ?? undefined,
        designSessionId: this.designSessionId,
        version: event.version,
        activeTab: event.activeTab,
        totalDesignTime: event.totalDesignTime,
        fieldName: event.fieldName,
        previousValue: event.previousValue,
        newValue: event.newValue,
        changeType: event.changeType,
        characterCount: event.characterCount,
        wordCount: event.wordCount,
        timeOnTab: event.timeOnTab,
        usedTemplate: event.usedTemplate,
        templateName: event.templateName,
        usedSuggestion: event.usedSuggestion,
        suggestionSource: event.suggestionSource,
        roleSelected: event.roleSelected,
        personalitySelected: event.personalitySelected,
        promptBlockId: event.promptBlockId,
        promptBlockCategory: event.promptBlockCategory,
        selectedBlockIds: event.selectedBlockIds,
        testConversationId: event.testConversationId,
        testMessageCount: event.testMessageCount,
      };

      // Prefer a concise, human-readable title for the Activity Logs table.
      const title = event.fieldName
        ? `agent design · ${event.fieldName}`
        : event.templateName
          ? `agent design · ${event.templateName}`
          : event.roleSelected
            ? `agent design · role:${event.roleSelected}`
            : `agent design · ${event.eventType}`;

      void activityLogger.track({
        actionSubtype,
        objectId: this.agentConfigId ?? this.assignmentId,
        objectTitle: title,
        courseId: this.courseId ?? undefined,
        extensions: ext,
      });
    } catch {
      // never let telemetry break the builder
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
   * Log field focus. Also clears any stale pending coalesce state for this
   * field so the next keystroke seeds a fresh first-previous value.
   */
  logFieldFocus(fieldName: string): void {
    // Any lingering pending change from a previous focus session should be
    // flushed before we start a new one — otherwise blur-less tabs leave
    // orphaned state.
    this.flushPendingFieldChange(fieldName);
    this.logEvent('field_focus', { fieldName });
  }

  /**
   * Log field blur. Flushes the coalesced `field_change` event for this
   * field so every edit session produces exactly one change row, then
   * emits the focus-out event itself.
   */
  logFieldBlur(fieldName: string, value: string): void {
    this.flushPendingFieldChange(fieldName);
    this.logEvent('field_blur', {
      fieldName,
      characterCount: value.length,
      wordCount: countWords(value),
    });
  }

  /**
   * Log a field change. Instead of emitting one event per keystroke, we
   * coalesce consecutive calls for the same field into a single event:
   *
   *   - First call seeds the pending entry with the previousValue as it
   *     was at the start of this edit session.
   *   - Subsequent calls only update the `latestNew` value.
   *   - A 1.5s idle timer flushes as a safety net for callers that never
   *     fire blur (e.g. button-driven toggles in behaviour tab).
   *   - Blur / focus / session end flush immediately.
   *
   * The emitted event reports the transition from the first-captured
   * previousValue to the last-captured newValue — exactly the "one log per
   * edit session" the research team asked for.
   */
  logFieldChange(
    fieldName: string,
    previousValue: string,
    newValue: string,
    changeType: 'type' | 'paste' | 'select' | 'toggle' | 'click' = 'type'
  ): void {
    // No-op if the value didn't actually change (e.g. onChange fired but
    // the string is identical — happens with some controlled inputs).
    if (previousValue === newValue) return;

    const existing = this.pendingFieldChanges.get(fieldName);
    if (existing) {
      if (existing.timer) clearTimeout(existing.timer);
      existing.latestNew = newValue;
      existing.changeType = changeType;
      existing.timer = setTimeout(() => {
        this.flushPendingFieldChange(fieldName);
      }, this.FIELD_CHANGE_DEBOUNCE_MS);
      return;
    }

    this.pendingFieldChanges.set(fieldName, {
      firstPrevious: previousValue,
      latestNew: newValue,
      changeType,
      timer: setTimeout(() => {
        this.flushPendingFieldChange(fieldName);
      }, this.FIELD_CHANGE_DEBOUNCE_MS),
    });
  }

  /**
   * Flush the coalesced pending change for a single field as one
   * `field_change` event. Safe to call when there is nothing pending.
   */
  private flushPendingFieldChange(fieldName: string): void {
    const pending = this.pendingFieldChanges.get(fieldName);
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    this.pendingFieldChanges.delete(fieldName);

    // Don't emit if the final value matches the first-seen previousValue
    // (user typed and then undid their edit before leaving the field).
    if (pending.firstPrevious === pending.latestNew) return;

    this.logEvent('field_change', {
      fieldName,
      previousValue: pending.firstPrevious.substring(0, 500),
      newValue: pending.latestNew.substring(0, 500),
      changeType: pending.changeType,
      characterCount: pending.latestNew.length,
      wordCount: countWords(pending.latestNew),
    });
  }

  /**
   * Flush every pending field change. Called when the sitting ends, when
   * the page unloads, or when the logger is being torn down — guarantees
   * no in-flight edit is dropped.
   */
  private flushAllPendingFieldChanges(): void {
    const fieldNames = Array.from(this.pendingFieldChanges.keys());
    for (const fieldName of fieldNames) {
      this.flushPendingFieldChange(fieldName);
    }
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
   * Log test message sent. When `detail` is passed the full user text is
   * forwarded into both AgentDesignEventLog.newValue AND the bridged
   * LearningActivityLog extensions, so admins see the raw conversation in
   * admin/logs without opening the instructor-only Design Process view.
   */
  logTestMessageSent(
    conversationId: number,
    messageCount: number,
    detail?: {
      userMessage?: string;
      aiModel?: string;
      aiProvider?: string;
    }
  ): void {
    this.logEvent('test_message_sent', {
      testConversationId: conversationId,
      testMessageCount: messageCount,
      newValue: detail?.userMessage,
      characterCount: detail?.userMessage?.length,
      wordCount: detail?.userMessage ? countWords(detail.userMessage) : undefined,
      // aiModel / aiProvider flow through `...data` spread in emitUnsafe and
      // then onto extensions via bridgeToActivityLog — they aren't top-level
      // AgentDesignEvent columns, but we carry them for the activity log.
      ...(detail?.aiModel ? { templateName: `model:${detail.aiModel}` } : {}),
      ...(detail?.aiProvider ? { suggestionSource: `provider:${detail.aiProvider}` } : {}),
    });
  }

  /**
   * Log test response received with the full assistant message so admins
   * can replay the conversation from admin/logs.
   */
  logTestResponseReceived(
    conversationId: number,
    messageCount: number,
    detail?: {
      assistantMessage?: string;
      aiModel?: string;
      aiProvider?: string;
      responseTimeMs?: number;
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    }
  ): void {
    this.logEvent('test_response_received', {
      testConversationId: conversationId,
      testMessageCount: messageCount,
      newValue: detail?.assistantMessage,
      characterCount: detail?.assistantMessage?.length,
      wordCount: detail?.assistantMessage ? countWords(detail.assistantMessage) : undefined,
      timeOnTab: detail?.responseTimeMs,
      ...(detail?.aiModel ? { templateName: `model:${detail.aiModel}` } : {}),
      ...(detail?.aiProvider ? { suggestionSource: `provider:${detail.aiProvider}` } : {}),
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

    this.flushAllPendingFieldChanges();
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
