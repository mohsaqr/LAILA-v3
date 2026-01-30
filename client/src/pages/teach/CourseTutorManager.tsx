import { useState } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../hooks/useTheme';
import { courseTutorApi, CourseTutor, AvailableTutor, CreateTutorInput, UpdateTutorInput } from '../../api/courseTutor';
import { coursesApi } from '../../api/courses';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';

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
  const [editingTutor, setEditingTutor] = useState<CourseTutor | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CourseTutor | null>(null);

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
  const addMutation = useMutation({
    mutationFn: (input: CreateTutorInput) =>
      courseTutorApi.addTutorToCourse(parseInt(courseId!), input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseTutors', courseId] });
      queryClient.invalidateQueries({ queryKey: ['availableTutors', courseId] });
      queryClient.invalidateQueries({ queryKey: ['courseTutorStats', courseId] });
      toast.success('Tutor added to course');
      setShowAddModal(false);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add tutor'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ tutorId, input }: { tutorId: number; input: UpdateTutorInput }) =>
      courseTutorApi.updateCourseTutor(parseInt(courseId!), tutorId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseTutors', courseId] });
      toast.success('Tutor updated');
      setEditingTutor(null);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update tutor'),
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
        <Link to="/teach" className="text-primary-600 hover:underline mt-2 inline-block">
          Back to Teaching Dashboard
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/teach"
          className="inline-flex items-center gap-1 text-sm mb-4 hover:underline"
          style={{ color: colors.textSecondary }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Teaching Dashboard
        </Link>

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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTutor(tutor)}
                      icon={<Edit className="w-4 h-4" />}
                    >
                      Edit
                    </Button>
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
          onAdd={(input) => addMutation.mutate(input)}
          onClose={() => setShowAddModal(false)}
          isLoading={addMutation.isPending}
          colors={colors}
        />
      )}

      {/* Edit Tutor Modal */}
      {editingTutor && (
        <EditTutorModal
          tutor={editingTutor}
          onSave={(input) =>
            updateMutation.mutate({ tutorId: editingTutor.id, input })
          }
          onClose={() => setEditingTutor(null)}
          isLoading={updateMutation.isPending}
          colors={colors}
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
  onAdd: (input: CreateTutorInput) => void;
  onClose: () => void;
  isLoading: boolean;
  colors: Record<string, string>;
}

const AddTutorModal = ({ availableTutors, onAdd, onClose, isLoading, colors }: AddTutorModalProps) => {
  const [selectedTutor, setSelectedTutor] = useState<AvailableTutor | null>(null);
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [showCustomization, setShowCustomization] = useState(false);

  const handleAdd = () => {
    if (!selectedTutor) return;
    onAdd({
      chatbotId: selectedTutor.id,
      customName: customName.trim() || undefined,
      customDescription: customDescription.trim() || undefined,
    });
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

        <div className="flex-1 overflow-y-auto p-6">
          <p className="mb-4" style={{ color: colors.textSecondary }}>
            Select a tutor to add to your course:
          </p>

          <div className="space-y-2 mb-6">
            {availableTutors.filter((t) => !t.alreadyAdded).length > 0 ? (
              availableTutors
                .filter((t) => !t.alreadyAdded)
                .map((tutor) => (
                  <button
                    key={tutor.id}
                    onClick={() => setSelectedTutor(tutor)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      selectedTutor?.id === tutor.id ? 'ring-2 ring-primary-500' : ''
                    }`}
                    style={{
                      backgroundColor:
                        selectedTutor?.id === tutor.id ? colors.bgSelected : colors.bgCard,
                      borderColor: colors.border,
                    }}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br ${getPersonalityColor(
                        tutor.personality
                      )} text-white`}
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
                    {selectedTutor?.id === tutor.id && (
                      <Check className="w-5 h-5 text-primary-600" />
                    )}
                  </button>
                ))
            ) : (
              <p className="text-center py-4" style={{ color: colors.textMuted }}>
                All available tutors have been added to this course.
              </p>
            )}
          </div>

          {selectedTutor && (
            <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${colors.border}` }}>
              <label className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={showCustomization}
                  onChange={(e) => setShowCustomization(e.target.checked)}
                  className="rounded"
                />
                <span style={{ color: colors.textPrimary }}>
                  Customize tutor for this course
                </span>
              </label>

              {showCustomization && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                      Custom Name (optional)
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder={selectedTutor.displayName}
                      className="w-full px-3 py-2 border rounded-lg"
                      style={{
                        backgroundColor: colors.bgCard,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                      Custom Description (optional)
                    </label>
                    <textarea
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      placeholder={selectedTutor.description || 'Enter a description...'}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg resize-none"
                      style={{
                        backgroundColor: colors.bgCard,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className="flex justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: colors.border }}
        >
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selectedTutor || isLoading} loading={isLoading}>
            Add Tutor
          </Button>
        </div>
      </div>
    </div>
  );
};

// Edit Tutor Modal Component
interface EditTutorModalProps {
  tutor: CourseTutor;
  onSave: (input: UpdateTutorInput) => void;
  onClose: () => void;
  isLoading: boolean;
  colors: Record<string, string>;
}

const EditTutorModal = ({ tutor, onSave, onClose, isLoading, colors }: EditTutorModalProps) => {
  const [customName, setCustomName] = useState(tutor.customName || '');
  const [customDescription, setCustomDescription] = useState(tutor.customDescription || '');
  const [customWelcomeMessage, setCustomWelcomeMessage] = useState(tutor.customWelcomeMessage || '');
  const [customSystemPrompt, setCustomSystemPrompt] = useState(tutor.customSystemPrompt || '');
  const [customPersonality, setCustomPersonality] = useState(tutor.customPersonality || '');
  const [customTemperature, setCustomTemperature] = useState<string>(
    tutor.customTemperature?.toString() || ''
  );
  const [isActive, setIsActive] = useState(tutor.isActive);

  const handleSave = () => {
    onSave({
      customName: customName.trim() || null,
      customDescription: customDescription.trim() || null,
      customWelcomeMessage: customWelcomeMessage.trim() || null,
      customSystemPrompt: customSystemPrompt.trim() || null,
      customPersonality: customPersonality.trim() || null,
      customTemperature: customTemperature ? parseFloat(customTemperature) : null,
      isActive,
    });
  };

  const personalities = [
    { value: '', label: 'Use default' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'professional', label: 'Professional' },
    { value: 'socratic', label: 'Socratic' },
    { value: 'casual', label: 'Casual' },
    { value: 'academic', label: 'Academic' },
  ];

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
            Edit Tutor: {tutor.chatbot?.displayName}
          </h2>
          <button onClick={onClose} className="p-1">
            <X className="w-5 h-5" style={{ color: colors.textMuted }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              Custom Name
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={tutor.chatbot?.displayName}
              className="w-full px-3 py-2 border rounded-lg"
              style={{
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                color: colors.textPrimary,
              }}
            />
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
              Leave empty to use the default name
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              Custom Description
            </label>
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder={tutor.chatbot?.description || 'Enter a description...'}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg resize-none"
              style={{
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                color: colors.textPrimary,
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              Custom Welcome Message
            </label>
            <textarea
              value={customWelcomeMessage}
              onChange={(e) => setCustomWelcomeMessage(e.target.value)}
              placeholder={tutor.chatbot?.welcomeMessage || 'Enter a welcome message...'}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg resize-none"
              style={{
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                color: colors.textPrimary,
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              Custom System Prompt
            </label>
            <textarea
              value={customSystemPrompt}
              onChange={(e) => setCustomSystemPrompt(e.target.value)}
              placeholder="Override the tutor's system prompt for this course..."
              rows={4}
              className="w-full px-3 py-2 border rounded-lg resize-none font-mono text-sm"
              style={{
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                color: colors.textPrimary,
              }}
            />
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
              Leave empty to use the default system prompt
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                Personality
              </label>
              <select
                value={customPersonality}
                onChange={(e) => setCustomPersonality(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                style={{
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                }}
              >
                {personalities.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                Temperature
              </label>
              <input
                type="number"
                value={customTemperature}
                onChange={(e) => setCustomTemperature(e.target.value)}
                placeholder={tutor.chatbot?.temperature?.toString() || '0.7'}
                min="0"
                max="2"
                step="0.1"
                className="w-full px-3 py-2 border rounded-lg"
                style={{
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                }}
              />
            </div>
          </div>

          <div className="pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              <span style={{ color: colors.textPrimary }}>Tutor is active and visible to students</span>
            </label>
          </div>
        </div>

        <div
          className="flex justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: colors.border }}
        >
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isLoading}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};
