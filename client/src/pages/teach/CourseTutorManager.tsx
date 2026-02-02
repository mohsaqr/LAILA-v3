import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  GripVertical,
  Edit,
  Trash2,
  Bot,
  MessageSquare,
  ChevronLeft,
  X,
  Check,
  Users,
  Sparkles,
  CheckSquare,
  Square,
  Settings,
  Heart,
  Save,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../hooks/useTheme';
import { courseTutorApi, CourseTutor, AvailableTutor } from '../../api/courseTutor';
import { coursesApi } from '../../api/courses';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';

// Drag and drop helper (simple implementation)
const useDragAndDrop = (items: CourseTutor[], onReorder: (ids: number[]) => void) => {
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const handleDragStart = (id: number) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedId === null || draggedId === targetId) return;

    const newItems = [...items];
    const draggedIndex = newItems.findIndex((i) => i.id === draggedId);
    const targetIndex = newItems.findIndex((i) => i.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newItems.splice(draggedIndex, 1);
      newItems.splice(targetIndex, 0, removed);
      onReorder(newItems.map((i) => i.id));
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  return { draggedId, handleDragStart, handleDragOver, handleDragEnd };
};

export const CourseTutorManager = () => {
  const { id: courseId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<CourseTutor | null>(null);

  // Module settings state
  const [moduleName, setModuleName] = useState('');
  const [routingMode, setRoutingMode] = useState<'free' | 'all' | 'single' | 'smart' | 'collaborative' | 'random'>('free');
  const [defaultTutorId, setDefaultTutorId] = useState<number | null>(null);
  const [emotionalPulseEnabled, setEmotionalPulseEnabled] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(true);

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    bgHover: isDark ? '#374151' : '#f9fafb',
    bgSelected: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    borderLight: isDark ? '#374151' : '#f3f4f6',
    bgPrimary: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textPrimary600: isDark ? '#a5b4fc' : '#4f46e5',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    textTeal: isDark ? '#5eecec' : '#088F8F',
    bgGreen: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5',
    textGreen: isDark ? '#6ee7b7' : '#059669',
  };

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(parseInt(courseId!)),
    enabled: !!courseId,
  });

  // Fetch course tutors
  const { data: tutors, isLoading: tutorsLoading } = useQuery({
    queryKey: ['courseTutors', courseId],
    queryFn: () => courseTutorApi.getCourseTutors(parseInt(courseId!)),
    enabled: !!courseId,
  });

  // Fetch available tutors
  const { data: availableTutors } = useQuery({
    queryKey: ['availableTutors', courseId],
    queryFn: () => courseTutorApi.getAvailableTutors(parseInt(courseId!)),
    enabled: !!courseId && showAddModal,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['courseTutorStats', courseId],
    queryFn: () => courseTutorApi.getTutorStats(parseInt(courseId!)),
    enabled: !!courseId,
  });

  // Mutations
  const batchAddMutation = useMutation({
    mutationFn: (chatbotIds: number[]) =>
      courseTutorApi.addTutorsToCourse(parseInt(courseId!), chatbotIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['courseTutors', courseId] });
      queryClient.invalidateQueries({ queryKey: ['availableTutors', courseId] });
      queryClient.invalidateQueries({ queryKey: ['courseTutorStats', courseId] });
      toast.success(`${data.length} tutor${data.length !== 1 ? 's' : ''} added to course`);
      setShowAddModal(false);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add tutors'),
  });

  const deleteMutation = useMutation({
    mutationFn: (tutorId: number) =>
      courseTutorApi.removeCourseTutor(parseInt(courseId!), tutorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseTutors', courseId] });
      queryClient.invalidateQueries({ queryKey: ['availableTutors', courseId] });
      queryClient.invalidateQueries({ queryKey: ['courseTutorStats', courseId] });
      toast.success('Tutor removed from course');
      setDeleteConfirm(null);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to remove tutor'),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) =>
      courseTutorApi.reorderCourseTutors(parseInt(courseId!), orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseTutors', courseId] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to reorder'),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: {
      collaborativeModuleName?: string;
      collaborativeModuleEnabled?: boolean;
      emotionalPulseEnabled?: boolean;
      tutorRoutingMode?: 'free' | 'all' | 'single' | 'smart' | 'collaborative' | 'random';
      defaultTutorId?: number | null;
    }) => coursesApi.updateCourseAISettings(parseInt(courseId!), settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success('Settings saved');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save settings'),
  });

  // Sync settings state with course data
  useEffect(() => {
    if (course) {
      setModuleName((course as any).collaborativeModuleName || '');
      setRoutingMode((course as any).tutorRoutingMode || 'free');
      setDefaultTutorId((course as any).defaultTutorId || null);
      setEmotionalPulseEnabled((course as any).emotionalPulseEnabled !== false);
    }
  }, [course]);

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      collaborativeModuleName: moduleName || undefined,
      emotionalPulseEnabled,
      tutorRoutingMode: routingMode,
      defaultTutorId: routingMode === 'single' ? defaultTutorId : null,
    });
  };

  const { draggedId, handleDragStart, handleDragOver, handleDragEnd } = useDragAndDrop(
    tutors || [],
    (ids) => reorderMutation.mutate(ids)
  );

  if (courseLoading || tutorsLoading) {
    return <Loading fullScreen text="Loading course tutors..." />;
  }

  if (!course) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
          Course not found
        </h2>
        <Link to={`/courses/${courseId}`} className="text-primary-600 hover:underline mt-2 inline-block">
          Back to Course
        </Link>
      </div>
    );
  }

  const getPersonalityColor = (personality: string | null) => {
    switch (personality) {
      case 'socratic':
        return 'from-purple-500 to-indigo-500';
      case 'friendly':
        return 'from-green-500 to-emerald-500';
      case 'casual':
        return 'from-orange-500 to-amber-500';
      case 'professional':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const breadcrumbItems = buildTeachingBreadcrumb(courseId, course?.title || 'Course', 'AI Tutors');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ minHeight: '100vh' }}>
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
              Collaborative Module
            </h1>
            <p className="mt-1" style={{ color: colors.textSecondary }}>
              Manage AI tutors for <span className="font-medium">{course.title}</span>
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)} icon={<Plus className="w-4 h-4" />}>
            Add Tutor
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardBody className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: colors.bgPrimary }}
              >
                <Bot className="w-5 h-5" style={{ color: colors.textPrimary600 }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  {stats.totalTutors}
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Total Tutors
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: colors.bgGreen }}
              >
                <Check className="w-5 h-5" style={{ color: colors.textGreen }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  {stats.activeTutors}
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Active
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: colors.bgTeal }}
              >
                <Users className="w-5 h-5" style={{ color: colors.textTeal }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  {stats.totalConversations}
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Conversations
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: colors.bgPrimary }}
              >
                <MessageSquare className="w-5 h-5" style={{ color: colors.textPrimary600 }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  {stats.totalMessages}
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Messages
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Module Settings */}
      <Card className="mb-6">
        <CardHeader
          className="cursor-pointer flex items-center justify-between"
          onClick={() => setSettingsExpanded(!settingsExpanded)}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" style={{ color: colors.textPrimary600 }} />
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              Module Settings
            </h2>
          </div>
          <ChevronLeft
            className={`w-5 h-5 transition-transform ${settingsExpanded ? '-rotate-90' : 'rotate-0'}`}
            style={{ color: colors.textMuted }}
          />
        </CardHeader>
        {settingsExpanded && (
          <CardBody className="space-y-4">
            {/* Module Name */}
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: colors.textPrimary }}
              >
                Module Name (shown to students)
              </label>
              <input
                type="text"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                placeholder="Collaborative AI Tutors"
                className="w-full px-3 py-2 border rounded-lg"
                style={{
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                }}
              />
              <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                Leave empty to use default name
              </p>
            </div>

            {/* Routing Section */}
            <div
              className="p-4 rounded-lg border-2 border-dashed"
              style={{ borderColor: colors.border, backgroundColor: colors.bgHover }}
            >
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
                  Tutor Routing
                </h3>
              </div>

              <p className="text-sm mb-3" style={{ color: colors.textSecondary }}>
                Control how students access and interact with tutors
              </p>

              <div className="space-y-3">
                {/* Free Choice Option */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    routingMode === 'free' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                  style={{ borderColor: routingMode === 'free' ? undefined : colors.border }}
                >
                  <input
                    type="radio"
                    name="routingMode"
                    value="free"
                    checked={routingMode === 'free'}
                    onChange={(e) => setRoutingMode(e.target.value as 'free' | 'all' | 'single' | 'smart' | 'collaborative' | 'random')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium" style={{ color: colors.textPrimary }}>
                      Free Choice
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Recommended
                      </span>
                    </p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      Students freely choose and switch between any tutor
                    </p>
                  </div>
                </label>

                {/* All Tutors Option */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    routingMode === 'all' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                  style={{ borderColor: routingMode === 'all' ? undefined : colors.border }}
                >
                  <input
                    type="radio"
                    name="routingMode"
                    value="all"
                    checked={routingMode === 'all'}
                    onChange={(e) => setRoutingMode(e.target.value as 'free' | 'all' | 'single' | 'smart' | 'collaborative' | 'random')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium" style={{ color: colors.textPrimary }}>All Tutors (Guided)</p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      Students see all tutors with recommendations on which to use
                    </p>
                  </div>
                </label>

                {/* Single Tutor Option */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    routingMode === 'single' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                  style={{ borderColor: routingMode === 'single' ? undefined : colors.border }}
                >
                  <input
                    type="radio"
                    name="routingMode"
                    value="single"
                    checked={routingMode === 'single'}
                    onChange={(e) => setRoutingMode(e.target.value as 'free' | 'all' | 'single' | 'smart' | 'collaborative' | 'random')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium" style={{ color: colors.textPrimary }}>Single Tutor</p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      Students only see one default tutor
                    </p>
                  </div>
                </label>

                {/* Default Tutor Selector (when single mode) */}
                {routingMode === 'single' && tutors && tutors.length > 0 && (
                  <div className="ml-7">
                    <select
                      value={defaultTutorId || ''}
                      onChange={(e) => setDefaultTutorId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border rounded-lg"
                      style={{
                        backgroundColor: colors.bgCard,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      }}
                    >
                      <option value="">Select default tutor...</option>
                      {tutors.filter(t => t.isActive).map((tutor) => (
                        <option key={tutor.id} value={tutor.id}>
                          {tutor.customName || tutor.chatbot?.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Smart Routing Option */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    routingMode === 'smart' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                  style={{ borderColor: routingMode === 'smart' ? undefined : colors.border }}
                >
                  <input
                    type="radio"
                    name="routingMode"
                    value="smart"
                    checked={routingMode === 'smart'}
                    onChange={(e) => setRoutingMode(e.target.value as 'free' | 'all' | 'single' | 'smart' | 'collaborative' | 'random')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium" style={{ color: colors.textPrimary }}>
                      Smart Routing
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Beta
                      </span>
                    </p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      Auto-route questions to the best tutor based on topic
                    </p>
                  </div>
                </label>

                {/* Team Mode / Collaborative Option */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    routingMode === 'collaborative' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                  style={{ borderColor: routingMode === 'collaborative' ? undefined : colors.border }}
                >
                  <input
                    type="radio"
                    name="routingMode"
                    value="collaborative"
                    checked={routingMode === 'collaborative'}
                    onChange={(e) => setRoutingMode(e.target.value as 'free' | 'all' | 'single' | 'smart' | 'collaborative' | 'random')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium" style={{ color: colors.textPrimary }}>
                      Team Mode
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        New
                      </span>
                    </p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      Multiple tutors collaborate to answer each question together
                    </p>
                  </div>
                </label>

                {/* Random Mode Option */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    routingMode === 'random' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                  style={{ borderColor: routingMode === 'random' ? undefined : colors.border }}
                >
                  <input
                    type="radio"
                    name="routingMode"
                    value="random"
                    checked={routingMode === 'random'}
                    onChange={(e) => setRoutingMode(e.target.value as 'free' | 'all' | 'single' | 'smart' | 'collaborative' | 'random')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium" style={{ color: colors.textPrimary }}>
                      Random
                    </p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      A random tutor responds to each question
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Emotional Pulse Toggle */}
            <div
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ backgroundColor: colors.bgHover }}
            >
              <Heart className="w-5 h-5" style={{ color: '#ec4899' }} />
              <div className="flex-1">
                <p className="font-medium" style={{ color: colors.textPrimary }}>
                  Emotional Pulse
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Show emotional feedback widget to students during conversations
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emotionalPulseEnabled}
                  onChange={(e) => setEmotionalPulseEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <Button
                onClick={handleSaveSettings}
                loading={updateSettingsMutation.isPending}
                icon={<Save className="w-4 h-4" />}
              >
                Save Settings
              </Button>
            </div>
          </CardBody>
        )}
      </Card>

      {/* Tutors List */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
            Tutors in this course
          </h2>
        </CardHeader>
        <CardBody>
          {tutors && tutors.length > 0 ? (
            <div className="space-y-3">
              {tutors.map((tutor) => (
                <div
                  key={tutor.id}
                  draggable
                  onDragStart={() => handleDragStart(tutor.id)}
                  onDragOver={(e) => handleDragOver(e, tutor.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                    draggedId === tutor.id ? 'opacity-50' : ''
                  }`}
                  style={{
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                  }}
                >
                  <GripVertical className="w-5 h-5" style={{ color: colors.textMuted }} />

                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br ${getPersonalityColor(
                      tutor.customPersonality || tutor.chatbot?.personality || null
                    )} text-white flex-shrink-0`}
                  >
                    {tutor.chatbot?.avatarUrl ? (
                      <img
                        src={tutor.chatbot.avatarUrl}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <Bot className="w-6 h-6" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium" style={{ color: colors.textPrimary }}>
                        {tutor.customName || tutor.chatbot?.displayName}
                      </h3>
                      {!tutor.isActive && (
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: colors.bgHover, color: colors.textMuted }}
                        >
                          Inactive
                        </span>
                      )}
                      {(tutor.customName || tutor.customSystemPrompt) && (
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: colors.bgTeal, color: colors.textTeal }}
                        >
                          Customized
                        </span>
                      )}
                    </div>
                    <p className="text-sm truncate" style={{ color: colors.textSecondary }}>
                      {tutor.customDescription || tutor.chatbot?.description || 'No description'}
                    </p>
                    <div
                      className="flex items-center gap-4 text-xs mt-1"
                      style={{ color: colors.textMuted }}
                    >
                      <span>{tutor._count?.conversations || 0} conversations</span>
                      <span>{tutor.totalMessages || 0} messages</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link to={`/ai-tools/builder?duplicate=${tutor.chatbotId}&courseId=${courseId}&addToCourse=true`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Copy className="w-4 h-4" />}
                      >
                        Duplicate
                      </Button>
                    </Link>
                    <Link to={`/ai-tools/builder?edit=${tutor.chatbotId}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Edit className="w-4 h-4" />}
                      >
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(tutor)}
                      icon={<Trash2 className="w-4 h-4" />}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Bot}
              title="No tutors yet"
              description="Add AI tutors to help your students learn"
              action={{
                label: 'Add Tutor',
                onClick: () => setShowAddModal(true),
              }}
            />
          )}
        </CardBody>
      </Card>

      {/* Add Tutor Modal */}
      {showAddModal && (
        <AddTutorModal
          availableTutors={availableTutors || []}
          onBatchAdd={(ids) => batchAddMutation.mutate(ids)}
          onClose={() => setShowAddModal(false)}
          isLoading={batchAddMutation.isPending}
          colors={colors}
          courseId={courseId!}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
        title="Remove Tutor"
        message={`Are you sure you want to remove "${
          deleteConfirm?.customName || deleteConfirm?.chatbot?.displayName
        }" from this course? Student conversations will also be deleted.`}
        confirmText="Remove"
        loading={deleteMutation.isPending}
      />
    </div>
  );
};

// Add Tutor Modal Component
interface AddTutorModalProps {
  availableTutors: AvailableTutor[];
  onBatchAdd: (chatbotIds: number[]) => void;
  onClose: () => void;
  isLoading: boolean;
  colors: Record<string, string>;
  courseId: string;
}

const AddTutorModal = ({ availableTutors, onBatchAdd, onClose, isLoading, colors, courseId }: AddTutorModalProps) => {
  const [activeTab, setActiveTab] = useState<'existing' | 'build'>('existing');

  // Multi-select state for existing tutors
  const [selectedTutorIds, setSelectedTutorIds] = useState<Set<number>>(new Set());

  const notAddedTutors = availableTutors.filter((t) => !t.alreadyAdded);

  const toggleTutor = (id: number) => {
    const newSet = new Set(selectedTutorIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTutorIds(newSet);
  };

  const selectAll = () => {
    setSelectedTutorIds(new Set(notAddedTutors.map((t) => t.id)));
  };

  const deselectAll = () => {
    setSelectedTutorIds(new Set());
  };

  const handleAddSelected = () => {
    if (selectedTutorIds.size === 0) return;
    onBatchAdd(Array.from(selectedTutorIds));
  };

  const getPersonalityColor = (personality: string | null) => {
    switch (personality) {
      case 'socratic':
        return 'from-purple-500 to-indigo-500';
      case 'friendly':
        return 'from-green-500 to-emerald-500';
      case 'casual':
        return 'from-orange-500 to-amber-500';
      case 'professional':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl shadow-xl flex flex-col"
        style={{ backgroundColor: colors.bgCard }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: colors.border }}
        >
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
            Add Tutor to Course
          </h2>
          <button onClick={onClose} className="p-1">
            <X className="w-5 h-5" style={{ color: colors.textMuted }} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b" style={{ borderColor: colors.border }}>
          <button
            onClick={() => setActiveTab('existing')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'existing'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent hover:bg-gray-50'
            }`}
            style={{ color: activeTab === 'existing' ? undefined : colors.textSecondary }}
          >
            <Bot className="w-4 h-4" />
            Choose Existing
          </button>
          <button
            onClick={() => setActiveTab('build')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'build'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent hover:bg-gray-50'
            }`}
            style={{ color: activeTab === 'build' ? undefined : colors.textSecondary }}
          >
            <Sparkles className="w-4 h-4" />
            Build New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'existing' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p style={{ color: colors.textSecondary }}>
                  Select tutors to add ({selectedTutorIds.size} selected)
                </p>
                {notAddedTutors.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      Select All
                    </button>
                    <span style={{ color: colors.textMuted }}>|</span>
                    <button
                      onClick={deselectAll}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {notAddedTutors.length > 0 ? (
                  notAddedTutors.map((tutor) => {
                    const isSelected = selectedTutorIds.has(tutor.id);
                    return (
                      <button
                        key={tutor.id}
                        onClick={() => toggleTutor(tutor.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          isSelected ? 'ring-2 ring-primary-500' : ''
                        }`}
                        style={{
                          backgroundColor: isSelected ? colors.bgSelected : colors.bgCard,
                          borderColor: colors.border,
                        }}
                      >
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-primary-600" />
                          ) : (
                            <Square className="w-5 h-5" style={{ color: colors.textMuted }} />
                          )}
                        </div>
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br ${getPersonalityColor(
                            tutor.personality
                          )} text-white flex-shrink-0`}
                        >
                          {tutor.avatarUrl ? (
                            <img
                              src={tutor.avatarUrl}
                              alt=""
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <Bot className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium" style={{ color: colors.textPrimary }}>
                            {tutor.displayName}
                          </p>
                          <p className="text-sm" style={{ color: colors.textSecondary }}>
                            {tutor.description || 'No description'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {tutor.personality && (
                            <span
                              className="text-xs px-2 py-1 rounded"
                              style={{ backgroundColor: colors.bgHover, color: colors.textSecondary }}
                            >
                              {tutor.personality}
                            </span>
                          )}
                          <Link
                            to={`/ai-tools/builder?duplicate=${tutor.id}&courseId=${courseId}&addToCourse=true`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            Customize
                          </Link>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <Bot className="w-12 h-12 mx-auto mb-3" style={{ color: colors.textMuted }} />
                    <p style={{ color: colors.textMuted }}>
                      All available tutors have been added to this course.
                    </p>
                    <button
                      onClick={() => setActiveTab('build')}
                      className="mt-3 text-primary-600 hover:underline text-sm font-medium"
                    >
                      Build a new tutor instead
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'build' && (
            <div className="text-center py-8">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-primary-500" />
              <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
                Build a Custom Tutor
              </h3>
              <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: colors.textSecondary }}>
                Use the full AI Builder to create a customized tutor with advanced
                features like personality rules, response styles, and test chat.
              </p>
              <Link to={`/ai-tools/builder?courseId=${courseId}&addToCourse=true`}>
                <Button icon={<Sparkles className="w-4 h-4" />}>
                  Open AI Builder
                </Button>
              </Link>
            </div>
          )}
        </div>

        {activeTab === 'existing' && (
          <div
            className="flex justify-end gap-3 px-6 py-4 border-t"
            style={{ borderColor: colors.border }}
          >
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSelected}
              disabled={selectedTutorIds.size === 0 || isLoading}
              loading={isLoading}
            >
              Add {selectedTutorIds.size > 0 ? `${selectedTutorIds.size} ` : ''}Tutor{selectedTutorIds.size !== 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

