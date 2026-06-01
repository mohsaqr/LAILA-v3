import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import type { StepId } from './stepGates';
import { STEP_ORDER } from './stepGates';

export interface StepperItem {
  id: StepId;
  label: string;
  icon?: LucideIcon;
}

interface StepperProps {
  steps: StepperItem[];
  activeStep: StepId;
  unlockedSteps: Set<StepId>;
  onStepClick: (id: StepId) => void;
  /** Localised tooltip when a locked step is hovered. */
  lockedTooltip?: string;
}

/**
 * Minimal text-based step nav (matches the design reference at
 * Image #21): each step is a row of "circle / icon + label" with an
 * underline on the active step. Completed steps get a checkmark.
 * No pills, no lock icons — keep it light.
 */
export const Stepper = ({
  steps,
  activeStep,
  unlockedSteps,
  onStepClick,
  lockedTooltip,
}: StepperProps) => {
  const { isDark } = useTheme();
  const activeIndex = STEP_ORDER.indexOf(activeStep);

  const baseColor = isDark ? '#9ca3af' : '#6b7280';
  const mutedColor = isDark ? '#4b5563' : '#9ca3af';
  const activeColor = isDark ? '#f3f4f6' : '#0f172a';
  const accent = '#088F8F';
  const dividerColor = isDark ? '#374151' : '#e5e7eb';

  return (
    <div
      className="relative -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto"
      role="tablist"
      aria-label="Wizard steps"
    >
      <div
        className="flex items-end gap-6 sm:gap-8 border-b min-w-max"
        style={{ borderColor: dividerColor }}
      >
        {steps.map((step, index) => {
          const isActive = step.id === activeStep;
          const isUnlocked = unlockedSteps.has(step.id);
          const isCompleted = !isActive && index < activeIndex && isUnlocked;

          let badgeBg = 'transparent';
          let badgeFg = mutedColor;
          let labelColor = mutedColor;
          let badgeBorder = mutedColor;

          if (isActive) {
            badgeBg = accent;
            badgeFg = '#ffffff';
            labelColor = activeColor;
            badgeBorder = accent;
          } else if (isCompleted) {
            badgeBg = 'transparent';
            badgeFg = accent;
            labelColor = baseColor;
            badgeBorder = accent;
          } else if (isUnlocked) {
            badgeBg = 'transparent';
            badgeFg = baseColor;
            labelColor = baseColor;
            badgeBorder = baseColor;
          }

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
              className={`relative inline-flex items-center gap-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors ${
                !isUnlocked ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
              style={{ color: labelColor }}
            >
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold border shrink-0"
                style={{
                  backgroundColor: badgeBg,
                  color: badgeFg,
                  borderColor: badgeBorder,
                }}
              >
                {isCompleted ? <Check className="w-3 h-3" strokeWidth={3} /> : index + 1}
              </span>
              <span>{step.label}</span>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 -bottom-px h-0.5"
                  style={{ backgroundColor: accent }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
