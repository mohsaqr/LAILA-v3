import { useEffect, useRef, useCallback, useState } from 'react';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, ImagePlus, Link as LinkIcon, Code, AlignLeft, AlignCenter, AlignRight, Table as TableIcon, Palette, Trash2, Plus } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
// Color ships inside extension-text-style in v3 — no separate package needed.
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { TableKit } from '@tiptap/extension-table';
import toast from 'react-hot-toast';
import { useTheme } from '../../hooks/useTheme';
import { getAuthToken } from '../../utils/auth';
import { compressImage } from '../../utils/imageCompress';

/**
 * Image with an author-settable width.
 *
 * Tiptap's Image has no size control, so an image inserted into a lesson was
 * always rendered at its natural size. Width is stored as a style so it
 * survives sanitisation (see ALLOWED_CSS_PROPS in utils/sanitize) and needs no
 * schema change — existing content parses back with width: null.
 *
 * Only width is added. *Position* is the containing paragraph's text-align,
 * which the toolbar already sets; it simply never persisted until the
 * sanitiser stopped discarding inline styles.
 */
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.style.width || null,
        // height:auto keeps the aspect ratio — without it a percentage width
        // squashes the image against its intrinsic height attribute.
        renderHTML: (attributes) =>
          attributes.width ? { style: `width: ${attributes.width}; height: auto` } : {},
      },
    };
  },
});

/** Swatches offered for text colour. Named so the title is readable. */
const TEXT_COLORS: Array<{ name: string; value: string }> = [
  { name: 'Default', value: '' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Grey', value: '#6b7280' },
];

const IMAGE_WIDTHS: Array<{ label: string; value: string | null }> = [
  { label: '25%', value: '25%' },
  { label: '50%', value: '50%' },
  { label: '100%', value: '100%' },
  { label: 'Original', value: null },
];

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxImageSizeKB?: number;
  editorClassName?: string;
  /** When false, the outer rounded border is omitted. Default true. */
  bordered?: boolean;
}

export const RichTextEditor = ({ value, onChange, placeholder = '', disabled = false, maxImageSizeKB = 500, editorClassName, bordered = true }: RichTextEditorProps) => {
  const { isDark } = useTheme();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showColors, setShowColors] = useState(false);

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
      // TextStyle carries the <span style> that Color writes into; Color alone
      // has nothing to attach to.
      TextStyle,
      Color,
      TableKit.configure({ table: { resizable: true } }),
      ResizableImage.configure({ inline: true, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-cyan-600 underline' } }),
      Placeholder.configure({ placeholder }),
    ],
    // Strip the browser's default contenteditable focus outline. Tailwind
    // class lands directly on the .ProseMirror element so :focus is killed.
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
      },
    },
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
      const compressed = await compressImage(file, maxImageSizeKB);
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
    <div
      className={bordered ? 'rounded-lg border overflow-hidden' : 'overflow-hidden'}
      style={{
        borderColor: bordered ? colors.border : 'transparent',
        backgroundColor: bordered ? colors.bgInput : 'transparent',
      }}
    >
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

        {/* Text colour */}
        <div className="relative">
          <Btn
            onClick={() => setShowColors(v => !v)}
            isActive={showColors || !!editor.getAttributes('textStyle').color}
            title="Text Colour"
          >
            <Palette size={16} />
          </Btn>
          {showColors && (
            <div
              className="absolute z-20 mt-1 flex gap-1 rounded-lg border p-1.5 shadow-lg"
              style={{ backgroundColor: colors.bgInput, borderColor: colors.border }}
            >
              {TEXT_COLORS.map(c => (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => {
                    // '' is the reset swatch — unsetColor, not setColor(''),
                    // which would write an empty style and keep the span.
                    if (c.value) editor.chain().focus().setColor(c.value).run();
                    else editor.chain().focus().unsetColor().run();
                    setShowColors(false);
                  }}
                  className="h-5 w-5 rounded-full border border-gray-300 dark:border-gray-500"
                  style={{ backgroundColor: c.value || 'transparent' }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <Btn
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          isActive={editor.isActive('table')}
          title="Insert Table"
        >
          <TableIcon size={16} />
        </Btn>
      </div>

      {/* Contextual rows. Shown only for the thing that is selected, so the
          main toolbar does not carry controls that are inert most of the time. */}
      {editor.isActive('table') && (
        <div
          className="flex items-center gap-0.5 px-2 py-1 border-b flex-wrap text-xs"
          style={{ borderColor: colors.border, backgroundColor: colors.toolbarBg }}
        >
          <span className="mr-1 text-gray-500 dark:text-gray-400">Table:</span>
          <Btn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column">
            <span className="flex items-center gap-0.5"><Plus size={12} />col</span>
          </Btn>
          <Btn onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row">
            <span className="flex items-center gap-0.5"><Plus size={12} />row</span>
          </Btn>
          <Btn onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">
            <span className="flex items-center gap-0.5"><Trash2 size={12} />col</span>
          </Btn>
          <Btn onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">
            <span className="flex items-center gap-0.5"><Trash2 size={12} />row</span>
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Toggle header row">
            header
          </Btn>
          <Btn onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">
            <span className="flex items-center gap-0.5 text-red-500"><Trash2 size={12} />table</span>
          </Btn>
        </div>
      )}

      {editor.isActive('image') && (
        <div
          className="flex items-center gap-0.5 px-2 py-1 border-b flex-wrap text-xs"
          style={{ borderColor: colors.border, backgroundColor: colors.toolbarBg }}
        >
          <span className="mr-1 text-gray-500 dark:text-gray-400">Image width:</span>
          {IMAGE_WIDTHS.map(w => (
            <Btn
              key={w.label}
              onClick={() => editor.chain().focus().updateAttributes('image', { width: w.value }).run()}
              isActive={editor.getAttributes('image').width === w.value}
              title={`Width ${w.label}`}
            >
              {w.label}
            </Btn>
          ))}
          <span className="mx-1 text-gray-400">·</span>
          <span className="text-gray-500 dark:text-gray-400">
            position with the align buttons above
          </span>
        </div>
      )}
      <EditorContent
        editor={editor}
        className={editorClassName || "forum-reply-editor px-3 py-2 min-h-[120px] max-h-[300px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"}
        style={{ color: colors.textPrimary }}
      />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
    </div>
  );
};
