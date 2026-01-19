import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Award,
} from 'lucide-react';
import { assignmentsApi } from '../api/assignments';
import { enrollmentsApi } from '../api/enrollments';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { Assignment } from '../types';

export const StudentAssignments = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const parsedCourseId = parseInt(courseId!, 10);

  const { data: enrollment, isLoading: enrollmentLoading } = useQuery({
    queryKey: ['enrollment', courseId],
    queryFn: () => enrollmentsApi.getEnrollment(parsedCourseId),
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['courseAssignments', courseId],
    queryFn: () => assignmentsApi.getAssignments(parsedCourseId),
    enabled: !!enrollment?.enrolled,
  });

  if (enrollmentLoading || assignmentsLoading) {
    return <Loading fullScreen text="Loading assignments..." />;
  }

  if (!enrollment?.enrolled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardBody className="text-center py-8 px-12">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Not Enrolled</h2>
            <p className="text-gray-600 mb-4">You need to enroll in this course to view assignments</p>
            <Link to={`/catalog/${courseId}`} className="btn btn-primary">
              View Course
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const course = enrollment.enrollment?.course;
  const publishedAssignments = assignments?.filter(a => a.isPublished) || [];

  // Sort assignments by due date (upcoming first, then no due date, then past due)
  const sortedAssignments = [...publishedAssignments].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link to={`/learn/${courseId}`}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to Course
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Assignments</h1>
        <p className="text-gray-600">{course?.title}</p>
      </div>

      {sortedAssignments.length > 0 ? (
        <div className="space-y-4">
          {sortedAssignments.map(assignment => (
            <AssignmentCard key={assignment.id} assignment={assignment} courseId={parsedCourseId} />
          ))}
        </div>
      ) : (
        <Card>
          <CardBody className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments yet</h3>
            <p className="text-gray-500">Check back later for new assignments</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

const AssignmentCard = ({ assignment, courseId }: { assignment: Assignment; courseId: number }) => {
  const { data: mySubmission } = useQuery({
    queryKey: ['mySubmission', assignment.id],
    queryFn: () => assignmentsApi.getMySubmission(assignment.id),
  });

  const now = new Date();
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const isPastDue = dueDate && dueDate < now;
  const isSubmitted = mySubmission?.status === 'submitted' || mySubmission?.status === 'graded';
  const isGraded = mySubmission?.status === 'graded';

  const getStatusBadge = () => {
    if (isGraded) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <Award className="w-3 h-3" />
          Graded: {mySubmission?.grade}/{assignment.points}
        </span>
      );
    }
    if (isSubmitted) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <CheckCircle className="w-3 h-3" />
          Submitted
        </span>
      );
    }
    if (isPastDue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <AlertCircle className="w-3 h-3" />
          Past Due
        </span>
      );
    }
    if (mySubmission?.status === 'draft') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <Clock className="w-3 h-3" />
          Draft Saved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
        <FileText className="w-3 h-3" />
        Not Started
      </span>
    );
  };

  return (
    <Link to={`/courses/${courseId}/assignments/${assignment.id}`}>
      <Card hover>
        <CardBody className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            isGraded ? 'bg-green-100' : isSubmitted ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            <FileText className={`w-6 h-6 ${
              isGraded ? 'text-green-600' : isSubmitted ? 'text-blue-600' : 'text-gray-600'
            }`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{assignment.title}</h3>
              {getStatusBadge()}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Award className="w-4 h-4" />
                {assignment.points} points
              </span>
              {dueDate && (
                <span className={`flex items-center gap-1 ${isPastDue && !isSubmitted ? 'text-red-600' : ''}`}>
                  <Calendar className="w-4 h-4" />
                  Due {dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {assignment.module && (
                <span>{assignment.module.title}</span>
              )}
            </div>
          </div>

          <div className="flex-shrink-0">
            <span className="text-primary-600 font-medium text-sm">
              {isGraded ? 'View Grade' : isSubmitted ? 'View Submission' : 'View'}
            </span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
};
