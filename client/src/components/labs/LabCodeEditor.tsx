import { useRef, useEffect } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '../common/Button';
import { useTheme } from '../../hooks/useTheme';

interface LabCodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  onRun: () => void;
  isExecuting: boolean;
  isReady: boolean;
}

export const LabCodeEditor = ({
  code,
  onChange,
  onRun,
  isExecuting,
  isReady,
}: LabCodeEditorProps) => {
  const { isDark } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle keyboard shortcut (Ctrl/Cmd + Enter to run)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (isReady && !isExecuting) {
        onRun();
      }
    }

    // Handle Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = code.substring(0, start) + '  ' + code.substring(end);
        onChange(newValue);
        // Set cursor position after indent
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(200, textareaRef.current.scrollHeight)}px`;
    }
  }, [code]);

  const colors = {
    bg: isDark ? '#1e1e1e' : '#fafafa',
    border: isDark ? '#374151' : '#e5e7eb',
    text: isDark ? '#e5e7eb' : '#1f2937',
    placeholder: isDark ? '#6b7280' : '#9ca3af',
    lineNumbers: isDark ? '#6b7280' : '#9ca3af',
    lineNumbersBg: isDark ? '#111827' : '#f3f4f6',
  };

  return (
    <div
      className="rounded-lg overflow-hidden border"
      style={{ borderColor: colors.border }}
    >
      {/* Editor Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{
          backgroundColor: isDark ? '#111827' : '#f9fafb',
          borderColor: colors.border,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{
              backgroundColor: isDark ? '#1e40af' : '#dbeafe',
              color: isDark ? '#93c5fd' : '#1e40af',
            }}
          >
            R
          </span>
          <span className="text-xs" style={{ color: colors.placeholder }}>
            Press Ctrl+Enter to run
          </span>
        </div>
        <Button
          size="sm"
          onClick={onRun}
          disabled={!isReady || isExecuting}
          icon={isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        >
          {isExecuting ? 'Running...' : 'Run'}
        </Button>
      </div>

      {/* Code Editor */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="# Enter your R code here..."
          spellCheck={false}
          className="w-full p-4 font-mono text-sm resize-none focus:outline-none"
          style={{
            backgroundColor: colors.bg,
            color: colors.text,
            minHeight: '200px',
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
};
