import { describe, it, expect } from 'vitest';
import { withReturnTo, resolveReturnTo, RETURN_TO_PARAM } from './returnTo';

describe('withReturnTo', () => {
  it('carries the current location to a plain target', () => {
    expect(withReturnTo('/teach/courses/3/lectures/9', '/courses/3'))
      .toBe('/teach/courses/3/lectures/9?returnTo=%2Fcourses%2F3');
  });

  it('encodes a location that already has a query', () => {
    // The whole point: edit mode lives in the query, so the value being
    // carried always has a `?` in it. Left raw it would be parsed as a second
    // parameter of the target URL and the `edit=1` would be lost.
    const out = withReturnTo('/teach/courses/3/lectures/9', '/courses/3?edit=1');

    expect(out).toBe('/teach/courses/3/lectures/9?returnTo=%2Fcourses%2F3%3Fedit%3D1');
    expect(new URLSearchParams(out.split('?')[1]).get(RETURN_TO_PARAM)).toBe('/courses/3?edit=1');
  });

  it('appends to a target that already carries a query', () => {
    const out = withReturnTo('/teach/surveys?courseId=3', '/courses/3?edit=1');

    expect(out.startsWith('/teach/surveys?courseId=3&returnTo=')).toBe(true);
    const params = new URLSearchParams(out.split('?')[1]);
    expect(params.get('courseId')).toBe('3');
    expect(params.get(RETURN_TO_PARAM)).toBe('/courses/3?edit=1');
  });

  it('leaves the target alone when there is nowhere to return to', () => {
    expect(withReturnTo('/teach/courses/3/lectures/9', undefined)).toBe('/teach/courses/3/lectures/9');
    expect(withReturnTo('/teach/courses/3/lectures/9', '')).toBe('/teach/courses/3/lectures/9');
    expect(withReturnTo('/teach/courses/3/lectures/9', null)).toBe('/teach/courses/3/lectures/9');
  });

  it('round-trips through resolveReturnTo', () => {
    const from = '/courses/3?edit=1';
    const target = withReturnTo('/teach/courses/3/lectures/9', from);

    expect(resolveReturnTo(`?${target.split('?')[1]}`, '/nope')).toBe(from);
  });
});

describe('resolveReturnTo', () => {
  const FALLBACK = '/courses/3';

  it('returns the requested in-app path', () => {
    expect(resolveReturnTo('?returnTo=%2Fcourses%2F3%3Fedit%3D1', FALLBACK)).toBe('/courses/3?edit=1');
  });

  it('falls back when no returnTo was passed', () => {
    expect(resolveReturnTo('', FALLBACK)).toBe(FALLBACK);
    expect(resolveReturnTo('?other=1', FALLBACK)).toBe(FALLBACK);
    expect(resolveReturnTo(null, FALLBACK)).toBe(FALLBACK);
    expect(resolveReturnTo(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('falls back rather than leaving the site', () => {
    // Protocol-relative: a browser reads this as https://evil.example.
    expect(resolveReturnTo('?returnTo=%2F%2Fevil.example', FALLBACK)).toBe(FALLBACK);
    expect(resolveReturnTo('?returnTo=https%3A%2F%2Fevil.example', FALLBACK)).toBe(FALLBACK);
  });

  it('falls back on the backslash spelling of an authority', () => {
    // GHSA-wrjc-x8rr-h8h6: a browser normalises `\` to `/` in the authority
    // position, so `/\evil.example` leaves the site too.
    expect(resolveReturnTo('?returnTo=%2F%5Cevil.example', FALLBACK)).toBe(FALLBACK);
  });

  it('falls back on a control character', () => {
    expect(resolveReturnTo('?returnTo=%2Fcourses%2F3%0A', FALLBACK)).toBe(FALLBACK);
  });

  it('falls back on a relative path', () => {
    // Not an absolute in-app route, so it cannot be reasoned about.
    expect(resolveReturnTo('?returnTo=courses%2F3', FALLBACK)).toBe(FALLBACK);
  });

  it('never returns the dashboard just because the value was rejected', () => {
    // safeReturnPath's own default is /dashboard, which is the wrong place to
    // land someone who was editing a lecture.
    expect(resolveReturnTo('?returnTo=%2F%2Fevil.example', FALLBACK)).not.toBe('/dashboard');
  });

  it('still honours the dashboard when it is genuinely asked for', () => {
    expect(resolveReturnTo('?returnTo=%2Fdashboard', FALLBACK)).toBe('/dashboard');
  });
});
