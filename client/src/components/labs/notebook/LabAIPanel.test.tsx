import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LabAIPanel, AICellContext, AIIntent } from './LabAIPanel';

// jsdom has no layout engine, so scrollIntoView is simply absent.
Element.prototype.scrollIntoView = vi.fn();

const sendMessage = vi.fn();

vi.mock('../../../api/chat', () => ({
  chatApi: { sendMessage: (...args: unknown[]) => sendMessage(...args) },
  chatbotsApi: { getChatbotById: vi.fn().mockResolvedValue({ displayName: 'Tutor' }) },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k }),
}));

vi.mock('react-markdown', () => ({ default: ({ children }: { children: string }) => <p>{children}</p> }));

const cell = { id: 1, title: 'Step 6', prose: 'Group the events', code: '', cellType: 'code' } as never;

const context = (intent: AIIntent, over: Partial<AICellContext> = {}, requestId = 1): AICellContext => ({
  cell,
  code: 'mean(scores$grade)',
  error: null,
  output: '[1] 74.28571',
  intent,
  requestId,
  ...over,
});

const renderPanel = (ctx: AICellContext | null) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LabAIPanel labName="Lab" language="r" cellContext={ctx} isOpen onClose={() => {}} />
    </QueryClientProvider>
  );

const sentMessage = () => sendMessage.mock.calls[0][0].message as string;
const sentContext = () => sendMessage.mock.calls[0][0].context as string;

describe('LabAIPanel intents', () => {
  beforeEach(() => {
    sendMessage.mockReset();
    sendMessage.mockResolvedValue({ reply: 'Here is what that does.' });
  });

  it('answers Explain on one click, with no typing', async () => {
    renderPanel(context('explain'));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(sentMessage().toLowerCase()).toContain('explain');
  });

  it('asks about results for Interpret, not about the code', async () => {
    renderPanel(context('interpret'));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    const msg = sentMessage().toLowerCase();
    expect(msg).toContain('interpret');
    expect(msg).toMatch(/result|output|mean/);
  });

  it('asks for a diagnosis on Debug', async () => {
    renderPanel(context('debug', { error: 'object not found' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(sentMessage().toLowerCase()).toMatch(/problem|fix|not doing/);
  });

  it('sends nothing for Ask — the student writes their own question', async () => {
    renderPanel(context('ask'));
    // Give the auto-send effect a chance to fire before asserting it did not.
    await new Promise(r => setTimeout(r, 50));
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('grounds every intent in the cell code, output and error', async () => {
    renderPanel(context('debug', { error: 'object not found' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    const ctx = sentContext();
    expect(ctx).toContain('mean(scores$grade)');
    expect(ctx).toContain('[1] 74.28571');
    expect(ctx).toContain('object not found');
    expect(ctx).toContain('Step 6');
  });

  it('does not re-send the same click twice', async () => {
    const { rerender } = renderPanel(context('explain'));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    // Same requestId — a parent re-render must not fire a second call.
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <LabAIPanel labName="Lab" language="r" cellContext={context('explain')} isOpen onClose={() => {}} />
      </QueryClientProvider>
    );
    await new Promise(r => setTimeout(r, 50));
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('sends again when the same button is clicked a second time', async () => {
    const { rerender } = renderPanel(context('explain', {}, 1));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <LabAIPanel labName="Lab" language="r" cellContext={context('explain', {}, 2)} isOpen onClose={() => {}} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
  });

  it('shows the answer', async () => {
    renderPanel(context('explain'));
    await waitFor(() => expect(screen.getByText('Here is what that does.')).toBeTruthy());
  });
});
