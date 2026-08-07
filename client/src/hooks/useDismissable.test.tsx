import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDismissable } from './useDismissable';

/**
 * A trigger and a panel inside one wrapper, which is the arrangement the hook
 * is documented to need — the ref must cover both or toggling closes and
 * reopens in the same gesture.
 */
const Menu = ({ onClose }: { onClose?: () => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useDismissable(ref, open, () => {
    setOpen(false);
    onClose?.();
  });

  return (
    <div>
      <button data-testid="outside">outside</button>
      <div ref={ref}>
        <button data-testid="trigger" onClick={() => setOpen(v => !v)}>
          trigger
        </button>
        {open && <div data-testid="panel">panel</div>}
      </div>
    </div>
  );
};

const panel = () => screen.queryByTestId('panel');

describe('useDismissable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('leaves the panel alone until something closes it', () => {
    render(<Menu />);
    fireEvent.click(screen.getByTestId('trigger'));
    expect(panel()).toBeInTheDocument();
  });

  it('closes on a mousedown outside', () => {
    render(<Menu />);
    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(panel()).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    // The only dismissal a keyboard user gets without hunting for the trigger.
    render(<Menu />);
    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel()).not.toBeInTheDocument();
  });

  it('ignores other keys', () => {
    render(<Menu />);
    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.keyDown(document, { key: 'a' });
    expect(panel()).toBeInTheDocument();
  });

  it('stays open when the mousedown lands inside the panel', () => {
    render(<Menu />);
    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.mouseDown(screen.getByTestId('panel'));
    expect(panel()).toBeInTheDocument();
  });

  it('lets the trigger toggle shut rather than closing and reopening', () => {
    // The ref wraps the trigger too, so a click on it is not "outside". If it
    // were, this click would close the menu and the toggle would reopen it,
    // leaving the panel up and the menu feeling stuck.
    render(<Menu />);
    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.mouseDown(screen.getByTestId('trigger'));
    fireEvent.click(screen.getByTestId('trigger'));
    expect(panel()).not.toBeInTheDocument();
  });

  it('binds nothing while closed', () => {
    const onClose = vi.fn();
    render(<Menu onClose={onClose} />);
    fireEvent.mouseDown(screen.getByTestId('outside'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('unbinds after closing, so a later click costs nothing', () => {
    const onClose = vi.fn();
    render(<Menu onClose={onClose} />);
    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(screen.getByTestId('outside'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
