import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  GraduationCap,
  BrainCircuit,
  Settings,
  Shield,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
  Eye,
  EyeOff,
  MessagesSquare,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { ViewAsRole } from '../../store/authStore';
import { ThemeToggle } from '../common/ThemeToggle';

export const Navbar = () => {
  const { user, isAuthenticated, isAdmin, isActualAdmin, isActualInstructor, viewAsRole, setViewAs, isViewingAs, logout } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isViewAsMenuOpen, setIsViewAsMenuOpen] = useState(false);

  // View As options depend on actual user role
  const viewAsOptions: { role: ViewAsRole; label: string; description: string }[] = isActualAdmin
    ? [
        { role: null, label: 'View as Admin', description: 'Full admin access' },
        { role: 'instructor', label: 'View as Instructor', description: 'Test instructor view' },
        { role: 'student', label: 'View as Student', description: 'Test student view' },
      ]
    : [
        { role: null, label: 'View as Instructor', description: 'Full instructor access' },
        { role: 'student', label: 'View as Student', description: 'Test student view' },
      ];

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: BookOpen },
    { path: '/courses', label: 'Courses', icon: GraduationCap },
    { path: '/ai-tools', label: 'AI Tools', icon: BrainCircuit },
    { path: '/ai-tutors', label: 'Chat Tutors', icon: MessagesSquare },
    ...(isAdmin ? [{ path: '/admin', label: 'Admin', icon: Shield }] : []),
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav
      id="main-navigation"
      className="shadow-sm border-b sticky top-0 z-50"
      style={{
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#f3f4f6',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                <BrainCircuit className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                LAILA
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.path)
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* View As Button - For admins and instructors */}
            {isAuthenticated && (isActualAdmin || isActualInstructor) && (
              <div className="relative">
                <button
                  onClick={() => setIsViewAsMenuOpen(!isViewAsMenuOpen)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isViewingAs
                      ? 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700'
                      : 'hover:bg-gray-50 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {isViewingAs ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                  <span className="hidden sm:block text-sm font-medium">
                    {isViewingAs
                      ? `Viewing as ${viewAsRole === 'instructor' ? 'Instructor' : 'Student'}`
                      : 'View As'}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {isViewAsMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Test Role Views</p>
                    </div>
                    {viewAsOptions.map((option) => (
                      <button
                        key={option.role || 'admin'}
                        onClick={() => {
                          setViewAs(option.role);
                          setIsViewAsMenuOpen(false);
                        }}
                        className={`flex flex-col items-start w-full px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          (option.role === null && !viewAsRole) || option.role === viewAsRole
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
                      </button>
                    ))}
                    {isViewingAs && (
                      <>
                        <hr className="my-1 border-gray-100 dark:border-gray-700" />
                        <button
                          onClick={() => {
                            setViewAs(null);
                            setIsViewAsMenuOpen(false);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <EyeOff className="w-4 h-4" />
                          Exit Test Mode
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user?.fullname?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200">
                    {user?.fullname}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1">
                    <Link
                      to="/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    <hr className="my-1 border-gray-100 dark:border-gray-700" />
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  Sign In
                </Link>
                <Link to="/register" className="btn btn-primary text-sm">
                  Get Started
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 dark:border-gray-700">
            {navItems.map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                      isActive(item.path)
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
          </div>
        )}
      </div>
    </nav>
  );
};
