import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { enrollmentsApi } from '../api/enrollments';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Enrollment } from '../types';

export const MyLearning = () => {
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => enrollmentsApi.getMyEnrollments(),
  });

  const activeEnrollments = enrollments?.filter(e => e.status === 'active') || [];
  const completedEnrollments = enrollments?.filter(e => e.status === 'completed') || [];

  if (isLoading) {
    return <Loading fullScreen text="Loading your courses..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My Learning</h1>

      {/* Active Courses */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">In Progress</h2>

        {activeEnrollments.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeEnrollments.map(enrollment => (
              <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No active courses</h3>
              <p className="text-gray-500 mb-4">Start learning by enrolling in a course</p>
              <Link to="/catalog" className="btn btn-primary">
                Browse Courses
              </Link>
            </CardBody>
          </Card>
        )}
      </section>

      {/* Completed Courses */}
      {completedEnrollments.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Completed</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedEnrollments.map(enrollment => (
              <EnrollmentCard key={enrollment.id} enrollment={enrollment} completed />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const EnrollmentCard = ({ enrollment, completed = false }: { enrollment: Enrollment; completed?: boolean }) => {
  return (
    <Link to={`/courses/${enrollment.courseId}/player`}>
      <Card hover className="h-full">
        {/* Thumbnail */}
        <div className={`h-32 ${completed ? 'bg-green-500' : 'bg-gradient-to-br from-primary-500 to-secondary-500'} rounded-t-xl flex items-center justify-center relative`}>
          <GraduationCap className="w-12 h-12 text-white/80" />
          {completed && (
            <div className="absolute top-3 right-3 bg-white rounded-full p-1">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
          )}
        </div>

        <CardBody>
          <h3 className="font-semibold text-gray-900 mb-2">{enrollment.course?.title}</h3>
          <p className="text-sm text-gray-500 mb-4">{enrollment.course?.instructor?.fullname}</p>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium text-gray-900">{enrollment.progress}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${completed ? 'bg-green-500' : 'bg-gradient-to-r from-primary-500 to-secondary-500'}`}
                style={{ width: `${enrollment.progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            {enrollment.lastAccessAt ? (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Last accessed {new Date(enrollment.lastAccessAt).toLocaleDateString()}
              </span>
            ) : (
              <span>Not started</span>
            )}
            <ArrowRight className="w-4 h-4" />
          </div>
        </CardBody>
      </Card>
    </Link>
  );
};
