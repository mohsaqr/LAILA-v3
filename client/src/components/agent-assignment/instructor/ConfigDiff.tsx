/**
 * Config Diff Component
 *
 * Side-by-side comparison of two configuration snapshots.
 */

import { X, ArrowRight, Clock, Plus, Minus, Edit } from 'lucide-react';

interface ConfigDiffProps {
  snapshot1: Record<string, unknown>;
  timestamp1: string;
  snapshot2: Record<string, unknown>;
  timestamp2: string;
  onClose: () => void;
}

// Fields to compare
const DIFF_FIELDS = [
  { key: 'agentName', label: 'Agent Name' },
  { key: 'personaDescription', label: 'Persona Description' },
  { key: 'pedagogicalRole', label: 'Pedagogical Role' },
  { key: 'personality', label: 'Personality' },
  { key: 'personalityPrompt', label: 'Personality Prompt' },
  { key: 'responseStyle', label: 'Response Style' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'systemPrompt', label: 'System Prompt' },
  { key: 'welcomeMessage', label: 'Welcome Message' },
  { key: 'knowledgeContext', label: 'Knowledge Context' },
  { key: 'dosRules', label: "Do's Rules", isArray: true },
  { key: 'dontsRules', label: "Don'ts Rules", isArray: true },
  { key: 'suggestedQuestions', label: 'Suggested Questions', isArray: true },
];

export const ConfigDiff = ({
  snapshot1,
  timestamp1,
  snapshot2,
  timestamp2,
  onClose,
}: ConfigDiffProps) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasChanged = (key: string, isArray = false) => {
    const val1 = snapshot1[key];
    const val2 = snapshot2[key];

    if (isArray) {
      const arr1 = (val1 as string[]) || [];
      const arr2 = (val2 as string[]) || [];
      return JSON.stringify(arr1) !== JSON.stringify(arr2);
    }

    return val1 !== val2;
  };

  const renderValue = (value: unknown, isArray = false) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400 italic">Not set</span>;
    }

    if (isArray) {
      const arr = value as string[];
      if (arr.length === 0) {
        return <span className="text-gray-400 italic">Empty</span>;
      }
      return (
        <ul className="space-y-1">
          {arr.map((item, i) => (
            <li key={i} className="text-xs bg-gray-100 p-1.5 rounded">
              {item}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    const strVal = String(value);
    if (strVal.length > 200) {
      return (
        <div className="text-xs whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
          {strVal}
        </div>
      );
    }

    return strVal;
  };

  const getArrayDiff = (arr1: string[], arr2: string[]) => {
    const added = arr2.filter((item) => !arr1.includes(item));
    const removed = arr1.filter((item) => !arr2.includes(item));
    const unchanged = arr2.filter((item) => arr1.includes(item));
    return { added, removed, unchanged };
  };

  const changedFields = DIFF_FIELDS.filter((f) => hasChanged(f.key, f.isArray));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Configuration Comparison</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {changedFields.length} of {DIFF_FIELDS.length} fields changed
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Timestamps */}
          <div className="flex items-center justify-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">{formatDate(timestamp1)}</span>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">{formatDate(timestamp2)}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {changedFields.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg font-medium">No differences found</p>
              <p className="text-sm mt-1">
                The configuration was identical at both points in time.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {changedFields.map((field) => {
                const val1 = snapshot1[field.key];
                const val2 = snapshot2[field.key];

                return (
                  <div key={field.key} className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Edit className="w-4 h-4 text-amber-600" />
                      <h4 className="font-medium text-gray-900">{field.label}</h4>
                    </div>

                    {field.isArray ? (
                      // Array diff view
                      (() => {
                        const diff = getArrayDiff(
                          (val1 as string[]) || [],
                          (val2 as string[]) || []
                        );
                        return (
                          <div className="space-y-2">
                            {diff.removed.length > 0 && (
                              <div>
                                <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                                  <Minus className="w-3 h-3" /> Removed
                                </span>
                                <div className="mt-1 space-y-1">
                                  {diff.removed.map((item, i) => (
                                    <div
                                      key={i}
                                      className="text-xs bg-red-50 text-red-800 p-2 rounded border border-red-100"
                                    >
                                      {item}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {diff.added.length > 0 && (
                              <div>
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                  <Plus className="w-3 h-3" /> Added
                                </span>
                                <div className="mt-1 space-y-1">
                                  {diff.added.map((item, i) => (
                                    <div
                                      key={i}
                                      className="text-xs bg-green-50 text-green-800 p-2 rounded border border-green-100"
                                    >
                                      {item}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {diff.unchanged.length > 0 && (
                              <div>
                                <span className="text-xs text-gray-500 font-medium">
                                  Unchanged ({diff.unchanged.length})
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      // Simple value diff view
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-red-600 font-medium block mb-1">
                            Before
                          </span>
                          <div className="p-3 bg-red-50 rounded-lg border border-red-100 text-sm text-gray-700">
                            {renderValue(val1, field.isArray)}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-green-600 font-medium block mb-1">
                            After
                          </span>
                          <div className="p-3 bg-green-50 rounded-lg border border-green-100 text-sm text-gray-700">
                            {renderValue(val2, field.isArray)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
