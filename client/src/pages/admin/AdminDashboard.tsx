import { useQuery } from '@tanstack/react-query';
import {
  Users,
  BookOpen,
  GraduationCap,
  MessageSquare,
  FileText,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { AdminLayout, StatCard } from '../../components/admin';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';

export const AdminDashboard = () => {
  const { data: adminData, isLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => adminApi.getStats(),
  });

  if (isLoading) {
    return <Loading fullScreen text="Loading admin dashboard..." />;
  }

  const stats = adminData?.stats;

  return (
    <AdminLayout
      title="Overview"
      description="Platform statistics and recent activity"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Users className="w-6 h-6 text-blue-600" />}
          iconBgColor="bg-blue-100"
          value={stats?.totalUsers || 0}
          label="Total Users"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6 text-green-600" />}
          iconBgColor="bg-green-100"
          value={stats?.activeUsers || 0}
          label="Active Users"
        />
        <StatCard
          icon={<BookOpen className="w-6 h-6 text-purple-600" />}
          iconBgColor="bg-purple-100"
          value={stats?.totalCourses || 0}
          label="Total Courses"
        />
        <StatCard
          icon={<GraduationCap className="w-6 h-6 text-indigo-600" />}
          iconBgColor="bg-indigo-100"
          value={stats?.publishedCourses || 0}
          label="Published"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<UserPlus className="w-6 h-6 text-cyan-600" />}
          iconBgColor="bg-cyan-100"
          value={stats?.totalEnrollments || 0}
          label="Enrollments"
        />
        <StatCard
          icon={<FileText className="w-6 h-6 text-orange-600" />}
          iconBgColor="bg-orange-100"
          value={stats?.totalAssignments || 0}
          label="Assignments"
        />
        <StatCard
          icon={<MessageSquare className="w-6 h-6 text-pink-600" />}
          iconBgColor="bg-pink-100"
          value={stats?.totalChatLogs || 0}
          label="Chat Sessions"
        />
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">LAILA</p>
            <p className="text-xs text-gray-400">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">New Users</h3>
            <Link
              to="/admin/settings?tab=users"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View All
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-gray-100">
              {adminData?.recentUsers?.slice(0, 5).map((user: any) => (
                <div key={user.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {user.fullname?.charAt(0)?.toUpperCase() || '?'}
                    </span>
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
              {(!adminData?.recentUsers || adminData.recentUsers.length === 0) && (
                <div className="px-6 py-8 text-center text-gray-500 text-sm">
                  No recent users
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Recent Enrollments */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">New Enrollments</h3>
            <Link
              to="/admin/settings?tab=enrollments"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View All
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-gray-100">
              {adminData?.recentEnrollments?.slice(0, 5).map((enrollment: any) => (
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
              {(!adminData?.recentEnrollments || adminData.recentEnrollments.length === 0) && (
                <div className="px-6 py-8 text-center text-gray-500 text-sm">
                  No recent enrollments
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
};
