import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Labels moved from hardcoded English to t(); the mock returns each key's
// defaultValue, so every assertion below reads the same text a user sees.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: Record<string, unknown>) => {
      const dv = (opts?.defaultValue as string) ?? _key;
      return dv.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(opts?.[name] ?? ''));
    },
  }),
}));

import { CodeOutput, outputsToMarkdown } from './CodeOutput';

const PLOT = { type: 'plot' as const, content: 'iVBORw0KGgoAAAANS' };
const TEXT = { type: 'stdout' as const, content: '[1] 74.28571' };

const openInspector = () => fireEvent.click(screen.getByLabelText('Inspect output full screen'));
const dialog = () => screen.getByRole('dialog');

describe('CodeOutput inspector', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('offers an inspect control once there is output', () => {
    render(<CodeOutput outputs={[TEXT]} />);
    expect(screen.getByLabelText('Inspect output full screen')).toBeTruthy();
  });

  it('has nothing to inspect before a run', () => {
    render(<CodeOutput outputs={[]} />);
    expect(screen.queryByLabelText('Inspect output full screen')).toBeNull();
  });

  it('opens a modal dialog, not just a bigger div', () => {
    render(<CodeOutput outputs={[PLOT]} />);
    openInspector();
    expect(dialog().getAttribute('aria-modal')).toBe('true');
  });

  it('locks background scroll while open and restores it on close', () => {
    render(<CodeOutput outputs={[PLOT]} />);
    openInspector();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByLabelText('Close full screen'));
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('closes on Escape', () => {
    render(<CodeOutput outputs={[PLOT]} />);
    openInspector();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('starts fitted, then zooms in discrete steps', () => {
    render(<CodeOutput outputs={[PLOT]} />);
    openInspector();
    const d = dialog();

    expect(within(d).getByText('Fit')).toBeTruthy();
    fireEvent.click(within(d).getByLabelText('Zoom in'));
    // First step away from fit lands on 150%, i.e. one stop above 100%.
    expect(within(d).getByText('150%')).toBeTruthy();
    fireEvent.click(within(d).getByLabelText('Zoom out'));
    expect(within(d).getByText('100%')).toBeTruthy();
  });

  it('returns to fit from any zoom level', () => {
    render(<CodeOutput outputs={[PLOT]} />);
    openInspector();
    const d = dialog();
    fireEvent.click(within(d).getByLabelText('Zoom in'));
    fireEvent.click(within(d).getByLabelText('Fit to screen'));
    expect(within(d).getByText('Fit')).toBeTruthy();
  });

  it('supports +/-/0 keys, so a dense plot can be read without the mouse', () => {
    render(<CodeOutput outputs={[PLOT]} />);
    openInspector();
    fireEvent.keyDown(window, { key: '+' });
    expect(within(dialog()).getByText('150%')).toBeTruthy();
    fireEvent.keyDown(window, { key: '0' });
    expect(within(dialog()).getByText('Fit')).toBeTruthy();
  });

  it('widens the image when zoomed so the container can pan', () => {
    render(<CodeOutput outputs={[PLOT]} />);
    openInspector();
    const d = dialog();
    fireEvent.click(within(d).getByLabelText('Zoom in'));

    // A CSS transform would scale the pixels without growing the scroll area.
    const img = within(d).getByAltText('Plot 1') as HTMLImageElement;
    expect(img.style.width).toBe('150%');
    expect(img.style.maxWidth).toBe('none');
  });

  it('lets a plot be downloaded as a file', () => {
    render(<CodeOutput outputs={[PLOT]} />);
    openInspector();
    const link = within(dialog()).getByLabelText('Download plot 1') as HTMLAnchorElement;
    expect(link.getAttribute('download')).toBe('plot-1.png');
    expect(link.getAttribute('href')).toContain('data:image/png;base64,');
  });

  it('hides zoom controls when the output is text only', () => {
    render(<CodeOutput outputs={[TEXT]} />);
    openInspector();
    expect(within(dialog()).queryByLabelText('Zoom in')).toBeNull();
  });

  it('copies text output to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CodeOutput outputs={[TEXT]} error="Error: object not found" />);
    openInspector();
    fireEvent.click(within(dialog()).getByLabelText('Copy text output to clipboard'));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('[1] 74.28571'));
    expect(writeText.mock.calls[0][0]).toContain('Error: object not found');
  });

  it('does not offer to copy an image as text', () => {
    render(<CodeOutput outputs={[PLOT]} />);
    openInspector();
    expect(within(dialog()).queryByLabelText('Copy text output to clipboard')).toBeNull();
  });

  it('announces run status to screen readers, not by colour alone', () => {
    const { rerender } = render(<CodeOutput outputs={[TEXT]} />);
    expect(screen.getByText('Run succeeded')).toBeTruthy();
    rerender(<CodeOutput outputs={[TEXT]} error="boom" />);
    expect(screen.getByText('Run failed')).toBeTruthy();
  });
});

describe('CodeOutput export', () => {
  it('offers copy and markdown export inline, without opening the modal', () => {
    render(<CodeOutput outputs={[TEXT]} />);
    expect(screen.getByLabelText('Copy output text')).toBeTruthy();
    expect(screen.getByLabelText('Export output as Markdown')).toBeTruthy();
  });

  it('does not offer inline copy when the only output is a plot', () => {
    render(<CodeOutput outputs={[PLOT]} />);
    expect(screen.queryByLabelText('Copy output text')).toBeNull();
    expect(screen.getByLabelText('Export output as Markdown')).toBeTruthy();
  });
});

describe('CodeOutput copy feedback', () => {
  it('ticks both copy buttons from one copy, as it always has', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<CodeOutput outputs={[TEXT]} />);

    // Header and overlay share one `copied` flag. Adopting the shared hook kept
    // a single instance precisely so this stays true.
    fireEvent.click(screen.getByLabelText('Copy output text'));
    await screen.findByText('Copied');

    openInspector();
    expect(within(dialog()).getByText('Copied')).toBeTruthy();
  });
});

describe('outputsToMarkdown', () => {
  it('fences console text', () => {
    expect(outputsToMarkdown([TEXT])).toContain('```\n[1] 74.28571\n```');
  });

  it('embeds plots as data URIs so the file stands alone', () => {
    const md = outputsToMarkdown([PLOT]);
    expect(md).toContain('![Plot 1](data:image/png;base64,');
  });

  it('numbers plots by plot, not by output index', () => {
    const md = outputsToMarkdown([TEXT, PLOT, TEXT, PLOT]);
    expect(md).toContain('![Plot 1]');
    expect(md).toContain('![Plot 2]');
    expect(md).not.toContain('![Plot 3]');
  });

  it('carries the code that produced the result, tagged with its language', () => {
    const md = outputsToMarkdown([TEXT], { code: 'mean(x)', language: 'python' });
    expect(md).toContain('```python\nmean(x)\n```');
  });

  it('titles the document when the cell has a name', () => {
    expect(outputsToMarkdown([TEXT], { title: 'Step 6' })).toContain('## Step 6');
  });

  it('includes an error that has no stderr item of its own', () => {
    expect(outputsToMarkdown([TEXT], { error: 'object not found' }))
      .toContain('> **Error:** object not found');
  });

  it('does not duplicate an error already present as stderr', () => {
    const md = outputsToMarkdown([{ type: 'stderr', content: 'boom' }], { error: 'boom' });
    expect(md.match(/boom/g)).toHaveLength(1);
  });

  it('skips whitespace-only output instead of emitting an empty fence', () => {
    expect(outputsToMarkdown([{ type: 'stdout', content: '   \n  ' }]).trim()).toBe('');
  });
});
