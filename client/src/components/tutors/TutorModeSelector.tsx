import { Radio, Users, Sparkles } from 'lucide-react';
import type { TutorMode } from '../../types/tutor';

interface TutorModeSelectorProps {
  mode: TutorMode;
  onModeChange: (mode: TutorMode) => void;
  disabled?: boolean;
}

const modes: { value: TutorMode; label: string; description: string; icon: React.ElementType }[] = [
  {
    value: 'manual',
    label: 'Manual',
    description: 'Choose which tutor responds',
    icon: Radio,
  },
  {
    value: 'router',
    label: 'Auto-Route',
    description: 'AI picks the best tutor',
    icon: Sparkles,
  },
  {
    value: 'collaborative',
    label: 'Team',
    description: 'All tutors contribute',
    icon: Users,
  },
];

export const TutorModeSelector = ({
  mode,
  onModeChange,
  disabled = false,
}: TutorModeSelectorProps) => {
  return (
    <div className="p-3 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        Mode
      </p>
      <div className="space-y-1">
        {modes.map((m) => {
          const Icon = m.icon;
          const isSelected = mode === m.value;
          return (
            <button
              key={m.value}
              onClick={() => onModeChange(m.value)}
              disabled={disabled}
              className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                isSelected
                  ? 'bg-primary-50 text-primary-700 border border-primary-200'
                  : 'hover:bg-gray-50 text-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  isSelected ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                <Icon className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-gray-500 truncate">{m.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
