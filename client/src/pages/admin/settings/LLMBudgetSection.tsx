import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Gauge, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { llmApi, LLMBudgetCaps } from '../../../api/admin';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';

/**
 * Token caps and this month's spend.
 *
 * Every field is blank by default and blank means **no limit** — nothing here
 * changes what the platform does until an admin types a number in. That is why
 * the inputs are strings rather than numbers: '' is a meaningful value that
 * clears a cap, and a controlled numeric input cannot express it.
 */

const CAP_FIELDS: Array<{ key: keyof LLMBudgetCaps; labelKey: string; helpKey: string }> = [
  { key: 'userMonthly', labelKey: 'llm_cap_user', helpKey: 'llm_cap_user_help' },
  { key: 'courseMonthly', labelKey: 'llm_cap_course', helpKey: 'llm_cap_course_help' },
  { key: 'globalMonthly', labelKey: 'llm_cap_global', helpKey: 'llm_cap_global_help' },
  { key: 'maxOutputPerCall', labelKey: 'llm_cap_per_call', helpKey: 'llm_cap_per_call_help' },
];

/** Blank stays blank; a number becomes its own text. */
const toField = (n: number | null): string => (n == null ? '' : String(n));

const fmtTokens = (n: number): string => n.toLocaleString();

/**
 * Cost is null whenever the models involved have no prices configured — local
 * models have none, and most rows are simply unset. Rendering that as $0.00
 * would understate the bill in the very panel meant to reveal it.
 */
const fmtCost = (n: number | null, unknown: string): string =>
  n == null ? unknown : `$${n.toFixed(2)}`;

export const LLMBudgetSection = () => {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();

  const { data: budget, isLoading } = useQuery({
    queryKey: ['llmBudget'],
    queryFn: () => llmApi.getBudget(),
  });

  const { data: topSpenders } = useQuery({
    queryKey: ['llmTopSpenders'],
    queryFn: () => llmApi.getTopSpenders(10),
  });

  const [fields, setFields] = useState<Record<keyof LLMBudgetCaps, string>>({
    userMonthly: '',
    courseMonthly: '',
    globalMonthly: '',
    maxOutputPerCall: '',
  });

  // Seed the form once the saved caps arrive. Without this the inputs would
  // show blank over a configured cap, and saving would silently clear it.
  useEffect(() => {
    if (!budget) return;
    setFields({
      userMonthly: toField(budget.caps.userMonthly),
      courseMonthly: toField(budget.caps.courseMonthly),
      globalMonthly: toField(budget.caps.globalMonthly),
      maxOutputPerCall: toField(budget.caps.maxOutputPerCall),
    });
  }, [budget]);

  const saveMutation = useMutation({
    mutationFn: () =>
      llmApi.setBudget({
        userMonthly: fields.userMonthly === '' ? null : Number(fields.userMonthly),
        courseMonthly: fields.courseMonthly === '' ? null : Number(fields.courseMonthly),
        globalMonthly: fields.globalMonthly === '' ? null : Number(fields.globalMonthly),
        maxOutputPerCall: fields.maxOutputPerCall === '' ? null : Number(fields.maxOutputPerCall),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmBudget'] });
      toast.success(t('llm_caps_saved', { defaultValue: 'Token caps saved' }));
    },
    onError: (error: any) => toast.error(error?.message || t('failed_to_save')),
  });

  if (isLoading || !budget) return null;

  const globalCap = budget.caps.globalMonthly;
  const percentOfGlobal = globalCap ? budget.totalTokens / globalCap : null;
  const unknownCost = t('llm_cost_unknown', { defaultValue: 'n/a' });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Gauge className="w-5 h-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t('llm_caps_title', { defaultValue: 'Token caps and usage' })}
        </h3>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('llm_caps_intro', {
          defaultValue:
            'Leave a field empty for no limit. Caps count tokens per calendar month and reset automatically.',
        })}
      </p>

      {/* This month */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          label={t('llm_usage_tokens', { defaultValue: 'Tokens this month' })}
          value={fmtTokens(budget.totalTokens)}
          sub={globalCap ? t('llm_usage_of_cap', {
            defaultValue: `of ${fmtTokens(globalCap)}`,
            cap: fmtTokens(globalCap),
          }) : undefined}
        />
        <Stat
          label={t('llm_usage_cost', { defaultValue: 'Estimated cost' })}
          value={fmtCost(budget.totalCostUsd, unknownCost)}
          sub={t('llm_usage_cost_note', {
            defaultValue: 'Only models with prices configured',
          })}
        />
        <Stat
          label={t('llm_usage_calls', { defaultValue: 'Calls' })}
          value={fmtTokens(budget.calls)}
        />
      </div>

      {percentOfGlobal != null && percentOfGlobal >= 0.8 && (
        <div className="flex items-start gap-2 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm">
            {t('llm_cap_near_limit', {
              defaultValue: `The platform has used ${Math.round(percentOfGlobal * 100)}% of its monthly allowance.`,
              percent: Math.round(percentOfGlobal * 100),
            })}
          </p>
        </div>
      )}

      {/* Where it went. Surfaced because two code paths still reach a provider
          without going through the unified LLM service, and that share is worth
          seeing rather than assuming. */}
      {budget.bySource.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('llm_usage_by_source', { defaultValue: 'By code path' })}
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <tbody>
                {budget.bySource.map(row => (
                  <tr key={row.source} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="py-1.5 pr-4 font-mono text-xs text-gray-600 dark:text-gray-400">{row.source}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">{fmtTokens(row.tokens)}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {fmtCost(row.costUsd, unknownCost)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {t('llm_usage_n_calls', { defaultValue: `${row.calls} calls`, count: row.calls })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Caps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CAP_FIELDS.map(({ key, labelKey, helpKey }) => (
          <div key={key}>
            <Input
              label={t(labelKey)}
              type="number"
              min={0}
              value={fields[key]}
              onChange={e => setFields(prev => ({ ...prev, [key]: e.target.value }))}
              placeholder={t('llm_cap_unlimited', { defaultValue: 'No limit' })}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t(helpKey)}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
          {t('common:save', { defaultValue: 'Save' })}
        </Button>
      </div>

      {/* Top spenders — the fastest way to spot a runaway loop. */}
      {topSpenders && topSpenders.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('llm_top_spenders', { defaultValue: 'Highest usage this month' })}
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <tbody>
                {topSpenders.map(row => (
                  <tr key={row.userId ?? 'unknown'} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="py-1.5 pr-4 truncate max-w-xs">
                      {row.user?.fullname || row.user?.email || t('llm_usage_unattributed', { defaultValue: 'Unattributed' })}
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">{fmtTokens(row.tokens)}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {fmtCost(row.costUsd, unknownCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3">
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    <div className="text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</div>
    {sub && <div className="text-xs text-gray-400 dark:text-gray-500">{sub}</div>}
  </div>
);

export default LLMBudgetSection;
