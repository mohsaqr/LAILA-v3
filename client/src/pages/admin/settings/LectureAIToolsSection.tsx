import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { llmApi, LectureAiPolicy } from '../../../api/admin';
import { Button } from '../../../components/common/Button';
import { Toggle } from '../../../components/common/Toggle';

/**
 * Which lectures offer the AI study tools (Explain / Discuss / Practice).
 *
 * The tools can only work where the server can read the material, and it can
 * read text pages and PDFs — there is no reader for video, slide decks,
 * spreadsheets or the files embedded inside a page. So the unsupported options
 * are listed here and **rendered disabled**: an admin can see the full shape of
 * the setting and what it will grow into, without being able to switch on
 * something that would give students buttons with no content behind them.
 *
 * The server enforces the same narrowing, so a hand-edited settings row cannot
 * widen it either.
 */

interface Option {
  value: string;
  labelKey: string;
  labelFallback: string;
  /** Absent when an extractor exists. Present ones render greyed. */
  unsupportedKey?: string;
  unsupportedFallback?: string;
}

const NOT_SUPPORTED = {
  unsupportedKey: 'lecture_ai_not_supported',
  unsupportedFallback: 'Not supported yet',
} as const;

const NO_EXTRACTOR = {
  unsupportedKey: 'lecture_ai_no_extractor',
  unsupportedFallback: 'No text extractor',
} as const;

const RESOURCE_KIND_OPTIONS: Option[] = [
  { value: 'page', labelKey: 'lecture_ai_kind_page', labelFallback: 'Text page' },
  { value: 'file', labelKey: 'lecture_ai_kind_file', labelFallback: 'Uploaded file' },
  { value: 'video', labelKey: 'lecture_ai_kind_video', labelFallback: 'Video', ...NOT_SUPPORTED },
  { value: 'url', labelKey: 'lecture_ai_kind_url', labelFallback: 'Link', ...NOT_SUPPORTED },
  { value: 'embed', labelKey: 'lecture_ai_kind_embed', labelFallback: 'Embed', ...NOT_SUPPORTED },
  { value: 'folder', labelKey: 'lecture_ai_kind_folder', labelFallback: 'Folder', ...NOT_SUPPORTED },
  { value: 'image', labelKey: 'lecture_ai_kind_image', labelFallback: 'Image', ...NOT_SUPPORTED },
  { value: 'chatbot', labelKey: 'lecture_ai_kind_chatbot', labelFallback: 'Chatbot', ...NOT_SUPPORTED },
];

const FILE_EXTENSION_OPTIONS: Option[] = [
  { value: 'pdf', labelKey: 'lecture_ai_ext_pdf', labelFallback: 'PDF' },
  { value: 'docx', labelKey: 'lecture_ai_ext_docx', labelFallback: 'Word (.docx)', ...NO_EXTRACTOR },
  { value: 'pptx', labelKey: 'lecture_ai_ext_pptx', labelFallback: 'PowerPoint (.pptx)', ...NO_EXTRACTOR },
  { value: 'txt', labelKey: 'lecture_ai_ext_txt', labelFallback: 'Plain text (.txt)', ...NO_EXTRACTOR },
  { value: 'md', labelKey: 'lecture_ai_ext_md', labelFallback: 'Markdown (.md)', ...NO_EXTRACTOR },
  { value: 'csv', labelKey: 'lecture_ai_ext_csv', labelFallback: 'CSV', ...NO_EXTRACTOR },
  { value: 'xlsx', labelKey: 'lecture_ai_ext_xlsx', labelFallback: 'Excel (.xlsx)', ...NO_EXTRACTOR },
];

/**
 * A checkbox list in the option-card style this project already uses for
 * single-choice settings. There is no shared multi-select component; this is
 * the smaller of the two things worth building.
 */
const OptionCheckboxList = ({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) => {
  const { t } = useTranslation(['admin']);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]
    );
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map(option => {
        const unsupported = !!option.unsupportedKey;
        // The master toggle greys everything; an unsupported option is greyed
        // regardless, because no setting can make it work.
        const isDisabled = unsupported || disabled;
        const isChecked = selected.includes(option.value);

        return (
          <label
            key={option.value}
            className={`flex items-start gap-2 rounded-lg border p-3 transition-colors ${
              isDisabled
                ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-900'
                : isChecked
                  ? 'cursor-pointer border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
                  : 'cursor-pointer border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800'
            }`}
          >
            <input
              type="checkbox"
              checked={isChecked}
              disabled={isDisabled}
              onChange={() => toggle(option.value)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                {t(option.labelKey, { defaultValue: option.labelFallback })}
              </span>
              {unsupported && (
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {t(option.unsupportedKey!, { defaultValue: option.unsupportedFallback! })}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
};

export const LectureAIToolsSection = () => {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();

  const { data: policy, isLoading } = useQuery({
    queryKey: ['lectureAiPolicy'],
    queryFn: () => llmApi.getLectureAiPolicy(),
  });

  const [draft, setDraft] = useState<LectureAiPolicy | null>(null);

  // Adopt the saved policy once it arrives, or the form would show defaults
  // over a configured value and saving would overwrite it.
  useEffect(() => {
    if (policy) setDraft(policy);
  }, [policy]);

  const saveMutation = useMutation({
    mutationFn: (next: LectureAiPolicy) => llmApi.setLectureAiPolicy(next),
    onSuccess: saved => {
      // Take the server's normalised answer rather than the draft: it drops
      // anything it will not honour, and the form should show what is stored.
      setDraft(saved);
      queryClient.invalidateQueries({ queryKey: ['lectureAiPolicy'] });
      toast.success(t('lecture_ai_saved', { defaultValue: 'AI study tool settings saved' }));
    },
    onError: (error: any) => toast.error(error?.message || t('failed_to_save')),
  });

  if (isLoading || !draft || !policy) return null;

  const isDirty = JSON.stringify(draft) !== JSON.stringify(policy);
  const patch = (changes: Partial<LectureAiPolicy>) => setDraft({ ...draft, ...changes });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t('lecture_ai_title', { defaultValue: 'AI study tools on lectures' })}
        </h3>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('lecture_ai_intro', {
          defaultValue:
            'Explain, Discuss and Practice appear under a lecture only when the AI can read all of it. Everywhere else they are shown disabled with a reason.',
        })}
      </p>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {t('lecture_ai_enabled', { defaultValue: 'Offer the AI study tools' })}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('lecture_ai_enabled_desc', {
              defaultValue: 'Turn off to hide Explain, Discuss and Practice from every lecture.',
            })}
          </p>
        </div>
        <Toggle checked={draft.enabled} onChange={value => patch({ enabled: value })} />
      </div>

      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t('lecture_ai_resource_kinds', { defaultValue: 'Content the tools may use' })}
        </p>
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          {t('lecture_ai_resource_kinds_desc', {
            defaultValue:
              'A lecture qualifies only when every part of it is ticked here. Greyed options have no reader yet.',
          })}
        </p>
        <OptionCheckboxList
          options={RESOURCE_KIND_OPTIONS}
          selected={draft.resourceKinds}
          onChange={values => patch({ resourceKinds: values })}
          disabled={!draft.enabled}
        />
      </div>

      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t('lecture_ai_file_types', { defaultValue: 'File types the tools may read' })}
        </p>
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          {t('lecture_ai_file_types_desc', {
            defaultValue:
              'Applies when uploaded files are ticked above. A lecture may carry at most one PDF.',
          })}
        </p>
        <OptionCheckboxList
          options={FILE_EXTENSION_OPTIONS}
          selected={draft.fileExtensions}
          onChange={values => patch({ fileExtensions: values })}
          disabled={!draft.enabled || !draft.resourceKinds.includes('file')}
        />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(draft)}
          disabled={saveMutation.isPending || !isDirty}
        >
          {t('common:save')}
        </Button>
      </div>
    </div>
  );
};
