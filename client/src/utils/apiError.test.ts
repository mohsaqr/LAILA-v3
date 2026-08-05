import { describe, it, expect } from 'vitest';
import { apiErrorMessage, humanizeField } from './apiError';

describe('humanizeField', () => {
  it('turns a camelCase schema key into a readable label', () => {
    expect(humanizeField('knowledgeContext')).toBe('Knowledge context');
    expect(humanizeField('agentName')).toBe('Agent name');
    expect(humanizeField('personaDescription')).toBe('Persona description');
  });

  it('keeps a single lowercase word intact', () => {
    expect(humanizeField('email')).toBe('Email');
  });

  it('uses the last segment of a nested path', () => {
    expect(humanizeField('config.selectedPromptBlocks')).toBe('Selected prompt blocks');
  });

  it('handles snake_case and kebab-case', () => {
    expect(humanizeField('due_date')).toBe('Due date');
    expect(humanizeField('grace-period')).toBe('Grace period');
  });

  it('returns an empty string for an empty field', () => {
    expect(humanizeField('')).toBe('');
  });
});

describe('apiErrorMessage', () => {
  // This is the exact shape api/client.ts produces for a 422: a plain Error
  // with `details`, and NO `response` property.
  const zodRejection = () => {
    const err = new Error('Validation error') as Error & { details?: unknown };
    err.details = [
      { field: 'knowledgeContext', message: 'String must contain at most 2000 character(s)' },
    ];
    return err;
  };

  it('prefers the first field-level detail over the generic message', () => {
    expect(apiErrorMessage(zodRejection(), 'Failed to save agent')).toBe(
      'Knowledge context: String must contain at most 2000 character(s)'
    );
  });

  it('falls back to the error message when there are no details', () => {
    const err = new Error('Cannot update a submitted agent. Unsubmit first.');
    expect(apiErrorMessage(err, 'Failed to save agent')).toBe(
      'Cannot update a submitted agent. Unsubmit first.'
    );
  });

  it('uses the supplied fallback when the error carries nothing usable', () => {
    expect(apiErrorMessage(new Error(''), 'Failed to save agent')).toBe('Failed to save agent');
    expect(apiErrorMessage(null, 'Failed to save agent')).toBe('Failed to save agent');
    expect(apiErrorMessage(undefined, 'Failed to save agent')).toBe('Failed to save agent');
    expect(apiErrorMessage({}, 'Failed to save agent')).toBe('Failed to save agent');
  });

  it('ignores a details array that holds nothing usable', () => {
    const err = new Error('Validation error') as Error & { details?: unknown };
    err.details = [];
    expect(apiErrorMessage(err, 'Failed to save agent')).toBe('Validation error');

    err.details = [{ field: 'x' }];
    expect(apiErrorMessage(err, 'Failed to save agent')).toBe('Validation error');
  });

  it('shows a detail with no field name on its own', () => {
    const err = new Error('Validation error') as Error & { details?: unknown };
    err.details = [{ field: '', message: 'Request body is required' }];
    expect(apiErrorMessage(err, 'Failed to save agent')).toBe('Request body is required');
  });

  it('does NOT read err.response — the interceptor never sets it', () => {
    // Guards the actual regression: handlers used to read
    // `err.response?.data?.error`, which is always undefined here.
    const err = new Error('Validation error') as Error & { details?: unknown };
    err.details = [{ field: 'agentName', message: 'Agent name is required' }];
    expect((err as any).response).toBeUndefined();
    expect(apiErrorMessage(err, 'fallback')).toBe('Agent name: Agent name is required');
  });
});
