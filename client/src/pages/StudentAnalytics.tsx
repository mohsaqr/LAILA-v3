import { useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Dashboard } from './admin/Dashboard';

export const StudentAnalytics = () => {
  const { courseId } = useParams();
  const user = useAuthStore((state) => state.user);
  return <Dashboard mode="student" fixedCourseId={Number(courseId)} fixedUserId={user?.id} />;
};
