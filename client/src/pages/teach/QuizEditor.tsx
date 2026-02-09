import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  Save,
  GripVertical,
  AlertCircle,
  CheckCircle,
  Settings,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { quizzesApi, Quiz, QuizQuestion, CreateQuestionInput } from '../../api/quizzes';
import { coursesApi } from '../../api/courses';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import { MCQGenerator } from '../../components/teaching/MCQGenerator';

interface QuestionFormData {
  questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_in_blank';
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
}

const defaultQuestionForm: QuestionFormData = {
  questionType: 'multiple_choice',
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  explanation: '',
  points: 1,
};

export const QuizEditor = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const { id: courseId, quizId } = useParams<{ id: string; quizId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const parsedQuizId = parseInt(quizId!, 10);
  const { isDark } = useTheme();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionFormData>(defaultQuestionForm);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgHover: isDark ? '#374151' : '#f3f4f6',
    bgInput: isDark ? '#374151' : '#ffffff',
  };

  // Fetch course info for breadcrumbs
  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(parseInt(courseId!)),
    enabled: !!courseId,
  });

  // Fetch quiz with questions
  const { data: quiz, isLoading, error } = useQuery({
    queryKey: ['quiz', parsedQuizId],
    queryFn: () => quizzesApi.getQuiz(parsedQuizId),
  });

  // Update quiz mutation
  const updateQuizMutation = useMutation({
    mutationFn: (data: Partial<Quiz>) => quizzesApi.updateQuiz(parsedQuizId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
      toast.success(t('quiz_updated'));
      setIsSettingsOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_to_update_quiz'));
    },
  });

  // Add question mutation
  const addQuestionMutation = useMutation({
    mutationFn: (data: CreateQuestionInput) => quizzesApi.addQuestion(parsedQuizId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
      toast.success(t('question_added'));
      setIsQuestionModalOpen(false);
      setQuestionForm(defaultQuestionForm);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_add_question'));
    },
  });

  // Update question mutation
  const updateQuestionMutation = useMutation({
    mutationFn: ({ questionId, data }: { questionId: number; data: Partial<CreateQuestionInput> }) =>
      quizzesApi.updateQuestion(questionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
      toast.success(t('question_updated'));
      setIsQuestionModalOpen(false);
      setEditingQuestion(null);
      setQuestionForm(defaultQuestionForm);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_update_question'));
    },
  });

  // Delete question mutation
  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: number) => quizzesApi.deleteQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
      toast.success(t('question_deleted'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_delete_question'));
    },
  });

  // Toggle publish mutation
  const togglePublishMutation = useMutation({
    mutationFn: () => quizzesApi.updateQuiz(parsedQuizId, { isPublished: !quiz?.isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
      toast.success(quiz?.isPublished ? t('quiz_unpublished') : t('quiz_published'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_to_update_quiz'));
    },
  });

  const handleOpenQuestionModal = (question?: QuizQuestion) => {
    if (question) {
      setEditingQuestion(question);
      setQuestionForm({
        questionType: question.questionType,
        questionText: question.questionText,
        options: question.options || ['', '', '', ''],
        correctAnswer: question.correctAnswer || '',
        explanation: question.explanation || '',
        points: question.points,
      });
    } else {
      setEditingQuestion(null);
      setQuestionForm(defaultQuestionForm);
    }
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = () => {
    const data: CreateQuestionInput = {
      questionType: questionForm.questionType,
      questionText: questionForm.questionText,
      correctAnswer: questionForm.correctAnswer,
      explanation: questionForm.explanation || undefined,
      points: questionForm.points,
    };

    if (questionForm.questionType === 'multiple_choice') {
      data.options = questionForm.options.filter(o => o.trim() !== '');
    }

    if (editingQuestion) {
      updateQuestionMutation.mutate({ questionId: editingQuestion.id, data });
    } else {
      addQuestionMutation.mutate(data);
    }
  };

  const handleDeleteQuestion = (questionId: number) => {
    if (window.confirm(t('delete_question_confirm'))) {
      deleteQuestionMutation.mutate(questionId);
    }
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
    ...buildTeachingBreadcrumb(courseId, course?.title || 'Course', 'Quizzes'),
    { label: quiz.title },
  ];

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-4xl mx-auto px-4">
        {/* Breadcrumb navigation */}
        <div className="mb-6">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
              {quiz.title}
            </h1>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              {t('x_questions', { count: quiz.questions?.length || 0 })}
              {quiz.timeLimit && ` • ${t('time_limit_display', { minutes: quiz.timeLimit })}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setIsSettingsOpen(true)}>
              <Settings size={18} />
              {t('settings')}
            </Button>
            <Button
              variant={quiz.isPublished ? 'secondary' : 'primary'}
              onClick={() => togglePublishMutation.mutate()}
              disabled={togglePublishMutation.isPending}
            >
              {quiz.isPublished ? (
                <>
                  <EyeOff size={18} />
                  {t('unpublish')}
                </>
              ) : (
                <>
                  <Eye size={18} />
                  {t('publish')}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quiz Info Card */}
        <Card className="mb-6">
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  {quiz.questions?.length || 0}
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>{t('questions_label')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  {quiz.timeLimit || '∞'}
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>{t('minutes_label')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  {quiz.maxAttempts || '∞'}
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>{t('max_attempts')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  {quiz.passingScore}%
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>{t('passing_score')}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Questions List */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
            {t('questions_label')}
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setIsAIGeneratorOpen(true)}>
              <Sparkles size={18} />
              {t('generate_with_ai')}
            </Button>
            <Button onClick={() => handleOpenQuestionModal()}>
              <Plus size={18} />
              {t('add_question')}
            </Button>
          </div>
        </div>

        {quiz.questions && quiz.questions.length > 0 ? (
          <div className="space-y-4">
            {quiz.questions.map((question, idx) => (
              <Card key={question.id}>
                <CardBody>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 cursor-move" style={{ color: colors.textSecondary }}>
                      <GripVertical size={20} />
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium" style={{ color: colors.textPrimary }}>
                            {question.questionText}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span
                              className="text-xs px-2 py-1 rounded"
                              style={{ backgroundColor: colors.bgHover, color: colors.textSecondary }}
                            >
                              {question.questionType.replace('_', ' ')}
                            </span>
                            <span className="text-sm" style={{ color: colors.textSecondary }}>
                              {t('x_points', { count: question.points })}
                            </span>
                          </div>
                          {question.questionType === 'multiple_choice' && question.options && (
                            <div className="mt-3 space-y-1">
                              {question.options.map((opt, optIdx) => (
                                <div
                                  key={optIdx}
                                  className="flex items-center gap-2 text-sm"
                                  style={{ color: colors.textSecondary }}
                                >
                                  {opt === question.correctAnswer ? (
                                    <CheckCircle size={14} className="text-green-500" />
                                  ) : (
                                    <span className="w-3.5" />
                                  )}
                                  {opt}
                                </div>
                              ))}
                            </div>
                          )}
                          {question.questionType === 'true_false' && (
                            <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                              {t('correct_answer_label')}: <span className="font-medium">{question.correctAnswer}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenQuestionModal(question)}
                          >
                            {t('edit')}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDeleteQuestion(question.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
              <p style={{ color: colors.textPrimary }}>{t('no_questions_yet')}</p>
              <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                {t('add_first_question_desc')}
              </p>
              <Button onClick={() => handleOpenQuestionModal()} className="mt-4">
                <Plus size={18} />
                {t('add_question')}
              </Button>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Settings Modal */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title={t('quiz_settings')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            updateQuizMutation.mutate({
              title: formData.get('title') as string,
              description: formData.get('description') as string || undefined,
              instructions: formData.get('instructions') as string || undefined,
              timeLimit: formData.get('timeLimit') ? parseInt(formData.get('timeLimit') as string) : undefined,
              maxAttempts: parseInt(formData.get('maxAttempts') as string) || 1,
              passingScore: parseInt(formData.get('passingScore') as string) || 70,
              shuffleQuestions: formData.get('shuffleQuestions') === 'on',
              shuffleOptions: formData.get('shuffleOptions') === 'on',
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('title_label')}
            </label>
            <input
              name="title"
              defaultValue={quiz.title}
              required
              className="w-full px-3 py-2 rounded-lg"
              style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('description_label')}
            </label>
            <textarea
              name="description"
              defaultValue={quiz.description || ''}
              rows={2}
              className="w-full px-3 py-2 rounded-lg"
              style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('instructions_label')}
            </label>
            <textarea
              name="instructions"
              defaultValue={quiz.instructions || ''}
              rows={3}
              className="w-full px-3 py-2 rounded-lg"
              style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('time_limit_minutes')}
              </label>
              <input
                name="timeLimit"
                type="number"
                min="0"
                defaultValue={quiz.timeLimit || ''}
                placeholder={t('no_time_limit')}
                className="w-full px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('max_attempts')}
              </label>
              <input
                name="maxAttempts"
                type="number"
                min="0"
                defaultValue={quiz.maxAttempts}
                className="w-full px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('passing_score_percent')}
              </label>
              <input
                name="passingScore"
                type="number"
                min="0"
                max="100"
                defaultValue={quiz.passingScore}
                className="w-full px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                name="shuffleQuestions"
                type="checkbox"
                defaultChecked={quiz.shuffleQuestions}
                className="w-4 h-4"
              />
              <span className="text-sm" style={{ color: colors.textPrimary }}>{t('shuffle_questions')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                name="shuffleOptions"
                type="checkbox"
                defaultChecked={quiz.shuffleOptions}
                className="w-4 h-4"
              />
              <span className="text-sm" style={{ color: colors.textPrimary }}>{t('shuffle_options')}</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsSettingsOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" disabled={updateQuizMutation.isPending}>
              <Save size={18} />
              {t('save_settings')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* AI MCQ Generator Modal */}
      <MCQGenerator
        quizId={parsedQuizId}
        isOpen={isAIGeneratorOpen}
        onClose={() => setIsAIGeneratorOpen(false)}
        onQuestionsAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['quiz', parsedQuizId] });
        }}
      />

      {/* Question Modal */}
      <Modal
        isOpen={isQuestionModalOpen}
        onClose={() => {
          setIsQuestionModalOpen(false);
          setEditingQuestion(null);
          setQuestionForm(defaultQuestionForm);
        }}
        title={editingQuestion ? t('edit_question') : t('add_question')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('question_type_label')}
            </label>
            <select
              value={questionForm.questionType}
              onChange={(e) => setQuestionForm({
                ...questionForm,
                questionType: e.target.value as QuestionFormData['questionType'],
                correctAnswer: '',
              })}
              className="w-full px-3 py-2 rounded-lg"
              style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
            >
              <option value="multiple_choice">{t('multiple_choice')}</option>
              <option value="true_false">{t('true_false')}</option>
              <option value="short_answer">{t('short_answer')}</option>
              <option value="fill_in_blank">{t('fill_in_blank')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('question_text_label')}
            </label>
            <textarea
              value={questionForm.questionText}
              onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })}
              rows={3}
              required
              className="w-full px-3 py-2 rounded-lg"
              style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
            />
          </div>

          {questionForm.questionType === 'multiple_choice' && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('options_click_correct')}
              </label>
              <div className="space-y-2">
                {questionForm.options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuestionForm({ ...questionForm, correctAnswer: option })}
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        questionForm.correctAnswer === option && option
                          ? 'bg-green-500 text-white'
                          : ''
                      }`}
                      style={questionForm.correctAnswer !== option || !option ? {
                        backgroundColor: colors.border,
                        color: colors.textSecondary,
                      } : {}}
                    >
                      {questionForm.correctAnswer === option && option ? <CheckCircle size={14} /> : idx + 1}
                    </button>
                    <input
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...questionForm.options];
                        newOptions[idx] = e.target.value;
                        setQuestionForm({ ...questionForm, options: newOptions });
                      }}
                      placeholder={t('option_placeholder', { number: idx + 1 })}
                      className="flex-1 px-3 py-2 rounded-lg"
                      style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {questionForm.questionType === 'true_false' && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('correct_answer_label')}
              </label>
              <div className="flex gap-4">
                {['true', 'false'].map((value) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="trueFalse"
                      value={value}
                      checked={questionForm.correctAnswer === value}
                      onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                      className="w-4 h-4"
                    />
                    <span style={{ color: colors.textPrimary }} className="capitalize">{value}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {(questionForm.questionType === 'short_answer' || questionForm.questionType === 'fill_in_blank') && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('correct_answer_label')}
              </label>
              <input
                value={questionForm.correctAnswer}
                onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('explanation_label')}
            </label>
            <textarea
              value={questionForm.explanation}
              onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg"
              style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('points_label')}
            </label>
            <input
              type="number"
              min="1"
              value={questionForm.points}
              onChange={(e) => setQuestionForm({ ...questionForm, points: parseInt(e.target.value) || 1 })}
              className="w-32 px-3 py-2 rounded-lg"
              style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsQuestionModalOpen(false);
                setEditingQuestion(null);
                setQuestionForm(defaultQuestionForm);
              }}
            >
              {t('common:cancel')}
            </Button>
            <Button
              onClick={handleSaveQuestion}
              disabled={addQuestionMutation.isPending || updateQuestionMutation.isPending}
            >
              <Save size={18} />
              {editingQuestion ? t('update_question') : t('add_question')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
