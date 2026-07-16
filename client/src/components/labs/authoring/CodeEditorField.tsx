import { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

export type CodeLanguage = 'r' | 'python';

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
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={v => onChange(v ?? '')}
        onMount={handleMount}
        theme="vs-dark"
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
