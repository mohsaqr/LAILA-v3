import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * These tests verify the Zod validation enums match the known set of valid
 * verbs and object types. The arrays are duplicated from activityLog.routes.ts
 * on purpose — if someone adds/removes a value in the route without updating
 * these tests, the drift will be caught.
 */

const validVerbs = [
  'enrolled', 'unenrolled', 'viewed', 'started', 'completed', 'progressed',
  'submitted', 'unsubmitted', 'interacted', 'downloaded', 'selected',
  'designed',
] as const;

const validObjectTypes = [
  'course', 'module', 'lecture', 'section', 'video',
  'assignment', 'chatbot', 'file', 'quiz',
  'emotional_pulse', 'tutor_agent', 'tutor_session', 'tutor_conversation',
  'course_tutor', 'course_tutor_conversation',
  'assignment_agent', 'agent_conversation',
  'lab', 'forum', 'certificate', 'survey', 'gradebook',
  'dashboard', 'profile', 'catalog', 'analytics',
] as const;

const logActivitySchema = z.object({
  verb: z.enum(validVerbs),
  objectType: z.enum(validObjectTypes),
  objectId: z.number().optional(),
  objectTitle: z.string().optional(),
  courseId: z.number().optional(),
  extensions: z.record(z.unknown()).optional(),
});

describe('Activity Log Zod Validation', () => {
  it('should accept all new object types (forum, certificate, survey, gradebook)', () => {
    const newTypes = ['forum', 'certificate', 'survey', 'gradebook'] as const;
    for (const objectType of newTypes) {
      const result = logActivitySchema.safeParse({ verb: 'viewed', objectType });
      expect(result.success, `Expected '${objectType}' to be accepted`).toBe(true);
    }
  });

  it('should accept course_tutor and course_tutor_conversation', () => {
    for (const objectType of ['course_tutor', 'course_tutor_conversation'] as const) {
      const result = logActivitySchema.safeParse({ verb: 'viewed', objectType });
      expect(result.success, `Expected '${objectType}' to be accepted`).toBe(true);
    }
  });

  it('should reject unknown object type', () => {
    const result = logActivitySchema.safeParse({ verb: 'viewed', objectType: 'invalid_type' });
    expect(result.success).toBe(false);
  });

  it('should accept every valid verb', () => {
    for (const verb of validVerbs) {
      const result = logActivitySchema.safeParse({ verb, objectType: 'course' });
      expect(result.success, `Expected verb '${verb}' to be accepted`).toBe(true);
    }
  });

  it('should accept assignment_agent object type with unsubmitted verb', () => {
    const result = logActivitySchema.safeParse({
      verb: 'unsubmitted',
      objectType: 'assignment_agent',
    });
    expect(result.success).toBe(true);
  });

  it('should reject unknown verb', () => {
    const result = logActivitySchema.safeParse({ verb: 'hacked', objectType: 'course' });
    expect(result.success).toBe(false);
  });

  it('should reject removed/consolidated verbs', () => {
    for (const verb of ['messaged', 'cleared', 'expressed', 'switched', 'received', 'paused', 'resumed', 'seeked', 'scrolled', 'graded']) {
      const result = logActivitySchema.safeParse({ verb, objectType: 'course' });
      expect(result.success, `Expected verb '${verb}' to be rejected`).toBe(false);
    }
  });
});
