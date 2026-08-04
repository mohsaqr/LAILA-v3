import { useRef } from 'react';
import Editor, { BeforeMount, OnMount } from '@monaco-editor/react';
import { useTheme } from '../../../hooks/useTheme';
import { LAB_THEMES, resolveTheme } from './labEditorThemes';
import { useEditorTheme } from '../../../hooks/useEditorTheme';

export type CodeLanguage = 'r' | 'python';

/**
 * Every preset is defined up front, once per monaco instance. Themes are global
 * rather than per-editor, so switching is a `theme` prop change — no redefine,
 * no editor teardown. Defining them all costs one pass and makes the picker
 * instant.
 */
let themesDefined = false;

const defineLabThemes: BeforeMount = monaco => {
  if (themesDefined) return;
  themesDefined = true;
  LAB_THEMES.forEach(({ id, def }) => monaco.editor.defineTheme(id, def));
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
  const { isDark } = useTheme();
  const [storedTheme] = useEditorTheme();
  const active = resolveTheme(storedTheme, isDark);
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
        beforeMount={defineLabThemes}
        onMount={handleMount}
        theme={active.id}
        // Monaco is fetched from a CDN at runtime, so there is a real gap before
        // it paints — once per cell. The library's default placeholder has no
        // background of its own, so the gap shows the cell card (gray-800) and
        // then jumps to the editor's near-black. Filling it with the editor's
        // own colour removes the jump.
        loading={
          <div
            className="w-full h-full flex items-center justify-center text-xs text-gray-500"
            style={{
              minHeight: typeof height === 'number' ? height : undefined,
              // The picked theme's own surface, so the CDN gap does not flash a
              // different colour than the editor that replaces it.
              backgroundColor: active.def.colors['editor.background'],
            }}
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
