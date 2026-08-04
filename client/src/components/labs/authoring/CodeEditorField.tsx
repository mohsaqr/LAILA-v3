import { useRef } from 'react';
import Editor, { BeforeMount, OnMount } from '@monaco-editor/react';

export type CodeLanguage = 'r' | 'python';

const LAB_THEME = 'laila-dark';

/**
 * The editor surface, matching the black of markdown code fences
 * (`.prose pre` is gray-950 in `index.css`).
 *
 * Monaco paints its own background from its own theme system — no Tailwind
 * class or `index.css` rule reaches inside `.monaco-editor` — so defining a
 * theme is the only supported way to change it. Built-in `vs-dark` uses
 * #1e1e1e, which is *lighter* than both the console below (gray-900) and the
 * code fences, leaving the surface authors and students stare at as the palest
 * of the three.
 *
 * Gray-900 was the other candidate and was rejected: at a perceived luminance
 * of 23.6 against vs-dark's 30 it is measurably darker but not visibly so.
 * Gray-950 lands at 7.05, which is the change people actually see.
 */
const EDITOR_BACKGROUND = '#030712'; // gray-950, as .prose pre
const LINE_HIGHLIGHT = '#111827'; // gray-900 — a visible lift off the black

/**
 * Monaco's standalone themes are global to the monaco instance, not per-editor,
 * so one definition covers every cell — and re-defining the *current* theme
 * forces a full re-apply, which we would otherwise pay once per mounted cell.
 * CodeEditorField is the app's only Monaco consumer, so nothing else can be
 * repainted by this.
 */
let themeDefined = false;

const defineLabTheme: BeforeMount = monaco => {
  if (themeDefined) return;
  themeDefined = true;
  monaco.editor.defineTheme(LAB_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': EDITOR_BACKGROUND,
      'editorGutter.background': EDITOR_BACKGROUND,
      'editor.lineHighlightBackground': LINE_HIGHLIGHT,
      'editorLineNumber.foreground': '#6b7280',
    },
  });
};

interface CodeEditorFieldProps {
  value: string;
  onChange: (value: string) => void;
  language?: CodeLanguage;
  height?: string | number;
  readOnly?: boolean;
  onBlur?: () => void;
  onSave?: () => void;
  /** Bound to Ctrl/Cmd+Enter — the universal "run this cell" gesture. */
  onRun?: () => void;
  ariaLabel?: string;
}

/**
 * Monaco wrapper shared by the lab authoring surfaces and the student runner,
 * so instructors edit code in the same editor their students get.
 */
export const CodeEditorField = ({
  value,
  onChange,
  language = 'r',
  height = '200px',
  readOnly = false,
  onBlur,
  onSave,
  onRun,
  ariaLabel,
}: CodeEditorFieldProps) => {
  // Blur/save fire from Monaco's own listeners, which close over the handlers
  // given at mount; refs keep them pointing at the current render's props.
  const onBlurRef = useRef(onBlur);
  const onSaveRef = useRef(onSave);
  const onRunRef = useRef(onRun);
  onBlurRef.current = onBlur;
  onSaveRef.current = onSave;
  onRunRef.current = onRun;

  const handleMount: OnMount = (editor, monaco) => {
    editor.onDidBlurEditorWidget(() => onBlurRef.current?.());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSaveRef.current?.());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current?.());
    if (ariaLabel) editor.updateOptions({ ariaLabel });
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={v => onChange(v ?? '')}
        beforeMount={defineLabTheme}
        onMount={handleMount}
        theme={LAB_THEME}
        // Monaco is fetched from a CDN at runtime, so there is a real gap before
        // it paints — once per cell. The library's default placeholder has no
        // background of its own, so the gap shows the cell card (gray-800) and
        // then jumps to the editor's near-black. Filling it with the editor's
        // own colour removes the jump.
        loading={
          <div
            className="w-full h-full bg-gray-950 flex items-center justify-center text-xs text-gray-500"
            style={{ minHeight: typeof height === 'number' ? height : undefined }}
          >
            …
          </div>
        }
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 10, bottom: 10 },
          readOnly,
        }}
      />
    </div>
  );
};
