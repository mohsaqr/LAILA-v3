/**
 * Field limits for the student agent builder.
 *
 * These MUST mirror `createAgentConfigSchema` in
 * `server/src/utils/validation.ts`. The server is the authority; this copy
 * exists so the builder can stop a student *before* the round-trip, with a
 * message naming the field, instead of taking a 422 whose only visible effect
 * used to be a generic "Failed to save agent." toast.
 *
 * If you change a cap on the server, change it here too. The numbers are
 * pinned against the schema in `server/src/utils/agentConfigLimits.test.ts`,
 * which fails if the two drift apart.
 */
export const AGENT_CONFIG_LIMITS = {
  agentName: 100,
  agentTitle: 100,
  personaDescription: 500,
  welcomeMessage: 500,
  personalityPrompt: 2000,
  knowledgeContext: 2000,
  /** systemPrompt has no upper bound on the server, only a floor. */
  systemPromptMin: 10,
} as const;

export type AgentConfigLimitedField = Exclude<
  keyof typeof AGENT_CONFIG_LIMITS,
  'systemPromptMin'
>;
