import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BarChart3,
  Settings,
  Bot,
  Blocks,
  MessageSquare,
  Network,
  Tag,
  FileQuestion,
} from 'lucide-react';

interface AdminSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const AdminSidebar = ({ className = '', onNavigate }: AdminSidebarProps) => {
  const { t } = useTranslation(['admin']);
  const location = useLocation();

  const groups: NavGroup[] = [
    {
      label: t('overview'),
      items: [
        { path: '/admin', label: t('frontpage'), icon: LayoutDashboard, exact: true },
      ],
    },
    {
      label: t('people'),
      items: [
        { path: '/admin/settings?tab=users', label: t('users'), icon: Users },
        { path: '/admin/settings?tab=enrollments', label: t('enrollments'), icon: GraduationCap },
      ],
    },
    {
      label: t('content'),
      items: [
        { path: '/admin/settings?tab=categories', label: t('categories'), icon: Tag },
        { path: '/admin/chatbot-registry', label: t('chatbots'), icon: MessageSquare },
        { path: '/admin/prompt-blocks', label: t('prompts'), icon: Blocks },
      ],
    },
    {
      label: t('ai'),
      items: [
        { path: '/admin/settings?tab=llm', label: t('llm'), icon: Bot },
        { path: '/admin/settings?tab=mcq', label: t('mcq_generation'), icon: FileQuestion },
      ],
    },
    {
      label: t('insights'),
      items: [
        { path: '/admin/analytics', label: t('analytics'), icon: Network },
        { path: '/admin/logs', label: t('logs'), icon: BarChart3 },
      ],
    },
    {
      label: t('system'),
      items: [
        { path: '/admin/settings?tab=system', label: t('system_label'), icon: Settings },
      ],
    },
  ];

  const isActive = (item: NavItem) => {
    if (item.exact) {
      return location.pathname === item.path.split('?')[0] && !location.search;
    }
    // /admin/settings with no tab defaults to users
    if (item.path === '/admin/settings?tab=users') {
      if (location.pathname === '/admin/settings' && !location.search) {
        return true;
      }
    }
    if (item.path.includes('?')) {
      const [path, search] = item.path.split('?');
      return location.pathname === path && location.search === `?${search}`;
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <nav className={`w-56 flex-shrink-0 ${className}`}>
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={onNavigate}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                        active
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
};
