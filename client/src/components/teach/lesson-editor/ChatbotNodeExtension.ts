import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ChatbotNodeView } from './ChatbotNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lectureChatbot: {
      insertLectureChatbot: (attrs: {
        chatbotTitle: string;
        chatbotIntro?: string;
        chatbotSystemPrompt?: string;
        chatbotWelcome?: string;
      }) => ReturnType;
    };
  }
}

/**
 * Custom block-level node for an embedded chatbot. Serializes to a
 * `<lecture-chatbot>` tag carrying the chatbot's display config as
 * data-* attributes.
 */
export const ChatbotNode = Node.create({
  name: 'lectureChatbot',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      chatbotTitle: { default: '' },
      chatbotIntro: { default: '' },
      chatbotSystemPrompt: { default: '' },
      chatbotWelcome: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'lecture-chatbot',
        getAttrs: el => {
          const node = el as HTMLElement;
          return {
            chatbotTitle: node.getAttribute('data-title') ?? '',
            chatbotIntro: node.getAttribute('data-intro') ?? '',
            chatbotSystemPrompt: node.getAttribute('data-system-prompt') ?? '',
            chatbotWelcome: node.getAttribute('data-welcome') ?? '',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'lecture-chatbot',
      mergeAttributes(
        {},
        {
          'data-title': node.attrs.chatbotTitle,
          'data-intro': node.attrs.chatbotIntro,
          'data-system-prompt': node.attrs.chatbotSystemPrompt,
          'data-welcome': node.attrs.chatbotWelcome,
        },
      ),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChatbotNodeView);
  },

  addCommands() {
    return {
      insertLectureChatbot:
        attrs =>
        ({ chain }) =>
          chain().focus().insertContent({ type: this.name, attrs }).run(),
    };
  },
});
