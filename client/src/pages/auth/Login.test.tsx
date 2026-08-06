import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key,
  }),
}));

const login = vi.fn(() => Promise.resolve());
const navigate = vi.fn();

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ login }) }));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('../../store/languageStore', () => ({
  useLanguageStore: () => ({ language: 'en', setLanguage: vi.fn() }),
}));

// Importing the real config runs i18next's init, which needs the react-i18next
// plugin this file has just mocked away. Only the language table is wanted here.
vi.mock('../../i18n/config', () => ({
  supportedLanguages: {
    en: { nativeName: 'English' },
    ar: { nativeName: 'العربية' },
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

import { Login } from './Login';

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );

/** The form fields carry no label, so they are addressed by placeholder key. */
const emailField = () => screen.getByPlaceholderText('email_placeholder');
const passwordField = () => screen.getByPlaceholderText('password_placeholder');

beforeEach(() => {
  login.mockClear();
  navigate.mockClear();
});

describe('Login', () => {
  describe('the form still works after the redesign', () => {
    it('signs in with what was typed and lands on the return path', async () => {
      renderLogin();
      fireEvent.change(emailField(), { target: { value: 'student@laila.edu' } });
      fireEvent.change(passwordField(), { target: { value: 'hunter2' } });
      fireEvent.click(screen.getByRole('button', { name: 'sign_in' }));

      await waitFor(() => expect(login).toHaveBeenCalledWith('student@laila.edu', 'hunter2'));
      await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
    });

    it('reveals and re-hides the password', () => {
      renderLogin();
      expect(passwordField()).toHaveAttribute('type', 'password');

      fireEvent.click(screen.getByRole('button', { name: 'show_password' }));
      expect(passwordField()).toHaveAttribute('type', 'text');

      fireEvent.click(screen.getByRole('button', { name: 'hide_password' }));
      expect(passwordField()).toHaveAttribute('type', 'password');
    });

    it('lets a password manager fill both fields', () => {
      // Neither field carried an autocomplete hint before, so managers had to
      // guess at an unlabelled, placeholder-only form.
      renderLogin();
      expect(emailField()).toHaveAttribute('autocomplete', 'email');
      expect(passwordField()).toHaveAttribute('autocomplete', 'current-password');
    });
  });

  describe('the brand panel', () => {
    it('tells the platform story', () => {
      renderLogin();
      expect(screen.getByText('hero_headline')).toBeInTheDocument();
      // All four documented capabilities, not just the first.
      ['analytics', 'ai', 'labs', 'collab'].forEach(key => {
        expect(screen.getByText(`feature_${key}_title`)).toBeInTheDocument();
      });
    });

    it('never uses the opaque logo, which renders as a white box in dark mode', () => {
      renderLogin();
      const logos = screen.getAllByAltText('LAILA');
      expect(logos.length).toBeGreaterThan(0);
      logos.forEach(img => {
        expect(img).toHaveAttribute('src', '/icons/logo-mark.webp');
      });
    });
  });
});
