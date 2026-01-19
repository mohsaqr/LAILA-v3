import { Link } from 'react-router-dom';
import { ClipboardList, Calendar, Award, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { LectureSection } from '../../types';
import { Card, CardBody } from '../common/Card';
import { Button } from '../common/Button';

interface AssignmentSectionStudentProps {
  section: LectureSection;
  courseId: number;
}

export const AssignmentSectionStudent = ({ section, courseId }: AssignmentSectionStudentProps) => {
  const assignment = section.assignment;

  if (!assignment) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <AlertCircle className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">This assignment is no longer available</p>
        </CardBody>
      </Card>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDueStatus = () => {
    if (!assignment.dueDate) return null;
    const now = new Date();
    const due = new Date(assignment.dueDate);
    const diff = due.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      return { label: 'Overdue', color: 'text-red-600', bgColor: 'bg-red-50' };
    }
    if (days <= 1) {
      return { label: 'Due soon', color: 'text-amber-600', bgColor: 'bg-amber-50' };
    }
    if (days <= 3) {
      return { label: `${days} days left`, color: 'text-amber-600', bgColor: 'bg-amber-50' };
    }
    return null;
  };

  const dueStatus = getDueStatus();
  const hasSubmission = assignment.mySubmission;

  return (
    <Card className="overflow-hidden border-rose-200">
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-b border-rose-100 px-6 py-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-6 h-6 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{assignment.title}</h3>
                {assignment.module?.title && (
                  <p className="text-sm text-gray-500">{assignment.module.title}</p>
                )}
              </div>
              {dueStatus && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${dueStatus.color} ${dueStatus.bgColor}`}>
                  {dueStatus.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <CardBody>
        {assignment.description && (
          <p className="text-gray-600 mb-4">{assignment.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
          {section.showDeadline && assignment.dueDate && (
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>Due: {formatDate(assignment.dueDate)}</span>
            </div>
          )}
          {section.showPoints && (
            <div className="flex items-center gap-2 text-gray-600">
              <Award className="w-4 h-4" />
              <span>{assignment.points} points</span>
            </div>
          )}
        </div>

        {/* Submission status */}
        {hasSubmission ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {hasSubmission.status === 'graded' ? 'Graded' :
                   hasSubmission.status === 'submitted' ? 'Submitted' :
                   'Draft saved'}
                </p>
                {hasSubmission.status === 'graded' && hasSubmission.grade !== null && (
                  <p className="text-sm text-green-700">
                    Score: {hasSubmission.grade}/{assignment.points}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" />
              <p className="text-sm text-gray-600">Not yet submitted</p>
            </div>
          </div>
        )}

        <Link to={`/courses/${courseId}/assignments/${assignment.id}`}>
          <Button className="w-full" variant={hasSubmission ? 'outline' : 'primary'}>
            {hasSubmission ? 'View Submission' : 'Start Assignment'}
          </Button>
        </Link>
      </CardBody>
    </Card>
  );
};
