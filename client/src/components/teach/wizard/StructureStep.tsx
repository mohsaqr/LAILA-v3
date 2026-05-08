import { CurriculumEditor } from '../../../pages/teach/CurriculumEditor';

interface StructureStepProps {
  courseId: number;
}

export const StructureStep = ({ courseId }: StructureStepProps) => {
  return <CurriculumEditor courseId={courseId} embedded />;
};
