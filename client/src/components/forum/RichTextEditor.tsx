import { useEffect, useRef, useCallback } from 'react';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, ImagePlus, Link as LinkIcon, Code, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import toast from 'react-hot-toast';
import { useTheme } from '../../hooks/useTheme';
import { getAuthToken } from '../../utils/auth';
import { compressImage } from '../../utils/imageCompress';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const RichTextEditor = ({ value, onChange, placeholder = '', disabled = false }: RichTextEditorProps) => {
  const { isDark } = useTheme();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const colors = {
    bgInput: isDark ? '#374151' : '#ffffff',
    border: isDark ? '#4b5563' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    toolbarBg: isDark ? '#2d3748' : '#f9fafb',
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: true, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-cyan-600 underline' } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.isEmpty ? '' : ed.getHTML());
    },
  });

  useEffect(() => {
    if (editor && !editor.isFocused) {
      if (value === '' && !editor.isEmpty) editor.commands.clearContent();
      else if (value && value !== editor.getHTML()) editor.commands.setContent(value);
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

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
        toast.error(json.error || 'Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    }

    if (imageInputRef.current) imageInputRef.current.value = '';
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('URL');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const Btn = ({ onClick, isActive, children, title }: {
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
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: colors.border, backgroundColor: colors.bgInput }}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap" style={{ borderColor: colors.border, backgroundColor: colors.toolbarBg }}>
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
      </div>
      <EditorContent
        editor={editor}
        className="forum-reply-editor px-3 py-2 min-h-[120px] max-h-[300px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
        style={{ color: colors.textPrimary }}
      />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
    </div>
  );
};
