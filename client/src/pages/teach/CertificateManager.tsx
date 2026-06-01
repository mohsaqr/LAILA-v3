import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, Edit, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import {
  DataTable,
  type ColumnDef,
} from '../../components/common/DataTable';
import { RowMenu } from '../../components/common/RowMenu';
import { RichTextEditor } from '../../components/forum/RichTextEditor';
import apiClient from '../../api/client';
import activityLogger from '../../services/activityLogger';

interface CertificateTemplate {
  id: number;
  name: string;
  description: string | null;
  templateHtml: string;
  isDefault: boolean;
  isActive: boolean;
  issuedCount: number;
  createdAt: string;
  creator?: { id: number; fullname: string } | null;
}

export const CertificateManager = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    activityLogger.logCertificateManagerViewed();
  }, []);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<CertificateTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    templateHtml: '',
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['certificateTemplates'],
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: CertificateTemplate[];
      }>('/certificates/templates');
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
      setTemplateToDelete(null);
      toast.success(t('template_deleted'));
    },
    onError: (error: unknown) => {
      setTemplateToDelete(null);
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || t('failed_delete_template');
      toast.error(message);
    },
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns: ColumnDef<CertificateTemplate>[] = [
    {
      id: 'name',
      header: t('common:name', { defaultValue: 'Name' }),
      sortAccessor: c => c.name.toLowerCase(),
      width: '32%',
      cell: c => (
        <div className="flex items-center gap-2 min-w-0">
          <Award className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p
              className="text-sm truncate text-gray-700 dark:text-gray-200"
              title={c.name}
            >
              {c.name}
            </p>
            {c.isDefault && (
              <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {t('default_label')}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'description',
      header: t('description_label'),
      sortAccessor: c => (c.description || '').toLowerCase(),
      hideOnMobile: true,
      cell: c => (
        <span
          className="block truncate text-sm text-gray-600 dark:text-gray-300"
          title={c.description || ''}
        >
          {c.description || '—'}
        </span>
      ),
    },
    {
      id: 'issued',
      header: t('issued', { defaultValue: 'Issued' }),
      sortAccessor: c => c.issuedCount,
      align: 'right',
      width: '5.5rem',
      cell: c => (
        <span className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">
          {c.issuedCount}
        </span>
      ),
    },
    ...(isAdmin
      ? ([
          {
            id: 'creator',
            header: t('created_by', { defaultValue: 'Created by' }),
            sortAccessor: c => (c.creator?.fullname || '').toLowerCase(),
            hideOnMobile: true,
            width: '12rem',
            cell: c => (
              <span className="text-sm text-gray-600 dark:text-gray-300 truncate block">
                {c.creator?.fullname || '—'}
              </span>
            ),
          },
        ] as ColumnDef<CertificateTemplate>[])
      : []),
    {
      id: 'created',
      header: t('created', { defaultValue: 'Created' }),
      sortAccessor: c => new Date(c.createdAt).getTime(),
      align: 'right',
      width: '7rem',
      hideOnMobile: true,
      cell: c => (
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
          {new Date(c.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-6">
        <Breadcrumb
          homeHref="/"
          items={[{ label: t('certificate_templates') }]}
        />
      </div>

      <DataTable<CertificateTemplate>
        rows={templates}
        columns={columns}
        rowKey={c => c.id}
        isLoading={isLoading}
        pageSize={20}
        globalSearch={{
          placeholder: t('search_templates', {
            defaultValue: 'Search by name or description…',
          }),
          predicate: (c, q) => {
            const x = q.toLowerCase();
            return (
              c.name.toLowerCase().includes(x) ||
              (c.description || '').toLowerCase().includes(x)
            );
          },
        }}
        createCta={{
          label: t('new_template'),
          icon: <Plus className="w-4 h-4" />,
          onClick: () => setShowCreateModal(true),
        }}
        rowActions={c => (
          <RowMenu
            items={[
              {
                key: 'edit',
                label: t('common:edit', { defaultValue: 'Edit' }),
                icon: <Edit className="w-3.5 h-3.5" />,
                onClick: () => openEditModal(c),
              },
              {
                key: 'delete',
                label: t('common:delete', { defaultValue: 'Delete' }),
                icon: <Trash2 className="w-3.5 h-3.5" />,
                onClick: () => setTemplateToDelete(c),
                destructive: true,
              },
            ]}
          />
        )}
      />

      <ConfirmDialog
        isOpen={!!templateToDelete}
        onClose={() => setTemplateToDelete(null)}
        onConfirm={() =>
          templateToDelete && deleteMutation.mutate(templateToDelete.id)
        }
        title={t('delete_template')}
        message={t('delete_template_confirm', { name: templateToDelete?.name })}
        confirmText={t('common:delete')}
        variant="danger"
        loading={deleteMutation.isPending}
      />

      <Modal
        isOpen={showCreateModal || !!editingTemplate}
        onClose={closeModal}
        title={
          editingTemplate
            ? t('edit_template')
            : t('create_certificate_template')
        }
        size="3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-100">
              {t('template_name_label')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              placeholder={t('template_name_placeholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-100">
              {t('description_label')}
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={e =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              placeholder={t('template_description_placeholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-100">
              {t('certificate_content_html')}
            </label>
            <RichTextEditor
              value={formData.templateHtml}
              onChange={html => setFormData({ ...formData, templateHtml: html })}
              placeholder={t('certificate_html_placeholder')}
              maxImageSizeKB={1024}
            />
            <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
              {t('available_placeholders')}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              {t('common:cancel')}
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingTemplate ? t('update_template') : t('create_template')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
