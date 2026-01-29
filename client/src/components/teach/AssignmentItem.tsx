import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  FileEdit,
  Bot,
  Calendar,
} from 'lucide-react';
import { Assignment } from '../../types';

interface AssignmentItemProps {
  assignment: Assignment;
  courseId: number;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (assignment: Assignment) => void;
  onDelete: (assignment: Assignment) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const AssignmentItem = ({
  assignment,
  courseId,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: AssignmentItemProps) => {
  const isAiAgent = assignment.submissionType === 'ai_agent';
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const isPastDue = dueDate && dueDate < new Date();

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
      isAiAgent
        ? 'bg-purple-50 hover:bg-purple-100'
        : 'bg-amber-50 hover:bg-amber-100'
    }`}>
      <div className={`flex items-center justify-center w-8 h-8 rounded bg-white border ${
        isAiAgent ? 'border-purple-200' : 'border-amber-200'
      }`}>
        {isAiAgent ? (
          <Bot className="w-4 h-4 text-purple-600" />
        ) : (
          <ClipboardList className="w-4 h-4 text-amber-600" />
        )}
      </div>

      {/* Assignment info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate">
          {assignment.title}
        </h4>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className={`font-medium ${isAiAgent ? 'text-purple-600' : 'text-amber-600'}`}>
            {isAiAgent ? 'AI Agent' : 'Assignment'}
          </span>
          <span>•</span>
          <span>{assignment.points} pts</span>
          {dueDate && (
            <>
              <span>•</span>
              <span className={`flex items-center gap-1 ${isPastDue ? 'text-red-500' : ''}`}>
                <Calendar className="w-3 h-3" />
                {dueDate.toLocaleDateString()}
              </span>
            </>
          )}
          {!assignment.isPublished && (
            <>
              <span>•</span>
              <span className="text-amber-600">Draft</span>
            </>
          )}
        </div>
      </div>

      {/* View Submissions Button */}
      <Link
        to={`/teach/courses/${courseId}/assignments/${assignment.id}/submissions`}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
          isAiAgent
            ? 'text-purple-600 bg-purple-100 hover:bg-purple-200'
            : 'text-amber-600 bg-amber-100 hover:bg-amber-200'
        }`}
        title="View submissions"
      >
        <FileEdit className="w-3.5 h-3.5" />
        Submissions
      </Link>

      {/* Reorder buttons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst}
          className={`p-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            isAiAgent ? 'hover:bg-purple-200' : 'hover:bg-amber-200'
          }`}
          title="Move up"
        >
          <ChevronUp className="w-4 h-4 text-gray-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast}
          className={`p-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            isAiAgent ? 'hover:bg-purple-200' : 'hover:bg-amber-200'
          }`}
          title="Move down"
        >
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(assignment); }}
          className={`p-1.5 rounded transition-colors ${
            isAiAgent ? 'hover:bg-purple-200' : 'hover:bg-amber-200'
          }`}
          title="Edit assignment details"
        >
          <Edit2 className="w-4 h-4 text-gray-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(assignment); }}
          className="p-1.5 rounded hover:bg-red-100 transition-colors"
          title="Delete assignment"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
    </div>
  );
};
