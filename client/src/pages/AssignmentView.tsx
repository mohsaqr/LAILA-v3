import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Award,
  Send,
  Save,
  Upload,
  X,
  MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { assignmentsApi } from '../api/assignments';
import { enrollmentsApi } from '../api/enrollments';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { TextArea } from '../components/common/Input';

export const AssignmentView = () => {
  const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const parsedCourseId = parseInt(courseId!, 10);
  const parsedAssignmentId = parseInt(assignmentId!, 10);

  const [content, setContent] = useState('');
  const [fileUrls, setFileUrls] = useState<string[]>([]);

  const { data: enrollment, isLoading: enrollmentLoading } = useQuery({
    queryKey: ['enrollment', courseId],
    queryFn: () => enrollmentsApi.getEnrollment(parsedCourseId),
  });

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: () => assignmentsApi.getAssignmentById(parsedAssignmentId),
    enabled: !!enrollment?.enrolled,
  });

  const { data: mySubmission, isLoading: submissionLoading } = useQuery({
    queryKey: ['mySubmission', assignmentId],
    queryFn: () => assignmentsApi.getMySubmission(parsedAssignmentId),
    enabled: !!enrollment?.enrolled,
  });

  // Initialize form with existing submission data
  useEffect(() => {
    if (mySubmission) {
      setContent(mySubmission.content || '');
      setFileUrls(mySubmission.fileUrls ? JSON.parse(mySubmission.fileUrls) : []);
    }
  }, [mySubmission]);

  const saveDraftMutation = useMutation({
    mutationFn: () =>
      assignmentsApi.submitAssignment(parsedAssignmentId, {
        content,
        fileUrls,
        status: 'draft',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mySubmission', assignmentId] });
      toast.success('Draft saved');
    },
    onError: () => toast.error('Failed to save draft'),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      assignmentsApi.submitAssignment(parsedAssignmentId, {
        content,
        fileUrls,
        status: 'submitted',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mySubmission', assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      toast.success('Assignment submitted successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to submit assignment');
    },
  });

  if (enrollmentLoading || assignmentLoading || submissionLoading) {
    return <Loading fullScreen text="Loading assignment..." />;
  }

  if (!enrollment?.enrolled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardBody className="text-center py-8 px-12">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Not Enrolled</h2>
            <p className="text-gray-600 mb-4">You need to enroll in this course to view this assignment</p>
            <Link to={`/catalog/${courseId}`} className="btn btn-primary">
              View Course
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardBody className="text-center py-8 px-12">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Assignment Not Found</h2>
            <Button onClick={() => navigate(`/courses/${courseId}/assignments`)}>
              Back to Assignments
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const course = enrollment.enrollment?.course;
  const now = new Date();
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const isPastDue = dueDate ? dueDate < now : false;
  const isSubmitted = mySubmission?.status === 'submitted' || mySubmission?.status === 'graded';
  const isGraded = mySubmission?.status === 'graded';
  const canSubmit = !isPastDue || !isSubmitted;

  const handleSubmit = () => {
    if (!content.trim() && fileUrls.length === 0) {
      toast.error('Please add some content or upload files before submitting');
      return;
    }
    submitMutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link to={`/courses/${courseId}/assignments`}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to Assignments
          </Button>
        </Link>
      </div>

      {/* Assignment Header */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">{course?.title}</p>
              <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            </div>
            <StatusBadge
              isGraded={isGraded}
              isSubmitted={isSubmitted}
              isPastDue={isPastDue}
              hasDraft={mySubmission?.status === 'draft'}
              grade={mySubmission?.grade}
              points={assignment.points}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Award className="w-4 h-4" />
              {assignment.points} points
            </span>
            {dueDate && (
              <span className={`flex items-center gap-1 ${isPastDue ? 'text-red-600' : ''}`}>
                <Calendar className="w-4 h-4" />
                Due {dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <span className="flex items-center gap-1 capitalize">
              <FileText className="w-4 h-4" />
              {assignment.submissionType} submission
            </span>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assignment Description */}
          {assignment.description && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-gray-900">Description</h2>
              </CardHeader>
              <CardBody>
                <div className="prose max-w-none text-gray-700">
                  <ReactMarkdown>{assignment.description}</ReactMarkdown>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Instructions */}
          {assignment.instructions && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-gray-900">Instructions</h2>
              </CardHeader>
              <CardBody>
                <div className="prose max-w-none text-gray-700">
                  <ReactMarkdown>{assignment.instructions}</ReactMarkdown>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Submission Area */}
          {!isGraded && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-gray-900">Your Submission</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                {(assignment.submissionType === 'text' || assignment.submissionType === 'mixed') && (
                  <TextArea
                    label="Your Answer"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your answer here..."
                    rows={10}
                    disabled={isSubmitted}
                  />
                )}

                {(assignment.submissionType === 'file' || assignment.submissionType === 'mixed') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      File Attachments
                    </label>
                    {assignment.allowedFileTypes && (
                      <p className="text-xs text-gray-500 mb-2">
                        Allowed types: {assignment.allowedFileTypes}
                      </p>
                    )}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        File upload coming soon
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Max size: {assignment.maxFileSize || 10}MB
                      </p>
                    </div>

                    {fileUrls.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {fileUrls.map((url, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span className="flex-1 text-sm truncate">{url}</span>
                            {!isSubmitted && (
                              <button
                                onClick={() => setFileUrls(fileUrls.filter((_, i) => i !== index))}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!isSubmitted && canSubmit && (
                  <div className="flex items-center justify-end gap-3 pt-4 border-t">
                    <Button
                      variant="secondary"
                      onClick={() => saveDraftMutation.mutate()}
                      loading={saveDraftMutation.isPending}
                      icon={<Save className="w-4 h-4" />}
                    >
                      Save Draft
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      loading={submitMutation.isPending}
                      icon={<Send className="w-4 h-4" />}
                    >
                      Submit Assignment
                    </Button>
                  </div>
                )}

                {isSubmitted && !isGraded && (
                  <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <p className="text-blue-700">
                      Your assignment has been submitted. Waiting for grading.
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Graded Submission View */}
          {isGraded && mySubmission && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-gray-900">Your Submission</h2>
              </CardHeader>
              <CardBody>
                {mySubmission.content && (
                  <div className="prose max-w-none text-gray-700 mb-4">
                    <ReactMarkdown>{mySubmission.content}</ReactMarkdown>
                  </div>
                )}
                <p className="text-sm text-gray-500">
                  Submitted on {new Date(mySubmission.submittedAt).toLocaleString()}
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Grade Card (if graded) */}
          {isGraded && mySubmission && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <h2 className="font-semibold text-green-800 flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Your Grade
                </h2>
              </CardHeader>
              <CardBody>
                <div className="text-center mb-4">
                  <span className="text-4xl font-bold text-green-700">
                    {mySubmission.grade}
                  </span>
                  <span className="text-xl text-green-600">/{assignment.points}</span>
                  <p className="text-sm text-green-600 mt-1">
                    {Math.round((mySubmission.grade! / assignment.points) * 100)}%
                  </p>
                </div>

                {mySubmission.feedback && (
                  <div className="border-t border-green-200 pt-4">
                    <h3 className="font-medium text-green-800 flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4" />
                      Instructor Feedback
                    </h3>
                    <p className="text-sm text-green-700">{mySubmission.feedback}</p>
                  </div>
                )}

                {mySubmission.gradedAt && (
                  <p className="text-xs text-green-600 mt-4">
                    Graded on {new Date(mySubmission.gradedAt).toLocaleString()}
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {/* Submission Info */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Submission Info</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status</span>
                <span className="font-medium capitalize">
                  {mySubmission?.status || 'Not started'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Type</span>
                <span className="font-medium capitalize">{assignment.submissionType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Points</span>
                <span className="font-medium">{assignment.points}</span>
              </div>
              {dueDate && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Due Date</span>
                  <span className={`font-medium ${isPastDue ? 'text-red-600' : ''}`}>
                    {dueDate.toLocaleDateString()}
                  </span>
                </div>
              )}
              {mySubmission?.submittedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Submitted</span>
                  <span className="font-medium">
                    {new Date(mySubmission.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({
  isGraded,
  isSubmitted,
  isPastDue,
  hasDraft,
  grade,
  points,
}: {
  isGraded: boolean;
  isSubmitted: boolean;
  isPastDue: boolean;
  hasDraft: boolean;
  grade?: number | null;
  points: number;
}) => {
  if (isGraded) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
        <Award className="w-4 h-4" />
        Graded: {grade}/{points}
      </span>
    );
  }
  if (isSubmitted) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
        <CheckCircle className="w-4 h-4" />
        Submitted
      </span>
    );
  }
  if (isPastDue) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
        <AlertCircle className="w-4 h-4" />
        Past Due
      </span>
    );
  }
  if (hasDraft) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
        <Clock className="w-4 h-4" />
        Draft Saved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
      <FileText className="w-4 h-4" />
      Not Started
    </span>
  );
};
