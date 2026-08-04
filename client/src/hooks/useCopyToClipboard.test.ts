import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from './useCopyToClipboard';

const stubClipboard = (impl: () => Promise<void>) => {
  const writeText = vi.fn(impl);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
};

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the text and reports success', async () => {
    const writeText = stubClipboard(() => Promise.resolve());
    const { result } = renderHook(() => useCopyToClipboard());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy('mean(x)');
    });

    expect(writeText).toHaveBeenCalledWith('mean(x)');
    expect(ok).toBe(true);
    expect(result.current.copied).toBe(true);
  });

  it('clears the copied flag after the reset delay', async () => {
    stubClipboard(() => Promise.resolve());
    const { result } = renderHook(() => useCopyToClipboard(1500));

    await act(async () => {
      await result.current.copy('x');
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.copied).toBe(false);
  });

  it('honours a custom reset delay', async () => {
    stubClipboard(() => Promise.resolve());
    const { result } = renderHook(() => useCopyToClipboard(5000));

    await act(async () => {
      await result.current.copy('x');
    });
    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(result.current.copied).toBe(true);
  });

  it('reports failure without throwing when the clipboard is blocked', async () => {
    stubClipboard(() => Promise.reject(new Error('NotAllowedError')));
    const { result } = renderHook(() => useCopyToClipboard());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy('x');
    });

    // A permission-gated clipboard must not surface as an error to the student.
    expect(ok).toBe(false);
    expect(result.current.copied).toBe(false);
  });

  it('restarts the window on a second copy rather than expiring early', async () => {
    stubClipboard(() => Promise.resolve());
    const { result } = renderHook(() => useCopyToClipboard(1500));

    await act(async () => {
      await result.current.copy('a');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      await result.current.copy('b');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.copied).toBe(true);
  });

  it('clears its pending timer on unmount', async () => {
    stubClipboard(() => Promise.resolve());
    // React 18 dropped the "setState on an unmounted component" warning, so a
    // leaked timer is silent. Assert the cleanup directly instead: the exact
    // timer the hook created must be the one it clears.
    const setSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { result, unmount } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy('x');
    });

    const results = setSpy.mock.results;
    const timerId = results[results.length - 1].value;
    unmount();

    expect(clearSpy).toHaveBeenCalledWith(timerId);
    setSpy.mockRestore();
    clearSpy.mockRestore();
  });

  it('keeps copy referentially stable so it cannot defeat a memo', async () => {
    stubClipboard(() => Promise.resolve());
    const { result, rerender } = renderHook(() => useCopyToClipboard());
    const first = result.current.copy;

    await act(async () => {
      await result.current.copy('x');
    });
    rerender();

    expect(result.current.copy).toBe(first);
  });
});
