import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
  Sliders,
  MessageCircle,
  Image,
  Upload,
  ThermometerSun,
  ListChecks,
  Ban,
  Lightbulb,
  FileText,
  Cpu,
  Play,
  Send,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { useTheme } from '../../hooks/useTheme';
import apiClient, { resolveFileUrl } from '../../api/client';
import { getAuthToken } from '../../utils/auth';
import { courseTutorApi } from '../../api/courseTutor';

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
  // Enhanced fields
  welcomeMessage: string | null;
  avatarUrl: string | null;
  personality: string | null;
  personalityPrompt: string | null;
  temperature: number | null;
  suggestedQuestions: string | null;
  dosRules: string | null;
  dontsRules: string | null;
  responseStyle: string | null;
  maxTokens: number | null;
  modelPreference: string | null;
  knowledgeContext: string | null;
}

interface AIComponentFormData {
  name: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  category: string;
  isActive: boolean;
  // Enhanced fields
  welcomeMessage: string;
  avatarUrl: string;
  personality: string;
  personalityPrompt: string; // Editable personality instructions
  temperature: number;
  suggestedQuestions: string[];
  dosRules: string[];
  dontsRules: string[];
  responseStyle: string;
  maxTokens: number;
  modelPreference: string;
  knowledgeContext: string;
}

const CATEGORIES = [
  { value: 'tutor', label: 'Tutor', icon: GraduationCap, color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  { value: 'assistant', label: 'Assistant', icon: Bot, color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
  { value: 'chatbot', label: 'Chatbot', icon: MessageSquare, color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
  { value: 'academic', label: 'Academic', icon: BookOpen, color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  { value: 'support', label: 'Support', icon: HelpCircle, color: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300' },
  { value: 'creative', label: 'Creative', icon: Sparkles, color: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300' },
];

const PERSONALITIES = [
  { value: 'friendly', label: 'Friendly', desc: 'Warm, approachable, encouraging',
    prompt: 'Be warm, supportive, and encouraging. Use positive language and celebrate user progress.' },
  { value: 'professional', label: 'Professional', desc: 'Formal, precise, business-like',
    prompt: 'Maintain a formal, business-like tone. Be precise and clear in all communications.' },
  { value: 'academic', label: 'Academic', desc: 'Scholarly, thorough, educational',
    prompt: 'Use scholarly language and provide thorough, well-researched explanations with citations when relevant.' },
  { value: 'casual', label: 'Casual', desc: 'Relaxed, conversational, informal',
    prompt: 'Be relaxed and conversational. Use everyday language and a friendly, informal tone.' },
  { value: 'socratic', label: 'Socratic', desc: 'Argumentative, challenges assumptions, promotes critical thinking',
    prompt: 'Use the Socratic method: Never give direct answers. Instead, respond with thought-provoking questions that challenge assumptions and guide the learner to discover answers themselves. Play devil\'s advocate when appropriate. Question their reasoning and ask "why" and "how do you know that?" to deepen understanding.' },
  { value: 'learning', label: 'Learning Mode', desc: 'Step-by-step guidance, checks understanding, adapts to learner',
    prompt: 'Act as a patient tutor using scaffolded learning. Break complex topics into small, digestible steps. After each explanation, check understanding by asking the learner to summarize or apply what they learned. Adapt your pace based on their responses. Provide examples, analogies, and practice problems. Celebrate progress and gently correct misconceptions.' },
  { value: 'custom', label: 'Custom', desc: 'Define your own personality',
    prompt: '' },
];

const RESPONSE_STYLES = [
  { value: 'concise', label: 'Concise', desc: 'Short, to-the-point answers' },
  { value: 'balanced', label: 'Balanced', desc: 'Moderate detail level' },
  { value: 'detailed', label: 'Detailed', desc: 'Comprehensive explanations' },
];

const MODELS = [
  { value: 'auto', label: 'Auto (Default)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
  { value: 'gemini-pro', label: 'Gemini Pro' },
];

const DEFAULT_FORM: AIComponentFormData = {
  name: '',
  displayName: '',
  description: '',
  systemPrompt: '',
  category: 'assistant',
  isActive: true,
  welcomeMessage: '',
  avatarUrl: '',
  personality: 'friendly',
  personalityPrompt: PERSONALITIES[0].prompt, // Default to friendly prompt
  temperature: 0.7,
  suggestedQuestions: [],
  dosRules: [],
  dontsRules: [],
  responseStyle: 'balanced',
  maxTokens: 1000,
  modelPreference: 'auto',
  knowledgeContext: '',
};

// API functions
const aiComponentsApi = {
  getAll: async () => {
    const response = await apiClient.get<{ success: boolean; data: AIComponent[] }>('/chatbots?includeInactive=true');
    return response.data.data;
  },
  create: async (data: Partial<AIComponentFormData>) => {
    const payload = {
      ...data,
      suggestedQuestions: JSON.stringify(data.suggestedQuestions || []),
      dosRules: JSON.stringify(data.dosRules || []),
      dontsRules: JSON.stringify(data.dontsRules || []),
    };
    const response = await apiClient.post<{ success: boolean; data: AIComponent }>('/chatbots', payload);
    return response.data.data;
  },
  update: async (id: number, data: Partial<AIComponentFormData>) => {
    const payload = {
      ...data,
      suggestedQuestions: data.suggestedQuestions ? JSON.stringify(data.suggestedQuestions) : undefined,
      dosRules: data.dosRules ? JSON.stringify(data.dosRules) : undefined,
      dontsRules: data.dontsRules ? JSON.stringify(data.dontsRules) : undefined,
    };
    const response = await apiClient.put<{ success: boolean; data: AIComponent }>(`/chatbots/${id}`, payload);
    return response.data.data;
  },
  delete: async (id: number) => {
    await apiClient.delete(`/chatbots/${id}`);
  },
  testChat: async (id: number, message: string) => {
    const response = await apiClient.post<{ success: boolean; data: { response: string } }>(`/chatbots/${id}/test`, { message });
    return response.data.data;
  },
};

// Helper to parse JSON arrays safely
const parseJsonArray = (str: string | null): string[] => {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
};

export const AIBuilder = () => {
  const { t } = useTranslation(['courses', 'common']);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);

  // Course context from URL params
  const courseId = searchParams.get('courseId');
  const addToCourse = searchParams.get('addToCourse') === 'true';
  const duplicateId = searchParams.get('duplicate');
  const courseContext = courseId ? { courseId: parseInt(courseId), addToCourse } : null;

  // Theme colors
  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#4b5563',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    bgSecondary: isDark ? '#374151' : '#f3f4f6',
    border: isDark ? '#4b5563' : '#e5e7eb',
  };
  const [activeTab, setActiveTab] = useState<'basic' | 'behavior' | 'advanced' | 'test'>('basic');
  const [editingComponent, setEditingComponent] = useState<AIComponent | null>(null);
  const [formData, setFormData] = useState<AIComponentFormData>(DEFAULT_FORM);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [newQuestion, setNewQuestion] = useState('');
  const [newDo, setNewDo] = useState('');
  const [newDont, setNewDont] = useState('');
  const [testMessages, setTestMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [testInput, setTestInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const { data: components, isLoading } = useQuery({
    queryKey: ['ai-components'],
    queryFn: aiComponentsApi.getAll,
  });

  // Handle URL parameter to auto-open edit mode for a specific chatbot
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && components) {
      const component = components.find(c => c.id === parseInt(editId));
      if (component) {
        handleEdit(component);
        // Clear the edit param but keep course context if present
        const newParams = new URLSearchParams();
        if (courseId) newParams.set('courseId', courseId);
        if (addToCourse) newParams.set('addToCourse', 'true');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, components, courseId, addToCourse]);

  // Handle URL parameter to duplicate an existing chatbot
  useEffect(() => {
    if (duplicateId && components) {
      const component = components.find(c => c.id === parseInt(duplicateId));
      if (component) {
        handleDuplicate(component);
        // Clear the duplicate param but keep course context if present
        const newParams = new URLSearchParams();
        if (courseId) newParams.set('courseId', courseId);
        if (addToCourse) newParams.set('addToCourse', 'true');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [duplicateId, components, courseId, addToCourse]);

  // Mutation for creating chatbot via admin API (when not in course context)
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

  // Mutation for creating chatbot via course tutor API (when in course context)
  // This uses the buildAndAddTutor endpoint which only requires instructor access
  const createForCourseMutation = useMutation({
    mutationFn: (data: Partial<AIComponentFormData>) =>
      courseTutorApi.buildAndAddTutor(courseContext!.courseId, {
        name: data.name!,
        displayName: data.displayName!,
        description: data.description,
        systemPrompt: data.systemPrompt!,
        welcomeMessage: data.welcomeMessage,
        personality: data.personality,
        temperature: data.temperature,
      }),
    onSuccess: () => {
      toast.success('AI Tutor created and added to course');
      queryClient.invalidateQueries({ queryKey: ['ai-components'] });
      queryClient.invalidateQueries({ queryKey: ['courseTutors', String(courseContext!.courseId)] });
      queryClient.invalidateQueries({ queryKey: ['availableTutors', String(courseContext!.courseId)] });
      resetForm();
      // Navigate back to the course tutor manager
      navigate(`/teach/courses/${courseContext!.courseId}/tutors`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create tutor');
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
    setActiveTab('basic');
    setTestMessages([]);
  };

  const handleEdit = (component: AIComponent) => {
    const personality = component.personality || 'friendly';
    const defaultPrompt = PERSONALITIES.find(p => p.value === personality)?.prompt || '';
    setFormData({
      name: component.name,
      displayName: component.displayName,
      description: component.description || '',
      systemPrompt: component.systemPrompt,
      category: component.category || 'assistant',
      isActive: component.isActive,
      welcomeMessage: component.welcomeMessage || '',
      avatarUrl: component.avatarUrl || '',
      personality: personality,
      personalityPrompt: component.personalityPrompt || defaultPrompt,
      temperature: component.temperature || 0.7,
      suggestedQuestions: parseJsonArray(component.suggestedQuestions),
      dosRules: parseJsonArray(component.dosRules),
      dontsRules: parseJsonArray(component.dontsRules),
      responseStyle: component.responseStyle || 'balanced',
      maxTokens: component.maxTokens || 1000,
      modelPreference: component.modelPreference || 'auto',
      knowledgeContext: component.knowledgeContext || '',
    });
    setEditingComponent(component);
    setShowForm(true);
    setTestMessages([]);
  };

  const handleDuplicate = (component: AIComponent) => {
    const personality = component.personality || 'friendly';
    const defaultPrompt = PERSONALITIES.find(p => p.value === personality)?.prompt || '';
    setFormData({
      name: `${component.name}-copy`,
      displayName: `${component.displayName} (Copy)`,
      description: component.description || '',
      systemPrompt: component.systemPrompt,
      category: component.category || 'assistant',
      isActive: true,
      welcomeMessage: component.welcomeMessage || '',
      avatarUrl: component.avatarUrl || '',
      personality: personality,
      personalityPrompt: component.personalityPrompt || defaultPrompt,
      temperature: component.temperature || 0.7,
      suggestedQuestions: parseJsonArray(component.suggestedQuestions),
      dosRules: parseJsonArray(component.dosRules),
      dontsRules: parseJsonArray(component.dontsRules),
      responseStyle: component.responseStyle || 'balanced',
      maxTokens: component.maxTokens || 1000,
      modelPreference: component.modelPreference || 'auto',
      knowledgeContext: component.knowledgeContext || '',
    });
    setEditingComponent(null);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingComponent) {
      updateMutation.mutate({ id: editingComponent.id, data: formData });
    } else if (courseContext?.addToCourse) {
      // Use course-specific API that only requires instructor access
      createForCourseMutation.mutate(formData);
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

  const addSuggestedQuestion = () => {
    if (newQuestion.trim()) {
      setFormData({ ...formData, suggestedQuestions: [...formData.suggestedQuestions, newQuestion.trim()] });
      setNewQuestion('');
    }
  };

  const removeSuggestedQuestion = (index: number) => {
    setFormData({ ...formData, suggestedQuestions: formData.suggestedQuestions.filter((_, i) => i !== index) });
  };

  const addDoRule = () => {
    if (newDo.trim()) {
      setFormData({ ...formData, dosRules: [...formData.dosRules, newDo.trim()] });
      setNewDo('');
    }
  };

  const removeDoRule = (index: number) => {
    setFormData({ ...formData, dosRules: formData.dosRules.filter((_, i) => i !== index) });
  };

  const addDontRule = () => {
    if (newDont.trim()) {
      setFormData({ ...formData, dontsRules: [...formData.dontsRules, newDont.trim()] });
      setNewDont('');
    }
  };

  const removeDontRule = (index: number) => {
    setFormData({ ...formData, dontsRules: formData.dontsRules.filter((_, i) => i !== index) });
  };

  const handleTestChat = async () => {
    if (!testInput.trim() || !editingComponent) return;

    const userMessage = testInput.trim();
    setTestInput('');
    setTestMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTesting(true);

    try {
      const result = await aiComponentsApi.testChat(editingComponent.id, userMessage);
      setTestMessages(prev => [...prev, { role: 'assistant', content: result.response }]);
    } catch (error: any) {
      toast.error('Test failed: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setIsTesting(false);
    }
  };

  const filteredComponents = components?.filter(
    c => filterCategory === 'all' || c.category === filterCategory
  );

  if (isLoading) {
    return <Loading fullScreen text={t('loading_ai_components')} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Course Context Breadcrumb */}
      {courseContext && (
        <Link
          to={`/teach/courses/${courseContext.courseId}/tutors`}
          className="inline-flex items-center gap-1 text-sm mb-4 hover:underline"
          style={{ color: colors.textSecondary }}
        >
          <ChevronLeft className="w-4 h-4" />
          {t('back_to_course_tutors')}
        </Link>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: colors.textPrimary }}>
            <Bot className="w-8 h-8 text-primary-600" />
            {t('ai_builder')}
          </h1>
          <p className="mt-1" style={{ color: colors.textSecondary }}>
            {courseContext
              ? t('ai_builder_course_desc')
              : t('ai_builder_desc')}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} icon={<Plus className="w-4 h-4" />}>
          {t('new_component')}
        </Button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: filterCategory === 'all' ? (isDark ? '#f3f4f6' : '#111827') : (isDark ? '#374151' : '#ffffff'),
            color: filterCategory === 'all' ? (isDark ? '#111827' : '#ffffff') : colors.textSecondary,
            border: filterCategory === 'all' ? 'none' : `1px solid ${colors.border}`,
          }}
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
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              style={{
                backgroundColor: filterCategory === cat.value ? (isDark ? '#f3f4f6' : '#111827') : (isDark ? '#374151' : '#ffffff'),
                color: filterCategory === cat.value ? (isDark ? '#111827' : '#ffffff') : colors.textSecondary,
                border: filterCategory === cat.value ? 'none' : `1px solid ${colors.border}`,
              }}
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
          const catInfo = getCategoryInfo(component.category || 'assistant');
          const CatIcon = catInfo.icon;
          return (
            <Card key={component.id} className={`${!component.isActive ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {component.avatarUrl ? (
                      <img src={component.avatarUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className={`w-10 h-10 rounded-lg ${catInfo.color} flex items-center justify-center`}>
                        <CatIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold" style={{ color: colors.textPrimary }}>{component.displayName}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${catInfo.color}`}>
                        {catInfo.label}
                      </span>
                    </div>
                  </div>
                  {component.isSystem && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                      System
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardBody className="pt-2">
                <p className="text-sm mb-3 line-clamp-2" style={{ color: colors.textSecondary }}>
                  {component.description || 'No description'}
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {component.personality && (
                    <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                      {component.personality}
                    </span>
                  )}
                  {component.responseStyle && (
                    <span className="text-xs bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
                      {component.responseStyle}
                    </span>
                  )}
                  {component.temperature && (
                    <span className="text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded">
                      temp: {component.temperature}
                    </span>
                  )}
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
            <Bot className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textMuted }} />
            <p style={{ color: colors.textSecondary }}>{t('no_ai_components')}</p>
            <Button onClick={() => setShowForm(true)} variant="outline" className="mt-4">
              {t('create_first_component')}
            </Button>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
              <h2 className="text-lg font-semibold">
                {editingComponent ? t('customize_ai_agent') : t('build_custom_ai')}
              </h2>
              <button onClick={resetForm} className="p-1 hover:bg-gray-200 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b flex">
              {[
                { id: 'basic', label: t('basic_info'), icon: FileText },
                { id: 'behavior', label: t('behavior'), icon: Sliders },
                { id: 'advanced', label: 'Advanced', icon: Cpu },
                ...(editingComponent ? [{ id: 'test', label: t('test_chat'), icon: Play }] : []),
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600 bg-primary-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      rows={2}
                      placeholder="Brief description of what this AI component does..."
                    />
                  </div>

                  {/* Avatar Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Image className="w-4 h-4 inline mr-1" />
                      Avatar Image
                    </label>
                    <div className="flex items-center gap-3">
                      {formData.avatarUrl && (
                        <img
                          src={formData.avatarUrl.startsWith('/') ? resolveFileUrl(formData.avatarUrl) : formData.avatarUrl}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                        />
                      )}
                      <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-sm text-gray-700">
                        <Upload className="w-4 h-4" />
                        {formData.avatarUrl ? 'Change image' : 'Upload image'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const fd = new FormData();
                              fd.append('file', file);
                              const token = getAuthToken();
                              const response = await fetch('/api/uploads/file', {
                                method: 'POST',
                                body: fd,
                                headers: token ? { Authorization: `Bearer ${token}` } : {},
                              });
                              if (!response.ok) throw new Error('Upload failed');
                              const data = await response.json();
                              const fileData = data.data || data;
                              setFormData({ ...formData, avatarUrl: fileData.url || fileData.path });
                              toast.success('Avatar uploaded');
                            } catch {
                              toast.error('Failed to upload avatar');
                            }
                          }}
                        />
                      </label>
                      {formData.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, avatarUrl: '' })}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                          title="Remove avatar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, or WebP. Max 10MB.</p>
                  </div>

                  {/* Welcome Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MessageCircle className="w-4 h-4 inline mr-1" />
                      Welcome Message
                    </label>
                    <textarea
                      value={formData.welcomeMessage}
                      onChange={e => setFormData({ ...formData, welcomeMessage: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      rows={2}
                      placeholder="Hi! I'm here to help you with..."
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
                      rows={6}
                      placeholder="You are a helpful tutor that assists students with..."
                      required
                    />
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
                      {formData.isActive ? 'Active - Available for use' : 'Inactive - Hidden'}
                    </span>
                  </div>
                </div>
              )}

              {/* Behavior Tab */}
              {activeTab === 'behavior' && (
                <div className="space-y-6">
                  {/* Personality */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      Personality Style
                    </label>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {PERSONALITIES.map(p => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            personality: p.value,
                            personalityPrompt: p.value === 'custom' ? formData.personalityPrompt : p.prompt
                          })}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            formData.personality === p.value
                              ? p.value === 'socratic'
                                ? 'border-orange-500 bg-orange-50'
                                : p.value === 'learning'
                                  ? 'border-emerald-500 bg-emerald-50'
                                  : 'border-primary-500 bg-primary-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium text-sm">{p.label}</div>
                          <div className="text-xs text-gray-500 line-clamp-2">{p.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Personality Prompt - Editable */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Edit className="w-4 h-4 inline mr-1" />
                      Personality Instructions
                      <span className="text-xs font-normal text-gray-500 ml-2">
                        (Customize how this AI behaves)
                      </span>
                    </label>
                    <textarea
                      value={formData.personalityPrompt}
                      onChange={e => setFormData({ ...formData, personalityPrompt: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      rows={4}
                      placeholder="Describe how the AI should behave, respond, and interact with users..."
                    />
                    {formData.personality !== 'custom' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Edit to customize the "{PERSONALITIES.find(p => p.value === formData.personality)?.label}" personality
                      </p>
                    )}
                  </div>

                  {/* Response Style */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FileText className="w-4 h-4 inline mr-1" />
                      Response Style
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {RESPONSE_STYLES.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, responseStyle: s.value })}
                          className={`p-3 rounded-lg border text-center transition-colors ${
                            formData.responseStyle === s.value
                              ? 'border-primary-500 bg-primary-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium text-sm">{s.label}</div>
                          <div className="text-xs text-gray-500">{s.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Do's */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <ListChecks className="w-4 h-4 inline mr-1 text-green-600" />
                      Do's (Behaviors to encourage)
                    </label>
                    <div className="space-y-2">
                      {formData.dosRules.map((rule, i) => (
                        <div key={i} className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="flex-1 text-sm">{rule}</span>
                          <button type="button" onClick={() => removeDoRule(i)} className="text-gray-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newDo}
                          onChange={e => setNewDo(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addDoRule())}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm"
                          placeholder="Add a behavior to encourage..."
                        />
                        <Button type="button" variant="outline" size="sm" onClick={addDoRule}>
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Don'ts */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Ban className="w-4 h-4 inline mr-1 text-red-600" />
                      Don'ts (Behaviors to avoid)
                    </label>
                    <div className="space-y-2">
                      {formData.dontsRules.map((rule, i) => (
                        <div key={i} className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
                          <Ban className="w-4 h-4 text-red-600" />
                          <span className="flex-1 text-sm">{rule}</span>
                          <button type="button" onClick={() => removeDontRule(i)} className="text-gray-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newDont}
                          onChange={e => setNewDont(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addDontRule())}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm"
                          placeholder="Add a behavior to avoid..."
                        />
                        <Button type="button" variant="outline" size="sm" onClick={addDontRule}>
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Suggested Questions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Lightbulb className="w-4 h-4 inline mr-1 text-amber-500" />
                      Suggested Questions (Conversation starters)
                    </label>
                    <div className="space-y-2">
                      {formData.suggestedQuestions.map((q, i) => (
                        <div key={i} className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
                          <Lightbulb className="w-4 h-4 text-amber-500" />
                          <span className="flex-1 text-sm">{q}</span>
                          <button type="button" onClick={() => removeSuggestedQuestion(i)} className="text-gray-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newQuestion}
                          onChange={e => setNewQuestion(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSuggestedQuestion())}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm"
                          placeholder="Add a suggested question..."
                        />
                        <Button type="button" variant="outline" size="sm" onClick={addSuggestedQuestion}>
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Tab */}
              {activeTab === 'advanced' && (
                <div className="space-y-6">
                  {/* Temperature */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <ThermometerSun className="w-4 h-4 inline mr-1" />
                      Temperature (Creativity): {formData.temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={formData.temperature}
                      onChange={e => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                      className="w-full accent-primary-500"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Precise (0)</span>
                      <span>Balanced (0.5)</span>
                      <span>Creative (1)</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Response Length (tokens)
                    </label>
                    <input
                      type="number"
                      min="100"
                      max="4000"
                      value={formData.maxTokens}
                      onChange={e => setFormData({ ...formData, maxTokens: parseInt(e.target.value) || 1000 })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">Approximate: 100 tokens ≈ 75 words</p>
                  </div>

                  {/* Model Preference */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Cpu className="w-4 h-4 inline mr-1" />
                      Preferred AI Model
                    </label>
                    <select
                      value={formData.modelPreference}
                      onChange={e => setFormData({ ...formData, modelPreference: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      {MODELS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Knowledge Context */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Knowledge Context
                    </label>
                    <textarea
                      value={formData.knowledgeContext}
                      onChange={e => setFormData({ ...formData, knowledgeContext: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                      rows={6}
                      placeholder="Add specific knowledge, facts, or context the AI should know about..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This context will be included with every conversation
                    </p>
                  </div>
                </div>
              )}

              {/* Test Tab */}
              {activeTab === 'test' && editingComponent && (
                <div className="h-[400px] flex flex-col">
                  <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-gray-50 mb-4">
                    {testMessages.length === 0 ? (
                      <div className="text-center text-gray-400 py-8">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                        <p>{t('send_test_message')}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {testMessages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                              msg.role === 'user'
                                ? 'bg-primary-500 text-white'
                                : 'bg-white border shadow-sm'
                            }`}>
                              {msg.content}
                            </div>
                          </div>
                        ))}
                        {isTesting && (
                          <div className="flex justify-start">
                            <div className="bg-white border rounded-lg px-4 py-2 shadow-sm">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testInput}
                      onChange={e => setTestInput(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleTestChat()}
                      className="flex-1 border rounded-lg px-4 py-2"
                      placeholder={t('type_test_message')}
                      disabled={isTesting}
                    />
                    <Button
                      type="button"
                      onClick={handleTestChat}
                      disabled={isTesting || !testInput.trim()}
                      icon={<Send className="w-4 h-4" />}
                    >
                      Send
                    </Button>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              {activeTab !== 'test' && (
                <div className="flex gap-3 mt-6 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                    {t('common:cancel')}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    loading={createMutation.isPending || updateMutation.isPending || createForCourseMutation.isPending}
                    icon={courseContext && !editingComponent ? <Sparkles className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  >
                    {editingComponent
                      ? t('save_changes')
                      : courseContext
                        ? t('create_add_course')
                        : t('create_component')}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIBuilder;
