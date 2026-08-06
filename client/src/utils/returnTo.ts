import { safeReturnPath } from './safeReturnPath';

/**
 * Carrying "where I came from" through a detour to another page.
 *
 * Course Edit Mode lives in the URL (`/courses/3?edit=1`), but adding or
 * editing an item leaves that URL for a dedicated `/teach/...` editor. Those
 * editors used to come back with a hard-coded `navigate('/courses/:id')`, which
 * dropped the teacher on the read-only student view every time — edit mode
 * appeared to switch itself off after every single edit. Worse, the same editor
 * is also reached from the setup wizard, which the hard-coded path sent to the
 * wrong page entirely.
 *
 * So the departing page states its own location and the destination returns to
 * it. That makes the round trip correct from both entry points without either
 * side knowing about the other.
 */

export const RETURN_TO_PARAM = 'returnTo';

/**
 * Append the caller's current location to `target` as a `returnTo` parameter.
 *
 * `from` is expected to be an in-app `pathname + search`. It is encoded, not
 * validated — a value only becomes dangerous when something navigates to it,
 * and that check belongs at the point of use in `resolveReturnTo`, where the
 * value arrives from the URL bar and cannot be trusted regardless of what this
 * function did.
 */
export const withReturnTo = (target: string, from?: string | null): string => {
  if (!from) return target;
  const separator = target.includes('?') ? '&' : '?';
  return `${target}${separator}${RETURN_TO_PARAM}=${encodeURIComponent(from)}`;
};

/**
 * Read a validated `returnTo` out of a search string, or fall back.
 *
 * The value comes from the URL, so it is an open-redirect sink: anyone who can
 * hand a teacher a link can choose where "Save" lands them. `safeReturnPath` is
 * the one place in this codebase that reasons about hostile paths — protocol
 * relative `//host`, the backslash variant `/\host` behind react-router
 * advisory GHSA-wrjc-x8rr-h8h6, and control characters — so this defers to it
 * rather than growing a second opinion.
 *
 * A rejected value comes back from `safeReturnPath` as its own default of
 * `/dashboard`, which is the wrong destination here: someone editing a lecture
 * should land back on the course, not the dashboard. Rejection is therefore
 * detected by the result differing from the input, and `fallback` is used
 * instead. A value it merely rewrites (a backslash normalised away) is treated
 * as rejected too — the caller asked for something this app does not serve.
 */
export const resolveReturnTo = (search: string | null | undefined, fallback: string): string => {
  const raw = new URLSearchParams(search ?? '').get(RETURN_TO_PARAM);
  if (!raw) return fallback;
  return safeReturnPath(raw) === raw ? raw : fallback;
};
