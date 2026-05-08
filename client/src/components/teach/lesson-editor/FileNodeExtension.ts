import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { FileNodeView } from './FileNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lectureFile: {
      insertLectureFile: (attrs: {
        fileUrl: string;
        fileName: string;
        fileType?: string;
        fileSize?: number;
      }) => ReturnType;
    };
  }
}

/**
 * Custom block-level node for an embedded file. Renders as a thin
 * row inside the editor flow; serializes to a `<lecture-file>` tag
 * with data-* attributes so the student renderer can find them.
 */
export const FileNode = Node.create({
  name: 'lectureFile',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      fileUrl: { default: '' },
      fileName: { default: '' },
      fileType: { default: '' },
      fileSize: { default: 0, parseHTML: el => parseInt(el.getAttribute('data-size') ?? '0', 10) },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'lecture-file',
        getAttrs: el => {
          const node = el as HTMLElement;
          return {
            fileUrl: node.getAttribute('data-url') ?? '',
            fileName: node.getAttribute('data-name') ?? '',
            fileType: node.getAttribute('data-type') ?? '',
            fileSize: parseInt(node.getAttribute('data-size') ?? '0', 10),
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'lecture-file',
      mergeAttributes(
        {},
        {
          'data-url': node.attrs.fileUrl,
          'data-name': node.attrs.fileName,
          'data-type': node.attrs.fileType,
          'data-size': String(node.attrs.fileSize ?? 0),
        },
      ),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileNodeView);
  },

  addCommands() {
    return {
      insertLectureFile:
        attrs =>
        ({ chain }) =>
          chain().focus().insertContent({ type: this.name, attrs }).run(),
    };
  },
});
