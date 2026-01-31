import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Settings, Eye, EyeOff, Layers, FileEdit, MessageCircle, Bot, Sparkles, ChevronDown, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { codeLabsApi } from '../../api/codeLabs';
import { assignmentsApi } from '../../api/assignments';
import { courseTutorApi } from '../../api/courseTutor';
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
import { CourseModule, Lecture, CodeLab, Assignment } from '../../types';

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

interface AssignmentFormData {
  title: string;
  description: string;
  submissionType: 'text' | 'file' | 'mixed' | 'ai_agent';
  points: number;
  dueDate: string;
  isPublished: boolean;
}

export const CurriculumEditor = () => {
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
  const [deleteCodeLabConfirm, setDeleteCodeLabConfirm] = useState<CodeLab | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<{
    isOpen: boolean;
    moduleId?: number;
    assignment?: Assignment;
  }>({ isOpen: false });
  const [deleteAssignmentConfirm, setDeleteAssignmentConfirm] = useState<Assignment | null>(null);

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

  // Queries
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ['courseModules', courseId],
    queryFn: () => coursesApi.getModules(courseId),
    enabled: !!courseId,
  });

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

  // Mutations
  const createModuleMutation = useMutation({
    mutationFn: (data: ModuleFormData) => coursesApi.createModule(courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success('Module created');
      closeModuleModal();
    },
    onError: () => toast.error('Failed to create module'),
  });

  const updateModuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ModuleFormData }) =>
      coursesApi.updateModule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success('Module updated');
      closeModuleModal();
    },
    onError: () => toast.error('Failed to update module'),
  });

  const deleteModuleMutation = useMutation({
    mutationFn: (id: number) => coursesApi.deleteModule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success('Module deleted');
      setDeleteModuleConfirm(null);
    },
    onError: () => toast.error('Failed to delete module'),
  });

  const reorderModulesMutation = useMutation({
    mutationFn: (moduleIds: number[]) => coursesApi.reorderModules(courseId, moduleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
    },
    onError: () => toast.error('Failed to reorder modules'),
  });

  const createLectureMutation = useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: number; data: LectureFormData }) =>
      coursesApi.createLecture(moduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success('Lesson created');
      closeLectureModal();
    },
    onError: () => toast.error('Failed to create lesson'),
  });

  const updateLectureMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LectureFormData }) =>
      coursesApi.updateLecture(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success('Lesson updated');
      closeLectureModal();
    },
    onError: () => toast.error('Failed to update lesson'),
  });

  const deleteLectureMutation = useMutation({
    mutationFn: (id: number) => coursesApi.deleteLecture(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success('Lesson deleted');
      setDeleteLectureConfirm(null);
    },
    onError: () => toast.error('Failed to delete lesson'),
  });

  const publishMutation = useMutation({
    mutationFn: () => coursesApi.publishCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      toast.success('Course published');
    },
    onError: () => toast.error('Failed to publish course'),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => coursesApi.unpublishCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['teachingCourses'] });
      toast.success('Course unpublished');
    },
    onError: () => toast.error('Failed to unpublish course'),
  });

  // Code Lab mutations
  const createCodeLabMutation = useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: number; data: CodeLabFormData }) =>
      codeLabsApi.createCodeLab({ moduleId, title: data.title, description: data.description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success('Code Lab created');
      closeCodeLabModal();
    },
    onError: () => toast.error('Failed to create Code Lab'),
  });

  const updateCodeLabMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CodeLabFormData }) =>
      codeLabsApi.updateCodeLab(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success('Code Lab updated');
      closeCodeLabModal();
    },
    onError: () => toast.error('Failed to update Code Lab'),
  });

  const deleteCodeLabMutation = useMutation({
    mutationFn: (id: number) => codeLabsApi.deleteCodeLab(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success('Code Lab deleted');
      setDeleteCodeLabConfirm(null);
    },
    onError: () => toast.error('Failed to delete Code Lab'),
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
      toast.success('Assignment created');
      closeAssignmentModal();
    },
    onError: (error: any) => {
      console.error('Failed to create assignment:', error);
      const message = error?.response?.data?.message || error?.message || 'Unknown error';
      toast.error(`Failed to create assignment: ${message}`);
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
      toast.success('Assignment updated');
      closeAssignmentModal();
    },
    onError: (error: any) => {
      console.error('Failed to update assignment:', error);
      const message = error?.response?.data?.message || error?.message || 'Unknown error';
      toast.error(`Failed to update assignment: ${message}`);
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (id: number) => assignmentsApi.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      toast.success('Assignment deleted');
      setDeleteAssignmentConfirm(null);
    },
    onError: () => toast.error('Failed to delete assignment'),
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

  const openAddLessonWithChatbot = () => {
    // First need a module - show module selector or create flow
    const sorted = [...(modules || [])].sort((a, b) => a.orderIndex - b.orderIndex);
    if (sorted.length === 0) {
      toast.error('Create a module first to add an AI lesson');
      openAddModuleModal();
      return;
    }
    // Open lesson modal with first module pre-selected
    setLectureForm({ title: '', contentType: 'mixed', duration: 0, isFree: false });
    setLectureModal({ isOpen: true, moduleId: sorted[0].id });
    toast('Create the lesson, then add a Chatbot section in the content editor');
  };

  // Form handlers
  const handleModuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleForm.title.trim()) {
      toast.error('Module title is required');
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
      toast.error('Lesson title is required');
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
      toast.error('Code Lab title is required');
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
      toast.error('Assignment title is required');
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
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
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
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
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
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
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
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
    });
  };

  // Assignment reordering is not supported at this time - they are sorted by creation order
  const handleMoveAssignmentUp = (_assignment: Assignment, _module: CourseModule) => {
    // Not implemented - would require orderIndex field on assignments
    toast('Assignment reordering not yet supported');
  };

  const handleMoveAssignmentDown = (_assignment: Assignment, _module: CourseModule) => {
    // Not implemented - would require orderIndex field on assignments
    toast('Assignment reordering not yet supported');
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

  if (courseLoading || modulesLoading || assignmentsLoading) {
    return <Loading fullScreen text="Loading curriculum..." />;
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Course Not Found</h1>
        <Button onClick={() => navigate('/teach')}>Back to Dashboard</Button>
      </div>
    );
  }

  // Merge assignments into modules
  const sortedModules = [...(modules || [])]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(module => ({
      ...module,
      assignments: assignmentsByModule[module.id] || [],
    }));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: 'Teaching', href: '/teach' },
            { label: course.title, href: `/courses/${courseId}` },
            { label: 'Curriculum' },
          ]}
        />
      </div>

      {/* Course Header Card - Split Design */}
      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Left Panel - Course Info */}
          <div className="flex-1 p-6">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{course.title}</h1>
              <StatusBadge status={course.status} />
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{course.description || 'No description'}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Link to={`/teach/courses/${courseId}/chatbot-logs`}>
                <Button variant="ghost" size="sm" icon={<MessageCircle className="w-4 h-4" />}>
                  Chatbot Logs
                </Button>
              </Link>
              <Link to={`/teach/courses/${courseId}/edit`}>
                <Button variant="ghost" size="sm" icon={<Settings className="w-4 h-4" />}>
                  Settings
                </Button>
              </Link>
              {course.status === 'published' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => unpublishMutation.mutate()}
                  loading={unpublishMutation.isPending}
                  icon={<EyeOff className="w-4 h-4" />}
                >
                  Unpublish
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => publishMutation.mutate()}
                  loading={publishMutation.isPending}
                  icon={<Eye className="w-4 h-4" />}
                >
                  Publish
                </Button>
              )}
            </div>
          </div>

          {/* Right Panel - AI Features */}
          <div
            className="w-full lg:w-80 p-6 lg:rounded-r-xl"
            style={{ backgroundColor: isDark ? '#0f172a' : '#1e293b' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">AI Features</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Collaborative Tutors Card */}
              <Link to={`/teach/courses/${courseId}/tutors`}>
                <div className="p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors cursor-pointer text-center">
                  <Bot className="w-8 h-8 text-violet-400 mx-auto mb-2" />
                  <span className="text-white text-sm font-medium block">Collaborative Tutors</span>
                  <span className="text-slate-400 text-xs">{courseTutors?.length || 0} active</span>
                </div>
              </Link>

              {/* Lesson Chatbots Card */}
              <div className="p-3 rounded-lg bg-slate-700/50 text-center">
                <MessageCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <span className="text-white text-sm font-medium block">Lesson Chatbots</span>
                <span className="text-slate-400 text-xs">In lessons</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Curriculum Section */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Course Curriculum</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Organize your content into modules and lessons
            </p>
          </div>

          {/* Add Content Dropdown */}
          <div className="relative">
            <Button
              onClick={() => setAddContentOpen(!addContentOpen)}
              size="sm"
              icon={<Plus className="w-4 h-4" />}
            >
              Add Content
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
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Modules</div>

                  <button
                    onClick={() => { openAddModuleModal(); setAddContentOpen(false); }}
                    className="w-full px-3 py-2 flex items-start gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-left">
                      <span className="font-medium block text-gray-900 dark:text-white">Standard Module</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Lessons, code labs, assignments</span>
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
                      <span className="font-medium block text-gray-900 dark:text-white">AI Collaborative Module</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Course-level AI tutors</span>
                    </div>
                  </Link>

                  <div className="border-t my-2" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }} />
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">AI Elements</div>

                  <button
                    onClick={() => { openAddLessonWithChatbot(); setAddContentOpen(false); }}
                    className="w-full px-3 py-2 flex items-start gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="text-left">
                      <span className="font-medium block text-gray-900 dark:text-white">Lesson AI Agent</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Lesson with embedded chatbot</span>
                    </div>
                  </button>
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
                  onMoveUp={handleMoveModuleUp}
                  onMoveDown={handleMoveModuleDown}
                  onAddLecture={openAddLectureModal}
                  onEditLecture={openEditLectureModal}
                  onDeleteLecture={setDeleteLectureConfirm}
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
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Layers}
              title="No modules yet"
              description="Start building your course by adding the first module"
              action={{ label: 'Add Module', onClick: openAddModuleModal }}
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
                    Manage
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
        title={moduleModal.module ? 'Edit Module' : 'Add Module'}
        size="md"
      >
        <form onSubmit={handleModuleSubmit} className="space-y-4">
          <Input
            label="Module Title"
            value={moduleForm.title}
            onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g., Introduction to the Course"
            required
          />
          <Input
            label="Label (optional)"
            value={moduleForm.label}
            onChange={e => setModuleForm(f => ({ ...f, label: e.target.value }))}
            placeholder="e.g., Week 1 - Foundations"
            helpText="A short label displayed next to the module title"
          />
          <TextArea
            label="Description (optional)"
            value={moduleForm.description}
            onChange={e => setModuleForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Brief description of what this module covers"
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModuleModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createModuleMutation.isPending || updateModuleMutation.isPending}
            >
              {moduleModal.module ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Lesson Modal */}
      <Modal
        isOpen={lectureModal.isOpen}
        onClose={closeLectureModal}
        title={lectureModal.lecture ? 'Edit Lesson' : 'Add Lesson'}
        size="md"
      >
        <form onSubmit={handleLectureSubmit} className="space-y-4">
          <Input
            label="Lesson Title"
            value={lectureForm.title}
            onChange={e => setLectureForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g., Getting Started"
            required
          />
          <Select
            label="Content Type"
            value={lectureForm.contentType}
            onChange={e =>
              setLectureForm(f => ({
                ...f,
                contentType: e.target.value as 'text' | 'video' | 'mixed',
              }))
            }
            options={[
              { value: 'text', label: 'Text / Article' },
              { value: 'video', label: 'Video' },
              { value: 'mixed', label: 'Mixed Content' },
            ]}
          />
          <Input
            label="Duration (minutes)"
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
              Allow free preview
            </label>
          </div>

          {/* Edit Content Button - only for existing lessons */}
          {lectureModal.lecture && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-sm text-gray-600 mb-3">
                Add text, files, or AI-generated content to this lesson:
              </p>
              <Link
                to={`/teach/courses/${courseId}/lectures/${lectureModal.lecture.id}`}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <FileEdit className="w-4 h-4" />
                Edit Lesson Content
              </Link>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeLectureModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createLectureMutation.isPending || updateLectureMutation.isPending}
            >
              {lectureModal.lecture ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Module Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteModuleConfirm}
        onClose={() => setDeleteModuleConfirm(null)}
        onConfirm={() => deleteModuleConfirm && deleteModuleMutation.mutate(deleteModuleConfirm.id)}
        title="Delete Module"
        message={`Are you sure you want to delete "${deleteModuleConfirm?.title}"? All lessons in this module will also be deleted.`}
        confirmText="Delete"
        loading={deleteModuleMutation.isPending}
      />

      {/* Delete Lesson Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteLectureConfirm}
        onClose={() => setDeleteLectureConfirm(null)}
        onConfirm={() =>
          deleteLectureConfirm && deleteLectureMutation.mutate(deleteLectureConfirm.id)
        }
        title="Delete Lesson"
        message={`Are you sure you want to delete "${deleteLectureConfirm?.title}"?`}
        confirmText="Delete"
        loading={deleteLectureMutation.isPending}
      />

      {/* Code Lab Modal */}
      <Modal
        isOpen={codeLabModal.isOpen}
        onClose={closeCodeLabModal}
        title={codeLabModal.codeLab ? 'Edit Code Lab' : 'Add Code Lab'}
        size="md"
      >
        <form onSubmit={handleCodeLabSubmit} className="space-y-4">
          <Input
            label="Code Lab Title"
            value={codeLabForm.title}
            onChange={e => setCodeLabForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g., Introduction to R Programming"
            required
          />
          <TextArea
            label="Description (optional)"
            value={codeLabForm.description}
            onChange={e => setCodeLabForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Brief description of what students will learn in this lab"
            rows={3}
          />

          {/* Edit Content Button - only for existing code labs */}
          {codeLabModal.codeLab && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-sm text-gray-600 mb-3">
                Add code blocks and instructions to this lab:
              </p>
              <Link
                to={`/teach/courses/${courseId}/code-labs/${codeLabModal.codeLab.id}`}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <FileEdit className="w-4 h-4" />
                Edit Code Lab Content
              </Link>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeCodeLabModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createCodeLabMutation.isPending || updateCodeLabMutation.isPending}
            >
              {codeLabModal.codeLab ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Code Lab Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteCodeLabConfirm}
        onClose={() => setDeleteCodeLabConfirm(null)}
        onConfirm={() =>
          deleteCodeLabConfirm && deleteCodeLabMutation.mutate(deleteCodeLabConfirm.id)
        }
        title="Delete Code Lab"
        message={`Are you sure you want to delete "${deleteCodeLabConfirm?.title}"? All code blocks in this lab will also be deleted.`}
        confirmText="Delete"
        loading={deleteCodeLabMutation.isPending}
      />

      {/* Assignment Modal */}
      <Modal
        isOpen={assignmentModal.isOpen}
        onClose={closeAssignmentModal}
        title={assignmentModal.assignment ? 'Edit Assignment' : 'Add Assignment'}
        size="md"
      >
        <form onSubmit={handleAssignmentSubmit} className="space-y-4">
          <Input
            label="Assignment Title"
            value={assignmentForm.title}
            onChange={e => setAssignmentForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g., Week 1 Assignment"
            required
          />
          <TextArea
            label="Description (optional)"
            value={assignmentForm.description}
            onChange={e => setAssignmentForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Brief description of the assignment"
            rows={3}
          />
          <Select
            label="Submission Type"
            value={assignmentForm.submissionType}
            onChange={e =>
              setAssignmentForm(f => ({
                ...f,
                submissionType: e.target.value as 'text' | 'file' | 'mixed' | 'ai_agent',
              }))
            }
            options={[
              { value: 'text', label: 'Text Submission' },
              { value: 'file', label: 'File Upload' },
              { value: 'mixed', label: 'Text + File' },
              { value: 'ai_agent', label: 'AI Agent Builder' },
            ]}
          />
          {assignmentForm.submissionType === 'ai_agent' && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700">
              Students will build and configure an AI agent as their submission.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Points"
              type="number"
              value={assignmentForm.points}
              onChange={e => setAssignmentForm(f => ({ ...f, points: parseInt(e.target.value) || 0 }))}
              min={0}
            />
            <Input
              label="Due Date (optional)"
              type="date"
              value={assignmentForm.dueDate}
              onChange={e => setAssignmentForm(f => ({ ...f, dueDate: e.target.value }))}
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
              Publish assignment (visible to students)
            </label>
          </div>

          {/* View Submissions Button - only for existing assignments */}
          {assignmentModal.assignment && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-sm text-gray-600 mb-3">
                View and grade student submissions:
              </p>
              <Link
                to={`/teach/courses/${courseId}/assignments/${assignmentModal.assignment.id}/submissions`}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <FileEdit className="w-4 h-4" />
                View Submissions
              </Link>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeAssignmentModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createAssignmentMutation.isPending || updateAssignmentMutation.isPending}
            >
              {assignmentModal.assignment ? 'Update' : 'Create'}
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
        title="Delete Assignment"
        message={`Are you sure you want to delete "${deleteAssignmentConfirm?.title}"? All student submissions will also be deleted.`}
        confirmText="Delete"
        loading={deleteAssignmentMutation.isPending}
      />
    </div>
  );
};
