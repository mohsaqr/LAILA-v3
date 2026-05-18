import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, CheckCircle, Trash2, Plus } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { RichTextEditor } from '../forum/RichTextEditor';
import { Button } from '../common/Button';
import { SearchableSelect } from '../common/SearchableSelect';

export type QuizQuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'fill_in_blank';

export interface QuizQuestionFormData {
  /** Present only for questions already persisted (edit mode). */
  id?: number;
  questionType: QuizQuestionType;
  questionText: string;
  /** Always length-4 for multiple_choice, ignored otherwise. */
  options: string[];
  /** For multiple_choice only: indexes into `options` marked as correct.
   * Tracking by index (not text) lets two options that share a string be
   * distinguished, and supports multiple correct answers. */
  correctIndexes: number[];
  /** For true_false / short_answer / fill_in_blank. Ignored for MC. */
  correctAnswer: string;
  explanation: string;
  points: number;
}

export interface QuizWizardFormData {
  title: string;
  description: string;
  instructions: string;
  /** Stored as strings to mirror the existing input controls. */
  timeLimit: string;
  maxAttempts: string;
  passingScore: string;
  isPublished: boolean;
  questions: QuizQuestionFormData[];
}

interface QuizWizardModalProps {
  isOpen: boolean;
  isEdit: boolean;
  courseTitle: string;
  form: QuizWizardFormData;
  setForm: (updater: (f: QuizWizardFormData) => QuizWizardFormData) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const BRAND = '#088F8F';
const BRAND_LIGHT = '#0d9488';

export const blankQuestion = (): QuizQuestionFormData => ({
  questionType: 'multiple_choice',
  questionText: '',
  options: ['', '', '', ''],
  correctIndexes: [],
  correctAnswer: '',
  explanation: '',
  points: 1,
});

const isQuestionValid = (q: QuizQuestionFormData): boolean => {
  if (!q.questionText.trim()) return false;
  if (q.questionType === 'multiple_choice') {
    const nonEmpty = q.options.map(o => o.trim()).filter(Boolean);
    if (nonEmpty.length < 2) return false;
    if (q.correctIndexes.length === 0) return false;
    return q.correctIndexes.every(i => !!q.options[i]?.trim());
  }
  if (q.questionType === 'true_false') {
    return q.correctAnswer === 'true' || q.correctAnswer === 'false';
  }
  return q.correctAnswer.trim().length > 0;
};

/**
 * Two fixed steps (details, settings) followed by one page per question.
 * Mirrors AssignmentWizardModal: same dimensions, header, footer, progress
 * bar, focus trap, ESC handler, body-scroll lock. Submit fires on the
 * last question page once every question validates.
 */
export const QuizWizardModal = ({
  isOpen,
  isEdit,
  courseTitle,
  form,
  setForm,
  isSubmitting,
  onClose,
  onSubmit,
}: QuizWizardModalProps) => {
  const { t } = useTranslation(['teaching', 'common', 'courses']);
  const focusRef = useFocusTrap(isOpen);
  const titleId = useId();
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (isOpen) setStep(1);
  }, [isOpen]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', onEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const questionCount = Math.max(1, form.questions.length);
  const totalSteps = 2 + questionCount;
  const titleValid = form.title.trim().length > 0;

  // Current question index when on a question step (0-based).
  const questionIndex = step >= 3 ? step - 3 : -1;
  const currentQuestion: QuizQuestionFormData | null =
    questionIndex >= 0 ? form.questions[questionIndex] ?? null : null;
  const currentQuestionValid = currentQuestion ? isQuestionValid(currentQuestion) : false;
  const allQuestionsValid =
    form.questions.length > 0 && form.questions.every(isQuestionValid);

  const canContinue =
    step === 1 ? titleValid
    : step === 2 ? true
    : currentQuestionValid;

  const canSubmit = titleValid && allQuestionsValid;

  const goNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };
  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const updateQuestion = (idx: number, patch: Partial<QuizQuestionFormData>) => {
    setForm(f => ({
      ...f,
      questions: f.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    }));
  };

  const addQuestion = () => {
    setForm(f => ({ ...f, questions: [...f.questions, blankQuestion()] }));
    // Advance to the new question page.
    setStep(2 + form.questions.length + 1);
  };

  const removeCurrentQuestion = () => {
    if (questionIndex < 0) return;
    const idx = questionIndex;
    setForm(f => {
      const next = f.questions.filter((_, i) => i !== idx);
      return {
        ...f,
        questions: next.length === 0 ? [blankQuestion()] : next,
      };
    });
    // Step back if we just deleted the last page.
    if (idx === form.questions.length - 1 && idx > 0) {
      setStep(s => s - 1);
    }
  };

  const progressPct = (step / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        <div
          ref={focusRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative w-full max-w-5xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col"
          style={{ height: 'min(820px, calc(100vh - 2rem))' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">
                {courseTitle}
              </p>
              <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                {isEdit
                  ? t('edit_quiz', { defaultValue: 'Edit quiz' })
                  : t('create_quiz', { defaultValue: 'Create Quiz' })}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common:close', { defaultValue: 'Close' })}
              className="p-1.5 -mr-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {t('quiz_title', { defaultValue: 'Title' })}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={t('quiz_title_placeholder', { defaultValue: 'Enter the quiz title' })}
                    className="w-full px-4 py-2.5 text-base rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2"
                    style={{ borderColor: form.title.trim() ? BRAND : undefined }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {t('quiz_description', { defaultValue: 'Description' })}
                  </label>
                  <RichTextEditor
                    value={form.description}
                    onChange={val => setForm(f => ({ ...f, description: val }))}
                    editorClassName="px-3 py-2 min-h-[120px] max-h-[180px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {t('quiz_instructions', { defaultValue: 'Instructions' })}
                  </label>
                  <RichTextEditor
                    value={form.instructions}
                    onChange={val => setForm(f => ({ ...f, instructions: val }))}
                    editorClassName="px-3 py-2 min-h-[100px] max-h-[160px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {t('time_limit_minutes', { defaultValue: 'Time limit (min)' })}
                    </label>
                    <input
                      type="number"
                      value={form.timeLimit}
                      min={0}
                      onChange={e => setForm(f => ({ ...f, timeLimit: e.target.value }))}
                      placeholder={t('no_limit', { defaultValue: 'No limit' })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {t('max_attempts', { defaultValue: 'Max attempts' })}
                    </label>
                    <input
                      type="number"
                      value={form.maxAttempts}
                      min={0}
                      onChange={e => setForm(f => ({ ...f, maxAttempts: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {t('passing_score', { defaultValue: 'Passing score' })}
                    </label>
                    <input
                      type="number"
                      value={form.passingScore}
                      min={0}
                      max={100}
                      onChange={e => setForm(f => ({ ...f, passingScore: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('publish_quiz', { defaultValue: 'Publish quiz' })}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t('publish_quiz_hint', { defaultValue: 'Make it visible to enrolled students immediately.' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.isPublished}
                    onClick={() => setForm(f => ({ ...f, isPublished: !f.isPublished }))}
                    className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{ backgroundColor: form.isPublished ? BRAND : '#cbd5e1' }}
                  >
                    <span
                      className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                      style={{
                        transform: form.isPublished ? 'translateX(22px)' : 'translateX(2px)',
                        marginTop: '2px',
                      }}
                    />
                  </button>
                </div>
              </div>
            )}

            {currentQuestion && questionIndex >= 0 && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                      {t('quiz_question_x_of_y', {
                        defaultValue: 'Question {{n}} of {{m}}',
                        n: questionIndex + 1,
                        m: form.questions.length,
                      })}
                    </h4>
                  </div>
                  {form.questions.length > 1 && (
                    <button
                      type="button"
                      onClick={removeCurrentQuestion}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('remove_this_question', { defaultValue: 'Remove' })}
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {t('question_type_label', { defaultValue: 'Question type' })}
                  </label>
                  <SearchableSelect
                    value={currentQuestion.questionType}
                    onChange={val => {
                      const next = val as QuizQuestionType;
                      updateQuestion(questionIndex, {
                        questionType: next,
                        correctAnswer: '',
                        correctIndexes: [],
                        options: next === 'multiple_choice' ? ['', '', '', ''] : currentQuestion.options,
                      });
                    }}
                    options={[
                      { value: 'multiple_choice', label: t('multiple_choice', { defaultValue: 'Multiple choice' }) },
                      { value: 'true_false',     label: t('true_false',     { defaultValue: 'True / False' }) },
                      { value: 'short_answer',   label: t('short_answer',   { defaultValue: 'Short answer' }) },
                      { value: 'fill_in_blank',  label: t('fill_in_blank',  { defaultValue: 'Fill in the blank' }) },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {t('question_text_label', { defaultValue: 'Question text' })}
                  </label>
                  <textarea
                    value={currentQuestion.questionText}
                    onChange={e => updateQuestion(questionIndex, { questionText: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                  />
                </div>

                {currentQuestion.questionType === 'multiple_choice' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {t('options_click_correct_multi', { defaultValue: 'Options — click the circle to mark each correct one (you can pick more than one)' })}
                    </label>
                    <div className="space-y-2">
                      {currentQuestion.options.map((opt, oi) => {
                        const isCorrect = currentQuestion.correctIndexes.includes(oi);
                        return (
                          <div key={oi} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const set = new Set(currentQuestion.correctIndexes);
                                if (set.has(oi)) set.delete(oi);
                                else set.add(oi);
                                updateQuestion(questionIndex, {
                                  correctIndexes: Array.from(set).sort((a, b) => a - b),
                                });
                              }}
                              disabled={!opt.trim()}
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{
                                backgroundColor: isCorrect ? '#22c55e' : '#e5e7eb',
                                color: isCorrect ? '#ffffff' : '#6b7280',
                              }}
                              aria-label={t('mark_as_correct', { defaultValue: 'Mark as correct' })}
                              aria-pressed={isCorrect}
                            >
                              {isCorrect ? <CheckCircle className="w-4 h-4" /> : oi + 1}
                            </button>
                            <input
                              value={opt}
                              onChange={e => {
                                const newOptions = [...currentQuestion.options];
                                newOptions[oi] = e.target.value;
                                // If the option emptied, drop it from correctIndexes.
                                const stillCorrect = e.target.value.trim()
                                  ? currentQuestion.correctIndexes
                                  : currentQuestion.correctIndexes.filter(i => i !== oi);
                                updateQuestion(questionIndex, {
                                  options: newOptions,
                                  correctIndexes: stillCorrect,
                                });
                              }}
                              placeholder={t('option_placeholder', { number: oi + 1, defaultValue: `Option ${oi + 1}` })}
                              className="flex-1 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {currentQuestion.questionType === 'true_false' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {t('correct_answer_label', { defaultValue: 'Correct answer' })}
                    </label>
                    <div className="flex gap-2">
                      {(['true', 'false'] as const).map(v => {
                        const selected = currentQuestion.correctAnswer === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => updateQuestion(questionIndex, { correctAnswer: v })}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all capitalize"
                            style={{
                              backgroundColor: selected ? '#0f172a' : 'transparent',
                              color: selected ? '#ffffff' : '#334155',
                              borderColor: selected ? '#0f172a' : '#cbd5e1',
                            }}
                          >
                            {t(v, { defaultValue: v })}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(currentQuestion.questionType === 'short_answer' ||
                  currentQuestion.questionType === 'fill_in_blank') && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {t('correct_answer_label', { defaultValue: 'Correct answer' })}
                    </label>
                    <input
                      type="text"
                      value={currentQuestion.correctAnswer}
                      onChange={e => updateQuestion(questionIndex, { correctAnswer: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {t('explanation_label', { defaultValue: 'Explanation (optional)' })}
                    </label>
                    <input
                      type="text"
                      value={currentQuestion.explanation}
                      onChange={e => updateQuestion(questionIndex, { explanation: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {t('points_label', { defaultValue: 'Points' })}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={currentQuestion.points}
                      onChange={e => updateQuestion(questionIndex, { points: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 mx-6 mb-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full transition-all duration-300 ease-out"
              style={{
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, ${BRAND} 0%, ${BRAND_LIGHT} 100%)`,
              }}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('wizard_step_n_of_m', {
                defaultValue: 'Step {{n}} of {{m}}',
                n: step,
                m: totalSteps,
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={step === 1 ? onClose : goBack}
              >
                {step === 1
                  ? t('common:cancel', { defaultValue: 'Cancel' })
                  : t('common:back', { defaultValue: 'Back' })}
              </Button>

              {step >= 3 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addQuestion}
                  disabled={!currentQuestionValid}
                  icon={<Plus className="w-4 h-4" />}
                >
                  {t('add_another_question', { defaultValue: 'Add question' })}
                </Button>
              )}

              {step < totalSteps ? (
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={!canContinue}
                >
                  {t('common:continue', { defaultValue: 'Continue' })}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={onSubmit}
                  loading={isSubmitting}
                  disabled={!canSubmit}
                  icon={<Check className="w-4 h-4" />}
                >
                  {isEdit
                    ? t('common:update', { defaultValue: 'Update quiz' })
                    : t('common:create', { defaultValue: 'Create quiz' })}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
