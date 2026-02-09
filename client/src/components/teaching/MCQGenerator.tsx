import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { quizzesApi, MCQGenerationInput, GeneratedMCQ, CreateQuestionInput } from '../../api/quizzes';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface MCQGeneratorProps {
  quizId: number;
  isOpen: boolean;
  onClose: () => void;
  onQuestionsAdded: () => void;
}

interface EditableMCQ extends GeneratedMCQ {
  selected: boolean;
  editing: boolean;
}

export const MCQGenerator = ({ quizId, isOpen, onClose, onQuestionsAdded }: MCQGeneratorProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const { isDark } = useTheme();

  // Form state
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [optionCount, setOptionCount] = useState(4);
  const [includeExplanations, setIncludeExplanations] = useState(true);

  // Generated questions state
  const [generatedQuestions, setGeneratedQuestions] = useState<EditableMCQ[]>([]);
  const [showContentInput, setShowContentInput] = useState(false);

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgSecondary: isDark ? '#374151' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgInput: isDark ? '#374151' : '#ffffff',
    success: isDark ? '#10b981' : '#059669',
    error: isDark ? '#ef4444' : '#dc2626',
  };

  // Generate MCQs mutation
  const generateMutation = useMutation({
    mutationFn: (input: MCQGenerationInput) => quizzesApi.generateMCQ(quizId, input),
    onSuccess: (result) => {
      const editableQuestions = result.questions.map((q) => ({
        ...q,
        selected: true,
        editing: false,
      }));
      setGeneratedQuestions(editableQuestions);
      toast.success(t('mcq_generated', { count: result.questions.length }));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('mcq_generation_failed'));
    },
  });

  // Add questions mutation
  const addQuestionsMutation = useMutation({
    mutationFn: (questions: CreateQuestionInput[]) => quizzesApi.addQuestionsBulk(quizId, questions),
    onSuccess: (addedQuestions) => {
      toast.success(t('questions_added', { count: addedQuestions.length }));
      onQuestionsAdded();
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_add_questions'));
    },
  });

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast.error(t('topic_required'));
      return;
    }

    generateMutation.mutate({
      topic,
      content: content || undefined,
      questionCount,
      difficulty,
      optionCount,
      includeExplanations,
    });
  };

  const handleAddSelected = () => {
    const selectedQuestions = generatedQuestions.filter((q) => q.selected);
    if (selectedQuestions.length === 0) {
      toast.error(t('no_questions_selected'));
      return;
    }

    const questionsToAdd: CreateQuestionInput[] = selectedQuestions.map((q) => ({
      questionType: 'multiple_choice',
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      points: 1,
    }));

    addQuestionsMutation.mutate(questionsToAdd);
  };

  const handleAddAll = () => {
    setGeneratedQuestions((prev) => prev.map((q) => ({ ...q, selected: true })));
    setTimeout(handleAddSelected, 0);
  };

  const toggleQuestionSelect = (index: number) => {
    setGeneratedQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, selected: !q.selected } : q))
    );
  };

  const removeQuestion = (index: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, updates: Partial<GeneratedMCQ>) => {
    setGeneratedQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  };

  const handleClose = () => {
    setTopic('');
    setContent('');
    setQuestionCount(5);
    setDifficulty('medium');
    setGeneratedQuestions([]);
    setShowContentInput(false);
    onClose();
  };

  const selectedCount = generatedQuestions.filter((q) => q.selected).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('generate_mcq_title')}
      size="lg"
    >
      <div className="space-y-6">
        {/* Generation Form */}
        {generatedQuestions.length === 0 && (
          <div className="space-y-4">
            {/* Topic */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('topic_label')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t('topic_placeholder')}
                className="w-full px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: colors.bgInput,
                  borderColor: colors.border,
                  borderWidth: 1,
                  color: colors.textPrimary,
                }}
              />
            </div>

            {/* Source Content (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowContentInput(!showContentInput)}
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: colors.textSecondary }}
              >
                {showContentInput ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {t('source_content_label')} ({t('common:optional')})
              </button>
              {showContentInput && (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t('source_content_placeholder')}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg mt-2"
                  style={{
                    backgroundColor: colors.bgInput,
                    borderColor: colors.border,
                    borderWidth: 1,
                    color: colors.textPrimary,
                  }}
                />
              )}
            </div>

            {/* Settings Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Question Count */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                  {t('question_count_label')}
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="text-center text-sm" style={{ color: colors.textSecondary }}>
                  {questionCount}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                  {t('difficulty_label')}
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: colors.bgInput,
                    borderColor: colors.border,
                    borderWidth: 1,
                    color: colors.textPrimary,
                  }}
                >
                  <option value="easy">{t('difficulty_easy')}</option>
                  <option value="medium">{t('difficulty_medium')}</option>
                  <option value="hard">{t('difficulty_hard')}</option>
                </select>
              </div>

              {/* Option Count */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                  {t('options_count_label')}
                </label>
                <select
                  value={optionCount}
                  onChange={(e) => setOptionCount(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: colors.bgInput,
                    borderColor: colors.border,
                    borderWidth: 1,
                    color: colors.textPrimary,
                  }}
                >
                  <option value={3}>3 {t('options')}</option>
                  <option value={4}>4 {t('options')}</option>
                  <option value={5}>5 {t('options')}</option>
                </select>
              </div>

              {/* Include Explanations */}
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeExplanations}
                    onChange={(e) => setIncludeExplanations(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm" style={{ color: colors.textPrimary }}>
                    {t('include_explanations_label')}
                  </span>
                </label>
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex justify-center pt-2">
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !topic.trim()}
                className="min-w-[200px]"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('generating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {t('generate_button')}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Generated Questions Preview */}
        {generatedQuestions.length > 0 && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium" style={{ color: colors.textPrimary }}>
                {t('preview_title')} ({selectedCount}/{generatedQuestions.length} {t('selected')})
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setGeneratedQuestions([])}
              >
                {t('regenerate')}
              </Button>
            </div>

            {/* Questions List */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {generatedQuestions.map((question, idx) => (
                <QuestionPreviewCard
                  key={idx}
                  question={question}
                  index={idx}
                  onToggleSelect={() => toggleQuestionSelect(idx)}
                  onRemove={() => removeQuestion(idx)}
                  onUpdate={(updates) => updateQuestion(idx, updates)}
                  colors={colors}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t" style={{ borderColor: colors.border }}>
              <Button variant="secondary" onClick={handleClose}>
                {t('common:cancel')}
              </Button>
              <Button
                variant="secondary"
                onClick={handleAddSelected}
                disabled={addQuestionsMutation.isPending || selectedCount === 0}
              >
                <Plus className="w-4 h-4" />
                {t('add_selected')} ({selectedCount})
              </Button>
              <Button
                onClick={handleAddAll}
                disabled={addQuestionsMutation.isPending || generatedQuestions.length === 0}
              >
                {addQuestionsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {t('add_all')} ({generatedQuestions.length})
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// Question Preview Card Component
interface QuestionPreviewCardProps {
  question: EditableMCQ;
  index: number;
  onToggleSelect: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<GeneratedMCQ>) => void;
  colors: Record<string, string>;
}

const QuestionPreviewCard = ({
  question,
  index,
  onToggleSelect,
  onRemove,
  onUpdate,
  colors,
}: QuestionPreviewCardProps) => {
  const { t } = useTranslation(['teaching']);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(question.questionText);
  const [editedOptions, setEditedOptions] = useState(question.options);
  const [editedCorrect, setEditedCorrect] = useState(question.correctAnswer);

  const handleSaveEdit = () => {
    onUpdate({
      questionText: editedText,
      options: editedOptions,
      correctAnswer: editedCorrect,
    });
    setIsEditing(false);
  };

  return (
    <div
      className={`p-4 rounded-lg border ${question.selected ? 'ring-2 ring-blue-500' : ''}`}
      style={{
        backgroundColor: colors.bgSecondary,
        borderColor: colors.border,
        opacity: question.selected ? 1 : 0.6,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={question.selected}
          onChange={onToggleSelect}
          className="mt-1 w-4 h-4"
        />

        {/* Question Number */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium text-white"
          style={{ backgroundColor: '#3b82f6' }}
        >
          {index + 1}
        </div>

        {/* Question Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-3">
              {/* Edit Question Text */}
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm"
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  borderWidth: 1,
                  color: colors.textPrimary,
                }}
                rows={2}
              />

              {/* Edit Options */}
              <div className="space-y-2">
                {editedOptions.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditedCorrect(opt)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        editedCorrect === opt
                          ? 'bg-green-500 text-white'
                          : ''
                      }`}
                      style={
                        editedCorrect !== opt
                          ? { backgroundColor: colors.border, color: colors.textSecondary }
                          : {}
                      }
                    >
                      {editedCorrect === opt && <CheckCircle size={12} />}
                    </button>
                    <input
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...editedOptions];
                        const oldOpt = newOptions[optIdx];
                        newOptions[optIdx] = e.target.value;
                        setEditedOptions(newOptions);
                        // Update correct answer if it was this option
                        if (editedCorrect === oldOpt) {
                          setEditedCorrect(e.target.value);
                        }
                      }}
                      className="flex-1 px-2 py-1 rounded text-sm"
                      style={{
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                        borderWidth: 1,
                        color: colors.textPrimary,
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Save/Cancel Edit */}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  {t('common:save')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedText(question.questionText);
                    setEditedOptions(question.options);
                    setEditedCorrect(question.correctAnswer);
                  }}
                >
                  {t('common:cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Question Text */}
              <p className="font-medium text-sm" style={{ color: colors.textPrimary }}>
                {question.questionText}
              </p>

              {/* Options */}
              <div className="mt-2 space-y-1">
                {question.options.map((opt, optIdx) => (
                  <div
                    key={optIdx}
                    className="flex items-center gap-2 text-sm"
                    style={{ color: colors.textSecondary }}
                  >
                    {opt === question.correctAnswer ? (
                      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle size={14} className="text-gray-400 flex-shrink-0" />
                    )}
                    <span className={opt === question.correctAnswer ? 'font-medium text-green-600' : ''}>
                      {opt}
                    </span>
                  </div>
                ))}
              </div>

              {/* Explanation */}
              {question.explanation && (
                <p className="mt-2 text-xs italic" style={{ color: colors.textSecondary }}>
                  {t('explanation')}: {question.explanation}
                </p>
              )}

              {/* Difficulty Badge */}
              <div className="mt-2">
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: colors.border,
                    color: colors.textSecondary,
                  }}
                >
                  {question.difficulty}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              title={t('edit')}
            >
              <Edit2 size={14} style={{ color: colors.textSecondary }} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
              title={t('remove')}
            >
              <Trash2 size={14} className="text-red-500" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
