import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Video,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  FileEdit,
  Eye,
  EyeOff,
  Download,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { Assignment, Lecture } from '../../types';
import { AssignmentItem } from './AssignmentItem';
import { coursesApi } from '../../api/courses';

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
  const queryClient = useQueryClient();

  // File rename state
  const fileSections = lecture.sections?.filter(s => s.type === 'file' && s.fileUrl) || [];
  const [editingFileSectionId, setEditingFileSectionId] = useState<number | null>(null);
  const [editFileName, setEditFileName] = useState('');

  const renameMutation = useMutation({
    mutationFn: ({ sectionId, fileName }: { sectionId: number; fileName: string }) =>
      coursesApi.updateSection(sectionId, { fileName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      setEditingFileSectionId(null);
    },
  });

  const handleFileDownload = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = name;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

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
    <div>
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="flex items-center justify-center w-8 h-8 rounded bg-white border border-gray-200 flex-shrink-0">
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
              <span>{lecture.duration} {t('min')}</span>
            </>
          )}
          {lecture.isFree && (
            <>
              <span>•</span>
              <span className="text-green-600">{t('free_preview')}</span>
            </>
          )}
          {!lecture.isPublished && (
            <>
              <span>•</span>
              <span className="text-amber-600">{t('draft')}</span>
            </>
          )}
        </div>
      </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap justify-end sm:justify-start">
      {/* Manage Content Button - opens lesson editor */}
      <Link
        to={`/teach/courses/${courseId}/lectures/${lecture.id}`}
        className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors flex items-center gap-1.5"
        title={t('manage_lesson_sections')}
      >
        <FileEdit className="w-3.5 h-3.5" />
        {t('manage_content')}
      </Link>

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

    {/* File section display */}
    {fileSections.length > 0 && (
      <div className="ml-6 mt-1 grid grid-cols-2 gap-1.5">
        {fileSections.map(fs => (
          <div key={fs.id} className="flex items-center gap-2 p-2 rounded-md bg-green-50 border border-green-200">
            <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
            {editingFileSectionId === fs.id ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <input
                  type="text"
                  value={editFileName}
                  onChange={(e) => setEditFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editFileName.trim()) {
                      renameMutation.mutate({ sectionId: fs.id, fileName: editFileName.trim() });
                      setEditingFileSectionId(null);
                    }
                    if (e.key === 'Escape') {
                      setEditingFileSectionId(null);
                    }
                  }}
                  className="flex-1 min-w-0 text-xs px-2 py-1 border border-green-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (editFileName.trim()) {
                      renameMutation.mutate({ sectionId: fs.id, fileName: editFileName.trim() });
                      setEditingFileSectionId(null);
                    }
                  }}
                  className="p-1 rounded hover:bg-green-100 transition-colors"
                >
                  <Check className="w-3.5 h-3.5 text-green-600" />
                </button>
                <button
                  onClick={() => setEditingFileSectionId(null)}
                  className="p-1 rounded hover:bg-gray-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            ) : (
              <>
                <span className="text-xs text-green-800 truncate flex-1 min-w-0">
                  {fs.fileName || t('file')}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditFileName(fs.fileName || '');
                    setEditingFileSectionId(fs.id);
                  }}
                  className="p-1 rounded hover:bg-green-100 transition-colors"
                  title={t('edit_file_name')}
                >
                  <Pencil className="w-3 h-3 text-green-600" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileDownload(fs.fileUrl!, fs.fileName || 'file');
                  }}
                  className="p-1 rounded hover:bg-green-100 transition-colors"
                  title={t('download')}
                >
                  <Download className="w-3 h-3 text-green-600" />
                </button>
              </>
            )}
          </div>
        ))}
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
