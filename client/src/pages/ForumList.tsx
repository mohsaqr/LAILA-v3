import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { DataTable, type ColumnDef } from '../components/common/DataTable';
import apiClient from '../api/client';
import activityLogger from '../services/activityLogger';

interface ForumListItem {
  id: number;
  title: string;
  description: string | null;
  courseId: number;
  courseName: string;
  moduleId: number | null;
  moduleName: string | null;
  replyCount: number;
  lastActivity: string | null;
}

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Cross-course forum list rendered with the shared `DataTable` so it
 * matches /teach/quizzes and /teach/surveys (title-case headers, filter
 * card, global search, paginated). Read-only: clicking a row jumps to
 * the single-discussion page. Visible to every signed-in user; the row
 * set is already permission-scoped server-side.
 */
export const ForumList = () => {
  const { t } = useTranslation(['courses', 'common', 'teaching']);
  const navigate = useNavigate();

  useEffect(() => {
    activityLogger.logForumListViewed();
  }, []);

  const { data: forums = [], isLoading } = useQuery({
    queryKey: ['forums', 'all'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: ForumListItem[] }>('/forums');
      return response.data.data;
    },
  });

  // Unique courses across loaded rows — drives the column filter.
  const courseOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of forums) {
      if (!map.has(f.courseId)) map.set(f.courseId, f.courseName);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: String(id), label: name }));
  }, [forums]);

  const columns: ColumnDef<ForumListItem>[] = [
    {
      id: 'title',
      header: t('teaching:forum_title', { defaultValue: 'Forum' }),
      sortAccessor: f => f.title.toLowerCase(),
      width: '40%',
      cell: f => (
        <span
          className="block truncate font-normal text-gray-700 dark:text-gray-200"
          title={f.title}
        >
          {f.title}
        </span>
      ),
    },
    {
      id: 'course',
      header: t('teaching:quiz_column_course', { defaultValue: 'Course' }),
      sortAccessor: f => f.courseName.toLowerCase(),
      width: '32%',
      filter: {
        kind: 'select',
        options: courseOptions,
        predicate: (f, v) => String(f.courseId) === v,
      },
      cell: f => (
        <span
          className="block truncate text-gray-600 dark:text-gray-300"
          title={f.courseName}
        >
          {f.courseName}
        </span>
      ),
    },
    {
      id: 'replies',
      header: t('teaching:responses', { defaultValue: 'Replies' }),
      sortAccessor: f => f.replyCount,
      align: 'right',
      width: '7rem',
      cell: f => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums">
          {f.replyCount}
        </span>
      ),
    },
    {
      id: 'lastActivity',
      header: t('courses:last_activity', { defaultValue: 'Last activity' }),
      sortAccessor: f => f.lastActivity ?? '',
      align: 'right',
      width: '10rem',
      hideOnMobile: true,
      cell: f => (
        <span className="text-gray-500 dark:text-gray-400">
          {formatDate(f.lastActivity)}
        </span>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-6">
        <Breadcrumb items={[{ label: t('forums') }]} />
      </div>

      <DataTable<ForumListItem>
        rows={forums}
        columns={columns}
        rowKey={f => f.id}
        isLoading={isLoading}
        pageSize={20}
        onRowClick={f => navigate(`/courses/${f.courseId}/forums/${f.id}`)}
        globalSearch={{
          placeholder: t('teaching:search_forums_placeholder', {
            defaultValue: 'Search forums…',
          }),
          predicate: (f, q) => {
            const lower = q.toLowerCase();
            return (
              f.title.toLowerCase().includes(lower) ||
              f.courseName.toLowerCase().includes(lower)
            );
          },
        }}
        empty={
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
            <MessageSquare className="w-4 h-4" />
            <span>{t('forums_will_appear', { defaultValue: 'Forums appear here once your instructors create them.' })}</span>
          </div>
        }
      />
    </div>
  );
};
