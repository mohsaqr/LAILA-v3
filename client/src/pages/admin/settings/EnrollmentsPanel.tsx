import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { adminApi } from '../../../api/admin';
import { useTheme } from '../../../hooks/useTheme';
import { Button } from '../../../components/common/Button';
import { Loading } from '../../../components/common/Loading';
import { Modal } from '../../../components/common/Modal';
import toast from 'react-hot-toast';

export const EnrollmentsPanel = () => {
  const [page, setPage] = useState(1);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const limit = 15;
  const { isDark } = useTheme();

  // Theme colors
  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgHeader: isDark ? 'rgba(55, 65, 81, 0.5)' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    borderLight: isDark ? '#374151' : '#f3f4f6',
    bgProgress: isDark ? '#374151' : '#e5e7eb',
    progressBar: isDark ? '#f3f4f6' : '#111827',
    // Status badge colors
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4',
    textGreen: isDark ? '#86efac' : '#15803d',
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
    textBlue: isDark ? '#93c5fd' : '#1d4ed8',
    bgGray: isDark ? '#374151' : '#f3f4f6',
    textGray: isDark ? '#9ca3af' : '#6b7280',
    // Modal
    bgModal: isDark ? '#374151' : '#f3f4f6',
    bgInput: isDark ? '#1f2937' : '#ffffff',
  };

  const { data, isLoading } = useQuery({
    queryKey: ['enrollments', page],
    queryFn: () => adminApi.getEnrollments(page, limit),
  });

  const handleExport = async () => {
    try {
      const data = await adminApi.exportData('enrollments');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enrollments-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  if (isLoading) {
    return <Loading text="Loading enrollments..." />;
  }

  const enrollments = data?.enrollments || [];
  const pagination = data?.pagination;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Enrollments</h2>
          <p className="text-sm" style={{ color: colors.textSecondary }}>{pagination?.total || 0} total enrollments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBatchModal(true)}>
            <Upload className="w-4 h-4 mr-1" /> Batch Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.bgHeader }}>
              <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3" style={{ color: colors.textSecondary }}>Student</th>
              <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3" style={{ color: colors.textSecondary }}>Course</th>
              <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3" style={{ color: colors.textSecondary }}>Progress</th>
              <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3" style={{ color: colors.textSecondary }}>Status</th>
              <th className="text-left text-xs font-medium uppercase tracking-wider px-4 py-3" style={{ color: colors.textSecondary }}>Enrolled</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enrollment: any, index: number) => (
              <tr
                key={enrollment.id}
                style={{ borderBottom: index < enrollments.length - 1 ? `1px solid ${colors.borderLight}` : 'none' }}
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>{enrollment.user?.fullname}</p>
                    <p className="text-xs" style={{ color: colors.textSecondary }}>{enrollment.user?.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm" style={{ color: colors.textPrimary }}>{enrollment.course?.title}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.bgProgress }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${enrollment.progress || 0}%`, backgroundColor: colors.progressBar }}
                      />
                    </div>
                    <span className="text-xs w-8" style={{ color: colors.textSecondary }}>{enrollment.progress || 0}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex px-2 py-0.5 text-xs font-medium rounded"
                    style={{
                      backgroundColor: enrollment.status === 'completed' ? colors.bgGreen :
                        enrollment.status === 'active' ? colors.bgBlue : colors.bgGray,
                      color: enrollment.status === 'completed' ? colors.textGreen :
                        enrollment.status === 'active' ? colors.textBlue : colors.textGray,
                    }}
                  >
                    {enrollment.status || 'active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: colors.textSecondary }}>
                  {new Date(enrollment.enrolledAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: `1px solid ${colors.border}`, backgroundColor: colors.bgHeader }}
          >
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: colors.textSecondary }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: colors.textSecondary }}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Batch Import Modal */}
      <Modal isOpen={showBatchModal} onClose={() => setShowBatchModal(false)} title="Batch Import Enrollments">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            Paste CSV data with columns: <code className="px-1 rounded" style={{ backgroundColor: colors.bgModal, color: colors.textPrimary }}>email,course_id</code>
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="email,course_id&#10;student@example.com,1&#10;another@example.com,2"
            className="w-full h-40 px-3 py-2 text-sm font-mono rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{
              backgroundColor: colors.bgInput,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBatchModal(false)}>Cancel</Button>
            <Button onClick={() => { toast.success('Feature coming soon'); setShowBatchModal(false); }}>
              Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
