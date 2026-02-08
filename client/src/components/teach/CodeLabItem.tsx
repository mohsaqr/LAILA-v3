import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  FlaskConical,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  FileEdit,
} from 'lucide-react';
import { CodeLab } from '../../types';

interface CodeLabItemProps {
  codeLab: CodeLab;
  courseId: number;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (codeLab: CodeLab) => void;
  onDelete: (codeLab: CodeLab) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const CodeLabItem = ({
  codeLab,
  courseId,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: CodeLabItemProps) => {
  const { t } = useTranslation(['teaching']);
  const blockCount = codeLab.blocks?.length || 0;

  return (
    <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
      <div className="flex items-center justify-center w-8 h-8 rounded bg-white border border-emerald-200">
        <FlaskConical className="w-4 h-4 text-emerald-600" />
      </div>

      {/* Code Lab info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate">
          {codeLab.title}
        </h4>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="text-emerald-600 font-medium">{t('code_lab')}</span>
          <span>•</span>
          <span>{t('x_blocks', { count: blockCount })}</span>
          {!codeLab.isPublished && (
            <>
              <span>•</span>
              <span className="text-amber-600">{t('draft')}</span>
            </>
          )}
        </div>
      </div>

      {/* Edit Content Button */}
      <Link
        to={`/teach/courses/${courseId}/code-labs/${codeLab.id}`}
        className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center gap-1.5"
        title={t('edit_code_lab')}
      >
        <FileEdit className="w-3.5 h-3.5" />
        {t('edit_lab')}
      </Link>

      {/* Reorder buttons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst}
          className="p-1 rounded hover:bg-emerald-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('move_up')}
        >
          <ChevronUp className="w-4 h-4 text-gray-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast}
          className="p-1 rounded hover:bg-emerald-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('move_down')}
        >
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(codeLab); }}
          className="p-1.5 rounded hover:bg-emerald-200 transition-colors"
          title={t('edit_code_lab_details')}
        >
          <Edit2 className="w-4 h-4 text-gray-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(codeLab); }}
          className="p-1.5 rounded hover:bg-red-100 transition-colors"
          title={t('delete_code_lab')}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
    </div>
  );
};
