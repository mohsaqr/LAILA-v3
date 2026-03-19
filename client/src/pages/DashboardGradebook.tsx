import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  TrendingUp,
  Award,
  CheckCircle,
  FileText,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { assignmentsApi } from '../api/assignments';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { EmptyState } from '../components/common/EmptyState';
import { Breadcrumb } from '../components/common/Breadcrumb';

interface CourseGrade {
  courseId: number;
  courseTitle: string;
  totalEarned: number;
  totalPossible: number;
  percentage: number;
  submittedCount: number;
  gradedCount: number;
  totalAssignments: number;
  submissionProgress: number;
  recentGrade?: {
    assignmentTitle: string;
    grade: number;
    maxPoints: number;
    gradedAt: string;
  };
}

export const DashboardGradebook = () => {
  const { t } = useTranslation(['courses', 'common']);
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

  // Single aggregated request — replaces N×(1 + M) per-course requests
  const { data: gradebookData, isLoading: gradebookLoading } = useQuery({
    queryKey: ['myGradebook'],
    queryFn: assignmentsApi.getMyGradebook,
  });

  if (gradebookLoading) {
    return <Loading fullScreen text={t('loading_gradebook')} />;
  }

  // Calculate grades for each course (assignments + quizzes)
  const courseGrades: CourseGrade[] = (gradebookData || []).map((courseData: any) => {
    const assignments = courseData.assignments || [];
    const quizzes = courseData.quizzes || [];

    let totalEarned = 0;
    let totalPossible = 0;
    let gradedCount = 0;
    let submittedCount = 0;
    let recentGrade: CourseGrade['recentGrade'] = undefined;

    assignments.forEach((assignment: any) => {
      totalPossible += assignment.points;
      const status = assignment.mySubmission?.status;
      if (status === 'submitted' || status === 'graded') {
        submittedCount++;
      }
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

    // Include quiz scores in totals
    quizzes.forEach((quiz: any) => {
      totalPossible += quiz.totalPoints;
      if (quiz.myAttempt) {
        submittedCount++;
        totalEarned += quiz.myAttempt.pointsEarned ?? 0;
        gradedCount++;
        // Track most recent quiz grade
        if (quiz.myAttempt.completedAt) {
          if (!recentGrade || new Date(quiz.myAttempt.completedAt) > new Date(recentGrade.gradedAt)) {
            recentGrade = {
              assignmentTitle: quiz.title,
              grade: quiz.myAttempt.pointsEarned ?? 0,
              maxPoints: quiz.totalPoints,
              gradedAt: quiz.myAttempt.completedAt,
            };
          }
        }
      }
    });

    const total = assignments.length + quizzes.length;
    return {
      courseId: courseData.courseId,
      courseTitle: courseData.courseTitle,
      totalEarned,
      totalPossible,
      percentage: totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0,
      submittedCount,
      gradedCount,
      totalAssignments: total,
      submissionProgress: total > 0 ? Math.round((submittedCount / total) * 100) : 0,
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb items={[{ label: t('gradebook') }]} />
        </div>

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
              {isInstructor ? t('my_grades_as_student') : t('my_grades')}
            </h1>
          </div>
          <p style={{ color: colors.textSecondary }}>
            {t('view_grades_description')}
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
                    <p className="text-sm" style={{ color: colors.textSecondary }}>{t('overall_average')}</p>
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
                    <p className="text-sm" style={{ color: colors.textSecondary }}>{t('common:courses')}</p>
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
                    <p className="text-sm" style={{ color: colors.textSecondary }}>{t('total_points')}</p>
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
                    <p className="text-sm" style={{ color: colors.textSecondary }}>{t('graded')}</p>
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Course Cards */}
            <h2 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
              {t('grades_by_course')}
            </h2>
            <div className="space-y-4">
              {courseGrades.map((course) => (
                <Link key={course.courseId} to={`/courses/${course.courseId}/grades`}>
                  <Card hover>
                    <CardBody className="flex items-center gap-4">
                      {/* Submission Progress Circle */}
                      {(() => {
                        const r = 26;
                        const circ = 2 * Math.PI * r;
                        const filled = (course.submissionProgress / 100) * circ;
                        return (
                          <div className="w-16 h-16 flex-shrink-0 relative flex items-center justify-center">
                            <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90 absolute inset-0">
                              <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5"
                                stroke={isDark ? '#374151' : '#e5e7eb'} />
                              <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5"
                                stroke="#16a34a"
                                strokeDasharray={`${filled} ${circ}`}
                                strokeLinecap="round" />
                            </svg>
                            <div className="flex flex-col items-center justify-center z-10">
                              <span className="text-sm font-bold leading-none" style={{ color: '#16a34a' }}>
                                {course.submittedCount}/{course.totalAssignments}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Course Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate mb-1" style={{ color: colors.textPrimary }}>
                          {course.courseTitle}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: colors.textSecondary }}>
                          <span className="flex items-center gap-1">
                            <Award className="w-4 h-4" />
                            {course.totalEarned}/{course.totalPossible} {t('points')}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {course.submittedCount}/{course.totalAssignments} {t('submitted_status')}
                          </span>
                        </div>
                        {course.recentGrade && (
                          <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                            {t('last_grade')}: {course.recentGrade.assignmentTitle} ({course.recentGrade.grade}/{course.recentGrade.maxPoints})
                          </p>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="hidden sm:block w-32">
                        <div className="text-xs mb-1 text-right" style={{ color: colors.textSecondary }}>
                          {course.submissionProgress}%
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${course.submissionProgress}%`,
                              backgroundColor: '#16a34a',
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
                title={t('no_grades_yet')}
                description={t('no_grades_description')}
                action={{
                  label: t('browse_courses'),
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
