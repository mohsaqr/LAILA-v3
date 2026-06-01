import { CurriculumEditor } from '../../../pages/teach/CurriculumEditor';
import { ContentSubTabs } from './ContentSubTabs';
import type { CourseResourceCounts } from '../../../api/courses';

interface ContentStepProps {
  courseId: number;
  resourceCounts?: CourseResourceCounts;
}

/**
 * Wizard step 2 — Content. Small sub-navigation row (Assignments,
 * Quizzes, Forums, Surveys with counts) sits above the curriculum
 * editor so instructors can jump to each manager without losing the
 * wizard context.
 */
export const ContentStep = ({ courseId, resourceCounts }: ContentStepProps) => {
  return (
    <div>
      <ContentSubTabs
        courseId={courseId}
        counts={
          resourceCounts && {
            assignments: resourceCounts.assignments,
            quizzes: resourceCounts.quizzes,
            forums: resourceCounts.forums,
            surveys: resourceCounts.surveys,
          }
        }
      />
      <CurriculumEditor courseId={courseId} embedded />
    </div>
  );
};
