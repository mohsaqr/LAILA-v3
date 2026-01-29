/**
 * Design Timeline Component
 *
 * Visual timeline of all design events for instructor view.
 * Shows chronological view of student's design process with filtering and detail views.
 */

import { useState } from 'react';
import {
  Clock,
  Filter,
  Play,
  Pause,
  Edit,
  Send,
  MessageSquare,
  Lightbulb,
  Save,
  Sparkles,
  Settings,
  FileText,
  Target,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';

interface DesignEvent {
  id: number;
  eventType: string;
  eventCategory: string;
  timestamp: string;
  fieldName?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  activeTab?: string | null;
  roleSelected?: string | null;
  personalitySelected?: string | null;
  templateName?: string | null;
  reflectionPromptId?: string | null;
  reflectionResponse?: string | null;
  testConversationId?: number | null;
  totalDesignTime?: number | null;
  agentConfigSnapshot?: Record<string, unknown> | null;
}

interface DesignTimelineProps {
  events: DesignEvent[];
  onViewSnapshot?: (event: DesignEvent) => void;
  onCompareSnapshots?: (event1: DesignEvent, event2: DesignEvent) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  session: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700' },
  navigation: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  field: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  template: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
  rule: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  test: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  reflection: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
  save: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
};

const EVENT_ICONS: Record<string, React.ElementType> = {
  design_session_start: Play,
  design_session_end: Pause,
  design_session_pause: Pause,
  design_session_resume: Play,
  tab_switch: Settings,
  field_focus: Edit,
  field_blur: Edit,
  field_change: Edit,
  field_paste: FileText,
  role_selected: Target,
  template_applied: FileText,
  personality_selected: Sparkles,
  rule_added: Edit,
  rule_removed: Edit,
  test_conversation_started: MessageSquare,
  test_message_sent: Send,
  test_response_received: MessageSquare,
  test_conversation_reset: MessageSquare,
  reflection_prompt_shown: Lightbulb,
  reflection_submitted: Lightbulb,
  reflection_dismissed: Lightbulb,
  draft_saved: Save,
  submission_attempted: Send,
  submission_completed: Send,
};

const EVENT_LABELS: Record<string, string> = {
  design_session_start: 'Started designing',
  design_session_end: 'Ended session',
  design_session_pause: 'Paused session',
  design_session_resume: 'Resumed session',
  tab_switch: 'Switched tab',
  field_focus: 'Focused on field',
  field_blur: 'Left field',
  field_change: 'Changed field',
  field_paste: 'Pasted content',
  role_selected: 'Selected role',
  template_applied: 'Applied template',
  template_modified: 'Modified template',
  personality_selected: 'Selected personality',
  rule_added: 'Added rule',
  rule_removed: 'Removed rule',
  rule_edited: 'Edited rule',
  test_conversation_started: 'Started test conversation',
  test_message_sent: 'Sent test message',
  test_response_received: 'Received response',
  test_conversation_reset: 'Reset conversation',
  reflection_prompt_shown: 'Reflection prompt shown',
  reflection_submitted: 'Submitted reflection',
  reflection_dismissed: 'Dismissed reflection',
  draft_saved: 'Saved draft',
  submission_attempted: 'Attempted submission',
  submission_completed: 'Submitted agent',
  unsubmit_requested: 'Returned to draft',
};

const CATEGORIES = [
  { id: 'all', label: 'All Events' },
  { id: 'session', label: 'Sessions' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'field', label: 'Field Changes' },
  { id: 'template', label: 'Templates' },
  { id: 'rule', label: 'Rules' },
  { id: 'test', label: 'Testing' },
  { id: 'reflection', label: 'Reflections' },
  { id: 'save', label: 'Saves' },
];

export const DesignTimeline = ({
  events,
  onViewSnapshot,
  onCompareSnapshots,
}: DesignTimelineProps) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<DesignEvent | null>(null);

  const filteredEvents =
    selectedCategory === 'all'
      ? events
      : events.filter((e) => e.eventCategory === selectedCategory);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const getEventColor = (category: string) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.session;
  };

  const getEventIcon = (eventType: string) => {
    return EVENT_ICONS[eventType] || Clock;
  };

  const getEventLabel = (event: DesignEvent) => {
    let label = EVENT_LABELS[event.eventType] || event.eventType;

    // Add context
    if (event.fieldName) {
      label += `: ${event.fieldName}`;
    }
    if (event.roleSelected) {
      label += `: ${event.roleSelected}`;
    }
    if (event.personalitySelected) {
      label += `: ${event.personalitySelected}`;
    }
    if (event.activeTab && event.eventType === 'tab_switch') {
      label += ` to ${event.activeTab}`;
    }

    return label;
  };

  const handleCompareClick = (event: DesignEvent) => {
    if (!selectedForCompare) {
      setSelectedForCompare(event);
    } else if (selectedForCompare.id === event.id) {
      setSelectedForCompare(null);
    } else {
      onCompareSnapshots?.(selectedForCompare, event);
      setSelectedForCompare(null);
    }
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">No Design Events</p>
        <p className="text-sm">No design activity has been recorded for this student.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-500" />
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              selectedCategory === cat.id
                ? 'bg-violet-100 border-violet-300 text-violet-700'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {cat.label}
            {cat.id !== 'all' && (
              <span className="ml-1 text-gray-400">
                ({events.filter((e) => e.eventCategory === cat.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Compare Mode Indicator */}
      {selectedForCompare && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-amber-800">
            Select another event to compare snapshots
          </span>
          <button
            onClick={() => setSelectedForCompare(null)}
            className="text-xs text-amber-600 hover:text-amber-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Event Count */}
      <div className="text-sm text-gray-500">
        Showing {filteredEvents.length} of {events.length} events
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {filteredEvents.map((event, index) => {
          const colors = getEventColor(event.eventCategory);
          const Icon = getEventIcon(event.eventType);
          const isExpanded = expandedEventId === event.id;
          const hasSnapshot = Boolean(event.agentConfigSnapshot);
          const isSelectedForCompare = selectedForCompare?.id === event.id;

          return (
            <div key={event.id} className="relative">
              {/* Timeline connector */}
              {index < filteredEvents.length - 1 && (
                <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200" />
              )}

              <div
                className={`border rounded-lg p-3 ${colors.bg} ${colors.border} ${
                  isSelectedForCompare ? 'ring-2 ring-amber-400' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-200 flex-shrink-0">
                    <Icon className={`w-4 h-4 ${colors.text}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className={`font-medium text-sm ${colors.text}`}>
                          {getEventLabel(event)}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatTime(event.timestamp)}
                          {event.totalDesignTime && (
                            <span className="ml-2">
                              (Total: {formatDuration(event.totalDesignTime)})
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {hasSnapshot && (
                          <>
                            <button
                              onClick={() => onViewSnapshot?.(event)}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              title="View snapshot"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCompareClick(event)}
                              className={`p-1 transition-colors ${
                                isSelectedForCompare
                                  ? 'text-amber-600'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                              title={
                                isSelectedForCompare
                                  ? 'Cancel compare'
                                  : selectedForCompare
                                  ? 'Compare with selected'
                                  : 'Select for compare'
                              }
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {(event.previousValue || event.newValue || event.reflectionResponse) && (
                          <button
                            onClick={() =>
                              setExpandedEventId(isExpanded ? null : event.id)
                            }
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 space-y-2">
                        {event.previousValue && (
                          <div className="text-xs">
                            <span className="text-gray-500">Previous:</span>
                            <div className="bg-red-50 text-red-800 p-2 rounded mt-1 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                              {event.previousValue.substring(0, 500)}
                              {event.previousValue.length > 500 && '...'}
                            </div>
                          </div>
                        )}
                        {event.newValue && (
                          <div className="text-xs">
                            <span className="text-gray-500">New:</span>
                            <div className="bg-green-50 text-green-800 p-2 rounded mt-1 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                              {event.newValue.substring(0, 500)}
                              {event.newValue.length > 500 && '...'}
                            </div>
                          </div>
                        )}
                        {event.reflectionResponse && (
                          <div className="text-xs">
                            <span className="text-gray-500">Reflection Response:</span>
                            <div className="bg-white p-2 rounded border border-gray-200 mt-1 whitespace-pre-wrap">
                              {event.reflectionResponse}
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
    </div>
  );
};
