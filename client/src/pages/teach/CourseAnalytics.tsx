import { useParams } from 'react-router-dom';
import { Dashboard } from '../admin/Dashboard';

export const CourseAnalytics = () => {
  const { id } = useParams();
  return <Dashboard mode="instructor" fixedCourseId={Number(id)} />;
};
