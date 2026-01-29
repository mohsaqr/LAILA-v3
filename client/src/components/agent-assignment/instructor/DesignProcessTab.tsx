/**
 * Design Process Tab Component
 *
 * Main tab component for viewing a student's complete design process.
 * Combines analytics summary, design timeline, and config snapshots.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, Clock, List, AlertCircle, Loader2 } from 'lucide-react';
import { agentAssignmentsApi } from '../../../api/agentAssignments';
import { DesignTimeline } from './DesignTimeline';
import { DesignAnalyticsSummary } from './DesignAnalyticsSummary';
import { ConfigSnapshot } from './ConfigSnapshot';
import { ConfigDiff } from './ConfigDiff';

interface DesignProcessTabProps {
  agentConfigId: number;
}

type ViewMode = 'summary' | 'timeline';

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

export const DesignProcessTab = ({ agentConfigId }: DesignProcessTabProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [snapshotEvent, setSnapshotEvent] = useState<DesignEvent | null>(null);
  const [compareEvents, setCompareEvents] = useState<[DesignEvent, DesignEvent] | null>(null);

  // Fetch design events and analytics
  const { data, isLoading, error } = useQuery({
    queryKey: ['designEvents', agentConfigId],
    queryFn: () => agentAssignmentsApi.getDesignEvents(agentConfigId),
  });

  const handleViewSnapshot = (event: DesignEvent) => {
    if (event.agentConfigSnapshot) {
      setSnapshotEvent(event);
    }
  };

  const handleCompareSnapshots = (event1: DesignEvent, event2: DesignEvent) => {
    if (event1.agentConfigSnapshot && event2.agentConfigSnapshot) {
      // Ensure event1 is earlier than event2
      const [earlier, later] =
        new Date(event1.timestamp) < new Date(event2.timestamp)
          ? [event1, event2]
          : [event2, event1];
      setCompareEvents([earlier, later]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        <span className="ml-3 text-gray-600">Loading design process data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Failed to Load Design Data
        </h3>
        <p className="text-gray-600">
          {(error as Error)?.message || 'Something went wrong'}
        </p>
      </div>
    );
  }

  if (!data || data.events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">No Design Activity Recorded</p>
        <p className="text-sm mt-1">
          The enhanced design logger was not active when this student designed their agent,
          or no events were captured.
        </p>
      </div>
    );
  }

  const events = data.events as unknown as DesignEvent[];
  const analytics = data.analytics as {
    totalDesignTime: number;
    iterationCount: number;
    testConversationCount: number;
    templateUsage: {
      roleUsed: string | null;
      personalityUsed: string | null;
      templatesApplied: number;
    };
    reflectionResponses: Record<string, string>;
    categoryBreakdown?: Record<string, number>;
    totalEvents?: number;
  };

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
        <button
          onClick={() => setViewMode('summary')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'summary'
              ? 'bg-violet-100 text-violet-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Summary & Analytics
        </button>
        <button
          onClick={() => setViewMode('timeline')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'timeline'
              ? 'bg-violet-100 text-violet-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <List className="w-4 h-4" />
          Full Timeline
          <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
            {events.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {viewMode === 'summary' && <DesignAnalyticsSummary analytics={analytics} />}

      {viewMode === 'timeline' && (
        <DesignTimeline
          events={events}
          onViewSnapshot={handleViewSnapshot}
          onCompareSnapshots={handleCompareSnapshots}
        />
      )}

      {/* Snapshot Modal */}
      {snapshotEvent && snapshotEvent.agentConfigSnapshot && (
        <ConfigSnapshot
          snapshot={snapshotEvent.agentConfigSnapshot}
          timestamp={snapshotEvent.timestamp}
          onClose={() => setSnapshotEvent(null)}
        />
      )}

      {/* Diff Modal */}
      {compareEvents && (
        <ConfigDiff
          snapshot1={compareEvents[0].agentConfigSnapshot!}
          timestamp1={compareEvents[0].timestamp}
          snapshot2={compareEvents[1].agentConfigSnapshot!}
          timestamp2={compareEvents[1].timestamp}
          onClose={() => setCompareEvents(null)}
        />
      )}
    </div>
  );
};
