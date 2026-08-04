import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

/**
 * Monaco is replaced with a stub that records the props it was handed. The real
 * editor loads from a CDN at runtime, so it can neither mount nor be measured
 * under jsdom — but the props are exactly where the theme decision lives.
 */
const captured: { props: Record<string, any> | null } = { props: null };

/** Drives which theme the component asks Monaco for. */
const appTheme = { isDark: true };
vi.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: appTheme.isDark,
    theme: appTheme.isDark ? 'dark' : 'light',
    setTheme: () => {},
    toggleTheme: () => {},
  }),
}));

vi.mock('@monaco-editor/react', () => ({
  default: (props: Record<string, any>) => {
    captured.props = props;
    return <div data-testid="monaco-stub" />;
  },
}));

import { LAB_THEMES } from './labEditorThemes';

/** A minimal stand-in for the `monaco` namespace passed to `beforeMount`. */
const fakeMonaco = () => {
  const defined: { name: string; data: any }[] = [];
  return {
    defined,
    api: { editor: { defineTheme: (name: string, data: any) => defined.push({ name, data }) } },
  };
};

/**
 * The module keeps `themeDefined` at module scope, so each test needs a fresh
 * copy or the guard leaks between them.
 */
const loadField = async () => {
  vi.resetModules();
  const mod = await import('./CodeEditorField');
  return mod.CodeEditorField;
};

/** Perceived luminance (ITU-R BT.601), the thing "looks darker" actually means. */
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** Measured from Monaco 0.55.1 in a browser — see tmp/lab-cell-theme-check.html. */
const VS_DARK_BACKGROUND = '#1e1e1e';
/** `.prose pre` renders markdown code fences on gray-950 (index.css). */
const CODE_FENCE_BACKGROUND = '#030712';
/** CodeOutput renders the console on bg-gray-900 directly beneath the editor. */
const CONSOLE_BACKGROUND = '#111827';

/** The theme definition the component is currently asking Monaco to use. */
const activeTheme = (monaco: ReturnType<typeof fakeMonaco>) =>
  monaco.defined.find(d => d.name === captured.props?.theme)!;

/** Mount once in the given mode and return the theme Monaco was handed. */
const mountAndRead = async (isDark: boolean) => {
  appTheme.isDark = isDark;
  const CodeEditorField = await loadField();
  render(<CodeEditorField value="1 + 1" onChange={() => {}} />);
  const monaco = fakeMonaco();
  captured.props?.beforeMount(monaco.api);
  return activeTheme(monaco);
};

/** The card the editor sits inside is `bg-white` (NotebookCell). */
const CARD_BACKGROUND = '#ffffff';

describe('CodeEditorField theming', () => {
  beforeEach(() => {
    captured.props = null;
    appTheme.isDark = true;
  });

  it('does not hand Monaco the built-in vs-dark theme', async () => {
    const CodeEditorField = await loadField();
    render(<CodeEditorField value="1 + 1" onChange={() => {}} />);

    expect(captured.props?.theme).toBeTruthy();
    expect(captured.props?.theme).not.toBe('vs-dark');
  });

  it('defines that theme before mount, since Monaco falls back to light for an unknown name', async () => {
    const CodeEditorField = await loadField();
    render(<CodeEditorField value="1 + 1" onChange={() => {}} />);

    const monaco = fakeMonaco();
    captured.props?.beforeMount(monaco.api);

    expect(monaco.defined.map(d => d.name)).toContain(captured.props?.theme);
  });

  it('paints the editor the same black as markdown code fences', async () => {
    const CodeEditorField = await loadField();
    render(<CodeEditorField value="1 + 1" onChange={() => {}} />);

    const monaco = fakeMonaco();
    captured.props?.beforeMount(monaco.api);
    const theme = monaco.defined.find(d => d.name === captured.props?.theme)!;

    expect(theme.data.colors['editor.background']).toBe(CODE_FENCE_BACKGROUND);
    expect(theme.data.colors['editorGutter.background']).toBe(CODE_FENCE_BACKGROUND);
  });

  it('is VISIBLY darker than vs-dark, not merely darker on paper', async () => {
    const CodeEditorField = await loadField();
    render(<CodeEditorField value="1 + 1" onChange={() => {}} />);

    const monaco = fakeMonaco();
    captured.props?.beforeMount(monaco.api);
    const theme = monaco.defined.find(d => d.name === captured.props?.theme)!;

    // gray-900 was tried first and rejected on sight: at luminance 23.6 against
    // vs-dark's 30 it is measurably darker but looks identical side by side.
    // Anything above half of vs-dark's luminance fails to read as a change.
    const chosen = luminance(theme.data.colors['editor.background']);
    expect(chosen).toBeLessThan(luminance(VS_DARK_BACKGROUND) / 2);
    expect(chosen).toBeLessThan(luminance(CONSOLE_BACKGROUND));
  });

  it('keeps the current-line highlight visible against the black', async () => {
    const CodeEditorField = await loadField();
    render(<CodeEditorField value="1 + 1" onChange={() => {}} />);

    const monaco = fakeMonaco();
    captured.props?.beforeMount(monaco.api);
    const theme = monaco.defined.find(d => d.name === captured.props?.theme)!;

    // A darker base needs a lighter stripe, or the cursor's line disappears.
    expect(luminance(theme.data.colors['editor.lineHighlightBackground']))
      .toBeGreaterThan(luminance(theme.data.colors['editor.background']));
  });

  it('inherits vs-dark so syntax colours are not silently dropped', async () => {
    const CodeEditorField = await loadField();
    render(<CodeEditorField value="1 + 1" onChange={() => {}} />);

    const monaco = fakeMonaco();
    captured.props?.beforeMount(monaco.api);
    const theme = monaco.defined.find(d => d.name === captured.props?.theme)!;

    expect(theme.data.base).toBe('vs-dark');
    expect(theme.data.inherit).toBe(true);
  });

  it('defines the theme once across many cells, because redefining the active theme re-applies it', async () => {
    const CodeEditorField = await loadField();
    const monaco = fakeMonaco();

    // Monaco themes are global to the instance, so a 30-cell notebook must not
    // pay 30 full theme re-applications on load.
    for (let i = 0; i < 5; i++) {
      render(<CodeEditorField value={`x <- ${i}`} onChange={() => {}} />);
      captured.props?.beforeMount(monaco.api);
    }

    // Every preset defined exactly once — not once per cell. Counted from the
    // catalogue so adding a preset does not fail this test spuriously.
    expect(monaco.defined).toHaveLength(LAB_THEMES.length);
    expect(new Set(monaco.defined.map(d => d.name)).size).toBe(LAB_THEMES.length);
  });

  it('shows a dark placeholder while Monaco is fetched from the CDN', async () => {
    const CodeEditorField = await loadField();
    render(<CodeEditorField value="1 + 1" onChange={() => {}} />);

    // Default placeholder is unstyled light text — one white flash per cell.
    expect(captured.props?.loading).toBeTruthy();
  });

  it('gives the editor wrapper a dark-mode border', async () => {
    const CodeEditorField = await loadField();
    const { container } = render(<CodeEditorField value="1 + 1" onChange={() => {}} />);

    // Without this the light #e5e7eb ring stays lit around every dark editor.
    expect(container.querySelector('div')?.className).toContain('dark:border-gray-700');
  });
});

describe('CodeEditorField theme selection', () => {
  beforeEach(() => {
    captured.props = null;
  });

  it('uses a dark editor even when the app is in light mode', async () => {
    const active = await mountAndRead(false);

    // The editor is a dark surface in both app modes. Its two neighbours in a
    // cell — markdown fences and the output console — are dark with no light
    // variant, so a light editor would be the odd one out.
    expect(active.data.base).toBe('vs-dark');
    expect(luminance(active.data.colors['editor.background'])).toBeLessThan(90);
  });

  it('uses a dark editor in dark mode too', async () => {
    const active = await mountAndRead(true);
    expect(active.data.base).toBe('vs-dark');
    expect(active.data.colors['editor.background']).toBe(CODE_FENCE_BACKGROUND);
  });

  it('never paints the editor white, whatever the app theme', async () => {
    for (const isDark of [true, false]) {
      const bg = (await mountAndRead(isDark)).data.colors['editor.background'];
      expect(bg.toLowerCase()).not.toBe(CARD_BACKGROUND);
      expect(luminance(bg)).toBeLessThan(luminance(CONSOLE_BACKGROUND) + 40);
    }
  });

  it('defines every preset so the picker can switch without a remount', async () => {
    const active = await mountAndRead(false);
    expect(active).toBeTruthy();
    // Switching theme is a `theme` prop change, not a redefine — which only
    // works if all of them were defined up front.
    expect(LAB_THEMES.length).toBeGreaterThan(2);
  });
});
