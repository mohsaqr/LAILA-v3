import { describe, it, expect } from 'vitest';
import {
  EXPORT_SECTIONS,
  DESIGN_SECTIONS,
  PERSONAL_DATA_SECTIONS,
  parseSelection,
  includesPersonalData,
  personalDataIn,
  describeSelection,
  exportSelectionSchema,
  type ExportSection,
} from './coursePackage.selection.js';

describe('section catalogue', () => {
  it('splits cleanly into authored and personal, with no overlap or gap', () => {
    const personal = new Set<ExportSection>(PERSONAL_DATA_SECTIONS);
    const design = new Set<ExportSection>(DESIGN_SECTIONS);
    // Every section is on exactly one side of the line.
    EXPORT_SECTIONS.forEach((s) => {
      expect(personal.has(s) !== design.has(s), `"${s}" must be personal XOR design`).toBe(true);
    });
    expect(personal.size + design.size).toBe(EXPORT_SECTIONS.length);
  });

  it('has no duplicates', () => {
    expect(new Set(EXPORT_SECTIONS).size).toBe(EXPORT_SECTIONS.length);
  });

  it('keeps design-only as the pre-existing behaviour', () => {
    expect(includesPersonalData(DESIGN_SECTIONS)).toBe(false);
  });
});

describe('parseSelection', () => {
  // The compatibility promise: every caller and link that predates selections
  // keeps getting exactly what it got before.
  it('defaults to design-only when nothing is asked for', () => {
    expect(parseSelection(undefined)).toEqual([...DESIGN_SECTIONS]);
    expect(parseSelection(null)).toEqual([...DESIGN_SECTIONS]);
    expect(parseSelection('')).toEqual([...DESIGN_SECTIONS]);
    expect(parseSelection([])).toEqual([...DESIGN_SECTIONS]);
  });

  it('reads a comma-separated list', () => {
    expect(parseSelection('design,grades')).toEqual(['design', 'grades']);
  });

  it('reads a repeated query parameter', () => {
    expect(parseSelection(['design', 'grades'])).toEqual(['design', 'grades']);
  });

  it('tolerates whitespace and empty items', () => {
    expect(parseSelection(' design , grades ,, ')).toEqual(['design', 'grades']);
  });

  it('expands "all"', () => {
    expect(parseSelection('all')).toEqual([...EXPORT_SECTIONS]);
  });

  it('rejects an unknown section rather than silently dropping it', () => {
    expect(() => parseSelection('design,passwords')).toThrow();
  });

  it('deduplicates', () => {
    expect(parseSelection('grades,grades,design')).toEqual(['design', 'grades']);
  });

  // A package of submissions with no idea what was submitted to is unusable.
  it('always includes design', () => {
    expect(parseSelection('grades')).toContain('design');
    expect(exportSelectionSchema.parse(['activity'])).toContain('design');
  });

  // Attachments live in `files`; promising submissions without them imports as
  // a wall of broken links.
  it('pulls in files when submissions or discussions are selected', () => {
    expect(parseSelection('submissions')).toContain('files');
    expect(parseSelection('discussions')).toContain('files');
    expect(parseSelection('grades')).not.toContain('files');
  });

  it('returns sections in canonical order whatever the input order', () => {
    const a = parseSelection('activity,design,grades');
    const b = parseSelection('grades,activity,design');
    expect(a).toEqual(b);
    // Canonical order is the catalogue's order.
    const idx = a.map((s) => EXPORT_SECTIONS.indexOf(s));
    expect(idx).toEqual([...idx].sort((x, y) => x - y));
  });
});

describe('personal data reporting', () => {
  it('detects a selection that discloses other people', () => {
    expect(includesPersonalData(parseSelection('design,labs'))).toBe(false);
    expect(includesPersonalData(parseSelection('design,submissions'))).toBe(true);
  });

  it('lists exactly the personal sections, for the confirmation prompt', () => {
    expect(personalDataIn(parseSelection('design,grades,activity,labs'))).toEqual([
      'grades',
      'activity',
    ]);
  });

  it('describes a selection in one line', () => {
    expect(describeSelection(parseSelection('design,labs'))).toMatch(/design only/);
    expect(describeSelection(parseSelection('design,grades'))).toMatch(
      /including personal data: grades/,
    );
  });
});
