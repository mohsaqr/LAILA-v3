import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { adminApi } from '../../../api/admin';
import { Button } from '../../../components/common/Button';
import { Loading } from '../../../components/common/Loading';
import { Modal } from '../../../components/common/Modal';
import toast from 'react-hot-toast';

export const EnrollmentsPanel = () => {
  const [page, setPage] = useState(1);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const limit = 15;

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
          <h2 className="text-lg font-semibold text-gray-900">Enrollments</h2>
          <p className="text-sm text-gray-500">{pagination?.total || 0} total enrollments</p>
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
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Student</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Course</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Progress</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Enrolled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {enrollments.map((enrollment: any) => (
              <tr key={enrollment.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{enrollment.user?.fullname}</p>
                    <p className="text-xs text-gray-500">{enrollment.user?.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-900">{enrollment.course?.title}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-900 rounded-full transition-all"
                        style={{ width: `${enrollment.progress || 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8">{enrollment.progress || 0}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                    enrollment.status === 'completed' ? 'bg-green-50 text-green-700' :
                    enrollment.status === 'active' ? 'bg-blue-50 text-blue-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {enrollment.status || 'active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(enrollment.enrolledAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <p className="text-sm text-gray-600">
            Paste CSV data with columns: <code className="bg-gray-100 px-1 rounded">email,course_id</code>
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="email,course_id&#10;student@example.com,1&#10;another@example.com,2"
            className="w-full h-40 px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
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
