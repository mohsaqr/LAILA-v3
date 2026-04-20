import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { customLabsApi } from '../api/customLabs';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';
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
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();
  const { isInstructor } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');

  // Log page view
  useEffect(() => {
    activityLogger.logLabsViewed();
  }, []);

  // Fetch labs
  const { data: labs, isLoading: labsLoading } = useQuery({
    queryKey: ['labs', { search, labType: selectedType }],
    queryFn: () => customLabsApi.getLabs({ search, labType: selectedType || undefined }),
  });

  // Fetch lab types
  const { data: labTypes } = useQuery({
    queryKey: ['labTypes'],
    queryFn: customLabsApi.getLabTypes,
  });

  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#4b5563',
    border: isDark ? '#374151' : '#e5e7eb',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    inputBg: isDark ? '#374151' : '#ffffff',
    badge: isDark ? 'rgba(52, 211, 153, 0.2)' : '#d1fae5',
    badgeText: isDark ? '#6ee7b7' : '#059669',
  };

  const getLabConfig = (labType: string) => {
    return labTypeConfig[labType] || labTypeConfig.tna;
  };

  const handleLabClick = (lab: CustomLab) => {
    navigate(`/labs/${lab.id}`);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: isDark ? '#111827' : '#f3f4f6' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb items={[{ label: t('labs_title') }]} />
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3" style={{ color: colors.textPrimary }}>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center">
                <FlaskConical className="w-6 h-6 text-white" />
              </div>
              {t('labs_title')}
            </h1>
            <p className="mt-2" style={{ color: colors.textSecondary }}>
              {t('labs_description')}
            </p>
          </div>

          {isInstructor && (
            <Button
              onClick={() => navigate('/teach/labs')}
              icon={<Plus className="w-4 h-4" />}
            >
              {t('manage_labs')}
            </Button>
          )}
        </div>

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

                return (
                  <Card
                    key={lab.id}
                    hover
                    className="cursor-pointer relative overflow-hidden"
                    onClick={() => handleLabClick(lab)}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.gradient}`} />
                    <CardBody className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className={`w-12 h-12 rounded-xl bg-gradient-to-r ${config.gradient} flex items-center justify-center`}
                        >
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex items-center gap-2">
                          {lab.isPublic ? (
                            <span
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                              style={{ backgroundColor: colors.badge, color: colors.badgeText }}
                            >
                              <Globe className="w-3 h-3" />
                              {t('public')}
                            </span>
                          ) : (
                            <span
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                              style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.textSecondary }}
                            >
                              <Lock className="w-3 h-3" />
                              {t('private')}
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
                        {lab.name}
                      </h3>

                      {lab.description && (
                        <p className="text-sm mb-4 line-clamp-2" style={{ color: colors.textSecondary }}>
                          {lab.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm mb-4 flex-wrap" style={{ color: colors.textSecondary }}>
                        <span className="flex items-center gap-1">
                          <Code className="w-4 h-4" />
                          {t('n_templates', { count: lab._count?.templates || 0 })}
                        </span>
                        {lab._count?.assignments !== undefined && lab._count.assignments > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {lab._count.assignments} course{lab._count.assignments !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: colors.textSecondary }}>
                          by {lab.creator?.fullname || 'Unknown'}
                        </span>
                        <div
                          className={`inline-flex items-center gap-1 text-sm font-medium bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent`}
                        >
                          {t('open_lab')}
                          <ArrowRight className="w-4 h-4 text-emerald-500" />
                        </div>
                      </div>
                    </CardBody>
                  </Card>
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
                  <Button onClick={() => navigate('/teach/labs')} icon={<Plus className="w-4 h-4" />}>
                    {t('manage_labs')}
                  </Button>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
