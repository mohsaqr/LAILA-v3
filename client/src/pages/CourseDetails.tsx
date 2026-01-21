import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Users,
  BookOpen,
  PlayCircle,
  FileText,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Edit,
  Settings,
  ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../api/courses';
import { enrollmentsApi } from '../api/enrollments';
import { useAuth } from '../hooks/useAuth';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { useState } from 'react';

export const CourseDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();
  const [expandedModules, setExpandedModules] = useState<number[]>([]);

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesApi.getCourseById(parseInt(id!)),
  });

  const { data: enrollmentData } = useQuery({
    queryKey: ['enrollment', id],
    queryFn: () => enrollmentsApi.getEnrollment(parseInt(id!)),
    enabled: isAuthenticated,
  });

  const enrollMutation = useMutation({
    mutationFn: () => enrollmentsApi.enroll(parseInt(id!)),
    onSuccess: () => {
      toast.success('Successfully enrolled!');
      queryClient.invalidateQueries({ queryKey: ['enrollment', id] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      navigate(`/courses/${id}/player`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleModule = (moduleId: number) => {
    setExpandedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  if (isLoading) {
    return <Loading fullScreen text="Loading course..." />;
  }

  if (!course) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Course not found</h2>
        <Link to="/catalog" className="text-primary-600 hover:underline mt-2 inline-block">
          Back to catalog
        </Link>
      </div>
    );
  }

  const isEnrolled = enrollmentData?.enrolled;
  const isInstructor = user?.id === course.instructorId;
  const totalLectures = course.modules?.reduce((sum, m) => sum + (m.lectures?.length || 0), 0) || 0;

  const difficultyColors = {
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="gradient-bg text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-white/80 text-sm mb-4">
                <Link to="/catalog" className="hover:text-white">Courses</Link>
                <ChevronRight className="w-4 h-4" />
                <span>{course.category || 'General'}</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold mb-4">{course.title}</h1>
              <p className="text-white/90 text-lg mb-6">{course.description}</p>

              <div className="flex flex-wrap items-center gap-4 mb-6">
                {course.difficulty && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${difficultyColors[course.difficulty]}`}>
                    {course.difficulty}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <Users className="w-5 h-5" />
                  <span>{course._count?.enrollments || 0} students</span>
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="w-5 h-5" />
                  <span>{course.modules?.length || 0} modules</span>
                </div>
                <div className="flex items-center gap-1">
                  <PlayCircle className="w-5 h-5" />
                  <span>{totalLectures} lessons</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="font-medium">
                    {course.instructor?.fullname?.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{course.instructor?.fullname}</p>
                  <p className="text-sm text-white/80">Instructor</p>
                </div>
              </div>
            </div>

            {/* Enrollment Card */}
            <div className="md:col-span-1">
              <Card className="sticky top-24">
                <CardBody className="space-y-4">
                  {isInstructor ? (
                    <div className="space-y-3">
                      <p className="text-center text-gray-600 font-medium">You are the instructor</p>
                      <Link
                        to={`/teach/courses/${course.id}/curriculum`}
                        className="btn btn-primary w-full flex items-center justify-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Update Course
                      </Link>
                      <Link
                        to={`/teach/courses/${course.id}/edit`}
                        className="btn btn-secondary w-full flex items-center justify-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Course Settings
                      </Link>
                    </div>
                  ) : isEnrolled ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Enrolled</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        Click on any lesson below to start learning.
                      </p>
                      <hr />
                      {/* Placeholder for future content: assignments, calendar, etc. */}
                      <div className="text-sm text-gray-400 text-center py-4">
                        {/* Future: Assignments & Calendar */}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-center text-gray-600">Start your learning journey</p>
                      {isAuthenticated ? (
                        <Button
                          onClick={() => enrollMutation.mutate()}
                          loading={enrollMutation.isPending}
                          className="w-full"
                        >
                          Enroll Now - Free
                        </Button>
                      ) : (
                        <Link to="/login" className="btn btn-primary w-full">
                          Sign in to Enroll
                        </Link>
                      )}
                    </>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Course Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Course Content</h2>

        {course.modules && course.modules.length > 0 ? (
          <div className="space-y-4">
            {course.modules.map((module, moduleIndex) => (
              <Card key={module.id}>
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-medium">
                      {moduleIndex + 1}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{module.title}</h3>
                      <p className="text-sm text-gray-500">
                        {module.lectures?.length || 0} lessons
                      </p>
                    </div>
                  </div>
                  {expandedModules.includes(module.id) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {expandedModules.includes(module.id) && module.lectures && (
                  <div className="border-t border-gray-100">
                    {module.lectures.map((lecture) => {
                      const LectureWrapper = isEnrolled ? Link : 'div';
                      const wrapperProps = isEnrolled
                        ? { to: `/courses/${course.id}/player/${lecture.id}` }
                        : {};

                      return (
                        <LectureWrapper
                          key={lecture.id}
                          {...wrapperProps}
                          className={`px-4 py-3 flex items-center gap-3 hover:bg-gray-50 ${isEnrolled ? 'cursor-pointer' : ''}`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isEnrolled ? 'bg-primary-100' : 'bg-gray-100'}`}>
                            {lecture.contentType === 'video' ? (
                              <PlayCircle className={`w-4 h-4 ${isEnrolled ? 'text-primary-600' : 'text-gray-500'}`} />
                            ) : (
                              <FileText className={`w-4 h-4 ${isEnrolled ? 'text-primary-600' : 'text-gray-500'}`} />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm ${isEnrolled ? 'text-primary-700 font-medium' : 'text-gray-900'}`}>{lecture.title}</p>
                            {lecture.duration && (
                              <p className="text-xs text-gray-500">{lecture.duration} min</p>
                            )}
                          </div>
                          {lecture.isFree && !isEnrolled && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              Preview
                            </span>
                          )}
                          {isEnrolled && (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </LectureWrapper>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No content available yet</p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
};
