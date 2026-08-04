import { useSyncExternalStore, useCallback } from 'react';

const KEY = 'laila.labEditorTheme';

/**
 * The picked editor theme, shared by every mounted code cell.
 *
 * `useState` in the picker would not do: Monaco themes are global, so when the
 * picker changes the theme every editor must be told to re-read it. A tiny
 * external store lets all of them subscribe without threading a prop through
 * the notebook and every cell.
 */
const listeners = new Set<() => void>();

let current: string | null = (() => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    // Safari in private mode throws on localStorage access. A missing
    // preference is survivable; a crashed lab page is not.
    return null;
  }
})();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const getSnapshot = () => current;

export const setEditorTheme = (id: string) => {
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Preference is lost on reload but the session still works.
  }
  listeners.forEach(fn => fn());
};

/** `[storedThemeId, setThemeId]` — null means "follow the app theme". */
export const useEditorTheme = (): [string | null, (id: string) => void] => [
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot),
  useCallback(setEditorTheme, []),
];
