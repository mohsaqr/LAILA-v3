/**
 * Chatbot Registry Tab Component for the Logs Dashboard.
 * Shows all chatbots (both Global AI Tutors and Section Chatbots) with comprehensive details
 * including system prompts, rules, creator info, course context, and usage statistics.
 */

import { useState, Fragment } from 'react';
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
  Bot,
  Globe,
  BookOpen,
  MessageSquare,
  Users,
} from 'lucide-react';
import {
  chatbotRegistryApi,
  ChatbotRegistryFilters,
  UnifiedChatbot,
} from '../../../api/admin';
import { Card, CardBody, CardHeader } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Loading } from '../../../components/common/Loading';
import { formatDate } from './exportUtils';
import { chatbotTypeColors } from './constants';

interface ChatbotRegistryTabProps {
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  setExportStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
}

type SortField =
  | 'type'
  | 'displayName'
  | 'category'
  | 'courseTitle'
  | 'creatorName'
  | 'isActive'
  | 'conversationCount'
  | 'messageCount'
  | 'uniqueUsers'
  | 'createdAt';

export const ChatbotRegistryTab = ({ exportStatus, setExportStatus }: ChatbotRegistryTabProps) => {
  const { t } = useTranslation(['admin', 'common']);
  // Filter state
  const [filters, setFilters] = useState<ChatbotRegistryFilters>({
    page: 1,
    limit: 50,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [searchInput, setSearchInput] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['chatbotRegistryFilterOptions'],
    queryFn: () => chatbotRegistryApi.getFilterOptions(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch chatbots
  const { data: chatbotsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['chatbotRegistry', filters],
    queryFn: () => chatbotRegistryApi.getChatbots(filters),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['chatbotRegistryStats', filters.startDate, filters.endDate],
    queryFn: () =>
      chatbotRegistryApi.getStats({
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
  });

  const chatbots: UnifiedChatbot[] = chatbotsData?.chatbots || [];
  const pagination = chatbotsData?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 };

  // Handle search
  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handle filter changes
  const updateFilter = (
    key: keyof ChatbotRegistryFilters,
    value: string | number | boolean | undefined
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Handle pagination
  const goToPage = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  // Handle row expansion
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
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
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    setSearchInput('');
  };

  // Export handlers
  const handleExportCSV = async () => {
    setExportStatus('loading');
    try {
      await chatbotRegistryApi.exportCSV(filters);
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
      await chatbotRegistryApi.exportExcel(filters);
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
      await chatbotRegistryApi.exportJSON(filters);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (filters.sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    }
    return filters.sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  };

  // Check if any filters are active
  const hasActiveFilters =
    filters.type ||
    filters.courseId ||
    filters.creatorId ||
    filters.category ||
    filters.isActive !== undefined ||
    filters.startDate ||
    filters.endDate ||
    filters.search;

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary-500" />
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{t('total_chatbots')}</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {(stats?.totalChatbots || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{t('global_ai_tutors')}</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {(stats?.globalChatbots || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-500" />
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{t('section_chatbots')}</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {(stats?.sectionChatbots || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-500" />
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{t('total_conversations')}</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {(stats?.totalConversations || 0).toLocaleString()}
                </div>
              </div>
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
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
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
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={exportStatus === 'loading'}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Excel
              </Button>
              <Button size="sm" onClick={handleExportJSON} disabled={exportStatus === 'loading'}>
                {exportStatus === 'loading' ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : exportStatus === 'success' ? (
                  <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                ) : (
                  <FileJson className="w-4 h-4 mr-1" />
                )}
                JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('search')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder={t('search_chatbot')}
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

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('type')}
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.type || ''}
                onChange={(e) =>
                  updateFilter('type', e.target.value as 'global' | 'section' | undefined)
                }
              >
                <option value="">{t('all_types')}</option>
                <option value="global">{t('global_ai_tutors')}</option>
                <option value="section">{t('section_chatbots')}</option>
              </select>
            </div>

            {/* Course Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('course')}
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.courseId || ''}
                onChange={(e) =>
                  updateFilter('courseId', e.target.value ? parseInt(e.target.value) : undefined)
                }
              >
                <option value="">{t('all_courses')}</option>
                {filterOptions?.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Creator Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('creator')}
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.creatorId || ''}
                onChange={(e) =>
                  updateFilter('creatorId', e.target.value ? parseInt(e.target.value) : undefined)
                }
              >
                <option value="">{t('all_creators')}</option>
                {filterOptions?.creators.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullname || u.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('category')}
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.category || ''}
                onChange={(e) => updateFilter('category', e.target.value || undefined)}
              >
                <option value="">{t('all_categories')}</option>
                {filterOptions?.categories.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category} ({c.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Filters */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-4">
            {/* Active Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('filter_by_status')}
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.isActive === undefined ? '' : filters.isActive.toString()}
                onChange={(e) =>
                  updateFilter(
                    'isActive',
                    e.target.value === '' ? undefined : e.target.value === 'true'
                  )
                }
              >
                <option value="">{t('all_status')}</option>
                <option value="true">{t('active')}</option>
                <option value="false">{t('inactive')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('start_date')}
              </label>
              <input
                type="date"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filters.startDate || ''}
                onChange={(e) => updateFilter('startDate', e.target.value || undefined)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('end_date')}
              </label>
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

      {/* Chatbots Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between text-gray-900 dark:text-gray-100">
            <span className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              {t('chatbot_registry')}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('showing_chatbots_range', { start: (pagination.page - 1) * pagination.limit + 1, end: Math.min(pagination.page * pagination.limit, pagination.total), total: pagination.total.toLocaleString() })}
            </span>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-8">
              <Loading />
            </div>
          ) : chatbots.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {t('no_chatbots_found')}
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
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center">
                        {t('type')}
                        <SortIcon field="type" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('displayName')}
                    >
                      <div className="flex items-center">
                        {t('name')}
                        <SortIcon field="displayName" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center">
                        {t('context')}
                        <SortIcon field="category" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('creatorName')}
                    >
                      <div className="flex items-center">
                        {t('creator')}
                        <SortIcon field="creatorName" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('isActive')}
                    >
                      <div className="flex items-center">
                        {t('filter_by_status')}
                        <SortIcon field="isActive" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('conversationCount')}
                    >
                      <div className="flex items-center">
                        {t('conversations_abbr')}
                        <SortIcon field="conversationCount" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('messageCount')}
                    >
                      <div className="flex items-center">
                        {t('messages_abbr')}
                        <SortIcon field="messageCount" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('uniqueUsers')}
                    >
                      <div className="flex items-center">
                        {t('users')}
                        <SortIcon field="uniqueUsers" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center">
                        {t('created')}
                        <SortIcon field="createdAt" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {chatbots.map((chatbot) => (
                    <Fragment key={chatbot.id}>
                      <tr
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        onClick={() => toggleRow(chatbot.id)}
                      >
                        <td className="px-2 py-3 text-center">
                          {expandedRows.has(chatbot.id) ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${chatbotTypeColors[chatbot.type] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}
                          >
                            {chatbot.type === 'global' ? (
                              <Globe className="w-3 h-3 mr-1" />
                            ) : (
                              <BookOpen className="w-3 h-3 mr-1" />
                            )}
                            {chatbot.type === 'global' ? t('global') : t('section')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {chatbot.avatarUrl && (
                              <img
                                src={chatbot.avatarUrl}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            )}
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {chatbot.displayName}
                              </div>
                              {chatbot.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                  {chatbot.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {chatbot.type === 'global' ? (
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {chatbot.category || t('uncategorized')}
                            </span>
                          ) : (
                            <div>
                              <div className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                                {chatbot.courseTitle}
                              </div>
                              {chatbot.lectureTitle && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                                  {chatbot.lectureTitle}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {chatbot.creatorName ? (
                            <div>
                              <div className="text-sm text-gray-700 dark:text-gray-300">
                                {chatbot.creatorName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {chatbot.creatorEmail}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">{t('system')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              chatbot.isActive
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                            }`}
                          >
                            {chatbot.isActive ? t('active') : t('inactive')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {chatbot.conversationCount}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {chatbot.messageCount}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {chatbot.uniqueUsers}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {formatDate(chatbot.createdAt)}
                        </td>
                      </tr>
                      {/* Expanded Details Row */}
                      {expandedRows.has(chatbot.id) && (
                        <tr
                          key={`${chatbot.id}-expanded`}
                          className="bg-gray-50 dark:bg-gray-800/50"
                        >
                          <td colSpan={10} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                              {/* System Prompt */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                  {t('system_prompt')}
                                </h4>
                                {chatbot.systemPrompt ? (
                                  <div className="max-h-48 overflow-y-auto p-3 bg-gray-100 dark:bg-gray-900 rounded text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-xs">
                                    {chatbot.systemPrompt}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500 italic">
                                    {t('no_system_prompt')}
                                  </span>
                                )}
                              </div>

                              {/* Rules */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                  {t('behavior_rules')}
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                  {/* Do's Rules */}
                                  <div>
                                    <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                                      {t('dos_rules')}
                                    </div>
                                    {chatbot.dosRules && chatbot.dosRules.length > 0 ? (
                                      <ul className="space-y-1">
                                        {chatbot.dosRules.map((rule, i) => (
                                          <li
                                            key={i}
                                            className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1"
                                          >
                                            <span className="text-green-500">+</span>
                                            {rule}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <span className="text-gray-400 dark:text-gray-500 text-xs italic">
                                        {t('none_defined')}
                                      </span>
                                    )}
                                  </div>
                                  {/* Don'ts Rules */}
                                  <div>
                                    <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
                                      {t('donts_rules')}
                                    </div>
                                    {chatbot.dontsRules && chatbot.dontsRules.length > 0 ? (
                                      <ul className="space-y-1">
                                        {chatbot.dontsRules.map((rule, i) => (
                                          <li
                                            key={i}
                                            className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1"
                                          >
                                            <span className="text-red-500">-</span>
                                            {rule}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <span className="text-gray-400 dark:text-gray-500 text-xs italic">
                                        {t('none_defined')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Configuration */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                  {t('configuration')}
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-400">
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-500">
                                      {t('personality')}:
                                    </span>{' '}
                                    {chatbot.personality || '-'}
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-500">
                                      {t('temperature')}:
                                    </span>{' '}
                                    {chatbot.temperature ?? '-'}
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-500">
                                      {t('max_tokens')}:
                                    </span>{' '}
                                    {chatbot.maxTokens ?? '-'}
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-500">
                                      {t('response_style')}:
                                    </span>{' '}
                                    {chatbot.responseStyle || '-'}
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-500">
                                      {t('model')}:
                                    </span>{' '}
                                    {chatbot.modelPreference || t('default_model')}
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-500">
                                      {t('last_activity')}:
                                    </span>{' '}
                                    {chatbot.lastActivity ? formatDate(chatbot.lastActivity) : '-'}
                                  </div>
                                </div>
                              </div>

                              {/* Welcome & Suggestions */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                  {t('user_experience')}
                                </h4>
                                <div className="space-y-3 text-gray-600 dark:text-gray-400">
                                  {/* Welcome Message */}
                                  <div>
                                    <div className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">
                                      {t('welcome_message')}
                                    </div>
                                    {chatbot.welcomeMessage ? (
                                      <div className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-blue-700 dark:text-blue-300">
                                        {chatbot.welcomeMessage}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400 dark:text-gray-500 text-xs italic">
                                        {t('none_defined')}
                                      </span>
                                    )}
                                  </div>
                                  {/* Suggested Questions */}
                                  {chatbot.suggestedQuestions &&
                                    chatbot.suggestedQuestions.length > 0 && (
                                      <div>
                                        <div className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">
                                          {t('suggested_questions')}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {chatbot.suggestedQuestions.map((q, i) => (
                                            <span
                                              key={i}
                                              className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded"
                                            >
                                              {q}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              </div>

                              {/* Course Hierarchy (for section chatbots) */}
                              {chatbot.type === 'section' && (
                                <div className="space-y-2 md:col-span-2">
                                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                    {t('course_hierarchy')}
                                  </h4>
                                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">{t('course')}:</span>
                                    {chatbot.courseTitle} (#{chatbot.courseId})
                                    <span className="text-gray-400 dark:text-gray-500">
                                      &rarr;
                                    </span>
                                    <span className="font-medium">{t('module')}:</span>
                                    {chatbot.moduleTitle}
                                    <span className="text-gray-400 dark:text-gray-500">
                                      &rarr;
                                    </span>
                                    <span className="font-medium">{t('lecture')}:</span>
                                    {chatbot.lectureTitle} (#{chatbot.lectureId})
                                    <span className="text-gray-400 dark:text-gray-500">
                                      &rarr;
                                    </span>
                                    <span className="font-medium">{t('section')}:</span>#{chatbot.sectionId}
                                  </div>
                                </div>
                              )}

                              {/* Knowledge Context */}
                              {chatbot.knowledgeContext && (
                                <div className="space-y-2 md:col-span-2">
                                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                    {t('knowledge_context')}
                                  </h4>
                                  <div className="max-h-32 overflow-y-auto p-3 bg-gray-100 dark:bg-gray-900 rounded text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-xs">
                                    {chatbot.knowledgeContext}
                                  </div>
                                </div>
                              )}

                              {/* Personality Prompt */}
                              {chatbot.personalityPrompt && (
                                <div className="space-y-2 md:col-span-2">
                                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                                    {t('personality_prompt')}
                                  </h4>
                                  <div className="max-h-32 overflow-y-auto p-3 bg-purple-50 dark:bg-purple-900/20 rounded text-purple-700 dark:text-purple-300 whitespace-pre-wrap text-xs">
                                    {chatbot.personalityPrompt}
                                  </div>
                                </div>
                              )}
                            </div>
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
