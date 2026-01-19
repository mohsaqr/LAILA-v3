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
  ArrowRight,
  BrainCircuit,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { usersApi } from '../api/users';
import { enrollmentsApi } from '../api/enrollments';
import { coursesApi } from '../api/courses';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';

export const Dashboard = () => {
  const { user, isInstructor } = useAuth();

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

  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => enrollmentsApi.getMyEnrollments(),
    enabled: !!user,
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.fullname?.split(' ')[0]}!
        </h1>
        <p className="text-gray-600 mt-1">Here's what's happening with your learning journey.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.enrolledCourses || 0}</p>
              <p className="text-sm text-gray-500">Enrolled Courses</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Award className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.completedCourses || 0}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round((stats?.totalTimeSpent || 0) / 3600)}h
              </p>
              <p className="text-sm text-gray-500">Learning Time</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.submittedAssignments || 0}</p>
              <p className="text-sm text-gray-500">Submissions</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Instructor Stats */}
      {isInstructor && instructorStats && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Teaching Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardBody className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{instructorStats.totalCourses}</p>
                  <p className="text-sm text-gray-500">Your Courses</p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{instructorStats.totalStudents}</p>
                  <p className="text-sm text-gray-500">Total Students</p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-pink-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{instructorStats.totalAssignments}</p>
                  <p className="text-sm text-gray-500">Assignments</p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{instructorStats.pendingGrading}</p>
                  <p className="text-sm text-gray-500">Pending Grading</p>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Current Courses */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Continue Learning</h2>
            <Link to="/learn" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View all
            </Link>
          </div>

          {enrollmentsLoading ? (
            <Loading />
          ) : enrollments && enrollments.length > 0 ? (
            <div className="space-y-4">
              {enrollments.slice(0, 3).map(enrollment => (
                <Link key={enrollment.id} to={`/learn/${enrollment.courseId}`}>
                  <Card hover>
                    <CardBody className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">
                          {enrollment.course?.title}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {enrollment.course?.instructor?.fullname}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-primary-500 to-secondary-500"
                              style={{ width: `${enrollment.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{enrollment.progress}%</span>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardBody className="text-center py-8">
                <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">You haven't enrolled in any courses yet</p>
                <Link to="/catalog" className="btn btn-primary">
                  Browse Courses
                </Link>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/catalog">
              <Card hover>
                <CardBody className="text-center py-6">
                  <GraduationCap className="w-8 h-8 text-primary-500 mx-auto mb-2" />
                  <p className="font-medium text-gray-900">Browse Courses</p>
                </CardBody>
              </Card>
            </Link>

            <Link to="/ai-tools">
              <Card hover>
                <CardBody className="text-center py-6">
                  <BrainCircuit className="w-8 h-8 text-secondary-500 mx-auto mb-2" />
                  <p className="font-medium text-gray-900">AI Tools</p>
                </CardBody>
              </Card>
            </Link>

            {isInstructor && (
              <>
                <Link to="/teach/create">
                  <Card hover>
                    <CardBody className="text-center py-6">
                      <Briefcase className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                      <p className="font-medium text-gray-900">Create Course</p>
                    </CardBody>
                  </Card>
                </Link>

                <Link to="/teach">
                  <Card hover>
                    <CardBody className="text-center py-6">
                      <Users className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
                      <p className="font-medium text-gray-900">Manage Courses</p>
                    </CardBody>
                  </Card>
                </Link>
              </>
            )}

            {!isInstructor && (
              <>
                <Link to="/learn">
                  <Card hover>
                    <CardBody className="text-center py-6">
                      <BookOpen className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="font-medium text-gray-900">My Learning</p>
                    </CardBody>
                  </Card>
                </Link>

                <Link to="/settings">
                  <Card hover>
                    <CardBody className="text-center py-6">
                      <Award className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                      <p className="font-medium text-gray-900">My Progress</p>
                    </CardBody>
                  </Card>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
