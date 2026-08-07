import { useEffect, RefObject } from 'react';

/**
 * Close a popover when the user clicks away from it or presses Escape.
 *
 * A dropdown whose only way out is a second click on its own trigger reads as
 * stuck: every other menu on the web dismisses when you click elsewhere, so
 * people click elsewhere, nothing happens, and the menu appears frozen. That
 * was the Navbar's account menu — reported for real.
 *
 * `mousedown` rather than `click`, matching RowMenu: it fires before focus
 * moves, so the menu is already gone by the time a click lands on whatever is
 * underneath, and a press that starts inside the menu and drifts outside (a
 * text selection) does not count as leaving.
 *
 * Escape is not decoration — for a keyboard user it is the only dismissal that
 * does not require finding and re-activating the trigger.
 *
 * @param ref     wraps BOTH the trigger and the panel, so clicking the trigger
 *                to toggle is not also seen as an outside click. Two refs would
 *                make the trigger close-then-reopen in the same gesture.
 * @param open    skip binding listeners while closed
 * @param onClose called on an outside mousedown or on Escape
 */
export const useDismissable = (
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): void => {
  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && ref.current && !ref.current.contains(target)) onClose();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, open, onClose]);
};
