import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, MessageSquare, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { RichTextEditor } from '../forum/RichTextEditor';
import { Button } from '../common/Button';

export interface ForumWizardFormData {
  title: string;
  content: string;
  isPublished: boolean;
  allowAnonymous: boolean;
}

interface ForumWizardModalProps {
  isOpen: boolean;
  isEdit: boolean;
  courseTitle: string;
  form: ForumWizardFormData;
  setForm: (updater: (f: ForumWizardFormData) => ForumWizardFormData) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const TOTAL_STEPS = 2;
const BRAND = '#088F8F';
const BRAND_LIGHT = '#0d9488';

/**
 * Three-step modal for creating or editing a forum discussion. Mirrors
 * AssignmentWizardModal / QuizWizardModal: same dimensions, header,
 * footer, brand-teal progress bar, focus trap, ESC + body-scroll lock.
 *
 *   Step 1 — title + rich-text content
 *   Step 2 — settings (publish + allow-anonymous-replies)
 *
 * Submit fires on step 2 once title and content are non-empty.
 */
export const ForumWizardModal = ({
  isOpen,
  isEdit,
  courseTitle,
  form,
  setForm,
  isSubmitting,
  onClose,
  onSubmit,
}: ForumWizardModalProps) => {
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
  // Strip tags + nbsp to detect actually-empty rich-text content
  const contentText = form.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
  const contentValid = contentText.length > 0;
  const canContinue = step === 1 ? (titleValid && contentValid) : true;
  const canSubmit = titleValid && contentValid;

  const goNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
  };
  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

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
              <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                {isEdit
                  ? t('teaching:edit_forum', { defaultValue: 'Edit forum' })
                  : t('teaching:create_forum', { defaultValue: 'Create Forum' })}
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
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {t('teaching:forum_title_label', { defaultValue: 'Title' })}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={t('teaching:forum_title_placeholder', {
                      defaultValue: 'e.g., Discuss: Your Teaching Philosophy',
                    })}
                    className="w-full px-4 py-2.5 text-base rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2"
                    style={{ borderColor: titleValid ? BRAND : undefined }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {t('teaching:forum_description_label', { defaultValue: 'Description' })}
                  </label>
                  <RichTextEditor
                    value={form.content}
                    onChange={val => setForm(f => ({ ...f, content: val }))}
                    editorClassName="px-3 py-2 min-h-[260px] max-h-[320px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">

                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('teaching:publish_forum', { defaultValue: 'Publish forum' })}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t('teaching:publish_forum_hint', {
                        defaultValue: 'Make it visible to enrolled students immediately.',
                      })}
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

                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('teaching:allow_anonymous_replies', {
                        defaultValue: 'Allow anonymous replies',
                      })}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t('teaching:allow_anonymous_replies_hint', {
                        defaultValue: 'Students may post replies without revealing their name.',
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.allowAnonymous}
                    onClick={() => setForm(f => ({ ...f, allowAnonymous: !f.allowAnonymous }))}
                    className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{ backgroundColor: form.allowAnonymous ? BRAND : '#cbd5e1' }}
                  >
                    <span
                      className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                      style={{
                        transform: form.allowAnonymous ? 'translateX(22px)' : 'translateX(2px)',
                        marginTop: '2px',
                      }}
                    />
                  </button>
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
                onClick={step === 1 ? onClose : goBack}
              >
                {step === 1
                  ? t('common:cancel', { defaultValue: 'Cancel' })
                  : t('common:back', { defaultValue: 'Back' })}
              </Button>
              {step < TOTAL_STEPS ? (
                <Button type="button" onClick={goNext} disabled={!canContinue}>
                  {t('common:continue', { defaultValue: 'Continue' })}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={onSubmit}
                  loading={isSubmitting}
                  disabled={!canSubmit}
                  icon={isEdit ? <Check className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                >
                  {isEdit
                    ? t('common:update', { defaultValue: 'Update' })
                    : t('common:create', { defaultValue: 'Create forum' })}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
