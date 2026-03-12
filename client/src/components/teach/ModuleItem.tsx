import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  Plus,
  ChevronUp,
  GripVertical,
  Eye,
  EyeOff,
  FlaskConical,
  ClipboardList,
  FileText,
  Upload,
  Sparkles,
  MessageCircle,
  Beaker,
  ExternalLink,
  MessageSquare,
  Network,
  Loader2,
  Pencil,
  X,
  Search,
  ListChecks,
  FileQuestion,
} from 'lucide-react';
import { CourseModule, Lecture, CodeLab, Assignment, LabAssignment, Forum } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { LectureItem } from './LectureItem';
import { CodeLabItem } from './CodeLabItem';
import { AssignmentItem } from './AssignmentItem';
import { ForumItem } from './ForumItem';
import { coursesApi } from '../../api/courses';
import { assignmentsApi } from '../../api/assignments';
import { surveysApi } from '../../api/surveys';
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
  // Lecture-level assignments keyed by lectureId
  lectureAssignments?: Record<number, Assignment[]>;
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
  onAddLecture,
  onEditLecture,
  onDeleteLecture,
  onToggleLecturePublish,
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
  onRemoveInteractiveLab,
  onAddQuiz,
  lectureAssignments = {},
}: ModuleItemProps) => {
  const { t } = useTranslation(['teaching']);
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [fileUploadLectureId, setFileUploadLectureId] = useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string; type: string; size: number } | null>(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Survey state
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [surveySearch, setSurveySearch] = useState('');

  const { data: moduleSurveys = [] } = useQuery({
    queryKey: ['moduleSurveys', module.id],
    queryFn: () => surveysApi.getModuleSurveys(module.id),
  });

  const { data: allSurveys = [] } = useQuery({
    queryKey: ['surveys'],
    queryFn: () => surveysApi.getSurveys(),
    enabled: surveyModalOpen,
  });

  const linkedSurveyIds = useMemo(() => new Set(moduleSurveys.map((ms: any) => ms.survey.id)), [moduleSurveys]);

  const filteredSurveys = useMemo(() => {
    return allSurveys
      .filter((s: any) => s.isPublished && !linkedSurveyIds.has(s.id))
      .filter((s: any) => !surveySearch || s.title.toLowerCase().includes(surveySearch.toLowerCase()));
  }, [allSurveys, linkedSurveyIds, surveySearch]);

  const addSurveyMutation = useMutation({
    mutationFn: (surveyId: number) => surveysApi.addSurveyToModule(courseId, module.id, surveyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moduleSurveys', module.id] });
      toast.success(t('survey_added'));
      setSurveyModalOpen(false);
      setSurveySearch('');
    },
    onError: () => toast.error(t('failed_to_add_survey')),
  });

  const removeSurveyMutation = useMutation({
    mutationFn: (surveyId: number) => surveysApi.removeSurveyFromModule(module.id, surveyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moduleSurveys', module.id] });
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
      submissionType: 'text', dueDate: '', points: 100, isPublished: false,
    });
  };

  const lectures = module.lectures || [];
  const codeLabs = module.codeLabs || [];
  const assignments = module.assignments || [];
  const labAssignments = module.labAssignments || [];
  const forums = module.forums || [];
  const interactiveLabKeys = module.interactiveLabs
    ? module.interactiveLabs.split(',').map(s => s.trim()).filter(Boolean)
    : [];

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
            {!module.isPublished && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                {t('draft')}
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
            {interactiveLabKeys.length > 0 && ` • ${t('x_interactive_labs', { count: interactiveLabKeys.length })}`}
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
          {onTogglePublish && (
            <button
              onClick={() => onTogglePublish(module)}
              className={`p-1.5 rounded transition-colors ${module.isPublished ? 'hover:bg-amber-100' : 'hover:bg-green-100'}`}
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
                    onTogglePublish={onToggleLecturePublish}
                    onMoveUp={() => onMoveLectureUp(lecture, module)}
                    onMoveDown={() => onMoveLectureDown(lecture, module)}
                    assignments={lectureAssignments[lecture.id] || []}
                    onEditAssignment={onEditAssignment}
                    onDeleteAssignment={onDeleteAssignment}
                  />
                  {/* Inline add options — only for empty lectures (no sections) */}
                  {(!lecture.sections || lecture.sections.length === 0) && (
                    <div className="flex items-center gap-1.5 py-2 px-3 ml-6 border-l-2 border-dashed border-gray-200 flex-wrap">
                      <span className="text-xs text-gray-400 mr-1">{t('add')}:</span>
                      <Link
                        to={`/teach/courses/${courseId}/lectures/${lecture.id}?addSection=text`}
                        className="text-xs px-2 py-1 rounded-md border border-blue-200 hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
                        title={t('add_text_section')}
                      >
                        <FileText className="w-3 h-3" />
                        {t('section_type_text')}
                      </Link>
                      <button
                        onClick={() => setFileUploadLectureId(lecture.id)}
                        className="text-xs px-2 py-1 rounded-md border border-green-200 hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors flex items-center gap-1"
                        title={t('add_file_section')}
                      >
                        <Upload className="w-3 h-3" />
                        {t('section_type_file')}
                      </button>
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
                      <button
                        onClick={() => setAssignmentLectureId(lecture.id)}
                        className="text-xs px-2 py-1 rounded-md border border-rose-200 hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1"
                        title={t('add_assignment')}
                      >
                        <ClipboardList className="w-3 h-3" />
                        {t('assignment')}
                      </button>
                    </div>
                  )}
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

          {/* Interactive Labs */}
          {interactiveLabKeys.length > 0 && (
            <div className="pt-2 border-t border-gray-100 mt-2 space-y-2">
              {interactiveLabKeys.map(labKey => (
                <div
                  key={labKey}
                  className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800"
                >
                  <Network className="w-5 h-5 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {labKey === 'tna' ? t('interactive_lab_tna') : labKey === 'sna' ? t('interactive_lab_sna') : labKey}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-800 text-violet-700 dark:text-violet-300 ml-2">
                      {t('interactive')}
                    </span>
                  </div>
                  {onRemoveInteractiveLab && (
                    <button
                      onClick={() => onRemoveInteractiveLab(module, labKey)}
                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      title={t('remove_from_module')}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Surveys */}
          {moduleSurveys.length > 0 && (
            <div className="pt-2 border-t border-gray-100 mt-2 grid grid-cols-2 gap-1.5">
              {moduleSurveys.map((ms: any) => (
                <div
                  key={ms.id}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800"
                >
                  <ListChecks className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">
                      {ms.survey.title}
                    </span>
                    <span className="text-xs text-gray-500">
                      {ms.survey._count?.questions || 0} {t('questions')}
                    </span>
                  </div>
                  <button
                    onClick={() => removeSurveyMutation.mutate(ms.survey.id)}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    title={t('remove_from_module')}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Module-level add buttons — always visible at module footer */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
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
            {onAddQuiz && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddQuiz(module)}
                icon={<FileQuestion className="w-4 h-4" />}
                className="flex-1 min-w-[120px] text-cyan-600 hover:bg-cyan-50"
              >
                {t('add_quiz')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSurveyModalOpen(true)}
              icon={<ListChecks className="w-4 h-4" />}
              className="flex-1 min-w-[120px] text-indigo-600 hover:bg-indigo-50"
            >
              {t('add_survey')}
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
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="text-sm text-green-800 truncate flex-1">{uploadedFile.name}</span>
                <button
                  onClick={() => { setUploadedFile(null); setFileName(''); }}
                  className="p-1 rounded hover:bg-green-100 transition-colors"
                >
                  <X className="w-4 h-4 text-green-600" />
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('file_name')}</label>
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
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
            onChange={e => handleAssignmentFormChange('dueDate', e.target.value)}
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
                  <ListChecks className="w-4 h-4 text-indigo-500 shrink-0" />
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
