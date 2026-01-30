import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { batchEnrollmentApi } from '../../api/batchEnrollment';
import { coursesApi } from '../../api/courses';
import { AdminLayout } from '../../components/admin';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Modal } from '../../components/common/Modal';
import { BatchEnrollmentJob, BatchEnrollmentResult, Course } from '../../types';

export const BatchEnrollment = () => {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedJob, setSelectedJob] = useState<BatchEnrollmentJob | null>(null);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['allCoursesForBatch'],
    queryFn: () => coursesApi.getCourses({ page: 1, limit: 100 }),
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['batchEnrollmentJobs'],
    queryFn: () => batchEnrollmentApi.getJobs(1, 20),
  });

  const { data: jobResults, isLoading: resultsLoading } = useQuery({
    queryKey: ['batchJobResults', selectedJob?.id],
    queryFn: () => batchEnrollmentApi.getJobResults(selectedJob!.id, 1, 100),
    enabled: !!selectedJob && isResultsModalOpen,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ courseId, file }: { courseId: number; file: File }) =>
      batchEnrollmentApi.uploadCSV(courseId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batchEnrollmentJobs'] });
      setSelectedFile(null);
      setSelectedCourseId(null);
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedCourseId || !selectedFile) return;
    uploadMutation.mutate({ courseId: selectedCourseId, file: selectedFile });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getResultStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
            Success
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">Error</span>
        );
      case 'skipped':
        return (
          <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
            Skipped
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <AdminLayout
      title="Batch Enrollment"
      description="Upload CSV to enroll multiple users at once"
      headerActions={
        <Button variant="outline" onClick={() => batchEnrollmentApi.downloadTemplate()}>
          <Download className="w-4 h-4 mr-2" />
          Download Template
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Upload CSV File</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {/* Course Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Course
              </label>
              <select
                value={selectedCourseId || ''}
                onChange={(e) => setSelectedCourseId(Number(e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                disabled={coursesLoading}
              >
                <option value="">Choose a course...</option>
                {coursesData?.courses?.map((course: Course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            {/* File Upload */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <FileText className="w-12 h-12 text-primary-500 mx-auto" />
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <p className="text-gray-600">
                    Drag and drop a CSV file here, or{' '}
                    <label className="text-primary-600 cursor-pointer hover:underline">
                      browse
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </p>
                  <p className="text-xs text-gray-400">CSV files only, max 5MB</p>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={!selectedCourseId || !selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload and Enroll
                </>
              )}
            </Button>

            {uploadMutation.isError && (
              <p className="text-sm text-red-500 text-center">
                {(uploadMutation.error as Error).message}
              </p>
            )}

            {/* CSV Format Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">CSV Format</h3>
              <p className="text-xs text-gray-500 mb-2">
                Your CSV file should have the following columns:
              </p>
              <code className="block text-xs bg-gray-100 p-2 rounded">
                email,fullname
                <br />
                student@example.com,John Doe
              </code>
              <p className="text-xs text-gray-400 mt-2">
                Only the email column is required. New users will be created automatically.
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Recent Jobs */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Recent Jobs</h2>
          </CardHeader>
          <CardBody className="p-0">
            {jobsLoading ? (
              <Loading text="Loading jobs..." />
            ) : jobsData?.jobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No batch enrollment jobs yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {jobsData?.jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedJob(job);
                      setIsResultsModalOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <p className="font-medium text-gray-900">{job.fileName}</p>
                        <p className="text-sm text-gray-500">{job.course?.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <p className="text-green-600">{job.successCount} success</p>
                        {job.errorCount > 0 && (
                          <p className="text-red-500">{job.errorCount} errors</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Results Modal */}
      <Modal
        isOpen={isResultsModalOpen}
        onClose={() => {
          setIsResultsModalOpen(false);
          setSelectedJob(null);
        }}
        title={`Job Results: ${selectedJob?.fileName}`}
      >
        {resultsLoading ? (
          <Loading text="Loading results..." />
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-green-700">
                  {selectedJob?.successCount || 0}
                </p>
                <p className="text-xs text-green-600">Success</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-red-700">
                  {selectedJob?.errorCount || 0}
                </p>
                <p className="text-xs text-red-600">Errors</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <AlertCircle className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-yellow-700">
                  {(selectedJob?.totalRows || 0) -
                    (selectedJob?.successCount || 0) -
                    (selectedJob?.errorCount || 0)}
                </p>
                <p className="text-xs text-yellow-600">Skipped</p>
              </div>
            </div>

            {/* Results Table */}
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Row
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobResults?.results.map((result: BatchEnrollmentResult) => (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500">{result.rowNumber}</td>
                      <td className="px-4 py-2 text-gray-900">{result.email}</td>
                      <td className="px-4 py-2">{getResultStatusBadge(result.status)}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {result.errorMessage || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
};
