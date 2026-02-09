/**
 * Config Snapshot Component
 *
 * Point-in-time configuration viewer showing agent config at a specific moment.
 */

import { X, Clock, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react';

interface ConfigSnapshotProps {
  snapshot: Record<string, unknown>;
  timestamp: string;
  onClose: () => void;
}

export const ConfigSnapshot = ({ snapshot, timestamp, onClose }: ConfigSnapshotProps) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const dosRules = (snapshot.dosRules as string[]) || [];
  const dontsRules = (snapshot.dontsRules as string[]) || [];
  const suggestedQuestions = (snapshot.suggestedQuestions as string[]) || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Configuration Snapshot</h2>
            <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
              <Clock className="w-4 h-4" />
              {formatDate(timestamp)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Identity */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Identity
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">Agent Name</label>
                <p className="text-sm text-gray-900 font-medium">
                  {String(snapshot.agentName || 'Not set')}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Agent Title</label>
                <p className="text-sm text-gray-900">
                  {String(snapshot.agentTitle || 'Not set')}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Pedagogical Role</label>
                <p className="text-sm text-gray-900">
                  {String(snapshot.pedagogicalRole || 'None selected')}
                </p>
              </div>
            </div>
            {typeof snapshot.personaDescription === 'string' && snapshot.personaDescription && (
              <div>
                <label className="text-xs text-gray-500">Persona Description</label>
                <p className="text-sm text-gray-700 mt-1">
                  {snapshot.personaDescription}
                </p>
              </div>
            )}
            {typeof snapshot.welcomeMessage === 'string' && snapshot.welcomeMessage && (
              <div>
                <label className="text-xs text-gray-500">Welcome Message</label>
                <div className="mt-1 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                  {snapshot.welcomeMessage}
                </div>
              </div>
            )}
          </div>

          {/* Behavior */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Behavior
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">Personality</label>
                <p className="text-sm text-gray-900 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {(snapshot.personality as string) || 'Not set'}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Response Style</label>
                <p className="text-sm text-gray-900">
                  {(snapshot.responseStyle as string) || 'Balanced'}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Temperature</label>
                <p className="text-sm text-gray-900">
                  {snapshot.temperature !== undefined
                    ? (snapshot.temperature as number).toFixed(1)
                    : '0.7'}
                </p>
              </div>
            </div>

            {/* Do's */}
            {dosRules.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <ThumbsUp className="w-3 h-3 text-green-600" />
                  Do's ({dosRules.length})
                </label>
                <div className="mt-1 space-y-1">
                  {dosRules.map((rule, i) => (
                    <div
                      key={i}
                      className="text-xs bg-green-50 text-green-800 p-2 rounded border border-green-100"
                    >
                      {rule}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Don'ts */}
            {dontsRules.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <ThumbsDown className="w-3 h-3 text-red-600" />
                  Don'ts ({dontsRules.length})
                </label>
                <div className="mt-1 space-y-1">
                  {dontsRules.map((rule, i) => (
                    <div
                      key={i}
                      className="text-xs bg-red-50 text-red-800 p-2 rounded border border-red-100"
                    >
                      {rule}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* System Prompt */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              System Prompt
            </h3>
            <pre className="text-xs bg-gray-50 p-4 rounded-lg border border-gray-200 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
              {(snapshot.systemPrompt as string) || 'No system prompt'}
            </pre>
          </div>

          {/* Knowledge Context */}
          {typeof snapshot.knowledgeContext === 'string' && snapshot.knowledgeContext && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Knowledge Context
              </h3>
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                {snapshot.knowledgeContext}
              </div>
            </div>
          )}

          {/* Suggested Questions */}
          {suggestedQuestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Suggested Questions ({suggestedQuestions.length})
              </h3>
              <div className="space-y-1">
                {suggestedQuestions.map((q, i) => (
                  <div
                    key={i}
                    className="text-xs bg-violet-50 text-violet-800 p-2 rounded border border-violet-100"
                  >
                    {q}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
