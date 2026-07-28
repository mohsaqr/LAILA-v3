import { describe, it, expect } from 'vitest';
import { parseIdParam, parsePaginationLimit } from './validation.js';
import { AppError } from '../middleware/error.middleware.js';

describe('parseIdParam', () => {
  it('accepts a positive integer string', () => {
    expect(parseIdParam('42')).toBe(42);
  });

  it('accepts a positive integer number', () => {
    expect(parseIdParam(7)).toBe(7);
  });

  it.each(['abc', '', 'NaN', '-1', '0', '1.5', undefined, null, '12abc-injection'])(
    'rejects non-positive-integer input: %s',
    (bad) => {
      expect(() => parseIdParam(bad as unknown)).toThrow(AppError);
    },
  );

  it('uses the label in the error message', () => {
    expect(() => parseIdParam('x', 'course id')).toThrow(/Invalid course id/);
  });
});

describe('parsePaginationLimit', () => {
  it('clamps to the maximum', () => {
    expect(parsePaginationLimit('99999')).toBe(100);
  });
  it('falls back to the default on garbage', () => {
    expect(parsePaginationLimit('abc', 20)).toBe(20);
  });
});
