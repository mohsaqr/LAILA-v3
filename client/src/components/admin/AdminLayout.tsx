import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';
import { Breadcrumb, BreadcrumbItem } from '../common/Breadcrumb';
import { buildAdminBreadcrumb } from '../../utils/breadcrumbs';

interface AdminLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  headerActions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

export const AdminLayout = ({
  title,
  description,
  children,
  headerActions,
  breadcrumbs,
}: AdminLayoutProps) => {
  const { t } = useTranslation(['admin']);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Default breadcrumbs for admin pages
  const defaultBreadcrumbs = buildAdminBreadcrumb(title);
  const breadcrumbItems = breadcrumbs || defaultBreadcrumbs;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb navigation */}
        <div className="mb-4">
          <Breadcrumb items={breadcrumbItems} homeHref="/admin" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? t('close_menu') : t('open_menu')}
            >
              {sidebarOpen ? (
                <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              )}
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
              {description && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">{description}</p>
              )}
            </div>
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>

        {/* Main layout with sidebar */}
        <div className="flex gap-8">
          {/* Mobile backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-30 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar - hidden on mobile, overlay when toggled */}
          <div
            className={`
              fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 p-4 transform
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              md:relative md:translate-x-0 md:p-0 md:bg-transparent dark:md:bg-transparent
              transition-transform duration-200 ease-in-out
            `}
          >
            <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
          </div>

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
};
