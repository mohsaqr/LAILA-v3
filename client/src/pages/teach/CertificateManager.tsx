import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Award, Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import apiClient from '../../api/client';

interface CertificateTemplate {
  id: number;
  name: string;
  description: string | null;
  templateHtml: string;
  isDefault: boolean;
  isActive: boolean;
  issuedCount: number;
  createdAt: string;
}

export const CertificateManager = () => {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    templateHtml: '',
  });

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    accent: '#088F8F',
    gold: '#f59e0b',
  };

  const { data: templates, isLoading } = useQuery({
    queryKey: ['certificateTemplates'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: CertificateTemplate[] }>('/certificates/templates');
      return response.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.post('/certificates/templates', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificateTemplates'] });
      setShowCreateModal(false);
      setFormData({ name: '', description: '', templateHtml: '' });
      toast.success('Template created successfully');
    },
    onError: () => toast.error('Failed to create template'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const response = await apiClient.put(`/certificates/templates/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificateTemplates'] });
      setEditingTemplate(null);
      toast.success('Template updated successfully');
    },
    onError: () => toast.error('Failed to update template'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/certificates/templates/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificateTemplates'] });
      toast.success('Template deleted');
    },
    onError: () => toast.error('Failed to delete template'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditModal = (template: CertificateTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      templateHtml: template.templateHtml,
    });
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingTemplate(null);
    setFormData({ name: '', description: '', templateHtml: '' });
  };

  if (isLoading) {
    return <Loading text="Loading certificate templates..." />;
  }

  const breadcrumbItems = buildTeachingBreadcrumb(undefined, undefined, 'Certificates');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
            Certificate Templates
          </h1>
          <p className="mt-2" style={{ color: colors.textSecondary }}>
            Create and manage certificate templates for your courses
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {!templates || templates.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Award className="w-12 h-12 mx-auto mb-4" style={{ color: colors.gold }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
              No Templates Created
            </h3>
            <p style={{ color: colors.textSecondary }}>
              Create certificate templates to issue to students who complete your courses.
            </p>
            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Award className="w-5 h-5" style={{ color: colors.gold }} />
                  <div>
                    <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
                      {template.name}
                    </h3>
                    {template.isDefault && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(template)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" style={{ color: colors.textSecondary }} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this template?')) {
                        deleteMutation.mutate(template.id);
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </CardHeader>
              <CardBody>
                {template.description && (
                  <p className="text-sm mb-3" style={{ color: colors.textSecondary }}>
                    {template.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm" style={{ color: colors.textSecondary }}>
                  <span>{template.issuedCount} certificates issued</span>
                  <span>Created {new Date(template.createdAt).toLocaleDateString()}</span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal || !!editingTemplate}
        onClose={closeModal}
        title={editingTemplate ? 'Edit Template' : 'Create Certificate Template'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              Template Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
                color: colors.textPrimary,
              }}
              placeholder="e.g., Course Completion Certificate"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
                color: colors.textPrimary,
              }}
              placeholder="Brief description of this template"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              Certificate Content (HTML)
            </label>
            <textarea
              value={formData.templateHtml}
              onChange={(e) => setFormData({ ...formData, templateHtml: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border font-mono text-sm"
              style={{
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
                color: colors.textPrimary,
              }}
              rows={10}
              placeholder="<div>Certificate content with {{studentName}}, {{courseName}}, {{date}} placeholders</div>"
              required
            />
            <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
              Available placeholders: {'{{studentName}}'}, {'{{courseName}}'}, {'{{date}}'}, {'{{verificationCode}}'}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingTemplate ? 'Update' : 'Create'} Template
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
