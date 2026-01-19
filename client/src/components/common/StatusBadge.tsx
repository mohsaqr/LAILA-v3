type Status = 'draft' | 'published' | 'archived' | 'submitted' | 'graded' | 'returned' | 'active' | 'completed' | 'pending';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-700',
  },
  published: {
    label: 'Published',
    className: 'bg-green-100 text-green-700',
  },
  archived: {
    label: 'Archived',
    className: 'bg-yellow-100 text-yellow-700',
  },
  submitted: {
    label: 'Submitted',
    className: 'bg-blue-100 text-blue-700',
  },
  graded: {
    label: 'Graded',
    className: 'bg-purple-100 text-purple-700',
  },
  returned: {
    label: 'Returned',
    className: 'bg-orange-100 text-orange-700',
  },
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-700',
  },
  completed: {
    label: 'Completed',
    className: 'bg-blue-100 text-blue-700',
  },
  pending: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-700',
  },
};

export const StatusBadge = ({ status, size = 'sm' }: StatusBadgeProps) => {
  const config = statusConfig[status] || statusConfig.draft;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${config.className}`}>
      {config.label}
    </span>
  );
};
