import { Link } from 'react-router-dom';
import {
  FileText,
  Video,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  FileEdit,
} from 'lucide-react';
import { Lecture } from '../../types';

interface LectureItemProps {
  lecture: Lecture;
  courseId: number;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (lecture: Lecture) => void;
  onDelete: (lecture: Lecture) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const LectureItem = ({
  lecture,
  courseId,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: LectureItemProps) => {
  const getIcon = () => {
    switch (lecture.contentType) {
      case 'video':
        return <Video className="w-4 h-4 text-red-500" />;
      case 'mixed':
        return <FileText className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center justify-center w-8 h-8 rounded bg-white border border-gray-200">
        {getIcon()}
      </div>

      {/* Lecture info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate">
          {lecture.title}
        </h4>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="capitalize">{lecture.contentType}</span>
          {lecture.duration && (
            <>
              <span>•</span>
              <span>{lecture.duration} min</span>
            </>
          )}
          {lecture.isFree && (
            <>
              <span>•</span>
              <span className="text-green-600">Free Preview</span>
            </>
          )}
        </div>
      </div>

      {/* Edit Content Button - prominent */}
      <Link
        to={`/teach/courses/${courseId}/lectures/${lecture.id}`}
        className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors flex items-center gap-1.5"
        title="Edit lesson content"
      >
        <FileEdit className="w-3.5 h-3.5" />
        Edit Content
      </Link>

      {/* Reorder buttons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst}
          className="p-1 rounded hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move up"
        >
          <ChevronUp className="w-4 h-4 text-gray-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast}
          className="p-1 rounded hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move down"
        >
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(lecture); }}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors"
          title="Edit lesson details"
        >
          <Edit2 className="w-4 h-4 text-gray-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(lecture); }}
          className="p-1.5 rounded hover:bg-red-100 transition-colors"
          title="Delete lesson"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
    </div>
  );
};
