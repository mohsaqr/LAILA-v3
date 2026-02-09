import { useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { sanitizeHtml } from '../../utils/sanitize';

interface ContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  content: string;
  onOpenInNewPage?: () => void;
}

export const ContentModal = ({ isOpen, onClose, title, content, onOpenInNewPage }: ContentModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle click outside modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          {title ? (
            <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
              {title}
            </h2>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            {onOpenInNewPage && (
              <button
                onClick={onOpenInNewPage}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Open in new page"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
          />
        </div>
      </div>
    </div>
  );
};
