export interface AgentAccessConfig {
  isDraft: boolean;
}

export const canTestAgent = (
  config: AgentAccessConfig | null | undefined
): boolean => {
  return Boolean(config && !config.isDraft);
};
