/**
 * User Interactions Tab Component for the Logs Dashboard.
 * Comprehensive interaction analytics with all database fields,
 * advanced filtering, pagination, search, sorting, and export capabilities.
 */

import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Filter,
  RefreshCw,
  Loader2,
  CheckCircle,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileJson,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MousePointer,
  Users,
  Globe,
} from 'lucide-react';
import { analyticsApi, InteractionFilters } from '../../../api/admin';
import { Card, CardBody, CardHeader } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Loading } from '../../../components/common/Loading';
import { formatDate } from './exportUtils';

interface InteractionsTabProps {
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  setExportStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
}

interface InteractionLog {
  id: number;
  timestamp: string;
  timestampMs: string | null;
  sessionId: string | null;
  sessionDuration: number | null;
  timeOnPage: number | null;
  userId: number | null;
  userFullname: string | null;
  userEmail: string | null;
  eventType: string;
  eventCategory: string | null;
  eventAction: string | null;
  eventLabel: string | null;
  eventValue: number | null;
  eventSequence: number | null;
  pagePath: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  referrerUrl: string | null;
  courseId: number | null;
  courseTitle: string | null;
  moduleId: number | null;
  moduleTitle: string | null;
  lectureId: number | null;
  lectureTitle: string | null;
  elementId: string | null;
  elementType: string | null;
  elementText: string | null;
  elementHref: string | null;
  elementClasses: string | null;
  elementName: string | null;
  elementValue: string | null;
  scrollDepth: number | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  deviceType: string | null;
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  osVersion: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  language: string | null;
  timezone: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  testMode: string | null;
}

type SortField = 'timestamp' | 'userFullname' | 'eventType' | 'pagePath' | 'courseTitle' | 'deviceType' | 'browserName' | 'scrollDepth' | 'timeOnPage';

// Event type color mappings
const eventTypeColors: Record<string, string> = {
  click: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  page_view: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  scroll: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300',
  form_submit: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  focus: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
  blur: 'bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-300',
  hover: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
  custom: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
};

export const InteractionsTab = ({ exportStatus, setExportStatus }: InteractionsTabProps) => {
  const { t } = useTranslation(['admin', 'common']);
  // Filter state
  const [filters, setFilters] = useState<InteractionFilters>({
    page: 1,
    limit: 50,
    sortBy: 'timestamp',
    sortOrder: 'desc',
  });
  const [searchInput, setSearchInput] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['interactionFilterOptions'],
    queryFn: () => analyticsApi.getInteractionFilterOptions(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch interactions
  const { data: logsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['interactions', filters],
    queryFn: () => analyticsApi.queryInteractions(filters),
  });

  // Fetch summary stats
  const { data: summary } = useQuery({
    queryKey: ['interactionSummary', filters.startDate, filters.endDate, filters.courseId],
    queryFn: () => analyticsApi.getInteractionSummary({
      startDate: filters.startDate,
      endDate: filters.endDate,
      courseId: filters.courseId,
    }),
  });

  const logs: InteractionLog[] = logsData?.logs || [];
  const pagination = logsData?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 };

  // Handle search
  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search: searchInput, page: 1 }));
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handle filter changes
  const updateFilter = (key: keyof InteractionFilters, value: string | number | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined, page: 1 }));
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Handle pagination
  const goToPage = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  // Handle row expansion
  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    });
    setSearchInput('');
  };

  // Export handlers
  const handleExportCSV = async () => {
    setExportStatus('loading');
    try {
      await analyticsApi.exportInteractionsCSV(filters);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const handleExportJSON = async () => {
    setExportStatus('loading');
    try {
      await analyticsApi.exportInteractionsJSON(filters);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  // Memoized stats display
  const statsDisplay = useMemo(() => {
    const typeStats: Record<string, number> = {};
    (summary?.byType || []).forEach((t: { type: string; count: number }) => {
      typeStats[t.type] = t.count;
    });
    const topTypes = Object.entries(typeStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { topTypes };
  }, [summary]);

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (filters.sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    }
    return filters.sortOrder === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  // Check if any filters are active
  const hasActiveFilters = filters.userId || filters.courseId || filters.eventType || filters.pagePath || filters.startDate || filters.endDate || filters.search;

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <MousePointer className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {(summary?.totalInteractions || pagination.total || 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('total_interactions')}</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {summary?.uniqueSessions || 0}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('unique_sessions')}</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('top_event_types')}</div>
            <div className="flex flex-wrap gap-1">
              {statsDisplay.topTypes.map(([type, count]: [string, number]) => (
                <span
                  key={type}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${eventTypeColors[type] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}
                >
                  {type}: {count}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Globe className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {summary?.byPage?.length || 0}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('pages_tracked')}</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Filter className="w-4 h-4" />
              {t('filters')}
              {hasActiveFilters && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full">
                  {t('active')}
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                {t('common:refresh')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={exportStatus === 'loading'}
              >
                <FileText className="w-4 h-4 mr-1" />
                {t('csv')}
              </Button>
              <Button
                size="sm"
                onClick={handleExportJSON}
                disabled={exportStatus === 'loading'}
              >
                {exportStatus === 'loading' ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : exportStatus === 'success' ? (
                  <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                ) : (
                  <FileJson className="w-4 h-4 mr-1" />
                )}
                {t('json')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('search')}</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder={t('search_user_page_course')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                {searchInput && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    onClick={() => {
                      setSearchInput('');
                      if (filters.search) {
                        updateFilter('search', undefined);
                      }
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* User Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('user')}</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.userId || ''}
                onChange={(e) => updateFilter('userId', e.target.value ? parseInt(e.target.value) : undefined)}
              >
                <option value="">{t('all_users')}</option>
                {filterOptions?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullname || u.email || `User #${u.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Course Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('course')}</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.courseId || ''}
                onChange={(e) => updateFilter('courseId', e.target.value ? parseInt(e.target.value) : undefined)}
              >
                <option value="">{t('all_courses')}</option>
                {filterOptions?.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title || `Course #${c.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Event Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('event_type')}</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.eventType || ''}
                onChange={(e) => updateFilter('eventType', e.target.value || undefined)}
              >
                <option value="">{t('all_types')}</option>
                {filterOptions?.eventTypes.map((e) => (
                  <option key={e.eventType} value={e.eventType}>
                    {e.eventType} ({e.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Page Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('page')}</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.pagePath || ''}
                onChange={(e) => updateFilter('pagePath', e.target.value || undefined)}
              >
                <option value="">{t('all_pages')}</option>
                {filterOptions?.pages.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.path.length > 30 ? '...' + p.path.slice(-27) : p.path} ({p.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Filters */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('start_date')}</label>
              <input
                type="date"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.startDate || ''}
                onChange={(e) => updateFilter('startDate', e.target.value || undefined)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('end_date')}</label>
              <input
                type="date"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.endDate || ''}
                onChange={(e) => updateFilter('endDate', e.target.value || undefined)}
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                {t('clear_filters')}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Interactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between text-gray-900 dark:text-gray-100">
            <span>{t('user_interactions')}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('showing_range', { start: (pagination.page - 1) * pagination.limit + 1, end: Math.min(pagination.page * pagination.limit, pagination.total), total: pagination.total.toLocaleString() })}
            </span>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-8"><Loading /></div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {t('no_interaction_logs')}
              {hasActiveFilters && (
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    {t('clear_filters')}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="w-8 px-2 py-3"></th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('timestamp')}
                    >
                      <div className="flex items-center">
                        {t('timestamp')}
                        <SortIcon field="timestamp" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('userFullname')}
                    >
                      <div className="flex items-center">
                        {t('user')}
                        <SortIcon field="userFullname" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('eventType')}
                    >
                      <div className="flex items-center">
                        {t('event')}
                        <SortIcon field="eventType" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('pagePath')}
                    >
                      <div className="flex items-center">
                        {t('page_label')}
                        <SortIcon field="pagePath" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('courseTitle')}
                    >
                      <div className="flex items-center">
                        {t('course')}
                        <SortIcon field="courseTitle" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('deviceType')}
                    >
                      <div className="flex items-center">
                        {t('device')}
                        <SortIcon field="deviceType" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('scrollDepth')}
                    >
                      <div className="flex items-center">
                        {t('scroll')}
                        <SortIcon field="scrollDepth" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.map((log) => (
                    <Fragment key={log.id}>
                      <tr
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        onClick={() => toggleRow(log.id)}
                      >
                        <td className="px-2 py-3 text-center">
                          {expandedRows.has(log.id) ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {log.userFullname || 'Anonymous'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{log.userEmail}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${eventTypeColors[log.eventType] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                            {log.eventType}
                          </span>
                          {log.eventAction && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{log.eventAction}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={log.pagePath || ''}>
                            {log.pagePath || '-'}
                          </div>
                          {log.pageTitle && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[150px]">{log.pageTitle}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {log.courseTitle ? (
                            <div className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                              {log.courseTitle}
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                          <div>{log.deviceType || '-'}</div>
                          <div className="text-gray-400">{log.browserName}</div>
                        </td>
                        <td className="px-4 py-3">
                          {log.scrollDepth != null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-cyan-500 dark:bg-cyan-400 rounded-full"
                                  style={{ width: `${log.scrollDepth}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 dark:text-gray-400">{log.scrollDepth}%</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                      {/* Expanded Details Row */}
                      {expandedRows.has(log.id) && (
                        <tr className="bg-gray-50 dark:bg-gray-800/50">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                              {/* User Context */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                  {t('user_context')}
                                </h4>
                                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('id')}:</span> {log.userId || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('email')}:</span> {log.userEmail || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('name')}:</span> {log.userFullname || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('session')}:</span> {log.sessionId ? log.sessionId.substring(0, 16) + '...' : '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('session_duration')}:</span> {log.sessionDuration != null ? `${log.sessionDuration}s` : '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('time_on_page')}:</span> {log.timeOnPage != null ? `${log.timeOnPage}s` : '-'}</div>
                                </div>
                              </div>

                              {/* Event Details */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                  {t('event_details')}
                                </h4>
                                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('type')}:</span> {log.eventType}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('event_category')}:</span> {log.eventCategory || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('event_action')}:</span> {log.eventAction || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('event_label')}:</span> {log.eventLabel || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('event_value')}:</span> {log.eventValue ?? '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('event_sequence')}:</span> {log.eventSequence ?? '-'}</div>
                                </div>
                              </div>

                              {/* Page & Course Context */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                  {t('page_course')}
                                </h4>
                                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('page_label')}:</span> {log.pagePath || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('title_label')}:</span> {log.pageTitle || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('referrer')}:</span> {log.referrerUrl ? log.referrerUrl.substring(0, 30) + '...' : '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('course')}:</span> {log.courseTitle || '-'} {log.courseId && `(#${log.courseId})`}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('module')}:</span> {log.moduleTitle || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('lecture')}:</span> {log.lectureTitle || '-'}</div>
                                </div>
                              </div>

                              {/* Client Info */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                  {t('client_info')}
                                </h4>
                                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('device')}:</span> {log.deviceType || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('browser')}:</span> {log.browserName} {log.browserVersion}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('os')}:</span> {log.osName} {log.osVersion}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('screen')}:</span> {log.screenWidth && log.screenHeight ? `${log.screenWidth}x${log.screenHeight}` : '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('viewport')}:</span> {log.viewportWidth && log.viewportHeight ? `${log.viewportWidth}x${log.viewportHeight}` : '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('language_label')}:</span> {log.language || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('timezone_label')}:</span> {log.timezone || '-'}</div>
                                </div>
                              </div>
                            </div>

                            {/* Element Details */}
                            {(log.elementId || log.elementType || log.elementText) && (
                              <div className="mt-4">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1 mb-2">
                                  {t('element_details')}
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('element_id')}:</span> {log.elementId || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('element_type_label')}:</span> {log.elementType || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('element_name')}:</span> {log.elementName || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('element_value_label')}:</span> {log.elementValue || '-'}</div>
                                  {log.elementText && (
                                    <div className="col-span-2"><span className="text-gray-500 dark:text-gray-500">{t('element_text')}:</span> {log.elementText.substring(0, 100)}{log.elementText.length > 100 ? '...' : ''}</div>
                                  )}
                                  {log.elementHref && (
                                    <div className="col-span-2"><span className="text-gray-500 dark:text-gray-500">{t('element_href')}:</span> {log.elementHref}</div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Metadata */}
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <div className="mt-4">
                                <details>
                                  <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {t('metadata_expand')}
                                  </summary>
                                  <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto text-gray-800 dark:text-gray-200">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            )}

                            {log.testMode && (
                              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                {t('test_mode')}: {log.testMode}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('page_x_of_y', { page: pagination.page, total: pagination.totalPages })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(1)}
                  disabled={pagination.page === 1}
                >
                  {t('first')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t('prev')}
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`px-3 py-1 rounded text-sm ${
                          pagination.page === pageNum
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  {t('next')}
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.totalPages)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  {t('last')}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
};
