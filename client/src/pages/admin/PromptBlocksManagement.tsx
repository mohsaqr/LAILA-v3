/**
 * Prompt Blocks Management Page
 *
 * Admin interface for managing customizable prompt building blocks.
 * Allows creating, editing, deleting, and reordering blocks and categories.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Blocks,
  Plus,
  Trash2,
  Edit2,
  Star,
  StarOff,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
  User,
  MessageCircle,
  Sparkles,
  Shield,
  Layout,
  BookOpen,
  FolderPlus,
} from 'lucide-react';
import {
  promptBlocksApi,
  PromptBlockFromApi,
  PromptBlockCategoryFromApi,
  CreateBlockInput,
  UpdateBlockInput,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../../api/promptBlocks';
import { AdminLayout } from '../../components/admin';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, TextArea } from '../../components/common/Input';
import { Loading } from '../../components/common/Loading';
import { Modal } from '../../components/common/Modal';
import toast from 'react-hot-toast';

// Icon mapping
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  persona: User,
  tone: MessageCircle,
  behavior: Sparkles,
  constraint: Shield,
  format: Layout,
  knowledge: BookOpen,
};

interface BlockFormData {
  category: string;
  label: string;
  promptText: string;
  description: string;
  popular: boolean;
  orderIndex: number;
}

interface CategoryFormData {
  slug: string;
  name: string;
  description: string;
  icon: string;
  orderIndex: number;
}

const initialBlockForm: BlockFormData = {
  category: 'persona',
  label: '',
  promptText: '',
  description: '',
  popular: false,
  orderIndex: 0,
};

const initialCategoryForm: CategoryFormData = {
  slug: '',
  name: '',
  description: '',
  icon: 'Sparkles',
  orderIndex: 0,
};

export const PromptBlocksManagement = () => {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<PromptBlockFromApi | null>(null);
  const [editingCategory, setEditingCategory] = useState<PromptBlockCategoryFromApi | null>(null);
  const [blockForm, setBlockForm] = useState<BlockFormData>(initialBlockForm);
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(initialCategoryForm);
  const [showInactive, setShowInactive] = useState(false);

  // Query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['adminPromptBlocks'],
    queryFn: promptBlocksApi.getAdminBlocksWithCategories,
  });

  // Mutations for blocks
  const createBlockMutation = useMutation({
    mutationFn: (data: CreateBlockInput) => promptBlocksApi.createBlock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPromptBlocks'] });
      queryClient.invalidateQueries({ queryKey: ['promptBlocks'] });
      setShowBlockModal(false);
      setBlockForm(initialBlockForm);
      toast.success(t('block_created'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_to_create_block'));
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBlockInput }) =>
      promptBlocksApi.updateBlock(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPromptBlocks'] });
      queryClient.invalidateQueries({ queryKey: ['promptBlocks'] });
      setShowBlockModal(false);
      setEditingBlock(null);
      setBlockForm(initialBlockForm);
      toast.success(t('block_updated'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_to_update_block'));
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (id: number) => promptBlocksApi.deleteBlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPromptBlocks'] });
      queryClient.invalidateQueries({ queryKey: ['promptBlocks'] });
      toast.success(t('block_deactivated'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_to_delete_block'));
    },
  });

  const toggleBlockPopularMutation = useMutation({
    mutationFn: ({ id, popular }: { id: number; popular: boolean }) =>
      promptBlocksApi.updateBlock(id, { popular }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPromptBlocks'] });
      queryClient.invalidateQueries({ queryKey: ['promptBlocks'] });
    },
  });

  const toggleBlockActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      promptBlocksApi.updateBlock(id, { isActive }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminPromptBlocks'] });
      queryClient.invalidateQueries({ queryKey: ['promptBlocks'] });
      toast.success(variables.isActive ? t('block_activated') : t('block_deactivated'));
    },
  });

  // Mutations for categories
  const createCategoryMutation = useMutation({
    mutationFn: (data: CreateCategoryInput) => promptBlocksApi.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPromptBlocks'] });
      queryClient.invalidateQueries({ queryKey: ['promptBlocks'] });
      setShowCategoryModal(false);
      setCategoryForm(initialCategoryForm);
      toast.success(t('category_created'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_to_create_category'));
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCategoryInput }) =>
      promptBlocksApi.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPromptBlocks'] });
      queryClient.invalidateQueries({ queryKey: ['promptBlocks'] });
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm(initialCategoryForm);
      toast.success(t('category_updated'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_to_update_category'));
    },
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: promptBlocksApi.seedDefaults,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['adminPromptBlocks'] });
      queryClient.invalidateQueries({ queryKey: ['promptBlocks'] });
      if (result.blocksSeeded || result.categoriesSeeded) {
        toast.success(t('default_blocks_seeded'));
      } else {
        toast.success(t('default_blocks_exist'));
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_to_seed_defaults'));
    },
  });

  // Handlers
  const toggleCategory = (slug: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(slug)) {
        newSet.delete(slug);
      } else {
        newSet.add(slug);
      }
      return newSet;
    });
  };

  const openBlockModal = (block?: PromptBlockFromApi) => {
    if (block) {
      setEditingBlock(block);
      setBlockForm({
        category: block.category,
        label: block.label,
        promptText: block.promptText,
        description: block.description || '',
        popular: block.popular,
        orderIndex: block.orderIndex,
      });
    } else {
      setEditingBlock(null);
      setBlockForm(initialBlockForm);
    }
    setShowBlockModal(true);
  };

  const openCategoryModal = (category?: PromptBlockCategoryFromApi) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        slug: category.slug,
        name: category.name,
        description: category.description || '',
        icon: category.icon || 'Sparkles',
        orderIndex: category.orderIndex,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm(initialCategoryForm);
    }
    setShowCategoryModal(true);
  };

  const handleBlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBlock) {
      updateBlockMutation.mutate({
        id: editingBlock.id,
        data: blockForm,
      });
    } else {
      createBlockMutation.mutate(blockForm);
    }
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        data: {
          name: categoryForm.name,
          description: categoryForm.description,
          icon: categoryForm.icon,
          orderIndex: categoryForm.orderIndex,
        },
      });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };

  const getBlocksForCategory = (categorySlug: string) => {
    if (!data) return [];
    let blocks = data.blocks.filter((b) => b.category === categorySlug);
    if (!showInactive) {
      blocks = blocks.filter((b) => b.isActive);
    }
    return blocks.sort((a, b) => a.orderIndex - b.orderIndex);
  };

  if (isLoading) {
    return <Loading fullScreen text={t('loading_prompt_blocks')} />;
  }

  const categories = data?.categories || [];
  const displayCategories = showInactive
    ? categories
    : categories.filter((c) => c.isActive);

  return (
    <AdminLayout
      title={t('prompt_building_blocks')}
      description={t('prompt_blocks_description')}
      headerActions={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            {t('common:refresh')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => seedDefaultsMutation.mutate()}
            loading={seedDefaultsMutation.isPending}
          >
            {t('seed_defaults')}
          </Button>
        </>
      }
    >
      {/* Actions Bar */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => openBlockModal()}
                icon={<Plus className="w-4 h-4" />}
              >
                {t('add_block')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => openCategoryModal()}
                icon={<FolderPlus className="w-4 h-4" />}
              >
                {t('add_category')}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-violet-600 focus:ring-violet-500"
                />
                {t('show_inactive')}
              </label>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Categories and Blocks */}
      <div className="space-y-4">
        {displayCategories.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <Blocks className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('no_blocks_yet')}</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {t('no_blocks_description')}
              </p>
            </CardBody>
          </Card>
        ) : (
          displayCategories
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((category) => {
              const Icon = CATEGORY_ICONS[category.slug] || Sparkles;
              const isExpanded = expandedCategories.has(category.slug);
              const blocks = getBlocksForCategory(category.slug);

              return (
                <Card key={category.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => toggleCategory(category.slug)}
                        className="flex items-center gap-3 text-left flex-1"
                      >
                        <Icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {category.name}
                            {!category.isActive && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded">
                                {t('inactive')}
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
                        </div>
                        <span className="text-sm text-gray-400 dark:text-gray-500 ml-auto mr-2">
                          {t('n_blocks', { count: blocks.length })}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        )}
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCategoryModal(category);
                        }}
                        icon={<Edit2 className="w-4 h-4" />}
                      >
                        <span className="sr-only">{t('common:edit')}</span>
                      </Button>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardBody className="pt-0">
                      <div className="space-y-2">
                        {blocks.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                            {t('no_blocks_in_category')}{' '}
                            <button
                              onClick={() => {
                                setBlockForm({ ...initialBlockForm, category: category.slug });
                                setShowBlockModal(true);
                              }}
                              className="text-violet-600 dark:text-violet-400 hover:underline"
                            >
                              {t('add_one')}
                            </button>
                          </p>
                        ) : (
                          blocks.map((block) => (
                            <div
                              key={block.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border ${
                                block.isActive
                                  ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                  : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700 opacity-60'
                              }`}
                            >
                              <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 mt-1 cursor-move flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {block.label}
                                  </span>
                                  {block.popular && (
                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                  )}
                                  {!block.isActive && (
                                    <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                                      {t('inactive')}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                                  {block.description}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono line-clamp-1">
                                  {block.promptText}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() =>
                                    toggleBlockPopularMutation.mutate({
                                      id: block.id,
                                      popular: !block.popular,
                                    })
                                  }
                                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400 rounded"
                                  title={block.popular ? t('remove_from_popular') : t('mark_as_popular')}
                                >
                                  {block.popular ? (
                                    <Star className="w-4 h-4 fill-current" />
                                  ) : (
                                    <StarOff className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() =>
                                    toggleBlockActiveMutation.mutate({
                                      id: block.id,
                                      isActive: !block.isActive,
                                    })
                                  }
                                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                                  title={block.isActive ? t('deactivate') : t('activate')}
                                >
                                  {block.isActive ? (
                                    <Eye className="w-4 h-4" />
                                  ) : (
                                    <EyeOff className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => openBlockModal(block)}
                                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 rounded"
                                  title={t('common:edit')}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(t('confirm_deactivate_block'))) {
                                      deleteBlockMutation.mutate(block.id);
                                    }
                                  }}
                                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded"
                                  title={t('common:delete')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardBody>
                  )}
                </Card>
              );
            })
        )}
      </div>

      {/* Block Modal */}
      <Modal
        isOpen={showBlockModal}
        onClose={() => {
          setShowBlockModal(false);
          setEditingBlock(null);
          setBlockForm(initialBlockForm);
        }}
        title={editingBlock ? t('edit_block') : t('add_block')}
      >
        <form onSubmit={handleBlockSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('category')}
            </label>
            <select
              value={blockForm.category}
              onChange={(e) => setBlockForm({ ...blockForm, category: e.target.value })}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-violet-500 focus:ring-violet-500"
              required
            >
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('label')}
            </label>
            <Input
              value={blockForm.label}
              onChange={(e) => setBlockForm({ ...blockForm, label: e.target.value })}
              placeholder={t('label_placeholder')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('prompt_text')}
            </label>
            <TextArea
              value={blockForm.promptText}
              onChange={(e) => setBlockForm({ ...blockForm, promptText: e.target.value })}
              placeholder={t('prompt_text_placeholder')}
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('description')}
            </label>
            <Input
              value={blockForm.description}
              onChange={(e) => setBlockForm({ ...blockForm, description: e.target.value })}
              placeholder={t('description_placeholder')}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="popular"
              checked={blockForm.popular}
              onChange={(e) => setBlockForm({ ...blockForm, popular: e.target.checked })}
              className="rounded border-gray-300 dark:border-gray-600 text-violet-600 focus:ring-violet-500"
            />
            <label htmlFor="popular" className="text-sm text-gray-700 dark:text-gray-300">
              {t('show_in_popular')}
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowBlockModal(false);
                setEditingBlock(null);
                setBlockForm(initialBlockForm);
              }}
            >
              {t('common:cancel')}
            </Button>
            <Button
              type="submit"
              loading={createBlockMutation.isPending || updateBlockMutation.isPending}
            >
              {editingBlock ? t('common:update') : t('common:create')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setEditingCategory(null);
          setCategoryForm(initialCategoryForm);
        }}
        title={editingCategory ? t('edit_category') : t('add_category')}
      >
        <form onSubmit={handleCategorySubmit} className="space-y-4">
          {!editingCategory && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('slug')}
              </label>
              <Input
                value={categoryForm.slug}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                  })
                }
                placeholder={t('slug_placeholder')}
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('slug_hint')}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('name')}
            </label>
            <Input
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              placeholder={t('category_name_placeholder')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('description')}
            </label>
            <Input
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              placeholder={t('category_description_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('icon')}
            </label>
            <select
              value={categoryForm.icon}
              onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-violet-500 focus:ring-violet-500"
            >
              <option value="User">{t('icon_user_persona')}</option>
              <option value="MessageCircle">{t('icon_message_tone')}</option>
              <option value="Sparkles">{t('icon_sparkles_behavior')}</option>
              <option value="Shield">{t('icon_shield_constraint')}</option>
              <option value="Layout">{t('icon_layout_format')}</option>
              <option value="BookOpen">{t('icon_book_knowledge')}</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCategoryModal(false);
                setEditingCategory(null);
                setCategoryForm(initialCategoryForm);
              }}
            >
              {t('common:cancel')}
            </Button>
            <Button
              type="submit"
              loading={createCategoryMutation.isPending || updateCategoryMutation.isPending}
            >
              {editingCategory ? t('common:update') : t('common:create')}
            </Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
};
