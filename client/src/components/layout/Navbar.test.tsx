import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key,
  }),
}));

vi.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));

const logout = vi.fn();
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 7, fullname: 'Hamada', email: 'hamada@example.com', avatarUrl: null },
    isAuthenticated: true,
    isActualAdmin: true,
    isActualInstructor: false,
    viewAsRole: null,
    isViewingAs: false,
    setViewAs: vi.fn(),
    logout,
  }),
}));

vi.mock('../../store/languageStore', () => ({
  useLanguageStore: () => ({ language: 'en', setLanguage: vi.fn() }),
}));

vi.mock('../../i18n/config', () => ({
  supportedLanguages: { en: { nativeName: 'English' }, ar: { nativeName: 'العربية' } },
}));

vi.mock('../notifications/NotificationBell', () => ({ NotificationBell: () => <div /> }));
vi.mock('../common/ThemeToggle', () => ({ ThemeToggle: () => <button>theme</button> }));

import { Navbar } from './Navbar';

const renderNavbar = () =>
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );

/** The account menu's trigger is the only button carrying the user's name. */
const accountTrigger = () =>
  screen.getAllByRole('button').find(b => /Hamada/.test(b.textContent ?? ''))!;

const viewAsTrigger = () =>
  screen.getAllByRole('button').find(b => /view_as/.test(b.textContent ?? ''))!;

/** Sign Out only exists while the account menu is open. */
const accountMenuOpen = () => !!screen.queryByText('sign_out');

describe('Navbar dropdowns', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens the account menu from its trigger', () => {
    renderNavbar();
    expect(accountMenuOpen()).toBe(false);
    fireEvent.click(accountTrigger());
    expect(accountMenuOpen()).toBe(true);
  });

  it('closes on a click elsewhere on the page', () => {
    // The reported bug: this did nothing, so the menu looked stuck.
    renderNavbar();
    fireEvent.click(accountTrigger());
    fireEvent.mouseDown(document.body);
    expect(accountMenuOpen()).toBe(false);
  });

  it('closes on Escape', () => {
    renderNavbar();
    fireEvent.click(accountTrigger());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(accountMenuOpen()).toBe(false);
  });

  it('still toggles shut from its own trigger', () => {
    // The ref wraps the trigger as well as the panel. If it did not, the
    // trigger's own mousedown would read as an outside click and the menu
    // would close then immediately reopen.
    renderNavbar();
    fireEvent.click(accountTrigger());
    fireEvent.mouseDown(accountTrigger());
    fireEvent.click(accountTrigger());
    expect(accountMenuOpen()).toBe(false);
  });

  it('opening a neighbouring menu closes the account menu', () => {
    // They sit side by side and overlap when open; two stacked panels was the
    // other half of what "stuck" looked like.
    renderNavbar();
    fireEvent.click(accountTrigger());
    expect(accountMenuOpen()).toBe(true);

    fireEvent.click(viewAsTrigger());
    expect(accountMenuOpen()).toBe(false);
  });

  it('marks the trigger expanded so assistive tech follows the state', () => {
    renderNavbar();
    expect(accountTrigger()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(accountTrigger());
    expect(accountTrigger()).toHaveAttribute('aria-expanded', 'true');
  });
});
