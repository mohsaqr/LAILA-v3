import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Edit2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Assignment, Lecture } from '../../types';
import { AssignmentItem } from './AssignmentItem';
import { LessonEditor } from './lesson-editor';

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
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
    <div
      className={`flex items-center gap-3 p-3 min-h-[64px] bg-gray-50 hover:bg-gray-100 transition-colors ${
        isExpanded ? 'rounded-t-lg' : 'rounded-lg'
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Chevron toggle for the inline editor */}
        <button
          type="button"
          onClick={() => setIsExpanded(o => !o)}
          aria-expanded={isExpanded}
          aria-label={t(isExpanded ? 'collapse' : 'expand', { defaultValue: isExpanded ? 'Collapse' : 'Expand' })}
          className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-white/60 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 shrink-0"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {/* Lecture title only — meta info (contentType / duration / draft) is intentionally hidden. */}
        <h4 className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
          {lecture.title}
        </h4>
      </div>

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
            className={`p-1.5 rounded transition-colors ${lecture.isPublished ? 'hover:bg-amber-100' : 'hover:bg-green-100'}`}
            title={lecture.isPublished ? t('unpublish_lesson') : t('publish_lesson')}
          >
            {lecture.isPublished ? (
              <EyeOff className="w-4 h-4 text-amber-500" />
            ) : (
              <Eye className="w-4 h-4 text-green-500" />
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

    {/* Inline lesson editor — one Tiptap canvas per lesson with File
        and Chatbot insertable as inline nodes. Sits flush against
        the lecture header for a single-unit feel. */}
    {isExpanded && (
      <div className="px-3 pt-2 pb-4 bg-gray-50 rounded-b-lg">
        <LessonEditor lectureId={lecture.id} initialSections={lecture.sections ?? []} />
      </div>
    )}

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
