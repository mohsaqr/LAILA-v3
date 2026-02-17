/**
 * Fix light/washed-out colors from tnaj's default palette.
 * Replaces #ffff99 (pale yellow) with a darker amber.
 */
const COLOR_OVERRIDES: Record<string, string> = {
  '#ffff99': '#d4a017',
};

export function fixColorMap(map: Record<string, string>): Record<string, string> {
  const fixed: Record<string, string> = {};
  for (const [key, color] of Object.entries(map)) {
    fixed[key] = COLOR_OVERRIDES[color.toLowerCase()] ?? color;
  }
  return fixed;
}
