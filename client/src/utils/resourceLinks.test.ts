import { describe, it, expect } from 'vitest';
import { resourceLink } from './resourceLinks';

describe('resourceLink', () => {
  it('links course-scoped content', () => {
    expect(resourceLink({ objectType: 'lecture', objectId: 7, courseId: 3 })).toBe('/courses/3/lectures/7');
    expect(resourceLink({ objectType: 'assignment', objectId: 4, courseId: 3 })).toBe('/courses/3/assignments/4');
    expect(resourceLink({ objectType: 'quiz', objectId: 9, courseId: 3 })).toBe('/courses/3/quizzes/9');
    expect(resourceLink({ objectType: 'forum', objectId: 2, courseId: 3 })).toBe('/courses/3/forums/2');
    expect(resourceLink({ objectType: 'code_lab', objectId: 5, courseId: 3 })).toBe('/courses/3/code-labs/5');
  });

  it('links course and module to the course page', () => {
    expect(resourceLink({ objectType: 'course', objectId: 3 })).toBe('/courses/3');
    expect(resourceLink({ objectType: 'module', objectId: 12, courseId: 3 })).toBe('/courses/3');
  });

  it('links sections and videos through their parent lecture', () => {
    expect(resourceLink({ objectType: 'section', objectId: 20, courseId: 3, lectureId: 7 })).toBe('/courses/3/lectures/7');
    expect(resourceLink({ objectType: 'video', objectId: 21, courseId: 3, lectureId: 7 })).toBe('/courses/3/lectures/7');
    expect(resourceLink({ objectType: 'section', objectId: 20, courseId: 3, lectureId: null })).toBeNull();
  });

  it('links labs with an optional course scope', () => {
    expect(resourceLink({ objectType: 'lab', objectId: 18, courseId: 3 })).toBe('/labs/18?courseId=3');
    expect(resourceLink({ objectType: 'lab', objectId: 18 })).toBe('/labs/18');
  });

  it('returns null for unroutable types or missing ids', () => {
    expect(resourceLink({ objectType: 'chatbot', objectId: 1, courseId: 3 })).toBeNull();
    expect(resourceLink({ objectType: 'tutor_session', objectId: 1 })).toBeNull();
    expect(resourceLink({ objectType: 'lecture', objectId: 7, courseId: null })).toBeNull();
    expect(resourceLink({ objectType: 'lecture', objectId: null, courseId: 3 })).toBeNull();
  });
});
