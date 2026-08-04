import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key,
  }),
}));

const appTheme = { isDark: false };
vi.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({ isDark: appTheme.isDark, theme: 'light', setTheme: () => {}, toggleTheme: () => {} }),
}));

import { EditorThemePicker } from './EditorThemePicker';
import { LAB_THEMES, DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from '../authoring/labEditorThemes';
import { setEditorTheme } from '../../../hooks/useEditorTheme';

const select = () => screen.getByRole('combobox') as HTMLSelectElement;

describe('EditorThemePicker', () => {
  beforeEach(() => {
    appTheme.isDark = false;
    localStorage.clear();
    setEditorTheme(DEFAULT_LIGHT_THEME);
  });

  it('lists every preset', () => {
    render(<EditorThemePicker />);
    LAB_THEMES.forEach(theme => {
      expect(within(select()).getByText(theme.label)).toBeTruthy();
    });
  });

  it('groups them by light and dark so the list is scannable', () => {
    render(<EditorThemePicker />);
    const groups = select().querySelectorAll('optgroup');
    expect([...groups].map(g => g.label)).toEqual(['Light', 'Dark']);
  });

  it('shows the app-appropriate default when nothing has been picked', () => {
    setEditorTheme('');
    appTheme.isDark = true;
    render(<EditorThemePicker />);
    expect(select().value).toBe(DEFAULT_DARK_THEME);
  });

  it('remembers the pick across a remount', () => {
    const { unmount } = render(<EditorThemePicker />);
    fireEvent.change(select(), { target: { value: 'dracula' } });
    expect(select().value).toBe('dracula');

    unmount();
    render(<EditorThemePicker />);
    // Students set this once; losing it on every navigation would be worse
    // than not offering the control at all.
    expect(select().value).toBe('dracula');
  });

  it('writes the pick to localStorage so it survives a reload', () => {
    // src/test/setup.ts replaces localStorage with no-op spies, so this asserts
    // the write happened rather than reading it back — reading back would pass
    // even if setItem were never called, because the store caches in memory.
    render(<EditorThemePicker />);
    fireEvent.change(select(), { target: { value: 'solarized-dark' } });
    expect(localStorage.setItem).toHaveBeenCalledWith('laila.labEditorTheme', 'solarized-dark');
  });

  it('survives localStorage throwing, as it does in Safari private mode', () => {
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError');
    });
    render(<EditorThemePicker />);

    // The preference is lost on reload, but the lab must not crash.
    expect(() => fireEvent.change(select(), { target: { value: 'dracula' } })).not.toThrow();
    expect(select().value).toBe('dracula');
  });

  it('lets a dark-app user choose a light editor', () => {
    appTheme.isDark = true;
    render(<EditorThemePicker />);
    // Named from the catalogue: hardcoding an id let this test outlive the
    // preset it referenced, and it then failed for the wrong reason.
    const light = LAB_THEMES.find(t => t.appearance === 'light')!.id;

    fireEvent.change(select(), { target: { value: light } });
    expect(select().value).toBe(light);
  });

  it('has an accessible name, since the trigger is only an icon', () => {
    render(<EditorThemePicker />);
    expect(screen.getByText('Editor theme')).toBeTruthy();
  });

  it('updates every subscriber, because Monaco themes are global', () => {
    // Two pickers stand in for the picker plus every mounted code cell: they
    // read one shared store, so one change moves all of them.
    render(<EditorThemePicker />);
    render(<EditorThemePicker />);
    const [first, second] = screen.getAllByRole('combobox') as HTMLSelectElement[];

    fireEvent.change(first, { target: { value: 'solarized-light' } });
    expect(second.value).toBe('solarized-light');
  });
});
