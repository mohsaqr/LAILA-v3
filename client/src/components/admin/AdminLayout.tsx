import { ReactNode } from 'react';
import { Breadcrumb, BreadcrumbItem } from '../common/Breadcrumb';
import { buildAdminBreadcrumb } from '../../utils/breadcrumbs';

interface AdminLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  headerActions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  fullWidth?: boolean;
}

/**
 * Content wrapper for admin pages.
 *
 * Renders the canonical breadcrumb + an optional header-actions row +
 * children, inside the standard `max-w-7xl` container that all other
 * pages use. The page title and description are no longer rendered
 * here — the breadcrumb's final segment already conveys the page
 * label. The `title`/`description` props are retained as no-ops for
 * backwards compatibility with existing call sites; `title` still
 * feeds the default breadcrumb when `breadcrumbs` isn't supplied.
 */
export const AdminLayout = ({
  title,
  children,
  headerActions,
  breadcrumbs,
}: AdminLayoutProps) => {
  const defaultBreadcrumbs = buildAdminBreadcrumb(title);
  const breadcrumbItems = breadcrumbs || defaultBreadcrumbs;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} homeHref="/admin" />
      </div>

      {/* Header actions (if any) */}
      {headerActions && (
        <div className="flex items-center justify-end gap-2 mb-6">{headerActions}</div>
      )}

      {/* Page content */}
      <div>{children}</div>
    </div>
  );
};
