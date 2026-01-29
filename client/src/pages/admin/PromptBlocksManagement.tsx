/**
 * Prompt Blocks Management Page
 *
 * Admin interface for managing customizable prompt building blocks.
 * Allows creating, editing, deleting, and reordering blocks and categories.
 */

import { useState } from 'react';
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
      toast.success('Block created');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create block');
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
      toast.success('Block updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update block');
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (id: number) => promptBlocksApi.deleteBlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPromptBlocks'] });
      queryClient.invalidateQueries({ queryKey: ['promptBlocks'] });
      toast.success('Block deactivated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete block');
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
      toast.success(variables.isActive ? 'Block activated' : 'Block deactivated');
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
      toast.success('Category created');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create category');
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
      toast.success('Category updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update category');
    },
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: promptBlocksApi.seedDefaults,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['adminPromptBlocks'] });
      queryClient.invalidateQueries({ queryKey: ['promptBlocks'] });
      if (result.blocksSeeded || result.categoriesSeeded) {
        toast.success('Default blocks seeded');
      } else {
        toast.success('Default blocks already exist');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to seed defaults');
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
    return <Loading fullScreen text="Loading prompt blocks..." />;
  }

  const categories = data?.categories || [];
  const displayCategories = showInactive
    ? categories
    : categories.filter((c) => c.isActive);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Blocks className="w-7 h-7 text-violet-600" />
              Prompt Building Blocks
            </h1>
            <p className="text-gray-600 mt-1">
              Manage the prompt blocks that students can use to build their AI agents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => seedDefaultsMutation.mutate()}
              loading={seedDefaultsMutation.isPending}
            >
              Seed Defaults
            </Button>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => openBlockModal()}
                icon={<Plus className="w-4 h-4" />}
              >
                Add Block
              </Button>
              <Button
                variant="secondary"
                onClick={() => openCategoryModal()}
                icon={<FolderPlus className="w-4 h-4" />}
              >
                Add Category
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                Show inactive
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
              <Blocks className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No blocks yet</h3>
              <p className="text-gray-500 mb-4">
                Click "Seed Defaults" to add the default prompt blocks, or create your own.
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
                        <Icon className="w-5 h-5 text-violet-600" />
                        <div>
                          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            {category.name}
                            {!category.isActive && (
                              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                                Inactive
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-500">{category.description}</p>
                        </div>
                        <span className="text-sm text-gray-400 ml-auto mr-2">
                          {blocks.length} blocks
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
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
                        <span className="sr-only">Edit</span>
                      </Button>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardBody className="pt-0">
                      <div className="space-y-2">
                        {blocks.length === 0 ? (
                          <p className="text-sm text-gray-500 py-4 text-center">
                            No blocks in this category.{' '}
                            <button
                              onClick={() => {
                                setBlockForm({ ...initialBlockForm, category: category.slug });
                                setShowBlockModal(true);
                              }}
                              className="text-violet-600 hover:underline"
                            >
                              Add one
                            </button>
                          </p>
                        ) : (
                          blocks.map((block) => (
                            <div
                              key={block.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border ${
                                block.isActive
                                  ? 'bg-white border-gray-200'
                                  : 'bg-gray-50 border-gray-100 opacity-60'
                              }`}
                            >
                              <GripVertical className="w-4 h-4 text-gray-300 mt-1 cursor-move flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">
                                    {block.label}
                                  </span>
                                  {block.popular && (
                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                  )}
                                  {!block.isActive && (
                                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                                  {block.description}
                                </p>
                                <p className="text-xs text-gray-400 mt-1 font-mono line-clamp-1">
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
                                  className="p-1.5 text-gray-400 hover:text-amber-500 rounded"
                                  title={block.popular ? 'Remove from popular' : 'Mark as popular'}
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
                                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                                  title={block.isActive ? 'Deactivate' : 'Activate'}
                                >
                                  {block.isActive ? (
                                    <Eye className="w-4 h-4" />
                                  ) : (
                                    <EyeOff className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => openBlockModal(block)}
                                  className="p-1.5 text-gray-400 hover:text-violet-600 rounded"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Deactivate this block?')) {
                                      deleteBlockMutation.mutate(block.id);
                                    }
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                                  title="Delete"
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
        title={editingBlock ? 'Edit Block' : 'Add Block'}
      >
        <form onSubmit={handleBlockSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={blockForm.category}
              onChange={(e) => setBlockForm({ ...blockForm, category: e.target.value })}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-violet-500 focus:ring-violet-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label
            </label>
            <Input
              value={blockForm.label}
              onChange={(e) => setBlockForm({ ...blockForm, label: e.target.value })}
              placeholder="e.g., Patient Tutor"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt Text
            </label>
            <TextArea
              value={blockForm.promptText}
              onChange={(e) => setBlockForm({ ...blockForm, promptText: e.target.value })}
              placeholder="The actual prompt text that will be inserted..."
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Input
              value={blockForm.description}
              onChange={(e) => setBlockForm({ ...blockForm, description: e.target.value })}
              placeholder="Short description of what this block does"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="popular"
              checked={blockForm.popular}
              onChange={(e) => setBlockForm({ ...blockForm, popular: e.target.checked })}
              className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
            <label htmlFor="popular" className="text-sm text-gray-700">
              Show in Popular section
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
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createBlockMutation.isPending || updateBlockMutation.isPending}
            >
              {editingBlock ? 'Update' : 'Create'}
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
        title={editingCategory ? 'Edit Category' : 'Add Category'}
      >
        <form onSubmit={handleCategorySubmit} className="space-y-4">
          {!editingCategory && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug
              </label>
              <Input
                value={categoryForm.slug}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                  })
                }
                placeholder="e.g., custom_category"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Lowercase letters, numbers, and underscores only
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <Input
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              placeholder="e.g., Custom Category"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Input
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              placeholder="Short description of this category"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Icon
            </label>
            <select
              value={categoryForm.icon}
              onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-violet-500 focus:ring-violet-500"
            >
              <option value="User">User (Persona)</option>
              <option value="MessageCircle">MessageCircle (Tone)</option>
              <option value="Sparkles">Sparkles (Behavior)</option>
              <option value="Shield">Shield (Constraint)</option>
              <option value="Layout">Layout (Format)</option>
              <option value="BookOpen">BookOpen (Knowledge)</option>
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
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createCategoryMutation.isPending || updateCategoryMutation.isPending}
            >
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
