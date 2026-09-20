import { describe, it, expect } from 'vitest';
import { parseLtiSection, serialiseLtiSection } from './section';

describe('parseLtiSection', () => {
  it('round-trips a config', () => {
    const cfg = { toolId: 'tool1', toolName: 'Example', height: 700 };
    expect(parseLtiSection(serialiseLtiSection(cfg))).toEqual(cfg);
  });

  // An authoring accident should cost that one block, not the lesson.
  it.each([null, undefined, '', '{not json', '"a string"', '{}', '{"toolId":""}', '[]'])(
    'returns null for %s rather than throwing',
    (content) => {
      expect(parseLtiSection(content as string | null)).toBeNull();
    },
  );

  it('clamps an absurd height instead of rendering it', () => {
    expect(parseLtiSection('{"toolId":"t","height":99999}')?.height).toBe(2000);
    expect(parseLtiSection('{"toolId":"t","height":-5}')?.height).toBe(200);
    expect(parseLtiSection('{"toolId":"t","height":"tall"}')?.height).toBeUndefined();
  });

  it('tolerates a missing tool name', () => {
    expect(parseLtiSection('{"toolId":"t"}')).toEqual({
      toolId: 't', toolName: undefined, height: undefined,
    });
  });
});
