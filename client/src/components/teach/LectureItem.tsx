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
import { BlockStream } from './lecture-blocks';

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
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Lecture title only — meta info (contentType / duration / draft) is intentionally hidden. */}
        <h4 className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
          {lecture.title}
        </h4>
      </div>

      <div className="flex items-center gap-1 flex-wrap justify-end sm:justify-start">
      {/* Manage Content — toggles inline block editor below */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsExpanded(o => !o); }}
        className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors flex items-center gap-1.5"
        title={t('manage_lesson_sections')}
        aria-expanded={isExpanded}
      >
        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {t('manage_content')}
      </button>

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

    {/* Inline block editor — replaces the dedicated /lectures/:id page.
        No wrapping card or border so the blocks sit flush in the parent. */}
    {isExpanded && (
      <div className="mt-2">
        <BlockStream lectureId={lecture.id} initialSections={lecture.sections ?? []} />
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
