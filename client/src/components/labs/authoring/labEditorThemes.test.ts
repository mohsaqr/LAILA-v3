import { describe, it, expect } from 'vitest';
import {
  LAB_THEMES,
  resolveTheme,
  themeById,
  DEFAULT_LIGHT_THEME,
  DEFAULT_DARK_THEME,
} from './labEditorThemes';

/** Perceived luminance (ITU-R BT.601) — what "looks light/dark" actually means. */
const luminance = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

const WHITE = luminance('#ffffff');

describe('lab editor theme presets', () => {
  it('offers both light and dark presets to pick from', () => {
    expect(LAB_THEMES.filter(t => t.appearance === 'light').length).toBeGreaterThan(1);
    expect(LAB_THEMES.filter(t => t.appearance === 'dark').length).toBeGreaterThan(1);
  });

  it('gives every preset a unique id, or the picker would collide', () => {
    const ids = LAB_THEMES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(LAB_THEMES.map(t => [t.label, t] as const))(
    '%s declares a base matching its appearance',
    (_label, theme) => {
      expect(theme.def.base).toBe(theme.appearance === 'dark' ? 'vs-dark' : 'vs');
      // Without inherit, any scope the preset does not name renders unstyled.
      expect(theme.def.inherit).toBe(true);
    }
  );

  it.each(LAB_THEMES.map(t => [t.label, t] as const))(
    '%s has a surface that actually matches its appearance',
    (_label, theme) => {
      const bg = luminance(theme.def.colors['editor.background']);
      if (theme.appearance === 'dark') expect(bg).toBeLessThan(90);
      else expect(bg).toBeGreaterThan(180);
    }
  );

  it.each(LAB_THEMES.map(t => [t.label, t] as const))(
    '%s keeps the caret line distinct from the surface',
    (_label, theme) => {
      const bg = luminance(theme.def.colors['editor.background']);
      const line = luminance(theme.def.colors['editor.lineHighlightBackground']);
      // Same colour = the current line is invisible. Direction differs by
      // appearance, so assert separation rather than which way it goes.
      expect(Math.abs(bg - line)).toBeGreaterThan(4);
    }
  );

  it('never lets ANY light preset be white or near-white', () => {
    // The cell card is bg-white, so a white-ish editor dissolves into it. This
    // applies to every preset, including third-party ones: #f6f8fa (GitHub) and
    // #fdf6e3 (Solarized base3) both failed this and were replaced with their
    // greyer siblings rather than kept for fidelity.
    LAB_THEMES.filter(t => t.appearance === 'light').forEach(theme => {
      const bg = theme.def.colors['editor.background'];
      expect(bg.toLowerCase()).not.toBe('#ffffff');
      expect(WHITE - luminance(bg)).toBeGreaterThan(20);
    });
  });

  it('defaults to a DARK editor even when the app is in light mode', () => {
    // Asked for repeatedly. Code is a dark surface here whatever the app does;
    // the light presets are opt-in only.
    const fallback = LAB_THEMES.find(t => t.id === DEFAULT_LIGHT_THEME)!;
    expect(fallback.appearance).toBe('dark');
    expect(luminance(fallback.def.colors['editor.background'])).toBeLessThan(90);
  });

  it.each(LAB_THEMES.map(t => [t.label, t] as const))(
    '%s keeps every syntax colour readable against its own surface',
    (_label, theme) => {
      // A deeper grey surface can swallow tokens that looked fine on white.
      const bg = luminance(theme.def.colors['editor.background']);
      theme.def.rules.forEach(rule => {
        expect(Math.abs(bg - luminance(`#${rule.foreground}`))).toBeGreaterThan(55);
      });
    }
  );

});

describe('resolveTheme', () => {
  it('gives a dark editor by default in either app mode', () => {
    expect(resolveTheme(null, true).id).toBe(DEFAULT_DARK_THEME);
    expect(resolveTheme(null, false).id).toBe(DEFAULT_LIGHT_THEME);
    // The point of the above: neither default is a light surface.
    expect(themeById(resolveTheme(null, false).id)!.appearance).toBe('dark');
  });

  it('honours a picked theme over the app theme', () => {
    // Picking a light editor inside the dark app is a legitimate choice.
    expect(resolveTheme('solarized-light', true).id).toBe('solarized-light');
    expect(resolveTheme('dracula', false).id).toBe('dracula');
  });

  it('falls back rather than handing Monaco an unknown theme name', () => {
    // A preset removed in a later release would otherwise leave every editor
    // silently unstyled, since Monaco does not validate the name.
    expect(resolveTheme('deleted-in-v4', false).id).toBe(DEFAULT_LIGHT_THEME);
    expect(resolveTheme('', true).id).toBe(DEFAULT_DARK_THEME);
  });

  it('always returns a real theme, never undefined', () => {
    expect(themeById(resolveTheme('nonsense', false).id)).toBeTruthy();
  });
});
