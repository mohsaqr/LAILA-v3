import { useTranslation } from 'react-i18next';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';

interface PickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Modal heading, e.g. "Add a survey". */
  title: string;
  /** Short explainer line under the heading. */
  subtitle?: string;
  /** The "pick existing" body — a list/select of attachable items. */
  children: React.ReactNode;
  /** Optional footer actions (e.g. an Add button); a Cancel is always shown. */
  footer?: React.ReactNode;
}

/**
 * Shared modal shell for "pick an existing resource" flows (attach a survey,
 * attach an AI agent). Matches the chrome/design language of AddResourceModal
 * — same Modal size, padded body, optional subtitle, and a Cancel/footer row —
 * so every add-resource surface looks the same. The pick-existing logic itself
 * lives in `children`.
 */
export const PickerModal = ({ isOpen, onClose, title, subtitle, children, footer }: PickerModalProps) => {
  const { t } = useTranslation(['common']);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="p-5 space-y-4">
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
        {children}
        <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel', { defaultValue: 'Cancel' })}
          </Button>
          {footer}
        </div>
      </div>
    </Modal>
  );
};
