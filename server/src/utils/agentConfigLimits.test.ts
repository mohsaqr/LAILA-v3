import { describe, it, expect } from 'vitest';
import { createAgentConfigSchema } from './validation.js';

/**
 * The student agent builder mirrors these caps in
 * `client/src/components/agent-assignment/agentConfigLimits.ts` so it can stop
 * a student before the round-trip and name the offending field. A silent
 * change here becomes an unexplained "Failed to save agent" in the browser,
 * so pin the numbers: if you change a cap, change the client constant too.
 */
const CLIENT_LIMITS = {
  agentName: 100,
  agentTitle: 100,
  personaDescription: 500,
  welcomeMessage: 500,
  personalityPrompt: 2000,
  knowledgeContext: 2000,
  systemPromptMin: 10,
};

const accepts = (field: string, value: unknown) =>
  createAgentConfigSchema.safeParse({
    agentName: 'A',
    systemPrompt: 'a valid system prompt',
    [field]: value,
  }).success;

describe('agent config caps stay in step with the client', () => {
  const lengthCapped = [
    'agentName',
    'agentTitle',
    'personaDescription',
    'welcomeMessage',
    'personalityPrompt',
    'knowledgeContext',
  ] as const;

  it.each(lengthCapped)('%s accepts exactly the documented cap and rejects one more', (field) => {
    const cap = CLIENT_LIMITS[field];
    expect(accepts(field, 'x'.repeat(cap))).toBe(true);
    expect(accepts(field, 'x'.repeat(cap + 1))).toBe(false);
  });

  it('systemPrompt rejects below the documented floor', () => {
    expect(accepts('systemPrompt', 'x'.repeat(CLIENT_LIMITS.systemPromptMin))).toBe(true);
    expect(accepts('systemPrompt', 'x'.repeat(CLIENT_LIMITS.systemPromptMin - 1))).toBe(false);
  });

  it('systemPrompt has no upper bound, so a block-built prompt cannot outgrow it', () => {
    expect(accepts('systemPrompt', 'x'.repeat(50_000))).toBe(true);
  });
});
