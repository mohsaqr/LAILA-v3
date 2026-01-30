import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { enrollmentsApi } from '../api/enrollments';
import { assignmentsApi } from '../api/assignments';
import { useTheme } from '../hooks/useTheme';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';

export const DashboardCalendar = () => {
  const { isDark } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    bgToday: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textToday: isDark ? '#a5b4fc' : '#4f46e5',
    bgRed: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
    textRed: isDark ? '#fca5a5' : '#dc2626',
    bgYellow: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textYellow: isDark ? '#fcd34d' : '#d97706',
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    textGreen: isDark ? '#86efac' : '#15803d',
  };

  // Fetch all enrollments
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['myEnrollments'],
    queryFn: () => enrollmentsApi.getMyEnrollments(),
  });

  // Fetch assignments for each enrolled course
  const courseIds = enrollments?.map((e: any) => e.courseId) || [];
  const { data: allAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['allAssignmentsForCalendar', courseIds],
    queryFn: async () => {
      const results = await Promise.all(
        courseIds.map(async (courseId: number) => {
          try {
            const assignments = await assignmentsApi.getAssignments(courseId);
            const course = enrollments?.find((e: any) => e.courseId === courseId)?.course;
            return (assignments || [])
              .filter((a: any) => a.isPublished && a.dueDate)
              .map((a: any) => ({
                ...a,
                courseId,
                courseTitle: course?.title || 'Unknown Course',
              }));
          } catch {
            return [];
          }
        })
      );
      return results.flat();
    },
    enabled: courseIds.length > 0,
  });

  if (enrollmentsLoading || assignmentsLoading) {
    return <Loading fullScreen text="Loading calendar..." />;
  }

  // Get assignments for the current month
  const getMonthDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getAssignmentsForDate = (date: Date) => {
    return (allAssignments || []).filter((assignment: any) => {
      const dueDate = new Date(assignment.dueDate);
      return (
        dueDate.getDate() === date.getDate() &&
        dueDate.getMonth() === date.getMonth() &&
        dueDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isPastDue = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const days = getMonthDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get upcoming assignments (next 7 days)
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const upcomingAssignments = (allAssignments || [])
    .filter((a: any) => {
      const dueDate = new Date(a.dueDate);
      return dueDate >= today && dueDate <= nextWeek;
    })
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: colors.bgToday }}
            >
              <Calendar className="w-5 h-5" style={{ color: colors.textToday }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
              Calendar
            </h1>
          </div>
          <p style={{ color: colors.textSecondary }}>
            View your upcoming assignments and deadlines
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card>
              <CardBody>
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                    style={{ color: colors.textSecondary }}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                    style={{ color: colors.textSecondary }}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Week Days Header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="text-center text-sm font-medium py-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {days.map((date, index) => {
                    if (!date) {
                      return <div key={`empty-${index}`} className="h-20" />;
                    }

                    const assignments = getAssignmentsForDate(date);
                    const today_ = isToday(date);
                    const pastDue = isPastDue(date);

                    return (
                      <div
                        key={date.toISOString()}
                        className="h-20 p-1 rounded-lg border"
                        style={{
                          borderColor: today_ ? colors.textToday : colors.border,
                          backgroundColor: today_ ? colors.bgToday : 'transparent',
                        }}
                      >
                        <span
                          className="text-sm font-medium"
                          style={{ color: today_ ? colors.textToday : colors.textPrimary }}
                        >
                          {date.getDate()}
                        </span>
                        <div className="mt-1 space-y-0.5 overflow-hidden">
                          {assignments.slice(0, 2).map((assignment: any) => (
                            <Link
                              key={assignment.id}
                              to={`/courses/${assignment.courseId}/assignments/${assignment.id}`}
                              className="block text-xs truncate px-1 py-0.5 rounded"
                              style={{
                                backgroundColor: pastDue ? colors.bgRed : colors.bgYellow,
                                color: pastDue ? colors.textRed : colors.textYellow,
                              }}
                              title={assignment.title}
                            >
                              {assignment.title}
                            </Link>
                          ))}
                          {assignments.length > 2 && (
                            <span className="text-xs" style={{ color: colors.textMuted }}>
                              +{assignments.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Upcoming Assignments Sidebar */}
          <div>
            <Card>
              <CardBody>
                <h3 className="font-semibold mb-4" style={{ color: colors.textPrimary }}>
                  Upcoming (Next 7 Days)
                </h3>
                {upcomingAssignments.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingAssignments.map((assignment: any) => {
                      const dueDate = new Date(assignment.dueDate);
                      const isUrgent = dueDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;

                      return (
                        <Link
                          key={assignment.id}
                          to={`/courses/${assignment.courseId}/assignments/${assignment.id}`}
                          className="block p-3 rounded-lg border transition-colors hover:opacity-80"
                          style={{
                            borderColor: colors.border,
                            backgroundColor: isUrgent ? colors.bgRed : 'transparent',
                          }}
                        >
                          <div className="flex items-start gap-2">
                            {isUrgent ? (
                              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: colors.textRed }} />
                            ) : (
                              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: colors.textYellow }} />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate" style={{ color: colors.textPrimary }}>
                                {assignment.title}
                              </p>
                              <p className="text-xs truncate" style={{ color: colors.textSecondary }}>
                                {assignment.courseTitle}
                              </p>
                              <p className="text-xs flex items-center gap-1 mt-1" style={{ color: isUrgent ? colors.textRed : colors.textMuted }}>
                                <Clock className="w-3 h-3" />
                                {dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-center py-4" style={{ color: colors.textMuted }}>
                    No upcoming assignments
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
