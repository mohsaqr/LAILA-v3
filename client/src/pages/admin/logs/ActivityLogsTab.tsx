/**
 * Activity Logs Tab Component for the Logs Dashboard.
 * Comprehensive learning analytics dashboard with all 28+ database fields,
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
  FileSpreadsheet,
  FileJson,
  FileText,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { activityLogApi, ActivityLogFilters } from '../../../api/admin';
import { Card, CardBody, CardHeader } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Loading } from '../../../components/common/Loading';
import { verbColors, objectTypeColors } from './constants';
import { formatDate } from './exportUtils';

interface ActivityLogsTabProps {
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  setExportStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
}

interface ActivityLog {
  id: number;
  timestamp: string;
  userId: number;
  userEmail: string | null;
  userFullname: string | null;
  userRole: string | null;
  sessionId: string | null;
  verb: string;
  objectType: string;
  objectId: number | null;
  objectTitle: string | null;
  objectSubtype: string | null;
  courseId: number | null;
  courseTitle: string | null;
  courseSlug: string | null;
  moduleId: number | null;
  moduleTitle: string | null;
  moduleOrder: number | null;
  lectureId: number | null;
  lectureTitle: string | null;
  lectureOrder: number | null;
  sectionId: number | null;
  sectionTitle: string | null;
  sectionOrder: number | null;
  success: boolean | null;
  score: number | null;
  maxScore: number | null;
  progress: number | null;
  duration: number | null;
  deviceType: string | null;
  browserName: string | null;
  extensions: Record<string, unknown> | null;
}

type SortField = 'timestamp' | 'userFullname' | 'verb' | 'objectType' | 'objectTitle' | 'courseTitle' | 'progress' | 'duration';

export const ActivityLogsTab = ({ exportStatus, setExportStatus }: ActivityLogsTabProps) => {
  const { t } = useTranslation(['admin', 'common']);
  // Filter state
  const [filters, setFilters] = useState<ActivityLogFilters>({
    page: 1,
    limit: 50,
    sortBy: 'timestamp',
    sortOrder: 'desc',
  });
  const [searchInput, setSearchInput] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['activityLogFilterOptions'],
    queryFn: () => activityLogApi.getFilterOptions(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch activity logs
  const { data: logsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['activityLogs', filters],
    queryFn: () => activityLogApi.getLogs(filters),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['activityLogStats', filters.startDate, filters.endDate, filters.courseId],
    queryFn: () => activityLogApi.getStats({
      startDate: filters.startDate,
      endDate: filters.endDate,
      courseId: filters.courseId,
    }),
  });

  const logs: ActivityLog[] = logsData?.logs || [];
  const pagination = logsData?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 };

  // Handle search with debounce
  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search: searchInput, page: 1 }));
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handle filter changes
  const updateFilter = (key: keyof ActivityLogFilters, value: string | number | undefined) => {
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
      await activityLogApi.exportCSV(filters);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const handleExportExcel = async () => {
    setExportStatus('loading');
    try {
      await activityLogApi.exportExcel(filters);
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
      await activityLogApi.exportJSON(filters);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  // Memoized stats display
  const statsDisplay = useMemo(() => {
    const verbStats: Record<string, number> = stats?.activitiesByVerb || {};
    const objectTypeStats: Record<string, number> = stats?.activitiesByObjectType || {};
    const topVerbs = Object.entries(verbStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topObjectTypes = Object.entries(objectTypeStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { topVerbs, topObjectTypes };
  }, [stats]);

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
  const hasActiveFilters = filters.userId || filters.courseId || filters.verb || filters.objectType || filters.startDate || filters.endDate || filters.search;

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('total_activities')}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {(stats?.totalActivities || pagination.total || 0).toLocaleString()}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('top_verbs')}</div>
            <div className="flex flex-wrap gap-1">
              {statsDisplay.topVerbs.map(([verb, count]: [string, number]) => (
                <span
                  key={verb}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${verbColors[verb] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}
                >
                  {verb}: {count}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('top_object_types')}</div>
            <div className="flex flex-wrap gap-1">
              {statsDisplay.topObjectTypes.map(([type, count]: [string, number]) => (
                <span
                  key={type}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${objectTypeColors[type] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}
                >
                  {type}: {count}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('unique_users')}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {filterOptions?.users.length || 0}
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
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={exportStatus === 'loading'}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                {t('excel')}
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
                  placeholder={t('search_user_object_course')}
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
                  <option key={c.id} value={c.id || ''}>
                    {c.title || `Course #${c.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Verb Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('verb')}</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.verb || ''}
                onChange={(e) => updateFilter('verb', e.target.value || undefined)}
              >
                <option value="">{t('all_verbs')}</option>
                {filterOptions?.verbs.map((v) => (
                  <option key={v.verb} value={v.verb}>
                    {v.verb} ({v.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Object Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('object_type')}</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.objectType || ''}
                onChange={(e) => updateFilter('objectType', e.target.value || undefined)}
              >
                <option value="">{t('all_types')}</option>
                {filterOptions?.objectTypes.map((o) => (
                  <option key={o.objectType} value={o.objectType}>
                    {o.objectType} ({o.count})
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

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between text-gray-900 dark:text-gray-100">
            <span>{t('activity_logs')}</span>
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
              {t('no_activity_logs')}
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
                      onClick={() => handleSort('verb')}
                    >
                      <div className="flex items-center">
                        {t('verb')}
                        <SortIcon field="verb" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('objectType')}
                    >
                      <div className="flex items-center">
                        {t('object_type')}
                        <SortIcon field="objectType" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('objectTitle')}
                    >
                      <div className="flex items-center">
                        {t('object')}
                        <SortIcon field="objectTitle" />
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
                      onClick={() => handleSort('progress')}
                    >
                      <div className="flex items-center">
                        {t('progress')}
                        <SortIcon field="progress" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('duration')}
                    >
                      <div className="flex items-center">
                        {t('duration')}
                        <SortIcon field="duration" />
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
                            {log.userFullname || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{log.userEmail}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${verbColors[log.verb] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                            {log.verb}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${objectTypeColors[log.objectType] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                            {log.objectType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                            {log.objectTitle || '-'}
                          </div>
                          {log.objectSubtype && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">{log.objectSubtype}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {log.courseTitle ? (
                            <div className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                              {log.courseTitle}
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {log.progress != null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                                  style={{ width: `${log.progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 dark:text-gray-400">{log.progress}%</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {log.duration != null ? `${log.duration}s` : '-'}
                        </td>
                      </tr>
                      {/* Expanded Details Row */}
                      {expandedRows.has(log.id) && (
                        <tr key={`${log.id}-expanded`} className="bg-gray-50 dark:bg-gray-800/50">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                              {/* User Context */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                  {t('user_context')}
                                </h4>
                                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('id')}:</span> {log.userId}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('email')}:</span> {log.userEmail || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('name')}:</span> {log.userFullname || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('role')}:</span> {log.userRole || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('session')}:</span> {log.sessionId ? log.sessionId.substring(0, 16) + '...' : '-'}</div>
                                </div>
                              </div>

                              {/* Course Hierarchy */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                  {t('course_hierarchy')}
                                </h4>
                                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('course')}:</span> {log.courseTitle || '-'} {log.courseId && `(#${log.courseId})`}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('module')}:</span> {log.moduleTitle || '-'} {log.moduleOrder != null && `(${t('order')}: ${log.moduleOrder})`}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('lecture')}:</span> {log.lectureTitle || '-'} {log.lectureOrder != null && `(${t('order')}: ${log.lectureOrder})`}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('section')}:</span> {log.sectionTitle || '-'} {log.sectionOrder != null && `(${t('order')}: ${log.sectionOrder})`}</div>
                                </div>
                              </div>

                              {/* Results */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                  {t('results')}
                                </h4>
                                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('common:success')}:</span> {log.success != null ? (log.success ? t('common:yes') : t('common:no')) : '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('score')}:</span> {log.score != null ? `${log.score}${log.maxScore != null ? ` / ${log.maxScore}` : ''}` : '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('progress')}:</span> {log.progress != null ? `${log.progress}%` : '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('duration')}:</span> {log.duration != null ? `${log.duration} ${t('seconds')}` : '-'}</div>
                                </div>
                              </div>

                              {/* Client Info */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                  {t('client_info')}
                                </h4>
                                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('device')}:</span> {log.deviceType || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('browser')}:</span> {log.browserName || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('object_id')}:</span> {log.objectId || '-'}</div>
                                  <div><span className="text-gray-500 dark:text-gray-500">{t('subtype')}:</span> {log.objectSubtype || '-'}</div>
                                </div>
                              </div>
                            </div>

                            {/* Extensions JSON */}
                            {log.extensions && Object.keys(log.extensions).length > 0 && (() => {
                              const ext = log.extensions as Record<string, string | number | boolean | null>;
                              return (
                                <div className="mt-4">
                                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1 mb-2">
                                    {t('extensions')}
                                  </h4>
                                  {/* Show specific fields nicely */}
                                  {ext.userMessage && (
                                    <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-700 dark:text-blue-300 text-sm">
                                      <span className="font-medium">{t('user_message')}:</span> {String(ext.userMessage)}
                                    </div>
                                  )}
                                  {ext.assistantMessage && (
                                    <div className="mb-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-green-700 dark:text-green-300 text-sm">
                                      <span className="font-medium">{t('ai_response')}:</span> {String(ext.assistantMessage)}
                                    </div>
                                  )}
                                  {ext.aiModel && (
                                    <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                                      <span className="font-medium">{t('ai_model')}:</span> {String(ext.aiModel)}
                                    </div>
                                  )}
                                  {/* Show full JSON for other fields */}
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                                      {t('view_raw_json')}
                                    </summary>
                                    <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto text-gray-800 dark:text-gray-200">
                                      {JSON.stringify(log.extensions, null, 2)}
                                    </pre>
                                  </details>
                                </div>
                              );
                            })()}
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
