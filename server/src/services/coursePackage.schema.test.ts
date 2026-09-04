import { describe, it, expect } from 'vitest';
import {
  coursePackageSchema,
  findDanglingReferences,
  packageManifestSchema,
  COURSE_PACKAGE_FORMAT,
  COURSE_PACKAGE_VERSION,
  type CoursePackage,
} from './coursePackage.schema.js';
import { minimalPackage } from './coursePackage.fixtures.js';

describe('coursePackageSchema', () => {
  it('accepts the minimal fixture', () => {
    expect(coursePackageSchema.safeParse(minimalPackage()).success).toBe(true);
  });

  it('rejects a package with a missing collection', () => {
    const { tutors: _drop, ...rest } = minimalPackage();
    const result = coursePackageSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects a file entry whose hash is not sha256 hex', () => {
    const pkg = minimalPackage();
    pkg.files.push({ url: '/uploads/x.pdf', sha256: 'nothex', size: 1 });
    expect(coursePackageSchema.safeParse(pkg).success).toBe(false);
  });

  it('rejects a non-ISO date', () => {
    const pkg = minimalPackage();
    pkg.modules[0].availableFrom = 'yesterday';
    expect(coursePackageSchema.safeParse(pkg).success).toBe(false);
  });
});

describe('findDanglingReferences', () => {
  it('is empty for a consistent package', () => {
    expect(findDanglingReferences(minimalPackage())).toEqual([]);
  });

  it('flags a section pointing at an unknown assignment', () => {
    const pkg = minimalPackage();
    pkg.modules[0].lectures[0].sections[0].assignmentKey = 'a-missing';
    expect(findDanglingReferences(pkg)).toEqual([
      'lecture "le1" section refers to unknown key "a-missing"',
    ]);
  });

  it('flags a default tutor that is not in the package', () => {
    const pkg = minimalPackage();
    pkg.course.defaultTutorKey = 't999';
    expect(findDanglingReferences(pkg)).toContain('course.defaultTutorKey refers to unknown key "t999"');
  });

  it('flags duplicate keys', () => {
    const pkg: CoursePackage = minimalPackage();
    pkg.modules.push({ ...pkg.modules[0], lectures: [], children: [] });
    expect(findDanglingReferences(pkg)).toContain('duplicate module key "m1"');
  });

  it('checks nested module keys too', () => {
    const pkg = minimalPackage();
    pkg.quizzes[0].moduleKey = 'm-child';
    pkg.modules[0].children.push({ ...pkg.modules[0], key: 'm-child', lectures: [], children: [], moduleSurveys: [], codeLabs: [] });
    expect(findDanglingReferences(pkg)).toEqual([]);
  });
});

describe('packageManifestSchema', () => {
  it('accepts a current manifest', () => {
    const ok = packageManifestSchema.safeParse({
      format: COURSE_PACKAGE_FORMAT,
      formatVersion: COURSE_PACKAGE_VERSION,
      exportedAt: '2026-09-04T12:00:00.000Z',
      exporter: { application: 'LAILA', version: '3.13.0' },
      source: { courseId: 1, slug: 'x', title: 'X' },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects another format', () => {
    const bad = packageManifestSchema.safeParse({ format: 'moodle2', formatVersion: 1 });
    expect(bad.success).toBe(false);
  });
});
