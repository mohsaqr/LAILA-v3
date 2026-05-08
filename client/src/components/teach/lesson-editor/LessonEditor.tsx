import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  List,
  ListOrdered,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  ImagePlus,
  FileUp,
  Bot,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../../hooks/useTheme';
import { coursesApi } from '../../../api/courses';
import { getAuthToken } from '../../../utils/auth';
import { FileNode } from './FileNodeExtension';
import { ChatbotNode } from './ChatbotNodeExtension';
import type { LectureSection } from '../../../types';

interface LessonEditorProps {
  lectureId: number;
  /** Existing sections; consolidated into a single HTML doc on mount. */
  initialSections: LectureSection[];
}

/**
 * Build the initial HTML document by walking the existing
 * `LectureSection[]` (sorted by `order`) and emitting:
 *   - text/ai-generated: the raw HTML content
 *   - file: a `<lecture-file>` tag
 *   - chatbot: a `<lecture-chatbot>` tag
 *   - assignment: rendered as a small note (legacy, read-only)
 * Returns one HTML string ready for Tiptap's `content`.
 */
const buildInitialHTML = (sections: LectureSection[]): string => {
  if (sections.length === 0) return '';
  const ordered = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return ordered
    .map(s => {
      if (s.type === 'text' || s.type === 'ai-generated') {
        return s.content || '';
      }
      if (s.type === 'file') {
        return `<lecture-file data-url="${encodeURIComponent(s.fileUrl ?? '')}" data-name="${encodeURIComponent(s.fileName ?? '')}" data-type="${encodeURIComponent(s.fileType ?? '')}" data-size="${s.fileSize ?? 0}"></lecture-file>`;
      }
      if (s.type === 'chatbot') {
        return `<lecture-chatbot data-title="${encodeURIComponent(s.chatbotTitle ?? '')}" data-intro="${encodeURIComponent(s.chatbotIntro ?? '')}" data-system-prompt="${encodeURIComponent(s.chatbotSystemPrompt ?? '')}" data-welcome="${encodeURIComponent(s.chatbotWelcome ?? '')}"></lecture-chatbot>`;
      }
      // Legacy / unsupported: drop a small note paragraph.
      return `<p><em>[${s.type}]</em></p>`;
    })
    .join('');
};

/**
 * One Tiptap editor per lesson, with custom File and Chatbot inline
 * blocks. Persists the HTML to a single `LectureSection` of
 * type='text' (find-or-create + reuse). Any pre-existing sections
 * are consolidated on first save and the extras deleted.
 */
export const LessonEditor = ({ lectureId, initialSections }: LessonEditorProps) => {
  const { t } = useTranslation('teaching');
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSavedRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Find the canonical "single" section: the first text section, or none.
  const canonical = initialSections.find(s => s.type === 'text');
  const initialHTML = buildInitialHTML(initialSections);

  const colors = {
    bgInput: isDark ? '#374151' : '#ffffff',
    border: isDark ? '#4b5563' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    toolbarBg: isDark ? '#2d3748' : '#f9fafb',
  };

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      coursesApi.updateSection(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails'] });
    },
    onError: () => toast.error(t('failed_to_save_lesson', { defaultValue: 'Failed to save.' })),
  });

  const createSectionMutation = useMutation({
    mutationFn: ({ content }: { content: string }) =>
      coursesApi.createSection(lectureId, { type: 'text', content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails'] });
    },
    onError: () => toast.error(t('failed_to_save_lesson', { defaultValue: 'Failed to save.' })),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: number) => coursesApi.deleteSection(id),
  });

  const canonicalIdRef = useRef<number | null>(canonical?.id ?? null);
  const consolidatedRef = useRef(false);

  /**
   * Consolidate legacy multi-section lectures into one text section.
   * Runs at most once per mount: keeps `canonical` (or creates one)
   * with the merged HTML, then deletes every other section. Idempotent
   * per render via consolidatedRef.
   */
  const consolidateIfNeeded = async (html: string) => {
    if (consolidatedRef.current) return;
    consolidatedRef.current = true;
    if (initialSections.length <= 1 && canonical) return;
    if (initialSections.length === 0) return;

    if (canonical) {
      await updateSectionMutation.mutateAsync({ id: canonical.id, content: html });
    } else {
      const created = await createSectionMutation.mutateAsync({ content: html });
      canonicalIdRef.current = created.id;
    }

    // Delete all OTHER sections (legacy assignment / ai-generated kept as-is
    // would render in the merged HTML already as embedded tags or notes).
    const others = initialSections.filter(s => s.id !== canonical?.id);
    await Promise.all(others.map(s => deleteSectionMutation.mutateAsync(s.id).catch(() => null)));
    queryClient.invalidateQueries({ queryKey: ['courseDetails'] });
  };

  const persist = (html: string) => {
    if (html === lastSavedRef.current) return;
    lastSavedRef.current = html;

    if (canonicalIdRef.current != null) {
      updateSectionMutation.mutate({ id: canonicalIdRef.current, content: html });
    } else {
      createSectionMutation.mutate(
        { content: html },
        {
          onSuccess: created => {
            canonicalIdRef.current = created.id;
          },
        },
      );
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: true, allowBase64: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-cyan-600 underline' },
      }),
      Placeholder.configure({
        placeholder: t('lesson_empty_placeholder', { defaultValue: 'Start writing your lesson…' }),
      }),
      FileNode,
      ChatbotNode,
    ],
    content: initialHTML,
    editorProps: {
      attributes: { class: 'focus:outline-none' },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? '' : ed.getHTML();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => persist(html), 400);
    },
  });

  // Run consolidation once after the editor mounts.
  useEffect(() => {
    if (!editor) return;
    void consolidateIfNeeded(initialHTML);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  if (!editor) return null;

  // ─── Actions: insert File / insert Chatbot / image / link ────────────────

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = getAuthToken();
      const res = await fetch('/api/uploads/image', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      const url = json?.data?.url ?? json?.url;
      if (url) editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      console.error('image upload failed', err);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getAuthToken();
      const res = await fetch('/api/uploads/file', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      const fileData = json.data || json;
      editor.commands.insertLectureFile({
        fileUrl: fileData.url || fileData.path,
        fileName: file.name,
        fileType: file.name.split('.').pop() || '',
        fileSize: file.size,
      });
    } catch (err) {
      console.error('file upload failed', err);
      toast.error(t('failed_to_save_lesson', { defaultValue: 'Failed to upload.' }));
    } finally {
      setUploadingFile(false);
    }
  };

  const insertChatbot = () => {
    editor.commands.insertLectureChatbot({
      chatbotTitle: '',
      chatbotIntro: '',
      chatbotSystemPrompt: '',
      chatbotWelcome: '',
    });
  };

  const addLink = () => {
    const url = window.prompt('URL');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  // ─── UI ────────────────────────────────────────────────────────────────

  const Btn = ({
    onClick,
    isActive,
    title,
    children,
  }: {
    onClick: () => void;
    isActive?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: colors.border, backgroundColor: colors.bgInput }}>
      <div
        className="flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap"
        style={{ borderColor: colors.border, backgroundColor: colors.toolbarBg }}
      >
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold"><Bold size={16} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic"><Italic size={16} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline"><UnderlineIcon size={16} /></Btn>
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading"><Heading2 size={16} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List"><List size={16} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List"><ListOrdered size={16} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Code Block"><Code size={16} /></Btn>
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
        <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align Left"><AlignLeft size={16} /></Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Align Center"><AlignCenter size={16} /></Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align Right"><AlignRight size={16} /></Btn>
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
        <Btn onClick={addLink} isActive={editor.isActive('link')} title="Add Link"><LinkIcon size={16} /></Btn>
        <Btn onClick={() => imageInputRef.current?.click()} title="Add Image"><ImagePlus size={16} /></Btn>
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
        <Btn
          onClick={() => fileInputRef.current?.click()}
          title={t('block_file', { defaultValue: 'Insert File' })}
        >
          {uploadingFile ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
        </Btn>
        <Btn
          onClick={insertChatbot}
          title={t('block_chatbot', { defaultValue: 'Insert Chatbot' })}
        >
          <Bot size={16} />
        </Btn>
      </div>
      <EditorContent
        editor={editor}
        className="px-3 py-3 min-h-[280px] max-h-[600px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
        style={{ color: colors.textPrimary }}
      />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        onChange={onPickFile}
        className="hidden"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.mp4,.mov,.mp3,.wav,.zip"
      />
    </div>
  );
};
