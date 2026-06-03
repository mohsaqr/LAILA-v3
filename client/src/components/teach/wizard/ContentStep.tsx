import { MoodleCourseEditor } from '../moodle/MoodleCourseEditor';
import { ContentSubTabs } from './ContentSubTabs';
import type { CourseResourceCounts } from '../../../api/courses';

interface ContentStepProps {
  courseId: number;
  resourceCounts?: CourseResourceCounts;
}

/**
 * Wizard step 2 — Content. Small sub-navigation row (Assignments,
 * Quizzes, Forums, Surveys with counts) sits above the Moodle-style
 * curriculum editor — the same component used by the course page's
 * inline Edit Mode (inline title rename, per-item 3-dots, bottom "+"
 * add bar, dedicated create/edit pages).
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
      <MoodleCourseEditor courseId={courseId} />
    </div>
  );
};
