import type { LucideIcon } from 'lucide-react';
import { Lock } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import type { StepId } from './stepGates';

export interface StepperItem {
  id: StepId;
  label: string;
  icon: LucideIcon;
}

interface StepperProps {
  steps: StepperItem[];
  activeStep: StepId;
  unlockedSteps: Set<StepId>;
  onStepClick: (id: StepId) => void;
  /** Localised tooltip when a locked step is hovered. */
  lockedTooltip?: string;
}

export const Stepper = ({
  steps,
  activeStep,
  unlockedSteps,
  onStepClick,
  lockedTooltip,
}: StepperProps) => {
  const { isDark } = useTheme();

  return (
    <div
      className="relative -mx-4 sm:-mx-0 px-4 sm:px-0 overflow-x-auto"
      role="tablist"
      aria-label="Wizard steps"
    >
      <div className="inline-flex sm:flex sm:w-full items-stretch gap-1.5 sm:gap-2">
        {steps.map((step, index) => {
          const isActive = step.id === activeStep;
          const isUnlocked = unlockedSteps.has(step.id);
          const Icon = step.icon;

          const baseClass =
            'group inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap select-none flex-1 sm:justify-center';

          const stateStyle: React.CSSProperties = isActive
            ? { backgroundColor: '#088F8F', color: '#ffffff', boxShadow: '0 1px 3px rgba(8,143,143,0.30)' }
            : isUnlocked
              ? {
                  backgroundColor: isDark ? 'rgba(8,143,143,0.10)' : '#ecfeff',
                  color: isDark ? '#5eecec' : '#065c5c',
                }
              : {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6',
                  color: isDark ? '#6b7280' : '#9ca3af',
                  cursor: 'not-allowed',
                };

          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={!isUnlocked}
              disabled={!isUnlocked}
              title={!isUnlocked ? lockedTooltip : undefined}
              onClick={() => isUnlocked && onStepClick(step.id)}
              className={`${baseClass} ${isUnlocked && !isActive ? 'hover:-translate-y-0.5 hover:shadow-sm' : ''}`}
              style={stateStyle}
            >
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold shrink-0"
                style={{
                  backgroundColor: isActive
                    ? 'rgba(255,255,255,0.22)'
                    : isUnlocked
                      ? isDark
                        ? 'rgba(8,143,143,0.20)'
                        : '#ccfbfb'
                      : isDark
                        ? 'rgba(255,255,255,0.08)'
                        : '#e5e7eb',
                }}
              >
                {!isUnlocked ? <Lock className="w-3 h-3" /> : index + 1}
              </span>
              <Icon className="w-4 h-4 shrink-0" strokeWidth={2.25} />
              <span>{step.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
