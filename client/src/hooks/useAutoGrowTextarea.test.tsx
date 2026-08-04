import { describe, it, expect, beforeEach } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { useAutoGrowTextarea } from './useAutoGrowTextarea';

// jsdom does not lay text out, so scrollHeight is always 0. Drive it directly:
// one "line" is 20px, matching the lineHeight set on the element below.
const LINE = 20;
const PADDING_AND_BORDER = 10;

/** How tall the text alone wants to be. Tests set this to simulate typing. */
let contentHeight = LINE + PADDING_AND_BORDER;

beforeEach(() => {
  contentHeight = LINE + PADDING_AND_BORDER;
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      // Model the real coupling rather than returning contentHeight blindly:
      // a browser's scrollHeight is never LESS than the element's own height,
      // because the box cannot scroll to reveal space it already shows. That
      // is precisely why the hook must reset height to 'auto' before
      // measuring — and a stub that ignores it makes the regression test for
      // that reset vacuous, which is what an earlier version of this file did.
      const set = parseFloat(this.style.height); // NaN while height is 'auto'
      return Number.isFinite(set) ? Math.max(contentHeight, set) : contentHeight;
    },
  });
});

const Harness = ({ maxRows = 4 }: { maxRows?: number }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  useAutoGrowTextarea(ref, value, maxRows);
  return (
    <>
      <textarea
        ref={ref}
        data-testid="composer"
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{
          lineHeight: `${LINE}px`,
          paddingTop: '4px',
          paddingBottom: '4px',
          borderTop: '1px solid',
          borderBottom: '1px solid',
        }}
      />
      <button onClick={() => setValue('x'.repeat(500))}>grow</button>
      <button onClick={() => setValue('')}>clear</button>
    </>
  );
};

const composer = () => screen.getByTestId('composer') as HTMLTextAreaElement;

describe('useAutoGrowTextarea', () => {
  it('sizes to a single line when empty', () => {
    render(<Harness />);
    expect(composer().style.height).toBe(`${LINE + PADDING_AND_BORDER}px`);
  });

  it('grows as the message gets longer', () => {
    render(<Harness />);
    const before = parseFloat(composer().style.height);

    act(() => {
      contentHeight = LINE * 3 + PADDING_AND_BORDER;
      screen.getByText('grow').click();
    });

    expect(parseFloat(composer().style.height)).toBeGreaterThan(before);
    expect(composer().style.height).toBe(`${LINE * 3 + PADDING_AND_BORDER}px`);
  });

  it('stops growing at maxRows and scrolls instead', () => {
    render(<Harness maxRows={4} />);

    act(() => {
      contentHeight = LINE * 40 + PADDING_AND_BORDER; // a very long message
      screen.getByText('grow').click();
    });

    // Capped, not unbounded — otherwise the composer swallows the conversation.
    expect(composer().style.height).toBe(`${LINE * 4 + PADDING_AND_BORDER}px`);
    expect(composer().style.overflowY).toBe('auto');
  });

  it('hides the scrollbar while the content still fits', () => {
    render(<Harness maxRows={4} />);
    expect(composer().style.overflowY).toBe('hidden');
  });

  it('shrinks back when the message is deleted', () => {
    render(<Harness />);

    act(() => {
      contentHeight = LINE * 3 + PADDING_AND_BORDER;
      screen.getByText('grow').click();
    });
    expect(composer().style.height).toBe(`${LINE * 3 + PADDING_AND_BORDER}px`);

    act(() => {
      contentHeight = LINE + PADDING_AND_BORDER;
      screen.getByText('clear').click();
    });

    // Regression guard: without resetting height to 'auto' before measuring,
    // scrollHeight never reports smaller than the current height and the box
    // grows monotonically, never recovering after a send.
    expect(composer().style.height).toBe(`${LINE + PADDING_AND_BORDER}px`);
  });

  it('does nothing when the ref is not attached', () => {
    const Detached = () => {
      const ref = useRef<HTMLTextAreaElement>(null);
      useAutoGrowTextarea(ref, 'anything');
      return <div>ok</div>;
    };
    expect(() => render(<Detached />)).not.toThrow();
  });
});
