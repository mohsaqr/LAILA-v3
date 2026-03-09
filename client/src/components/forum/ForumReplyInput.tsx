import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Bot, X, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, ImagePlus, Link as LinkIcon, Undo, Redo, Code } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { useTheme } from '../../hooks/useTheme';
import { ForumAgentSelector } from './ForumAgentSelector';
import { Button } from '../common/Button';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/auth';
import { compressImage } from '../../utils/imageCompress';
import type { TutorAgent } from '../../api/forums';

interface ForumReplyInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onAiRequest?: (agent: TutorAgent) => void;
  agents: TutorAgent[];
  placeholder?: string;
  disabled?: boolean;
  isSubmitting?: boolean;
  isAiLoading?: boolean;
  replyingToName?: string;
  onCancelReply?: () => void;
  showAgentSelector?: boolean;
}

export const ForumReplyInput = ({
  value,
  onChange,
  onSubmit,
  onAiRequest,
  agents,
  placeholder,
  disabled = false,
  isSubmitting = false,
  isAiLoading = false,
  replyingToName,
  onCancelReply,
  showAgentSelector = true,
}: ForumReplyInputProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();
  const effectivePlaceholder = placeholder || t('write_your_reply');

  const [selectedAgent, setSelectedAgent] = useState<TutorAgent | null>(null);
  const [showAgentChips, setShowAgentChips] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgInput: isDark ? '#374151' : '#ffffff',
    bgHover: isDark ? '#4b5563' : '#f3f4f6',
    border: isDark ? '#4b5563' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    accent: '#0891b2',
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-cyan-600 underline' } }),
      Placeholder.configure({ placeholder: effectivePlaceholder }),
    ],
    content: value || '',
    editable: !disabled && !isSubmitting && !isAiLoading,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.isEmpty ? '' : ed.getHTML());
    },
  });

  // Sync external value changes (e.g., after submit clears content)
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const editorEmpty = editor.isEmpty;
      if (value === '' && !editorEmpty) {
        editor.commands.clearContent();
      } else if (value && value !== editor.getHTML()) {
        editor.commands.setContent(value);
      }
    }
  }, [value, editor]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled && !isSubmitting && !isAiLoading);
    }
  }, [editor, disabled, isSubmitting, isAiLoading]);

  const handleAgentChipSelect = (agent: TutorAgent) => {
    setSelectedAgent(agent);
    if (onAiRequest) {
      onAiRequest(agent);
    }
  };

  const handleSubmit = useCallback(() => {
    if (editor && !editor.isEmpty && !isSubmitting) {
      onSubmit();
    }
  }, [editor, isSubmitting, onSubmit]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    try {
      const compressed = await compressImage(file, 500);
      const formData = new FormData();
      formData.append('file', compressed);
      const token = getAuthToken();
      const res = await fetch('/api/uploads/image', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.url) {
        editor.chain().focus().setImage({ src: json.data.url }).run();
      } else {
        toast.error(json.error || t('common:error'));
      }
    } catch {
      toast.error(t('common:error'));
    }

    if (imageInputRef.current) imageInputRef.current.value = '';
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('URL');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const ToolbarButton = ({ onClick, isActive, children, title }: {
    onClick: () => void; isActive?: boolean; children: React.ReactNode; title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Replying to indicator */}
      {replyingToName && (
        <div className="flex items-center gap-2 text-sm" style={{ color: colors.textSecondary }}>
          <span>{t('replying_to')} <strong style={{ color: colors.textPrimary }}>{replyingToName}</strong></span>
          {onCancelReply && (
            <button
              onClick={onCancelReply}
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title={t('cancel_reply')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Rich text editor */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: colors.border, backgroundColor: colors.bgInput, opacity: (disabled || isAiLoading) ? 0.6 : 1 }}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap" style={{ borderColor: colors.border, backgroundColor: isDark ? '#2d3748' : '#f9fafb' }}>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
            <Bold size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
            <Italic size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline">
            <UnderlineIcon size={16} />
          </ToolbarButton>
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading">
            <Heading2 size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
            <List size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List">
            <ListOrdered size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Code Block">
            <Code size={16} />
          </ToolbarButton>
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
          <ToolbarButton onClick={addLink} isActive={editor.isActive('link')} title="Add Link">
            <LinkIcon size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => imageInputRef.current?.click()} title="Add Image">
            <ImagePlus size={16} />
          </ToolbarButton>
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <Undo size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <Redo size={16} />
          </ToolbarButton>
        </div>

        {/* Editor content */}
        <EditorContent
          editor={editor}
          className="forum-reply-editor px-3 py-2 min-h-[120px] max-h-[300px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
          style={{ color: colors.textPrimary }}
        />

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Agent selector chips */}
      {showAgentSelector && showAgentChips && agents.length > 0 && (
        <ForumAgentSelector
          agents={agents}
          onSelect={handleAgentChipSelect}
          selectedAgent={selectedAgent}
          disabled={isSubmitting || isAiLoading}
          isLoading={isAiLoading}
          compact
        />
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showAgentSelector && agents.length > 0 && !showAgentChips && (
            <button
              onClick={() => setShowAgentChips(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'rgba(8, 145, 178, 0.1)',
                color: colors.accent,
              }}
              disabled={disabled || isAiLoading}
            >
              <Bot size={16} />
              {t('ask_ai')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancelReply && (
            <Button variant="ghost" size="sm" onClick={onCancelReply} disabled={isSubmitting}>
              {t('common:cancel')}
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!value.trim() || isSubmitting || isAiLoading}
            size="sm"
          >
            <Send size={16} />
            {isSubmitting ? t('posting') : t('post_reply')}
          </Button>
        </div>
      </div>
    </div>
  );
};
