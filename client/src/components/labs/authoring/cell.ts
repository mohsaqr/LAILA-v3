import { LabTemplate, CodeBlock } from '../../../types';

/**
 * The shape both lab systems agree on.
 *
 * CustomLab stores cells as LabTemplate (description/code); CodeLab stores them
 * as CodeBlock (instructions/starterCode). They are different tables with
 * different column names for the same three ideas — prose, code, order — so the
 * editor speaks this shape and each system adapts at its edge. That keeps one
 * editor serving both without merging the models or the runtimes.
 */
export interface LabCell {
  id: number;
  title: string;
  prose: string;
  code: string;
  orderIndex: number;
  locked: boolean;
  /** "code" runs in the lab runtime; "markdown" is prose-only content. */
  cellType: 'code' | 'markdown';
  /**
   * A student's throwaway copy, held in the notebook's own state and never sent
   * anywhere. Set explicitly rather than inferred from the negative id these
   * cells carry: the id is an allocation detail, this is the meaning.
   */
  isScratch?: boolean;
}

/** Fields an editor can change, in LabCell terms. */
export interface LabCellPatch {
  title?: string;
  prose?: string;
  code?: string;
  locked?: boolean;
}

export const templateToCell = (t: LabTemplate): LabCell => ({
  id: t.id,
  title: t.title,
  prose: t.description ?? '',
  code: t.code ?? '',
  orderIndex: t.orderIndex,
  locked: t.locked ?? false,
  cellType: t.cellType ?? 'code',
});

export const cellPatchToTemplate = (patch: LabCellPatch) => ({
  ...(patch.title !== undefined && { title: patch.title }),
  ...(patch.prose !== undefined && { description: patch.prose }),
  ...(patch.code !== undefined && { code: patch.code }),
  ...(patch.locked !== undefined && { locked: patch.locked }),
});

export const blockToCell = (b: CodeBlock): LabCell => ({
  id: b.id,
  title: b.title,
  prose: b.instructions ?? '',
  code: b.starterCode ?? '',
  orderIndex: b.orderIndex,
  locked: b.locked ?? false,
  cellType: b.cellType ?? 'code',
});

export const cellPatchToBlock = (patch: LabCellPatch) => ({
  ...(patch.title !== undefined && { title: patch.title }),
  ...(patch.prose !== undefined && { instructions: patch.prose }),
  ...(patch.code !== undefined && { starterCode: patch.code }),
  ...(patch.locked !== undefined && { locked: patch.locked }),
});
