import { useState } from 'react';
import {
  Download,
  FileText,
  FileSpreadsheet,
  Archive,
  Settings,
  Calendar,
  Filter,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileJson,
  Users,
  MessageCircle,
  Shield,
  Activity,
  BookOpen,
  ClipboardList,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../common/Card';
import { Button } from '../common/Button';
import { analyticsExportApi } from '../../api/admin';

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  exportFn: (filters: ExportFilters) => Promise<void>;
}

interface ExportFilters {
  startDate?: string;
  endDate?: string;
  courseId?: number;
  userId?: number;
}

export const ExportPanel = () => {
  const [filters, setFilters] = useState<ExportFilters>({});
  const [exportStatus, setExportStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [expandedFormat, setExpandedFormat] = useState<'csv' | 'excel' | 'zip' | 'json' | null>('csv');

  const handleExport = async (id: string, exportFn: (filters: ExportFilters) => Promise<void>) => {
    setExportStatus(prev => ({ ...prev, [id]: 'loading' }));
    try {
      await exportFn(filters);
      setExportStatus(prev => ({ ...prev, [id]: 'success' }));
      setTimeout(() => {
        setExportStatus(prev => ({ ...prev, [id]: 'idle' }));
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus(prev => ({ ...prev, [id]: 'error' }));
      setTimeout(() => {
        setExportStatus(prev => ({ ...prev, [id]: 'idle' }));
      }, 3000);
    }
  };

  const csvExports: ExportOption[] = [
    {
      id: 'chatbot-logs',
      label: 'Chatbot Logs',
      description: 'AI chatbot interactions with full config',
      icon: <MessageCircle className="w-4 h-4" />,
      exportFn: analyticsExportApi.exportChatbotLogsCSV,
    },
    {
      id: 'user-interactions',
      label: 'User Interactions',
      description: 'Clicks, navigation, and page events',
      icon: <Users className="w-4 h-4" />,
      exportFn: analyticsExportApi.exportUserInteractionsCSV,
    },
    {
      id: 'auth-logs',
      label: 'Auth Logs',
      description: 'Login, logout, and auth events',
      icon: <Shield className="w-4 h-4" />,
      exportFn: analyticsExportApi.exportAuthLogsCSV,
    },
    {
      id: 'system-events',
      label: 'System Events',
      description: 'Admin/teacher CRUD operations',
      icon: <Activity className="w-4 h-4" />,
      exportFn: analyticsExportApi.exportSystemEventsCSV,
    },
    {
      id: 'assessment-logs',
      label: 'Assessment Logs',
      description: 'Submissions, grades, feedback',
      icon: <ClipboardList className="w-4 h-4" />,
      exportFn: analyticsExportApi.exportAssessmentLogsCSV,
    },
    {
      id: 'content-events',
      label: 'Content Events',
      description: 'Video, lecture, document access',
      icon: <BookOpen className="w-4 h-4" />,
      exportFn: analyticsExportApi.exportContentEventsCSV,
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Export Analytics Data</h3>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        {/* Filters */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-sm text-gray-700">Export Filters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value || undefined }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value || undefined }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Course ID (optional)</label>
              <input
                type="number"
                placeholder="All courses"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={filters.courseId || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, courseId: e.target.value ? parseInt(e.target.value) : undefined }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">User ID (optional)</label>
              <input
                type="number"
                placeholder="All users"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={filters.userId || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value ? parseInt(e.target.value) : undefined }))}
              />
            </div>
          </div>
          {(filters.startDate || filters.endDate || filters.courseId || filters.userId) && (
            <button
              className="mt-3 text-xs text-primary-600 hover:text-primary-700"
              onClick={() => setFilters({})}
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* CSV Exports */}
        <div className="border rounded-lg overflow-hidden">
          <button
            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
            onClick={() => setExpandedFormat(expandedFormat === 'csv' ? null : 'csv')}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              <span className="font-medium">CSV Files</span>
              <span className="text-xs text-gray-500">(Individual log types)</span>
            </div>
            <span className="text-gray-400">{expandedFormat === 'csv' ? '−' : '+'}</span>
          </button>
          {expandedFormat === 'csv' && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {csvExports.map((option) => (
                <div
                  key={option.id}
                  className="border rounded-lg p-3 hover:border-primary-300 hover:bg-primary-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span className="font-medium text-sm">{option.label}</span>
                    </div>
                    {getStatusIcon(exportStatus[option.id] || 'idle')}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{option.description}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleExport(option.id, option.exportFn)}
                    disabled={exportStatus[option.id] === 'loading'}
                    icon={exportStatus[option.id] === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  >
                    Download CSV
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Excel Export */}
        <div className="border rounded-lg overflow-hidden">
          <button
            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
            onClick={() => setExpandedFormat(expandedFormat === 'excel' ? null : 'excel')}
          >
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <span className="font-medium">Excel Workbook</span>
              <span className="text-xs text-gray-500">(All data in one file with sheets)</span>
            </div>
            <span className="text-gray-400">{expandedFormat === 'excel' ? '−' : '+'}</span>
          </button>
          {expandedFormat === 'excel' && (
            <div className="p-4">
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  Downloads a single Excel file with 6 sheets: Chatbot Logs, User Interactions, Auth Events, System Events, Assessment Logs, and Content Events.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => handleExport('excel-all', analyticsExportApi.exportAllExcel)}
                disabled={exportStatus['excel-all'] === 'loading'}
                icon={exportStatus['excel-all'] === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              >
                {exportStatus['excel-all'] === 'loading' ? 'Generating...' : 'Download Excel Workbook'}
              </Button>
              {exportStatus['excel-all'] === 'success' && (
                <span className="ml-3 text-sm text-green-600">Download started!</span>
              )}
            </div>
          )}
        </div>

        {/* ZIP Export */}
        <div className="border rounded-lg overflow-hidden">
          <button
            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
            onClick={() => setExpandedFormat(expandedFormat === 'zip' ? null : 'zip')}
          >
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-purple-600" />
              <span className="font-medium">ZIP Archive</span>
              <span className="text-xs text-gray-500">(All CSVs bundled)</span>
            </div>
            <span className="text-gray-400">{expandedFormat === 'zip' ? '−' : '+'}</span>
          </button>
          {expandedFormat === 'zip' && (
            <div className="p-4">
              <div className="bg-purple-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-purple-800">
                  Downloads a ZIP file containing all 6 CSV files. Best for importing into statistical software like SPSS, R, or Python.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => handleExport('zip-all', analyticsExportApi.exportAllZip)}
                disabled={exportStatus['zip-all'] === 'loading'}
                icon={exportStatus['zip-all'] === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              >
                {exportStatus['zip-all'] === 'loading' ? 'Generating...' : 'Download ZIP Archive'}
              </Button>
              {exportStatus['zip-all'] === 'success' && (
                <span className="ml-3 text-sm text-green-600">Download started!</span>
              )}
            </div>
          )}
        </div>

        {/* JSON Settings Export */}
        <div className="border rounded-lg overflow-hidden">
          <button
            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
            onClick={() => setExpandedFormat(expandedFormat === 'json' ? null : 'json')}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-600" />
              <span className="font-medium">Course Settings (JSON)</span>
              <span className="text-xs text-gray-500">(Chatbot configurations)</span>
            </div>
            <span className="text-gray-400">{expandedFormat === 'json' ? '−' : '+'}</span>
          </button>
          {expandedFormat === 'json' && (
            <div className="p-4">
              <div className="bg-amber-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-800">
                  Exports course structure and chatbot configurations as JSON. Useful for documenting your course setup and chatbot prompts.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => handleExport('json-settings', () => analyticsExportApi.exportCourseSettingsJSON(filters.courseId))}
                disabled={exportStatus['json-settings'] === 'loading'}
                icon={exportStatus['json-settings'] === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
              >
                {exportStatus['json-settings'] === 'loading' ? 'Generating...' : 'Download Course Settings'}
              </Button>
              {exportStatus['json-settings'] === 'success' && (
                <span className="ml-3 text-sm text-green-600">Download started!</span>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
