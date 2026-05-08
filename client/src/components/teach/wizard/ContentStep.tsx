import { CurriculumEditor } from '../../../pages/teach/CurriculumEditor';

interface ContentStepProps {
  courseId: number;
}

/**
 * Wizard step 2 — Content. Embeds the existing curriculum editor
 * (modules / lectures / labs / assignments / forums / quizzes).
 */
export const ContentStep = ({ courseId }: ContentStepProps) => {
  return <CurriculumEditor courseId={courseId} embedded />;
};
