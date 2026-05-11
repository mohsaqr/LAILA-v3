import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, FileText, Upload, Layers, Bot, Check, Calendar } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { RichTextEditor } from '../forum/RichTextEditor';
import { Button } from '../common/Button';

/**
 * Wrapper that hides the browser's native `datetime-local` chrome
 * (placeholder format, calendar indicator) and instead shows our own
 * label / value. Clicking anywhere on the field opens the native
 * picker via `showPicker()` — the user no longer has to aim for the
 * small calendar icon.
 */
interface DateTimeFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  min?: string;
}

const DateTimeField = ({ value, onChange, placeholder, disabled, min }: DateTimeFieldProps) => {
  const ref = useRef<HTMLInputElement>(null);
  const open = () => {
    if (disabled) return;
    const el = ref.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch { /* fall through to focus */ }
    }
    el.focus();
  };
  const display = value
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  return (
    <div
      onClick={open}
      className={`relative flex items-center justify-between gap-2 w-full px-3 py-2 rounded-xl border bg-white dark:bg-gray-900 transition-colors ${
        disabled
          ? 'border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer focus-within:ring-2 focus-within:ring-offset-1'
      }`}
    >
      <span className={`text-sm truncate ${value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
        {display || placeholder}
      </span>
      <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <input
        ref={ref}
        type="datetime-local"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        aria-label={placeholder}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed [&::-webkit-calendar-picker-indicator]:opacity-0"
      />
    </div>
  );
};

export interface AssignmentWizardFormData {
  title: string;
  description: string;
  submissionType: 'text' | 'file' | 'mixed' | 'ai_agent';
  points: number;
  weight: number;
  dueDate: string;
  gracePeriodDeadline: string;
  isPublished: boolean;
}

interface AssignmentWizardModalProps {
  isOpen: boolean;
  isEdit: boolean;
  courseTitle: string;
  form: AssignmentWizardFormData;
  setForm: (updater: (f: AssignmentWizardFormData) => AssignmentWizardFormData) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const TOTAL_STEPS = 3;
const BRAND = '#088F8F';
const BRAND_LIGHT = '#0d9488';

/**
 * Three-step assignment wizard modal. Same width and height across
 * every step. Bottom progress bar uses the brand teal gradient.
 * Step 1 — type + title, step 2 — description, step 3 — grading,
 * deadlines and publish toggle. Submit lives on step 3.
 */
export const AssignmentWizardModal = ({
  isOpen,
  isEdit,
  courseTitle,
  form,
  setForm,
  isSubmitting,
  onClose,
  onSubmit,
}: AssignmentWizardModalProps) => {
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

  const titleValid = form.title.trim().length > 0;
  const canContinue = step === 1 ? titleValid : true;

  const goNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
  };
  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const submissionTypes: { value: AssignmentWizardFormData['submissionType']; label: string; icon: typeof FileText }[] = [
    { value: 'text',     label: t('text_submission', { defaultValue: 'Text' }),                       icon: FileText },
    { value: 'file',     label: t('file_upload_submission', { defaultValue: 'File upload' }),         icon: Upload },
    { value: 'mixed',    label: t('text_file_submission', { defaultValue: 'Text + File' }),           icon: Layers },
    { value: 'ai_agent', label: t('ai_agent_submission', { defaultValue: 'AI Agent' }),               icon: Bot },
  ];

  const progressPct = (step / TOTAL_STEPS) * 100;

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
          className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col"
          style={{ height: 'min(620px, calc(100vh - 2rem))' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">
                {courseTitle}
              </p>
              <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                {isEdit
                  ? t('edit_assignment', { defaultValue: 'Edit assignment' })
                  : t('add_assignment', { defaultValue: 'New assignment' })}
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

          {/* Step body — fixed scroll area */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {t('wizard_step_assignment_type', { defaultValue: 'What kind of assignment?' })}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('wizard_step_assignment_type_hint', { defaultValue: 'Pick a submission type and give it a clear title.' })}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {t('assignment_title', { defaultValue: 'Title' })}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={t('assignment_title_placeholder', { defaultValue: 'Enter the assignment title' })}
                    className="w-full px-4 py-2.5 text-base rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2"
                    style={{ borderColor: form.title.trim() ? BRAND : undefined }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {t('submission_type', { defaultValue: 'Submission type' })}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {submissionTypes.map(({ value, label, icon: Icon }) => {
                      const selected = form.submissionType === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, submissionType: value }))}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all"
                          style={{
                            backgroundColor: selected ? '#0f172a' : 'transparent',
                            color: selected ? '#ffffff' : '#334155',
                            borderColor: selected ? '#0f172a' : '#cbd5e1',
                          }}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {form.submissionType === 'ai_agent' && (
                    <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl text-sm text-purple-700 dark:text-purple-300">
                      {t('ai_agent_info', { defaultValue: 'Students will be guided by an AI tutor that grades against your rubric.' })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {t('wizard_step_assignment_description', { defaultValue: 'Describe the assignment' })}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('wizard_step_assignment_description_hint', { defaultValue: 'Explain what students need to do, the criteria, and any expectations.' })}
                  </p>
                </div>
                <RichTextEditor
                  value={form.description}
                  onChange={val => setForm(f => ({ ...f, description: val }))}
                  editorClassName="px-3 py-2 min-h-[260px] max-h-[320px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {t('wizard_step_assignment_grading', { defaultValue: 'Grading and deadline' })}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('wizard_step_assignment_grading_hint', { defaultValue: 'Set the points, weight, and when the assignment is due.' })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {t('points_label', { defaultValue: 'Points' })}
                    </label>
                    <input
                      type="number"
                      value={form.points}
                      onChange={e => setForm(f => ({ ...f, points: parseInt(e.target.value) || 0 }))}
                      min={0}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {t('weight_label', { defaultValue: 'Weight' })}
                    </label>
                    <input
                      type="number"
                      value={form.weight}
                      onChange={e => setForm(f => ({ ...f, weight: parseFloat(e.target.value) || 0 }))}
                      min={0}
                      max={10}
                      step={0.1}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {t('due_date_optional', { defaultValue: 'Due date (optional)' })}
                    </label>
                    <DateTimeField
                      value={form.dueDate}
                      onChange={v => setForm(f => ({
                        ...f,
                        dueDate: v,
                        gracePeriodDeadline: v ? f.gracePeriodDeadline : '',
                      }))}
                      placeholder={t('set_a_deadline', { defaultValue: 'Set a deadline' })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {t('courses:grace_period_deadline', { defaultValue: 'Grace period' })}
                    </label>
                    <DateTimeField
                      value={form.gracePeriodDeadline}
                      onChange={v => setForm(f => ({ ...f, gracePeriodDeadline: v }))}
                      placeholder={t('set_a_grace_period', { defaultValue: 'Set a grace period' })}
                      disabled={!form.dueDate}
                      min={form.dueDate || undefined}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('publish_assignment', { defaultValue: 'Publish assignment' })}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t('publish_assignment_hint', { defaultValue: 'Make it visible to enrolled students immediately.' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.isPublished}
                    onClick={() => setForm(f => ({ ...f, isPublished: !f.isPublished }))}
                    className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      backgroundColor: form.isPublished ? BRAND : '#cbd5e1',
                    }}
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
          </div>

          {/* Progress bar — brand teal gradient. Sits above the footer
              so it reads as the visual transition between body and CTA. */}
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
              {t('wizard_step_n_of_m', { defaultValue: 'Step {{n}} of {{m}}', n: step, m: TOTAL_STEPS })}
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
              {step < TOTAL_STEPS ? (
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
                  disabled={!titleValid}
                  icon={<Check className="w-4 h-4" />}
                >
                  {isEdit
                    ? t('common:update', { defaultValue: 'Update' })
                    : t('common:create', { defaultValue: 'Create assignment' })}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
