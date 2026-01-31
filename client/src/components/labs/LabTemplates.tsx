import { Code, ChevronRight } from 'lucide-react';
import { LabTemplate } from '../../types';
import { useTheme } from '../../hooks/useTheme';

interface LabTemplatesProps {
  templates: LabTemplate[];
  selectedTemplateId: number | null;
  onSelectTemplate: (template: LabTemplate) => void;
}

export const LabTemplates = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
}: LabTemplatesProps) => {
  const { isDark } = useTheme();

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgHover: isDark ? '#374151' : '#f3f4f6',
    bgSelected: isDark ? '#1e40af' : '#dbeafe',
    border: isDark ? '#374151' : '#e5e7eb',
    text: isDark ? '#e5e7eb' : '#1f2937',
    textMuted: isDark ? '#9ca3af' : '#6b7280',
    textSelected: isDark ? '#93c5fd' : '#1e40af',
  };

  if (templates.length === 0) {
    return (
      <div
        className="rounded-lg border p-4 text-center"
        style={{ backgroundColor: colors.bg, borderColor: colors.border }}
      >
        <Code className="w-8 h-8 mx-auto mb-2" style={{ color: colors.textMuted }} />
        <p className="text-sm" style={{ color: colors.textMuted }}>
          No templates available
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: colors.border }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b"
        style={{
          backgroundColor: isDark ? '#111827' : '#f9fafb',
          borderColor: colors.border,
        }}
      >
        <h3 className="font-medium flex items-center gap-2" style={{ color: colors.text }}>
          <Code className="w-4 h-4" />
          Templates
        </h3>
        <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
          Click to load into editor
        </p>
      </div>

      {/* Template List */}
      <div style={{ backgroundColor: colors.bg }}>
        {templates
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((template) => {
            const isSelected = selectedTemplateId === template.id;
            return (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className="w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors flex items-center gap-3 group"
                style={{
                  backgroundColor: isSelected ? colors.bgSelected : 'transparent',
                  borderColor: colors.border,
                }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                  style={{
                    backgroundColor: isSelected
                      ? (isDark ? '#3b82f6' : '#2563eb')
                      : (isDark ? '#374151' : '#e5e7eb'),
                    color: isSelected
                      ? '#ffffff'
                      : colors.textMuted,
                  }}
                >
                  {template.orderIndex + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-medium truncate"
                    style={{
                      color: isSelected ? colors.textSelected : colors.text,
                    }}
                  >
                    {template.title}
                  </p>
                  {template.description && (
                    <p
                      className="text-xs truncate mt-0.5"
                      style={{ color: colors.textMuted }}
                    >
                      {template.description}
                    </p>
                  )}
                </div>
                <ChevronRight
                  className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: isSelected ? colors.textSelected : colors.textMuted }}
                />
              </button>
            );
          })}
      </div>
    </div>
  );
};
