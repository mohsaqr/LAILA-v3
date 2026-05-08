import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { FileNode } from './FileNodeExtension';
import { ChatbotNode } from './ChatbotNodeExtension';

interface LessonViewerProps {
  html: string;
}

/**
 * Read-only renderer for the lesson editor's HTML — used on the
 * student lecture page so embedded `<lecture-file>` and
 * `<lecture-chatbot>` tags render with the same node-view UI as in
 * the editor (sans edit affordances; the node views check
 * `editor.isEditable`).
 */
export const LessonViewer = ({ html }: LessonViewerProps) => {
  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: true, allowBase64: true }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: { class: 'text-cyan-600 underline' },
      }),
      FileNode,
      ChatbotNode,
    ],
    content: html,
  });

  if (!editor) return null;

  return (
    <EditorContent
      editor={editor}
      className="prose prose-sm dark:prose-invert max-w-none"
    />
  );
};
