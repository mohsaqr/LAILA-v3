import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  TrendingUp,
  Award,
  CheckCircle,
  FileText,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { enrollmentsApi } from '../api/enrollments';
import { assignmentsApi } from '../api/assignments';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { EmptyState } from '../components/common/EmptyState';

interface CourseGrade {
  courseId: number;
  courseTitle: string;
  totalEarned: number;
  totalPossible: number;
  percentage: number;
  gradedCount: number;
  totalAssignments: number;
  recentGrade?: {
    assignmentTitle: string;
    grade: number;
    maxPoints: number;
    gradedAt: string;
  };
}

export const DashboardGradebook = () => {
  const { isDark } = useTheme();
  const { isInstructor } = useAuth();

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    // Status colors
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    textGreen: isDark ? '#86efac' : '#15803d',
    bgBlue: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
    textBlue: isDark ? '#93c5fd' : '#1d4ed8',
    bgYellow: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textYellow: isDark ? '#fcd34d' : '#d97706',
    bgIndigo: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textIndigo: isDark ? '#a5b4fc' : '#4f46e5',
    // Grade colors
    gradeA: isDark ? '#86efac' : '#15803d',
    gradeB: isDark ? '#93c5fd' : '#1d4ed8',
    gradeC: isDark ? '#fcd34d' : '#d97706',
    gradeD: isDark ? '#fca5a5' : '#dc2626',
  };

  // Fetch all enrollments
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['myEnrollments'],
    queryFn: () => enrollmentsApi.getMyEnrollments(),
  });

  // Fetch assignments for each enrolled course
  const courseIds = enrollments?.map((e: any) => e.courseId) || [];
  const { data: courseAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['allCourseAssignments', courseIds],
    queryFn: async () => {
      const results = await Promise.all(
        courseIds.map(async (courseId: number) => {
          try {
            const assignments = await assignmentsApi.getAssignments(courseId);
            // Fetch submissions for each assignment
            const assignmentsWithSubmissions = await Promise.all(
              (assignments || []).filter((a: any) => a.isPublished).map(async (assignment: any) => {
                try {
                  const submission = await assignmentsApi.getMySubmission(assignment.id);
                  return { ...assignment, mySubmission: submission };
                } catch {
                  return { ...assignment, mySubmission: null };
                }
              })
            );
            return { courseId, assignments: assignmentsWithSubmissions };
          } catch {
            return { courseId, assignments: [] };
          }
        })
      );
      return results;
    },
    enabled: courseIds.length > 0,
  });

  if (enrollmentsLoading || assignmentsLoading) {
    return <Loading fullScreen text="Loading gradebook..." />;
  }

  // Calculate grades for each course
  const courseGrades: CourseGrade[] = (enrollments || []).map((enrollment: any) => {
    const courseData = courseAssignments?.find((c: any) => c.courseId === enrollment.courseId);
    const assignments = courseData?.assignments || [];

    let totalEarned = 0;
    let totalPossible = 0;
    let gradedCount = 0;
    let recentGrade: CourseGrade['recentGrade'] = undefined;

    assignments.forEach((assignment: any) => {
      totalPossible += assignment.points;
      if (assignment.mySubmission?.grade !== null && assignment.mySubmission?.grade !== undefined) {
        totalEarned += assignment.mySubmission.grade;
        gradedCount++;
        // Track most recent grade
        if (!recentGrade || new Date(assignment.mySubmission.gradedAt) > new Date(recentGrade.gradedAt)) {
          recentGrade = {
            assignmentTitle: assignment.title,
            grade: assignment.mySubmission.grade,
            maxPoints: assignment.points,
            gradedAt: assignment.mySubmission.gradedAt || assignment.mySubmission.submittedAt,
          };
        }
      }
    });

    return {
      courseId: enrollment.courseId,
      courseTitle: enrollment.course?.title || 'Unknown Course',
      totalEarned,
      totalPossible,
      percentage: totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0,
      gradedCount,
      totalAssignments: assignments.length,
      recentGrade,
    };
  });

  // Calculate overall stats
  const overallStats = {
    totalCourses: courseGrades.length,
    totalEarned: courseGrades.reduce((sum, c) => sum + c.totalEarned, 0),
    totalPossible: courseGrades.reduce((sum, c) => sum + c.totalPossible, 0),
    totalGraded: courseGrades.reduce((sum, c) => sum + c.gradedCount, 0),
    totalAssignments: courseGrades.reduce((sum, c) => sum + c.totalAssignments, 0),
  };
  overallStats.totalPossible = overallStats.totalPossible || 1; // Avoid division by zero

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return colors.gradeA;
    if (percentage >= 80) return colors.gradeB;
    if (percentage >= 70) return colors.gradeC;
    return colors.gradeD;
  };

  const getGradeLetter = (percentage: number) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: colors.bgIndigo }}
            >
              <ClipboardList className="w-5 h-5" style={{ color: colors.textIndigo }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
              {isInstructor ? 'My Grades (as Student)' : 'My Grades'}
            </h1>
          </div>
          <p style={{ color: colors.textSecondary }}>
            View your grades across all enrolled courses
          </p>
        </div>

        {courseGrades.length > 0 ? (
          <>
            {/* Overall Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardBody className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.bgGreen }}
                  >
                    <TrendingUp className="w-6 h-6" style={{ color: colors.textGreen }} />
                  </div>
                  <div>
                    <p
                      className="text-2xl font-bold"
                      style={{ color: getGradeColor(Math.round((overallStats.totalEarned / overallStats.totalPossible) * 100)) }}
                    >
                      {Math.round((overallStats.totalEarned / overallStats.totalPossible) * 100)}%
                    </p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>Overall Average</p>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.bgBlue }}
                  >
                    <BookOpen className="w-6 h-6" style={{ color: colors.textBlue }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                      {overallStats.totalCourses}
                    </p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>Courses</p>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.bgYellow }}
                  >
                    <Award className="w-6 h-6" style={{ color: colors.textYellow }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                      {overallStats.totalEarned}/{overallStats.totalPossible}
                    </p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>Total Points</p>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.bgIndigo }}
                  >
                    <CheckCircle className="w-6 h-6" style={{ color: colors.textIndigo }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                      {overallStats.totalGraded}/{overallStats.totalAssignments}
                    </p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>Graded</p>
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Course Cards */}
            <h2 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
              Grades by Course
            </h2>
            <div className="space-y-4">
              {courseGrades.map((course) => (
                <Link key={course.courseId} to={`/courses/${course.courseId}/grades`}>
                  <Card hover>
                    <CardBody className="flex items-center gap-4">
                      {/* Grade Circle */}
                      <div
                        className="w-16 h-16 rounded-full flex flex-col items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : '#f0f0ff',
                          border: `3px solid ${getGradeColor(course.percentage)}`,
                        }}
                      >
                        <span
                          className="text-xl font-bold"
                          style={{ color: getGradeColor(course.percentage) }}
                        >
                          {getGradeLetter(course.percentage)}
                        </span>
                        <span className="text-xs" style={{ color: colors.textSecondary }}>
                          {course.percentage}%
                        </span>
                      </div>

                      {/* Course Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate mb-1" style={{ color: colors.textPrimary }}>
                          {course.courseTitle}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: colors.textSecondary }}>
                          <span className="flex items-center gap-1">
                            <Award className="w-4 h-4" />
                            {course.totalEarned}/{course.totalPossible} points
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {course.gradedCount}/{course.totalAssignments} graded
                          </span>
                        </div>
                        {course.recentGrade && (
                          <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                            Last grade: {course.recentGrade.assignmentTitle} ({course.recentGrade.grade}/{course.recentGrade.maxPoints})
                          </p>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="hidden sm:block w-32">
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${course.percentage}%`,
                              backgroundColor: getGradeColor(course.percentage),
                            }}
                          />
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: colors.textMuted }} />
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <Card>
            <CardBody className="py-12">
              <EmptyState
                icon={ClipboardList}
                title="No grades yet"
                description="Enroll in courses and complete assignments to see your grades here"
                action={{
                  label: 'Browse Courses',
                  onClick: () => window.location.href = '/courses',
                }}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
};
