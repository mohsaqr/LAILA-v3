import { describe, it, expect } from 'vitest';
import { buildLabBreadcrumb } from './breadcrumbs';

/** Only the crumbs a user can actually click. */
const links = (items: { label: string; href?: string }[]) =>
  items.filter(i => i.href).map(i => i.href);

describe('buildLabBreadcrumb in a course', () => {
  const inCourse = () =>
    buildLabBreadcrumb({
      labName: 'Sequence Analysis',
      labsLabel: 'Interactive Labs',
      coursesLabel: 'Courses',
      courseId: 7,
      courseTitle: 'Learning Analytics',
    });

  it('links back to the course, not just the course list', () => {
    // The bug: the only link went to /courses, dumping a student at the top
    // level with no way back into the course the lab belonged to.
    expect(links(inCourse())).toContain('/courses/7');
  });

  it('links back to the course labs page the lab was opened from', () => {
    expect(links(inCourse())).toContain('/courses/7/labs');
  });

  it('walks the full hierarchy in order', () => {
    expect(inCourse().map(i => i.label)).toEqual([
      'Courses',
      'Learning Analytics',
      'Interactive Labs',
      'Sequence Analysis',
    ]);
  });

  it('leaves the lab itself unlinked as the current page', () => {
    const items = inCourse();
    expect(items[items.length - 1]).toEqual({ label: 'Sequence Analysis' });
  });

  it('accepts a string course id from a query param without mangling the href', () => {
    const items = buildLabBreadcrumb({
      labName: 'Lab',
      labsLabel: 'Interactive Labs',
      coursesLabel: 'Courses',
      courseId: '7',
      courseTitle: 'Learning Analytics',
    });
    expect(links(items)).toContain('/courses/7/labs');
  });
});

describe('buildLabBreadcrumb standalone', () => {
  const standalone = buildLabBreadcrumb({ labName: 'Sequence Analysis', labsLabel: 'Labs' });

  it('goes to the labs catalog, with no course crumbs invented', () => {
    expect(standalone.map(i => i.label)).toEqual(['Labs', 'Sequence Analysis']);
    expect(links(standalone)).toEqual(['/labs']);
  });

  it('treats a null course id as standalone', () => {
    const items = buildLabBreadcrumb({ labName: 'Lab', labsLabel: 'Labs', courseId: null });
    expect(links(items)).toEqual(['/labs']);
  });
});
