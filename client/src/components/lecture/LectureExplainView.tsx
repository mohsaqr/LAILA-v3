import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Send, BookOpen } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { lectureAIHelperApi, ExplainThread } from '../../api/lectureAIHelper';
import { ExplainThreadCard } from './ExplainThreadCard';

interface LectureExplainViewProps {
  lectureId: number;
}

export const LectureExplainView = ({ lectureId }: LectureExplainViewProps) => {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgHeader: isDark ? '#374151' : '#f9fafb',
    bgHover: isDark ? '#374151' : '#f3f4f6',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    accent: '#3b82f6',
    accentLight: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
  };

  // Fetch threads
  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ['explainThreads', lectureId],
    queryFn: () => lectureAIHelperApi.getExplainThreads(lectureId),
  });

  // Create thread mutation
  const createThreadMutation = useMutation({
    mutationFn: (question: string) => lectureAIHelperApi.createExplainThread(lectureId, question),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explainThreads', lectureId] });
      setNewQuestion('');
      setShowNewQuestion(false);
    },
  });

  // Follow-up mutation (per thread)
  const followUpMutation = useMutation({
    mutationFn: ({ threadId, question }: { threadId: number; question: string }) =>
      lectureAIHelperApi.addFollowUp(lectureId, threadId, question),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explainThreads', lectureId] });
    },
  });

  const handleCreateThread = () => {
    if (newQuestion.trim() && !createThreadMutation.isPending) {
      createThreadMutation.mutate(newQuestion.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateThread();
    }
  };

  const handleFollowUp = (threadId: number, question: string) => {
    followUpMutation.mutate({ threadId, question });
  };

  return (
    <div className="border-t" style={{ borderColor: colors.border }}>
      {/* New Question button/input */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: colors.border }}
      >
        {!showNewQuestion ? (
          <button
            onClick={() => setShowNewQuestion(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: colors.accentLight,
              color: colors.accent,
            }}
          >
            <Plus className="w-4 h-4" />
            New Question
          </button>
        ) : (
          <div className="space-y-3">
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to understand about this lecture?"
              disabled={createThreadMutation.isPending}
              rows={3}
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-sm"
              style={{
                backgroundColor: isDark ? '#374151' : '#ffffff',
                border: `1px solid ${colors.border}`,
                color: colors.textPrimary,
              }}
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setShowNewQuestion(false);
                  setNewQuestion('');
                }}
                className="text-sm"
                style={{ color: colors.textSecondary }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateThread}
                disabled={!newQuestion.trim() || createThreadMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createThreadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Asking...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Ask Question
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {createThreadMutation.isError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          Failed to create question. Please try again.
        </div>
      )}

      {/* Threads list */}
      <div className="max-h-[400px] overflow-y-auto">
        {threadsLoading ? (
          <div className="px-4 py-8 text-center" style={{ color: colors.textSecondary }}>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading questions...
          </div>
        ) : threads.length === 0 ? (
          <div className="px-4 py-8 text-center" style={{ color: colors.textSecondary }}>
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">No questions yet</p>
            <p className="text-xs">
              Ask a question about the lecture content and get a detailed explanation
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {threads.map((thread: ExplainThread) => (
              <ExplainThreadCard
                key={thread.id}
                posts={thread.posts}
                onFollowUp={(question) => handleFollowUp(thread.id, question)}
                isSubmitting={followUpMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
