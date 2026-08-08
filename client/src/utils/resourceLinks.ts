/**
 * Deep-link an activity-log resource (objectType + ids) to its page in the app.
 * Returns null when the type has no viewable page (chatbot, tutor session,
 * emotional pulse…) or when the ids required by the route are missing.
 */
export interface ResourceRef {
  objectType: string;
  objectId: number | null;
  courseId?: number | null;
  lectureId?: number | null;
}

export function resourceLink({ objectType, objectId, courseId, lectureId }: ResourceRef): string | null {
  switch (objectType) {
    case 'course':
      return objectId != null ? `/courses/${objectId}` : null;
    case 'module':
      // Modules have no page of their own; land on the course.
      return courseId != null ? `/courses/${courseId}` : null;
    case 'lecture':
      return courseId != null && objectId != null ? `/courses/${courseId}/lectures/${objectId}` : null;
    case 'section':
    case 'video':
      // Sections and videos live inside a lecture.
      return courseId != null && lectureId != null ? `/courses/${courseId}/lectures/${lectureId}` : null;
    case 'assignment':
      return courseId != null && objectId != null ? `/courses/${courseId}/assignments/${objectId}` : null;
    case 'quiz':
      return courseId != null && objectId != null ? `/courses/${courseId}/quizzes/${objectId}` : null;
    case 'forum':
      return courseId != null && objectId != null ? `/courses/${courseId}/forums/${objectId}` : null;
    case 'code_lab':
      return courseId != null && objectId != null ? `/courses/${courseId}/code-labs/${objectId}` : null;
    case 'lab':
      return objectId != null
        ? `/labs/${objectId}${courseId != null ? `?courseId=${courseId}` : ''}`
        : null;
    default:
      return null;
  }
}
