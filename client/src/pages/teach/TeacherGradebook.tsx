import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Search,
  CheckCircle,
  Clock,
  Minus,
  Award,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { assignmentsApi } from '../../api/assignments';
import { coursesApi } from '../../api/courses';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { TextArea } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { Assignment } from '../../types';

interface GradebookStudent {
  id: number;
  fullname: string;
  email: string;
  submissions: {
    assignmentId: number;
    submissionId?: number;
    grade: number | null;
    status: string;
    submittedAt: string | null;
  }[];
}

interface GradebookData {
  assignments: Assignment[];
  students: GradebookStudent[];
}

export const TeacherGradebook = () => {
  const { id: courseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const parsedCourseId = parseInt(courseId!, 10);
  const { isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [gradeModal, setGradeModal] = useState<{
    isOpen: boolean;
    studentId?: number;
    studentName?: string;
    assignmentId?: number;
    assignmentTitle?: string;
    submissionId?: number;
    currentGrade?: number | null;
    maxPoints?: number;
  }>({ isOpen: false });
  const [gradeForm, setGradeForm] = useState({ grade: 0, feedback: '' });

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    borderLight: isDark ? '#4b5563' : '#f3f4f6',
    // Cell colors
    bgGraded: isDark ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7',
    textGraded: isDark ? '#86efac' : '#15803d',
    bgSubmitted: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
    textSubmitted: isDark ? '#fcd34d' : '#d97706',
    bgNotSubmitted: isDark ? '#374151' : '#f3f4f6',
    textNotSubmitted: isDark ? '#6b7280' : '#9ca3af',
    // Header
    bgHeader: isDark ? '#374151' : '#f9fafb',
    bgHeaderHover: isDark ? '#4b5563' : '#f3f4f6',
    // Summary
    bgIndigo: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textIndigo: isDark ? '#a5b4fc' : '#4f46e5',
  };

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', parsedCourseId],
    queryFn: () => coursesApi.getCourseById(parsedCourseId),
  });

  const { data: gradebook, isLoading: gradebookLoading } = useQuery({
    queryKey: ['gradebook', parsedCourseId],
    queryFn: () => assignmentsApi.getGradebook(parsedCourseId) as Promise<GradebookData>,
  });

  const gradeMutation = useMutation({
    mutationFn: ({ submissionId, data }: { submissionId: number; data: { grade: number; feedback?: string } }) =>
      assignmentsApi.gradeSubmission(submissionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gradebook', parsedCourseId] });
      queryClient.invalidateQueries({ queryKey: ['instructorStats'] });
      toast.success('Grade saved');
      closeGradeModal();
    },
    onError: () => toast.error('Failed to save grade'),
  });

  const openGradeModal = (
    studentId: number,
    studentName: string,
    assignmentId: number,
    assignmentTitle: string,
    submissionId: number | undefined,
    currentGrade: number | null,
    maxPoints: number
  ) => {
    if (!submissionId) {
      toast.error('No submission to grade');
      return;
    }
    setGradeForm({ grade: currentGrade || 0, feedback: '' });
    setGradeModal({
      isOpen: true,
      studentId,
      studentName,
      assignmentId,
      assignmentTitle,
      submissionId,
      currentGrade,
      maxPoints,
    });
  };

  const closeGradeModal = () => {
    setGradeModal({ isOpen: false });
    setGradeForm({ grade: 0, feedback: '' });
  };

  const handleGradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeModal.submissionId) return;

    if (gradeForm.grade < 0 || gradeForm.grade > (gradeModal.maxPoints || 100)) {
      toast.error(`Grade must be between 0 and ${gradeModal.maxPoints || 100}`);
      return;
    }

    gradeMutation.mutate({
      submissionId: gradeModal.submissionId,
      data: gradeForm,
    });
  };

  const exportCSV = () => {
    if (!gradebook) return;

    const headers = ['Student Name', 'Email', ...gradebook.assignments.map(a => a.title), 'Total', 'Percentage'];
    const rows = filteredStudents.map(student => {
      const { totalEarned, totalPossible } = calculateStudentTotal(student);
      const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

      return [
        student.fullname,
        student.email,
        ...gradebook.assignments.map(assignment => {
          const submission = student.submissions.find(s => s.assignmentId === assignment.id);
          if (submission?.grade !== null && submission?.grade !== undefined) {
            return submission.grade.toString();
          }
          if (submission?.status === 'submitted') {
            return 'Pending';
          }
          return '--';
        }),
        `${totalEarned}/${totalPossible}`,
        `${percentage}%`,
      ];
    });

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gradebook-${course?.title || 'course'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Gradebook exported');
  };

  const calculateStudentTotal = (student: GradebookStudent) => {
    if (!gradebook) return { totalEarned: 0, totalPossible: 0 };

    let totalEarned = 0;
    let totalPossible = 0;

    gradebook.assignments.forEach(assignment => {
      const submission = student.submissions.find(s => s.assignmentId === assignment.id);
      totalPossible += assignment.points;
      if (submission?.grade !== null && submission?.grade !== undefined) {
        totalEarned += submission.grade;
      }
    });

    return { totalEarned, totalPossible };
  };

  const calculateClassAverage = (assignmentId: number) => {
    if (!gradebook) return null;

    const grades = gradebook.students
      .map(s => s.submissions.find(sub => sub.assignmentId === assignmentId)?.grade)
      .filter((g): g is number => g !== null && g !== undefined);

    if (grades.length === 0) return null;
    return Math.round(grades.reduce((a, b) => a + b, 0) / grades.length);
  };

  if (courseLoading || gradebookLoading) {
    return <Loading fullScreen text="Loading gradebook..." />;
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: colors.textPrimary }}>Course Not Found</h1>
        <Button onClick={() => navigate('/teach')}>Back to Teaching Dashboard</Button>
      </div>
    );
  }

  const filteredStudents = gradebook?.students.filter(student =>
    student.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const totalAssignments = gradebook?.assignments.length || 0;
  const totalPossiblePoints = gradebook?.assignments.reduce((sum, a) => sum + a.points, 0) || 0;

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/teach')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Teaching Dashboard
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>Gradebook</h1>
          <p style={{ color: colors.textSecondary }}>{course.title}</p>
        </div>
        <Button onClick={exportCSV} variant="secondary" icon={<Download className="w-4 h-4" />}>
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardBody className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.bgIndigo }}
            >
              <Users className="w-5 h-5" style={{ color: colors.textIndigo }} />
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                {gradebook?.students.length || 0}
              </p>
              <p className="text-sm" style={{ color: colors.textSecondary }}>Students</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.bgSubmitted }}
            >
              <Award className="w-5 h-5" style={{ color: colors.textSubmitted }} />
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                {totalAssignments}
              </p>
              <p className="text-sm" style={{ color: colors.textSecondary }}>Assignments</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.bgGraded }}
            >
              <CheckCircle className="w-5 h-5" style={{ color: colors.textGraded }} />
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                {totalPossiblePoints}
              </p>
              <p className="text-sm" style={{ color: colors.textSecondary }}>Total Points</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
            style={{ color: colors.textMuted }}
          />
          <input
            type="text"
            placeholder="Search students..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
              color: colors.textPrimary,
            }}
          />
        </div>
      </div>

      {/* Gradebook Table */}
      <Card>
        <CardBody className="p-0">
          {gradebook && gradebook.assignments.length > 0 && filteredStudents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr style={{ backgroundColor: colors.bgHeader }}>
                    <th
                      className="sticky left-0 z-10 px-4 py-3 text-left text-sm font-semibold"
                      style={{ backgroundColor: colors.bgHeader, color: colors.textPrimary }}
                    >
                      Student
                    </th>
                    {gradebook.assignments.map(assignment => (
                      <th
                        key={assignment.id}
                        className="px-3 py-3 text-center text-sm font-medium"
                        style={{ color: colors.textPrimary, minWidth: '100px' }}
                      >
                        <Link
                          to={`/teach/courses/${parsedCourseId}/assignments/${assignment.id}/submissions`}
                          className="hover:underline"
                          style={{ color: colors.textPrimary }}
                        >
                          {assignment.title}
                        </Link>
                        <div className="text-xs font-normal" style={{ color: colors.textMuted }}>
                          /{assignment.points}
                        </div>
                      </th>
                    ))}
                    <th
                      className="px-3 py-3 text-center text-sm font-semibold"
                      style={{ color: colors.textPrimary }}
                    >
                      Total
                    </th>
                    <th
                      className="px-3 py-3 text-center text-sm font-semibold"
                      style={{ color: colors.textPrimary }}
                    >
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, idx) => {
                    const { totalEarned, totalPossible } = calculateStudentTotal(student);
                    const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

                    return (
                      <tr
                        key={student.id}
                        className="border-t"
                        style={{
                          borderColor: colors.borderLight,
                          backgroundColor: idx % 2 === 0 ? 'transparent' : colors.bgHeader,
                        }}
                      >
                        <td
                          className="sticky left-0 z-10 px-4 py-3"
                          style={{
                            backgroundColor: idx % 2 === 0 ? colors.bgCard : colors.bgHeader,
                          }}
                        >
                          <div className="font-medium" style={{ color: colors.textPrimary }}>
                            {student.fullname}
                          </div>
                          <div className="text-xs" style={{ color: colors.textMuted }}>
                            {student.email}
                          </div>
                        </td>
                        {gradebook.assignments.map(assignment => {
                          const submission = student.submissions.find(s => s.assignmentId === assignment.id);
                          return (
                            <td key={assignment.id} className="px-3 py-3 text-center">
                              <GradeCell
                                submission={submission}
                                maxPoints={assignment.points}
                                colors={colors}
                                onClick={() =>
                                  openGradeModal(
                                    student.id,
                                    student.fullname,
                                    assignment.id,
                                    assignment.title,
                                    submission?.submissionId,
                                    submission?.grade ?? null,
                                    assignment.points
                                  )
                                }
                              />
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center">
                          <span className="font-medium" style={{ color: colors.textPrimary }}>
                            {totalEarned}/{totalPossible}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className="font-semibold"
                            style={{
                              color: percentage >= 70 ? colors.textGraded : percentage >= 50 ? colors.textSubmitted : colors.textPrimary,
                            }}
                          >
                            {percentage}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Class Average Row */}
                  <tr className="border-t-2" style={{ borderColor: colors.border, backgroundColor: colors.bgHeader }}>
                    <td
                      className="sticky left-0 z-10 px-4 py-3 font-semibold"
                      style={{ backgroundColor: colors.bgHeader, color: colors.textPrimary }}
                    >
                      Class Average
                    </td>
                    {gradebook.assignments.map(assignment => {
                      const avg = calculateClassAverage(assignment.id);
                      return (
                        <td key={assignment.id} className="px-3 py-3 text-center">
                          <span className="font-medium" style={{ color: colors.textSecondary }}>
                            {avg !== null ? `${avg}` : '--'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center" colSpan={2}>
                      <span style={{ color: colors.textMuted }}>--</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8">
              <EmptyState
                icon={Award}
                title={gradebook?.assignments.length === 0 ? 'No assignments yet' : 'No students enrolled'}
                description={
                  gradebook?.assignments.length === 0
                    ? 'Create assignments to start tracking grades'
                    : 'Students will appear here once enrolled'
                }
                action={
                  gradebook?.assignments.length === 0
                    ? {
                        label: 'Manage Assignments',
                        onClick: () => navigate(`/teach/courses/${parsedCourseId}/assignments`),
                      }
                    : undefined
                }
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm" style={{ color: colors.textSecondary }}>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: colors.bgGraded }}
          />
          <span>Graded</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: colors.bgSubmitted }}
          />
          <span>Submitted (pending grade)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: colors.bgNotSubmitted }}
          />
          <span>Not submitted</span>
        </div>
      </div>

      {/* Grade Modal */}
      <Modal isOpen={gradeModal.isOpen} onClose={closeGradeModal} title="Grade Submission" size="md">
        <form onSubmit={handleGradeSubmit} className="space-y-4">
          <div style={{ color: colors.textSecondary }}>
            <p className="text-sm mb-1">
              Student: <strong style={{ color: colors.textPrimary }}>{gradeModal.studentName}</strong>
            </p>
            <p className="text-sm">
              Assignment: <strong style={{ color: colors.textPrimary }}>{gradeModal.assignmentTitle}</strong>
            </p>
          </div>

          <Input
            label={`Grade (out of ${gradeModal.maxPoints || 100})`}
            type="number"
            value={gradeForm.grade}
            onChange={e => setGradeForm(f => ({ ...f, grade: parseInt(e.target.value) || 0 }))}
            min={0}
            max={gradeModal.maxPoints || 100}
            required
          />

          <TextArea
            label="Feedback (optional)"
            value={gradeForm.feedback}
            onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value }))}
            placeholder="Provide constructive feedback to the student..."
            rows={4}
          />

          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: colors.border }}>
            <Button type="button" variant="secondary" onClick={closeGradeModal}>
              Cancel
            </Button>
            <Button type="submit" loading={gradeMutation.isPending}>
              {gradeModal.currentGrade !== null ? 'Update Grade' : 'Submit Grade'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// Grade Cell Component
interface GradeCellProps {
  submission?: {
    grade: number | null;
    status: string;
    submissionId?: number;
  };
  maxPoints: number;
  colors: Record<string, string>;
  onClick: () => void;
}

const GradeCell = ({ submission, colors, onClick }: GradeCellProps) => {
  if (!submission || submission.status === 'draft' || !submission.submissionId) {
    // Not submitted
    return (
      <div
        className="inline-flex items-center justify-center px-2 py-1 rounded text-xs"
        style={{ backgroundColor: colors.bgNotSubmitted, color: colors.textNotSubmitted }}
      >
        <Minus className="w-3 h-3" />
      </div>
    );
  }

  if (submission.grade !== null && submission.grade !== undefined) {
    // Graded
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center justify-center px-2 py-1 rounded text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity"
        style={{ backgroundColor: colors.bgGraded, color: colors.textGraded }}
        title="Click to update grade"
      >
        {submission.grade}
      </button>
    );
  }

  // Submitted but not graded
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity"
      style={{ backgroundColor: colors.bgSubmitted, color: colors.textSubmitted }}
      title="Click to grade"
    >
      <Clock className="w-3 h-3" />
      <span>Grade</span>
    </button>
  );
};
