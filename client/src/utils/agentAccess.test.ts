import { describe, it, expect } from 'vitest';
import { canTestAgent } from './agentAccess';

describe('canTestAgent', () => {
  it('returns false when config is null', () => {
    expect(canTestAgent(null)).toBe(false);
  });

  it('returns false when config is undefined', () => {
    expect(canTestAgent(undefined)).toBe(false);
  });

  it('returns false when the agent config is still a draft', () => {
    expect(canTestAgent({ isDraft: true })).toBe(false);
  });

  it('returns true when the agent config has been submitted', () => {
    expect(canTestAgent({ isDraft: false })).toBe(true);
  });
});
