import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Save,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Pencil,
  ListChecks,
  Clock,
  Repeat,
  Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { quizzesApi, Quiz, QuizQuestion, CreateQuestionInput } from '../../api/quizzes';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { Button } from '../../components/common/Button';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { MCQGenerator } from '../../components/teaching/MCQGenerator';
import { RichTextEditor } from '../../components/forum/RichTextEditor';
import { sanitizeHtml } from '../../utils/sanitize';
import { QuizQuestionCard } from '../../components/teach/QuizQuestionCard';
import activityLogger from '../../services/activityLogger';

export const QuizEditor = () => {
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const { id: courseId, quizId } = useParams<{ id: string; quizId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const parsedQuizId = parseInt(quizId!, 10);
  const { isDark } = useTheme();

  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsInstructions, setSettingsInstructions] = useState('');
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'overview'>('questions');

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgInput: isDark ? '#374151' : '#ffffff',
  };

  useEffect(() => {
    if (parsedQuizId) {
      activityLogger.logQuizEditorViewed(parsedQuizId, undefined, courseId ? parseInt(courseId) : undefined);
    }
  }, [parsedQuizId, courseId]);

  // Fetch quiz with questions
  const { data: quiz, isLoading, error } = useQuery({
    queryKey: ['quiz', parsedQuizId],
    queryFn: () => quizzesApi.getQuiz(parsedQuizId),
  });

  // Update quiz mutation (inline settings)
  const updateQuizMutation = useMutation({
    mutationFn: (data: Partial<Quiz>) => quizzesApi.updateQuiz(parsedQuizId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
      toast.success(t('quiz_updated'));
      setIsEditingSettings(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('failed_to_update_quiz'));
    },
  });

  // Add question mutation
  const addQuestionMutation = useMutation({
    mutationFn: (data: CreateQuestionInput) => quizzesApi.addQuestion(parsedQuizId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
      toast.success(t('question_added'));
      setIsAddingQuestion(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('failed_add_question'));
    },
  });

  // Update question mutation
  const updateQuestionMutation = useMutation({
    mutationFn: ({ questionId, data }: { questionId: number; data: Partial<CreateQuestionInput> }) =>
      quizzesApi.updateQuestion(questionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
      toast.success(t('question_updated'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('failed_update_question'));
    },
  });

  // Delete question mutation
  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: number) => quizzesApi.deleteQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
      toast.success(t('question_deleted'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('failed_delete_question'));
    },
  });

  // Reorder questions mutation
  const reorderQuestionsMutation = useMutation({
    mutationFn: (questionIds: number[]) => quizzesApi.reorderQuestions(parsedQuizId, questionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('failed_to_update_quiz'));
    },
  });

  // Toggle publish mutation
  const togglePublishMutation = useMutation({
    mutationFn: () => quizzesApi.updateQuiz(parsedQuizId, { isPublished: !quiz?.isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
      toast.success(quiz?.isPublished ? t('quiz_unpublished') : t('quiz_published'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('failed_to_update_quiz'));
    },
  });

  const handleSaveQuestion = (data: CreateQuestionInput, questionId?: number) => {
    if (questionId) {
      updateQuestionMutation.mutate({ questionId, data });
    } else {
      addQuestionMutation.mutate(data);
    }
  };

  const handleDeleteQuestion = (questionId: number) => {
    if (window.confirm(t('delete_question_confirm'))) {
      deleteQuestionMutation.mutate(questionId);
    }
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (!quiz?.questions) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= quiz.questions.length) return;
    const reordered = [...quiz.questions];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderQuestionsMutation.mutate(reordered.map(q => q.id));
  };

  if (isLoading) {
    return <Loading text={t('loading_quiz')} />;
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <Card>
          <CardBody className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p style={{ color: colors.textPrimary }}>{t('failed_load_quiz')}</p>
            <Button onClick={() => navigate(-1)} className="mt-4">{t('common:go_back')}</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: 'Courses', href: '/courses' },
    { label: t('navigation:quizzes'), href: '/teach/quizzes' },
    { label: quiz.title },
  ];

  const stats = [
    { icon: ListChecks, value: quiz.questions?.length || 0, label: t('questions_label') },
    { icon: Clock, value: quiz.timeLimit || '∞', label: t('minutes_label') },
    { icon: Repeat, value: quiz.maxAttempts || '∞', label: t('max_attempts') },
    { icon: Target, value: `${quiz.passingScore}%`, label: t('passing_score') },
  ];

  const draftQuestion: QuizQuestion = {
    id: -1,
    questionType: 'multiple_choice',
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    explanation: '',
    points: 1,
    orderIndex: quiz.questions?.length || 0,
  };

  return (
    <div className="min-h-screen py-6 md:py-8" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb navigation */}
        <div className="mb-6">
          <Breadcrumb homeHref="/" items={breadcrumbItems} />
        </div>

        {/* Quiz overview card — stats + description + instructions in one card */}
        <Card className="mb-6">
          <CardBody>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                {stats.map(({ icon: Icon, value, label }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                      <Icon size={20} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xl font-bold leading-tight" style={{ color: colors.textPrimary }}>
                        {value}
                      </p>
                      <p className="text-xs truncate" style={{ color: colors.textSecondary }}>
                        {label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap lg:flex-shrink-0">
                <span
                  className={`inline-flex items-center justify-center gap-1.5 w-28 text-xs font-medium px-2.5 py-1 rounded-full ${
                    quiz.isPublished
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-gray-500/10 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {quiz.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
                  {quiz.isPublished ? t('published') : t('draft')}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={t('edit_quiz')}
                  title={t('edit_quiz')}
                  onClick={() => {
                    setSettingsDescription(quiz.description || '');
                    setSettingsInstructions(quiz.instructions || '');
                    setIsEditingSettings((v) => !v);
                  }}
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  variant={quiz.isPublished ? 'secondary' : 'primary'}
                  size="sm"
                  aria-label={quiz.isPublished ? t('unpublish') : t('publish')}
                  title={quiz.isPublished ? t('unpublish') : t('publish')}
                  onClick={() => togglePublishMutation.mutate()}
                  disabled={togglePublishMutation.isPending}
                >
                  {quiz.isPublished ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>

            {!isEditingSettings && (quiz.description || quiz.instructions) && (
              <div
                className="mt-5 pt-5 border-t space-y-4"
                style={{ borderColor: colors.border }}
              >
                {quiz.description && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>
                      {t('description_label')}
                    </h3>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      style={{ color: colors.textPrimary }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(quiz.description) }}
                    />
                  </div>
                )}
                {quiz.instructions && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>
                      {t('instructions_label')}
                    </h3>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      style={{ color: colors.textPrimary }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(quiz.instructions) }}
                    />
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Inline settings panel */}
        {isEditingSettings && (
          <Card className="mb-6">
            <CardBody>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  updateQuizMutation.mutate({
                    title: formData.get('title') as string,
                    description: settingsDescription || undefined,
                    instructions: settingsInstructions || undefined,
                    timeLimit: formData.get('timeLimit')
                      ? parseInt(formData.get('timeLimit') as string)
                      : undefined,
                    maxAttempts: parseInt(formData.get('maxAttempts') as string) || 1,
                    passingScore: parseInt(formData.get('passingScore') as string) || 70,
                    shuffleQuestions: formData.get('shuffleQuestions') === 'on',
                    shuffleOptions: formData.get('shuffleOptions') === 'on',
                  });
                }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                  {t('quiz_settings')}
                </h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('title_label')}
                  </label>
                  <input
                    name="title"
                    defaultValue={quiz.title}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('description_label')}
                  </label>
                  <RichTextEditor
                    value={settingsDescription}
                    onChange={setSettingsDescription}
                    editorClassName="forum-reply-editor px-3 py-2 min-h-[200px] max-h-[400px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('instructions_label')}
                  </label>
                  <RichTextEditor
                    value={settingsInstructions}
                    onChange={setSettingsInstructions}
                    editorClassName="forum-reply-editor px-3 py-2 min-h-[120px] max-h-[300px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('time_limit_minutes')}
                    </label>
                    <input
                      name="timeLimit"
                      type="number"
                      min="0"
                      defaultValue={quiz.timeLimit || ''}
                      placeholder={t('no_time_limit')}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('max_attempts')}
                    </label>
                    <input
                      name="maxAttempts"
                      type="number"
                      min="0"
                      defaultValue={quiz.maxAttempts}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('passing_score_percent')}
                    </label>
                    <input
                      name="passingScore"
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={quiz.passingScore}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      name="shuffleQuestions"
                      type="checkbox"
                      defaultChecked={quiz.shuffleQuestions}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('shuffle_questions')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      name="shuffleOptions"
                      type="checkbox"
                      defaultChecked={quiz.shuffleOptions}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('shuffle_options')}</span>
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setIsEditingSettings(false)}>
                    {t('common:cancel')}
                  </Button>
                  <Button type="submit" disabled={updateQuizMutation.isPending}>
                    <Save size={18} />
                    {t('common:save')}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        {/* Tabs — splits the rest of the page into Questions / Overview */}
        <div
          className="flex items-center gap-6 border-b mb-6"
          style={{ borderColor: colors.border }}
        >
          {(['questions', 'overview'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="relative pb-3 text-sm font-medium transition-colors"
              style={{ color: activeTab === tab ? colors.textPrimary : colors.textSecondary }}
            >
              {tab === 'questions' ? t('questions_label') : t('overview', { defaultValue: 'Overview' })}
              {activeTab === tab && (
                <span
                  className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full"
                  style={{ backgroundColor: colors.textPrimary }}
                />
              )}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <Card>
            <CardBody className="py-12 text-center text-sm">
              <span style={{ color: colors.textSecondary }}>
                {t('overview', { defaultValue: 'Overview' })}
              </span>
            </CardBody>
          </Card>
        )}

        {/* Questions */}
        {activeTab === 'questions' && (
        <>
        <div className="flex items-center justify-end gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => setIsAIGeneratorOpen(true)}>
              <Sparkles size={18} />
              {t('generate_with_ai')}
            </Button>
            <Button onClick={() => setIsAddingQuestion(true)} disabled={isAddingQuestion}>
              <Plus size={18} />
              {t('add_question')}
            </Button>
          </div>
        </div>

        {(quiz.questions && quiz.questions.length > 0) || isAddingQuestion ? (
          <div className="space-y-4">
            {quiz.questions?.map((question, idx) => (
              <QuizQuestionCard
                key={question.id}
                question={question}
                index={idx}
                total={quiz.questions!.length}
                isSaving={updateQuestionMutation.isPending}
                onSave={handleSaveQuestion}
                onDelete={handleDeleteQuestion}
                onMove={moveQuestion}
              />
            ))}
            {isAddingQuestion && (
              <QuizQuestionCard
                key="draft"
                question={draftQuestion}
                index={quiz.questions?.length || 0}
                total={(quiz.questions?.length || 0) + 1}
                startInEdit
                isSaving={addQuestionMutation.isPending}
                onSave={handleSaveQuestion}
                onDelete={() => setIsAddingQuestion(false)}
                onMove={() => {}}
                onCancelNew={() => setIsAddingQuestion(false)}
              />
            )}
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
              <p style={{ color: colors.textPrimary }}>{t('no_questions_yet')}</p>
              <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                {t('add_first_question_desc')}
              </p>
              <Button onClick={() => setIsAddingQuestion(true)} className="mt-4">
                <Plus size={18} />
                {t('add_question')}
              </Button>
            </CardBody>
          </Card>
        )}
        </>
        )}
      </div>

      {/* AI MCQ Generator Modal */}
      <MCQGenerator
        quizId={parsedQuizId}
        isOpen={isAIGeneratorOpen}
        onClose={() => setIsAIGeneratorOpen(false)}
        onQuestionsAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
        }}
      />
    </div>
  );
};
