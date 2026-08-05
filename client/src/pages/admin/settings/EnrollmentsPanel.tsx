import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Ticket, Upload, AlertTriangle, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../../api/admin';
import {
  batchEnrollmentApi,
  type ImportResult,
} from '../../../api/batchEnrollment';
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const importMutation = useMutation({
    mutationFn: (content: string) => batchEnrollmentApi.importPasted(content),
    onSuccess: result => {
      setImportResult(result);
      // The table behind the modal is now stale by exactly the rows we added.
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (error: any) => {
      // The server refuses the whole import on an unknown or unpermitted
      // course, and its message names which — worth surfacing verbatim.
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          t('batch_import_failed', { defaultValue: 'Import failed' }),
      );
    },
  });

  const closeBatchModal = () => {
    setShowBatchModal(false);
    setCsvText('');
    setImportResult(null);
    importMutation.reset();
  };

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
        // An invitation can carry a course, so it is a way to enrol someone who
        // does not have an account yet — the gap batch import cannot fill.
        secondaryCta={{
          label: t('invite'),
          icon: <Ticket className="w-4 h-4" />,
          onClick: () => navigate('/admin/settings?tab=invitations'),
        }}
        createCta={{
          label: t('batch_import'),
          icon: <Upload className="w-4 h-4" />,
          onClick: () => {
            setImportResult(null);
            setShowBatchModal(true);
          },
        }}
      />

      <Modal
        isOpen={showBatchModal}
        onClose={closeBatchModal}
        title={t('batch_import_enrollments')}
      >
        {importResult ? (
          <div className="space-y-4">
            <ul className="space-y-2">
              {importResult.jobs.map(job => (
                <li
                  key={job.jobId}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {job.courseTitle}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('import_enrolled_count', {
                      n: job.successCount,
                      defaultValue: '{{n}} enrolled',
                    })}
                    {job.alreadyEnrolled > 0 &&
                      ` · ${t('import_already_enrolled_count', {
                        n: job.alreadyEnrolled,
                        defaultValue: '{{n}} already enrolled',
                      })}`}
                    {job.errorCount > 0 &&
                      ` · ${t('import_failed_count', {
                        n: job.errorCount,
                        defaultValue: '{{n}} failed',
                      })}`}
                  </p>
                </li>
              ))}
            </ul>

            {/* Rows the parser could not use. These used to be dropped in
                silence, so a paste with a few typos looked like a clean run. */}
            {importResult.invalid.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {t('import_skipped_rows', {
                    n: importResult.invalid.length,
                    defaultValue: '{{n}} row(s) could not be read',
                  })}
                </p>
                <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {importResult.invalid.map(row => (
                    <li
                      key={row.rowNumber}
                      className="text-xs font-mono text-amber-800 dark:text-amber-300"
                    >
                      {t('import_row_label', {
                        row: row.rowNumber,
                        defaultValue: 'Row {{row}}',
                      })}
                      : {row.email || '—'} — {row.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* New accounts get a random password that is hashed and thrown
                away; nothing is emailed. Without this note the operator has no
                way to know the people they just added cannot sign in. */}
            {importResult.jobs.some(job => job.successCount > 0) && (
              <p className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-900 dark:text-blue-200">
                <KeyRound className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {t('import_new_user_password_note', {
                    defaultValue:
                      'Anyone who did not already have an account cannot sign in until they set a password — ask them to use “Forgot password” on the login page.',
                  })}
                </span>
              </p>
            )}

            <div className="flex justify-end">
              <Button onClick={closeBatchModal}>{t('common:done', { defaultValue: 'Done' })}</Button>
            </div>
          </div>
        ) : (
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
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('batch_import_course_id_hint', {
                defaultValue:
                  'Include the header row. A course id is the number in the course URL. Names containing a comma must be quoted.',
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeBatchModal}>
                {t('common:cancel')}
              </Button>
              <Button
                onClick={() => importMutation.mutate(csvText)}
                loading={importMutation.isPending}
                disabled={csvText.trim() === '' || importMutation.isPending}
              >
                {t('import')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
