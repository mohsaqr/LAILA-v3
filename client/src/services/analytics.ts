import apiClient from '../api/client';

// ============================================================================
// TYPES
// ============================================================================

export interface InteractionEvent {
  type: 'click' | 'page_view' | 'form_submit' | 'scroll' | 'focus' | 'blur' | 'hover' | 'custom';
  page: string;
  pageUrl?: string;
  pageTitle?: string;
  referrerUrl?: string;
  action: string;
  category?: string;
  label?: string;
  value?: number;
  elementId?: string;
  elementType?: string;
  elementText?: string;
  elementHref?: string;
  elementClasses?: string;
  elementName?: string;
  elementValue?: string;
  scrollDepth?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  metadata?: Record<string, unknown>;
  timestamp?: number;
  sessionDuration?: number;
  timeOnPage?: number;
  // Course context
  courseId?: number;
  moduleId?: number;
  lectureId?: number;
  // Section context
  sectionId?: number;
  sectionTitle?: string;
  sectionType?: string;
}

export interface ChatbotInteractionEvent {
  sectionId: number;
  conversationId?: number;
  conversationMessageCount?: number;
  messageIndex?: number;
  eventType: 'conversation_start' | 'message_sent' | 'message_received' | 'conversation_cleared' | 'error';
  eventSequence?: number;
  chatbotParams: {
    title?: string | null;
    intro?: string | null;
    imageUrl?: string | null;
    systemPrompt?: string | null;
    welcomeMessage?: string | null;
  };
  messageContent?: string;
  responseContent?: string;
  responseTime?: number;
  aiModel?: string;
  aiProvider?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

interface ClientInfo {
  userAgent: string;
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  screenWidth: number;
  screenHeight: number;
  language: string;
  timezone: string;
}

// ============================================================================
// BROWSER/DEVICE DETECTION
// ============================================================================

function detectBrowser(): { name: string; version: string } {
  const ua = navigator.userAgent;

  // Chrome
  if (ua.includes('Chrome') && !ua.includes('Chromium') && !ua.includes('Edg')) {
    const match = ua.match(/Chrome\/(\d+\.\d+)/);
    return { name: 'Chrome', version: match?.[1] || 'unknown' };
  }

  // Firefox
  if (ua.includes('Firefox')) {
    const match = ua.match(/Firefox\/(\d+\.\d+)/);
    return { name: 'Firefox', version: match?.[1] || 'unknown' };
  }

  // Safari
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+\.\d+)/);
    return { name: 'Safari', version: match?.[1] || 'unknown' };
  }

  // Edge
  if (ua.includes('Edg')) {
    const match = ua.match(/Edg\/(\d+\.\d+)/);
    return { name: 'Edge', version: match?.[1] || 'unknown' };
  }

  // Opera
  if (ua.includes('OPR')) {
    const match = ua.match(/OPR\/(\d+\.\d+)/);
    return { name: 'Opera', version: match?.[1] || 'unknown' };
  }

  return { name: 'Unknown', version: 'unknown' };
}

function detectOS(): { name: string; version: string } {
  const ua = navigator.userAgent;

  // Windows
  if (ua.includes('Windows')) {
    if (ua.includes('Windows NT 10.0')) return { name: 'Windows', version: '10/11' };
    if (ua.includes('Windows NT 6.3')) return { name: 'Windows', version: '8.1' };
    if (ua.includes('Windows NT 6.2')) return { name: 'Windows', version: '8' };
    if (ua.includes('Windows NT 6.1')) return { name: 'Windows', version: '7' };
    return { name: 'Windows', version: 'unknown' };
  }

  // macOS
  if (ua.includes('Mac OS X')) {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    return { name: 'macOS', version: match?.[1]?.replace('_', '.') || 'unknown' };
  }

  // iOS
  if (ua.includes('iPhone') || ua.includes('iPad')) {
    const match = ua.match(/OS (\d+_\d+)/);
    return { name: 'iOS', version: match?.[1]?.replace('_', '.') || 'unknown' };
  }

  // Android
  if (ua.includes('Android')) {
    const match = ua.match(/Android (\d+\.?\d*)/);
    return { name: 'Android', version: match?.[1] || 'unknown' };
  }

  // Linux
  if (ua.includes('Linux')) {
    return { name: 'Linux', version: 'unknown' };
  }

  return { name: 'Unknown', version: 'unknown' };
}

function detectDeviceType(): 'desktop' | 'tablet' | 'mobile' {
  const ua = navigator.userAgent;

  // Tablets
  if (ua.includes('iPad') || (ua.includes('Android') && !ua.includes('Mobile'))) {
    return 'tablet';
  }

  // Mobile
  if (/iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

function getClientInfo(): ClientInfo {
  const browser = detectBrowser();
  const os = detectOS();

  return {
    userAgent: navigator.userAgent,
    browserName: browser.name,
    browserVersion: browser.version,
    osName: os.name,
    osVersion: os.version,
    deviceType: detectDeviceType(),
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

// ============================================================================
// COURSE CONTEXT EXTRACTION
// ============================================================================

// Helper to safely parse int, returning undefined for NaN
const safeParseInt = (val: string | null | undefined): number | undefined => {
  if (!val) return undefined;
  const num = parseInt(val, 10);
  return isNaN(num) ? undefined : num;
};

interface FullContext {
  courseId?: number;
  moduleId?: number;
  lectureId?: number;
  sectionId?: number;
  sectionTitle?: string;
  sectionType?: string;
}

function extractCourseContext(element?: HTMLElement | null): FullContext {
  const path = window.location.pathname;

  // Match patterns like /learn/123, /learn/123/lecture/456, /courses/123, /teach/courses/123
  const courseMatch = path.match(/(?:learn|courses|teach\/courses)\/(\d+)/);
  const lectureMatch = path.match(/lecture\/(\d+)/);

  // Try to get context from data attributes on the page (set by the Learn component)
  const contextEl = document.querySelector('[data-analytics-context]');
  let dataContext: FullContext = {};

  if (contextEl) {
    const contextData = contextEl.getAttribute('data-analytics-context');
    if (contextData) {
      try {
        dataContext = JSON.parse(contextData);
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  // Also check for individual data attributes as fallback
  const courseEl = document.querySelector('[data-course-id]');
  const moduleEl = document.querySelector('[data-module-id]');
  const lectureEl = document.querySelector('[data-lecture-id]');

  // Try to find section context from the clicked element's parents
  let sectionId: number | undefined;
  let sectionTitle: string | undefined;
  let sectionType: string | undefined;

  if (element) {
    const sectionEl = element.closest('[data-section-id]');
    if (sectionEl) {
      sectionId = safeParseInt(sectionEl.getAttribute('data-section-id'));
      sectionTitle = sectionEl.getAttribute('data-section-title') || undefined;
      sectionType = sectionEl.getAttribute('data-section-type') || undefined;
    }
  }

  return {
    courseId: dataContext.courseId || safeParseInt(courseMatch?.[1]) || safeParseInt(courseEl?.getAttribute('data-course-id')),
    moduleId: dataContext.moduleId || safeParseInt(moduleEl?.getAttribute('data-module-id')),
    lectureId: dataContext.lectureId || safeParseInt(lectureMatch?.[1]) || safeParseInt(lectureEl?.getAttribute('data-lecture-id')),
    sectionId,
    sectionTitle,
    sectionType,
  };
}

// ============================================================================
// ANALYTICS SERVICE
// ============================================================================

class AnalyticsService {
  private sessionId: string;
  private sessionStartTime: number;
  private pendingEvents: InteractionEvent[] = [];
  private flushInterval: number | null = null;
  private isInitialized = false;
  private debugMode = false;
  private clientInfo: ClientInfo | null = null;
  private pageLoadTime: number = Date.now();
  private eventSequence: number = 0;
  private testMode: string | null = null; // 'test_instructor', 'test_student', etc.

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
  }

  // Set test mode for "View As" feature (admin testing roles)
  setTestMode(mode: string | null) {
    this.testMode = mode;
    if (this.debugMode) {
      console.log('[Analytics] Test mode set:', mode || 'disabled');
    }
  }

  getTestMode(): string | null {
    return this.testMode;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getSessionStartTime(): number {
    return this.sessionStartTime;
  }

  getSessionDuration(): number {
    return Math.round((Date.now() - this.sessionStartTime) / 1000);
  }

  getTimeOnPage(): number {
    return Math.round((Date.now() - this.pageLoadTime) / 1000);
  }

  private getNextEventSequence(): number {
    return ++this.eventSequence;
  }

  initialize(options: { debug?: boolean; flushIntervalMs?: number } = {}) {
    if (this.isInitialized) return;

    this.debugMode = options.debug || false;
    this.clientInfo = getClientInfo();

    // Set up auto-flush every 30 seconds (or custom interval)
    const flushMs = options.flushIntervalMs || 30000;
    this.flushInterval = window.setInterval(() => {
      this.flush();
    }, flushMs);

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush(true);
    });

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flush();
      }
    });

    // Track page load time changes
    window.addEventListener('popstate', () => {
      this.pageLoadTime = Date.now();
    });

    // Auto-track clicks on interactive elements
    this.setupAutoTracking();

    this.isInitialized = true;

    if (this.debugMode) {
      console.log('[Analytics] Initialized', {
        sessionId: this.sessionId,
        clientInfo: this.clientInfo,
      });
    }
  }

  private setupAutoTracking() {
    // Global click tracking
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Find the nearest trackable element
      const trackable = target.closest('button, a, [data-track], input[type="submit"], input[type="checkbox"], input[type="radio"]');
      if (!trackable) return;

      const element = trackable as HTMLElement;
      // Pass the element to extract section context from its parent elements
      const courseContext = extractCourseContext(element);

      this.trackClick({
        elementId: element.id || undefined,
        elementType: element.tagName.toLowerCase(),
        elementText: this.getElementText(element),
        elementValue: this.getElementValue(element),
        elementHref: (element as HTMLAnchorElement).href || undefined,
        elementClasses: element.className || undefined,
        elementName: element.getAttribute('name') || undefined,
        category: element.dataset.trackCategory || this.inferCategory(element),
        label: element.dataset.trackLabel,
        ...courseContext,
        metadata: {
          dataTrack: element.dataset.track || undefined,
          ariaLabel: element.getAttribute('aria-label') || undefined,
        },
      });
    }, { capture: true });

    // Form submission tracking
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      if (!form) return;

      this.trackFormSubmit({
        elementId: form.id || undefined,
        elementType: 'form',
        elementName: form.name || undefined,
        category: 'form',
        metadata: {
          action: form.action,
          method: form.method,
        },
      });
    }, { capture: true });

    // Scroll depth tracking (throttled)
    let scrollTimeout: number | null = null;
    let maxScrollDepth = 0;
    document.addEventListener('scroll', () => {
      if (scrollTimeout) return;
      scrollTimeout = window.setTimeout(() => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollDepth = scrollHeight > 0 ? Math.round((window.scrollY / scrollHeight) * 100) : 0;
        if (scrollDepth > maxScrollDepth) {
          maxScrollDepth = scrollDepth;
          // Only track at 25%, 50%, 75%, 100% thresholds
          if ([25, 50, 75, 100].includes(maxScrollDepth)) {
            this.track({
              type: 'scroll',
              page: window.location.pathname,
              pageUrl: window.location.href,
              pageTitle: document.title,
              action: `scroll_${maxScrollDepth}`,
              category: 'engagement',
              scrollDepth: maxScrollDepth,
              viewportWidth: window.innerWidth,
              viewportHeight: window.innerHeight,
            });
          }
        }
        scrollTimeout = null;
      }, 100);
    }, { passive: true });
  }

  private inferCategory(element: HTMLElement): string {
    // Infer category based on element location or type
    if (element.closest('nav')) return 'navigation';
    if (element.closest('form')) return 'form';
    if (element.closest('header')) return 'header';
    if (element.closest('footer')) return 'footer';
    if (element.closest('[role="dialog"]') || element.closest('.modal')) return 'modal';
    if (element.tagName === 'A') return 'link';
    if (element.tagName === 'BUTTON') return 'button';
    return 'content';
  }

  private getElementText(element: HTMLElement): string {
    const text = element.textContent?.trim() ||
                 element.getAttribute('aria-label') ||
                 element.getAttribute('title') ||
                 element.getAttribute('alt') ||
                 '';
    return text.substring(0, 200);
  }

  private getElementValue(element: HTMLElement): string | undefined {
    if (element instanceof HTMLInputElement) {
      if (element.type === 'password') return '[REDACTED]';
      if (element.type === 'checkbox' || element.type === 'radio') {
        return element.checked ? 'checked' : 'unchecked';
      }
      return undefined; // Don't log text input values
    }
    if (element instanceof HTMLSelectElement) {
      return element.options[element.selectedIndex]?.text;
    }
    return undefined;
  }

  // Track page view with full context
  trackPageView(page: string, metadata?: Record<string, unknown>) {
    this.pageLoadTime = Date.now();
    const courseContext = extractCourseContext();

    this.track({
      type: 'page_view',
      page,
      pageUrl: window.location.href,
      pageTitle: document.title,
      referrerUrl: document.referrer || undefined,
      action: 'view',
      category: 'navigation',
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      ...courseContext,
      metadata: {
        ...metadata,
        historyLength: window.history.length,
      },
    });
  }

  // Track click with full context
  trackClick(options: {
    elementId?: string;
    elementType?: string;
    elementText?: string;
    elementValue?: string;
    elementHref?: string;
    elementClasses?: string;
    elementName?: string;
    category?: string;
    label?: string;
    value?: number;
    courseId?: number;
    moduleId?: number;
    lectureId?: number;
    sectionId?: number;
    sectionTitle?: string;
    sectionType?: string;
    metadata?: Record<string, unknown>;
  }) {
    this.track({
      type: 'click',
      page: window.location.pathname,
      pageUrl: window.location.href,
      pageTitle: document.title,
      action: 'click',
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      ...options,
    });
  }

  // Track form submission
  trackFormSubmit(options: {
    elementId?: string;
    elementType?: string;
    elementName?: string;
    category?: string;
    metadata?: Record<string, unknown>;
  }) {
    this.track({
      type: 'form_submit',
      page: window.location.pathname,
      pageUrl: window.location.href,
      pageTitle: document.title,
      action: 'submit',
      ...options,
    });
  }

  // Track custom event
  trackCustom(action: string, options?: {
    category?: string;
    label?: string;
    value?: number;
    metadata?: Record<string, unknown>;
  }) {
    const courseContext = extractCourseContext();
    this.track({
      type: 'custom',
      page: window.location.pathname,
      pageUrl: window.location.href,
      pageTitle: document.title,
      action,
      ...courseContext,
      ...options,
    });
  }

  // Core track method
  private track(event: InteractionEvent) {
    const enrichedEvent: InteractionEvent = {
      ...event,
      timestamp: Date.now(),
      sessionDuration: this.getSessionDuration(),
      timeOnPage: this.getTimeOnPage(),
    };

    this.pendingEvents.push(enrichedEvent);

    if (this.debugMode) {
      console.log('[Analytics] Event tracked:', enrichedEvent);
    }

    // Auto-flush if we have too many pending events
    if (this.pendingEvents.length >= 50) {
      this.flush();
    }
  }

  // Flush events to server
  async flush(sync = false) {
    if (this.pendingEvents.length === 0) return;

    const eventsToSend = [...this.pendingEvents];
    this.pendingEvents = [];

    const payload = {
      sessionId: this.sessionId,
      sessionStartTime: this.sessionStartTime,
      events: eventsToSend,
      testMode: this.testMode, // Include test mode flag for "View As" feature
      ...this.clientInfo,
    };

    try {
      if (sync && navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/analytics/interactions',
          JSON.stringify(payload)
        );
      } else {
        await apiClient.post('/analytics/interactions', payload);
      }

      if (this.debugMode) {
        console.log('[Analytics] Flushed', eventsToSend.length, 'events');
      }
    } catch (error) {
      this.pendingEvents = [...eventsToSend, ...this.pendingEvents];
      if (this.debugMode) {
        console.error('[Analytics] Failed to flush events:', error);
      }
    }
  }

  // Track chatbot interactions with FULL context
  async trackChatbotInteraction(event: ChatbotInteractionEvent) {
    const sequence = this.getNextEventSequence();

    // Always log chatbot events for debugging
    console.log('[Analytics] Sending chatbot event:', event.eventType, {
      sectionId: event.sectionId,
      hasMessageContent: !!event.messageContent,
      hasResponseContent: !!event.responseContent,
    });

    try {
      const response = await apiClient.post('/analytics/chatbot-interaction', {
        sessionId: this.sessionId,
        sessionStartTime: this.sessionStartTime,
        eventSequence: sequence,
        ...event,
        timestamp: Date.now(),
        testMode: this.testMode, // Include test mode flag for "View As" feature
        // Include all client info
        ...this.clientInfo,
      });

      console.log('[Analytics] Chatbot event saved successfully:', {
        eventType: event.eventType,
        responseId: response?.data?.id,
      });

      if (this.debugMode) {
        console.log('[Analytics] Chatbot interaction tracked:', {
          sequence,
          eventType: event.eventType,
          sectionId: event.sectionId,
        });
      }
    } catch (error) {
      // Always log errors for chatbot interactions
      console.error('[Analytics] Failed to track chatbot interaction:', error);
    }
  }

  // Cleanup
  destroy() {
    if (this.flushInterval) {
      window.clearInterval(this.flushInterval);
    }
    this.flush(true);
    this.isInitialized = false;
  }
}

// Singleton instance
export const analytics = new AnalyticsService();

// React hook for tracking page views
export function usePageTracking(pageName: string, metadata?: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    analytics.trackPageView(pageName, metadata);
  }
}

export default analytics;
