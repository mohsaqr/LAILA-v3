import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, ArrowRight, Shuffle, Swords, ChevronDown, ChevronUp, Bot } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../common/Button';
import type { TutorAgent, CollaborativeStyle, CollaborativeSettings } from '../../types/tutor';

interface CollaborativePickerProps {
  agents: TutorAgent[];
  onSettingsChange: (settings: CollaborativeSettings) => void;
  currentSettings: CollaborativeSettings;
  disabled?: boolean;
}

const STYLE_OPTIONS: {
  value: CollaborativeStyle;
  labelKey: string;
  descriptionKey: string;
  icon: React.ElementType;
}[] = [
  {
    value: 'parallel',
    labelKey: 'style_parallel',
    descriptionKey: 'style_parallel_desc',
    icon: Users,
  },
  {
    value: 'sequential',
    labelKey: 'style_sequential',
    descriptionKey: 'style_sequential_desc',
    icon: ArrowRight,
  },
  {
    value: 'debate',
    labelKey: 'style_debate',
    descriptionKey: 'style_debate_desc',
    icon: Swords,
  },
  {
    value: 'random',
    labelKey: 'style_random',
    descriptionKey: 'style_random_desc',
    icon: Shuffle,
  },
];

export const CollaborativePicker = ({
  agents,
  onSettingsChange,
  currentSettings,
  disabled = false,
}: CollaborativePickerProps) => {
  const { isDark } = useTheme();
  const { t } = useTranslation(['tutors', 'common']);
  const [expanded, setExpanded] = useState(false);

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgHover: isDark ? '#374151' : '#f9fafb',
    border: isDark ? '#374151' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    accent: '#3b82f6',
    accentBg: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
    selectedBorder: isDark ? '#3b82f6' : '#93c5fd',
    checkboxBg: isDark ? '#374151' : '#e5e7eb',
  };

  const selectedAgents = currentSettings.selectedAgentIds || [];
  const style = currentSettings.style || 'parallel';

  const handleStyleChange = (newStyle: CollaborativeStyle) => {
    onSettingsChange({ ...currentSettings, style: newStyle });
  };

  const handleAgentToggle = (agentId: number) => {
    const currentSelected = selectedAgents;
    const newSelected = currentSelected.includes(agentId)
      ? currentSelected.filter((id) => id !== agentId)
      : [...currentSelected, agentId];

    onSettingsChange({
      ...currentSettings,
      selectedAgentIds: newSelected.length > 0 ? newSelected : undefined,
    });
  };

  const handleSelectAll = () => {
    onSettingsChange({
      ...currentSettings,
      selectedAgentIds: agents.map((a) => a.id),
    });
  };

  const handleClearAll = () => {
    onSettingsChange({
      ...currentSettings,
      selectedAgentIds: undefined,
    });
  };

  const getPersonalityColor = (personality: string | null) => {
    switch (personality) {
      case 'socratic':
        return 'from-purple-500 to-indigo-500';
      case 'friendly':
        return 'from-green-500 to-emerald-500';
      case 'casual':
        return 'from-orange-500 to-amber-500';
      case 'professional':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const selectedCount = selectedAgents.length;
  const displayText = selectedCount > 0
    ? (selectedCount > 1 ? t('n_tutors_selected_plural', { count: selectedCount }) : t('n_tutors_selected', { count: selectedCount }))
    : t('auto_select_short');

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={{ borderColor: colors.border, backgroundColor: colors.bg }}
    >
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        disabled={disabled}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-opacity-50 transition-colors"
        style={{ backgroundColor: expanded ? colors.accentBg : 'transparent' }}
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: colors.accent }} />
          <div className="text-left">
            <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>
              {t('team_settings')}
            </span>
            <span className="text-xs ml-2" style={{ color: colors.textSecondary }}>
              {displayText} · {t(STYLE_OPTIONS.find(s => s.value === style)?.labelKey || 'style_parallel')}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4" style={{ color: colors.textSecondary }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: colors.textSecondary }} />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t px-3 py-3 space-y-4" style={{ borderColor: colors.border }}>
          {/* Style selector */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: colors.textSecondary }}>
              {t('collaboration_style')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = style === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleStyleChange(option.value)}
                    disabled={disabled}
                    className="flex items-center gap-2 p-2 rounded-lg border transition-all text-left"
                    style={{
                      borderColor: isSelected ? colors.selectedBorder : colors.border,
                      backgroundColor: isSelected ? colors.accentBg : 'transparent',
                    }}
                  >
                    <Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: isSelected ? colors.accent : colors.textSecondary }}
                    />
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: isSelected ? colors.accent : colors.textPrimary }}
                      >
                        {t(option.labelKey)}
                      </p>
                      <p className="text-xs truncate" style={{ color: colors.textSecondary }}>
                        {t(option.descriptionKey)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tutor picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                {t('select_tutors')}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={disabled}
                  className="text-xs px-2 py-1"
                >
                  {t('all')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={disabled}
                  className="text-xs px-2 py-1"
                >
                  {t('clear')}
                </Button>
              </div>
            </div>

            {/* Auto-select indicator */}
            <div
              className="flex items-center gap-2 p-2 rounded-lg mb-2 border"
              style={{
                backgroundColor: selectedAgents.length === 0 ? colors.accentBg : 'transparent',
                borderColor: selectedAgents.length === 0 ? colors.selectedBorder : colors.border,
              }}
            >
              <input
                type="radio"
                checked={selectedAgents.length === 0}
                onChange={handleClearAll}
                disabled={disabled}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                  {t('auto_select')}
                </p>
                <p className="text-xs" style={{ color: colors.textSecondary }}>
                  {t('auto_select_desc')}
                </p>
              </div>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {agents.map((agent) => {
                const isSelected = selectedAgents.includes(agent.id);
                return (
                  <label
                    key={agent.id}
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: isSelected ? colors.accentBg : 'transparent',
                      border: isSelected ? `1px solid ${colors.selectedBorder}` : '1px solid transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleAgentToggle(agent.id)}
                      disabled={disabled}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${getPersonalityColor(agent.personality)} text-white flex-shrink-0`}
                    >
                      {agent.avatarUrl ? (
                        <img
                          src={agent.avatarUrl}
                          alt={agent.displayName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: colors.textPrimary }}
                      >
                        {agent.displayName}
                      </p>
                      <p className="text-xs truncate" style={{ color: colors.textSecondary }}>
                        {agent.description || agent.personality || t('ai_tutor')}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Tip based on style */}
          <div
            className="text-xs p-2 rounded-lg"
            style={{ backgroundColor: colors.bgHover, color: colors.textSecondary }}
          >
            {style === 'parallel' && t('tip_parallel')}
            {style === 'sequential' && t('tip_sequential')}
            {style === 'debate' && t('tip_debate')}
            {style === 'random' && t('tip_random')}
            {' '}{t('tip_mention')}
          </div>
        </div>
      )}
    </div>
  );
};
