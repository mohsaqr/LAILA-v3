/**
 * The payload an `lti` lecture section carries.
 *
 * Stored as JSON in `LectureSection.content`, the same column a text section
 * uses for HTML — the column has always been a free string, so this adds a type
 * rather than a migration.
 */
export interface LtiSectionConfig {
  toolId: string;
  /** Cached for display, so a lesson renders without fetching the tool list. */
  toolName?: string;
  height?: number;
}

/**
 * Parse a section's stored tool reference.
 *
 * @returns null when the value is missing or malformed — an authoring accident
 *   should cost that one block, not the lesson around it.
 */
export function parseLtiSection(content: string | null | undefined): LtiSectionConfig | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as Partial<LtiSectionConfig>;
    if (!parsed || typeof parsed.toolId !== 'string' || !parsed.toolId) return null;
    return {
      toolId: parsed.toolId,
      toolName: typeof parsed.toolName === 'string' ? parsed.toolName : undefined,
      height:
        typeof parsed.height === 'number' && Number.isFinite(parsed.height)
          ? Math.min(2000, Math.max(200, parsed.height))
          : undefined,
    };
  } catch {
    return null;
  }
}

export const serialiseLtiSection = (config: LtiSectionConfig): string => JSON.stringify(config);
