// Analytics utility functions for learning event logging

// Generate or retrieve a persistent session ID
export function getSessionId(): string {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}

// Get client device/browser info
export function getClientInfo(): { deviceType: string; browserName: string; timezone: string } {
  const userAgent = navigator.userAgent;

  // Detect device type
  let deviceType = 'desktop';
  if (/Mobi|Android/i.test(userAgent)) {
    deviceType = 'mobile';
  } else if (/Tablet|iPad/i.test(userAgent)) {
    deviceType = 'tablet';
  }

  // Detect browser
  let browserName = 'unknown';
  if (userAgent.includes('Firefox')) {
    browserName = 'Firefox';
  } else if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browserName = 'Chrome';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browserName = 'Safari';
  } else if (userAgent.includes('Edg')) {
    browserName = 'Edge';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browserName = 'Opera';
  }

  // Get timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return { deviceType, browserName, timezone };
}
