import { useState } from 'react';
import {
  Clock,
  PlusCircle,
  Edit,
  Send,
  Undo,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AgentConfigurationLog } from '../../../types';

interface ConfigHistoryTimelineProps {
  logs: AgentConfigurationLog[];
}

const getChangeTypeIcon = (changeType: string) => {
  switch (changeType) {
    case 'create':
      return <PlusCircle className="w-4 h-4 text-green-600" />;
    case 'update':
      return <Edit className="w-4 h-4 text-blue-600" />;
    case 'submit':
      return <Send className="w-4 h-4 text-violet-600" />;
    case 'unsubmit':
      return <Undo className="w-4 h-4 text-orange-600" />;
    default:
      return <Clock className="w-4 h-4 text-gray-600" />;
  }
};

const getChangeTypeLabel = (changeType: string) => {
  switch (changeType) {
    case 'create':
      return 'Created agent';
    case 'update':
      return 'Updated configuration';
    case 'submit':
      return 'Submitted for grading';
    case 'unsubmit':
      return 'Returned to draft';
    default:
      return changeType;
  }
};

const getChangeTypeColor = (changeType: string) => {
  switch (changeType) {
    case 'create':
      return 'bg-green-100 border-green-300';
    case 'update':
      return 'bg-blue-100 border-blue-300';
    case 'submit':
      return 'bg-violet-100 border-violet-300';
    case 'unsubmit':
      return 'bg-orange-100 border-orange-300';
    default:
      return 'bg-gray-100 border-gray-300';
  }
};

export const ConfigHistoryTimeline = ({ logs }: ConfigHistoryTimelineProps) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseSnapshot = (snapshotStr: string) => {
    try {
      return JSON.parse(snapshotStr);
    } catch {
      return null;
    }
  };

  const parseChangedFields = (fieldsStr: string | null) => {
    if (!fieldsStr) return [];
    try {
      return JSON.parse(fieldsStr);
    } catch {
      return [];
    }
  };

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No configuration history available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log, index) => {
        const isExpanded = expandedId === log.id;
        const changedFields = parseChangedFields(log.changedFields);
        const newConfig = parseSnapshot(log.newConfigSnapshot);
        const prevConfig = log.previousConfigSnapshot
          ? parseSnapshot(log.previousConfigSnapshot)
          : null;

        return (
          <div key={log.id} className="relative">
            {/* Timeline connector */}
            {index < logs.length - 1 && (
              <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200" />
            )}

            <div
              className={`border rounded-lg p-4 ${getChangeTypeColor(log.changeType)}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-200">
                  {getChangeTypeIcon(log.changeType)}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {getChangeTypeLabel(log.changeType)}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {log.userFullname || 'Unknown user'} • Version {log.version}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(log.timestamp)}
                    </div>
                  </div>

                  {/* Changed fields summary */}
                  {changedFields.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-600">Changed: </span>
                      <span className="text-xs text-gray-800">
                        {changedFields.join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Expand/collapse button */}
                  {newConfig && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      className="mt-2 text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Hide details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          View details
                        </>
                      )}
                    </button>
                  )}

                  {/* Expanded details */}
                  {isExpanded && newConfig && (
                    <div className="mt-4 space-y-3">
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">
                          Configuration Snapshot
                        </h5>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-500">Agent Name:</span>{' '}
                            <span className="text-gray-900">{newConfig.agentName}</span>
                          </div>
                          {newConfig.personaDescription && (
                            <div>
                              <span className="text-gray-500">Persona:</span>{' '}
                              <span className="text-gray-900">
                                {newConfig.personaDescription}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-500">System Prompt:</span>
                            <pre className="mt-1 text-xs bg-gray-50 p-2 rounded border border-gray-200 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                              {newConfig.systemPrompt}
                            </pre>
                          </div>
                        </div>
                      </div>

                      {/* Show diff for updates */}
                      {prevConfig && changedFields.length > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">
                            Changes
                          </h5>
                          <div className="space-y-2 text-sm">
                            {changedFields.map((field: string) => (
                              <div key={field}>
                                <span className="text-gray-500">{field}:</span>
                                <div className="ml-4 text-xs">
                                  <div className="text-red-600 line-through">
                                    {JSON.stringify(prevConfig[field])}
                                  </div>
                                  <div className="text-green-600">
                                    {JSON.stringify(newConfig[field])}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
