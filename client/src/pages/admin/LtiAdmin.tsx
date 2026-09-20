/**
 * Admin → External tools (LTI 1.3).
 *
 * Registering a tool is a mutual exchange: the tool needs LAILA's issuer,
 * authorization endpoint and JWKS, and LAILA needs the tool's login URL,
 * launch URL and redirect URIs. Half of a failed LTI setup is someone pasting
 * the wrong one of six URLs, so the platform's own values are shown first and
 * copyable, before the form asks for anything.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Plug, Copy, Trash2, ShieldAlert, Check, X } from 'lucide-react';
import { ltiApi, type LtiTool } from '../../api/lti';
import { Card, CardBody } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { apiErrorMessage } from '../../utils/apiError';

const CopyRow = ({ label, value }: { label: string; value: string | null }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-52 shrink-0 text-xs text-gray-500">{label}</span>
      <code className="flex-1 truncate rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
        {value}
      </code>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
};

export const LtiAdmin = () => {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    loginUrl: '',
    targetLinkUri: '',
    redirectUris: '',
    jwksUrl: '',
    deepLinkingUrl: '',
    sendPii: false,
  });
  const [confirmRemove, setConfirmRemove] = useState<LtiTool | null>(null);

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['admin', 'lti', 'tools'],
    queryFn: ltiApi.listTools,
  });
  const { data: platform } = useQuery({
    queryKey: ['admin', 'lti', 'platform'],
    queryFn: ltiApi.platformConfig,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'lti'] });

  const registerMutation = useMutation({
    mutationFn: () =>
      ltiApi.register({
        name: form.name.trim(),
        loginUrl: form.loginUrl.trim(),
        targetLinkUri: form.targetLinkUri.trim(),
        redirectUris: form.redirectUris
          .split(/[\s,]+/)
          .map((u) => u.trim())
          .filter(Boolean),
        jwksUrl: form.jwksUrl.trim() || undefined,
        deepLinkingUrl: form.deepLinkingUrl.trim() || undefined,
        sendPii: form.sendPii,
      }),
    onSuccess: (tool) => {
      toast.success(
        t('lti_registered', { defaultValue: 'Registered {{name}}', name: tool.name }),
      );
      setForm({
        name: '', loginUrl: '', targetLinkUri: '', redirectUris: '',
        jwksUrl: '', deepLinkingUrl: '', sendPii: false,
      });
      refresh();
    },
    onError: (err) =>
      toast.error(apiErrorMessage(err, t('lti_register_failed', { defaultValue: 'Could not register the tool' }))),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { isActive?: boolean; sendPii?: boolean } }) =>
      ltiApi.update(id, patch),
    onSuccess: refresh,
    onError: (err) => toast.error(apiErrorMessage(err, t('common:error', { defaultValue: 'Error' }))),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => ltiApi.remove(id),
    onSuccess: () => {
      toast.success(t('lti_removed', { defaultValue: 'Tool removed' }));
      setConfirmRemove(null);
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('common:error', { defaultValue: 'Error' }))),
  });

  if (isLoading) return <Loading />;

  const canSubmit = form.name.trim() && form.loginUrl.trim() && form.targetLinkUri.trim() && form.redirectUris.trim();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
          <Plug className="h-6 w-6" aria-hidden="true" />
          {t('lti_tools', { defaultValue: 'External tools (LTI)' })}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('lti_intro', {
            defaultValue:
              'LAILA acts as an LTI 1.3 platform. Teachers can add a registered tool to a lesson; students launch it from there.',
          })}
        </p>
      </header>

      {/* What the tool's own setup screen asks for. */}
      <Card className="mb-6">
        <CardBody>
          <p className="mb-2 font-medium text-gray-900 dark:text-gray-100">
            {t('lti_platform_details', { defaultValue: "Give these to the tool" })}
          </p>
          <CopyRow label="Issuer / Platform ID" value={platform?.issuer ?? null} />
          <CopyRow label="Authorization endpoint" value={platform?.authorizationEndpoint ?? null} />
          <CopyRow label="Public JWKS URL" value={platform?.jwksUri ?? null} />
          <CopyRow label="Deep Linking return URL" value={platform?.deepLinkingReturnUrl ?? null} />
          <p className="mt-2 text-xs text-gray-500">
            {t('lti_no_ags', {
              defaultValue:
                'No access-token endpoint is published: grade passback (AGS) is not implemented, so a tool cannot write scores back.',
            })}
          </p>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardBody>
          <p className="mb-3 font-medium text-gray-900 dark:text-gray-100">
            {t('lti_register', { defaultValue: 'Register a tool' })}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ['name', 'Name', 'My Tool'],
                ['loginUrl', 'OIDC login URL', 'https://tool.example/lti/login'],
                ['targetLinkUri', 'Launch URL', 'https://tool.example/lti/launch'],
                ['redirectUris', 'Redirect URIs (one per line)', 'https://tool.example/lti/callback'],
                ['jwksUrl', "Tool's JWKS URL (optional)", 'https://tool.example/.well-known/jwks.json'],
                ['deepLinkingUrl', 'Deep Linking URL (optional)', 'https://tool.example/lti/deep-link'],
              ] as const
            ).map(([field, label, placeholder]) => (
              <label key={field} className="block text-sm">
                <span className="mb-1 block text-gray-600 dark:text-gray-400">{label}</span>
                {field === 'redirectUris' ? (
                  <textarea
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    placeholder={placeholder}
                    rows={2}
                    className="w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <input
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                )}
              </label>
            ))}
          </div>

          <label className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
            <input
              type="checkbox"
              checked={form.sendPii}
              onChange={(e) => setForm({ ...form, sendPii: e.target.checked })}
              className="mt-0.5"
            />
            <span className="text-amber-900 dark:text-amber-300">
              {t('lti_send_pii', {
                defaultValue:
                  "Send each learner's name and email to this tool. Leave off unless the tool needs them — most work without.",
              })}
            </span>
          </label>

          <button
            type="button"
            onClick={() => registerMutation.mutate()}
            disabled={!canSubmit || registerMutation.isPending}
            className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {t('lti_register', { defaultValue: 'Register a tool' })}
          </button>
        </CardBody>
      </Card>

      {tools.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('lti_none', { defaultValue: 'No tools registered.' })}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {tools.map((tool) => (
            <Card key={tool.id}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-gray-900 dark:text-gray-100">{tool.name}</h2>
                      {tool.isActive ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/40 dark:text-green-300">
                          {t('lti_active', { defaultValue: 'Active' })}
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {t('lti_disabled', { defaultValue: 'Disabled' })}
                        </span>
                      )}
                      {tool.sendPii && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">
                          <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                          {t('lti_pii_on', { defaultValue: 'Receives name and email' })}
                        </span>
                      )}
                      {tool.supportsDeepLinking && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                          {t('lti_deep_linking', { defaultValue: 'Deep Linking' })}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <CopyRow label="Client ID" value={tool.clientId} />
                      <CopyRow label="Deployment ID" value={tool.deploymentId} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('lti_frame_reminder', {
                        defaultValue:
                          'Add this tool\'s origin to EXTRA_FRAME_SRC and regenerate the nginx CSP, or the launch will be blocked.',
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => patchMutation.mutate({ id: tool.id, patch: { isActive: !tool.isActive } })}
                      className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
                    >
                      {tool.isActive
                        ? t('lti_disable', { defaultValue: 'Disable' })
                        : t('lti_enable', { defaultValue: 'Enable' })}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${tool.name}`}
                      onClick={() => setConfirmRemove(tool)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('lti_remove_title', { defaultValue: 'Remove {{name}}?', name: confirmRemove.name })}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('lti_remove_body', {
                defaultValue:
                  'Lessons that launch this tool will stop working. Anything students did inside the tool stays on the tool, not here.',
              })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <X className="mr-1 inline h-4 w-4" aria-hidden="true" />
                {t('common:cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                type="button"
                onClick={() => removeMutation.mutate(confirmRemove.id)}
                disabled={removeMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t('lti_remove_confirm', { defaultValue: 'Remove' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LtiAdmin;
