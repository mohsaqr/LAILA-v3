import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Edit2,
  Trash2,
  BarChart3,
  Link2,
  Eye,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Survey,
  SurveyQuestion as SurveyQuestionType,
  CreateSurveyQuestionData,
  SurveyQuestionType as QuestionType,
} from '../../types';
import { surveysApi } from '../../api/surveys';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { useTheme } from '../../hooks/useTheme';

export const SurveyManager = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const { id: courseId } = useParams<{ id: string }>();
  const { isDark } = useTheme();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestionType | null>(null);
  const [expandedSurveyId, setExpandedSurveyId] = useState<number | null>(null);

  // Form states
  const [surveyForm, setSurveyForm] = useState({
    title: '',
    description: '',
    isAnonymous: false,
  });
  const [questionForm, setQuestionForm] = useState<CreateSurveyQuestionData>({
    questionText: '',
    questionType: 'single_choice',
    options: [''],
    isRequired: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSurveys();
  }, [courseId]);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const data = await surveysApi.getSurveys(courseId ? parseInt(courseId) : undefined);
      setSurveys(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load surveys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSurvey = async () => {
    if (!surveyForm.title.trim()) return;
    setSubmitting(true);
    try {
      const newSurvey = await surveysApi.createSurvey({
        ...surveyForm,
        courseId: courseId ? parseInt(courseId) : null,
      });
      setSurveys(prev => [newSurvey, ...prev]);
      setShowCreateModal(false);
      setSurveyForm({ title: '', description: '', isAnonymous: false });
      // Expand the new survey to add questions
      setExpandedSurveyId(newSurvey.id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create survey');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSurvey = async () => {
    if (!selectedSurvey || !surveyForm.title.trim()) return;
    setSubmitting(true);
    try {
      const updated = await surveysApi.updateSurvey(selectedSurvey.id, surveyForm);
      setSurveys(prev =>
        prev.map(s => (s.id === updated.id ? { ...s, ...updated } : s))
      );
      setShowEditModal(false);
      setSelectedSurvey(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update survey');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSurvey = async () => {
    if (!selectedSurvey) return;
    setSubmitting(true);
    try {
      await surveysApi.deleteSurvey(selectedSurvey.id);
      setSurveys(prev => prev.filter(s => s.id !== selectedSurvey.id));
      setShowDeleteModal(false);
      setSelectedSurvey(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete survey');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishSurvey = async (survey: Survey) => {
    try {
      await surveysApi.publishSurvey(survey.id);
      setSurveys(prev =>
        prev.map(s => (s.id === survey.id ? { ...s, isPublished: true } : s))
      );
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to publish survey');
    }
  };

  const handleAddQuestion = async () => {
    if (!selectedSurvey || !questionForm.questionText.trim()) return;
    setSubmitting(true);
    try {
      const filteredOptions =
        questionForm.questionType !== 'free_text'
          ? questionForm.options?.filter(o => o.trim()) || []
          : undefined;

      const newQuestion = await surveysApi.addQuestion(selectedSurvey.id, {
        ...questionForm,
        options: filteredOptions,
      });

      // Update local state
      setSurveys(prev =>
        prev.map(s => {
          if (s.id === selectedSurvey.id) {
            return {
              ...s,
              questions: [...(s.questions || []), newQuestion],
              _count: { ...s._count, questions: (s._count?.questions || 0) + 1 },
            };
          }
          return s;
        })
      );

      setShowQuestionModal(false);
      setQuestionForm({
        questionText: '',
        questionType: 'single_choice',
        options: [''],
        isRequired: true,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateQuestion = async () => {
    if (!selectedSurvey || !editingQuestion || !questionForm.questionText.trim()) return;
    setSubmitting(true);
    try {
      const filteredOptions =
        questionForm.questionType !== 'free_text'
          ? questionForm.options?.filter(o => o.trim()) || []
          : undefined;

      const updated = await surveysApi.updateQuestion(
        selectedSurvey.id,
        editingQuestion.id,
        {
          ...questionForm,
          options: filteredOptions,
        }
      );

      setSurveys(prev =>
        prev.map(s => {
          if (s.id === selectedSurvey.id) {
            return {
              ...s,
              questions: s.questions?.map(q =>
                q.id === updated.id ? updated : q
              ),
            };
          }
          return s;
        })
      );

      setShowQuestionModal(false);
      setEditingQuestion(null);
      setQuestionForm({
        questionText: '',
        questionType: 'single_choice',
        options: [''],
        isRequired: true,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (survey: Survey, questionId: number) => {
    try {
      await surveysApi.deleteQuestion(survey.id, questionId);
      setSurveys(prev =>
        prev.map(s => {
          if (s.id === survey.id) {
            return {
              ...s,
              questions: s.questions?.filter(q => q.id !== questionId),
              _count: { ...s._count, questions: (s._count?.questions || 1) - 1 },
            };
          }
          return s;
        })
      );
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete question');
    }
  };

  const openEditModal = (survey: Survey) => {
    setSelectedSurvey(survey);
    setSurveyForm({
      title: survey.title,
      description: survey.description || '',
      isAnonymous: survey.isAnonymous,
    });
    setShowEditModal(true);
  };

  const openQuestionModal = (survey: Survey, question?: SurveyQuestionType) => {
    setSelectedSurvey(survey);
    if (question) {
      setEditingQuestion(question);
      setQuestionForm({
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.options || [''],
        isRequired: question.isRequired,
      });
    } else {
      setEditingQuestion(null);
      setQuestionForm({
        questionText: '',
        questionType: 'single_choice',
        options: [''],
        isRequired: true,
      });
    }
    setShowQuestionModal(true);
  };

  const toggleSurveyExpand = async (survey: Survey) => {
    if (expandedSurveyId === survey.id) {
      setExpandedSurveyId(null);
    } else {
      // Fetch full survey with questions if not already loaded
      if (!survey.questions) {
        try {
          const fullSurvey = await surveysApi.getSurveyById(survey.id);
          setSurveys(prev =>
            prev.map(s => (s.id === fullSurvey.id ? fullSurvey : s))
          );
        } catch (err) {
          console.error('Failed to fetch survey questions:', err);
        }
      }
      setExpandedSurveyId(survey.id);
    }
  };

  const copyShareLink = (surveyId: number) => {
    const link = `${window.location.origin}/surveys/${surveyId}`;
    navigator.clipboard.writeText(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: t('teaching'), href: '/teach' },
          ...(courseId
            ? [{ label: t('course'), href: `/teach/courses/${courseId}/curriculum` }]
            : []),
          { label: t('surveys') },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: isDark ? '#f3f4f6' : '#111827' }}
          >
            {t('surveys')}
          </h1>
          <p
            className="mt-1"
            style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
          >
            {t('create_manage_surveys')}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('create_survey')}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            {t('common:dismiss')}
          </button>
        </div>
      )}

      {surveys.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <p
              className="text-lg mb-4"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
            >
              {t('no_surveys_yet')}
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              {t('create_first_survey')}
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {surveys.map(survey => (
            <Card key={survey.id}>
              <div
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => toggleSurveyExpand(survey)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <h3
                      className="font-semibold"
                      style={{ color: isDark ? '#f3f4f6' : '#111827' }}
                    >
                      {survey.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span
                        className="text-sm"
                        style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                      >
                        {t('questions_stat', { count: survey._count?.questions || 0 })}
                      </span>
                      <span
                        className="text-sm"
                        style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                      >
                        {t('responses_stat', { count: survey._count?.responses || 0 })}
                      </span>
                      {survey.isAnonymous && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                          {t('anonymous_badge')}
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          survey.isPublished
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        }`}
                      >
                        {survey.isPublished ? t('published') : t('draft')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {survey.isPublished && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={e => {
                          e.stopPropagation();
                          copyShareLink(survey.id);
                        }}
                        title={t('copy_share_link')}
                      >
                        <Link2 className="w-4 h-4" />
                      </Button>
                      <Link
                        to={courseId ? `/teach/courses/${courseId}/surveys/${survey.id}/responses` : `/teach/surveys/${survey.id}/responses`}
                        onClick={e => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="sm" title={t('view_responses')}>
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                      </Link>
                    </>
                  )}
                  {!survey.isPublished && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={e => {
                        e.stopPropagation();
                        handlePublishSurvey(survey);
                      }}
                      title={t('publish_survey')}
                      disabled={(survey._count?.questions || 0) === 0}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={e => {
                      e.stopPropagation();
                      openEditModal(survey);
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedSurvey(survey);
                      setShowDeleteModal(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                  {expandedSurveyId === survey.id ? (
                    <ChevronUp className="w-5 h-5" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                  ) : (
                    <ChevronDown className="w-5 h-5" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                  )}
                </div>
              </div>

              {expandedSurveyId === survey.id && (
                <div
                  className="border-t p-4"
                  style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
                >
                  {survey.questions && survey.questions.length > 0 ? (
                    <div className="space-y-3">
                      {survey.questions.map((question, index) => (
                        <div
                          key={question.id}
                          className="flex items-start gap-3 p-3 rounded-lg"
                          style={{
                            backgroundColor: isDark ? '#111827' : '#f9fafb',
                          }}
                        >
                          <GripVertical
                            className="w-4 h-4 mt-1 cursor-grab"
                            style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <span
                                  className="text-sm font-medium"
                                  style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                                >
                                  Q{index + 1}
                                </span>
                                <p
                                  className="font-medium"
                                  style={{ color: isDark ? '#f3f4f6' : '#111827' }}
                                >
                                  {question.questionText}
                                  {question.isRequired && (
                                    <span className="text-red-500 ml-1">*</span>
                                  )}
                                </p>
                                <span
                                  className="text-xs"
                                  style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
                                >
                                  {question.questionType.replace('_', ' ')}
                                </span>
                                {question.options && question.options.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {question.options.map((opt, i) => (
                                      <span
                                        key={i}
                                        className="text-xs px-2 py-0.5 rounded"
                                        style={{
                                          backgroundColor: isDark ? '#374151' : '#e5e7eb',
                                          color: isDark ? '#d1d5db' : '#4b5563',
                                        }}
                                      >
                                        {opt}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openQuestionModal(survey, question)}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteQuestion(survey, question.id)}
                                >
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p
                      className="text-sm text-center py-4"
                      style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                    >
                      {t('no_questions_yet')}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => openQuestionModal(survey)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('add_question')}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create Survey Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('create_survey')}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('title_label')}</label>
            <input
              type="text"
              value={surveyForm.title}
              onChange={e => setSurveyForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                borderColor: isDark ? '#374151' : '#d1d5db',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
              placeholder={t('survey_title_placeholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('description_label')}</label>
            <textarea
              value={surveyForm.description}
              onChange={e => setSurveyForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                borderColor: isDark ? '#374151' : '#d1d5db',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
              rows={3}
              placeholder={t('optional_description')}
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={surveyForm.isAnonymous}
              onChange={e => setSurveyForm(prev => ({ ...prev, isAnonymous: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">{t('anonymous_responses_desc')}</span>
          </label>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              {t('common:cancel')}
            </Button>
            <Button onClick={handleCreateSurvey} loading={submitting}>
              {t('common:create')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Survey Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('edit_survey')}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('title_label')}</label>
            <input
              type="text"
              value={surveyForm.title}
              onChange={e => setSurveyForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                borderColor: isDark ? '#374151' : '#d1d5db',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('description_label')}</label>
            <textarea
              value={surveyForm.description}
              onChange={e => setSurveyForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                borderColor: isDark ? '#374151' : '#d1d5db',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
              rows={3}
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={surveyForm.isAnonymous}
              onChange={e => setSurveyForm(prev => ({ ...prev, isAnonymous: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">{t('anonymous_responses')}</span>
          </label>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>
              {t('common:cancel')}
            </Button>
            <Button onClick={handleUpdateSurvey} loading={submitting}>
              {t('common:save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('delete_survey')}
        size="sm"
      >
        <p className="mb-4">
          {t('delete_survey_confirm', { title: selectedSurvey?.title })}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
            {t('common:cancel')}
          </Button>
          <Button variant="danger" onClick={handleDeleteSurvey} loading={submitting}>
            {t('common:delete')}
          </Button>
        </div>
      </Modal>

      {/* Question Modal */}
      <Modal
        isOpen={showQuestionModal}
        onClose={() => {
          setShowQuestionModal(false);
          setEditingQuestion(null);
        }}
        title={editingQuestion ? t('edit_question') : t('add_question')}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('question_label')}</label>
            <input
              type="text"
              value={questionForm.questionText}
              onChange={e =>
                setQuestionForm(prev => ({ ...prev, questionText: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                borderColor: isDark ? '#374151' : '#d1d5db',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
              placeholder={t('enter_question_placeholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('question_type_label')}</label>
            <select
              value={questionForm.questionType}
              onChange={e =>
                setQuestionForm(prev => ({
                  ...prev,
                  questionType: e.target.value as QuestionType,
                }))
              }
              className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                borderColor: isDark ? '#374151' : '#d1d5db',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
            >
              <option value="single_choice">{t('single_choice_radio')}</option>
              <option value="multiple_choice">{t('multiple_choice_checkbox')}</option>
              <option value="free_text">{t('free_text')}</option>
            </select>
          </div>

          {questionForm.questionType !== 'free_text' && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('options_label')}</label>
              <div className="space-y-2">
                {questionForm.options?.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={e => {
                        const newOptions = [...(questionForm.options || [])];
                        newOptions[index] = e.target.value;
                        setQuestionForm(prev => ({ ...prev, options: newOptions }));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500"
                      style={{
                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                        borderColor: isDark ? '#374151' : '#d1d5db',
                        color: isDark ? '#f3f4f6' : '#111827',
                      }}
                      placeholder={t('option_placeholder', { number: index + 1 })}
                    />
                    {(questionForm.options?.length || 0) > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newOptions = questionForm.options?.filter((_, i) => i !== index);
                          setQuestionForm(prev => ({ ...prev, options: newOptions }));
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setQuestionForm(prev => ({
                      ...prev,
                      options: [...(prev.options || []), ''],
                    }))
                  }
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('add_option')}
                </Button>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={questionForm.isRequired}
              onChange={e =>
                setQuestionForm(prev => ({ ...prev, isRequired: e.target.checked }))
              }
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">{t('required_question')}</span>
          </label>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setShowQuestionModal(false);
                setEditingQuestion(null);
              }}
            >
              {t('common:cancel')}
            </Button>
            <Button
              onClick={editingQuestion ? handleUpdateQuestion : handleAddQuestion}
              loading={submitting}
            >
              {editingQuestion ? t('common:save') : t('common:add')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
