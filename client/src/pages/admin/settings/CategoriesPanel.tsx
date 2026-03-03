import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { categoriesApi } from '../../../api/categories';
import { useTheme } from '../../../hooks/useTheme';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { Loading } from '../../../components/common/Loading';
import { Input } from '../../../components/common/Input';
import { Category } from '../../../types';
import toast from 'react-hot-toast';

const PAGE_SIZE = 10;

export const CategoriesPanel = () => {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const { isDark } = useTheme();

  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgHeader: isDark ? 'rgba(55, 65, 81, 0.5)' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
  });

  // Client-side search + pagination
  const filtered = useMemo(() => {
    if (!categories) return [];
    const q = search.trim().toLowerCase();
    return q ? categories.filter(c => c.title.toLowerCase().includes(q)) : categories;
  }, [categories, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

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

  if (isLoading) {
    return <Loading text={t('loading_categories')} />;
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder={t('filter_by_name_email')}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{
              background: colors.bg,
              borderColor: colors.border,
              color: colors.textPrimary,
            }}
          />
        </div>

        {/* Count + Add button */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm" style={{ color: colors.textSecondary }}>
            {filtered.length} {t('categories')}
          </span>
          <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            {t('add_category')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: colors.border, background: colors.bg }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: colors.bgHeader }}>
              <th
                className="px-6 py-3 text-left font-medium uppercase tracking-wider text-xs"
                style={{ color: colors.textSecondary }}
              >
                {t('category_title')}
              </th>
              <th
                className="px-6 py-3 text-right font-medium uppercase tracking-wider text-xs"
                style={{ color: colors.textSecondary }}
              >
                {t('common:actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-6 py-8 text-center" style={{ color: colors.textSecondary }}>
                  {search ? t('no_users_found') : t('no_categories')}
                </td>
              </tr>
            ) : (
              paginated.map((cat) => (
                <tr
                  key={cat.id}
                  className="border-t transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  style={{ borderColor: colors.border }}
                >
                  <td className="px-6 py-3 font-medium" style={{ color: colors.textPrimary }}>
                    {cat.title}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                        title={t('edit_category')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteCategory(cat)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title={t('delete_category')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            {t('page_of_pages', { page: safePage, total: totalPages })}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              style={{ color: colors.textSecondary }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`min-w-[2rem] h-8 text-sm rounded-lg transition-colors ${
                  p === safePage
                    ? 'bg-primary-500 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                style={{ color: p === safePage ? undefined : colors.textSecondary }}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              style={{ color: colors.textSecondary }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
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
          <p style={{ color: colors.textSecondary }}>
            {t('confirm_delete_category', { title: deleteCategory?.title })}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteCategory(null)}>
              {t('common:cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteCategory && deleteMutation.mutate(deleteCategory.id)}
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
