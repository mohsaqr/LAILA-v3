import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../../api/admin';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import {
  DataTable,
  type ColumnDef,
} from '../../../components/common/DataTable';

interface AdminEnrollment {
  id: number;
  progress?: number;
  status?: string;
  enrolledAt: string;
  user?: { fullname?: string; email?: string };
  course?: { title?: string };
}

export const EnrollmentsPanel = () => {
  const { t } = useTranslation(['admin', 'common']);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [csvText, setCsvText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['enrollments', 'all'],
    queryFn: () => adminApi.getEnrollments(1, 1000),
  });

  const enrollments: AdminEnrollment[] = data?.enrollments ?? [];

  const handleExport = async () => {
    try {
      const payload = await adminApi.exportData('enrollments');
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enrollments-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('export_downloaded'));
    } catch {
      toast.error(t('export_failed'));
    }
  };

  const statusKeys = Array.from(
    new Set(enrollments.map(e => e.status || 'active')),
  );

  const columns: ColumnDef<AdminEnrollment>[] = [
    {
      id: 'student',
      header: t('student'),
      sortAccessor: e => (e.user?.fullname || '').toLowerCase(),
      width: '32%',
      cell: e => (
        <div className="min-w-0">
          <p className="text-sm truncate text-gray-700 dark:text-gray-200">
            {e.user?.fullname}
          </p>
          <p className="text-xs truncate text-gray-500 dark:text-gray-400">
            {e.user?.email}
          </p>
        </div>
      ),
    },
    {
      id: 'course',
      header: t('course'),
      sortAccessor: e => (e.course?.title || '').toLowerCase(),
      width: '28%',
      cell: e => (
        <span className="text-sm text-gray-700 dark:text-gray-200 truncate block">
          {e.course?.title}
        </span>
      ),
    },
    {
      id: 'progress',
      header: t('progress'),
      sortAccessor: e => e.progress ?? 0,
      width: '9rem',
      align: 'left',
      hideOnMobile: true,
      cell: e => {
        const p = e.progress || 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-gray-700 dark:bg-gray-200 transition-all"
                style={{ width: `${p}%` }}
              />
            </div>
            <span className="text-xs w-8 tabular-nums text-gray-600 dark:text-gray-300">
              {p}%
            </span>
          </div>
        );
      },
    },
    {
      id: 'status',
      header: t('status'),
      sortAccessor: e => e.status || 'active',
      width: '7rem',
      filter:
        statusKeys.length > 1
          ? {
              kind: 'select',
              options: statusKeys.map(s => ({ value: s, label: s })),
              predicate: (e, v) => (e.status || 'active') === v,
            }
          : undefined,
      cell: e => {
        const s = e.status || 'active';
        const cls =
          s === 'completed'
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : s === 'active'
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
        return (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${cls}`}>
            {s}
          </span>
        );
      },
    },
    {
      id: 'enrolled',
      header: t('enrolled'),
      sortAccessor: e => new Date(e.enrolledAt).getTime(),
      width: '7rem',
      hideOnMobile: true,
      align: 'right',
      cell: e => (
        <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums">
          {new Date(e.enrolledAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div>
      <DataTable<AdminEnrollment>
        rows={enrollments}
        columns={columns}
        rowKey={e => e.id}
        isLoading={isLoading}
        pageSize={15}
        globalSearch={{
          placeholder: t('search_enrollments', {
            defaultValue: 'Search by student or course…',
          }),
          predicate: (e, q) => {
            const l = q.toLowerCase();
            return (
              (e.user?.fullname || '').toLowerCase().includes(l) ||
              (e.user?.email || '').toLowerCase().includes(l) ||
              (e.course?.title || '').toLowerCase().includes(l)
            );
          },
        }}
        exportAction={{ onClick: handleExport }}
        createCta={{
          label: t('batch_import'),
          icon: <Upload className="w-4 h-4" />,
          onClick: () => setShowBatchModal(true),
        }}
      />

      <Modal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title={t('batch_import_enrollments')}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('batch_import_instructions')}{' '}
            <code className="px-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              email,course_id
            </code>
          </p>
          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder="email,course_id&#10;student@example.com,1&#10;another@example.com,2"
            className="w-full h-40 px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBatchModal(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={() => {
                toast.success(t('feature_coming_soon'));
                setShowBatchModal(false);
              }}
            >
              {t('import')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
