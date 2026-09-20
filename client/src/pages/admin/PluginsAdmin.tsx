/**
 * Admin → Plugins.
 *
 * Installing a plugin means running somebody else's code inside LAILA's server
 * process and inside every user's browser. This page's job is to make that
 * decision an informed one rather than a click:
 *
 *   - the **capabilities** a bundle asks for are shown *before* it is enabled,
 *     in plain words, with the ones that touch other people's data called out;
 *   - a plugin that failed to load says so, with its error, instead of just
 *     appearing switched off;
 *   - **enabled** and **loaded** are shown separately, because they genuinely
 *     differ — a plugin can be enabled in the database and failed in the
 *     process, and hiding that is how an admin ends up debugging a feature
 *     that was never running.
 */

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Puzzle,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { pluginsApi, type InstalledPlugin } from '../../api/plugins';
import { Card, CardBody } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { apiErrorMessage } from '../../utils/apiError';

/**
 * Plain-language descriptions of what a capability lets a plugin do.
 *
 * Written for the person deciding, not for the developer who wrote the plugin:
 * "read every student's grades" is a decision, "grades:read" is a token.
 */
const CAPABILITY_LABELS: Record<string, { key: string; fallback: string; sensitive?: boolean }> = {
  store: { key: 'plugin_cap_store', fallback: 'Store its own settings and data' },
  db: { key: 'plugin_cap_db', fallback: 'Create and use its own database tables' },
  http: { key: 'plugin_cap_http', fallback: 'Add API endpoints under /api/plugins/' },
  events: { key: 'plugin_cap_events', fallback: 'React to events like enrolment and submission' },
  llm: { key: 'plugin_cap_llm', fallback: 'Send text to the configured AI providers', sensitive: true },
  files: { key: 'plugin_cap_files', fallback: 'Read and write uploaded files', sensitive: true },
  'users:read': { key: 'plugin_cap_users_read', fallback: "Read users' names and email addresses", sensitive: true },
  'grades:read': { key: 'plugin_cap_grades_read', fallback: 'Read grades and submissions', sensitive: true },
  'grades:write': { key: 'plugin_cap_grades_write', fallback: 'Change grades', sensitive: true },
  'activity-log': { key: 'plugin_cap_activity_log', fallback: 'Write to the learning activity log' },
  'course:read': { key: 'plugin_cap_course_read', fallback: 'Read course content and structure' },
  'course:export': { key: 'plugin_cap_course_export', fallback: 'Add data to course exports' },
  jobs: { key: 'plugin_cap_jobs', fallback: 'Run scheduled background tasks' },
  network: { key: 'plugin_cap_network', fallback: 'Send data to external servers it declares', sensitive: true },
};

type Translate = (key: string, opts?: Record<string, unknown>) => string;

const StatusBadge = ({ plugin, t }: { plugin: InstalledPlugin; t: Translate }) => {
  const map: Record<string, { icon: typeof CheckCircle2; text: string; cls: string }> = {
    active: {
      icon: CheckCircle2,
      text: t('plugin_status_active', { defaultValue: 'Active' }),
      cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    },
    disabled: {
      icon: XCircle,
      text: t('plugin_status_disabled', { defaultValue: 'Disabled' }),
      cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    },
    error: {
      icon: AlertTriangle,
      text: t('plugin_status_error', { defaultValue: 'Failed to load' }),
      cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    },
    incompatible: {
      icon: ShieldAlert,
      text: t('plugin_status_incompatible', { defaultValue: 'Needs a different LAILA version' }),
      cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300',
    },
  };
  const entry = map[plugin.status] ?? map.disabled;
  const Icon = entry.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${entry.cls}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {entry.text}
    </span>
  );
};

export const PluginsAdmin = () => {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<InstalledPlugin | null>(null);
  const [dropData, setDropData] = useState(false);

  const { data: plugins = [], isLoading } = useQuery({
    queryKey: ['admin', 'plugins'],
    queryFn: pluginsApi.list,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'plugins'] });

  const installMutation = useMutation({
    mutationFn: (file: File) =>
      pluginsApi.install(file, { enable: false, onProgress: (f) => setUploadPct(f) }),
    onSuccess: (result) => {
      toast.success(
        result.upgraded
          ? t('plugin_upgraded', {
              defaultValue: 'Upgraded {{name}} {{from}} → {{to}}',
              name: result.name,
              from: result.previousVersion ?? '',
              to: result.version,
            })
          : t('plugin_installed', {
              defaultValue: 'Installed {{name}} {{version}}',
              name: result.name,
              version: result.version,
            }),
      );
      // Warnings are the part an admin must actually read — a restart
      // requirement or a changed bundle at the same version.
      result.warnings.forEach((w) => toast(w, { icon: '⚠️', duration: 8000 }));
      if (result.migrationsApplied.length) {
        toast.success(
          t('plugin_migrations_applied', {
            defaultValue: 'Applied {{count}} database migration(s)',
            count: result.migrationsApplied.length,
          }),
        );
      }
      refresh();
    },
    onError: (err) => {
      // The server sends every manifest problem at once; showing only the
      // first would make fixing a bundle a guessing loop.
      const data = (err as { response?: { data?: { issues?: string[]; error?: string } } }).response
        ?.data;
      if (data?.issues?.length) {
        toast.error(`${data.error}\n\n${data.issues.map((i) => `• ${i}`).join('\n')}`, {
          duration: 12000,
          style: { maxWidth: '40rem', whiteSpace: 'pre-wrap' },
        });
      } else {
        toast.error(apiErrorMessage(err, t('plugin_install_failed', { defaultValue: 'Install failed' })));
      }
    },
    onSettled: () => {
      setUploadPct(null);
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enable }: { id: string; enable: boolean }) =>
      enable ? pluginsApi.enable(id) : pluginsApi.disable(id),
    onSuccess: refresh,
    onError: (err) =>
      toast.error(
        apiErrorMessage(err, t('plugin_toggle_failed', { defaultValue: 'Could not change the plugin' })),
      ),
  });

  const removeMutation = useMutation({
    mutationFn: ({ id, drop }: { id: string; drop: boolean }) => pluginsApi.uninstall(id, drop),
    onSuccess: (result) => {
      toast.success(
        result.droppedTables.length
          ? t('plugin_removed_with_tables', {
              defaultValue: 'Removed, and dropped {{count}} table(s)',
              count: result.droppedTables.length,
            })
          : t('plugin_removed_kept_tables', {
              defaultValue: 'Removed. Its database tables were kept.',
            }),
      );
      setConfirmRemove(null);
      setDropData(false);
      refresh();
    },
    onError: (err) =>
      toast.error(
        apiErrorMessage(err, t('plugin_remove_failed', { defaultValue: 'Could not remove the plugin' })),
      ),
  });

  if (isLoading) return <Loading />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
          <Puzzle className="h-6 w-6" aria-hidden="true" />
          {t('plugins', { defaultValue: 'Plugins' })}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('plugins_intro', {
            defaultValue:
              'Plugins add blocks, labs, dashboard panels and course tools. They run with full access to this server, so install only plugins you trust.',
          })}
        </p>
      </header>

      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {t('plugin_install_title', { defaultValue: 'Install a plugin' })}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('plugin_install_hint', {
                  defaultValue:
                    'Upload a .laila-plugin.zip bundle. It installs disabled so you can review what it asks for first.',
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {uploadPct !== null && (
                <span className="text-sm text-gray-500">
                  {Math.round(uploadPct * 100)}%
                </span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) installMutation.mutate(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={installMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {installMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden="true" />
                )}
                {t('plugin_upload_bundle', { defaultValue: 'Upload bundle' })}
              </button>
            </div>
          </div>
        </CardBody>
      </Card>

      {plugins.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('plugins_none', { defaultValue: 'No plugins installed.' })}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {plugins.map((plugin) => {
            const sensitive = plugin.capabilities.filter((c) => CAPABILITY_LABELS[c]?.sensitive);
            return (
              <Card key={plugin.id}>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                          {plugin.name}
                        </h2>
                        <span className="text-xs text-gray-500">v{plugin.version}</span>
                        <StatusBadge plugin={plugin} t={t} />
                        {plugin.enabled && !plugin.loaded && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">
                            {t('plugin_enabled_not_running', {
                              defaultValue: 'Enabled but not running — restart may be needed',
                            })}
                          </span>
                        )}
                      </div>

                      {plugin.description && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {plugin.description}
                        </p>
                      )}

                      <p className="mt-1 text-xs text-gray-500">
                        <code>{plugin.id}</code>
                        {plugin.authorName && <> · {plugin.authorName}</>}
                        {plugin.homepage && (
                          <>
                            {' · '}
                            <a
                              href={plugin.homepage}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-0.5 underline"
                            >
                              {t('plugin_homepage', { defaultValue: 'Homepage' })}
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          </>
                        )}
                      </p>

                      {plugin.extensions.length > 0 && (
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">
                            {t('plugin_adds', { defaultValue: 'Adds:' })}{' '}
                          </span>
                          {plugin.extensions.map((e) => `${e.label} (${e.point})`).join(', ')}
                        </p>
                      )}

                      {plugin.capabilities.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                            {t('plugin_capabilities_summary', {
                              defaultValue: 'What it can do ({{count}})',
                              count: plugin.capabilities.length,
                            })}
                            {sensitive.length > 0 && (
                              <span className="ml-2 text-amber-700 dark:text-amber-400">
                                ·{' '}
                                {t('plugin_capabilities_sensitive', {
                                  defaultValue: '{{count}} sensitive',
                                  count: sensitive.length,
                                })}
                              </span>
                            )}
                          </summary>
                          <ul className="mt-2 space-y-1">
                            {plugin.capabilities.map((c) => {
                              const info = CAPABILITY_LABELS[c] ?? { key: '', fallback: c };
                              return (
                                <li
                                  key={c}
                                  className={`flex items-start gap-1.5 text-xs ${
                                    info.sensitive
                                      ? 'text-amber-800 dark:text-amber-300'
                                      : 'text-gray-600 dark:text-gray-400'
                                  }`}
                                >
                                  {info.sensitive && (
                                    <ShieldAlert
                                      className="mt-0.5 h-3 w-3 shrink-0"
                                      aria-hidden="true"
                                    />
                                  )}
                                  {info.key ? t(info.key, { defaultValue: info.fallback }) : info.fallback}
                                </li>
                              );
                            })}
                          </ul>
                        </details>
                      )}

                      {plugin.lastError && (
                        <div
                          role="alert"
                          className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300"
                        >
                          <span className="font-medium">
                            {t('plugin_last_error', { defaultValue: 'Last error' })}
                          </span>
                          {plugin.errorCount > 1 && (
                            <>
                              {' '}
                              {t('plugin_last_error_times', {
                                defaultValue: '({{count}} times)',
                                count: plugin.errorCount,
                              })}
                            </>
                          )}
                          : {plugin.lastError}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          toggleMutation.mutate({ id: plugin.id, enable: !plugin.enabled })
                        }
                        disabled={toggleMutation.isPending}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                          plugin.enabled
                            ? 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'
                            : 'bg-teal-600 text-white hover:bg-teal-700'
                        }`}
                      >
                        {plugin.enabled
                          ? t('plugin_disable', { defaultValue: 'Disable' })
                          : t('plugin_enable', { defaultValue: 'Enable' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(plugin)}
                        aria-label={t('plugin_remove_aria', {
                          defaultValue: 'Remove {{name}}',
                          name: plugin.name,
                        })}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-plugin-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-gray-900">
            <h2
              id="remove-plugin-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {t('plugin_remove_title', {
                defaultValue: 'Remove {{name}}?',
                name: confirmRemove.name,
              })}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('plugin_remove_body', {
                defaultValue:
                  'Its blocks will stop rendering wherever teachers have used them. Lessons keep working — each place shows a short notice instead.',
              })}
            </p>

            <label className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm dark:bg-red-950/30">
              <input
                type="checkbox"
                checked={dropData}
                onChange={(e) => setDropData(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-red-800 dark:text-red-300">
                {t('plugin_drop_data_label', { defaultValue: 'Also delete its database tables.' })}{' '}
                <span className="font-medium">
                  {t('plugin_drop_data_warning', {
                    defaultValue:
                      'This cannot be undone and destroys student work stored by this plugin.',
                  })}
                </span>{' '}
                {t('plugin_drop_data_hint', {
                  defaultValue: 'Leave unchecked if you plan to reinstall it.',
                })}
              </span>
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmRemove(null);
                  setDropData(false);
                }}
                className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {t('common:cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                type="button"
                onClick={() =>
                  removeMutation.mutate({ id: confirmRemove.id, drop: dropData })
                }
                disabled={removeMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removeMutation.isPending
                  ? t('plugin_removing', { defaultValue: 'Removing…' })
                  : dropData
                    ? t('plugin_remove_confirm_data', { defaultValue: 'Remove and delete data' })
                    : t('plugin_remove_confirm', { defaultValue: 'Remove' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginsAdmin;
