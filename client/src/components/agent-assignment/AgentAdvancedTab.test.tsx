import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgentAdvancedTab } from './AgentAdvancedTab';
import { AgentConfigFormData } from '../../types';

// The database catalogue. The static catalogue in config/promptBlocks.ts is
// merged in by the hook; these `db_`-prefixed rows are enough to prove the
// resolution path, and they are the ones a fresh page load has to fetch.
//
// Declared inside the factory: vi.mock is hoisted above every const in the
// file, so referencing an outer binding here throws at import time.
vi.mock('../../api/promptBlocks', () => ({
  promptBlocksApi: {
    getBlocksWithCategories: vi.fn().mockResolvedValue({
      categories: [
        { slug: 'persona', name: 'Persona' },
        { slug: 'tone', name: 'Tone' },
        { slug: 'constraint', name: 'Constraints' },
      ],
      blocks: [
        { id: 1, category: 'persona', label: 'Patient tutor', promptText: 'You are a patient tutor.', description: '', popular: true },
        { id: 2, category: 'tone', label: 'Warm', promptText: 'Speak warmly.', description: '', popular: false },
        { id: 3, category: 'constraint', label: 'No answers', promptText: 'Never give the final answer.', description: '', popular: false },
      ],
    }),
  },
}));

const baseForm = (over: Partial<AgentConfigFormData> = {}): AgentConfigFormData => ({
  agentName: 'Bio Buddy',
  agentTitle: '',
  personaDescription: '',
  systemPrompt: '',
  dosRules: [],
  dontsRules: [],
  welcomeMessage: '',
  avatarImageUrl: null,
  pedagogicalRole: null,
  personality: 'friendly',
  personalityPrompt: '',
  responseStyle: 'balanced',
  temperature: 0.7,
  suggestedQuestions: [],
  knowledgeContext: '',
  selectedPromptBlocks: [],
  ...over,
});

const renderTab = (formData: AgentConfigFormData, errors: Record<string, string> = {}) => {
  const onChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AgentAdvancedTab formData={formData} errors={errors} onChange={onChange} />
    </QueryClientProvider>
  );
  return onChange;
};

/** The value the component last wrote to a given form field. */
const lastWrite = (onChange: ReturnType<typeof vi.fn>, field: string) => {
  const calls = onChange.mock.calls.filter((c) => c[0] === field);
  return calls.length ? calls[calls.length - 1][1] : undefined;
};

// What the two db blocks generate together, in category order.
const BOTH_BLOCKS = 'You are a patient tutor.\n\nSpeak warmly.';

describe('AgentAdvancedTab — prompt blocks loaded from a saved config', () => {
  beforeEach(() => vi.clearAllMocks());

  it('regenerates the prompt from ALL blocks when one is removed after a reload', async () => {
    // The config came back from the server: two blocks selected, and a system
    // prompt that matches them. Nothing was clicked in this session.
    const onChange = renderTab(
      baseForm({ selectedPromptBlocks: ['db_1', 'db_2', 'db_3'], systemPrompt:
        'You are a patient tutor.\n\nSpeak warmly.\n\n\nImportant guidelines:\n- Never give the final answer.' })
    );

    await screen.findAllByText('Patient tutor');
    fireEvent.click(screen.getAllByTitle('Remove block')[2]);

    await waitFor(() => expect(lastWrite(onChange, 'selectedPromptBlocks')).toEqual(['db_1', 'db_2']));

    // The regression: with a session-only block map this resolved to nothing,
    // so the constraint sentence stayed in the saved prompt forever.
    expect(lastWrite(onChange, 'systemPrompt')).toBe(BOTH_BLOCKS);
    expect(lastWrite(onChange, 'systemPrompt')).not.toContain('Never give the final answer');
  });

  it('appends to the prompt when a block is added after a reload', async () => {
    const onChange = renderTab(
      baseForm({ selectedPromptBlocks: ['db_1'], systemPrompt: 'You are a patient tutor.' })
    );

    await screen.findAllByText('Patient tutor');
    fireEvent.click(screen.getByRole('button', { name: /Tone/i }));
    fireEvent.click(await screen.findByText('Warm'));

    await waitFor(() => expect(lastWrite(onChange, 'selectedPromptBlocks')).toEqual(['db_1', 'db_2']));

    // The regression: this used to overwrite the whole prompt with just the
    // newly clicked block, discarding every previously selected one.
    expect(lastWrite(onChange, 'systemPrompt')).toBe(BOTH_BLOCKS);
    expect(lastWrite(onChange, 'systemPrompt')).toContain('You are a patient tutor.');
  });

  it('never overwrites a system prompt the student wrote by hand', async () => {
    const onChange = renderTab(
      baseForm({
        selectedPromptBlocks: ['db_1', 'db_2'],
        systemPrompt: 'You are Bio Buddy and you only ever answer with a question.',
      })
    );

    await screen.findAllByText('Patient tutor');
    fireEvent.click(screen.getAllByTitle('Remove block')[1]);

    await waitFor(() => expect(lastWrite(onChange, 'selectedPromptBlocks')).toEqual(['db_1']));
    expect(lastWrite(onChange, 'systemPrompt')).toBeUndefined();
  });
});

describe('AgentAdvancedTab — knowledge context length', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the count against the server cap', async () => {
    renderTab(baseForm({ knowledgeContext: 'x'.repeat(120) }));
    expect(await screen.findByText('120 / 2000')).toBeInTheDocument();
  });

  it('does not truncate a paste past the cap — it lets the count go red', async () => {
    renderTab(baseForm({ knowledgeContext: 'x'.repeat(2400) }));
    const counter = await screen.findByText('2400 / 2000');
    expect(counter.className).toContain('text-red-500');
  });

  it('renders the validation error next to the field', async () => {
    renderTab(baseForm({ knowledgeContext: 'x'.repeat(2400) }), {
      knowledgeContext: 'Must be 2000 characters or fewer',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Must be 2000 characters or fewer');
  });
});
