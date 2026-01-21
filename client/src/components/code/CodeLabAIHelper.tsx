import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Send, Loader2, HelpCircle, Code2, AlertTriangle } from 'lucide-react';
import { chatApi } from '../../api/chat';
import { CodeLab, CodeBlock } from '../../types';
import { Button } from '../common/Button';

interface BlockContext {
  block: CodeBlock;
  code: string;
  output?: string;
  error?: string;
}

interface CodeLabAIHelperProps {
  isOpen: boolean;
  onClose: () => void;
  codeLab: CodeLab;
  currentBlock: CodeBlock;
  currentCode: string;
  currentError: string;
  previousBlocks?: BlockContext[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const CodeLabAIHelper = ({
  isOpen,
  onClose,
  codeLab,
  currentBlock,
  currentCode,
  currentError,
  previousBlocks = [],
}: CodeLabAIHelperProps) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId] = useState(() => `codelab-${codeLab.id}-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build context string for the AI
  const buildContext = () => {
    let context = `# Code Lab: ${codeLab.title}\n`;
    if (codeLab.description) {
      context += `Description: ${codeLab.description}\n`;
    }
    context += '\n';

    // Add previous blocks context
    if (previousBlocks.length > 0) {
      context += '## Previously Executed Blocks\n\n';
      previousBlocks.forEach((blockCtx, index) => {
        context += `### Block ${index + 1}: ${blockCtx.block.title}\n`;
        if (blockCtx.block.instructions) {
          context += `Instructions: ${blockCtx.block.instructions}\n`;
        }
        context += '```r\n' + blockCtx.code + '\n```\n';
        if (blockCtx.output) {
          context += `Output:\n\`\`\`\n${blockCtx.output}\n\`\`\`\n`;
        }
        if (blockCtx.error) {
          context += `Error:\n\`\`\`\n${blockCtx.error}\n\`\`\`\n`;
        }
        context += '\n';
      });
    }

    // Add current block context
    context += '## Current Block (Needs Help)\n\n';
    context += `### Block: ${currentBlock.title}\n`;
    if (currentBlock.instructions) {
      context += `Instructions: ${currentBlock.instructions}\n`;
    }
    context += '```r\n' + currentCode + '\n```\n';
    context += `\n**Error:**\n\`\`\`\n${currentError}\n\`\`\`\n`;

    return context;
  };

  // System prompt for R debugging
  const systemPrompt = `You are a helpful R programming tutor assisting a student with a Code Lab exercise.

Your role is to:
1. Help debug R code errors
2. Explain why errors occur
3. Guide the student toward the solution without giving away the complete answer
4. Use the context of previous blocks to understand the data flow
5. Be encouraging and supportive

The student is working in a WebR environment (R running in the browser). Keep your explanations concise and focused on the specific error they're encountering.

When suggesting fixes:
- Explain what went wrong
- Suggest small, specific changes
- If the error relates to previous blocks, reference them
- Encourage the student to try the fix themselves`;

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (msg: string) => {
      const context = buildContext();
      return chatApi.sendMessage({
        message: msg,
        sessionId,
        context,
        systemPrompt,
        module: `codelab-${codeLab.id}`,
      });
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: data.reply },
      ]);
      setMessage('');
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendMessageMutation.isPending]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Initialize with a helpful starter message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `I can see you're having trouble with the "${currentBlock.title}" block. I've reviewed your code and the error message. What would you like help with? You can:\n\n• Ask me to explain the error\n• Ask for hints on how to fix it\n• Ask about R concepts related to the problem`,
        },
      ]);
    }
  }, [isOpen, currentBlock.title, messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(message.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white rounded-xl shadow-2xl flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-xl">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">AI Debugging Assistant</h2>
            <p className="text-sm text-gray-600">Help with: {currentBlock.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Context Summary */}
        <div className="px-6 py-3 bg-red-50 border-b border-red-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700">Error in your code:</p>
              <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap break-words font-mono">
                {currentError.length > 200 ? currentError.substring(0, 200) + '...' : currentError}
              </pre>
            </div>
          </div>
        </div>

        {/* Code Preview */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Code2 className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Your code:</span>
          </div>
          <pre className="text-xs text-gray-600 bg-gray-900 text-gray-100 rounded p-2 overflow-x-auto font-mono max-h-24 overflow-y-auto">
            {currentCode}
          </pre>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-md'
                    : 'bg-white shadow-sm border border-gray-100 rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {sendMessageMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-white shadow-sm border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4 bg-white rounded-b-xl">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask about the error or request hints..."
              disabled={sendMessageMutation.isPending}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button
              type="submit"
              disabled={!message.trim() || sendMessageMutation.isPending}
              className="!rounded-full !p-2.5"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          {sendMessageMutation.isError && (
            <p className="mt-2 text-sm text-red-500">
              Failed to send message. Please try again.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
