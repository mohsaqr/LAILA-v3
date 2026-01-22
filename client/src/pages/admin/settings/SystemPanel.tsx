import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, RefreshCw, Download, HardDrive, Clock, Shield, AlertTriangle } from 'lucide-react';
import { adminApi } from '../../../api/admin';
import { Button } from '../../../components/common/Button';
import { Loading } from '../../../components/common/Loading';
import toast from 'react-hot-toast';

export const SystemPanel = () => {
  const queryClient = useQueryClient();
  const [confirmReset, setConfirmReset] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['systemStats'],
    queryFn: () => adminApi.getStats(),
  });

  const stats = data?.stats;

  const handleExportAll = async () => {
    try {
      toast.loading('Preparing export...');
      const allData = await Promise.all([
        adminApi.exportData('users'),
        adminApi.exportData('courses'),
        adminApi.exportData('enrollments'),
      ]);
      const exportData = { users: allData[0], courses: allData[1], enrollments: allData[2] };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laila-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss();
      toast.success('Export downloaded');
    } catch {
      toast.dismiss();
      toast.error('Export failed');
    }
  };

  if (isLoading) {
    return <Loading text="Loading system info..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">System Settings</h2>
        <p className="text-sm text-gray-500">System information and maintenance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats?.totalCourses || 0}</p>
              <p className="text-xs text-gray-500">Total Courses</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <HardDrive className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats?.totalUsers || 0}</p>
              <p className="text-xs text-gray-500">Total Users</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats?.totalEnrollments || 0}</p>
              <p className="text-xs text-gray-500">Enrollments</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Shield className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats?.activeUsers || stats?.totalUsers || 0}</p>
              <p className="text-xs text-gray-500">Active Users</p>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white border border-gray-200 rounded-lg mb-6">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">System Information</h3>
        </div>
        <div className="p-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">Application</dt>
              <dd className="text-gray-900 font-medium">LAILA LMS v3.0</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">Environment</dt>
              <dd className="text-gray-900 font-medium">{import.meta.env.MODE}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">Database</dt>
              <dd className="text-gray-900 font-medium">SQLite (Prisma)</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">Server Status</dt>
              <dd className="text-green-600 font-medium">Online</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Data Export */}
      <div className="bg-white border border-gray-200 rounded-lg mb-6">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">Data Management</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Export All Data</p>
              <p className="text-xs text-gray-500">Download a complete backup of all system data</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportAll}>
              <Download className="w-4 h-4 mr-1" /> Export JSON
            </Button>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Refresh Cache</p>
              <p className="text-xs text-gray-500">Clear cached data and refresh statistics</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { queryClient.invalidateQueries(); toast.success('Cache refreshed'); }}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white border border-red-200 rounded-lg">
        <div className="px-4 py-3 border-b border-red-200 bg-red-50">
          <h3 className="text-sm font-medium text-red-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Danger Zone
          </h3>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Reset Demo Data</p>
              <p className="text-xs text-gray-500">Reset the database to initial demo state. This cannot be undone.</p>
            </div>
            {!confirmReset ? (
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmReset(true)}>
                Reset Data
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { toast.error('Reset functionality not implemented'); setConfirmReset(false); }}>
                  Confirm Reset
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
