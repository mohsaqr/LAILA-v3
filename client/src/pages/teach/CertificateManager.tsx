import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['teaching', 'common']);
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
      toast.success(t('template_created'));
    },
    onError: () => toast.error(t('failed_create_template')),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const response = await apiClient.put(`/certificates/templates/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificateTemplates'] });
      setEditingTemplate(null);
      toast.success(t('template_updated'));
    },
    onError: () => toast.error(t('failed_update_template')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/certificates/templates/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificateTemplates'] });
      toast.success(t('template_deleted'));
    },
    onError: () => toast.error(t('failed_delete_template')),
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
    return <Loading text={t('loading_certificate_templates')} />;
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
            {t('certificate_templates')}
          </h1>
          <p className="mt-2" style={{ color: colors.textSecondary }}>
            {t('manage_certificate_templates_desc')}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('new_template')}
        </Button>
      </div>

      {!templates || templates.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Award className="w-12 h-12 mx-auto mb-4" style={{ color: colors.gold }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
              {t('no_templates_created')}
            </h3>
            <p style={{ color: colors.textSecondary }}>
              {t('create_templates_desc')}
            </p>
            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('create_template')}
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
                        {t('default_label')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(template)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title={t('edit')}
                  >
                    <Edit className="w-4 h-4" style={{ color: colors.textSecondary }} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(t('delete_template_confirm'))) {
                        deleteMutation.mutate(template.id);
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title={t('common:delete')}
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
                  <span>{t('x_certificates_issued', { count: template.issuedCount })}</span>
                  <span>{t('created_date', { date: new Date(template.createdAt).toLocaleDateString() })}</span>
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
        title={editingTemplate ? t('edit_template') : t('create_certificate_template')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('template_name_label')}
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
              placeholder={t('template_name_placeholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('description_label')}
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
              placeholder={t('template_description_placeholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('certificate_content_html')}
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
              placeholder={t('certificate_html_placeholder')}
              required
            />
            <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
              {t('available_placeholders')}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingTemplate ? t('update_template') : t('create_template')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
