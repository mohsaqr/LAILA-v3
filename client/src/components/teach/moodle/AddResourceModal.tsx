import { useTranslation } from 'react-i18next';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { ResourceMetaFields, type ResourceMeta } from './ResourceMetaFields';

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Modal heading, e.g. "Add lesson". */
  title: string;
  meta: ResourceMeta;
  onMetaChange: (next: ResourceMeta) => void;
  /** Type-specific fields rendered below the shared meta block. */
  children?: React.ReactNode;
  onCreate: () => void;
  /** Gate the Create button (e.g. require a title, or a picked file). */
  canCreate: boolean;
  busy?: boolean;
  createLabel?: string;
  titleLabel?: string;
  titlePlaceholder?: string;
}

/**
 * Shared modal shell for adding a resource: consistent header, the shared
 * `ResourceMetaFields` (title/description/visibility/availability), a slot for
 * type-specific fields, and a Create/Cancel footer. Each resource type renders
 * this with its own heading + extras, so every add modal looks the same.
 */
export const AddResourceModal = ({
  isOpen, onClose, title, meta, onMetaChange, children,
  onCreate, canCreate, busy = false, createLabel, titleLabel, titlePlaceholder,
}: AddResourceModalProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} title={title} size="lg">
      <div className="p-5 space-y-4">
        <ResourceMetaFields value={meta} onChange={onMetaChange} titleLabel={titleLabel} titlePlaceholder={titlePlaceholder} />
        {children}
        <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('common:cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button onClick={onCreate} loading={busy} disabled={!canCreate || busy}>
            {createLabel ?? t('common:create', { defaultValue: 'Create' })}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
