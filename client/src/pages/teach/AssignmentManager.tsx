import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  FileText,
  Calendar,
  Award,
  Users,
  Eye,
  Bot,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi } from '../../api/courses';
import { assignmentsApi } from '../../api/assignments';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Input, TextArea, Select } from '../../components/common/Input';
import { Assignment, CourseModule } from '../../types';

interface AssignmentFormData {
  title: string;
  description: string;
  instructions: string;
  moduleId: number | null;
  submissionType: 'text' | 'file' | 'mixed' | 'ai_agent';
  dueDate: string;
  points: number;
  isPublished: boolean;
}

const initialFormData: AssignmentFormData = {
  title: '',
  description: '',
  instructions: '',
  moduleId: null,
  submissionType: 'text',
  dueDate: '',
  points: 100,
  isPublished: false,
};

export const AssignmentManager = () => {
  const { id } = useParams<{ id: string }>();
  const courseId = parseInt(id!, 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formModal, setFormModal] = useState<{ isOpen: boolean; assignment?: Assignment }>({
    isOpen: false,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<Assignment | null>(null);
  const [formData, setFormData] = useState<AssignmentFormData>(initialFormData);

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  const { data: modules } = useQuery({
    queryKey: ['courseModules', courseId],
    queryFn: () => coursesApi.getModules(courseId),
    enabled: !!courseId,
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['courseAssignments', courseId],
    queryFn: () => assignmentsApi.getAssignments(courseId),
    enabled: !!courseId,
  });

  const createMutation = useMutation({
    mutationFn: (data: AssignmentFormData) =>
      assignmentsApi.createAssignment(courseId, {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      toast.success('Assignment created');
      closeModal();
    },
    onError: () => toast.error('Failed to create assignment'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AssignmentFormData }) =>
      assignmentsApi.updateAssignment(id, {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      toast.success('Assignment updated');
      closeModal();
    },
    onError: () => toast.error('Failed to update assignment'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => assignmentsApi.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', courseId] });
      toast.success('Assignment deleted');
      setDeleteConfirm(null);
    },
    onError: () => toast.error('Failed to delete assignment'),
  });

  const openCreateModal = () => {
    setFormData(initialFormData);
    setFormModal({ isOpen: true });
  };

  const openEditModal = (assignment: Assignment) => {
    setFormData({
      title: assignment.title,
      description: assignment.description || '',
      instructions: assignment.instructions || '',
      moduleId: assignment.moduleId,
      submissionType: assignment.submissionType,
      dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 16) : '',
      points: assignment.points,
      isPublished: assignment.isPublished,
    });
    setFormModal({ isOpen: true, assignment });
  };

  const closeModal = () => {
    setFormModal({ isOpen: false });
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (formModal.assignment) {
      updateMutation.mutate({ id: formModal.assignment.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleChange = (field: keyof AssignmentFormData, value: string | number | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (courseLoading || assignmentsLoading) {
    return <Loading fullScreen text="Loading assignments..." />;
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Course Not Found</h1>
        <Button onClick={() => navigate('/teach')}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/teach/courses/${courseId}/curriculum`)}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Curriculum
        </Button>
      </div>

      {/* Course Header */}
      <Card className="mb-6">
        <CardBody className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-gray-600">Manage assignments and grading</p>
          </div>
          <Button onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
            Create Assignment
          </Button>
        </CardBody>
      </Card>

      {/* Assignments List */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Assignments</h2>
        </CardHeader>
        <CardBody>
          {assignments && assignments.length > 0 ? (
            <div className="space-y-4">
              {assignments.map(assignment => {
                const isAgentAssignment = assignment.submissionType === 'ai_agent';
                const reviewUrl = isAgentAssignment
                  ? `/teach/courses/${courseId}/agent-assignments/${assignment.id}/submissions`
                  : `/teach/courses/${courseId}/assignments/${assignment.id}/submissions`;

                return (
                <div
                  key={assignment.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                >
                  <div className={`w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center ${isAgentAssignment ? 'border-violet-200' : ''}`}>
                    {isAgentAssignment ? (
                      <Bot className="w-5 h-5 text-violet-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-blue-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 truncate">{assignment.title}</h3>
                      <StatusBadge status={assignment.isPublished ? 'published' : 'draft'} />
                      {isAgentAssignment && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">
                          AI Agent
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(assignment.dueDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="w-4 h-4" />
                        {assignment.points} points
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {assignment._count?.submissions || 0} submissions
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link to={reviewUrl}>
                      <Button variant="outline" size="sm" icon={<Eye className="w-4 h-4" />}>
                        Review
                      </Button>
                    </Link>
                    <button
                      onClick={() => openEditModal(assignment)}
                      className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                      title="Edit assignment"
                    >
                      <Edit className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(assignment)}
                      className="p-2 rounded-lg hover:bg-red-100 transition-colors"
                      title="Delete assignment"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No assignments yet"
              description="Create your first assignment to start collecting student work"
              action={{ label: 'Create Assignment', onClick: openCreateModal }}
            />
          )}
        </CardBody>
      </Card>

      {/* Assignment Form Modal */}
      <Modal
        isOpen={formModal.isOpen}
        onClose={closeModal}
        title={formModal.assignment ? 'Edit Assignment' : 'Create Assignment'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={formData.title}
            onChange={e => handleChange('title', e.target.value)}
            placeholder="e.g., Week 1 Lab Assignment"
            required
          />

          <TextArea
            label="Description"
            value={formData.description}
            onChange={e => handleChange('description', e.target.value)}
            placeholder="Brief description of the assignment"
            rows={2}
          />

          <TextArea
            label="Instructions"
            value={formData.instructions}
            onChange={e => handleChange('instructions', e.target.value)}
            placeholder="Detailed instructions for students"
            rows={4}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Module (optional)"
              value={formData.moduleId?.toString() || ''}
              onChange={e =>
                handleChange('moduleId', e.target.value ? parseInt(e.target.value) : null)
              }
              options={[
                { value: '', label: 'No specific module' },
                ...(modules || []).map((m: CourseModule) => ({
                  value: m.id.toString(),
                  label: m.title,
                })),
              ]}
            />

            <Select
              label="Submission Type"
              value={formData.submissionType}
              onChange={e =>
                handleChange('submissionType', e.target.value as 'text' | 'file' | 'mixed' | 'ai_agent')
              }
              options={[
                { value: 'text', label: 'Text Entry' },
                { value: 'file', label: 'File Upload' },
                { value: 'mixed', label: 'Text and File' },
                { value: 'ai_agent', label: 'AI Agent Builder' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due Date"
              type="datetime-local"
              value={formData.dueDate}
              onChange={e => handleChange('dueDate', e.target.value)}
            />

            <Input
              label="Points"
              type="number"
              value={formData.points}
              onChange={e => handleChange('points', parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPublished"
              checked={formData.isPublished}
              onChange={e => handleChange('isPublished', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="isPublished" className="text-sm text-gray-700">
              Publish immediately (students can see and submit)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {formModal.assignment ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
        title="Delete Assignment"
        message={`Are you sure you want to delete "${deleteConfirm?.title}"? All student submissions will also be deleted.`}
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
};
