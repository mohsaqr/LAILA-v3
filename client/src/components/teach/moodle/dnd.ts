/**
 * Drop planning for the course editor's drag-and-drop.
 *
 * Dragging a resource used to be reorder-within-a-section only. Now a drag can
 * end in a different section, which needs two server calls instead of one — and
 * the index maths differs between the two cases. That logic lives here, pure,
 * so it can be tested without mounting the editor.
 */

export interface DropRowRef {
  type: string;
  id: number;
  pinned?: boolean;
}

/**
 * Whether a resource can be COPIED (as opposed to cut, which is just a move
 * and works for everything).
 *
 * Copying has to duplicate rows server-side, and only lectures have an
 * endpoint for that — `POST /courses/lectures/:id/duplicate`. Assignments,
 * quizzes, forums, surveys and code labs would each need their own deep copy,
 * including their child rows. Until they have one, Copy is not offered for
 * them: an action that is absent is better than one that fails when clicked.
 *
 * Pinned rows (interactive labs) have no row of their own to duplicate.
 */
export function canCopyRow(item: { type: string; pinned?: boolean }): boolean {
  return item.type === 'lecture' && !item.pinned;
}

export interface DropPlan {
  /** Whether the row has to change section before the order is written. */
  move: boolean;
  /** The destination's full row order, to persist after any move. */
  order: { type: string; id: number }[];
}

/**
 * Resolve a drop into the calls it implies, or null when it is a no-op.
 *
 * Null is returned for a pinned row (interactive labs have no row of their own
 * to reorder), for a same-section drop onto the position it already occupies,
 * and for a row that is not in the section it claims to come from.
 */
export function planItemDrop({
  destRows,
  held,
  sameSection,
  targetIndex,
}: {
  /** The destination section's reorderable rows, in display order. */
  destRows: DropRowRef[];
  /** The row being dragged. */
  held: DropRowRef;
  /** True when the drag started in the destination section. */
  sameSection: boolean;
  /** Position among `destRows` the row was dropped at. */
  targetIndex: number;
}): DropPlan | null {
  if (held.pinned) return null;

  const strip = (r: DropRowRef) => ({ type: r.type, id: r.id });
  // No clamping needed: splice already treats an index past the end as
  // "append" and a negative one as an offset from the end, which is exactly
  // what a drop on the empty space below the rows should mean.
  const index = targetIndex;

  if (sameSection) {
    const from = destRows.findIndex(r => r.type === held.type && r.id === held.id);
    if (from < 0) return null;
    const next = [...destRows];
    const [moved] = next.splice(from, 1);
    // Insert at the raw drop index, WITHOUT compensating for the removal — this
    // is the behaviour the editor has always had, and it is the one that feels
    // right: dragging a row onto the last row lands it last, rather than one
    // short of it. Deliberately not "fixed".
    next.splice(index, 0, moved);
    // A drag that ended where it started produces the order it started with —
    // this is the single check for that, covering both an exact same-slot drop
    // and an out-of-range one that lands back in place. Don't spend a request.
    if (next.every((r, i) => r.type === destRows[i].type && r.id === destRows[i].id)) return null;
    return { move: false, order: next.map(strip) };
  }

  // Cross-section: the row is not in destRows yet, so it is spliced in at the
  // drop index and the caller moves it before writing this order.
  const next = [...destRows];
  next.splice(index, 0, held);
  return { move: true, order: next.map(strip) };
}
