import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Clock,
  Users,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { quizzesApi, CreateQuizInput } from '../../api/quizzes';
import { coursesApi } from '../../api/courses';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';

export const QuizManager = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const { id: courseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const parsedCourseId = parseInt(courseId!, 10);
  const { isDark } = useTheme();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newQuizForm, setNewQuizForm] = useState<CreateQuizInput>({
    title: '',
    description: '',
    timeLimit: undefined,
    maxAttempts: 1,
    passingScore: 70,
  });

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgHover: isDark ? '#374151' : '#f3f4f6',
    bgInput: isDark ? '#374151' : '#ffffff',
    bgGreen: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    textGreen: isDark ? '#86efac' : '#15803d',
  };

  // Fetch course info for breadcrumbs
  const { data: course } = useQuery({
    queryKey: ['course', parsedCourseId],
    queryFn: () => coursesApi.getCourseById(parsedCourseId),
    enabled: !!parsedCourseId,
  });

  // Fetch quizzes
  const { data: quizzes, isLoading } = useQuery({
    queryKey: ['quizzes', parsedCourseId],
    queryFn: () => quizzesApi.getQuizzes(parsedCourseId),
  });

  // Create quiz mutation
  const createQuizMutation = useMutation({
    mutationFn: (data: CreateQuizInput) => quizzesApi.createQuiz(parsedCourseId, data),
    onSuccess: (quiz) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes', parsedCourseId] });
      toast.success(t('quiz_created'));
      setIsCreateModalOpen(false);
      setNewQuizForm({ title: '', description: '', timeLimit: undefined, maxAttempts: 1, passingScore: 70 });
      // Navigate to quiz editor
      navigate(`/teach/courses/${courseId}/quizzes/${quiz.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_to_create_quiz'));
    },
  });

  // Delete quiz mutation
  const deleteQuizMutation = useMutation({
    mutationFn: (quizId: number) => quizzesApi.deleteQuiz(quizId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes', parsedCourseId] });
      toast.success(t('quiz_deleted'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_to_delete_quiz'));
    },
  });

  // Toggle publish mutation
  const togglePublishMutation = useMutation({
    mutationFn: ({ quizId, isPublished }: { quizId: number; isPublished: boolean }) =>
      quizzesApi.updateQuiz(quizId, { isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes', parsedCourseId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_to_update_quiz'));
    },
  });

  const handleDeleteQuiz = (quizId: number, title: string) => {
    if (window.confirm(t('delete_quiz_confirm', { title }))) {
      deleteQuizMutation.mutate(quizId);
    }
  };

  const handleCreateQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    createQuizMutation.mutate(newQuizForm);
  };

  if (isLoading) {
    return <Loading text={t('loading_quizzes')} />;
  }

  const breadcrumbItems = buildTeachingBreadcrumb(courseId, course?.title || 'Course', 'Quizzes');

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-6xl mx-auto px-4">
        {/* Breadcrumb navigation */}
        <div className="mb-6">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
              {t('quiz_manager')}
            </h1>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              {t('create_manage_quizzes')}
            </p>
          </div>

          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} />
            {t('create_quiz')}
          </Button>
        </div>

        {/* Quizzes List */}
        {quizzes && quizzes.length > 0 ? (
          <div className="grid gap-4">
            {quizzes.map((quiz) => (
              <Card key={quiz.id}>
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                          {quiz.title}
                        </h3>
                        {quiz.isPublished ? (
                          <span
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                            style={{ backgroundColor: colors.bgGreen, color: colors.textGreen }}
                          >
                            <Eye size={12} />
                            {t('published')}
                          </span>
                        ) : (
                          <span
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                            style={{ backgroundColor: colors.bgHover, color: colors.textSecondary }}
                          >
                            <EyeOff size={12} />
                            {t('draft')}
                          </span>
                        )}
                      </div>

                      {quiz.description && (
                        <p className="text-sm mb-3" style={{ color: colors.textSecondary }}>
                          {quiz.description}
                        </p>
                      )}

                      <div className="flex items-center gap-6 text-sm" style={{ color: colors.textSecondary }}>
                        <span className="flex items-center gap-1">
                          <CheckCircle size={14} />
                          {t('x_questions', { count: quiz._count?.questions || 0 })}
                        </span>
                        {quiz.timeLimit && (
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {quiz.timeLimit} min
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {t('x_attempts', { count: quiz._count?.attempts || 0 })}
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 size={14} />
                          {t('percent_to_pass', { score: quiz.passingScore })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => togglePublishMutation.mutate({
                          quizId: quiz.id,
                          isPublished: !quiz.isPublished,
                        })}
                        disabled={togglePublishMutation.isPending}
                      >
                        {quiz.isPublished ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                      <Link to={`/teach/courses/${courseId}/quizzes/${quiz.id}`}>
                        <Button variant="secondary" size="sm">
                          <Edit size={16} />
                          {t('edit')}
                        </Button>
                      </Link>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDeleteQuiz(quiz.id, quiz.title)}
                        disabled={deleteQuizMutation.isPending}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-12">
              <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
              <p style={{ color: colors.textPrimary }}>{t('no_quizzes_yet')}</p>
              <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                {t('create_first_quiz_desc')}
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)} className="mt-4">
                <Plus size={18} />
                {t('create_quiz')}
              </Button>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Create Quiz Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('create_new_quiz')}
      >
        <form onSubmit={handleCreateQuiz} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('quiz_title')} *
            </label>
            <input
              value={newQuizForm.title}
              onChange={(e) => setNewQuizForm({ ...newQuizForm, title: e.target.value })}
              required
              placeholder={t('chapter_quiz_placeholder')}
              className="w-full px-3 py-2 rounded-lg"
              style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('quiz_description')}
            </label>
            <textarea
              value={newQuizForm.description || ''}
              onChange={(e) => setNewQuizForm({ ...newQuizForm, description: e.target.value })}
              rows={2}
              placeholder={t('brief_quiz_desc')}
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
                type="number"
                min="0"
                value={newQuizForm.timeLimit || ''}
                onChange={(e) => setNewQuizForm({
                  ...newQuizForm,
                  timeLimit: e.target.value ? parseInt(e.target.value) : undefined,
                })}
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
                type="number"
                min="0"
                value={newQuizForm.maxAttempts || ''}
                onChange={(e) => setNewQuizForm({
                  ...newQuizForm,
                  maxAttempts: parseInt(e.target.value) || 1,
                })}
                className="w-full px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('passing_score')}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={newQuizForm.passingScore || ''}
                onChange={(e) => setNewQuizForm({
                  ...newQuizForm,
                  passingScore: parseInt(e.target.value) || 70,
                })}
                className="w-full px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.bgInput, borderColor: colors.border, borderWidth: 1, color: colors.textPrimary }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" disabled={createQuizMutation.isPending}>
              {t('create_quiz')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
