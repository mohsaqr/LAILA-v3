import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
  FileText,
  Upload,
  Sparkles,
  MessageCircle,
  Beaker,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { CourseModule, Lecture, CodeLab, Assignment, LabAssignment, Forum } from '../../types';
import { Button } from '../common/Button';
import { LectureItem } from './LectureItem';
import { CodeLabItem } from './CodeLabItem';
import { AssignmentItem } from './AssignmentItem';
import { ForumItem } from './ForumItem';

interface ModuleItemProps {
  module: CourseModule & { labAssignments?: LabAssignment[] };
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
  // Lab Template handlers
  onRemoveLabAssignment?: (labId: number) => void;
  // Forum handlers
  onAddForum?: (module: CourseModule) => void;
  onEditForum?: (forum: Forum) => void;
  onDeleteForum?: (forum: Forum) => void;
  onMoveForumUp?: (forum: Forum, module: CourseModule) => void;
  onMoveForumDown?: (forum: Forum, module: CourseModule) => void;
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
  onRemoveLabAssignment,
  onAddForum,
  onEditForum,
  onDeleteForum,
  onMoveForumUp,
  onMoveForumDown,
}: ModuleItemProps) => {
  const { t } = useTranslation(['teaching']);
  const [isExpanded, setIsExpanded] = useState(true);
  const lectures = module.lectures || [];
  const codeLabs = module.codeLabs || [];
  const assignments = module.assignments || [];
  const labAssignments = module.labAssignments || [];
  const forums = module.forums || [];

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
            {t('x_lessons', { count: lectures.length })}
            {codeLabs.length > 0 && ` • ${t('x_code_labs', { count: codeLabs.length })}`}
            {labAssignments.length > 0 && ` • ${t('x_lab_templates', { count: labAssignments.length })}`}
            {assignments.length > 0 && ` • ${t('x_assignments', { count: assignments.length })}`}
            {forums.length > 0 && ` • ${t('x_forums', { count: forums.length })}`}
          </span>
        </div>

        {/* Reorder buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMoveUp(module)}
            disabled={isFirst}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={t('move_up')}
          >
            <ChevronUp className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => onMoveDown(module)}
            disabled={isLast}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={t('move_down')}
          >
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(module)}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title={t('edit_module')}
          >
            <Edit className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => onDelete(module)}
            className="p-1.5 rounded hover:bg-red-100 transition-colors"
            title={t('delete_module')}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {/* Lectures and Code Labs */}
      {isExpanded && (
        <div className="p-4 space-y-2">
          {/* Lectures with inline add options */}
          {lectures.length > 0 ? (
            lectures
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((lecture, index) => (
                <div key={lecture.id}>
                  <LectureItem
                    lecture={lecture}
                    courseId={courseId}
                    isFirst={index === 0}
                    isLast={index === lectures.length - 1}
                    onEdit={onEditLecture}
                    onDelete={onDeleteLecture}
                    onMoveUp={() => onMoveLectureUp(lecture, module)}
                    onMoveDown={() => onMoveLectureDown(lecture, module)}
                  />
                  {/* Inline add options after each lesson */}
                  <div className="flex items-center gap-1.5 py-2 px-3 ml-6 border-l-2 border-dashed border-gray-200 flex-wrap">
                    <span className="text-xs text-gray-400 mr-1">{t('add')}:</span>
                    {/* Section types - add directly to this lesson */}
                    <Link
                      to={`/teach/courses/${courseId}/lectures/${lecture.id}?addSection=text`}
                      className="text-xs px-2 py-1 rounded-md border border-blue-200 hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
                      title={t('add_text_section')}
                    >
                      <FileText className="w-3 h-3" />
                      {t('section_type_text')}
                    </Link>
                    <Link
                      to={`/teach/courses/${courseId}/lectures/${lecture.id}?addSection=file`}
                      className="text-xs px-2 py-1 rounded-md border border-green-200 hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors flex items-center gap-1"
                      title={t('add_file_section')}
                    >
                      <Upload className="w-3 h-3" />
                      {t('section_type_file')}
                    </Link>
                    <Link
                      to={`/teach/courses/${courseId}/lectures/${lecture.id}?addSection=ai-generated`}
                      className="text-xs px-2 py-1 rounded-md border border-purple-200 hover:bg-purple-50 text-purple-600 hover:text-purple-700 transition-colors flex items-center gap-1"
                      title={t('add_ai_section')}
                    >
                      <Sparkles className="w-3 h-3" />
                      {t('section_type_ai')}
                    </Link>
                    <Link
                      to={`/teach/courses/${courseId}/lectures/${lecture.id}?addSection=chatbot`}
                      className="text-xs px-2 py-1 rounded-md border border-orange-200 hover:bg-orange-50 text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1"
                      title={t('add_chatbot_section')}
                    >
                      <MessageCircle className="w-3 h-3" />
                      {t('section_type_chatbot')}
                    </Link>
                    <span className="text-gray-300 mx-1">|</span>
                    {/* Module-level items */}
                    <button
                      onClick={() => onAddLecture(module)}
                      className="text-xs px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-1"
                      title={t('add_new_lesson')}
                    >
                      <Plus className="w-3 h-3" />
                      {t('lesson')}
                    </button>
                    <button
                      onClick={() => onAddCodeLab(module)}
                      className="text-xs px-2 py-1 rounded-md border border-emerald-200 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
                      title={t('add_code_lab')}
                    >
                      <FlaskConical className="w-3 h-3" />
                      {t('code_lab')}
                    </button>
                    <button
                      onClick={() => onAddAssignment(module)}
                      className="text-xs px-2 py-1 rounded-md border border-rose-200 hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1"
                      title={t('add_assignment')}
                    >
                      <ClipboardList className="w-3 h-3" />
                      {t('assignment')}
                    </button>
                    {onAddForum && (
                      <button
                        onClick={() => onAddForum(module)}
                        className="text-xs px-2 py-1 rounded-md border border-teal-200 hover:bg-teal-50 text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-1"
                        title={t('add_forum')}
                      >
                        <MessageSquare className="w-3 h-3" />
                        {t('forum')}
                      </button>
                    )}
                  </div>
                </div>
              ))
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              {t('no_lessons_yet')}
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

          {/* Lab Templates (Custom Labs) */}
          {labAssignments.length > 0 && (
            <div className="pt-2 border-t border-gray-100 mt-2 space-y-2">
              {labAssignments.map(labAssignment => (
                <div
                  key={labAssignment.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800"
                >
                  <Beaker className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {labAssignment.lab?.name || t('lab_template')}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-300">
                        {labAssignment.lab?.labType}
                      </span>
                    </div>
                    {labAssignment.lab?.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {labAssignment.lab.description}
                      </p>
                    )}
                    <span className="text-xs text-gray-400">
                      {t('x_templates', { count: labAssignment.lab?._count?.templates || labAssignment.lab?.templates?.length || 0 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/labs/${labAssignment.labId}`}
                      className="p-1.5 rounded hover:bg-teal-100 dark:hover:bg-teal-800 transition-colors"
                      title={t('view_lab')}
                    >
                      <ExternalLink className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </Link>
                    {onRemoveLabAssignment && (
                      <button
                        onClick={() => onRemoveLabAssignment(labAssignment.labId)}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        title={t('remove_from_module')}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
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

          {/* Forums */}
          {forums.length > 0 && onEditForum && onDeleteForum && (
            <div className="pt-2 border-t border-gray-100 mt-2 space-y-2">
              {forums
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((forum, index) => (
                  <ForumItem
                    key={forum.id}
                    forum={forum}
                    courseId={courseId}
                    isFirst={index === 0}
                    isLast={index === forums.length - 1}
                    onEdit={onEditForum}
                    onDelete={onDeleteForum}
                    onMoveUp={() => onMoveForumUp?.(forum, module)}
                    onMoveDown={() => onMoveForumDown?.(forum, module)}
                  />
                ))}
            </div>
          )}

          {/* Action buttons - shown when no lessons exist */}
          {lectures.length === 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddLecture(module)}
                icon={<Plus className="w-4 h-4" />}
                className="flex-1 min-w-[120px]"
              >
                {t('add_lesson')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddCodeLab(module)}
                icon={<FlaskConical className="w-4 h-4" />}
                className="flex-1 min-w-[120px] text-emerald-600 hover:bg-emerald-50"
              >
                {t('add_code_lab')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddAssignment(module)}
                icon={<ClipboardList className="w-4 h-4" />}
                className="flex-1 min-w-[120px] text-amber-600 hover:bg-amber-50"
              >
                {t('add_assignment')}
              </Button>
              {onAddForum && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddForum(module)}
                  icon={<MessageSquare className="w-4 h-4" />}
                  className="flex-1 min-w-[120px] text-teal-600 hover:bg-teal-50"
                >
                  {t('add_forum')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
