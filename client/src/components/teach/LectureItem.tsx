import { useTranslation } from 'react-i18next';
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  Eye,
  EyeOff,
  FileText,
} from 'lucide-react';
import { Assignment, Lecture } from '../../types';
import { AssignmentItem } from './AssignmentItem';

interface LectureItemProps {
  lecture: Lecture;
  courseId: number;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (lecture: Lecture) => void;
  onDelete: (lecture: Lecture) => void;
  onTogglePublish?: (lecture: Lecture) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  assignments?: Assignment[];
  onEditAssignment?: (assignment: Assignment) => void;
  onDeleteAssignment?: (assignment: Assignment) => void;
}

/**
 * Every lesson reads the same regardless of contentType (text / video /
 * mixed). A single slate swatch keeps lessons visually distinct from the
 * other content types in the list — quiz (cyan), survey (indigo), forum
 * (teal), code lab (emerald), assignment (amber), interactive (violet).
 */
const typeSwatch = (): {
  icon: typeof FileText;
  bg: string;
  border: string;
  fg: string;
  /** Color for the "Lesson" tag under the title. */
  tag: string;
} => ({
  icon: FileText,
  bg: 'bg-slate-100 dark:bg-slate-700/30',
  border: 'border-slate-300 dark:border-slate-600',
  fg: 'text-slate-600 dark:text-slate-300',
  tag: 'text-slate-600 dark:text-slate-300',
});

export const LectureItem = ({
  lecture,
  courseId,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onTogglePublish,
  onMoveUp,
  onMoveDown,
  assignments = [],
  onEditAssignment,
  onDeleteAssignment,
}: LectureItemProps) => {
  const { t } = useTranslation(['teaching']);
  const { icon: TypeIcon, bg, border, fg, tag } = typeSwatch();

  return (
    <div>
    <div
      className={`flex items-center gap-3 p-3 min-h-[64px] rounded-lg ${bg} hover:opacity-90 transition`}
    >
      <button
        type="button"
        onClick={() => onEdit(lecture)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
        title={t('edit_lesson_details', { defaultValue: 'Open lesson' })}
      >
        <span
          className={`flex items-center justify-center w-8 h-8 rounded bg-white border ${border} flex-shrink-0`}
        >
          <TypeIcon className={`w-4 h-4 ${fg}`} />
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {lecture.title}
          </h4>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
            <span className={`font-medium ${tag}`}>
              {t('lesson_singular', { defaultValue: 'Lesson' })}
            </span>
            {lecture.duration ? (
              <>
                <span>•</span>
                <span>
                  {t('duration_minutes_short', {
                    defaultValue: '{{n}} min',
                    n: lecture.duration,
                  })}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1 flex-shrink-0">
      {/* Reorder buttons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst}
          className="p-1 rounded hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('move_up')}
        >
          <ChevronUp className="w-4 h-4 text-gray-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast}
          className="p-1 rounded hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('move_down')}
        >
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {onTogglePublish && (
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePublish(lecture); }}
            className={`p-1.5 rounded transition-colors ${lecture.isPublished ? 'hover:bg-green-100' : 'hover:bg-amber-100'}`}
            title={lecture.isPublished ? t('unpublish_lesson') : t('publish_lesson')}
          >
            {lecture.isPublished ? (
              <Eye className="w-4 h-4 text-green-500" />
            ) : (
              <EyeOff className="w-4 h-4 text-amber-500" />
            )}
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(lecture); }}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors"
          title={t('edit_lesson_details')}
        >
          <Edit2 className="w-4 h-4 text-gray-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(lecture); }}
          className="p-1.5 rounded hover:bg-red-100 transition-colors"
          title={t('delete_lesson')}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
      </div>
    </div>

    {/* Lecture-level assignments nested below this lecture */}
    {assignments.length > 0 && (
      <div className="ml-6 mt-1 space-y-1 border-l-2 border-rose-200 pl-3">
        {assignments.map((assignment, idx) => (
          <AssignmentItem
            key={assignment.id}
            assignment={assignment}
            courseId={courseId}
            isFirst={idx === 0}
            isLast={idx === assignments.length - 1}
            onEdit={onEditAssignment ?? (() => {})}
            onDelete={onDeleteAssignment ?? (() => {})}
            onMoveUp={() => {}}
            onMoveDown={() => {}}
          />
        ))}
      </div>
    )}
    </div>
  );
};
