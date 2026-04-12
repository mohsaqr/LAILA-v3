/**
 * Design Analytics Summary Component
 *
 * Shows summary statistics and analytics for a student's design process.
 */

import { useMemo } from 'react';
import {
  Clock,
  RefreshCw,
  MessageSquare,
  Target,
  Sparkles,
  FileText,
  BarChart2,
  Network,
  LayoutList,
  LogIn,
} from 'lucide-react';
import { tna } from 'dynajs';
import type { TNA } from 'dynajs';
import { TnaIndexPlot } from '../../tna/TnaIndexPlot';
import { TnaNetworkGraph } from '../../tna/TnaNetworkGraph';
import { ActivityDonutChart } from '../../tna/ActivityDonutChart';
import { createColorMap } from '../../tna/colorFix';

interface DesignAnalytics {
  totalDesignTime: number;
  sittingCount?: number;
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
}

interface DesignEvent {
  eventCategory: string;
}

interface DesignAnalyticsSummaryProps {
  analytics: DesignAnalytics;
  events?: DesignEvent[];
}

export const DesignAnalyticsSummary = ({ analytics, events }: DesignAnalyticsSummaryProps) => {
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const reflectionCount = Object.keys(analytics.reflectionResponses || {}).length;

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    field: 'Field Changes',
    template: 'Templates',
    rule: 'Rules',
    test: 'Testing',
    reflection: 'Reflections',
    save: 'Saves',
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Total Design Time */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Total Design Time</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {analytics.totalDesignTime > 0
              ? formatDuration(analytics.totalDesignTime)
              : 'N/A'}
          </div>
        </div>

        {/* Sittings */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <LogIn className="w-4 h-4" />
            <span className="text-xs font-medium">Sittings</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {analytics.sittingCount ?? 0}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            (times the page was opened)
          </p>
        </div>

        {/* Iterations */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs font-medium">Iterations</span>
          </div>
          <div className="text-2xl font-bold text-violet-600">
            {analytics.iterationCount}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            (edits after testing)
          </p>
        </div>

        {/* Test Conversations */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs font-medium">Test Conversations</span>
          </div>
          <div className="text-2xl font-bold text-cyan-600">
            {analytics.testConversationCount}
          </div>
        </div>

        {/* Reflections */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium">Reflections</span>
          </div>
          <div className="text-2xl font-bold text-pink-600">{reflectionCount}</div>
        </div>
      </div>

      {/* Template Usage */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-600" />
          Template Usage
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Pedagogical Role:</span>
            <p className="font-medium text-gray-900">
              {analytics.templateUsage.roleUsed || 'None selected'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Personality:</span>
            <p className="font-medium text-gray-900 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {analytics.templateUsage.personalityUsed || 'None selected'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Templates Applied:</span>
            <p className="font-medium text-gray-900">
              {analytics.templateUsage.templatesApplied}
            </p>
          </div>
        </div>
      </div>

      {/* Event Category Breakdown */}
      {analytics.categoryBreakdown && analytics.totalEvents && analytics.totalEvents > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-violet-600" />
            Activity Breakdown
            <span className="text-xs font-normal text-gray-500">
              ({analytics.totalEvents} total events)
            </span>
          </h4>
          <div className="space-y-2">
            {Object.entries(analytics.categoryBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => {
                const percentage = Math.round((count / analytics.totalEvents!) * 100);
                return (
                  <div key={category} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-24">
                      {categoryLabels[category] || category}
                    </span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-16 text-right">
                      {count} ({percentage}%)
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Reflection Responses */}
      {reflectionCount > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-pink-600" />
            Reflection Responses
          </h4>
          <div className="space-y-4">
            {Object.entries(analytics.reflectionResponses).map(([promptId, response]) => {
              const promptLabels: Record<string, string> = {
                role_selected: 'Role Selection',
                system_prompt_written: 'System Prompt',
                first_test_completed: 'First Test',
                post_test_edit: 'Post-Test Edit',
                before_submission: 'Before Submission',
              };

              return (
                <div key={promptId} className="border-l-2 border-pink-300 pl-3">
                  <h5 className="text-xs font-medium text-pink-700 mb-1">
                    {promptLabels[promptId] || promptId}
                  </h5>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{response}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TNA Charts */}
      <TnaChartsSection events={events} categoryBreakdown={analytics.categoryBreakdown} categoryLabels={categoryLabels} />
    </div>
  );
};

/**
 * TNA Charts Section — renders ActivityDonutChart, TnaIndexPlot, and TnaNetworkGraph
 * from the design process event sequence.
 */
function TnaChartsSection({
  events,
  categoryBreakdown,
  categoryLabels,
}: {
  events?: DesignEvent[];
  categoryBreakdown?: Record<string, number>;
  categoryLabels: Record<string, string>;
}) {
  const { sequence, labels, colorMap, tnaModel, donutData } = useMemo(() => {
    // Session events are surfaced as the Sittings stat, not as a node in the
    // transition network or a bar in the sequence plot. Drop them here so
    // they don't pollute the charts.
    const filteredEvents = (events || []).filter(
      (e) => e.eventCategory !== 'session'
    );
    if (filteredEvents.length < 2) {
      return { sequence: [], labels: [], colorMap: {}, tnaModel: null, donutData: null };
    }

    // Build the sequence of category labels from events
    const seq = filteredEvents.map(e => categoryLabels[e.eventCategory] || e.eventCategory);

    // Derive unique labels preserving order of first appearance
    const seen = new Set<string>();
    const uniqueLabels: string[] = [];
    for (const s of seq) {
      if (!seen.has(s)) {
        seen.add(s);
        uniqueLabels.push(s);
      }
    }

    const cm = createColorMap(uniqueLabels);

    // Build TNA model from the single sequence
    let model: TNA | null = null;
    try {
      model = tna([seq], { labels: uniqueLabels });
    } catch {
      // If TNA computation fails (e.g., too few states), skip network graph
    }

    // Build donut data from categoryBreakdown with human-readable labels
    let donut: Record<string, number> | null = null;
    if (categoryBreakdown) {
      donut = {};
      for (const [cat, count] of Object.entries(categoryBreakdown)) {
        donut[categoryLabels[cat] || cat] = count;
      }
    }

    return { sequence: seq, labels: uniqueLabels, colorMap: cm, tnaModel: model, donutData: donut };
  }, [events, categoryBreakdown, categoryLabels]);

  if (sequence.length < 2) return null;

  return (
    <>
      {/* Activity Donut Chart */}
      {donutData && (
        <ActivityDonutChart data={donutData} title="Activity Distribution" />
      )}

      {/* TNA Index Plot */}
      {sequence.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-violet-600" />
            Design Process Sequence
          </h4>
          <TnaIndexPlot sequences={[sequence]} labels={labels} colorMap={colorMap} />
        </div>
      )}

      {/* TNA Network Graph */}
      {tnaModel && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Network className="w-4 h-4 text-violet-600" />
            Activity Transition Network
          </h4>
          <TnaNetworkGraph
            model={tnaModel}
            colorMap={colorMap}
            showSelfLoops={true}
            showEdgeLabels={true}
            height={400}
          />
        </div>
      )}
    </>
  );
}
