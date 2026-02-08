import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import { Forum } from '../../types';

interface ForumItemProps {
  forum: Forum;
  courseId: number;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (forum: Forum) => void;
  onDelete: (forum: Forum) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const ForumItem = ({
  forum,
  courseId,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ForumItemProps) => {
  const { t } = useTranslation(['teaching']);
  const threadCount = forum._count?.threads || 0;

  return (
    <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors">
      <div className="flex items-center justify-center w-8 h-8 rounded bg-white border border-teal-200">
        <MessageSquare className="w-4 h-4 text-teal-600" />
      </div>

      {/* Forum info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate">
          {forum.title}
        </h4>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="text-teal-600 font-medium">{t('forum')}</span>
          <span>•</span>
          <span>{t('x_threads', { count: threadCount })}</span>
          {!forum.isPublished && (
            <>
              <span>•</span>
              <span className="text-amber-600">{t('draft')}</span>
            </>
          )}
          {forum.allowAnonymous && (
            <>
              <span>•</span>
              <span className="text-gray-400">{t('anonymous_allowed')}</span>
            </>
          )}
        </div>
      </div>

      {/* View Forum Button */}
      <Link
        to={`/course/${courseId}/forum/${forum.id}`}
        className="px-3 py-1.5 text-xs font-medium text-teal-600 bg-teal-100 hover:bg-teal-200 rounded-lg transition-colors flex items-center gap-1.5"
        title={t('view_forum')}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        {t('view')}
      </Link>

      {/* Reorder buttons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst}
          className="p-1 rounded hover:bg-teal-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('move_up')}
        >
          <ChevronUp className="w-4 h-4 text-gray-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast}
          className="p-1 rounded hover:bg-teal-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('move_down')}
        >
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(forum); }}
          className="p-1.5 rounded hover:bg-teal-200 transition-colors"
          title={t('edit_forum')}
        >
          <Edit2 className="w-4 h-4 text-gray-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(forum); }}
          className="p-1.5 rounded hover:bg-red-100 transition-colors"
          title={t('delete_forum')}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
    </div>
  );
};
