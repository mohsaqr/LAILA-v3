import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Users,
  Code,
  Lock,
  Globe,
  Network,
  Loader2,
  Settings2,
  Copy,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { customLabsApi } from '../api/customLabs';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { CustomLab, LabType } from '../types';
import activityLogger from '../services/activityLogger';

// Lab type icons and colors
const labTypeConfig: Record<string, { icon: typeof FlaskConical; gradient: string }> = {
  tna: { icon: FlaskConical, gradient: 'from-emerald-500 to-teal-600' },
  sna: { icon: Network, gradient: 'from-violet-500 to-purple-600' },
  statistics: { icon: FlaskConical, gradient: 'from-blue-500 to-indigo-600' },
  dataviz: { icon: FlaskConical, gradient: 'from-purple-500 to-pink-600' },
  ml: { icon: FlaskConical, gradient: 'from-orange-500 to-red-600' },
  python: { icon: Code, gradient: 'from-yellow-500 to-orange-600' },
  'python-data': { icon: Code, gradient: 'from-yellow-500 to-orange-600' },
  'python-ml': { icon: Code, gradient: 'from-amber-500 to-red-600' },
  'python-stats': { icon: Code, gradient: 'from-yellow-500 to-green-600' },
  'python-viz': { icon: Code, gradient: 'from-yellow-500 to-pink-600' },
  'python-sna': { icon: Network, gradient: 'from-yellow-500 to-violet-600' },
};

export const Labs = () => {
  const { t } = useTranslation(['courses', 'teaching', 'common']);
  const { isDark } = useTheme();
  const { isInstructor, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteLab, setDeleteLab] = useState<CustomLab | null>(null);
  const [labForm, setLabForm] = useState({
    name: '',
    description: '',
    labType: 'tna',
    isPublic: false,
    addDefaultTemplates: true,
  });

  // Log page view
  useEffect(() => {
    activityLogger.logLabsViewed();
  }, []);

  const { data: labs, isLoading: labsLoading } = useQuery({
    queryKey: ['labs', { search, labType: selectedType }],
    queryFn: () => customLabsApi.getLabs({ search, labType: selectedType || undefined }),
  });

  const { data: labTypes } = useQuery({
    queryKey: ['labTypes'],
    queryFn: customLabsApi.getLabTypes,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['labs'] });
    queryClient.invalidateQueries({ queryKey: ['myLabs'] });
  };

  const createLabMutation = useMutation({
    mutationFn: customLabsApi.createLab,
    onSuccess: (created: CustomLab) => {
      invalidate();
      setShowCreateModal(false);
      setLabForm({ name: '', description: '', labType: 'tna', isPublic: false, addDefaultTemplates: true });
      toast.success(t('teaching:lab_created', { defaultValue: 'Lab created' }));
      navigate(`/labs/${created.id}`);
    },
    onError: (e: Error) =>
      toast.error(e.message || t('teaching:failed_to_create_lab', { defaultValue: 'Failed to create lab' })),
  });

  const duplicateLabMutation = useMutation({
    mutationFn: customLabsApi.duplicateLab,
    onSuccess: (copy: CustomLab) => {
      invalidate();
      toast.success(t('teaching:lab_duplicated', { defaultValue: 'Lab duplicated' }));
      navigate(`/labs/${copy.id}?settings=1`);
    },
    onError: (e: Error) =>
      toast.error(e.message || t('teaching:failed_to_duplicate_lab', { defaultValue: 'Failed to duplicate lab' })),
  });

  const deleteLabMutation = useMutation({
    mutationFn: customLabsApi.deleteLab,
    onSuccess: () => {
      invalidate();
      setDeleteLab(null);
      toast.success(t('teaching:lab_deleted', { defaultValue: 'Lab deleted' }));
    },
    onError: (e: Error) =>
      toast.error(e.message || t('teaching:failed_to_delete_lab', { defaultValue: 'Failed to delete lab' })),
  });

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#4b5563',
    border: isDark ? '#374151' : '#e5e7eb',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    inputBg: isDark ? '#374151' : '#ffffff',
  };

  const inputCls =
    'w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';
  const labelCls = 'block text-sm font-medium mb-1 text-gray-800 dark:text-gray-100';
  const cardAction =
    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors';

  const getLabConfig = (labType: string) => labTypeConfig[labType] || labTypeConfig.tna;

  return (
    <div className="min-h-screen" style={{ backgroundColor: isDark ? '#111827' : '#f3f4f6' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb items={[{ label: t('labs_title') }]} />
        </div>

        {/* Header actions */}
        {isInstructor && (
          <div className="flex justify-end mb-6 md:mb-8">
            <Button onClick={() => setShowCreateModal(true)} icon={<Plus className="w-4 h-4" />}>
              {t('teaching:create_lab', { defaultValue: 'Create lab' })}
            </Button>
          </div>
        )}

        {/* ── Interactive Labs ── */}
        <div className="mb-6 md:mb-10">
          <h2 className="text-lg sm:text-xl font-bold mb-1 flex items-center gap-2" style={{ color: colors.textPrimary }}>
            <Network className="w-5 h-5 text-blue-500" />
            {t('interactive_labs')}
          </h2>
          <p className="text-sm mb-4" style={{ color: colors.textSecondary }}>
            {t('interactive_labs_desc')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <Card hover className="cursor-pointer relative overflow-hidden" onClick={() => navigate('/labs/tna-exercise')}>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
              <CardBody className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Network className="w-6 h-6 text-white" />
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ backgroundColor: isDark ? 'rgba(96,165,250,0.2)' : '#dbeafe', color: isDark ? '#93c5fd' : '#2563eb' }}
                  >
                    {t('interactive')}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
                  {t('exercise.title')}
                </h3>
                <p className="text-sm mb-4 line-clamp-2" style={{ color: colors.textSecondary }}>
                  {t('exercise.subtitle')}
                </p>
                <div className="flex items-center justify-end">
                  <div className="inline-flex items-center gap-1 text-sm font-medium bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                    {t('exercise.start')}
                    <ArrowRight className="w-4 h-4 text-blue-500" />
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card hover className="cursor-pointer relative overflow-hidden" onClick={() => navigate('/labs/sna-exercise')}>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
              <CardBody className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ backgroundColor: isDark ? 'rgba(167,139,250,0.2)' : '#ede9fe', color: isDark ? '#c4b5fd' : '#7c3aed' }}
                  >
                    {t('interactive')}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
                  {t('sna.title')}
                </h3>
                <p className="text-sm mb-4 line-clamp-2" style={{ color: colors.textSecondary }}>
                  {t('sna.subtitle')}
                </p>
                <div className="flex items-center justify-end">
                  <div className="inline-flex items-center gap-1 text-sm font-medium bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
                    {t('exercise.start')}
                    <ArrowRight className="w-4 h-4 text-violet-500" />
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* ── R Labs ── */}
        <div className="mb-6 md:mb-10">
          <h2 className="text-lg sm:text-xl font-bold mb-1 flex items-center gap-2" style={{ color: colors.textPrimary }}>
            <Code className="w-5 h-5 text-emerald-500" />
            {t('r_labs')}
          </h2>
          <p className="text-sm mb-4" style={{ color: colors.textSecondary }}>
            {t('r_labs_desc')}
          </p>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                style={{ color: colors.textSecondary }}
              />
              <input
                type="text"
                placeholder={t('search_labs')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                }}
              />
            </div>

            <div className="relative">
              <Filter
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                style={{ color: colors.textSecondary }}
              />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="pl-10 pr-8 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
                style={{
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  minWidth: '180px',
                }}
              >
                <option value="">{t('all_types')}</option>
                {labTypes?.map((type: LabType) => (
                  <option key={type.id} value={type.id} disabled={type.disabled}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* R Labs Grid */}
          {labsLoading ? (
            <Loading text={t('loading_labs')} />
          ) : labs && labs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {labs.map((lab: CustomLab) => {
                const config = getLabConfig(lab.labType);
                const Icon = config.icon;
                const isOwner =
                  isInstructor && !!currentUser && lab.createdBy === currentUser.id;

                return (
                  <div
                    key={lab.id}
                    className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <div className={`h-1.5 bg-gradient-to-r ${config.gradient}`} />

                    <div className="flex-1 p-5">
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} text-white shrink-0`}
                        >
                          <Icon className="w-5 h-5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => navigate(`/labs/${lab.id}`)}
                            className="block w-full text-left text-base font-semibold text-gray-900 dark:text-gray-100 truncate hover:text-emerald-600"
                            title={lab.name}
                          >
                            {lab.name}
                          </button>
                          <span className="inline-flex mt-0.5 px-2 py-0.5 text-[11px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {lab.labType}
                          </span>
                        </div>
                        {lab.isPublic ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Globe className="w-3.5 h-3.5" />
                            {t('public')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                            <Lock className="w-3.5 h-3.5" />
                            {t('private')}
                          </span>
                        )}
                      </div>

                      {lab.description && (
                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                          {lab.description}
                        </p>
                      )}

                      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Code className="w-3.5 h-3.5" />
                          {t('n_cells', { count: lab._count?.templates || 0, defaultValue: '{{count}} cells' })}
                        </span>
                        {lab._count?.assignments !== undefined && lab._count.assignments > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {lab._count.assignments}
                          </span>
                        )}
                        {lab.aiChatbotId != null && (
                          <span className="flex items-center gap-1 text-violet-500" title={t('ai_assistant', { defaultValue: 'AI Assistant' })}>
                            <Sparkles className="w-3.5 h-3.5" />
                            AI
                          </span>
                        )}
                        <span className="ltr:ml-auto rtl:mr-auto">
                          {t('by_author', { name: lab.creator?.fullname || 'Unknown', defaultValue: 'by {{name}}' })}
                        </span>
                      </div>
                    </div>

                    {/* Actions — permanently visible, role-aware */}
                    <div className="flex items-center gap-1 px-3 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 flex-wrap">
                      <button
                        onClick={() => navigate(`/labs/${lab.id}`)}
                        className={`${cardAction} bg-emerald-600 text-white hover:bg-emerald-700`}
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        {t('open_lab')}
                      </button>
                      {isOwner && (
                        <>
                          <button
                            onClick={() => navigate(`/labs/${lab.id}?settings=1`)}
                            className={`${cardAction} text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700`}
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                            {t('teaching:settings', { defaultValue: 'Settings' })}
                          </button>
                          <button
                            onClick={() => duplicateLabMutation.mutate(lab.id)}
                            disabled={duplicateLabMutation.isPending}
                            className={`${cardAction} text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50`}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {t('common:duplicate', { defaultValue: 'Duplicate' })}
                          </button>
                          <span className="flex-1" />
                          <button
                            onClick={() => setDeleteLab(lab)}
                            className={`${cardAction} text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('common:delete')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardBody className="text-center py-16">
                <FlaskConical className="w-16 h-16 mx-auto mb-4" style={{ color: colors.textSecondary }} />
                <h3 className="text-xl font-semibold mb-2" style={{ color: colors.textPrimary }}>
                  {t('no_labs_available')}
                </h3>
                <p className="mb-6" style={{ color: colors.textSecondary }}>
                  {search || selectedType
                    ? t('try_adjusting_search')
                    : t('no_labs_description')}
                </p>
                {isInstructor && (
                  <Button onClick={() => setShowCreateModal(true)} icon={<Plus className="w-4 h-4" />}>
                    {t('teaching:create_lab', { defaultValue: 'Create lab' })}
                  </Button>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Create Lab */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('teaching:create_new_lab', { defaultValue: 'Create a new lab' })}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className={labelCls}>{t('teaching:lab_name', { defaultValue: 'Lab name' })} *</label>
            <input
              type="text"
              value={labForm.name}
              onChange={e => setLabForm({ ...labForm, name: e.target.value })}
              className={inputCls}
              placeholder="e.g., TNA Lab — Network Analysis"
            />
          </div>
          <div>
            <label className={labelCls}>{t('common:description')}</label>
            <textarea
              value={labForm.description}
              onChange={e => setLabForm({ ...labForm, description: e.target.value })}
              className={inputCls}
              rows={3}
            />
          </div>
          <div>
            <label className={labelCls}>{t('teaching:lab_type', { defaultValue: 'Lab type' })} *</label>
            <select
              value={labForm.labType}
              onChange={e => setLabForm({ ...labForm, labType: e.target.value })}
              className={inputCls}
            >
              {labTypes?.map((tp: LabType) => (
                <option key={tp.id} value={tp.id} disabled={tp.disabled}>
                  {tp.name} {tp.disabled ? `(${t('teaching:coming_soon', { defaultValue: 'coming soon' })})` : ''}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-100">
            <input
              type="checkbox"
              checked={labForm.addDefaultTemplates}
              onChange={e => setLabForm({ ...labForm, addDefaultTemplates: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-500"
            />
            {t('teaching:add_default_templates', { defaultValue: 'Start with example cells for this lab type' })}
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-100">
            <input
              type="checkbox"
              checked={labForm.isPublic}
              onChange={e => setLabForm({ ...labForm, isPublic: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-500"
            />
            {t('teaching:make_lab_public', { defaultValue: 'Make this lab public (visible to all users)' })}
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={() => createLabMutation.mutate(labForm)}
              disabled={!labForm.name || createLabMutation.isPending}
              icon={
                createLabMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )
              }
            >
              {createLabMutation.isPending
                ? t('teaching:creating', { defaultValue: 'Creating…' })
                : t('teaching:create_lab', { defaultValue: 'Create lab' })}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteLab}
        onClose={() => setDeleteLab(null)}
        onConfirm={() => deleteLab && deleteLabMutation.mutate(deleteLab.id)}
        title={t('teaching:delete_lab', { defaultValue: 'Delete lab' })}
        message={t('teaching:delete_lab_confirm', {
          name: deleteLab?.name ?? '',
          defaultValue: 'Are you sure you want to delete "{{name}}"? All of its cells will be deleted too.',
        })}
        loading={deleteLabMutation.isPending}
        requireSecondConfirm
      />
    </div>
  );
};
