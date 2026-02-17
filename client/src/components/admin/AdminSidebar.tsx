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
} from 'lucide-react';

interface AdminSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export const AdminSidebar = ({ className = '', onNavigate }: AdminSidebarProps) => {
  const { t } = useTranslation(['admin']);
  const location = useLocation();

  const sidebarItems = [
    { path: '/admin', label: t('frontpage'), icon: LayoutDashboard, exact: true },
    { path: '/admin/dashboard', label: t('dashboard'), icon: Network },
    { path: '/admin/settings?tab=users', label: t('users'), icon: Users },
    { path: '/admin/settings?tab=enrollments', label: t('enrollments'), icon: GraduationCap },
    { path: '/admin/logs', label: t('logs'), icon: BarChart3 },
    { path: '/admin/chatbot-registry', label: t('chatbots'), icon: MessageSquare },
    { path: '/admin/settings?tab=llm', label: t('llm'), icon: Bot },
    { path: '/admin/settings?tab=system', label: t('system_label'), icon: Settings },
    { path: '/admin/prompt-blocks', label: t('prompts'), icon: Blocks },
  ];

  const isActive = (item: typeof sidebarItems[0]) => {
    if (item.exact) {
      return location.pathname === item.path.split('?')[0] && !location.search;
    }
    // Special case: /admin/settings with no tab defaults to users
    if (item.path === '/admin/settings?tab=users') {
      if (location.pathname === '/admin/settings' && !location.search) {
        return true;
      }
    }
    // For items with query params, check both path and search
    if (item.path.includes('?')) {
      const [path, search] = item.path.split('?');
      return location.pathname === path && location.search === `?${search}`;
    }
    // For items without query params, check if pathname starts with the path
    return location.pathname.startsWith(item.path);
  };

  const handleClick = () => {
    onNavigate?.();
  };

  return (
    <nav className={`w-64 flex-shrink-0 ${className}`}>
      <ul className="space-y-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          return (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={handleClick}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                  active
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
