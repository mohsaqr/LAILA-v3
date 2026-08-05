import { describe, it, expect } from 'vitest';
import { planItemDrop, canCopyRow } from './dnd';

const rows = (...ids: number[]) => ids.map(id => ({ type: 'lecture', id }));
const ids = (plan: { order: { id: number }[] } | null) => plan?.order.map(r => r.id);

describe('planItemDrop — within one section', () => {
  it('reorders without asking for a move', () => {
    const plan = planItemDrop({
      destRows: rows(1, 2, 3),
      held: { type: 'lecture', id: 1 },
      sameSection: true,
      targetIndex: 2,
    });

    expect(plan?.move).toBe(false);
    // Dropping the first row onto the last lands it last. This is the editor's
    // long-standing behaviour and the tests pin it deliberately.
    expect(ids(plan)).toEqual([2, 3, 1]);
  });

  it('drags a row upward', () => {
    const plan = planItemDrop({
      destRows: rows(1, 2, 3),
      held: { type: 'lecture', id: 3 },
      sameSection: true,
      targetIndex: 0,
    });

    expect(ids(plan)).toEqual([3, 1, 2]);
  });

  it('returns null when a row is dropped on its own position', () => {
    const plan = planItemDrop({
      destRows: rows(1, 2, 3),
      held: { type: 'lecture', id: 2 },
      sameSection: true,
      targetIndex: 1,
    });

    // No request should be spent on a drag that changed nothing.
    expect(plan).toBeNull();
  });

  it('returns null when the held row is not in the section it claims', () => {
    const plan = planItemDrop({
      destRows: rows(1, 2),
      held: { type: 'lecture', id: 99 },
      sameSection: true,
      targetIndex: 0,
    });

    expect(plan).toBeNull();
  });

  it('distinguishes rows of different types that share an id', () => {
    // Ids are only unique per table — a quiz 1 and a lecture 1 both exist.
    const plan = planItemDrop({
      destRows: [{ type: 'quiz', id: 1 }, { type: 'lecture', id: 1 }],
      held: { type: 'lecture', id: 1 },
      sameSection: true,
      targetIndex: 0,
    });

    expect(plan?.order).toEqual([{ type: 'lecture', id: 1 }, { type: 'quiz', id: 1 }]);
  });
});

describe('planItemDrop — across sections', () => {
  it('asks for a move and splices the row in at the drop position', () => {
    const plan = planItemDrop({
      destRows: rows(1, 2, 3),
      held: { type: 'lecture', id: 9 },
      sameSection: false,
      targetIndex: 1,
    });

    expect(plan?.move).toBe(true);
    expect(ids(plan)).toEqual([1, 9, 2, 3]);
  });

  it('appends when dropped past the last row', () => {
    // This is what the section's empty space below the rows sends, and it is
    // the only way to drop into a section that has no rows to aim at.
    const plan = planItemDrop({
      destRows: rows(1, 2),
      held: { type: 'lecture', id: 9 },
      sameSection: false,
      targetIndex: 99,
    });

    expect(ids(plan)).toEqual([1, 2, 9]);
  });

  it('handles a drop into a completely empty section', () => {
    const plan = planItemDrop({
      destRows: [],
      held: { type: 'lecture', id: 9 },
      sameSection: false,
      targetIndex: 0,
    });

    expect(plan?.move).toBe(true);
    expect(ids(plan)).toEqual([9]);
  });

  it('clamps a negative index rather than corrupting the order', () => {
    const plan = planItemDrop({
      destRows: rows(1, 2),
      held: { type: 'lecture', id: 9 },
      sameSection: false,
      targetIndex: -3,
    });

    expect(ids(plan)).toEqual([9, 1, 2]);
  });
});

describe('planItemDrop — pinned rows', () => {
  it('refuses to plan anything for a pinned row', () => {
    // Interactive labs live as keys on the module with no row of their own, so
    // there is nothing to reorder or move.
    const plan = planItemDrop({
      destRows: rows(1, 2),
      held: { type: 'interactive', id: 0, pinned: true },
      sameSection: false,
      targetIndex: 0,
    });

    expect(plan).toBeNull();
  });
});

describe('canCopyRow', () => {
  it('allows copying a lecture', () => {
    expect(canCopyRow({ type: 'lecture' })).toBe(true);
  });

  it.each(['assignment', 'quiz', 'forum', 'survey', 'codelab', 'lab'])(
    'does not offer copy for %s — no server-side duplicate exists yet',
    type => {
      expect(canCopyRow({ type })).toBe(false);
    },
  );

  it('does not offer copy for a pinned row', () => {
    // Interactive labs are keys on the module, not rows — nothing to duplicate.
    expect(canCopyRow({ type: 'lecture', pinned: true })).toBe(false);
  });
});
