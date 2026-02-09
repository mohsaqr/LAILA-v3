import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Bot, ChevronRight } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../common/Card';

interface Assignment {
  id: number;
  title: string;
  description?: string;
  dueDate?: string;
  points: number;
  submissionType: string;
  isPublished: boolean;
}

interface CourseAssignmentsProps {
  courseId: number;
  assignments: Assignment[];
}

export const CourseAssignments = ({ courseId, assignments }: CourseAssignmentsProps) => {
  const { t } = useTranslation(['courses']);
  const { isDark } = useTheme();

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    bgAmber: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textAmber: isDark ? '#fcd34d' : '#d97706',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    textTeal: isDark ? '#5eecec' : '#088F8F',
  };

  // Filter to only published assignments
  const publishedAssignments = assignments.filter(a => a.isPublished);

  if (publishedAssignments.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <ClipboardList className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textMuted }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
            {t('no_assignments_available')}
          </h3>
          <p style={{ color: colors.textSecondary }}>
            {t('no_assignments_description')}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {publishedAssignments.map((assignment) => (
        <Card key={assignment.id} hover>
          <Link
            to={assignment.submissionType === 'ai_agent'
              ? `/courses/${courseId}/agent-assignments/${assignment.id}`
              : `/courses/${courseId}/assignments/${assignment.id}`}
            className="block"
          >
            <CardBody className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: assignment.submissionType === 'ai_agent' ? colors.bgTeal : colors.bgAmber
                }}
              >
                {assignment.submissionType === 'ai_agent' ? (
                  <Bot className="w-6 h-6" style={{ color: colors.textTeal }} />
                ) : (
                  <ClipboardList className="w-6 h-6" style={{ color: colors.textAmber }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium" style={{ color: colors.textPrimary }}>{assignment.title}</h3>
                {assignment.description && (
                  <p className="text-sm mt-1 line-clamp-2" style={{ color: colors.textSecondary }}>
                    {assignment.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-sm" style={{ color: colors.textSecondary }}>
                  {assignment.dueDate && (
                    <span>{t('due_date_format', { date: new Date(assignment.dueDate).toLocaleDateString() })}</span>
                  )}
                  <span>{t('x_points', { count: assignment.points })}</span>
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: assignment.submissionType === 'ai_agent' ? colors.bgTeal : colors.bgAmber,
                      color: assignment.submissionType === 'ai_agent' ? colors.textTeal : colors.textAmber,
                    }}
                  >
                    {assignment.submissionType === 'ai_agent' ? t('ai_agent_type') : t('standard_type')}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: colors.textMuted }} />
            </CardBody>
          </Link>
        </Card>
      ))}
    </div>
  );
};

export default CourseAssignments;
