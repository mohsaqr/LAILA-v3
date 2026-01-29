/**
 * Pedagogical Role Selector Component
 *
 * Allows students to select from 10 educational agent roles,
 * each with pre-configured templates and suggestions.
 */

import { useState } from 'react';
import {
  Users,
  Heart,
  HelpCircle,
  PenTool,
  Search,
  Scale,
  Lightbulb,
  Briefcase,
  Globe,
  Target,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PedagogicalRoleConfig } from '../../types';
import { PEDAGOGICAL_ROLES } from '../../config/pedagogicalRoles';

// Icon mapping
const ICON_MAP: Record<string, React.ElementType> = {
  Users,
  Heart,
  HelpCircle,
  PenTool,
  Search,
  Scale,
  Lightbulb,
  Briefcase,
  Globe,
  Target,
};

interface PedagogicalRoleSelectorProps {
  selectedRole: string | null;
  onRoleSelect: (role: PedagogicalRoleConfig) => void;
  disabled?: boolean;
}

export const PedagogicalRoleSelector = ({
  selectedRole,
  onRoleSelect,
  disabled = false,
}: PedagogicalRoleSelectorProps) => {
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const handleRoleClick = (role: PedagogicalRoleConfig) => {
    if (disabled) return;

    if (expandedRole === role.id) {
      // If clicking the expanded role, collapse it
      setExpandedRole(null);
    } else {
      // Expand this role to show details
      setExpandedRole(role.id);
    }
  };

  const handleSelectRole = (role: PedagogicalRoleConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onRoleSelect(role);
    setExpandedRole(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Pedagogical Role
        </label>
        {selectedRole && (
          <span className="text-xs text-violet-600 font-medium">
            {PEDAGOGICAL_ROLES.find((r) => r.id === selectedRole)?.name}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500">
        Choose a role template to get started quickly, or skip to create your own agent from scratch.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PEDAGOGICAL_ROLES.map((role) => {
          const Icon = ICON_MAP[role.icon] || Users;
          const isSelected = selectedRole === role.id;
          const isExpanded = expandedRole === role.id;

          return (
            <div
              key={role.id}
              className={`relative rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div
                onClick={() => handleRoleClick(role)}
                className="p-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-medium ${isSelected ? 'text-violet-900' : 'text-gray-900'}`}>
                        {role.name}
                      </h3>
                      <div className="flex items-center gap-1">
                        {isSelected && (
                          <Check className="w-4 h-4 text-violet-600" />
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {role.description}
                    </p>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    <div>
                      <h4 className="text-xs font-medium text-gray-700 mb-1">
                        What this role provides:
                      </h4>
                      <ul className="text-xs text-gray-600 space-y-1">
                        <li className="flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">+</span>
                          <span>Pre-written system prompt</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">+</span>
                          <span>Suggested do's and don'ts</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">+</span>
                          <span>Recommended personality style</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">+</span>
                          <span>Example welcome message</span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-gray-50 rounded p-2">
                      <h4 className="text-xs font-medium text-gray-700 mb-1">
                        Example welcome:
                      </h4>
                      <p className="text-xs text-gray-600 italic">
                        "{role.exampleWelcome}"
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleSelectRole(role, e)}
                      disabled={disabled}
                      className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-violet-600 text-white hover:bg-violet-700'
                          : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Use This Role'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-2">
        You can customize any template after selecting it. All fields remain editable.
      </p>
    </div>
  );
};
