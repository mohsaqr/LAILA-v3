/**
 * Convert legacy template-picker labs into readable notebooks.
 *
 * Labs written before the unified notebook carried their whole explanation as a
 * `#` comment block inside each cell, because the old UI showed one template at
 * a time. Stacked as notebook cells, that reads as walls of commented-out code.
 * This moves each block into the cell's `description`, which the notebook
 * already renders as the instructions above the editor.
 *
 *   # See what would change, touching nothing (default):
 *   npx tsx scripts/convert-legacy-labs.ts --lab 9
 *   npx tsx scripts/convert-legacy-labs.ts --all
 *
 *   # Write it, after taking a backup:
 *   npx tsx scripts/convert-legacy-labs.ts --lab 9 --apply
 *
 * Every run writes a timestamped JSON backup of the original rows before
 * touching anything, so a conversion can always be undone:
 *
 *   npx tsx scripts/convert-legacy-labs.ts --restore backups/legacy-labs-<ts>.json
 *
 * Safe to re-run: a cell whose code no longer holds a doc block is skipped, and
 * mergeDescription refuses to stack the same prose twice.
 */
import fs from 'fs';
import path from 'path';
import prisma from '../src/utils/prisma.js';
import { splitLegacyCell, mergeDescription } from '../src/utils/legacyLabCell.js';

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const value = (f: string): string | undefined => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const APPLY = has('--apply');
const ALL = has('--all');
const LAB_ID = value('--lab') ? parseInt(value('--lab')!, 10) : undefined;
const RESTORE = value('--restore');
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

interface Row { id: number; labId: number; description: string | null; code: string }

async function restore(file: string) {
  const rows: Row[] = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Restoring ${rows.length} cells from ${file}`);
  for (const r of rows) {
    await prisma.labTemplate.update({
      where: { id: r.id },
      data: { description: r.description, code: r.code },
    });
  }
  console.log('Restored. Nothing else was touched.');
}

async function main() {
  if (RESTORE) return restore(RESTORE);

  if (!ALL && !LAB_ID) {
    console.error('Specify --lab <id> or --all. Add --apply to write; without it this is a dry run.');
    process.exit(2);
  }

  const templates = await prisma.labTemplate.findMany({
    where: LAB_ID ? { labId: LAB_ID } : {},
    orderBy: [{ labId: 'asc' }, { orderIndex: 'asc' }],
    select: { id: true, labId: true, title: true, description: true, code: true, cellType: true },
  });

  const labNames = new Map(
    (await prisma.customLab.findMany({ select: { id: true, name: true } })).map((l) => [l.id, l.name])
  );

  const backup: Row[] = [];
  const planned: { id: number; labId: number; title: string; description: string; code: string }[] = [];
  let skipped = 0;

  for (const t of templates) {
    // Only code cells carry the legacy doc blocks; a markdown cell is already
    // prose and must not be rewritten.
    if ((t.cellType ?? 'code') !== 'code') { skipped++; continue; }

    const split = splitLegacyCell(t.code ?? '');
    if (!split.changed) { skipped++; continue; }

    const description = mergeDescription(t.description, split.prose);
    if (description === (t.description ?? '') && split.code === t.code) { skipped++; continue; }

    backup.push({ id: t.id, labId: t.labId, description: t.description, code: t.code });
    planned.push({ id: t.id, labId: t.labId, title: t.title, description, code: split.code });
  }

  const byLab = new Map<number, number>();
  planned.forEach((p) => byLab.set(p.labId, (byLab.get(p.labId) ?? 0) + 1));

  console.log(`\n${templates.length} cells examined, ${planned.length} would change, ${skipped} left alone.\n`);
  for (const [labId, n] of [...byLab.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  lab ${labId}  ${n.toString().padStart(3)} cells   ${labNames.get(labId) ?? '(unknown)'}`);
  }

  if (planned.length === 0) {
    console.log('\nNothing to do.');
    return;
  }

  // Show one full before/after so the transformation is inspectable rather
  // than taken on trust.
  const sample = planned[0];
  const before = backup[0];
  console.log(`\n─── sample: cell ${sample.id} ("${sample.title}") ───`);
  console.log('\nCODE BEFORE:\n' + (before.code ?? '').split('\n').slice(0, 12).map((l) => '  ' + l).join('\n'));
  console.log('\nCODE AFTER:\n' + sample.code.split('\n').slice(0, 12).map((l) => '  ' + l).join('\n'));
  console.log('\nDESCRIPTION AFTER:\n' + sample.description.split('\n').slice(0, 12).map((l) => '  ' + l).join('\n'));

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to commit these changes.');
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `legacy-labs-${stamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`\nBackup of ${backup.length} original cells: ${backupFile}`);

  for (const p of planned) {
    await prisma.labTemplate.update({
      where: { id: p.id },
      data: { description: p.description, code: p.code },
    });
  }

  console.log(`Converted ${planned.length} cells.`);
  console.log(`To undo:  npx tsx scripts/convert-legacy-labs.ts --restore ${backupFile}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
