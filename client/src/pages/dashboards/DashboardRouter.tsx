import { useAuth } from '../../hooks/useAuth';
import { StudentDashboard } from './StudentDashboard';
import { InstructorDashboard } from './InstructorDashboard';
import { AdminDashboard } from './AdminDashboard';

/**
 * Picks the role-specific dashboard at render time. Admin takes
 * precedence over instructor; instructor over student. The three
 * components live in the same directory so each role's dashboard can
 * evolve independently without touching the others.
 */
export const DashboardRouter = () => {
  const { isAdmin, isInstructor } = useAuth();
  if (isAdmin) return <AdminDashboard />;
  if (isInstructor) return <InstructorDashboard />;
  return <StudentDashboard />;
};
