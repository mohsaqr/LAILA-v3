import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  BookOpen,
  GraduationCap,
  MessageSquare,
  FileText,
  TrendingUp,
  UserPlus,
  Settings,
  Download,
  BarChart3,
  Bot,
} from 'lucide-react';
import { adminApi } from '../../api/admin';
import { usersApi } from '../../api/users';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'courses' | 'enrollments'>('overview');

  const { data: adminData, isLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => adminApi.getStats(),
  });

  const { data: usersData } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => usersApi.getUsers(1, 10),
    enabled: activeTab === 'users',
  });

  const { data: coursesData } = useQuery({
    queryKey: ['adminCourses'],
    queryFn: () => adminApi.getCourses(1, 10),
    enabled: activeTab === 'courses',
  });

  const { data: enrollmentsData } = useQuery({
    queryKey: ['adminEnrollments'],
    queryFn: () => adminApi.getEnrollments(1, 10),
    enabled: activeTab === 'enrollments',
  });

  if (isLoading) {
    return <Loading fullScreen text="Loading admin dashboard..." />;
  }

  const stats = adminData?.stats;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mt-1">System overview and management</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/analytics">
            <Button variant="outline" icon={<BarChart3 className="w-4 h-4" />}>
              Analytics
            </Button>
          </Link>
          <Link to="/admin/llm">
            <Button variant="outline" icon={<Bot className="w-4 h-4" />}>
              LLM Settings
            </Button>
          </Link>
          <Link to="/admin/settings">
            <Button variant="outline" icon={<Settings className="w-4 h-4" />}>
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        <Card>
          <CardBody className="text-center py-4">
            <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
            <p className="text-xs text-gray-500">Users</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-4">
            <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats?.activeUsers || 0}</p>
            <p className="text-xs text-gray-500">Active</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-4">
            <BookOpen className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats?.totalCourses || 0}</p>
            <p className="text-xs text-gray-500">Courses</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-4">
            <GraduationCap className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats?.publishedCourses || 0}</p>
            <p className="text-xs text-gray-500">Published</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-4">
            <UserPlus className="w-6 h-6 text-cyan-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats?.totalEnrollments || 0}</p>
            <p className="text-xs text-gray-500">Enrollments</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-4">
            <FileText className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats?.totalAssignments || 0}</p>
            <p className="text-xs text-gray-500">Assignments</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center py-4">
            <MessageSquare className="w-6 h-6 text-pink-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats?.totalChatLogs || 0}</p>
            <p className="text-xs text-gray-500">Chats</p>
          </CardBody>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {(['overview', 'users', 'courses', 'enrollments'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Users */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Recent Users</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('users')}>
                View All
              </Button>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-gray-100">
                {adminData?.recentUsers?.map((user: any) => (
                  <div key={user.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.fullname}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Recent Enrollments */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Recent Enrollments</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('enrollments')}>
                View All
              </Button>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-gray-100">
                {adminData?.recentEnrollments?.map((enrollment: any) => (
                  <div key={enrollment.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <GraduationCap className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {enrollment.user?.fullname}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{enrollment.course?.title}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(enrollment.enrolledAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'users' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">All Users</h2>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={() => adminApi.exportData('users')}
            >
              Export
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersData?.users?.map((user: any) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.fullname}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {user.isAdmin && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                            Admin
                          </span>
                        )}
                        {user.isInstructor && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                            Instructor
                          </span>
                        )}
                        {!user.isAdmin && !user.isInstructor && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                            Student
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={user.isActive !== false ? 'active' : 'draft'} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {activeTab === 'courses' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">All Courses</h2>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={() => adminApi.exportData('courses')}
            >
              Export
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Instructor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Enrollments
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coursesData?.courses?.map((course: any) => (
                  <tr key={course.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{course.title}</p>
                        <p className="text-xs text-gray-500">{course.category}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {course.instructor?.fullname}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={course.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {course._count?.enrollments || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {activeTab === 'enrollments' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">All Enrollments</h2>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={() => adminApi.exportData('enrollments')}
            >
              Export
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Enrolled
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enrollmentsData?.enrollments?.map((enrollment: any) => (
                  <tr key={enrollment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {enrollment.user?.fullname}
                        </p>
                        <p className="text-xs text-gray-500">{enrollment.user?.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {enrollment.course?.title}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full max-w-[100px]">
                          <div
                            className="h-full bg-primary-500 rounded-full"
                            style={{ width: `${enrollment.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{enrollment.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(enrollment.enrolledAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
