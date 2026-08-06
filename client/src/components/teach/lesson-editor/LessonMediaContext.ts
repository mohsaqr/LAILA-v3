import { createContext } from 'react';

/**
 * Lecture context made available to lesson node views (e.g. the video
 * player) so they can attribute activity logs to the right course/lecture.
 * Provided by LessonViewer on the student lecture page; absent in the
 * editor (where we don't track watch time).
 */
export interface LessonMediaContextValue {
  courseId?: number;
  lectureId?: number;
  /** Section that owns this lesson HTML, so video watch logs attribute to it. */
  sectionId?: number;
  /**
   * Heading the page already shows above this lesson, so a node view can avoid
   * repeating it. A URL resource is the case that motivated this: the lecture
   * is titled "Link: Join the Discord" and holds a single link card also titled
   * "Join the Discord", so the student read the same words twice with nothing
   * else on the page.
   *
   * Absent in the editor, where an author is looking at one block among many
   * and the block's own title is the only label it has.
   */
  pageTitle?: string;
}

export const LessonMediaContext = createContext<LessonMediaContextValue>({});
