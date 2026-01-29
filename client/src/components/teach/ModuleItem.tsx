import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  Plus,
  ChevronUp,
  GripVertical,
  FlaskConical,
  ClipboardList,
} from 'lucide-react';
import { CourseModule, Lecture, CodeLab, Assignment } from '../../types';
import { Button } from '../common/Button';
import { LectureItem } from './LectureItem';
import { CodeLabItem } from './CodeLabItem';
import { AssignmentItem } from './AssignmentItem';

interface ModuleItemProps {
  module: CourseModule;
  courseId: number;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (module: CourseModule) => void;
  onDelete: (module: CourseModule) => void;
  onMoveUp: (module: CourseModule) => void;
  onMoveDown: (module: CourseModule) => void;
  onAddLecture: (module: CourseModule) => void;
  onEditLecture: (lecture: Lecture) => void;
  onDeleteLecture: (lecture: Lecture) => void;
  onMoveLectureUp: (lecture: Lecture, module: CourseModule) => void;
  onMoveLectureDown: (lecture: Lecture, module: CourseModule) => void;
  // Code Lab handlers
  onAddCodeLab: (module: CourseModule) => void;
  onEditCodeLab: (codeLab: CodeLab) => void;
  onDeleteCodeLab: (codeLab: CodeLab) => void;
  onMoveCodeLabUp: (codeLab: CodeLab, module: CourseModule) => void;
  onMoveCodeLabDown: (codeLab: CodeLab, module: CourseModule) => void;
  // Assignment handlers
  onAddAssignment: (module: CourseModule) => void;
  onEditAssignment: (assignment: Assignment) => void;
  onDeleteAssignment: (assignment: Assignment) => void;
  onMoveAssignmentUp: (assignment: Assignment, module: CourseModule) => void;
  onMoveAssignmentDown: (assignment: Assignment, module: CourseModule) => void;
}

export const ModuleItem = ({
  module,
  courseId,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddLecture,
  onEditLecture,
  onDeleteLecture,
  onMoveLectureUp,
  onMoveLectureDown,
  onAddCodeLab,
  onEditCodeLab,
  onDeleteCodeLab,
  onMoveCodeLabUp,
  onMoveCodeLabDown,
  onAddAssignment,
  onEditAssignment,
  onDeleteAssignment,
  onMoveAssignmentUp,
  onMoveAssignmentDown,
}: ModuleItemProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const lectures = module.lectures || [];
  const codeLabs = module.codeLabs || [];
  const assignments = module.assignments || [];

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Module Header */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-t-lg">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded hover:bg-gray-200 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
        </button>

        <GripVertical className="w-5 h-5 text-gray-400" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 truncate">{module.title}</h3>
            {module.label && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">
                {module.label}
              </span>
            )}
          </div>
          {module.description && (
            <p className="text-sm text-gray-500 truncate">{module.description}</p>
          )}
          <span className="text-xs text-gray-400">
            {lectures.length} lesson{lectures.length !== 1 ? 's' : ''}
            {codeLabs.length > 0 && ` • ${codeLabs.length} code lab${codeLabs.length !== 1 ? 's' : ''}`}
            {assignments.length > 0 && ` • ${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Reorder buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMoveUp(module)}
            disabled={isFirst}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => onMoveDown(module)}
            disabled={isLast}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(module)}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="Edit module"
          >
            <Edit className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => onDelete(module)}
            className="p-1.5 rounded hover:bg-red-100 transition-colors"
            title="Delete module"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {/* Lectures and Code Labs */}
      {isExpanded && (
        <div className="p-4 space-y-2">
          {/* Lectures */}
          {lectures.length > 0 ? (
            lectures
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((lecture, index) => (
                <LectureItem
                  key={lecture.id}
                  lecture={lecture}
                  courseId={courseId}
                  isFirst={index === 0}
                  isLast={index === lectures.length - 1}
                  onEdit={onEditLecture}
                  onDelete={onDeleteLecture}
                  onMoveUp={() => onMoveLectureUp(lecture, module)}
                  onMoveDown={() => onMoveLectureDown(lecture, module)}
                />
              ))
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              No lessons yet. Add your first lesson below.
            </p>
          )}

          {/* Code Labs */}
          {codeLabs.length > 0 && (
            <div className="pt-2 border-t border-gray-100 mt-2 space-y-2">
              {codeLabs
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((codeLab, index) => (
                  <CodeLabItem
                    key={codeLab.id}
                    codeLab={codeLab}
                    courseId={courseId}
                    isFirst={index === 0}
                    isLast={index === codeLabs.length - 1}
                    onEdit={onEditCodeLab}
                    onDelete={onDeleteCodeLab}
                    onMoveUp={() => onMoveCodeLabUp(codeLab, module)}
                    onMoveDown={() => onMoveCodeLabDown(codeLab, module)}
                  />
                ))}
            </div>
          )}

          {/* Assignments */}
          {assignments.length > 0 && (
            <div className="pt-2 border-t border-gray-100 mt-2 space-y-2">
              {assignments
                .sort((a, b) => (a.id || 0) - (b.id || 0))
                .map((assignment, index) => (
                  <AssignmentItem
                    key={assignment.id}
                    assignment={assignment}
                    courseId={courseId}
                    isFirst={index === 0}
                    isLast={index === assignments.length - 1}
                    onEdit={onEditAssignment}
                    onDelete={onDeleteAssignment}
                    onMoveUp={() => onMoveAssignmentUp(assignment, module)}
                    onMoveDown={() => onMoveAssignmentDown(assignment, module)}
                  />
                ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddLecture(module)}
              icon={<Plus className="w-4 h-4" />}
              className="flex-1 min-w-[120px]"
            >
              Add Lesson
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddCodeLab(module)}
              icon={<FlaskConical className="w-4 h-4" />}
              className="flex-1 min-w-[120px] text-emerald-600 hover:bg-emerald-50"
            >
              Add Code Lab
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddAssignment(module)}
              icon={<ClipboardList className="w-4 h-4" />}
              className="flex-1 min-w-[120px] text-amber-600 hover:bg-amber-50"
            >
              Add Assignment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
