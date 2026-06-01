import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Check, FileText, Layers, Video, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Button } from '../common/Button';
import { LessonEditor } from './lesson-editor';
import type { LectureSection } from '../../types';

export type LessonContentType = 'text' | 'video' | 'mixed';

export interface LessonWizardFormData {
  title: string;
  contentType: LessonContentType;
  duration: number;
  isFree: boolean;
}

interface LessonWizardModalProps {
  isOpen: boolean;
  isEdit: boolean;
  courseTitle: string;
  /** When set the wizard skips its create call and goes straight to the
   *  content editor on Step 2. Drives autosave inside LessonEditor. */
  lectureId: number | null;
  initialSections: LectureSection[];
  form: LessonWizardFormData;
  setForm: (updater: (f: LessonWizardFormData) => LessonWizardFormData) => void;
  isSubmittingStep1: boolean;
  /** Persists the Step 1 metadata. For new lessons this should also
   *  CREATE the lecture and let the parent provide `lectureId` so Step
   *  2 can open the LessonEditor against that ID. */
  onSubmitStep1: () => Promise<void> | void;
  onClose: () => void;
}

const TOTAL_STEPS = 2;
const BRAND = '#088F8F';
const BRAND_LIGHT = '#0d9488';

const typeIconFor = (t: LessonContentType) =>
  t === 'video' ? Video : t === 'mixed' ? Layers : FileText;

/**
 * Two-step modal for creating or editing a lesson. Wide and tall so
 * Step 2's rich-text editor reads as the full content workspace.
 *
 *   Step 1 — title, type (text / video / text+video), duration
 *   Step 2 — LessonEditor canvas (file + chatbot insertable, autosaves)
 *
 * Continue on step 1 calls onSubmitStep1 — the parent CREATES the
 * lecture (or UPDATES it on edit), then either passes the new
 * `lectureId` down so Step 2 can autosave, or surfaces an error.
 */
export const LessonWizardModal = ({
  isOpen,
  isEdit,
  courseTitle,
  lectureId,
  initialSections,
  form,
  setForm,
  isSubmittingStep1,
  onSubmitStep1,
  onClose,
}: LessonWizardModalProps) => {
  const { t } = useTranslation(['teaching', 'common']);
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

  const handleNext = async () => {
    if (step === 1) {
      await onSubmitStep1();
      // The parent flips `lectureId` once the create / update mutation
      // resolves; advance the wizard unconditionally — the parent will
      // close it on error.
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const types: {
    value: LessonContentType;
    label: string;
    description: string;
  }[] = [
    {
      value: 'text',
      label: t('teaching:lesson_type_text', { defaultValue: 'Text' }),
      description: t('teaching:lesson_type_text_hint', {
        defaultValue: 'Reading-only lesson with rich text and embeds.',
      }),
    },
    {
      value: 'video',
      label: t('teaching:lesson_type_video', { defaultValue: 'Video' }),
      description: t('teaching:lesson_type_video_hint', {
        defaultValue: 'Single video plus optional notes.',
      }),
    },
    {
      value: 'mixed',
      label: t('teaching:lesson_type_mixed', { defaultValue: 'Text + Video' }),
      description: t('teaching:lesson_type_mixed_hint', {
        defaultValue: 'Mix of written content and embedded videos.',
      }),
    },
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
          className="relative w-full max-w-5xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col"
          style={{ height: 'min(820px, calc(100vh - 2rem))' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">
                {courseTitle}
              </p>
              <h3
                id={titleId}
                className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5"
              >
                {isEdit
                  ? t('teaching:edit_lesson', { defaultValue: 'Edit lesson' })
                  : t('teaching:create_lesson', { defaultValue: 'Create Lesson' })}
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
              <div className="space-y-6 max-w-3xl">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {t('teaching:lesson_title', { defaultValue: 'Title' })}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={form.title}
                    onChange={e =>
                      setForm(f => ({ ...f, title: e.target.value }))
                    }
                    placeholder={t('teaching:lesson_title_placeholder', {
                      defaultValue: 'e.g., Active Learning: Engaging Students',
                    })}
                    className="w-full px-4 py-2.5 text-base rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2"
                    style={{ borderColor: titleValid ? BRAND : undefined }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {t('teaching:lesson_type', { defaultValue: 'Type' })}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {types.map(opt => {
                      const Icon = typeIconFor(opt.value);
                      const selected = form.contentType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setForm(f => ({ ...f, contentType: opt.value }))
                          }
                          className="flex items-start gap-2 p-3 text-left rounded-xl border-2 transition-all"
                          style={{
                            borderColor: selected ? BRAND : '#e5e7eb',
                            backgroundColor: selected
                              ? 'rgba(8,143,143,0.08)'
                              : 'transparent',
                          }}
                        >
                          <span
                            className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                            style={{
                              backgroundColor: selected ? BRAND : '#f3f4f6',
                              color: selected ? '#ffffff' : '#6b7280',
                            }}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {opt.label}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {opt.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {t('teaching:duration_minutes', {
                      defaultValue: 'Duration (minutes)',
                    })}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.duration}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        duration: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-32 px-4 py-2.5 text-base rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                {lectureId ? (
                  <LessonEditor
                    lectureId={lectureId}
                    initialSections={initialSections}
                  />
                ) : (
                  <p className="text-sm text-amber-600 dark:text-amber-400 italic">
                    {t('teaching:lesson_save_first', {
                      defaultValue:
                        'Save the lesson basics first to begin editing content.',
                    })}
                  </p>
                )}
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
              {t('teaching:wizard_step_n_of_m', {
                defaultValue: 'Step {{n}} of {{m}}',
                n: step,
                m: TOTAL_STEPS,
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={step === 1 ? onClose : handleBack}
              >
                {step === 1
                  ? t('common:cancel', { defaultValue: 'Cancel' })
                  : t('common:back', { defaultValue: 'Back' })}
              </Button>
              {step < TOTAL_STEPS ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  loading={isSubmittingStep1}
                  disabled={!canContinue || isSubmittingStep1}
                >
                  {t('common:continue', { defaultValue: 'Continue' })}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={onClose}
                  icon={isEdit ? <Check className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                >
                  {t('common:done', { defaultValue: 'Done' })}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
