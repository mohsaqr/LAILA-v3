import { describe, it, expect } from 'vitest';
import {
  parseIdParam,
  parsePaginationLimit,
  registerSchema,
  loginSchema,
  updatePasswordSchema,
} from './validation.js';
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

describe('password length bounds vs bcrypt truncation', () => {
  // bcrypt hashes only the first 72 bytes and discards the rest silently, so a
  // longer password is a broken promise: it is accepted, it works, and the tail
  // protects nothing. Reject it at the point it is SET.
  const valid = (body: Record<string, unknown>) => ({
    email: 'a@b.com',
    fullname: 'A B',
    ...body,
  });

  const strong = (length: number) => `Aa1!${'x'.repeat(Math.max(0, length - 4))}`;

  it('accepts a strong password at exactly the 72-byte limit', () => {
    const result = registerSchema.safeParse(valid({ password: strong(72) }));
    expect(result.success).toBe(true);
  });

  it('rejects a password one byte over the limit', () => {
    const result = registerSchema.safeParse(valid({ password: strong(73) }));
    expect(result.success).toBe(false);
  });

  // The reason this is a byte check and not `.max(72)`: zod's .max() counts
  // UTF-16 code units, so these 40 characters (80 bytes in UTF-8) would pass a
  // character limit and then be truncated by bcrypt anyway.
  it('counts bytes, not characters, for multibyte passwords', () => {
    const multibyte = `Aa1!${'é'.repeat(38)}`; // 4 + 76 = 80 bytes, 42 chars
    expect(multibyte.length).toBeLessThan(73);
    expect(Buffer.byteLength(multibyte, 'utf8')).toBeGreaterThan(72);

    const result = registerSchema.safeParse(valid({ password: multibyte }));
    expect(result.success, 'a 42-character password of 80 bytes must be rejected').toBe(false);
  });

  // Bound where a password is SET, never where one is CHECKED. Anyone who set a
  // longer password before this limit existed still types the whole thing;
  // bcrypt compares the first 72 bytes and matches. Rejecting it at validation
  // would lock them out of their own account.
  it('does NOT bound the password on login', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: 'x'.repeat(200) });
    expect(result.success, 'login must accept an over-long existing password').toBe(true);
  });

  it('does NOT bound currentPassword on change, only newPassword', () => {
    const result = updatePasswordSchema.safeParse({
      currentPassword: 'x'.repeat(200),
      newPassword: strong(20),
    });
    expect(result.success).toBe(true);
  });
});
