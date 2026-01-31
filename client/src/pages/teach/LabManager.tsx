import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Lock,
  Code,
  Users,
  ArrowLeft,
  X,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Save,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { customLabsApi } from '../../api/customLabs';
import { coursesApi } from '../../api/courses';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { useTheme } from '../../hooks/useTheme';
import { CustomLab, LabTemplate, LabType, Course } from '../../types';
import toast from 'react-hot-toast';

export const LabManager = () => {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedLab, setSelectedLab] = useState<CustomLab | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<LabTemplate | null>(null);
  const [expandedLabId, setExpandedLabId] = useState<number | null>(null);

  // Form states
  const [labForm, setLabForm] = useState({
    name: '',
    description: '',
    labType: 'tna',
    isPublic: false,
    addDefaultTemplates: true,
  });
  const [templateForm, setTemplateForm] = useState({
    title: '',
    description: '',
    code: '',
  });
  const [assignCourseId, setAssignCourseId] = useState<number | null>(null);

  // Fetch data
  const { data: labs, isLoading: labsLoading } = useQuery({
    queryKey: ['myLabs'],
    queryFn: customLabsApi.getMyLabs,
  });

  const { data: labTypes } = useQuery({
    queryKey: ['labTypes'],
    queryFn: customLabsApi.getLabTypes,
  });

  const { data: myCourses } = useQuery({
    queryKey: ['myCourses'],
    queryFn: coursesApi.getMyCourses,
  });

  const colors = {
    bg: isDark ? '#111827' : '#f3f4f6',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    inputBg: isDark ? '#374151' : '#ffffff',
    badge: isDark ? 'rgba(52, 211, 153, 0.2)' : '#d1fae5',
    badgeText: isDark ? '#6ee7b7' : '#059669',
  };

  // Mutations
  const createLabMutation = useMutation({
    mutationFn: customLabsApi.createLab,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      setShowCreateModal(false);
      resetLabForm();
      toast.success('Lab created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create lab');
    },
  });

  const updateLabMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => customLabsApi.updateLab(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      setShowEditModal(false);
      setSelectedLab(null);
      toast.success('Lab updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update lab');
    },
  });

  const deleteLabMutation = useMutation({
    mutationFn: customLabsApi.deleteLab,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      setShowDeleteModal(false);
      setSelectedLab(null);
      toast.success('Lab deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete lab');
    },
  });

  const addTemplateMutation = useMutation({
    mutationFn: ({ labId, data }: { labId: number; data: any }) => customLabsApi.addTemplate(labId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      setShowTemplateModal(false);
      resetTemplateForm();
      toast.success('Template added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add template');
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ labId, templateId, data }: { labId: number; templateId: number; data: any }) =>
      customLabsApi.updateTemplate(labId, templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      setShowTemplateModal(false);
      setSelectedTemplate(null);
      toast.success('Template updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update template');
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: ({ labId, templateId }: { labId: number; templateId: number }) =>
      customLabsApi.deleteTemplate(labId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      toast.success('Template deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete template');
    },
  });

  const assignLabMutation = useMutation({
    mutationFn: ({ labId, courseId }: { labId: number; courseId: number }) =>
      customLabsApi.assignToCourse(labId, { courseId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      setShowAssignModal(false);
      setAssignCourseId(null);
      toast.success('Lab assigned to course');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign lab');
    },
  });

  const unassignLabMutation = useMutation({
    mutationFn: ({ labId, courseId }: { labId: number; courseId: number }) =>
      customLabsApi.unassignFromCourse(labId, courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      toast.success('Lab unassigned from course');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to unassign lab');
    },
  });

  // Helpers
  const resetLabForm = () => {
    setLabForm({
      name: '',
      description: '',
      labType: 'tna',
      isPublic: false,
      addDefaultTemplates: true,
    });
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      title: '',
      description: '',
      code: '',
    });
  };

  const handleCreateLab = () => {
    createLabMutation.mutate(labForm);
  };

  const handleUpdateLab = () => {
    if (!selectedLab) return;
    updateLabMutation.mutate({
      id: selectedLab.id,
      data: {
        name: labForm.name,
        description: labForm.description,
        isPublic: labForm.isPublic,
      },
    });
  };

  const handleDeleteLab = () => {
    if (!selectedLab) return;
    deleteLabMutation.mutate(selectedLab.id);
  };

  const handleSaveTemplate = () => {
    if (!selectedLab) return;

    if (selectedTemplate) {
      updateTemplateMutation.mutate({
        labId: selectedLab.id,
        templateId: selectedTemplate.id,
        data: templateForm,
      });
    } else {
      addTemplateMutation.mutate({
        labId: selectedLab.id,
        data: templateForm,
      });
    }
  };

  const handleAssignLab = () => {
    if (!selectedLab || !assignCourseId) return;
    assignLabMutation.mutate({ labId: selectedLab.id, courseId: assignCourseId });
  };

  const openEditModal = (lab: CustomLab) => {
    setSelectedLab(lab);
    setLabForm({
      name: lab.name,
      description: lab.description || '',
      labType: lab.labType,
      isPublic: lab.isPublic,
      addDefaultTemplates: false,
    });
    setShowEditModal(true);
  };

  const openTemplateModal = (lab: CustomLab, template?: LabTemplate) => {
    setSelectedLab(lab);
    setSelectedTemplate(template || null);
    setTemplateForm({
      title: template?.title || '',
      description: template?.description || '',
      code: template?.code || '',
    });
    setShowTemplateModal(true);
  };

  const openAssignModal = (lab: CustomLab) => {
    setSelectedLab(lab);
    setAssignCourseId(null);
    setShowAssignModal(true);
  };

  const openDeleteModal = (lab: CustomLab) => {
    setSelectedLab(lab);
    setShowDeleteModal(true);
  };

  if (labsLoading) {
    return <Loading text="Loading labs..." />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/labs">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
                Back to Labs
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                Lab Manager
              </h1>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Create and manage your custom labs
              </p>
            </div>
          </div>

          <Button onClick={() => setShowCreateModal(true)} icon={<Plus className="w-4 h-4" />}>
            Create Lab
          </Button>
        </div>

        {/* Labs List */}
        {labs && labs.length > 0 ? (
          <div className="space-y-4">
            {labs.map((lab: CustomLab) => {
              const isExpanded = expandedLabId === lab.id;

              return (
                <Card key={lab.id}>
                  <CardBody className="p-0">
                    {/* Lab Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() => setExpandedLabId(isExpanded ? null : lab.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center">
                          <FlaskConical className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
                            {lab.name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm" style={{ color: colors.textSecondary }}>
                            <span className="flex items-center gap-1">
                              <Code className="w-3.5 h-3.5" />
                              {lab._count?.templates || 0} templates
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {lab._count?.assignments || 0} courses
                            </span>
                            {lab.isPublic ? (
                              <span className="flex items-center gap-1 text-emerald-500">
                                <Globe className="w-3.5 h-3.5" />
                                Public
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5" />
                                Private
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link to={`/labs/${lab.id}`} onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm">
                            Preview
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAssignModal(lab);
                          }}
                          icon={<BookOpen className="w-4 h-4" />}
                        >
                          Assign
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(lab);
                          }}
                          icon={<Pencil className="w-4 h-4" />}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteModal(lab);
                          }}
                          icon={<Trash2 className="w-4 h-4 text-red-500" />}
                        >
                          Delete
                        </Button>
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5" style={{ color: colors.textSecondary }} />
                        ) : (
                          <ChevronRight className="w-5 h-5" style={{ color: colors.textSecondary }} />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t p-4" style={{ borderColor: colors.border }}>
                        {/* Templates Section */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium" style={{ color: colors.textPrimary }}>
                              Templates
                            </h4>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openTemplateModal(lab)}
                              icon={<Plus className="w-3.5 h-3.5" />}
                            >
                              Add Template
                            </Button>
                          </div>

                          {lab.templates && lab.templates.length > 0 ? (
                            <div className="space-y-2">
                              {lab.templates
                                .sort((a, b) => a.orderIndex - b.orderIndex)
                                .map((template) => (
                                  <div
                                    key={template.id}
                                    className="flex items-center justify-between p-3 rounded-lg border"
                                    style={{ borderColor: colors.border, backgroundColor: colors.inputBg }}
                                  >
                                    <div className="flex items-center gap-3">
                                      <GripVertical className="w-4 h-4" style={{ color: colors.textSecondary }} />
                                      <div>
                                        <p className="font-medium" style={{ color: colors.textPrimary }}>
                                          {template.title}
                                        </p>
                                        {template.description && (
                                          <p className="text-xs" style={{ color: colors.textSecondary }}>
                                            {template.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openTemplateModal(lab, template)}
                                        icon={<Pencil className="w-3.5 h-3.5" />}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          deleteTemplateMutation.mutate({
                                            labId: lab.id,
                                            templateId: template.id,
                                          })
                                        }
                                        icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <p className="text-sm" style={{ color: colors.textSecondary }}>
                              No templates yet. Add templates to provide code examples for students.
                            </p>
                          )}
                        </div>

                        {/* Assignments Section */}
                        {lab.assignments && lab.assignments.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-3" style={{ color: colors.textPrimary }}>
                              Assigned Courses
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {lab.assignments.map((assignment) => (
                                <span
                                  key={assignment.id}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                                  style={{ backgroundColor: colors.badge, color: colors.badgeText }}
                                >
                                  {assignment.course?.title}
                                  <button
                                    onClick={() =>
                                      unassignLabMutation.mutate({
                                        labId: lab.id,
                                        courseId: assignment.courseId,
                                      })
                                    }
                                    className="hover:text-red-500"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-16">
              <FlaskConical className="w-16 h-16 mx-auto mb-4" style={{ color: colors.textSecondary }} />
              <h3 className="text-xl font-semibold mb-2" style={{ color: colors.textPrimary }}>
                No Labs Yet
              </h3>
              <p className="mb-6" style={{ color: colors.textSecondary }}>
                Create your first lab to get started with interactive R analytics.
              </p>
              <Button onClick={() => setShowCreateModal(true)} icon={<Plus className="w-4 h-4" />}>
                Create Your First Lab
              </Button>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Create Lab Modal */}
      {showCreateModal && (
        <Modal title="Create New Lab" onClose={() => setShowCreateModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                Lab Name *
              </label>
              <input
                type="text"
                value={labForm.name}
                onChange={(e) => setLabForm({ ...labForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                placeholder="e.g., TNA Lab - Network Analysis"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                Description
              </label>
              <textarea
                value={labForm.description}
                onChange={(e) => setLabForm({ ...labForm, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                rows={3}
                placeholder="Describe what this lab is about..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                Lab Type *
              </label>
              <select
                value={labForm.labType}
                onChange={(e) => setLabForm({ ...labForm, labType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
              >
                {labTypes?.map((type: LabType) => (
                  <option key={type.id} value={type.id} disabled={type.disabled}>
                    {type.name} {type.disabled ? '(Coming Soon)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="addDefaultTemplates"
                checked={labForm.addDefaultTemplates}
                onChange={(e) => setLabForm({ ...labForm, addDefaultTemplates: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-500"
              />
              <label htmlFor="addDefaultTemplates" className="text-sm" style={{ color: colors.textPrimary }}>
                Add default templates for this lab type
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isPublic"
                checked={labForm.isPublic}
                onChange={(e) => setLabForm({ ...labForm, isPublic: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-500"
              />
              <label htmlFor="isPublic" className="text-sm" style={{ color: colors.textPrimary }}>
                Make this lab public (visible to all users)
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateLab}
                disabled={!labForm.name || createLabMutation.isPending}
                icon={createLabMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              >
                {createLabMutation.isPending ? 'Creating...' : 'Create Lab'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Lab Modal */}
      {showEditModal && selectedLab && (
        <Modal title="Edit Lab" onClose={() => setShowEditModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                Lab Name *
              </label>
              <input
                type="text"
                value={labForm.name}
                onChange={(e) => setLabForm({ ...labForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                Description
              </label>
              <textarea
                value={labForm.description}
                onChange={(e) => setLabForm({ ...labForm, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="editIsPublic"
                checked={labForm.isPublic}
                onChange={(e) => setLabForm({ ...labForm, isPublic: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-500"
              />
              <label htmlFor="editIsPublic" className="text-sm" style={{ color: colors.textPrimary }}>
                Make this lab public
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateLab}
                disabled={!labForm.name || updateLabMutation.isPending}
                icon={<Save className="w-4 h-4" />}
              >
                {updateLabMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedLab && (
        <Modal title="Delete Lab" onClose={() => setShowDeleteModal(false)}>
          <p className="mb-6" style={{ color: colors.textSecondary }}>
            Are you sure you want to delete <strong>{selectedLab.name}</strong>? This action cannot be undone. All templates and course assignments will be removed.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteLab}
              disabled={deleteLabMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              icon={<Trash2 className="w-4 h-4" />}
            >
              {deleteLabMutation.isPending ? 'Deleting...' : 'Delete Lab'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Template Modal */}
      {showTemplateModal && selectedLab && (
        <Modal
          title={selectedTemplate ? 'Edit Template' : 'Add Template'}
          onClose={() => setShowTemplateModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                Title *
              </label>
              <input
                type="text"
                value={templateForm.title}
                onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                placeholder="e.g., Load Data"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                Description
              </label>
              <input
                type="text"
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                placeholder="Brief description of what this template does"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                R Code *
              </label>
              <textarea
                value={templateForm.code}
                onChange={(e) => setTemplateForm({ ...templateForm, code: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                rows={10}
                placeholder="# Enter R code here..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setShowTemplateModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={!templateForm.title || !templateForm.code || addTemplateMutation.isPending || updateTemplateMutation.isPending}
                icon={<Save className="w-4 h-4" />}
              >
                {addTemplateMutation.isPending || updateTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign to Course Modal */}
      {showAssignModal && selectedLab && (
        <Modal title="Assign Lab to Course" onClose={() => setShowAssignModal(false)}>
          <div className="space-y-4">
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Select a course to assign <strong>{selectedLab.name}</strong> to.
            </p>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                Course
              </label>
              <select
                value={assignCourseId || ''}
                onChange={(e) => setAssignCourseId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
              >
                <option value="">Select a course...</option>
                {myCourses?.map((course: Course) => {
                  const isAlreadyAssigned = selectedLab.assignments?.some((a) => a.courseId === course.id);
                  return (
                    <option key={course.id} value={course.id} disabled={isAlreadyAssigned}>
                      {course.title} {isAlreadyAssigned ? '(Already assigned)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignLab}
                disabled={!assignCourseId || assignLabMutation.isPending}
                icon={<BookOpen className="w-4 h-4" />}
              >
                {assignLabMutation.isPending ? 'Assigning...' : 'Assign to Course'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// Simple Modal Component
interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

const Modal = ({ title, children, onClose }: ModalProps) => {
  const { isDark } = useTheme();

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="w-full max-w-lg rounded-xl shadow-xl border"
        style={{ backgroundColor: colors.bg, borderColor: colors.border }}
      >
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: colors.border }}
        >
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
            {title}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" style={{ color: colors.textPrimary }} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

