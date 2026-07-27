import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, Copy, Loader2, Mail, Plus, Ticket, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  invitationsApi,
  type BulkInvitationResult,
  type CreatedInvitation,
  type Invitation,
  type InvitationRole,
  type InvitationStatus,
} from '../../../api/invitations';
import { coursesApi } from '../../../api/courses';
import { useTheme } from '../../../hooks/useTheme';
import { Card, CardBody } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';

const STATUS_FILTERS: Array<InvitationStatus | 'all'> = ['all', 'pending', 'used', 'expired', 'revoked'];

/** Status pill colours. Only `pending` is actionable, so only it reads green. */
const STATUS_COLORS: Record<InvitationStatus, { bg: string; text: string }> = {
  pending: { bg: 'rgba(16, 185, 129, 0.15)', text: '#059669' },
  used: { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280' },
  expired: { bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706' },
  revoked: { bg: 'rgba(239, 68, 68, 0.15)', text: '#dc2626' },
};

/** Copy helper with a per-target "copied" tick. */
const useCopy = () => {
  const { t } = useTranslation(['admin']);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(current => (current === key ? null : current)), 2000);
    } catch {
      // Clipboard access needs a secure context; tell the admin rather than
      // failing silently and leaving them wondering whether it worked.
      toast.error(t('invite_copy_failed'));
    }
  };

  return { copied, copy };
};

interface CopyButtonProps {
  value: string;
  copyKey: string;
  label: string;
  copied: string | null;
  onCopy: (value: string, key: string) => void;
}

const CopyButton = ({ value, copyKey, label, copied, onCopy }: CopyButtonProps) => (
  <button
    type="button"
    onClick={() => onCopy(value, copyKey)}
    aria-label={label}
    title={label}
    className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
  >
    {copied === copyKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    {label}
  </button>
);

// ---------------------------------------------------------------------------
// The one-time reveal
// ---------------------------------------------------------------------------

interface RevealProps {
  created: CreatedInvitation[];
  onDismiss: () => void;
}

/**
 * The plaintext codes only exist in the create response — the server stores a
 * digest. This panel is the admin's single chance to copy them, so it stays up
 * until dismissed and says plainly that it will not come back.
 */
const CodeReveal = ({ created, onDismiss }: RevealProps) => {
  const { t } = useTranslation(['admin', 'common']);
  const { isDark } = useTheme();
  const { copied, copy } = useCopy();

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgHighlight: isDark ? 'rgba(8, 143, 143, 0.12)' : '#e6f6f6',
  };

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
            <div>
              <h3 className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                {t('invite_created_title')}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                {t('invite_code_shown_once')}
              </p>
            </div>
          </div>
          <button type="button" onClick={onDismiss} aria-label={t('common:close')}>
            <X className="w-4 h-4" style={{ color: colors.textSecondary }} />
          </button>
        </div>

        <ul className="mt-4 space-y-3">
          {created.map(({ invitation, code, link }) => (
            <li
              key={invitation.id}
              className="rounded-lg p-3"
              style={{ backgroundColor: colors.bgHighlight }}
            >
              <p className="text-xs mb-1" style={{ color: colors.textSecondary }}>
                {invitation.email || t('invite_open_link')}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <code
                  dir="ltr"
                  className="px-2 py-1 rounded text-sm font-mono font-semibold"
                  style={{ backgroundColor: isDark ? '#111827' : '#ffffff', color: colors.textPrimary }}
                >
                  {code}
                </code>
                <CopyButton
                  value={code}
                  copyKey={`code-${invitation.id}`}
                  label={t('invite_copy_code')}
                  copied={copied}
                  onCopy={copy}
                />
                <CopyButton
                  value={link}
                  copyKey={`link-${invitation.id}`}
                  label={t('invite_copy_link')}
                  copied={copied}
                  onCopy={copy}
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onDismiss}>
            {t('invite_done_copying')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------

interface CreateFormProps {
  onCreated: (created: CreatedInvitation[]) => void;
}

const CreateInvitationForm = ({ onCreated }: CreateFormProps) => {
  const { t } = useTranslation(['admin', 'common']);
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  const [bulk, setBulk] = useState(false);
  const [email, setEmail] = useState('');
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<InvitationRole>('student');
  const [courseId, setCourseId] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresInDays, setExpiresInDays] = useState('14');

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgInput: isDark ? '#374151' : '#ffffff',
  };

  const inputStyle = {
    backgroundColor: colors.bgInput,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.textPrimary,
  };

  const { data: courses } = useQuery({
    queryKey: ['invitation-courses'],
    queryFn: () => coursesApi.getCourses({ limit: 100 }),
  });

  const reset = () => {
    setEmail('');
    setEmails('');
    setCourseId('');
    setMaxUses('1');
  };

  const onError = (err: any) => {
    toast.error(err.response?.data?.error || t('invite_create_failed'));
  };

  const afterCreate = (created: CreatedInvitation[]) => {
    queryClient.invalidateQueries({ queryKey: ['invitations'] });
    onCreated(created);
    reset();
  };

  const createMutation = useMutation({
    mutationFn: invitationsApi.create,
    onSuccess: created => {
      toast.success(t('invite_created'));
      afterCreate([created]);
    },
    onError,
  });

  const bulkMutation = useMutation({
    mutationFn: invitationsApi.createBulk,
    onSuccess: (result: BulkInvitationResult) => {
      if (result.failed.length > 0) {
        toast.error(t('invite_bulk_partial', { count: result.failed.length }));
      } else {
        toast.success(t('invite_bulk_created', { count: result.created.length }));
      }
      afterCreate(result.created);
    },
    onError,
  });

  const isPending = createMutation.isPending || bulkMutation.isPending;

  // Shared by both modes; null means "never expires".
  const expiry = expiresInDays === '' ? null : Number(expiresInDays);
  const course = courseId ? Number(courseId) : undefined;

  /** Split a pasted roster on commas, semicolons, or newlines. */
  const parsedEmails = emails
    .split(/[\s,;]+/)
    .map(e => e.trim())
    .filter(Boolean);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bulk) {
      if (parsedEmails.length === 0) {
        toast.error(t('invite_need_emails'));
        return;
      }
      bulkMutation.mutate({ emails: parsedEmails, role, courseId: course, expiresInDays: expiry });
      return;
    }
    createMutation.mutate({
      email: email.trim() || undefined,
      role,
      courseId: course,
      maxUses: Number(maxUses) || 1,
      expiresInDays: expiry,
    });
  };

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-sm font-medium" style={{ color: colors.textPrimary }}>
            {t('invite_create')}
          </h3>
          {/* type="button" is explicit: Button sets no default, so HTML's
              "submit" would apply if these ever moved inside the form. */}
          <div className="flex gap-2">
            <Button type="button" variant={bulk ? 'secondary' : 'primary'} onClick={() => setBulk(false)}>
              <Mail size={14} />
              {t('invite_mode_single')}
            </Button>
            <Button type="button" variant={bulk ? 'primary' : 'secondary'} onClick={() => setBulk(true)}>
              <Users size={14} />
              {t('invite_mode_bulk')}
            </Button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {bulk ? (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('invite_emails')}
              </label>
              <textarea
                value={emails}
                onChange={e => setEmails(e.target.value)}
                rows={4}
                dir="ltr"
                placeholder={t('invite_emails_placeholder')}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              />
              <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                {t('invite_emails_desc', { count: parsedEmails.length })}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('invite_email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                dir="ltr"
                placeholder={t('invite_email_placeholder')}
                className="w-full sm:w-96 px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              />
              <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                {t('invite_email_desc')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('invite_role')}
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as InvitationRole)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              >
                <option value="student">{t('role_student')}</option>
                <option value="instructor">{t('role_instructor')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('invite_course')}
              </label>
              <select
                value={courseId}
                onChange={e => setCourseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              >
                <option value="">{t('invite_no_course')}</option>
                {courses?.courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {!bulk && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                  {t('invite_max_uses')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxUses}
                  onChange={e => setMaxUses(e.target.value)}
                  // An email-bound invitation is for one person; the server
                  // rejects a reusable one, so do not offer it here either.
                  disabled={email.trim().length > 0}
                  className="w-full px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                  style={inputStyle}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                {t('invite_expires_in_days')}
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={e => setExpiresInDays(e.target.value)}
                placeholder={t('invite_never_expires')}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />}
              {t('invite_create')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export const InvitationsPanel = () => {
  const { t } = useTranslation(['admin', 'common']);
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const { copied, copy } = useCopy();

  const [filter, setFilter] = useState<InvitationStatus | 'all'>('all');
  const [revealed, setRevealed] = useState<CreatedInvitation[]>([]);

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    bgHeader: isDark ? '#374151' : '#f9fafb',
  };

  const { data: invitations, isLoading, error } = useQuery({
    queryKey: ['invitations', filter],
    queryFn: () => invitationsApi.list(filter === 'all' ? undefined : filter),
  });

  const revokeMutation = useMutation({
    mutationFn: invitationsApi.revoke,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success(t('invite_revoked'));
    },
    onError: (err: any) => toast.error(err.response?.data?.error || t('invite_revoke_failed')),
  });

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString() : t('invite_never');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: isDark ? '#4f46e5' : '#eef2ff' }}>
          <Ticket className="w-5 h-5" style={{ color: isDark ? '#a5b4fc' : '#4f46e5' }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
            {t('invitations')}
          </h2>
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            {t('invitations_desc')}
          </p>
        </div>
      </div>

      {revealed.length > 0 && <CodeReveal created={revealed} onDismiss={() => setRevealed([])} />}

      <CreateInvitationForm onCreated={setRevealed} />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(value => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{
              borderWidth: 1,
              borderColor: filter === value ? (isDark ? '#5eecec' : '#088F8F') : colors.border,
              color: colors.textPrimary,
            }}
          >
            {t(`invite_status_${value}`)}
          </button>
        ))}
      </div>

      {/* List */}
      <Card>
        <CardBody>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.textSecondary }} />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <p style={{ color: colors.textPrimary }}>{t('invitations_load_failed')}</p>
            </div>
          ) : !invitations || invitations.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: colors.textSecondary }}>
              {t('no_invitations')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: colors.bgHeader }}>
                    {['invite_recipient', 'invite_role', 'invite_course', 'invite_status', 'invite_uses', 'invite_expires', 'invite_code_hint', ''].map(
                      (key, i) => (
                        <th
                          key={key || `actions-${i}`}
                          className="px-3 py-2 text-start font-medium"
                          style={{ color: colors.textSecondary }}
                        >
                          {key ? t(key) : ''}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv: Invitation) => (
                    <tr key={inv.id} style={{ borderTopWidth: 1, borderColor: colors.border }}>
                      <td className="px-3 py-2" style={{ color: colors.textPrimary }} dir="ltr">
                        {inv.email || (
                          <span style={{ color: colors.textSecondary }}>{t('invite_open_link')}</span>
                        )}
                      </td>
                      <td className="px-3 py-2" style={{ color: colors.textPrimary }}>
                        {t(inv.role === 'instructor' ? 'role_instructor' : 'role_student')}
                      </td>
                      <td className="px-3 py-2" style={{ color: colors.textPrimary }}>
                        {inv.courseTitle || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: STATUS_COLORS[inv.status].bg,
                            color: STATUS_COLORS[inv.status].text,
                          }}
                        >
                          {t(`invite_status_${inv.status}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2" style={{ color: colors.textPrimary }} dir="ltr">
                        {inv.useCount} / {inv.maxUses}
                      </td>
                      <td className="px-3 py-2" style={{ color: colors.textSecondary }}>
                        {formatDate(inv.expiresAt)}
                      </td>
                      <td className="px-3 py-2" style={{ color: colors.textSecondary }} dir="ltr">
                        {/* Four characters only — enough to tell two codes
                            apart, not enough to redeem either. */}
                        {inv.codeHint ? `…${inv.codeHint}` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3" style={{ color: colors.textSecondary }}>
                          <CopyButton
                            value={inv.link}
                            copyKey={`row-${inv.id}`}
                            label={t('invite_copy_link')}
                            copied={copied}
                            onCopy={copy}
                          />
                          {inv.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => revokeMutation.mutate(inv.id)}
                              disabled={revokeMutation.isPending}
                              className="text-xs font-medium hover:underline"
                              style={{ color: '#dc2626' }}
                            >
                              {t('invite_revoke')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
