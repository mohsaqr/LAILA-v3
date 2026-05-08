import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { CourseRoleManager } from '../../admin/CourseRoleManager';
import { useTheme } from '../../../hooks/useTheme';

interface TeamStepProps {
  courseId: number;
  instructorId: number;
}

export const TeamStep = ({ courseId, instructorId }: TeamStepProps) => {
  const { t } = useTranslation('teaching');
  const { isDark } = useTheme();

  return (
    <div>
      <div
        className="mb-5 rounded-xl border px-4 py-3.5 flex items-start gap-3"
        style={{
          backgroundColor: isDark ? 'rgba(8,143,143,0.10)' : '#ecfeff',
          borderColor: isDark ? 'rgba(8,143,143,0.25)' : '#a5f3fc',
        }}
      >
        <Users className="w-5 h-5 mt-0.5 shrink-0" style={{ color: isDark ? '#22d3d3' : '#077575' }} />
        <div className="text-sm leading-relaxed" style={{ color: isDark ? '#cbd5e1' : '#0f172a' }}>
          {t('wizard_team_intro', {
            defaultValue:
              'Add teaching assistants or co-instructors to share grading and content management. You can skip this and add team members later.',
          })}
        </div>
      </div>

      <CourseRoleManager courseId={courseId} instructorId={instructorId} />
    </div>
  );
};
