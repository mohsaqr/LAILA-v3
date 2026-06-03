import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { categoriesApi } from '../../../api/categories';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import {
  DataTable,
  type ColumnDef,
} from '../../../components/common/DataTable';
import { RowMenu } from '../../../components/common/RowMenu';
import { Category } from '../../../types';

export const CategoriesPanel = () => {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();

  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => categoriesApi.createCategory(title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(t('category_created'));
      setIsCreating(false);
      setTitleInput('');
    },
    onError: () => toast.error(t('common:error')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      categoriesApi.updateCategory(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(t('category_updated'));
      setEditCategory(null);
      setTitleInput('');
    },
    onError: () => toast.error(t('common:error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoriesApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(t('category_deleted'));
      setDeleteCategory(null);
    },
    onError: () => toast.error(t('common:error')),
  });

  const openCreate = () => {
    setTitleInput('');
    setIsCreating(true);
  };

  const openEdit = (cat: Category) => {
    setTitleInput(cat.title);
    setEditCategory(cat);
  };

  const handleSave = () => {
    const trimmed = titleInput.trim();
    if (!trimmed) return;
    if (editCategory) {
      updateMutation.mutate({ id: editCategory.id, title: trimmed });
    } else {
      createMutation.mutate(trimmed);
    }
  };

  const handleExport = () => {
    try {
      const blob = new Blob([JSON.stringify(categories, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `categories-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('export_downloaded'));
    } catch {
      toast.error(t('export_failed'));
    }
  };

  const columns: ColumnDef<Category>[] = [
    {
      id: 'title',
      header: t('category_title'),
      sortAccessor: c => c.title.toLowerCase(),
      cell: c => (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {c.title}
        </span>
      ),
    },
  ];

  return (
    <div>
      <DataTable<Category>
        rows={categories}
        columns={columns}
        rowKey={c => c.id}
        isLoading={isLoading}
        pageSize={10}
        globalSearch={{
          placeholder: t('filter_by_name_email'),
          predicate: (c, q) =>
            c.title.toLowerCase().includes(q.toLowerCase()),
        }}
        exportAction={{ onClick: handleExport }}
        createCta={{
          label: t('add_category'),
          icon: <Plus className="w-4 h-4" />,
          onClick: openCreate,
        }}
        rowActions={c => (
          <RowMenu
            items={[
              {
                key: 'edit',
                label: t('edit_category'),
                icon: <Pencil className="w-3.5 h-3.5" />,
                onClick: () => openEdit(c),
              },
              {
                key: 'delete',
                label: t('delete_category'),
                icon: <Trash2 className="w-3.5 h-3.5" />,
                onClick: () => setDeleteCategory(c),
                destructive: true,
              },
            ]}
          />
        )}
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isCreating || !!editCategory}
        onClose={() => {
          setIsCreating(false);
          setEditCategory(null);
          setTitleInput('');
        }}
        title={editCategory ? t('edit_category') : t('add_category')}
      >
        <div className="space-y-4">
          <Input
            label={t('category_title')}
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(false);
                setEditCategory(null);
                setTitleInput('');
              }}
            >
              {t('common:cancel')}
            </Button>
            <Button
              onClick={handleSave}
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={!titleInput.trim()}
            >
              {t('common:save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteCategory}
        onClose={() => setDeleteCategory(null)}
        title={t('delete_category')}
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            {t('confirm_delete_category', { title: deleteCategory?.title })}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteCategory(null)}>
              {t('common:cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                deleteCategory && deleteMutation.mutate(deleteCategory.id)
              }
              loading={deleteMutation.isPending}
            >
              {t('common:delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
