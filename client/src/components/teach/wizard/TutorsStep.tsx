import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';
import { CourseTutorManager } from '../../../pages/teach/CourseTutorManager';
import { useTheme } from '../../../hooks/useTheme';

interface TutorsStepProps {
  courseId: number;
}

/**
 * Wizard step 3 — AI Tutors. Embeds the existing course tutor manager
 * so the instructor can attach AI tutors to the course as part of the
 * setup flow.
 */
export const TutorsStep = ({ courseId }: TutorsStepProps) => {
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
        <Bot
          className="w-5 h-5 mt-0.5 shrink-0"
          style={{ color: isDark ? '#22d3d3' : '#077575' }}
        />
        <div className="text-sm leading-relaxed" style={{ color: isDark ? '#cbd5e1' : '#0f172a' }}>
          {t('wizard_tutors_intro', {
            defaultValue:
              'Attach AI tutors so students can ask questions and get guided help. You can skip this step and add tutors later.',
          })}
        </div>
      </div>

      <CourseTutorManager courseId={courseId} embedded />
    </div>
  );
};
