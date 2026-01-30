import { useEffect, useRef, useCallback } from 'react';

export const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!firstElement) return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      // Store the currently focused element
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Add keydown listener for Tab trapping
      document.addEventListener('keydown', handleKeyDown);

      // Focus the first focusable element in the container
      const focusableElements = containerRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements && focusableElements.length > 0) {
        // Try to focus the close button or first focusable element
        const closeButton = containerRef.current?.querySelector<HTMLElement>('[aria-label="Close"]');
        (closeButton || focusableElements[0])?.focus();
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        // Restore focus to the previously focused element
        previousFocusRef.current?.focus();
      };
    }
  }, [isActive, handleKeyDown]);

  return containerRef;
};
