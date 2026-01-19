import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Calendar,
  Award,
  Check,
  Clock,
  FileText,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { assignmentsApi } from '../../api/assignments';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { Input, TextArea } from '../../components/common/Input';
import { AssignmentSubmission } from '../../types';

export const SubmissionReview = () => {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const courseId = parseInt(id!, 10);
  const assId = parseInt(assignmentId!, 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [gradeModal, setGradeModal] = useState<{ isOpen: boolean; submission?: AssignmentSubmission }>({
    isOpen: false,
  });
  const [gradeForm, setGradeForm] = useState({ grade: 0, feedback: '' });

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', assId],
    queryFn: () => assignmentsApi.getAssignmentById(assId),
    enabled: !!assId,
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ['assignmentSubmissions', assId],
    queryFn: () => assignmentsApi.getSubmissions(assId),
    enabled: !!assId,
  });

  const gradeMutation = useMutation({
    mutationFn: ({ submissionId, data }: { submissionId: number; data: { grade: number; feedback?: string } }) =>
      assignmentsApi.gradeSubmission(submissionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignmentSubmissions', assId] });
      queryClient.invalidateQueries({ queryKey: ['instructorStats'] });
      toast.success('Submission graded');
      closeGradeModal();
    },
    onError: () => toast.error('Failed to grade submission'),
  });

  const openGradeModal = (submission: AssignmentSubmission) => {
    setGradeForm({
      grade: submission.grade || 0,
      feedback: submission.feedback || '',
    });
    setGradeModal({ isOpen: true, submission });
  };

  const closeGradeModal = () => {
    setGradeModal({ isOpen: false });
    setGradeForm({ grade: 0, feedback: '' });
  };

  const handleGradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeModal.submission) return;

    if (gradeForm.grade < 0 || gradeForm.grade > (assignment?.points || 100)) {
      toast.error(`Grade must be between 0 and ${assignment?.points || 100}`);
      return;
    }

    gradeMutation.mutate({
      submissionId: gradeModal.submission.id,
      data: gradeForm,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSubmissionStatus = (submission: AssignmentSubmission) => {
    if (submission.status === 'graded') return 'graded';
    if (submission.status === 'submitted') return 'submitted';
    return 'pending';
  };

  if (assignmentLoading || submissionsLoading) {
    return <Loading fullScreen text="Loading submissions..." />;
  }

  if (!assignment) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Assignment Not Found</h1>
        <Button onClick={() => navigate(`/teach/courses/${courseId}/assignments`)}>
          Back to Assignments
        </Button>
      </div>
    );
  }

  const pendingCount = submissions?.filter(s => s.status === 'submitted').length || 0;
  const gradedCount = submissions?.filter(s => s.status === 'graded').length || 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/teach/courses/${courseId}/assignments`)}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Assignments
        </Button>
      </div>

      {/* Assignment Header */}
      <Card className="mb-6">
        <CardBody>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{assignment.title}</h1>
          {assignment.description && (
            <p className="text-gray-600 mb-4">{assignment.description}</p>
          )}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <Award className="w-4 h-4" />
              <span>{assignment.points} points</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span>{pendingCount} pending</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Check className="w-4 h-4 text-green-500" />
              <span>{gradedCount} graded</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Submissions List */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">
            Submissions ({submissions?.length || 0})
          </h2>
        </CardHeader>
        <CardBody>
          {submissions && submissions.length > 0 ? (
            <div className="space-y-4">
              {submissions.map(submission => (
                <div
                  key={submission.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {submission.user?.fullname || 'Unknown Student'}
                        </h3>
                        <p className="text-sm text-gray-500">{submission.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={getSubmissionStatus(submission)} />
                      {submission.status === 'graded' && (
                        <span className="text-lg font-semibold text-gray-900">
                          {submission.grade}/{assignment.points}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-gray-500 flex items-center gap-1 mb-3">
                    <Calendar className="w-4 h-4" />
                    Submitted {formatDate(submission.submittedAt)}
                  </div>

                  {/* Submission Content */}
                  {submission.content && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-3">
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">
                        {submission.content.length > 500
                          ? `${submission.content.slice(0, 500)}...`
                          : submission.content}
                      </p>
                    </div>
                  )}

                  {/* File Links */}
                  {submission.fileUrls && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {JSON.parse(submission.fileUrls).map((url: string, index: number) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100"
                        >
                          <ExternalLink className="w-3 h-3" />
                          File {index + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Existing Feedback */}
                  {submission.feedback && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                      <p className="text-sm font-medium text-green-800 mb-1">Instructor Feedback</p>
                      <p className="text-sm text-green-700">{submission.feedback}</p>
                    </div>
                  )}

                  {/* Grade Button */}
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant={submission.status === 'graded' ? 'secondary' : 'primary'}
                      onClick={() => openGradeModal(submission)}
                    >
                      {submission.status === 'graded' ? 'Update Grade' : 'Grade'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No submissions yet"
              description="Students haven't submitted any work for this assignment"
            />
          )}
        </CardBody>
      </Card>

      {/* Grade Modal */}
      <Modal
        isOpen={gradeModal.isOpen}
        onClose={closeGradeModal}
        title="Grade Submission"
        size="md"
      >
        <form onSubmit={handleGradeSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Student: <strong>{gradeModal.submission?.user?.fullname}</strong>
            </p>
          </div>

          <Input
            label={`Grade (out of ${assignment?.points || 100})`}
            type="number"
            value={gradeForm.grade}
            onChange={e => setGradeForm(f => ({ ...f, grade: parseInt(e.target.value) || 0 }))}
            min={0}
            max={assignment?.points || 100}
            required
          />

          <TextArea
            label="Feedback (optional)"
            value={gradeForm.feedback}
            onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value }))}
            placeholder="Provide constructive feedback to the student..."
            rows={4}
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={closeGradeModal}>
              Cancel
            </Button>
            <Button type="submit" loading={gradeMutation.isPending}>
              {gradeModal.submission?.status === 'graded' ? 'Update Grade' : 'Submit Grade'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
