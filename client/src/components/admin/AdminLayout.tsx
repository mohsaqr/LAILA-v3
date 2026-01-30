import { ReactNode, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';

interface AdminLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  headerActions?: ReactNode;
}

export const AdminLayout = ({
  title,
  description,
  children,
  headerActions,
}: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            >
              {sidebarOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {description && (
                <p className="text-gray-600 mt-1">{description}</p>
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
              fixed inset-y-0 left-0 z-40 w-64 bg-white p-4 transform
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              md:relative md:translate-x-0 md:p-0 md:bg-transparent
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
