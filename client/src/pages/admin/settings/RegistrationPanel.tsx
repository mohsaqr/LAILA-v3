import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Info, Loader2, Save, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../../api/client';
import { ApiResponse } from '../../../types';
import { useTheme } from '../../../hooks/useTheme';
import { Card, CardBody } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Toggle } from '../../../components/common/Toggle';

// Mirrors server/src/services/registrationPolicy.service.ts
type RegistrationMode = 'open' | 'approval' | 'invite_only' | 'closed';
type RegistrationRole = 'student' | 'instructor';

interface RegistrationPolicy {
  mode: RegistrationMode;
  emailVerification: boolean;
  allowedEmailDomains: string[];
  blockedEmailDomains: string[];
  autoApproveDomains: string[];
  defaultRole: RegistrationRole;
}

const getRegistrationPolicy = async (): Promise<RegistrationPolicy> => {
  const response = await apiClient.get<ApiResponse<RegistrationPolicy>>('/settings/registration');
  return response.data.data!;
};

const updateRegistrationPolicy = async (policy: RegistrationPolicy): Promise<RegistrationPolicy> => {
  const response = await apiClient.put<ApiResponse<RegistrationPolicy>>('/settings/registration', policy);
  return response.data.data!;
};

const MODES: RegistrationMode[] = ['open', 'approval', 'invite_only', 'closed'];

const DOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** Same rule the server enforces: "uef.fi" or a wildcard "*.edu". */
const isValidDomainPattern = (value: string): boolean => {
  const isWildcard = value.startsWith('*.');
  const labels = (isWildcard ? value.slice(2) : value).split('.');
  if (labels.length < (isWildcard ? 1 : 2)) return false;
  return labels.every(label => DOMAIN_LABEL.test(label));
};

interface DomainListEditorProps {
  title: string;
  description: string;
  domains: string[];
  onChange: (domains: string[]) => void;
}

const DomainListEditor = ({ title, description, domains, onChange }: DomainListEditorProps) => {
  const { t } = useTranslation(['admin', 'common']);
  const { isDark } = useTheme();
  const [draft, setDraft] = useState('');

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgInput: isDark ? '#374151' : '#ffffff',
    bgChip: isDark ? '#111827' : '#f3f4f6',
  };

  const addDomain = () => {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    if (!isValidDomainPattern(value)) {
      toast.error(t('invalid_domain'));
      return;
    }
    if (domains.includes(value)) {
      toast.error(t('domain_already_listed'));
      return;
    }
    onChange([...domains, value]);
    setDraft('');
  };

  return (
    <div>
      <h4 className="text-sm font-medium" style={{ color: colors.textPrimary }}>{title}</h4>
      <p className="mt-0.5 text-xs" style={{ color: colors.textSecondary }}>{description}</p>

      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addDomain();
            }
          }}
          placeholder={t('domain_placeholder')}
          className="flex-1 px-3 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: colors.bgInput,
            borderColor: colors.border,
            borderWidth: 1,
            color: colors.textPrimary,
          }}
        />
        <Button variant="secondary" onClick={addDomain} disabled={!draft.trim()}>
          {t('add_domain')}
        </Button>
      </div>

      {domains.length === 0 ? (
        <p className="mt-2 text-xs italic" style={{ color: colors.textSecondary }}>{t('no_domains')}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {domains.map(domain => (
            <li
              key={domain}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm"
              style={{ backgroundColor: colors.bgChip, color: colors.textPrimary }}
            >
              <span dir="ltr">{domain}</span>
              <button
                type="button"
                aria-label={`${t('remove_domain')} ${domain}`}
                onClick={() => onChange(domains.filter(d => d !== domain))}
                className="rounded-full hover:opacity-70"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const RegistrationPanel = () => {
  const { t } = useTranslation(['admin', 'common']);
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    borderActive: isDark ? '#5eecec' : '#088F8F',
    bgInput: isDark ? '#374151' : '#ffffff',
    bgSecondary: isDark ? '#374151' : '#f9fafb',
  };

  const { data: policy, isLoading, error } = useQuery({
    queryKey: ['registration-policy'],
    queryFn: getRegistrationPolicy,
  });

  const [draft, setDraft] = useState<RegistrationPolicy | null>(null);

  // Adopt the server's policy as the form's starting point, and again whenever
  // a save round-trips a fresh (normalized) copy back.
  useEffect(() => {
    if (policy) setDraft(policy);
  }, [policy]);

  const updateMutation = useMutation({
    mutationFn: updateRegistrationPolicy,
    onSuccess: saved => {
      setDraft(saved);
      queryClient.invalidateQueries({ queryKey: ['registration-policy'] });
      toast.success(t('registration_saved'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('registration_save_failed'));
    },
  });

  if (isLoading || (!draft && !error)) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.textSecondary }} />
      </div>
    );
  }

  if (error || !draft) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p style={{ color: colors.textPrimary }}>{t('registration_load_failed')}</p>
        </CardBody>
      </Card>
    );
  }

  const current = draft;
  const patch = (change: Partial<RegistrationPolicy>) => setDraft({ ...current, ...change });
  const isDirty = JSON.stringify(current) !== JSON.stringify(policy);

  const MODE_LABELS: Record<RegistrationMode, { title: string; description: string }> = {
    open: { title: t('mode_open'), description: t('mode_open_desc') },
    approval: { title: t('mode_approval'), description: t('mode_approval_desc') },
    invite_only: { title: t('mode_invite_only'), description: t('mode_invite_only_desc') },
    closed: { title: t('mode_closed'), description: t('mode_closed_desc') },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: isDark ? '#4f46e5' : '#eef2ff' }}>
            <UserPlus className="w-5 h-5" style={{ color: isDark ? '#a5b4fc' : '#4f46e5' }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              {t('registration_policy')}
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              {t('registration_policy_desc')}
            </p>
          </div>
        </div>
        <Button onClick={() => updateMutation.mutate(current)} disabled={updateMutation.isPending || !isDirty}>
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
          {t('common:save')}
        </Button>
      </div>

      {/* Mode */}
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium mb-3" style={{ color: colors.textPrimary }}>
            {t('registration_mode')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODES.map(mode => {
              const selected = current.mode === mode;
              return (
                <label
                  key={mode}
                  className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                  style={{
                    borderWidth: 1,
                    borderColor: selected ? colors.borderActive : colors.border,
                    backgroundColor: selected ? colors.bgSecondary : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="registration-mode"
                    className="mt-1"
                    checked={selected}
                    onChange={() => patch({ mode })}
                  />
                  <span>
                    <span className="block text-sm font-medium" style={{ color: colors.textPrimary }}>
                      {MODE_LABELS[mode].title}
                    </span>
                    <span className="block text-xs" style={{ color: colors.textSecondary }}>
                      {MODE_LABELS[mode].description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {/* Neither the approval queue nor invitations exist yet; say so
              plainly rather than letting an admin assume a mode does more. */}
          {current.mode === 'approval' && (
            <div className="mt-3 flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: colors.textSecondary }} />
              <p className="text-xs" style={{ color: colors.textSecondary }}>{t('approval_queue_pending_note')}</p>
            </div>
          )}
          {current.mode === 'invite_only' && (
            <div className="mt-3 flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: colors.textSecondary }} />
              <p className="text-xs" style={{ color: colors.textSecondary }}>{t('invite_only_pending_note')}</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* New account defaults */}
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium mb-4" style={{ color: colors.textPrimary }}>
            {t('registration_account_defaults')}
          </h3>

          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                {t('require_email_verification')}
              </p>
              <p className="text-xs" style={{ color: colors.textSecondary }}>
                {t('require_email_verification_desc')}
              </p>
            </div>
            <Toggle
              checked={current.emailVerification}
              onChange={value => patch({ emailVerification: value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('registration_default_role')}
            </label>
            <select
              value={current.defaultRole}
              onChange={e => patch({ defaultRole: e.target.value as RegistrationRole })}
              className="w-full sm:w-64 px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: colors.bgInput,
                borderColor: colors.border,
                borderWidth: 1,
                color: colors.textPrimary,
              }}
            >
              <option value="student">{t('role_student')}</option>
              <option value="instructor">{t('role_instructor')}</option>
            </select>
            <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
              {t('registration_default_role_desc')}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Email domains */}
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium" style={{ color: colors.textPrimary }}>
            {t('email_domains')}
          </h3>
          <p className="mt-0.5 mb-4 text-xs" style={{ color: colors.textSecondary }}>
            {t('email_domains_desc')}
          </p>

          <div className="space-y-6">
            <DomainListEditor
              title={t('allowed_domains')}
              description={t('allowed_domains_desc')}
              domains={current.allowedEmailDomains}
              onChange={allowedEmailDomains => patch({ allowedEmailDomains })}
            />
            <DomainListEditor
              title={t('blocked_domains')}
              description={t('blocked_domains_desc')}
              domains={current.blockedEmailDomains}
              onChange={blockedEmailDomains => patch({ blockedEmailDomains })}
            />
            <DomainListEditor
              title={t('auto_approve_domains')}
              description={t('auto_approve_domains_desc')}
              domains={current.autoApproveDomains}
              onChange={autoApproveDomains => patch({ autoApproveDomains })}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
