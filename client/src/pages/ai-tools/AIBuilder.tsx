import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Plus,
  Edit,
  Trash2,
  BookOpen,
  MessageSquare,
  Sparkles,
  GraduationCap,
  HelpCircle,
  Check,
  X,
  Copy,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import apiClient from '../../api/client';

interface AIComponent {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  systemPrompt: string;
  category: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AIComponentFormData {
  name: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  category: string;
  isActive: boolean;
}

const CATEGORIES = [
  { value: 'tutor', label: 'Tutor', icon: GraduationCap, color: 'bg-blue-100 text-blue-700' },
  { value: 'assistant', label: 'Assistant', icon: Bot, color: 'bg-green-100 text-green-700' },
  { value: 'chatbot', label: 'Chatbot', icon: MessageSquare, color: 'bg-purple-100 text-purple-700' },
  { value: 'academic', label: 'Academic', icon: BookOpen, color: 'bg-amber-100 text-amber-700' },
  { value: 'support', label: 'Support', icon: HelpCircle, color: 'bg-cyan-100 text-cyan-700' },
  { value: 'creative', label: 'Creative', icon: Sparkles, color: 'bg-pink-100 text-pink-700' },
];

const DEFAULT_FORM: AIComponentFormData = {
  name: '',
  displayName: '',
  description: '',
  systemPrompt: '',
  category: 'assistant',
  isActive: true,
};

// API functions
const aiComponentsApi = {
  getAll: async () => {
    const response = await apiClient.get<{ success: boolean; data: AIComponent[] }>('/chatbots?includeInactive=true');
    return response.data.data;
  },
  create: async (data: AIComponentFormData) => {
    const response = await apiClient.post<{ success: boolean; data: AIComponent }>('/chatbots', data);
    return response.data.data;
  },
  update: async (id: number, data: Partial<AIComponentFormData>) => {
    const response = await apiClient.put<{ success: boolean; data: AIComponent }>(`/chatbots/${id}`, data);
    return response.data.data;
  },
  delete: async (id: number) => {
    await apiClient.delete(`/chatbots/${id}`);
  },
};

export const AIBuilder = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingComponent, setEditingComponent] = useState<AIComponent | null>(null);
  const [formData, setFormData] = useState<AIComponentFormData>(DEFAULT_FORM);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const { data: components, isLoading } = useQuery({
    queryKey: ['ai-components'],
    queryFn: aiComponentsApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: aiComponentsApi.create,
    onSuccess: () => {
      toast.success('AI Component created');
      queryClient.invalidateQueries({ queryKey: ['ai-components'] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create component');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AIComponentFormData> }) =>
      aiComponentsApi.update(id, data),
    onSuccess: () => {
      toast.success('AI Component updated');
      queryClient.invalidateQueries({ queryKey: ['ai-components'] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update component');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: aiComponentsApi.delete,
    onSuccess: () => {
      toast.success('AI Component deleted');
      queryClient.invalidateQueries({ queryKey: ['ai-components'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete component');
    },
  });

  const resetForm = () => {
    setFormData(DEFAULT_FORM);
    setEditingComponent(null);
    setShowForm(false);
  };

  const handleEdit = (component: AIComponent) => {
    setFormData({
      name: component.name,
      displayName: component.displayName,
      description: component.description || '',
      systemPrompt: component.systemPrompt,
      category: component.category,
      isActive: component.isActive,
    });
    setEditingComponent(component);
    setShowForm(true);
  };

  const handleDuplicate = (component: AIComponent) => {
    setFormData({
      name: `${component.name}-copy`,
      displayName: `${component.displayName} (Copy)`,
      description: component.description || '',
      systemPrompt: component.systemPrompt,
      category: component.category,
      isActive: true,
    });
    setEditingComponent(null);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingComponent) {
      updateMutation.mutate({ id: editingComponent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (component: AIComponent) => {
    if (component.isSystem) {
      toast.error('Cannot delete system components');
      return;
    }
    if (confirm(`Delete "${component.displayName}"? This cannot be undone.`)) {
      deleteMutation.mutate(component.id);
    }
  };

  const toggleActive = (component: AIComponent) => {
    updateMutation.mutate({
      id: component.id,
      data: { isActive: !component.isActive },
    });
  };

  const getCategoryInfo = (category: string) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[1];
  };

  const filteredComponents = components?.filter(
    c => filterCategory === 'all' || c.category === filterCategory
  );

  if (isLoading) {
    return <Loading fullScreen text="Loading AI Components..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary-600" />
            AI Builder
          </h1>
          <p className="text-gray-600 mt-1">
            Create and manage reusable AI components for your courses
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} icon={<Plus className="w-4 h-4" />}>
          New Component
        </Button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterCategory === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-white text-gray-700 border hover:bg-gray-50'
          }`}
        >
          All ({components?.length || 0})
        </button>
        {CATEGORIES.map(cat => {
          const count = components?.filter(c => c.category === cat.value).length || 0;
          const Icon = cat.icon;
          return (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                filterCategory === cat.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 border hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Component Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredComponents?.map(component => {
          const catInfo = getCategoryInfo(component.category);
          const CatIcon = catInfo.icon;
          return (
            <Card key={component.id} className={`${!component.isActive ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${catInfo.color} flex items-center justify-center`}>
                      <CatIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{component.displayName}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${catInfo.color}`}>
                        {catInfo.label}
                      </span>
                    </div>
                  </div>
                  {component.isSystem && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      System
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardBody className="pt-2">
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {component.description || 'No description'}
                </p>
                <div className="text-xs text-gray-500 mb-4 font-mono bg-gray-50 p-2 rounded line-clamp-3">
                  {component.systemPrompt.substring(0, 150)}...
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggleActive(component)}
                    className={`flex items-center gap-1 text-sm ${
                      component.isActive ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    {component.isActive ? (
                      <ToggleRight className="w-5 h-5" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                    {component.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDuplicate(component)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(component)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {!component.isSystem && (
                      <button
                        onClick={() => handleDelete(component)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {/* Empty State */}
        {filteredComponents?.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No AI components found</p>
            <Button onClick={() => setShowForm(true)} variant="outline" className="mt-4">
              Create your first component
            </Button>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
              <h2 className="text-lg font-semibold">
                {editingComponent ? 'Edit AI Component' : 'Create AI Component'}
              </h2>
              <button onClick={resetForm} className="p-1 hover:bg-gray-200 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="space-y-5">
                {/* Name & Display Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unique ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="my-tutor-bot"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Lowercase, no spaces</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="My Tutor Bot"
                      required
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map(cat => {
                      const Icon = cat.icon;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, category: cat.value })}
                          className={`p-3 rounded-lg border text-sm font-medium flex items-center gap-2 transition-colors ${
                            formData.category === cat.value
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Brief description of what this AI component does..."
                  />
                </div>

                {/* System Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    System Prompt <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.systemPrompt}
                    onChange={e => setFormData({ ...formData, systemPrompt: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                    rows={8}
                    placeholder="You are a helpful tutor that assists students with..."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Define the AI's personality, knowledge, and behavior
                  </p>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.isActive ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-700">
                    {formData.isActive ? 'Active - Available for use in courses' : 'Inactive - Hidden from selection'}
                  </span>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 mt-6 pt-4 border-t">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  loading={createMutation.isPending || updateMutation.isPending}
                  icon={<Check className="w-4 h-4" />}
                >
                  {editingComponent ? 'Save Changes' : 'Create Component'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIBuilder;
