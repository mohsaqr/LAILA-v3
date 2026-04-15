import { ReactNode } from 'react';
import { Breadcrumb, BreadcrumbItem } from '../common/Breadcrumb';
import { buildAdminBreadcrumb } from '../../utils/breadcrumbs';

interface AdminLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  headerActions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  /**
   * Retained for compatibility with existing call sites — admin pages
   * now always use the main app shell's centred max-w-7xl container, so
   * this flag no longer toggles anything. Kept as an accepted prop to
   * avoid touching every admin page that passes it.
   */
  fullWidth?: boolean;
}

/**
 * Content wrapper for admin pages.
 *
 * Previously this component drew its own full-page shell (navbar,
 * sidebar, backdrop), which swapped out the main Layout's UI entirely
 * on /admin. Now it renders **inside** the main `Layout` so the
 * navbar, `DashboardSidebar`, container width, and page chrome stay
 * identical to /dashboard and /courses. `DashboardSidebar` itself
 * swaps its menu items to the admin set when it detects /admin/* in
 * the URL — so admins see the same sidebar position with admin links.
 *
 * This component is now just breadcrumb + title + header actions +
 * children inside the standard `max-w-7xl` container that all other
 * pages use.
 */
export const AdminLayout = ({
  title,
  description,
  children,
  headerActions,
  breadcrumbs,
}: AdminLayoutProps) => {
  const defaultBreadcrumbs = buildAdminBreadcrumb(title);
  const breadcrumbItems = breadcrumbs || defaultBreadcrumbs;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Breadcrumb items={breadcrumbItems} homeHref="/admin" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {title}
          </h1>
          {description && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">{description}</p>
          )}
        </div>
        {headerActions && (
          <div className="flex items-center gap-2 flex-shrink-0">{headerActions}</div>
        )}
      </div>

      {/* Page content */}
      <div>{children}</div>
    </div>
  );
};
