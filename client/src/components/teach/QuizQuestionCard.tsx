import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, Trash2, Check, Plus, Save, Pencil } from 'lucide-react';
import { Card, CardBody } from '../common/Card';
import { Button } from '../common/Button';
import { SearchableSelect } from '../common/SearchableSelect';
import { RichTextEditor } from '../forum/RichTextEditor';
import { useTheme } from '../../hooks/useTheme';
import { sanitizeHtml } from '../../utils/sanitize';
import { decodeCorrectAnswers, encodeCorrectAnswers } from '../../utils/quizAnswer';
import { QuizQuestion, CreateQuestionInput } from '../../api/quizzes';

/** Website base/primary colour (tailwind primary-500). */
const BRAND = '#088F8F';

export interface QuestionFormData {
  questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_in_blank';
  questionText: string;
  options: string[];
  /** Multiple-choice: option texts marked correct (supports multi-select). */
  correctAnswers: string[];
  /** true_false / short_answer / fill_in_blank single answer. */
  correctAnswer: string;
  explanation: string;
  points: number;
  shuffleOptions: boolean;
}

export const defaultQuestionForm: QuestionFormData = {
  questionType: 'multiple_choice',
  questionText: '',
  options: ['', '', '', ''],
  correctAnswers: [],
  correctAnswer: '',
  explanation: '',
  points: 1,
  shuffleOptions: false,
};

const toForm = (q: QuizQuestion): QuestionFormData => ({
  questionType: q.questionType,
  questionText: q.questionText,
  options: q.options && q.options.length > 0 ? q.options : ['', '', '', ''],
  correctAnswers:
    q.questionType === 'multiple_choice' ? decodeCorrectAnswers(q.correctAnswer) : [],
  correctAnswer: q.questionType === 'multiple_choice' ? '' : q.correctAnswer || '',
  explanation: q.explanation || '',
  points: q.points,
  shuffleOptions: q.shuffleOptions ?? false,
});

const isHtml = (s: string) => s.trim().startsWith('<');

interface QuizQuestionCardProps {
  question: QuizQuestion;
  index: number;
  total: number;
  /** New draft cards mount directly in edit mode. */
  startInEdit?: boolean;
  isSaving?: boolean;
  onSave: (data: CreateQuestionInput, questionId?: number) => void;
  onDelete: (questionId: number) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  /** Discard an unsaved draft card. */
  onCancelNew?: () => void;
}

export const QuizQuestionCard = ({
  question,
  index,
  total,
  startInEdit = false,
  isSaving = false,
  onSave,
  onDelete,
  onMove,
  onCancelNew,
}: QuizQuestionCardProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const { isDark } = useTheme();
  const [mode, setMode] = useState<'view' | 'edit'>(startInEdit ? 'edit' : 'view');
  const [form, setForm] = useState<QuestionFormData>(() => toForm(question));

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgHover: isDark ? '#374151' : '#f3f4f6',
    bgInput: isDark ? '#374151' : '#ffffff',
  };

  const inputStyle = {
    backgroundColor: colors.bgInput,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.textPrimary,
  };

  const enterEdit = () => {
    setForm(toForm(question));
    setMode('edit');
  };

  const cancel = () => {
    if (startInEdit && onCancelNew) {
      onCancelNew();
      return;
    }
    setForm(toForm(question));
    setMode('view');
  };

  const handleSave = () => {
    const isMc = form.questionType === 'multiple_choice';
    const filteredOptions = form.options.filter(o => o.trim() !== '');
    const data: CreateQuestionInput = {
      questionType: form.questionType,
      questionText: form.questionText.trim(),
      correctAnswer: isMc
        ? encodeCorrectAnswers(form.correctAnswers.filter(a => filteredOptions.includes(a)))
        : form.correctAnswer,
      explanation: form.explanation.trim() || undefined,
      points: form.points,
      shuffleOptions: form.shuffleOptions,
    };
    if (isMc) {
      data.options = filteredOptions;
    }
    onSave(data, startInEdit ? undefined : question.id);
    if (!startInEdit) setMode('view');
  };

  const toggleCorrect = (option: string) => {
    if (!option.trim()) return;
    setForm({
      ...form,
      correctAnswers: form.correctAnswers.includes(option)
        ? form.correctAnswers.filter(a => a !== option)
        : [...form.correctAnswers, option],
    });
  };

  // Option helpers (local until the question is saved). Correct answers are
  // tracked by option text, so keep them in sync on edit / remove.
  const setOption = (i: number, value: string) => {
    const next = [...form.options];
    const prev = next[i];
    next[i] = value;
    setForm({
      ...form,
      options: next,
      correctAnswers: form.correctAnswers.map(a => (a === prev ? value : a)),
    });
  };

  const moveOption = (i: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? i - 1 : i + 1;
    if (target < 0 || target >= form.options.length) return;
    const next = [...form.options];
    [next[i], next[target]] = [next[target], next[i]];
    setForm({ ...form, options: next });
  };

  const removeOption = (i: number) => {
    const removed = form.options[i];
    setForm({
      ...form,
      options: form.options.filter((_, idx) => idx !== i),
      correctAnswers: form.correctAnswers.filter(a => a !== removed),
    });
  };

  const reorderBtn =
    'p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/10';

  /** Correct-answer marker — outline numbered circle, or filled brand
   *  circle with a check when selected (matches the reference design). */
  const CorrectMarker = ({ selected, num }: { selected: boolean; num: number }) => (
    <span
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium"
      style={
        selected
          ? { backgroundColor: BRAND, color: '#ffffff' }
          : { border: `2px solid ${colors.border}`, color: colors.textSecondary }
      }
    >
      {selected ? <Check size={15} strokeWidth={3} /> : num}
    </span>
  );

  /* ---------------------------------- VIEW --------------------------------- */
  if (mode === 'view') {
    return (
      <Card>
        <CardBody>
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <button
                type="button"
                aria-label={t('move_up')}
                title={t('move_up')}
                className={reorderBtn}
                style={{ color: colors.textSecondary }}
                disabled={index === 0}
                onClick={() => onMove(index, 'up')}
              >
                <ChevronUp size={16} />
              </button>
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
                {index + 1}
              </div>
              <button
                type="button"
                aria-label={t('move_down')}
                title={t('move_down')}
                className={reorderBtn}
                style={{ color: colors.textSecondary }}
                disabled={index === total - 1}
                onClick={() => onMove(index, 'down')}
              >
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  {isHtml(question.questionText) ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      style={{ color: colors.textPrimary }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.questionText) }}
                    />
                  ) : (
                    <p className="font-medium break-words" style={{ color: colors.textPrimary }}>
                      {question.questionText}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span
                      className="text-xs px-2 py-1 rounded capitalize"
                      style={{ backgroundColor: colors.bgHover, color: colors.textSecondary }}
                    >
                      {question.questionType.replace('_', ' ')}
                    </span>
                    <span className="text-sm" style={{ color: colors.textSecondary }}>
                      {t('x_points', { count: question.points })}
                    </span>
                  </div>
                  {question.questionType === 'multiple_choice' && question.options && (
                    <div className="mt-3 space-y-1.5">
                      {question.options.map((opt, optIdx) => (
                        <div
                          key={optIdx}
                          className="flex items-center gap-2 text-sm"
                          style={{ color: colors.textSecondary }}
                        >
                          <CorrectMarker
                            selected={decodeCorrectAnswers(question.correctAnswer).includes(opt)}
                            num={optIdx + 1}
                          />
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}
                  {question.questionType === 'true_false' && (
                    <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                      {t('correct_answer_label')}:{' '}
                      <span className="font-medium capitalize">{question.correctAnswer}</span>
                    </p>
                  )}
                  {(question.questionType === 'short_answer' ||
                    question.questionType === 'fill_in_blank') &&
                    question.correctAnswer && (
                      <div className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                        <span className="font-medium">{t('correct_answer_label')}:</span>{' '}
                        {isHtml(question.correctAnswer) ? (
                          <span
                            className="prose prose-sm dark:prose-invert max-w-none inline"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeHtml(question.correctAnswer),
                            }}
                          />
                        ) : (
                          <span className="font-medium">{question.correctAnswer}</span>
                        )}
                      </div>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={t('edit')}
                    title={t('edit')}
                    onClick={enterEdit}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={t('delete')}
                    title={t('delete')}
                    onClick={() => onDelete(question.id)}
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  /* ---------------------------------- EDIT --------------------------------- */
  return (
    <Card>
      <CardBody>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold flex-shrink-0">
              {index + 1}
            </span>
            <div className="w-56">
              <SearchableSelect
                value={form.questionType}
                onChange={(val) =>
                  setForm({
                    ...form,
                    questionType: val as QuestionFormData['questionType'],
                    correctAnswer: '',
                  })
                }
                options={[
                  { value: 'multiple_choice', label: t('multiple_choice') },
                  { value: 'true_false', label: t('true_false') },
                  { value: 'short_answer', label: t('short_answer') },
                  { value: 'fill_in_blank', label: t('fill_in_blank') },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('question_text_label')}
            </label>
            <RichTextEditor
              value={form.questionText}
              onChange={(html) => setForm({ ...form, questionText: html })}
              placeholder={t('question_text_placeholder', { defaultValue: 'Enter your question…' })}
              editorClassName="px-3 py-2 min-h-[120px] max-h-[300px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
            />
          </div>

          {form.questionType === 'multiple_choice' && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('options_click_correct_multi')}
              </label>
              <div className="space-y-2">
                {form.options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(option)}
                      disabled={!option.trim()}
                      title={t('correct_answer_label')}
                      aria-label={t('correct_answer_label')}
                      aria-pressed={form.correctAnswers.includes(option) && !!option}
                      className="disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CorrectMarker
                        selected={form.correctAnswers.includes(option) && !!option}
                        num={idx + 1}
                      />
                    </button>
                    <input
                      value={option}
                      onChange={(e) => setOption(idx, e.target.value)}
                      placeholder={t('option_placeholder', { number: idx + 1 })}
                      className="flex-1 px-3 py-2 rounded-lg text-sm"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      aria-label={t('move_up')}
                      title={t('move_up')}
                      className={reorderBtn}
                      style={{ color: colors.textSecondary }}
                      disabled={idx === 0}
                      onClick={() => moveOption(idx, 'up')}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('move_down')}
                      title={t('move_down')}
                      className={reorderBtn}
                      style={{ color: colors.textSecondary }}
                      disabled={idx === form.options.length - 1}
                      onClick={() => moveOption(idx, 'down')}
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('remove_option')}
                      title={t('remove_option')}
                      onClick={() => removeOption(idx)}
                      disabled={form.options.length <= 2}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, options: [...form.options, ''] })}
                className="mt-2 inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-dashed"
                style={{ borderColor: colors.border, color: colors.textSecondary }}
              >
                <Plus size={14} />
                {t('add_option')}
              </button>
            </div>
          )}

          {form.questionType === 'true_false' && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('correct_answer_label')}
              </label>
              <div className="flex gap-4">
                {['true', 'false'].map((value) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`tf-${question.id}-${index}`}
                      value={value}
                      checked={form.correctAnswer === value}
                      onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                      className="w-4 h-4"
                    />
                    <span style={{ color: colors.textPrimary }} className="capitalize">
                      {value}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {(form.questionType === 'short_answer' || form.questionType === 'fill_in_blank') && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('correct_answer_label')}
              </label>
              <RichTextEditor
                value={form.correctAnswer}
                onChange={(html) => setForm({ ...form, correctAnswer: html })}
                editorClassName="px-3 py-2 min-h-[80px] max-h-[200px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('explanation_label')}
            </label>
            <RichTextEditor
              value={form.explanation}
              onChange={(html) => setForm({ ...form, explanation: html })}
              editorClassName="px-3 py-2 min-h-[80px] max-h-[200px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
            />
          </div>

          {/* Randomize order + points bar */}
          <div
            className="flex flex-wrap items-end gap-6 pt-3 border-t"
            style={{ borderColor: colors.border }}
          >
            <div className="w-64">
              <label className="block text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>
                {t('randomize_order')}
              </label>
              <SearchableSelect
                value={form.shuffleOptions ? 'shuffle' : 'keep'}
                onChange={(val) =>
                  setForm({ ...form, shuffleOptions: val === 'shuffle' })
                }
                options={[
                  { value: 'keep', label: t('keep_choices_order') },
                  { value: 'shuffle', label: t('shuffle_choices') },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>
                {t('mark_as_point', { defaultValue: 'Mark as point' })}
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={inputStyle}
              >
                <input
                  type="number"
                  min="1"
                  value={form.points}
                  onChange={(e) =>
                    setForm({ ...form, points: parseInt(e.target.value) || 1 })
                  }
                  className="w-12 bg-transparent focus:outline-none"
                  style={{ color: colors.textPrimary }}
                />
                <span className="text-sm" style={{ color: colors.textSecondary }}>
                  {t('points_label')}
                </span>
                <span
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#f59e0b' }}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={cancel}>
              {t('common:cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !form.questionText.trim()}
            >
              <Save size={16} />
              {t('common:save')}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
