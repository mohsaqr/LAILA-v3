import { CourseTutorManager } from '../../../pages/teach/CourseTutorManager';

interface TutorsStepProps {
  courseId: number;
}

/**
 * Wizard step 3 — AI Tutors. Embeds the existing course tutor
 * manager in its embedded mode (inline picker + simplified
 * settings). The intro banner / icons / copy are intentionally
 * absent so the step opens directly into the picker.
 */
export const TutorsStep = ({ courseId }: TutorsStepProps) => {
  return <CourseTutorManager courseId={courseId} embedded />;
};
