import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Settings, Eye, EyeOff, Layers, FileEdit, Bot, ChevronDown, Heart, Beaker, Check, ExternalLink, FileQuestion, MessageSquare, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { codeLabsApi } from '../../api/codeLabs';
import { assignmentsApi } from '../../api/assignments';
import { courseTutorApi } from '../../api/courseTutor';
import { customLabsApi } from '../../api/customLabs';
import { forumsApi, Forum, CreateForumInput } from '../../api/forums';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Input, TextArea, Select } from '../../components/common/Input';
import { ModuleItem } from '../../components/teach/ModuleItem';
import { CourseModule, Lecture, CodeLab, Assignment, CustomLab, LabTemplate, LabAssignment } from '../../types';

interface ModuleFormData {
  title: string;
  description: string;
  label: string;
}

interface LectureFormData {
  title: string;
  contentType: 'text' | 'video' | 'mixed';
  duration: number;
  isFree: boolean;
}

interface CodeLabFormData {
  title: string;
  description: string;
}

type CodeLabModalTab = 'create' | 'templates';

interface AssignmentFormData {
  title: string;
  description: string;
  submissionType: 'text' | 'file' | 'mixed' | 'ai_agent';
  points: number;
  dueDate: string;
  isPublished: boolean;
}

interface ForumFormData {
  title: string;
  description: string;
  isPublished: boolean;
  allowAnonymous: boolean;
}

export const CurriculumEditor = () => {
  const { t } = useTranslation('teaching');
  const { id } = useParams<{ id: string }>();
  const courseId = parseInt(id!, 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();

  // Dropdown state
  const [addContentOpen, setAddContentOpen] = useState(false);

  // Modal states
  const [moduleModal, setModuleModal] = useState<{ isOpen: boolean; module?: CourseModule }>({
    isOpen: false,
  });
  const [lectureModal, setLectureModal] = useState<{
    isOpen: boolean;
    moduleId?: number;
    lecture?: Lecture;
  }>({ isOpen: false });
  const [deleteModuleConfirm, setDeleteModuleConfirm] = useState<CourseModule | null>(null);
  const [deleteLectureConfirm, setDeleteLectureConfirm] = useState<Lecture | null>(null);
  const [codeLabModal, setCodeLabModal] = useState<{
    isOpen: boolean;
    moduleId?: number;
    codeLab?: CodeLab;
  }>({ isOpen: false });
  const [codeLabModalTab, setCodeLabModalTab] = useState<CodeLabModalTab>('create');
  const [selectedLabTemplate, setSelectedLabTemplate] = useState<{ lab: CustomLab; templates: LabTemplate[] } | null>(null);
  const [deleteCodeLabConfirm, setDeleteCodeLabConfirm] = useState<CodeLab | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<{
    isOpen: boolean;
    moduleId?: number;
    assignment?: Assignment;
  }>({ isOpen: false });
  const [deleteAssignmentConfirm, setDeleteAssignmentConfirm] = useState<Assignment | null>(null);
  const [forumModal, setForumModal] = useState<{
    isOpen: boolean;
    moduleId?: number;
    forum?: Forum;
  }>({ isOpen: false });
  const [deleteForumConfirm, setDeleteForumConfirm] = useState<Forum | null>(null);
  const [deleteCourseConfirm, setDeleteCourseConfirm] = useState(false);

  // Form states
  const [moduleForm, setModuleForm] = useState<ModuleFormData>({ title: '', description: '', label: '' });
  const [lectureForm, setLectureForm] = useState<LectureFormData>({
    title: '',
    contentType: 'text',
    duration: 0,
    isFree: false,
  });
  const [codeLabForm, setCodeLabForm] = useState<CodeLabFormData>({ title: '', description: '' });
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormData>({
    title: '',
    description: '',
    submissionType: 'text',
    points: 100,
    dueDate: '',
    isPublished: false,
  });
  const [forumForm, setForumForm] = useState<ForumFormData>({
    title: '',
    description: '',
    isPublished: true,
    allowAnonymous: false,
  });

  // Queries
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  // Derive modules from course data (already includes modules with nested lectures/codeLabs)
  const modules = course?.modules ?? [];
  const modulesLoading = courseLoading;

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['courseAssignments', courseId],
    queryFn: () => assignmentsApi.getAssignments(courseId),
    enabled: !!courseId,
  });

  const { data: courseTutors } = useQuery({
    queryKey: ['courseTutors', courseId],
    queryFn: () => courseTutorApi.getCourseTutors(courseId),
    enabled: !!courseId,
  });

  // Fetch all accessible labs (public + created by instructor)
  const { data: availableLabs } = useQuery({
    queryKey: ['availableLabs'],
    queryFn: () => customLabsApi.getLabs(),
  });

  // Fetch labs already assigned to this course
  const { data: courseLabAssignments } = useQuery({
    queryKey: ['courseLabAssignments', courseId],
    queryFn: () => customLabsApi.getLabsForCourse(courseId),
    enabled: !!courseId,
  });

  // Fetch forums for the course
  const { data: courseForums } = useQuery({
    queryKey: ['courseForums', courseId],
    queryFn: () => forumsApi.getForums(courseId),
    enabled: !!courseId,
  });

  // Mutations
  const createModuleMutation = useMutation({
    mutationFn: (data: ModuleFormData) => coursesApi.createModule(courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('module_created'));
      closeModuleModal();
    },
    onError: () => toast.error(t('failed_to_create_module')),
  });

  const updateModuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ModuleFormData }) =>
      coursesApi.updateModule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('module_updated'));
      closeModuleModal();
    },
    onError: () => toast.error(t('failed_to_update_module')),
  });

  const deleteModuleMutation = useMutation({
    mutationFn: (id: number) => coursesApi.deleteModule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('module_deleted'));
      setDeleteModuleConfirm(null);
    },
    onError: () => toast.error(t('failed_to_delete_module')),
  });

  const toggleModulePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      coursesApi.updateModule(id, { isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('module_updated'));
    },
    onError: () => toast.error(t('failed_to_update_module')),
  });

  const reorderModulesMutation = useMutation({
    mutationFn: (moduleIds: number[]) => coursesApi.reorderModules(courseId, moduleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
    onError: () => toast.error(t('failed_to_reorder_modules')),
  });

  const createLectureMutation = useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: number; data: LectureFormData }) =>
      coursesApi.createLecture(moduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('lesson_created'));
      closeLectureModal();
    },
    onError: () => toast.error(t('failed_to_create_lesson')),
  });

  const updateLectureMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LectureFormData }) =>
      coursesApi.updateLecture(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('lesson_updated'));
      closeLectureModal();
    },
    onError: () => toast.error(t('failed_to_update_lesson')),
  });

  const toggleLecturePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      coursesApi.updateLecture(id, { isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('lesson_updated'));
    },
    onError: () => toast.error(t('failed_to_update_lesson')),
  });

  const deleteLectureMutation = useMutation({
    mutationFn: (id: number) => coursesApi.deleteLecture(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('lesson_deleted'));
      setDeleteLectureConfirm(null);
    },
    onError: () => toast.error(t('failed_to_delete_lesson')),
  });

  const publishMutation = useMutation({
    mutationFn: () => coursesApi.publishCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      toast.success(t('course_published'));
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.response?.data?.error || t('failed_to_publish_course');
      toast.error(msg);
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: () => coursesApi.unpublishCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      toast.success(t('course_unpublished'));
    },
    onError: () => toast.error(t('failed_to_unpublish_course')),
  });

  const deleteCourseMutation = useMutation({
    mutationFn: () => coursesApi.deleteCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      toast.success(t('course_deleted'));
      navigate('/teach');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.response?.data?.error || t('failed_to_delete_course');
      toast.error(msg);
    },
  });

  // Code Lab mutations
  const createCodeLabMutation = useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: number; data: CodeLabFormData }) =>
      codeLabsApi.createCodeLab({ moduleId, title: data.title, description: data.description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('code_lab_created'));
      closeCodeLabModal();
    },
    onError: () => toast.error(t('failed_to_create_code_lab')),
  });

  const updateCodeLabMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CodeLabFormData }) =>
      codeLabsApi.updateCodeLab(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('code_lab_updated'));
      closeCodeLabModal();
    },
    onError: () => toast.error(t('failed_to_update_code_lab')),
  });

  const deleteCodeLabMutation = useMutation({
    mutationFn: (id: number) => codeLabsApi.deleteCodeLab(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('code_lab_deleted'));
      setDeleteCodeLabConfirm(null);
    },
    onError: () => toast.error(t('failed_to_delete_code_lab')),
  });

  // Assign lab template to course
  const assignLabMutation = useMutation({
    mutationFn: ({ labId, moduleId }: { labId: number; moduleId?: number }) =>
      customLabsApi.assignToCourse(labId, { courseId, moduleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseLabAssignments', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('lab_template_added'));
      closeCodeLabModal();
    },
    onError: () => toast.error(t('failed_to_add_lab_template')),
  });

  // Unassign lab template from course
  const unassignLabMutation = useMutation({
    mutationFn: (labId: number) => customLabsApi.unassignFromCourse(labId, courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseLabAssignments', courseId] });
      toast.success(t('lab_template_removed'));
    },
    onError: () => toast.error(t('failed_to_remove_lab_template')),
  });

  // Assignment mutations
  const createAssignmentMutation = useMutation({
    mutationFn: (data: AssignmentFormData & { moduleId: number }) =>
      assignmentsApi.createAssignment(courseId, {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      toast.success(t('assignment_created'));
      closeAssignmentModal();
    },
    onError: (error: any) => {
      console.error('Failed to create assignment:', error);
      const message = error?.response?.data?.message || error?.message || 'Unknown error';
      toast.error(`${t('failed_to_create_assignment')}: ${message}`);
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AssignmentFormData & { moduleId?: number } }) =>
      assignmentsApi.updateAssignment(id, {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      toast.success(t('assignment_updated'));
      closeAssignmentModal();
    },
    onError: (error: any) => {
      console.error('Failed to update assignment:', error);
      const message = error?.response?.data?.message || error?.message || 'Unknown error';
      toast.error(`${t('failed_to_update_assignment')}: ${message}`);
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (id: number) => assignmentsApi.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      toast.success(t('assignment_deleted'));
      setDeleteAssignmentConfirm(null);
    },
    onError: () => toast.error(t('failed_to_delete_assignment')),
  });

  // Forum mutations
  const createForumMutation = useMutation({
    mutationFn: (data: CreateForumInput) => forumsApi.createForum(courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseForums', courseId] });
      toast.success(t('forum_created'));
      closeForumModal();
    },
    onError: () => toast.error(t('failed_to_create_forum')),
  });

  const updateForumMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateForumInput> }) =>
      forumsApi.updateForum(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseForums', courseId] });
      toast.success(t('forum_updated'));
      closeForumModal();
    },
    onError: () => toast.error(t('failed_to_update_forum')),
  });

  const deleteForumMutation = useMutation({
    mutationFn: (id: number) => forumsApi.deleteForum(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseForums', courseId] });
      toast.success(t('forum_deleted'));
      setDeleteForumConfirm(null);
    },
    onError: () => toast.error(t('failed_to_delete_forum')),
  });

  // Modal handlers
  const openAddModuleModal = () => {
    setModuleForm({ title: '', description: '', label: '' });
    setModuleModal({ isOpen: true });
  };

  const openEditModuleModal = (module: CourseModule) => {
    setModuleForm({ title: module.title, description: module.description || '', label: module.label || '' });
    setModuleModal({ isOpen: true, module });
  };

  const closeModuleModal = () => {
    setModuleModal({ isOpen: false });
    setModuleForm({ title: '', description: '', label: '' });
  };

  const openAddLectureModal = (module: CourseModule) => {
    setLectureForm({ title: '', contentType: 'text', duration: 0, isFree: false });
    setLectureModal({ isOpen: true, moduleId: module.id });
  };

  const openEditLectureModal = (lecture: Lecture) => {
    setLectureForm({
      title: lecture.title,
      contentType: lecture.contentType,
      duration: lecture.duration || 0,
      isFree: lecture.isFree,
    });
    setLectureModal({ isOpen: true, lecture });
  };

  const closeLectureModal = () => {
    setLectureModal({ isOpen: false });
    setLectureForm({ title: '', contentType: 'text', duration: 0, isFree: false });
  };

  const openAddCodeLabModal = (module: CourseModule) => {
    setCodeLabForm({ title: '', description: '' });
    setCodeLabModal({ isOpen: true, moduleId: module.id });
  };

  const openEditCodeLabModal = (codeLab: CodeLab) => {
    setCodeLabForm({ title: codeLab.title, description: codeLab.description || '' });
    setCodeLabModal({ isOpen: true, codeLab });
  };

  const closeCodeLabModal = () => {
    setCodeLabModal({ isOpen: false });
    setCodeLabForm({ title: '', description: '' });
    setCodeLabModalTab('create');
    setSelectedLabTemplate(null);
  };

  const openAddAssignmentModal = (module: CourseModule) => {
    setAssignmentForm({
      title: '',
      description: '',
      submissionType: 'text',
      points: 100,
      dueDate: '',
      isPublished: false,
    });
    setAssignmentModal({ isOpen: true, moduleId: module.id });
  };

  const openEditAssignmentModal = (assignment: Assignment) => {
    setAssignmentForm({
      title: assignment.title,
      description: assignment.description || '',
      submissionType: assignment.submissionType,
      points: assignment.points,
      dueDate: assignment.dueDate ? assignment.dueDate.split('T')[0] : '',
      isPublished: assignment.isPublished,
    });
    setAssignmentModal({ isOpen: true, assignment });
  };

  const closeAssignmentModal = () => {
    setAssignmentModal({ isOpen: false });
    setAssignmentForm({
      title: '',
      description: '',
      submissionType: 'text',
      points: 100,
      dueDate: '',
      isPublished: false,
    });
  };

  const openAddForumModal = (module: CourseModule) => {
    setForumForm({ title: '', description: '', isPublished: true, allowAnonymous: false });
    setForumModal({ isOpen: true, moduleId: module.id });
  };

  const openEditForumModal = (forum: Forum) => {
    setForumForm({
      title: forum.title,
      description: forum.description || '',
      isPublished: forum.isPublished,
      allowAnonymous: forum.allowAnonymous,
    });
    setForumModal({ isOpen: true, forum });
  };

  const closeForumModal = () => {
    setForumModal({ isOpen: false });
    setForumForm({ title: '', description: '', isPublished: true, allowAnonymous: false });
  };

  // Form handlers
  const handleModuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleForm.title.trim()) {
      toast.error(t('module_title_required'));
      return;
    }

    if (moduleModal.module) {
      updateModuleMutation.mutate({ id: moduleModal.module.id, data: moduleForm });
    } else {
      createModuleMutation.mutate(moduleForm);
    }
  };

  const handleLectureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lectureForm.title.trim()) {
      toast.error(t('lesson_title_required'));
      return;
    }

    if (lectureModal.lecture) {
      updateLectureMutation.mutate({ id: lectureModal.lecture.id, data: lectureForm });
    } else if (lectureModal.moduleId) {
      createLectureMutation.mutate({ moduleId: lectureModal.moduleId, data: lectureForm });
    }
  };

  const handleCodeLabSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeLabForm.title.trim()) {
      toast.error(t('code_lab_title_required'));
      return;
    }

    if (codeLabModal.codeLab) {
      updateCodeLabMutation.mutate({ id: codeLabModal.codeLab.id, data: codeLabForm });
    } else if (codeLabModal.moduleId) {
      createCodeLabMutation.mutate({ moduleId: codeLabModal.moduleId, data: codeLabForm });
    }
  };

  const handleAssignmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentForm.title.trim()) {
      toast.error(t('title_required'));
      return;
    }

    if (assignmentModal.assignment) {
      updateAssignmentMutation.mutate({
        id: assignmentModal.assignment.id,
        data: {
          ...assignmentForm,
          moduleId: assignmentModal.assignment.moduleId || undefined,
        },
      });
    } else if (assignmentModal.moduleId) {
      createAssignmentMutation.mutate({
        ...assignmentForm,
        moduleId: assignmentModal.moduleId,
      });
    }
  };

  const handleForumSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forumForm.title.trim()) {
      toast.error(t('forum_title_required'));
      return;
    }

    if (forumModal.forum) {
      updateForumMutation.mutate({
        id: forumModal.forum.id,
        data: forumForm,
      });
    } else if (forumModal.moduleId) {
      createForumMutation.mutate({
        ...forumForm,
        moduleId: forumModal.moduleId,
      });
    }
  };

  // Reorder handlers
  const handleMoveModuleUp = (module: CourseModule) => {
    if (!modules) return;
    const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex(m => m.id === module.id);
    if (index <= 0) return;

    const newOrder = [...sorted];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderModulesMutation.mutate(newOrder.map(m => m.id));
  };

  const handleMoveModuleDown = (module: CourseModule) => {
    if (!modules) return;
    const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex(m => m.id === module.id);
    if (index < 0 || index >= sorted.length - 1) return;

    const newOrder = [...sorted];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderModulesMutation.mutate(newOrder.map(m => m.id));
  };

  const handleMoveLectureUp = (lecture: Lecture, module: CourseModule) => {
    const lectures = module.lectures || [];
    const sorted = [...lectures].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex(l => l.id === lecture.id);
    if (index <= 0) return;

    const newOrder = [...sorted];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    coursesApi.reorderLectures(module.id, newOrder.map(l => l.id)).then(() => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    });
  };

  const handleMoveLectureDown = (lecture: Lecture, module: CourseModule) => {
    const lectures = module.lectures || [];
    const sorted = [...lectures].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex(l => l.id === lecture.id);
    if (index < 0 || index >= sorted.length - 1) return;

    const newOrder = [...sorted];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    coursesApi.reorderLectures(module.id, newOrder.map(l => l.id)).then(() => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    });
  };

  const handleMoveCodeLabUp = (codeLab: CodeLab, module: CourseModule) => {
    const codeLabs = module.codeLabs || [];
    const sorted = [...codeLabs].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex(c => c.id === codeLab.id);
    if (index <= 0) return;

    const newOrder = [...sorted];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    codeLabsApi.reorderCodeLabs(module.id, newOrder.map(c => c.id)).then(() => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    });
  };

  const handleMoveCodeLabDown = (codeLab: CodeLab, module: CourseModule) => {
    const codeLabs = module.codeLabs || [];
    const sorted = [...codeLabs].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex(c => c.id === codeLab.id);
    if (index < 0 || index >= sorted.length - 1) return;

    const newOrder = [...sorted];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    codeLabsApi.reorderCodeLabs(module.id, newOrder.map(c => c.id)).then(() => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    });
  };

  // Assignment reordering is not supported at this time - they are sorted by creation order
  const handleMoveAssignmentUp = (_assignment: Assignment, _module: CourseModule) => {
    // Not implemented - would require orderIndex field on assignments
    toast(t('assignment_reordering_not_supported'));
  };

  const handleMoveAssignmentDown = (_assignment: Assignment, _module: CourseModule) => {
    // Not implemented - would require orderIndex field on assignments
    toast(t('assignment_reordering_not_supported'));
  };

  // Forum reordering - use orderIndex updates
  const handleMoveForumUp = (forum: Forum, module: CourseModule) => {
    const forums = module.forums || [];
    const sorted = [...forums].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex(f => f.id === forum.id);
    if (index <= 0) return;

    const prevForum = sorted[index - 1];
    // Swap order indices
    updateForumMutation.mutate({ id: forum.id, data: { orderIndex: prevForum.orderIndex } });
    updateForumMutation.mutate({ id: prevForum.id, data: { orderIndex: forum.orderIndex } });
  };

  const handleMoveForumDown = (forum: Forum, module: CourseModule) => {
    const forums = module.forums || [];
    const sorted = [...forums].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex(f => f.id === forum.id);
    if (index < 0 || index >= sorted.length - 1) return;

    const nextForum = sorted[index + 1];
    // Swap order indices
    updateForumMutation.mutate({ id: forum.id, data: { orderIndex: nextForum.orderIndex } });
    updateForumMutation.mutate({ id: nextForum.id, data: { orderIndex: forum.orderIndex } });
  };

  // Group assignments by moduleId
  const assignmentsByModule = useMemo(() => {
    const map: Record<number, Assignment[]> = {};
    (assignments || []).forEach(assignment => {
      if (assignment.moduleId) {
        if (!map[assignment.moduleId]) {
          map[assignment.moduleId] = [];
        }
        map[assignment.moduleId].push(assignment);
      }
    });
    return map;
  }, [assignments]);

  // Group lab assignments by moduleId
  const labAssignmentsByModule = useMemo(() => {
    const map: Record<number, LabAssignment[]> = {};
    (courseLabAssignments || []).forEach(labAssignment => {
      if (labAssignment.moduleId) {
        if (!map[labAssignment.moduleId]) {
          map[labAssignment.moduleId] = [];
        }
        map[labAssignment.moduleId].push(labAssignment);
      }
    });
    return map;
  }, [courseLabAssignments]);

  // Group forums by moduleId
  const forumsByModule = useMemo(() => {
    const map: Record<number, Forum[]> = {};
    (courseForums || []).forEach(forum => {
      if (forum.moduleId) {
        if (!map[forum.moduleId]) {
          map[forum.moduleId] = [];
        }
        map[forum.moduleId].push(forum);
      }
    });
    return map;
  }, [courseForums]);

  if (courseLoading || modulesLoading || assignmentsLoading) {
    return <Loading fullScreen text={t('loading_curriculum')} />;
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('course_not_found')}</h1>
        <Button onClick={() => navigate('/teach')}>{t('back_to_dashboard')}</Button>
      </div>
    );
  }

  // Merge assignments, lab assignments, and forums into modules
  const sortedModules = [...(modules || [])]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(module => ({
      ...module,
      assignments: assignmentsByModule[module.id] || [],
      labAssignments: labAssignmentsByModule[module.id] || [],
      forums: forumsByModule[module.id] || [],
    }));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: t('teaching'), href: '/teach' },
            { label: course.title, href: `/courses/${courseId}` },
            { label: t('curriculum_editor') },
          ]}
        />
      </div>

      {/* Course Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{course.title}</h1>
          <StatusBadge status={course.status} />
        </div>
        <p className="text-gray-600 dark:text-gray-400">{course.description || t('no_description')}</p>
      </div>

      {/* Course Management Card - Dark theme */}
      <div
        className="mb-6 p-4 rounded-xl"
        style={{ backgroundColor: isDark ? '#0f172a' : '#1e293b' }}
      >
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('course_management')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {/* View Course */}
          <Link
            to={`/courses/${courseId}`}
            className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors text-center"
          >
            <ExternalLink className="w-5 h-5 text-blue-400" />
            <span className="text-white text-xs font-medium">{t('view_course')}</span>
          </Link>

          {/* Settings */}
          <Link
            to={`/teach/courses/${courseId}/edit`}
            className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors text-center"
          >
            <Settings className="w-5 h-5 text-slate-400" />
            <span className="text-white text-xs font-medium">{t('navigation:settings')}</span>
          </Link>

          {/* Quizzes */}
          <Link
            to={`/teach/courses/${courseId}/quizzes`}
            className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors text-center"
          >
            <FileQuestion className="w-5 h-5 text-cyan-400" />
            <span className="text-white text-xs font-medium">{t('quizzes')}</span>
          </Link>

          {/* Forums */}
          <Link
            to={`/teach/courses/${courseId}/forums`}
            className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors text-center"
          >
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <span className="text-white text-xs font-medium">{t('forums')}</span>
          </Link>

          {/* AI Tutors */}
          <Link
            to={`/teach/courses/${courseId}/tutors`}
            className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors text-center"
          >
            <Bot className="w-5 h-5 text-violet-400" />
            <span className="text-white text-xs font-medium">{t('ai_tutors')}</span>
          </Link>

          {/* Publish/Unpublish */}
          {course.status === 'published' ? (
            <button
              onClick={() => unpublishMutation.mutate()}
              disabled={unpublishMutation.isPending}
              className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors text-center disabled:opacity-50"
            >
              <EyeOff className="w-5 h-5 text-amber-400" />
              <span className="text-white text-xs font-medium">
                {unpublishMutation.isPending ? t('unpublishing') : t('unpublish')}
              </span>
            </button>
          ) : (
            <button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="flex flex-col items-center gap-2 p-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 transition-colors text-center disabled:opacity-50"
            >
              <Eye className="w-5 h-5 text-emerald-400" />
              <span className="text-white text-xs font-medium">
                {publishMutation.isPending ? t('publishing') : t('publish')}
              </span>
            </button>
          )}

          {/* Delete Course */}
          <button
            onClick={() => setDeleteCourseConfirm(true)}
            className="flex flex-col items-center gap-2 p-3 rounded-lg bg-red-600/10 hover:bg-red-600/20 transition-colors text-center"
          >
            <Trash2 className="w-5 h-5 text-red-400" />
            <span className="text-red-300 text-xs font-medium">{t('common:delete')}</span>
          </button>
        </div>
      </div>

      {/* Curriculum Section */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('course_curriculum')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('organize_content_description')}
            </p>
          </div>

          {/* Add Content Dropdown */}
          <div className="relative">
            <Button
              onClick={() => setAddContentOpen(!addContentOpen)}
              size="sm"
              icon={<Plus className="w-4 h-4" />}
            >
              {t('add_content')}
              <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${addContentOpen ? 'rotate-180' : ''}`} />
            </Button>

            {addContentOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAddContentOpen(false)} />
                <div
                  className="absolute right-0 mt-2 w-72 rounded-lg shadow-lg py-2 z-20"
                  style={{
                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`
                  }}
                >
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('modules_section')}</div>

                  <button
                    onClick={() => { openAddModuleModal(); setAddContentOpen(false); }}
                    className="w-full px-3 py-2 flex items-start gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-left">
                      <span className="font-medium block text-gray-900 dark:text-white">{t('standard_module')}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{t('standard_module_description')}</span>
                    </div>
                  </button>

                  <Link
                    to={`/teach/courses/${courseId}/tutors`}
                    onClick={() => setAddContentOpen(false)}
                    className="w-full px-3 py-2 flex items-start gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="text-left">
                      <span className="font-medium block text-gray-900 dark:text-white">{t('ai_collaborative_module')}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{t('ai_collaborative_module_description')}</span>
                    </div>
                  </Link>

                </div>
              </>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {sortedModules.length > 0 ? (
            <div className="space-y-4">
              {sortedModules.map((module, index) => (
                <ModuleItem
                  key={module.id}
                  module={module}
                  courseId={courseId}
                  isFirst={index === 0}
                  isLast={index === sortedModules.length - 1}
                  onEdit={openEditModuleModal}
                  onDelete={setDeleteModuleConfirm}
                  onTogglePublish={(m) => toggleModulePublishMutation.mutate({ id: m.id, isPublished: !m.isPublished })}
                  onMoveUp={handleMoveModuleUp}
                  onMoveDown={handleMoveModuleDown}
                  onAddLecture={openAddLectureModal}
                  onEditLecture={openEditLectureModal}
                  onDeleteLecture={setDeleteLectureConfirm}
                  onToggleLecturePublish={(l) => toggleLecturePublishMutation.mutate({ id: l.id, isPublished: !l.isPublished })}
                  onMoveLectureUp={handleMoveLectureUp}
                  onMoveLectureDown={handleMoveLectureDown}
                  onAddCodeLab={openAddCodeLabModal}
                  onEditCodeLab={openEditCodeLabModal}
                  onDeleteCodeLab={setDeleteCodeLabConfirm}
                  onMoveCodeLabUp={handleMoveCodeLabUp}
                  onMoveCodeLabDown={handleMoveCodeLabDown}
                  onAddAssignment={openAddAssignmentModal}
                  onEditAssignment={openEditAssignmentModal}
                  onDeleteAssignment={setDeleteAssignmentConfirm}
                  onMoveAssignmentUp={handleMoveAssignmentUp}
                  onMoveAssignmentDown={handleMoveAssignmentDown}
                  onRemoveLabAssignment={(labId) => unassignLabMutation.mutate(labId)}
                  onAddForum={openAddForumModal}
                  onEditForum={openEditForumModal}
                  onDeleteForum={setDeleteForumConfirm}
                  onMoveForumUp={handleMoveForumUp}
                  onMoveForumDown={handleMoveForumDown}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Layers}
              title={t('no_modules_yet')}
              description={t('start_building_course')}
              action={{ label: t('add_module'), onClick: openAddModuleModal }}
            />
          )}

          {/* Collaborative Module Section */}
          {courseTutors && courseTutors.length > 0 && (
            <div
              className="mt-6 p-4 rounded-lg border-2 border-dashed"
              style={{
                borderColor: isDark ? 'rgba(139, 92, 246, 0.4)' : 'rgba(139, 92, 246, 0.5)',
                backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)' }}
                  >
                    <Bot className="w-5 h-5 text-violet-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      {(course as any).collaborativeModuleName || 'Collaborative AI Module'}
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)',
                          color: isDark ? '#a78bfa' : '#7c3aed',
                        }}
                      >
                        AI
                      </span>
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {courseTutors.length} tutor{courseTutors.length !== 1 ? 's' : ''} configured
                      {(course as any).emotionalPulseEnabled !== false && (
                        <span className="inline-flex items-center gap-1 ml-2">
                          <Heart className="w-3 h-3 text-pink-500" />
                          <span className="text-xs text-pink-500">Pulse enabled</span>
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        Mode: {(course as any).tutorRoutingMode === 'single' ? 'Single Tutor' :
                              (course as any).tutorRoutingMode === 'smart' ? 'Smart Routing' : 'All Tutors'}
                      </span>
                    </div>
                  </div>
                </div>
                <Link to={`/teach/courses/${courseId}/tutors`}>
                  <Button size="sm" variant="secondary" icon={<Settings className="w-4 h-4" />}>
                    {t('manage')}
                  </Button>
                </Link>
              </div>

              {/* Tutor previews */}
              <div className="mt-3 flex flex-wrap gap-2">
                {courseTutors.slice(0, 5).map((tutor: any) => (
                  <div
                    key={tutor.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                    style={{
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      color: isDark ? '#e5e7eb' : '#374151',
                    }}
                  >
                    <Bot className="w-3 h-3" />
                    {tutor.customName || tutor.chatbot?.displayName}
                  </div>
                ))}
                {courseTutors.length > 5 && (
                  <span
                    className="px-2 py-1 rounded-full text-xs"
                    style={{
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      color: isDark ? '#9ca3af' : '#6b7280',
                    }}
                  >
                    +{courseTutors.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Module Modal */}
      <Modal
        isOpen={moduleModal.isOpen}
        onClose={closeModuleModal}
        title={moduleModal.module ? t('edit_module') : t('add_module')}
        size="md"
      >
        <form onSubmit={handleModuleSubmit} className="space-y-4">
          <Input
            label={t('module_title')}
            value={moduleForm.title}
            onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))}
            placeholder={t('module_title_placeholder')}
            required
          />
          <Input
            label={t('label_optional')}
            value={moduleForm.label}
            onChange={e => setModuleForm(f => ({ ...f, label: e.target.value }))}
            placeholder={t('label_placeholder')}
            helpText={t('label_help_text')}
          />
          <TextArea
            label={t('description_optional')}
            value={moduleForm.description}
            onChange={e => setModuleForm(f => ({ ...f, description: e.target.value }))}
            placeholder={t('module_description_placeholder')}
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModuleModal}>
              {t('common:cancel')}
            </Button>
            <Button
              type="submit"
              loading={createModuleMutation.isPending || updateModuleMutation.isPending}
            >
              {moduleModal.module ? t('common:update') : t('common:create')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Lesson Modal */}
      <Modal
        isOpen={lectureModal.isOpen}
        onClose={closeLectureModal}
        title={lectureModal.lecture ? t('edit_lesson') : t('add_lesson')}
        size="md"
      >
        <form onSubmit={handleLectureSubmit} className="space-y-4">
          <Input
            label={t('lesson_title')}
            value={lectureForm.title}
            onChange={e => setLectureForm(f => ({ ...f, title: e.target.value }))}
            placeholder={t('lesson_title_placeholder')}
            required
          />
          <Select
            label={t('content_type_label')}
            value={lectureForm.contentType}
            onChange={e =>
              setLectureForm(f => ({
                ...f,
                contentType: e.target.value as 'text' | 'video' | 'mixed',
              }))
            }
            options={[
              { value: 'text', label: t('text_article') },
              { value: 'video', label: t('video') },
              { value: 'mixed', label: t('mixed_content') },
            ]}
          />
          <Input
            label={t('duration_minutes')}
            type="number"
            value={lectureForm.duration}
            onChange={e => setLectureForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
            min={0}
          />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isFree"
              checked={lectureForm.isFree}
              onChange={e => setLectureForm(f => ({ ...f, isFree: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="isFree" className="text-sm text-gray-700">
              {t('allow_free_preview')}
            </label>
          </div>

          {/* Edit Content Button - only for existing lessons */}
          {lectureModal.lecture && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-sm text-gray-600 mb-3">
                {t('add_lesson_content_description')}
              </p>
              <Link
                to={`/teach/courses/${courseId}/lectures/${lectureModal.lecture.id}`}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <FileEdit className="w-4 h-4" />
                {t('edit_lesson_content')}
              </Link>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeLectureModal}>
              {t('common:cancel')}
            </Button>
            <Button
              type="submit"
              loading={createLectureMutation.isPending || updateLectureMutation.isPending}
            >
              {lectureModal.lecture ? t('common:update') : t('common:create')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Module Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteModuleConfirm}
        onClose={() => setDeleteModuleConfirm(null)}
        onConfirm={() => deleteModuleConfirm && deleteModuleMutation.mutate(deleteModuleConfirm.id)}
        title={t('delete_module')}
        message={t('delete_module_confirm', { title: deleteModuleConfirm?.title })}
        confirmText={t('common:delete')}
        loading={deleteModuleMutation.isPending}
      />

      {/* Delete Lesson Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteLectureConfirm}
        onClose={() => setDeleteLectureConfirm(null)}
        onConfirm={() =>
          deleteLectureConfirm && deleteLectureMutation.mutate(deleteLectureConfirm.id)
        }
        title={t('delete_lesson')}
        message={t('delete_lesson_confirm', { title: deleteLectureConfirm?.title })}
        confirmText={t('common:delete')}
        loading={deleteLectureMutation.isPending}
      />

      {/* Code Lab Modal */}
      <Modal
        isOpen={codeLabModal.isOpen}
        onClose={closeCodeLabModal}
        title={codeLabModal.codeLab ? t('edit_code_lab') : t('add_code_lab')}
        size="lg"
      >
        {/* Tabs - only show for new code labs */}
        {!codeLabModal.codeLab && (
          <div className="flex gap-1 mb-4 border-b" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
            <button
              type="button"
              onClick={() => setCodeLabModalTab('create')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                codeLabModalTab === 'create'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('create_new')}
            </button>
            <button
              type="button"
              onClick={() => setCodeLabModalTab('templates')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                codeLabModalTab === 'templates'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Beaker className="w-4 h-4" />
              {t('from_templates')}
              {availableLabs && availableLabs.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {availableLabs.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Create New Tab */}
        {(codeLabModalTab === 'create' || codeLabModal.codeLab) && (
          <form onSubmit={handleCodeLabSubmit} className="space-y-4">
            <Input
              label={t('code_lab_title_label')}
              value={codeLabForm.title}
              onChange={e => setCodeLabForm(f => ({ ...f, title: e.target.value }))}
              placeholder={t('code_lab_title_placeholder')}
              required
            />
            <TextArea
              label={t('description_optional')}
              value={codeLabForm.description}
              onChange={e => setCodeLabForm(f => ({ ...f, description: e.target.value }))}
              placeholder={t('code_lab_description_placeholder')}
              rows={3}
            />

            {/* Edit Content Button - only for existing code labs */}
            {codeLabModal.codeLab && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="text-sm text-gray-600 mb-3">
                  {t('add_code_blocks_instructions')}
                </p>
                <Link
                  to={`/teach/courses/${courseId}/code-labs/${codeLabModal.codeLab.id}`}
                  className="btn btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <FileEdit className="w-4 h-4" />
                  {t('edit_code_lab_content')}
                </Link>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={closeCodeLabModal}>
                {t('common:cancel')}
              </Button>
              <Button
                type="submit"
                loading={createCodeLabMutation.isPending || updateCodeLabMutation.isPending}
              >
                {codeLabModal.codeLab ? t('common:update') : t('common:create')}
              </Button>
            </div>
          </form>
        )}

        {/* From Templates Tab */}
        {codeLabModalTab === 'templates' && !codeLabModal.codeLab && (
          <div className="space-y-4">
            {availableLabs && availableLabs.length > 0 ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('select_lab_template_description')}
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {availableLabs.map(lab => {
                    const isAlreadyAssigned = courseLabAssignments?.some(
                      a => a.labId === lab.id && a.moduleId === codeLabModal.moduleId
                    );
                    const isSelected = selectedLabTemplate?.lab.id === lab.id;

                    return (
                      <div
                        key={lab.id}
                        onClick={() => !isAlreadyAssigned && setSelectedLabTemplate({ lab, templates: lab.templates || [] })}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isAlreadyAssigned
                            ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700'
                            : isSelected
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Beaker className={`w-4 h-4 ${isSelected ? 'text-primary-500' : 'text-gray-400'}`} />
                              <span className={`font-medium ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                                {lab.name}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                {lab.labType}
                              </span>
                            </div>
                            {lab.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-6">
                                {lab.description}
                              </p>
                            )}
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-6">
                              {lab._count?.templates || lab.templates?.length || 0} template{(lab._count?.templates || lab.templates?.length || 0) !== 1 ? 's' : ''}
                            </div>
                          </div>
                          {isAlreadyAssigned ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <Check className="w-3 h-3" />
                              {t('added')}
                            </span>
                          ) : isSelected ? (
                            <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
                  <Link
                    to="/teach/labs"
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {t('manage_lab_templates')}
                  </Link>
                  <div className="flex gap-3">
                    <Button type="button" variant="secondary" onClick={closeCodeLabModal}>
                      {t('common:cancel')}
                    </Button>
                    <Button
                      onClick={() => {
                        if (selectedLabTemplate) {
                          assignLabMutation.mutate({
                            labId: selectedLabTemplate.lab.id,
                            moduleId: codeLabModal.moduleId,
                          });
                        }
                      }}
                      disabled={!selectedLabTemplate}
                      loading={assignLabMutation.isPending}
                    >
                      {t('add_to_module')}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Beaker className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">{t('no_lab_templates')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {t('create_lab_templates_description')}
                </p>
                <Link to="/teach/labs">
                  <Button size="sm" icon={<Plus className="w-4 h-4" />}>
                    {t('create_lab_template')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Code Lab Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteCodeLabConfirm}
        onClose={() => setDeleteCodeLabConfirm(null)}
        onConfirm={() =>
          deleteCodeLabConfirm && deleteCodeLabMutation.mutate(deleteCodeLabConfirm.id)
        }
        title={t('delete_code_lab')}
        message={t('delete_code_lab_confirm', { title: deleteCodeLabConfirm?.title })}
        confirmText={t('common:delete')}
        loading={deleteCodeLabMutation.isPending}
      />

      {/* Assignment Modal */}
      <Modal
        isOpen={assignmentModal.isOpen}
        onClose={closeAssignmentModal}
        title={assignmentModal.assignment ? t('edit_assignment') : t('add_assignment')}
        size="md"
      >
        <form onSubmit={handleAssignmentSubmit} className="space-y-4">
          <Input
            label={t('assignment_title')}
            value={assignmentForm.title}
            onChange={e => setAssignmentForm(f => ({ ...f, title: e.target.value }))}
            placeholder={t('assignment_title_placeholder')}
            required
          />
          <TextArea
            label={t('assignment_description')}
            value={assignmentForm.description}
            onChange={e => setAssignmentForm(f => ({ ...f, description: e.target.value }))}
            placeholder={t('assignment_description_placeholder')}
            rows={3}
          />
          <Select
            label={t('submission_type')}
            value={assignmentForm.submissionType}
            onChange={e =>
              setAssignmentForm(f => ({
                ...f,
                submissionType: e.target.value as 'text' | 'file' | 'mixed' | 'ai_agent',
              }))
            }
            options={[
              { value: 'text', label: t('text_submission') },
              { value: 'file', label: t('file_upload_submission') },
              { value: 'mixed', label: t('text_file_submission') },
              { value: 'ai_agent', label: t('ai_agent_submission') },
            ]}
          />
          {assignmentForm.submissionType === 'ai_agent' && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700">
              {t('ai_agent_info')}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('points_label')}
              type="number"
              value={assignmentForm.points}
              onChange={e => setAssignmentForm(f => ({ ...f, points: parseInt(e.target.value) || 0 }))}
              min={0}
            />
            <Input
              label={t('due_date_optional')}
              type="date"
              value={assignmentForm.dueDate}
              onChange={e => setAssignmentForm(f => ({ ...f, dueDate: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPublished"
              checked={assignmentForm.isPublished}
              onChange={e => setAssignmentForm(f => ({ ...f, isPublished: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="isPublished" className="text-sm text-gray-700">
              {t('publish_assignment')}
            </label>
          </div>

          {/* View Submissions Button - only for existing assignments */}
          {assignmentModal.assignment && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-sm text-gray-600 mb-3">
                {t('view_submissions_description')}
              </p>
              <Link
                to={`/teach/courses/${courseId}/assignments/${assignmentModal.assignment.id}/submissions`}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <FileEdit className="w-4 h-4" />
                {t('view_submissions')}
              </Link>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeAssignmentModal}>
              {t('common:cancel')}
            </Button>
            <Button
              type="submit"
              loading={createAssignmentMutation.isPending || updateAssignmentMutation.isPending}
            >
              {assignmentModal.assignment ? t('common:update') : t('common:create')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Assignment Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteAssignmentConfirm}
        onClose={() => setDeleteAssignmentConfirm(null)}
        onConfirm={() =>
          deleteAssignmentConfirm && deleteAssignmentMutation.mutate(deleteAssignmentConfirm.id)
        }
        title={t('delete_assignment')}
        message={t('delete_assignment_confirm', { title: deleteAssignmentConfirm?.title })}
        confirmText={t('common:delete')}
        loading={deleteAssignmentMutation.isPending}
      />

      {/* Forum Modal */}
      <Modal
        isOpen={forumModal.isOpen}
        onClose={closeForumModal}
        title={forumModal.forum ? t('edit_forum') : t('add_forum')}
        size="md"
      >
        <form onSubmit={handleForumSubmit} className="space-y-4">
          <Input
            label={t('forum_title')}
            value={forumForm.title}
            onChange={e => setForumForm(f => ({ ...f, title: e.target.value }))}
            placeholder={t('forum_title_placeholder')}
            required
          />
          <TextArea
            label={t('forum_description')}
            value={forumForm.description}
            onChange={e => setForumForm(f => ({ ...f, description: e.target.value }))}
            placeholder={t('forum_description_placeholder')}
            rows={3}
          />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="forumIsPublished"
              checked={forumForm.isPublished}
              onChange={e => setForumForm(f => ({ ...f, isPublished: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="forumIsPublished" className="text-sm text-gray-700 dark:text-gray-300">
              {t('publish_forum')}
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="forumAllowAnonymous"
              checked={forumForm.allowAnonymous}
              onChange={e => setForumForm(f => ({ ...f, allowAnonymous: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="forumAllowAnonymous" className="text-sm text-gray-700 dark:text-gray-300">
              {t('allow_anonymous_posts')}
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeForumModal}>
              {t('common:cancel')}
            </Button>
            <Button
              type="submit"
              loading={createForumMutation.isPending || updateForumMutation.isPending}
            >
              {forumModal.forum ? t('common:update') : t('common:create')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Forum Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteForumConfirm}
        onClose={() => setDeleteForumConfirm(null)}
        onConfirm={() =>
          deleteForumConfirm && deleteForumMutation.mutate(deleteForumConfirm.id)
        }
        title={t('delete_forum')}
        message={t('delete_forum_confirm', { title: deleteForumConfirm?.title })}
        confirmText={t('common:delete')}
        loading={deleteForumMutation.isPending}
      />

      {/* Delete Course Confirmation */}
      <ConfirmDialog
        isOpen={deleteCourseConfirm}
        onClose={() => setDeleteCourseConfirm(false)}
        onConfirm={() => deleteCourseMutation.mutate()}
        title={t('delete_course')}
        message={t('delete_course_confirm', { title: course?.title })}
        confirmText={t('common:delete')}
        loading={deleteCourseMutation.isPending}
      />
    </div>
  );
};
