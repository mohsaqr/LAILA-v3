import { useTranslation } from 'react-i18next';

type Status = 'draft' | 'published' | 'archived' | 'submitted' | 'graded' | 'returned' | 'active' | 'completed' | 'pending' | 'not_started';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
}

const statusStyles: Record<Status, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-yellow-100 text-yellow-700',
  submitted: 'bg-blue-100 text-blue-700',
  graded: 'bg-purple-100 text-purple-700',
  returned: 'bg-orange-100 text-orange-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  not_started: 'bg-gray-100 text-gray-500',
};

export const StatusBadge = ({ status, size = 'sm' }: StatusBadgeProps) => {
  const { t } = useTranslation(['common']);
  const className = statusStyles[status] || statusStyles.draft;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  const statusLabels: Record<Status, string> = {
    draft: t('status_draft'),
    published: t('status_published'),
    archived: t('status_archived'),
    submitted: t('status_submitted'),
    graded: t('status_graded'),
    returned: t('status_returned'),
    active: t('status_active'),
    completed: t('status_completed'),
    pending: t('status_pending'),
    not_started: t('status_not_started'),
  };

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${className}`}>
      {statusLabels[status] || statusLabels.draft}
    </span>
  );
};
