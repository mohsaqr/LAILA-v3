import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  GraduationCap,
  Clock,
  Award,
  Briefcase,
  Users,
  FileText,
  AlertCircle,
  BrainCircuit,
  Sparkles,
  Settings,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { usersApi } from '../api/users';
import { coursesApi } from '../api/courses';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';

export const Dashboard = () => {
  const { user, isInstructor } = useAuth();
  const { isDark } = useTheme();

  // Theme colors
  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    bg: isDark ? '#111827' : '#f9fafb',
  };

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['userStats', user?.id],
    queryFn: () => usersApi.getUserStats(user!.id),
    enabled: !!user,
  });

  const { data: instructorStats } = useQuery({
    queryKey: ['instructorStats', user?.id],
    queryFn: () => usersApi.getInstructorStats(user!.id),
    enabled: !!user && isInstructor,
  });

  useQuery({
    queryKey: ['teachingCourses'],
    queryFn: () => coursesApi.getMyCourses(),
    enabled: !!user && isInstructor,
  });

  if (statsLoading) {
    return <Loading fullScreen text="Loading dashboard..." />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex-1">
              <h1 className="text-3xl lg:text-4xl font-bold mb-3">
                Welcome back, {user?.fullname?.split(' ')[0]}!
              </h1>
              <p className="text-white/80 text-lg mb-6">
                Explore courses, use AI tools, and enhance your learning experience.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/catalog"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-primary-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  <Sparkles className="w-5 h-5" />
                  Explore Courses
                </Link>
                <Link
                  to="/ai-tools"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors"
                >
                  <BrainCircuit className="w-5 h-5" />
                  AI Tools
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <div className="w-64 h-64 bg-white/10 rounded-full flex items-center justify-center">
                  <div className="w-48 h-48 bg-white/10 rounded-full flex items-center justify-center">
                    <GraduationCap className="w-24 h-24 text-white/80" />
                  </div>
                </div>
                <div className="absolute -top-2 -right-2 w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                  <Sparkles className="w-8 h-8 text-yellow-800" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions Grid */}
        <div className="mb-10">
          <h2 className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/catalog">
              <Card hover className="h-full">
                <CardBody className="text-center py-6">
                  <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-3">
                    <GraduationCap className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <p className="font-medium" style={{ color: colors.textPrimary }}>Browse Courses</p>
                </CardBody>
              </Card>
            </Link>

            <Link to="/ai-tools">
              <Card hover className="h-full">
                <CardBody className="text-center py-6">
                  <div className="w-12 h-12 rounded-xl bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center mx-auto mb-3">
                    <BrainCircuit className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />
                  </div>
                  <p className="font-medium" style={{ color: colors.textPrimary }}>AI Tools</p>
                </CardBody>
              </Card>
            </Link>

            {isInstructor ? (
              <>
                <Link to="/teach/create">
                  <Card hover className="h-full">
                    <CardBody className="text-center py-6">
                      <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-3">
                        <Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <p className="font-medium" style={{ color: colors.textPrimary }}>Create Course</p>
                    </CardBody>
                  </Card>
                </Link>

                <Link to="/teach">
                  <Card hover className="h-full">
                    <CardBody className="text-center py-6">
                      <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mx-auto mb-3">
                        <Users className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <p className="font-medium" style={{ color: colors.textPrimary }}>Manage Courses</p>
                    </CardBody>
                  </Card>
                </Link>
              </>
            ) : (
              <>
                <Link to="/ai-tools/builder">
                  <Card hover className="h-full">
                    <CardBody className="text-center py-6">
                      <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-3">
                        <Sparkles className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                      </div>
                      <p className="font-medium" style={{ color: colors.textPrimary }}>AI Builder</p>
                    </CardBody>
                  </Card>
                </Link>

                <Link to="/settings">
                  <Card hover className="h-full">
                    <CardBody className="text-center py-6">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
                        <Settings className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                      </div>
                      <p className="font-medium" style={{ color: colors.textPrimary }}>Settings</p>
                    </CardBody>
                  </Card>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Instructor Teaching Overview */}
        {isInstructor && instructorStats && (
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>Teaching Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/teach">
                <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 hover:shadow-md transition-shadow cursor-pointer">
                  <CardBody className="flex items-center gap-4 py-5">
                    <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-indigo-900">{instructorStats.totalCourses}</p>
                      <p className="text-sm text-indigo-600">Your Courses</p>
                    </div>
                  </CardBody>
                </Card>
              </Link>

              <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
                <CardBody className="flex items-center gap-4 py-5">
                  <div className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-cyan-900">{instructorStats.totalStudents}</p>
                    <p className="text-sm text-cyan-600">Total Students</p>
                  </div>
                </CardBody>
              </Card>

              <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
                <CardBody className="flex items-center gap-4 py-5">
                  <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-pink-900">{instructorStats.totalAssignments}</p>
                    <p className="text-sm text-pink-600">Assignments</p>
                  </div>
                </CardBody>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                <CardBody className="flex items-center gap-4 py-5">
                  <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-900">{instructorStats.pendingGrading}</p>
                    <p className="text-sm text-yellow-700">Pending Grading</p>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {/* Stats Section - Bottom */}
        <div>
          <h2 className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>Your Progress</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/courses?filter=enrolled">
              <Card hover>
                <CardBody className="text-center py-5">
                  <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-3xl font-bold" style={{ color: colors.textPrimary }}>{stats?.enrolledCourses || 0}</p>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>Enrolled Courses</p>
                </CardBody>
              </Card>
            </Link>

            <Link to="/courses?filter=completed">
              <Card hover>
                <CardBody className="text-center py-5">
                  <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                    <Award className="w-7 h-7 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-3xl font-bold" style={{ color: colors.textPrimary }}>{stats?.completedCourses || 0}</p>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>Completed</p>
                </CardBody>
              </Card>
            </Link>

            <Card>
              <CardBody className="text-center py-5">
                <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
                  {Math.round((stats?.totalTimeSpent || 0) / 3600)}h
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>Learning Time</p>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="text-center py-5">
                <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-7 h-7 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-3xl font-bold" style={{ color: colors.textPrimary }}>{stats?.submittedAssignments || 0}</p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>Submissions</p>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
