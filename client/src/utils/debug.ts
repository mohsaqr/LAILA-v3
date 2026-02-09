/**
 * Debug logging utility that only logs in development mode.
 * Use this instead of console.log for development-only logging.
 */

const isDev = import.meta.env.DEV;

export const debug = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn('[DEBUG]', ...args);
    }
  },
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error('[DEBUG]', ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info('[DEBUG]', ...args);
    }
  },
  /**
   * Log WebR-specific messages
   */
  webr: (...args: unknown[]) => {
    if (isDev) {
      console.log('[WebR]', ...args);
    }
  },
};

export default debug;
