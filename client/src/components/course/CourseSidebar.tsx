import { useState } from 'react';
import {
  BookOpen,
  ClipboardList,
  FileQuestion,
  MessageSquare,
  Bot,
  Award,
  Menu,
  X,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export type CourseSection = 'curriculum' | 'assignments' | 'quizzes' | 'forums' | 'tutors' | 'certificates';

interface Module {
  id: number;
  title: string;
  lectures?: { id: number; title: string; contentType?: string }[];
  codeLabs?: { id: number; title: string; isPublished: boolean }[];
}

interface SectionCounts {
  assignments?: number;
  quizzes?: number;
  forums?: number;
  tutors?: number;
  certificates?: number;
}

interface CourseSidebarProps {
  courseId: number;
  modules: Module[];
  activeSection: CourseSection;
  onSectionChange: (section: CourseSection) => void;
  onModuleClick?: (moduleId: number) => void;
  hasAccess: boolean;
  counts?: SectionCounts;
}

const sectionConfig: { key: CourseSection; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'curriculum', label: 'Curriculum', icon: BookOpen, color: 'primary' },
  { key: 'assignments', label: 'Assignments', icon: ClipboardList, color: 'amber' },
  { key: 'quizzes', label: 'Quizzes', icon: FileQuestion, color: 'teal' },
  { key: 'forums', label: 'Forums', icon: MessageSquare, color: 'teal' },
  { key: 'tutors', label: 'AI Tutors', icon: Bot, color: 'violet' },
  { key: 'certificates', label: 'Certificates', icon: Award, color: 'gold' },
];

export const CourseSidebar = ({
  modules,
  activeSection,
  onSectionChange,
  onModuleClick,
  counts = {},
}: CourseSidebarProps) => {
  const { isDark } = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgHover: isDark ? '#374151' : '#f9fafb',
    bgSelected: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    // Section colors
    bgPrimary: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textPrimary600: isDark ? '#a5b4fc' : '#4f46e5',
    bgAmber: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textAmber: isDark ? '#fcd34d' : '#d97706',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    textTeal: isDark ? '#5eecec' : '#088F8F',
    bgViolet: isDark ? 'rgba(139, 92, 246, 0.2)' : '#ede9fe',
    textViolet: isDark ? '#a78bfa' : '#7c3aed',
    bgGold: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
    textGold: isDark ? '#fcd34d' : '#d97706',
  };

  const getIconColors = (sectionColor: string) => {
    switch (sectionColor) {
      case 'primary':
        return { bg: colors.bgPrimary, text: colors.textPrimary600 };
      case 'amber':
        return { bg: colors.bgAmber, text: colors.textAmber };
      case 'teal':
        return { bg: colors.bgTeal, text: colors.textTeal };
      case 'violet':
        return { bg: colors.bgViolet, text: colors.textViolet };
      case 'gold':
        return { bg: colors.bgGold, text: colors.textGold };
      default:
        return { bg: colors.bgPrimary, text: colors.textPrimary600 };
    }
  };

  const handleSectionClick = (section: CourseSection) => {
    onSectionChange(section);
    setIsMobileOpen(false);
  };

  const handleModuleClick = (moduleId: number) => {
    onModuleClick?.(moduleId);
    setIsMobileOpen(false);
  };

  const sidebarContent = (
    <nav className="h-full flex flex-col">
      {/* Navigation sections */}
      <div className="flex-1 overflow-y-auto py-4">
        {sectionConfig.map(({ key, label, icon: Icon, color }) => {
          const isActive = activeSection === key;
          const iconColors = getIconColors(color);
          const count = counts[key as keyof SectionCounts];

          return (
            <div key={key}>
              <button
                onClick={() => handleSectionClick(key)}
                className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                  isActive ? 'border-l-4 border-primary-600' : 'border-l-4 border-transparent'
                }`}
                style={{
                  backgroundColor: isActive ? colors.bgSelected : 'transparent',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: iconColors.bg }}
                >
                  <Icon className="w-4 h-4" style={{ color: iconColors.text }} />
                </div>
                <span
                  className="font-medium flex-1"
                  style={{ color: isActive ? colors.textPrimary : colors.textSecondary }}
                >
                  {label}
                </span>
                {count !== undefined && count > 0 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: iconColors.bg, color: iconColors.text }}
                  >
                    {count}
                  </span>
                )}
              </button>

              {/* Curriculum - show flat module list when active */}
              {key === 'curriculum' && isActive && modules.length > 0 && (
                <div className="ml-4 border-l py-2" style={{ borderColor: colors.border }}>
                  {modules.map((module, idx) => (
                    <button
                      key={module.id}
                      onClick={() => handleModuleClick(module.id)}
                      className="w-full px-4 py-2 flex items-center gap-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                        style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary600 }}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-sm truncate" style={{ color: colors.textPrimary }}>
                        {module.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center bg-primary-600 text-white"
        aria-label="Open navigation"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: colors.bg }}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
          <h2 className="font-semibold" style={{ color: colors.textPrimary }}>
            Course Navigation
          </h2>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" style={{ color: colors.textMuted }} />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:block w-72 flex-shrink-0 border-r overflow-hidden"
        style={{ backgroundColor: colors.bg, borderColor: colors.border }}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default CourseSidebar;
