/**
 * TrackedContent — wraps rendered HTML/markdown content and tracks:
 *   1. Link clicks (any <a> click within the container)
 *   2. Text selection (mouseup when user highlights text)
 *
 * Usage:
 *   <TrackedContent context="lecture" courseId={1} objectId={42}>
 *     <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
 *   </TrackedContent>
 */

import { useCallback, useRef, type ReactNode } from 'react';
import { trackEvent } from '../../services/tracker';

interface TrackedContentProps {
  /** Dotted namespace prefix for actionSubtype, e.g. 'lecture', 'assignment', 'forum' */
  context: string;
  courseId?: number;
  objectId?: number;
  objectTitle?: string;
  children: ReactNode;
  className?: string;
}

export const TrackedContent = ({
  context,
  courseId,
  objectId,
  objectTitle,
  children,
  className,
}: TrackedContentProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track link clicks via event delegation
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href') || '';
      const linkText = target.textContent?.slice(0, 120) || '';

      trackEvent(`${context}.link_clicked`, {
        verb: 'interacted',
        objectType: 'section',
        objectId,
        objectTitle,
        courseId,
        payload: { href, linkText },
      });
    },
    [context, courseId, objectId, objectTitle],
  );

  // Track text selection on mouseup
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 2) return;

    trackEvent(`${context}.text_selected`, {
      verb: 'interacted',
      objectType: 'section',
      objectId,
      objectTitle,
      courseId,
      payload: {
        selectedText: selectedText.slice(0, 200),
        selectionLength: selectedText.length,
      },
    });
  }, [context, courseId, objectId, objectTitle]);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseUp={handleMouseUp}
      className={className}
    >
      {children}
    </div>
  );
};
