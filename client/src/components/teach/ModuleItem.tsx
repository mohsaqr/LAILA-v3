import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ChevronDown,
  Edit,
  Trash2,
  Plus,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Upload,
  Beaker,
  ExternalLink,
  Network,
  Loader2,
  Pencil,
  X,
  Search,
  ClipboardCheck,
  FileQuestion,
  CheckCircle2,
} from 'lucide-react';
import { CourseModule, Lecture, CodeLab, Assignment, LabAssignment, Forum, ModuleQuiz } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { LectureItem } from './LectureItem';
import { CodeLabItem } from './CodeLabItem';
import { AssignmentItem } from './AssignmentItem';
import { ForumItem } from './ForumItem';
import { coursesApi } from '../../api/courses';
import { assignmentsApi } from '../../api/assignments';
import { surveysApi } from '../../api/surveys';
import type { ModuleSurvey } from '../../types';
import { Input, TextArea, Select } from '../common/Input';
import { getAuthToken } from '../../utils/auth';

interface ModuleItemProps {
  module: CourseModule & { labAssignments?: LabAssignment[] };
  courseId: number;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (module: CourseModule) => void;
  onDelete: (module: CourseModule) => void;
  onTogglePublish?: (module: CourseModule) => void;
  onMoveUp: (module: CourseModule) => void;
  onMoveDown: (module: CourseModule) => void;
  /**
   * Submit handler for the inline "+ Lesson" form. Returns the created
   * lecture id on success (or void if the parent handles errors via toast).
   */
  onSubmitInlineLecture: (moduleId: number, title: string) => Promise<unknown>;
  onAddLecture: (module: CourseModule) => void;
  onEditLecture: (lecture: Lecture) => void;
  onDeleteLecture: (lecture: Lecture) => void;
  onToggleLecturePublish?: (lecture: Lecture) => void;
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
  // Interactive lab handlers
  onRemoveInteractiveLab?: (module: CourseModule, labKey: string) => void;
  // Quiz handlers
  onAddQuiz?: (module: CourseModule) => void;
  onDeleteQuiz?: (quiz: ModuleQuiz) => void;
  // Lecture-level assignments keyed by lectureId
  lectureAssignments?: Record<number, Assignment[]>;
  // All surveys available for linking (from courseDetails)
  allSurveys?: ModuleSurvey[];
}

export const ModuleItem = ({
  module,
  courseId,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onTogglePublish,
  onMoveUp,
  onMoveDown,
  onSubmitInlineLecture,
  onAddLecture: _onAddLecture,
  onEditLecture,
  onDeleteLecture,
  onToggleLecturePublish,
  onMoveLectureUp: _onMoveLectureUp,
  onMoveLectureDown: _onMoveLectureDown,
  onAddCodeLab,
  onEditCodeLab,
  onDeleteCodeLab,
  onMoveCodeLabUp: _onMoveCodeLabUp,
  onMoveCodeLabDown: _onMoveCodeLabDown,
  onAddAssignment,
  onEditAssignment,
  onDeleteAssignment,
  onMoveAssignmentUp: _onMoveAssignmentUp,
  onMoveAssignmentDown: _onMoveAssignmentDown,
  onRemoveLabAssignment,
  onAddForum,
  onEditForum,
  onDeleteForum,
  onMoveForumUp: _onMoveForumUp,
  onMoveForumDown: _onMoveForumDown,
  onRemoveInteractiveLab,
  onAddQuiz,
  onDeleteQuiz,
  lectureAssignments = {},
  allSurveys: allSurveysProp = [],
}: ModuleItemProps) => {
  const { t } = useTranslation(['teaching']);
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [inlineLectureTitle, setInlineLectureTitle] = useState<string | null>(null);
  const [inlineLectureSubmitting, setInlineLectureSubmitting] = useState(false);
  const inlineLectureInputRef = useRef<HTMLInputElement>(null);

  const beginInlineLecture = () => {
    setInlineLectureTitle('');
    setIsExpanded(true);
    setTimeout(() => inlineLectureInputRef.current?.focus(), 0);
  };

  const cancelInlineLecture = () => {
    setInlineLectureTitle(null);
    setInlineLectureSubmitting(false);
  };

  const submitInlineLecture = async () => {
    const trimmed = (inlineLectureTitle ?? '').trim();
    if (!trimmed) return;
    setInlineLectureSubmitting(true);
    try {
      await onSubmitInlineLecture(module.id, trimmed);
      // Reset for the next one — leaves the form open so the user can add
      // multiple lessons in a row without re-clicking "+ Lesson".
      setInlineLectureTitle('');
      setTimeout(() => inlineLectureInputRef.current?.focus(), 0);
    } finally {
      setInlineLectureSubmitting(false);
    }
  };
  const [fileUploadLectureId, setFileUploadLectureId] = useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string; type: string; size: number } | null>(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Survey state
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [surveySearch, setSurveySearch] = useState('');

  // Use moduleSurveys from the module prop (loaded via courseDetails API)
  const moduleSurveys = module.moduleSurveys || [];

  const linkedSurveyIds = useMemo(() => new Set(moduleSurveys.map((ms: any) => ms.survey.id)), [moduleSurveys]);

  const filteredSurveys = useMemo(() => {
    return allSurveysProp
      .filter((s) => s.isPublished && !linkedSurveyIds.has(s.id))
      .filter((s) => !surveySearch || s.title.toLowerCase().includes(surveySearch.toLowerCase()));
  }, [allSurveysProp, linkedSurveyIds, surveySearch]);

  const addSurveyMutation = useMutation({
    mutationFn: (surveyId: number) => surveysApi.addSurveyToModule(courseId, module.id, surveyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      toast.success(t('survey_added'));
      setSurveyModalOpen(false);
      setSurveySearch('');
    },
    onError: () => toast.error(t('failed_to_add_survey')),
  });

  const removeSurveyMutation = useMutation({
    mutationFn: (surveyId: number) => surveysApi.removeSurveyFromModule(module.id, surveyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      toast.success(t('survey_removed'));
    },
  });

  const createFileSectionMutation = useMutation({
    mutationFn: ({ lectureId, file }: { lectureId: number; file: { name: string; url: string; type: string; size: number } }) =>
      coursesApi.createSection(lectureId, {
        type: 'file',
        fileName: file.name,
        fileUrl: file.url,
        fileType: file.type,
        fileSize: file.size,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      toast.success(t('file_uploaded'));
      closeFileModal();
    },
    onError: () => toast.error(t('failed_upload')),
  });

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getAuthToken();
      const response = await fetch('/api/uploads/file', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      const fileData = data.data || data;
      const uploaded = {
        name: file.name,
        url: fileData.url || fileData.path,
        type: file.name.split('.').pop() || '',
        size: file.size,
      };
      setUploadedFile(uploaded);
      setFileName(file.name);
    } catch {
      toast.error(t('failed_upload'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveFileSection = () => {
    if (!fileUploadLectureId || !uploadedFile) return;
    createFileSectionMutation.mutate({
      lectureId: fileUploadLectureId,
      file: { ...uploadedFile, name: fileName.trim() || uploadedFile.name },
    });
  };

  const closeFileModal = () => {
    setFileUploadLectureId(null);
    setUploadedFile(null);
    setFileName('');
    setIsUploading(false);
    setIsDragging(false);
  };

  // Assignment modal state
  const [assignmentLectureId, setAssignmentLectureId] = useState<number | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    instructions: '',
    submissionType: 'text' as 'text' | 'file' | 'mixed',
    dueDate: '',
    gracePeriodDeadline: '',
    points: 100,
    isPublished: false,
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async ({ lectureId, form }: { lectureId: number; form: typeof assignmentForm }) => {
      const newAssignment = await assignmentsApi.createAssignment(courseId, {
        ...form,
        moduleId: module.id,
        lectureId,
        dueDate: form.dueDate ? form.dueDate + ':00.000Z' : null,
        gracePeriodDeadline: form.gracePeriodDeadline ? form.gracePeriodDeadline + ':00.000Z' : null,
      });
      await coursesApi.createSection(lectureId, {
        type: 'assignment',
        assignmentId: newAssignment.id,
      });
      return newAssignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      toast.success(t('assignment_created'));
      closeAssignmentModal();
    },
    onError: () => toast.error(t('failed_to_create_assignment')),
  });

  const handleAssignmentFormChange = (field: string, value: string | number | boolean) => {
    setAssignmentForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentLectureId || !assignmentForm.title.trim()) {
      toast.error(t('title_required'));
      return;
    }
    createAssignmentMutation.mutate({ lectureId: assignmentLectureId, form: assignmentForm });
  };

  const closeAssignmentModal = () => {
    setAssignmentLectureId(null);
    setAssignmentForm({
      title: '', description: '', instructions: '',
      submissionType: 'text', dueDate: '', gracePeriodDeadline: '', points: 100, isPublished: false,
    });
  };

  const lectures = module.lectures || [];
  const codeLabs = module.codeLabs || [];
  const assignments = module.assignments || [];
  const labAssignments = module.labAssignments || [];
  const forums = module.forums || [];
  const quizzes = module.quizzes || [];
  const interactiveLabKeys = module.interactiveLabs
    ? module.interactiveLabs.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // Unified flat ordering for the 6 reorderable item types. Each entry
  // carries its type tag, its DB id (for the reorder endpoint), its
  // current orderIndex, and the underlying data. Sorted globally by
  // orderIndex with id as a stable tiebreaker.
  type FlatItem =
    | { type: 'lecture'; id: number; orderIndex: number; data: Lecture }
    | { type: 'codelab'; id: number; orderIndex: number; data: CodeLab }
    | { type: 'assignment'; id: number; orderIndex: number; data: Assignment }
    | { type: 'forum'; id: number; orderIndex: number; data: Forum }
    | { type: 'quiz'; id: number; orderIndex: number; data: ModuleQuiz }
    | { type: 'survey'; id: number; orderIndex: number; data: ModuleSurvey };
  const flatItems: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [
      ...lectures.map(l => ({ type: 'lecture' as const, id: l.id, orderIndex: l.orderIndex ?? 0, data: l })),
      ...codeLabs.map(c => ({ type: 'codelab' as const, id: c.id, orderIndex: c.orderIndex ?? 0, data: c })),
      ...assignments.map(a => ({ type: 'assignment' as const, id: a.id, orderIndex: (a as any).orderIndex ?? 0, data: a })),
      ...forums.map(f => ({ type: 'forum' as const, id: f.id, orderIndex: f.orderIndex ?? 0, data: f })),
      ...quizzes.map(q => ({ type: 'quiz' as const, id: q.id, orderIndex: (q as any).orderIndex ?? 0, data: q })),
      ...moduleSurveys.map((ms: any) => ({ type: 'survey' as const, id: ms.id, orderIndex: ms.orderIndex ?? 0, data: ms })),
    ];
    return items.sort((a, b) => (a.orderIndex - b.orderIndex) || (a.id - b.id));
  }, [lectures, codeLabs, assignments, forums, quizzes, moduleSurveys]);

  const reorderItemsMutation = useMutation({
    mutationFn: (items: { type: 'lecture' | 'codelab' | 'assignment' | 'forum' | 'quiz' | 'survey'; id: number }[]) =>
      coursesApi.reorderModuleItems(module.id, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
    },
    onError: () => toast.error(t('failed_to_reorder_modules', { defaultValue: 'Failed to reorder items' })),
  });

  const moveFlatItem = (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= flatItems.length) return;
    const reordered = [...flatItems];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    reorderItemsMutation.mutate(reordered.map(i => ({ type: i.type, id: i.id })));
  };

  // Uploaded file card derived values (only meaningful when uploadedFile != null)
  const fileExt = uploadedFile
    ? (uploadedFile.type || uploadedFile.name.split('.').pop() || '').toLowerCase()
    : '';
  const fileIsImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExt);
  const fileIsVideo = ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(fileExt);
  const fileIsAudio = ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(fileExt);
  const fileIsArchive = ['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExt);
  const fileIsPdf = fileExt === 'pdf';
  const fileIconBg = fileIsPdf ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
    : fileIsImage ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'
    : fileIsVideo ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-500'
    : fileIsAudio ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-500'
    : fileIsArchive ? 'bg-gray-100 dark:bg-gray-700 text-gray-500'
    : 'bg-green-50 dark:bg-green-900/20 text-green-600';
  const FileTypeIcon = fileIsImage ? FileImage
    : fileIsVideo ? FileVideo
    : fileIsAudio ? FileAudio
    : fileIsArchive ? FileArchive
    : FileText;
  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-teal-100 dark:border-teal-900/40 overflow-hidden">
      {/* Module Header — card hero. Distinct shape, gradient, and "Module"
          chip make this read as a container rather than a lesson row. */}
      <div className="relative flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-b border-teal-100 dark:border-teal-900/40">
        {/* Decorative dot texture, like dashboard StatTile cards. */}
        <svg
          className="absolute -top-2 -right-2 w-20 h-20 opacity-25 pointer-events-none"
          viewBox="0 0 60 60"
          aria-hidden="true"
        >
          {[0, 1, 2, 3].flatMap(r =>
            [0, 1, 2, 3].map(col => (
              <circle key={`m-${r}-${col}`} cx={6 + col * 16} cy={6 + r * 16} r={1.4} fill="#088F8F" />
            ))
          )}
        </svg>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 flex-shrink-0 font-bold text-lg"
          style={{ backgroundColor: 'rgba(8, 143, 143, 0.18)', color: '#066d6d' }}
          title={isExpanded ? t('collapse', { defaultValue: 'Collapse' }) : t('expand', { defaultValue: 'Expand' })}
          aria-expanded={isExpanded}
        >
          {(module.orderIndex ?? 0) + 1}
        </button>

        <div className="relative flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300 mb-0.5">
            {t('module', { defaultValue: 'Module' })}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
              {module.title}
            </h3>
            {!module.isPublished && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-800/50 dark:text-amber-200">
                {t('draft')}
              </span>
            )}
          </div>
        </div>

        <div className="relative flex items-center gap-1 flex-shrink-0">
          {/* Reorder buttons */}
          <button
            onClick={() => onMoveUp(module)}
            disabled={isFirst}
            className="p-1.5 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={t('move_up')}
          >
            <ChevronUp className="w-4 h-4 text-teal-700 dark:text-teal-300" />
          </button>
          <button
            onClick={() => onMoveDown(module)}
            disabled={isLast}
            className="p-1.5 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={t('move_down')}
          >
            <ChevronDown className="w-4 h-4 text-teal-700 dark:text-teal-300" />
          </button>

          {/* Action buttons */}
          {onTogglePublish && (
            <button
              onClick={() => onTogglePublish(module)}
              className={`p-1.5 rounded-lg transition-colors ${module.isPublished ? 'hover:bg-amber-100 dark:hover:bg-amber-900/30' : 'hover:bg-green-100 dark:hover:bg-green-900/30'}`}
              title={module.isPublished ? t('unpublish_module') : t('publish_module')}
            >
              {module.isPublished ? (
                <EyeOff className="w-4 h-4 text-amber-500" />
              ) : (
                <Eye className="w-4 h-4 text-green-500" />
              )}
            </button>
          )}
          <button
            onClick={() => onEdit(module)}
            className="p-1.5 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
            title={t('edit_module')}
          >
            <Edit className="w-4 h-4 text-teal-700 dark:text-teal-300" />
          </button>
          <button
            onClick={() => onDelete(module)}
            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            title={t('delete_module')}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {/* Lectures and Code Labs */}
      {isExpanded && (
        <div className="px-4 py-3 space-y-3">
          {module.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {module.description}
            </p>
          )}

          {(lectures.length > 0 ||
            codeLabs.length > 0 ||
            assignments.length > 0 ||
            forums.length > 0 ||
            quizzes.length > 0) && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
                {t('whats_included', { defaultValue: "What's included" })}
              </h4>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                {(() => {
                  // No icons. Always singular noun regardless of count.
                  const items: Array<{ count: number; label: string }> = [];
                  if (lectures.length > 0) items.push({ count: lectures.length, label: t('lesson', { defaultValue: 'Lesson' }) });
                  if (assignments.length > 0) items.push({ count: assignments.length, label: t('assignment', { defaultValue: 'Assignment' }) });
                  if (quizzes.length > 0) items.push({ count: quizzes.length, label: t('quiz_singular', { defaultValue: 'Quiz' }) });
                  if (forums.length > 0) items.push({ count: forums.length, label: t('forum', { defaultValue: 'Forum' }) });
                  if (codeLabs.length > 0) items.push({ count: codeLabs.length, label: t('code_lab', { defaultValue: 'Code Lab' }) });
                  return items.map(({ count, label }, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5">
                      <span className="tabular-nums">{count}</span>
                      <span>{label}</span>
                    </span>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Unified flat list — lessons interleaved with assignments,
              forums, quizzes, etc. Up/down buttons swap any two adjacent
              items regardless of type and persist the new orderIndex
              across all six types via /reorder-items. */}
          {flatItems.length > 0 ? (
            <div className="space-y-2">
              {flatItems.map((item, index) => {
                const isFirstInFlat = index === 0;
                const isLastInFlat = index === flatItems.length - 1;
                const handleMoveUp = () => moveFlatItem(index, 'up');
                const handleMoveDown = () => moveFlatItem(index, 'down');

                if (item.type === 'lecture') {
                  const lecture = item.data;
                  return (
                    <LectureItem
                      key={`lecture-${lecture.id}`}
                      lecture={lecture}
                      courseId={courseId}
                      isFirst={isFirstInFlat}
                      isLast={isLastInFlat}
                      onEdit={onEditLecture}
                      onDelete={onDeleteLecture}
                      onTogglePublish={onToggleLecturePublish}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      assignments={lectureAssignments[lecture.id] || []}
                      onEditAssignment={onEditAssignment}
                      onDeleteAssignment={onDeleteAssignment}
                    />
                  );
                }
                if (item.type === 'codelab') {
                  const codeLab = item.data;
                  return (
                    <CodeLabItem
                      key={`codelab-${codeLab.id}`}
                      codeLab={codeLab}
                      courseId={courseId}
                      isFirst={isFirstInFlat}
                      isLast={isLastInFlat}
                      onEdit={onEditCodeLab}
                      onDelete={onDeleteCodeLab}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                    />
                  );
                }
                if (item.type === 'assignment') {
                  const assignment = item.data;
                  return (
                    <AssignmentItem
                      key={`assign-${assignment.id}`}
                      assignment={assignment}
                      courseId={courseId}
                      isFirst={isFirstInFlat}
                      isLast={isLastInFlat}
                      onEdit={onEditAssignment}
                      onDelete={onDeleteAssignment}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                    />
                  );
                }
                if (item.type === 'forum' && onEditForum && onDeleteForum) {
                  const forum = item.data;
                  return (
                    <ForumItem
                      key={`forum-${forum.id}`}
                      forum={forum}
                      courseId={courseId}
                      isFirst={isFirstInFlat}
                      isLast={isLastInFlat}
                      onEdit={onEditForum}
                      onDelete={onDeleteForum}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                    />
                  );
                }
                if (item.type === 'quiz') {
                  const quiz = item.data;
                  return (
                    <div
                      key={`quiz-${quiz.id}`}
                      className="flex items-center gap-3 p-3 min-h-[64px] bg-cyan-50 dark:bg-cyan-900/20 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded bg-white border border-cyan-200 flex-shrink-0">
                        <FileQuestion className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/teach/courses/${courseId}/quizzes/${quiz.id}`}
                          className="block text-sm font-medium text-gray-900 dark:text-white truncate hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                        >
                          {quiz.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                          <span className="text-cyan-600 font-medium">{t('quiz_singular', { defaultValue: 'Quiz' })}</span>
                          <span>•</span>
                          <span>{quiz._count?.questions || 0} {t('questions')}</span>
                          {!quiz.isPublished && (
                            <>
                              <span>•</span>
                              <span className="text-amber-600">{t('draft')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={handleMoveUp}
                          disabled={isFirstInFlat}
                          className="p-1 rounded hover:bg-cyan-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={t('move_up')}
                        >
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={handleMoveDown}
                          disabled={isLastInFlat}
                          className="p-1 rounded hover:bg-cyan-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={t('move_down')}
                        >
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        </button>
                        {onDeleteQuiz && (
                          <button
                            onClick={() => onDeleteQuiz(quiz)}
                            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            title={t('delete_quiz')}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
                if (item.type === 'survey') {
                  const ms: any = item.data;
                  return (
                    <div
                      key={`survey-${ms.id}`}
                      className="flex items-center gap-3 p-3 min-h-[64px] rounded-lg bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded bg-white border border-indigo-200 flex-shrink-0">
                        <ClipboardCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {ms.survey.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                          <span className="text-indigo-600 font-medium">{t('survey_singular', { defaultValue: 'Survey' })}</span>
                          <span>•</span>
                          <span>{ms.survey._count?.questions || 0} {t('questions')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={handleMoveUp}
                          disabled={isFirstInFlat}
                          className="p-1 rounded hover:bg-indigo-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={t('move_up')}
                        >
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={handleMoveDown}
                          disabled={isLastInFlat}
                          className="p-1 rounded hover:bg-indigo-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={t('move_down')}
                        >
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => removeSurveyMutation.mutate(ms.survey.id)}
                          className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          title={t('remove_from_module')}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              {t('no_lessons_yet')}
            </p>
          )}

          {/* Lab templates and interactive labs render as a separate
              auxiliary section — they don't carry a reorderable
              orderIndex, so they live below the unified list. */}
          {(labAssignments.length + interactiveLabKeys.length) > 0 && (
            <div className="pt-2 border-t border-gray-100 mt-2 space-y-2">
              {labAssignments.map(labAssignment => (
                <div
                  key={`labassign-${labAssignment.id}`}
                  className="flex items-center gap-3 p-3 min-h-[64px] rounded-lg bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded bg-white border border-teal-200 flex-shrink-0">
                    <Beaker className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {labAssignment.lab?.name || t('lab_template')}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                      <span className="text-teal-600 font-medium">{labAssignment.lab?.labType || t('lab_template')}</span>
                      <span>•</span>
                      <span>{t('x_templates', { count: labAssignment.lab?._count?.templates || labAssignment.lab?.templates?.length || 0 })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link
                      to={`/labs/${labAssignment.labId}?courseId=${courseId}`}
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

              {interactiveLabKeys.map(labKey => (
                <div
                  key={`ilab-${labKey}`}
                  className="flex items-center gap-3 p-3 min-h-[64px] rounded-lg bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded bg-white border border-violet-200 flex-shrink-0">
                    <Network className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {labKey === 'tna' ? t('interactive_lab_tna') : labKey === 'sna' ? t('interactive_lab_sna') : labKey}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                      <span className="text-violet-600 font-medium">{t('interactive')}</span>
                    </div>
                  </div>
                  {onRemoveInteractiveLab && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => onRemoveInteractiveLab(module, labKey)}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        title={t('remove_from_module')}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Inline "+ Lesson" form — appears in place when the user clicks
              the action button below. Stays open after Save so the user
              can rapid-fire add multiple lessons. Esc / Cancel closes it. */}
          {inlineLectureTitle !== null && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <form
                onSubmit={e => { e.preventDefault(); submitInlineLecture(); }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inlineLectureInputRef}
                  type="text"
                  value={inlineLectureTitle}
                  onChange={e => setInlineLectureTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') cancelInlineLecture(); }}
                  placeholder={t('lesson_title_placeholder', { defaultValue: 'Lesson title' })}
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={inlineLectureSubmitting}
                />
                <Button
                  type="submit"
                  size="sm"
                  loading={inlineLectureSubmitting}
                  disabled={!(inlineLectureTitle ?? '').trim()}
                >
                  {t('common:save', { defaultValue: 'Save' })}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={cancelInlineLecture}
                  disabled={inlineLectureSubmitting}
                >
                  {t('common:cancel', { defaultValue: 'Cancel' })}
                </Button>
              </form>
            </div>
          )}

          {/* Module-level add buttons — always visible at module footer */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={beginInlineLecture}
              icon={<Plus className="w-4 h-4" />}
              className="flex-1 min-w-[100px]"
            >
              {t('lesson', { defaultValue: 'Lesson' })}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddCodeLab(module)}
              icon={<Plus className="w-4 h-4" />}
              className="flex-1 min-w-[100px] text-emerald-600 hover:bg-emerald-50"
            >
              {t('code_lab', { defaultValue: 'Code Lab' })}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddAssignment(module)}
              icon={<Plus className="w-4 h-4" />}
              className="flex-1 min-w-[100px] text-amber-600 hover:bg-amber-50"
            >
              {t('assignment', { defaultValue: 'Assignment' })}
            </Button>
            {onAddForum && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddForum(module)}
                icon={<Plus className="w-4 h-4" />}
                className="flex-1 min-w-[100px] text-teal-600 hover:bg-teal-50"
              >
                {t('forum', { defaultValue: 'Forum' })}
              </Button>
            )}
            {onAddQuiz && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddQuiz(module)}
                icon={<Plus className="w-4 h-4" />}
                className="flex-1 min-w-[100px] text-cyan-600 hover:bg-cyan-50"
              >
                {t('quiz_singular', { defaultValue: 'Quiz' })}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSurveyModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
              className="flex-1 min-w-[100px] text-indigo-600 hover:bg-indigo-50"
            >
              {t('survey_singular', { defaultValue: 'Survey' })}
            </Button>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      <Modal isOpen={fileUploadLectureId !== null} onClose={closeFileModal} title={t('upload_file')} size="3xl">
        <div className="space-y-4">
          {!uploadedFile ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]); }}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
                  <p className="text-sm text-gray-600">{t('uploading_file')}</p>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">{t('drag_drop_file')}</p>
                  <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                    {t('choose_file')}
                  </Button>
                  <p className="text-xs text-gray-400 mt-2">{t('file_types_limit')}</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.mp4,.mov,.mp3,.wav,.zip"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Uploaded file card */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  {/* File type icon */}
                  <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${fileIconBg}`}>
                    <FileTypeIcon className="w-6 h-6" />
                  </div>

                  {/* Inline editable name + metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 group">
                      <input
                        type="text"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        className="flex-1 min-w-0 text-sm font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-transparent focus:border-green-500 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600 pb-0.5 transition-colors"
                        autoFocus
                      />
                      <Pencil className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-focus-within:text-green-500 flex-shrink-0 transition-colors" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{fileExt}</span>
                      {uploadedFile.size > 0 && (
                        <>
                          <span className="text-gray-200 dark:text-gray-700">·</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{formatFileSize(uploadedFile.size)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => { setUploadedFile(null); setFileName(''); }}
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title={t('remove')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Upload success bar */}
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border-t border-green-100 dark:border-green-900/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span className="text-xs text-green-700 dark:text-green-400">{t('file_uploaded_ready')}</span>
                  <span className="text-xs text-green-500 dark:text-green-500 ml-auto">{t('click_name_to_rename')}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={closeFileModal}>
                  {t('cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveFileSection}
                  loading={createFileSectionMutation.isPending}
                  disabled={!fileName.trim()}
                >
                  {t('save')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Assignment Creation Modal */}
      <Modal isOpen={assignmentLectureId !== null} onClose={closeAssignmentModal} title={t('create_assignment')} size="3xl">
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          <Input
            label={t('title')}
            value={assignmentForm.title}
            onChange={e => handleAssignmentFormChange('title', e.target.value)}
            placeholder={t('assignment_title_placeholder')}
            required
          />

          <TextArea
            label={t('description')}
            value={assignmentForm.description}
            onChange={e => handleAssignmentFormChange('description', e.target.value)}
            placeholder={t('assignment_description_placeholder')}
            rows={2}
          />

          <TextArea
            label={t('instructions')}
            value={assignmentForm.instructions}
            onChange={e => handleAssignmentFormChange('instructions', e.target.value)}
            placeholder={t('assignment_instructions_placeholder')}
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('submission_type')}
              value={assignmentForm.submissionType}
              onChange={e => handleAssignmentFormChange('submissionType', e.target.value)}
              options={[
                { value: 'text', label: t('text_entry') },
                { value: 'file', label: t('file_upload') },
                { value: 'mixed', label: t('text_and_file') },
              ]}
            />
            <Input
              label={t('points')}
              type="number"
              value={assignmentForm.points}
              onChange={e => handleAssignmentFormChange('points', parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>

          <Input
            label={t('due_date')}
            type="datetime-local"
            value={assignmentForm.dueDate}
            onChange={e => {
              handleAssignmentFormChange('dueDate', e.target.value);
              if (!e.target.value) handleAssignmentFormChange('gracePeriodDeadline', '');
            }}
          />

          <Input
            label={t('courses:grace_period_deadline', { defaultValue: 'Grace Period Deadline' })}
            type="datetime-local"
            value={assignmentForm.gracePeriodDeadline}
            onChange={e => handleAssignmentFormChange('gracePeriodDeadline', e.target.value)}
            disabled={!assignmentForm.dueDate}
            min={assignmentForm.dueDate || undefined}
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id={`isPublished-${module.id}`}
              checked={assignmentForm.isPublished}
              onChange={e => handleAssignmentFormChange('isPublished', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor={`isPublished-${module.id}`} className="text-sm text-gray-700">
              {t('publish_immediately')}
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={closeAssignmentModal}>
              {t('cancel')}
            </Button>
            <Button type="submit" size="sm" loading={createAssignmentMutation.isPending}>
              {t('create_assignment')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Survey Selection Modal */}
      <Modal isOpen={surveyModalOpen} onClose={() => { setSurveyModalOpen(false); setSurveySearch(''); }} title={t('select_survey')} size="3xl">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              autoFocus
              type="text"
              value={surveySearch}
              onChange={e => setSurveySearch(e.target.value)}
              placeholder={t('search_surveys')}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {filteredSurveys.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-400 text-center">{t('no_surveys_available')}</p>
            ) : (
              filteredSurveys.map((survey: any) => (
                <button
                  key={survey.id}
                  onClick={() => addSurveyMutation.mutate(survey.id)}
                  disabled={addSurveyMutation.isPending}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors text-gray-700 hover:bg-indigo-50"
                >
                  <ClipboardCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{survey.title}</span>
                    <span className="text-xs text-gray-400">{survey._count?.questions || 0} {t('questions')}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
