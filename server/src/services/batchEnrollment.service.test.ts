import { describe, it, expect, vi, beforeEach } from 'vitest';
import { batchEnrollmentService } from './batchEnrollment.service.js';
import prisma from '../utils/prisma.js';

vi.mock('../utils/prisma.js', () => ({
  default: {
    course: { findMany: vi.fn(), findUnique: vi.fn() },
    courseRole: { findUnique: vi.fn() },
    batchEnrollmentJob: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    batchEnrollmentResult: { create: vi.fn(), count: vi.fn() },
  },
}));

vi.mock('./adminAudit.service.js', () => ({
  adminAuditService: { log: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseCSV', () => {
  it('reports unusable rows instead of dropping them', () => {
    const { rows, invalid } = batchEnrollmentService.parseCSV(
      ['email', 'good@uef.fi', 'not-an-email', 'also.good@uef.fi', ''].join('\n')
    );

    expect(rows.map(r => r.email)).toEqual(['good@uef.fi', 'also.good@uef.fi']);
    // The whole point of the change: a typo has to surface somewhere. Before,
    // this row vanished and the job reported 100% success on a short list.
    expect(invalid).toEqual([
      { rowNumber: 2, email: 'not-an-email', reason: 'Not a valid email address' },
    ]);
  });

  it('numbers rows as the operator sees them, so a bad line can be found', () => {
    const { rows, invalid } = batchEnrollmentService.parseCSV(
      ['email', 'oops', 'fine@uef.fi'].join('\n')
    );

    // Line 1 is the header. The bad row is line 1 of the data, the good row
    // line 2 — the good row must NOT be renumbered to 1 by the bad one's absence.
    expect(invalid[0].rowNumber).toBe(1);
    expect(rows[0].rowNumber).toBe(2);
  });

  it('keeps a quoted name containing a comma in one column', () => {
    const { rows } = batchEnrollmentService.parseCSV(
      ['email,fullname', 'a@uef.fi,"Doe, John"'].join('\n')
    );

    expect(rows[0].fullname).toBe('Doe, John');
  });

  it('ignores blank lines rather than calling them mistakes', () => {
    const { rows, invalid } = batchEnrollmentService.parseCSV(
      ['email', 'a@uef.fi', '', '   ', 'b@uef.fi'].join('\n')
    );

    expect(rows).toHaveLength(2);
    expect(invalid).toEqual([]);
  });

  it('strips the carriage return from a Windows export', () => {
    const { rows } = batchEnrollmentService.parseCSV('email,fullname\r\na@uef.fi,Ann\r\n');

    expect(rows[0].fullname).toBe('Ann');
  });

  it('rejects a file with no email column', () => {
    expect(() => batchEnrollmentService.parseCSV('name,course\nAnn,1')).toThrow(/"email"/);
  });
});

describe('parseMultiCourseCSV', () => {
  it('reads a course id per row', () => {
    const { rows } = batchEnrollmentService.parseMultiCourseCSV(
      ['email,course_id', 'a@uef.fi,1', 'b@uef.fi,2'].join('\n')
    );

    expect(rows).toEqual([
      { email: 'a@uef.fi', courseId: 1, fullname: undefined, rowNumber: 1 },
      { email: 'b@uef.fi', courseId: 2, fullname: undefined, rowNumber: 2 },
    ]);
  });

  it('refuses a course id that is not purely digits', () => {
    const { rows, invalid } = batchEnrollmentService.parseMultiCourseCSV(
      ['email,course_id', 'a@uef.fi,1', 'b@uef.fi,1abc', 'c@uef.fi,2.9'].join('\n')
    );

    // parseInt would read both of these as course 1, silently enrolling two
    // people into a course nobody named.
    expect(rows).toHaveLength(1);
    expect(invalid.map(i => i.email)).toEqual(['b@uef.fi', 'c@uef.fi']);
    expect(invalid[0].reason).toContain('1abc');
  });

  it('reports a missing course id against the right row', () => {
    const { invalid } = batchEnrollmentService.parseMultiCourseCSV(
      ['email,course_id', 'ok@uef.fi,3', 'a@uef.fi,'].join('\n')
    );

    expect(invalid).toEqual([
      { rowNumber: 2, email: 'a@uef.fi', reason: 'Missing course id' },
    ]);
  });

  it('refuses a paste in which no row is usable at all', () => {
    expect(() =>
      batchEnrollmentService.parseMultiCourseCSV('email,course_id\na@uef.fi,\nb@uef.fi,x')
    ).toThrow(/No valid rows/);
  });

  it('does not shift the course id when a quoted name holds a comma', () => {
    const { rows } = batchEnrollmentService.parseMultiCourseCSV(
      ['email,fullname,course_id', 'a@uef.fi,"Doe, John",7'].join('\n')
    );

    // With a bare split(','), course_id would read "John" and the row would
    // fail — or worse, land somewhere unintended.
    expect(rows[0].courseId).toBe(7);
    expect(rows[0].fullname).toBe('Doe, John');
  });

  it('rejects a paste with no course_id column', () => {
    expect(() =>
      batchEnrollmentService.parseMultiCourseCSV('email\na@uef.fi')
    ).toThrow(/"course_id"/);
  });
});

describe('importMultiCourse', () => {
  const admin = { id: 1, email: 'admin@laila.edu', isAdmin: true };
  const twoCourses = ['email,course_id', 'a@uef.fi,1', 'b@uef.fi,2', 'c@uef.fi,1'].join('\n');

  /** Make createJob/processJob no-ops so these tests are about orchestration. */
  const stubJobRunner = () => {
    let nextId = 100;
    const createJob = vi
      .spyOn(batchEnrollmentService, 'createJob')
      .mockImplementation(async () => ({ id: nextId++ }) as any);
    const processJob = vi
      .spyOn(batchEnrollmentService, 'processJob')
      .mockImplementation(async (jobId: number) =>
        ({ id: jobId, successCount: 1, errorCount: 0 }) as any
      );
    vi.mocked(prisma.batchEnrollmentResult.count).mockResolvedValue(0 as any);
    return { createJob, processJob };
  };

  it('creates one job per course and groups the rows', async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      { id: 1, title: 'Stats' },
      { id: 2, title: 'Networks' },
    ] as any);
    const { createJob, processJob } = stubJobRunner();

    const result = await batchEnrollmentService.importMultiCourse(twoCourses, admin, {});

    expect(createJob).toHaveBeenCalledTimes(2);
    // Course 1 has two rows, course 2 has one.
    expect(createJob).toHaveBeenCalledWith(1, 'pasted-import.csv', 2, 1);
    expect(createJob).toHaveBeenCalledWith(2, 'pasted-import.csv', 1, 1);
    expect(processJob.mock.calls[0][1].map((r: any) => r.email)).toEqual([
      'a@uef.fi',
      'c@uef.fi',
    ]);
    expect(result.jobs.map(j => j.courseTitle)).toEqual(['Stats', 'Networks']);
  });

  it('writes nothing when any named course does not exist', async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([{ id: 1, title: 'Stats' }] as any);
    const { createJob } = stubJobRunner();

    await expect(
      batchEnrollmentService.importMultiCourse(twoCourses, admin, {})
    ).rejects.toThrow(/Unknown course id: 2/);

    // Fail closed. A partial import would leave the operator working out which
    // half landed, with users already created.
    expect(createJob).not.toHaveBeenCalled();
  });

  it('writes nothing when the actor cannot manage one of the courses', async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      { id: 1, title: 'Stats' },
      { id: 2, title: 'Networks' },
    ] as any);
    // Teaches course 1, not course 2.
    vi.mocked(prisma.course.findUnique).mockImplementation((async ({ where }: any) => ({
      id: where.id,
      instructorId: where.id === 1 ? 9 : 42,
    })) as any);
    vi.mocked(prisma.courseRole.findUnique).mockResolvedValue(null as any);
    const { createJob } = stubJobRunner();

    await expect(
      batchEnrollmentService.importMultiCourse(twoCourses, { id: 9, isAdmin: false }, {})
    ).rejects.toThrow(/Not authorized.*2/);

    expect(createJob).not.toHaveBeenCalled();
  });

  it('returns unusable rows without attaching them to a course', async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([{ id: 1, title: 'Stats' }] as any);
    const { createJob } = stubJobRunner();

    const result = await batchEnrollmentService.importMultiCourse(
      ['email,course_id', 'a@uef.fi,1', 'broken,1'].join('\n'),
      admin,
      {}
    );

    expect(result.invalid).toHaveLength(1);
    // The job counts only the row it can act on; the bad row is reported on the
    // response instead of being blamed on a course the operator never named.
    expect(createJob).toHaveBeenCalledWith(1, 'pasted-import.csv', 1, 1);
  });
});
