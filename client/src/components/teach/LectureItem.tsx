import { useTranslation } from 'react-i18next';
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  Copy,
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
  onDuplicate?: (lecture: Lecture) => void;
  onTogglePublish?: (lecture: Lecture) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  assignments?: Assignment[];
  onEditAssignment?: (assignment: Assignment) => void;
  onDeleteAssignment?: (assignment: Assignment) => void;
}

/**
 * Small inline action icon with an immediate, custom hover tooltip (rendered
 * below the icon so it isn't clipped by the row). `hover` sets the hover
 * background tint so each action reads at a glance (edit=neutral,
 * duplicate=blue, publish=green/amber, delete=red).
 */
const IconBtn = ({
  onClick,
  title,
  hover,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  hover: string;
  children: React.ReactNode;
}) => (
  <span className="relative group/iconbtn">
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      className={`p-1.5 rounded transition-colors ${hover}`}
    >
      {children}
    </button>
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/iconbtn:opacity-100 dark:bg-gray-700"
    >
      {title}
    </span>
  </span>
);

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
  onDuplicate,
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
      <div className="flex items-center gap-0.5">
        <IconBtn
          onClick={(e) => { e.stopPropagation(); onEdit(lecture); }}
          title={t('edit_lesson_details')}
          hover="hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Edit2 className="w-4 h-4 text-gray-500" />
        </IconBtn>
        {onDuplicate && (
          <IconBtn
            onClick={(e) => { e.stopPropagation(); onDuplicate(lecture); }}
            title={t('duplicate_lesson', { defaultValue: 'Duplicate' })}
            hover="hover:bg-blue-100 dark:hover:bg-blue-900/30"
          >
            <Copy className="w-4 h-4 text-blue-500" />
          </IconBtn>
        )}
        {onTogglePublish && (
          <IconBtn
            onClick={(e) => { e.stopPropagation(); onTogglePublish(lecture); }}
            title={lecture.isPublished ? t('unpublish_lesson') : t('publish_lesson')}
            hover={lecture.isPublished ? 'hover:bg-green-100 dark:hover:bg-green-900/30' : 'hover:bg-amber-100 dark:hover:bg-amber-900/30'}
          >
            {lecture.isPublished ? (
              <Eye className="w-4 h-4 text-green-500" />
            ) : (
              <EyeOff className="w-4 h-4 text-amber-500" />
            )}
          </IconBtn>
        )}
        <IconBtn
          onClick={(e) => { e.stopPropagation(); onDelete(lecture); }}
          title={t('delete_lesson')}
          hover="hover:bg-red-100 dark:hover:bg-red-900/30"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </IconBtn>
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
