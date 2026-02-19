import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  CheckCheck,
  GraduationCap,
  Clock,
  Megaphone,
  MessageSquare,
  Award,
  UserPlus,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { connectSocket, disconnectSocket } from '../../services/socket';
import { Notification, NotificationType } from '../../api/notifications';

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'grade_posted':
      return GraduationCap;
    case 'deadline_approaching':
      return Clock;
    case 'announcement':
      return Megaphone;
    case 'forum_reply':
      return MessageSquare;
    case 'certificate':
      return Award;
    case 'enrollment':
      return UserPlus;
    default:
      return Bell;
  }
};

const getTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

interface NotificationItemProps {
  notification: Notification;
  onRead: () => void;
  onClick: () => void;
}

const NotificationItem = ({ notification, onRead, onClick }: NotificationItemProps) => {
  const { isDark } = useTheme();
  const Icon = getNotificationIcon(notification.type);

  const handleClick = () => {
    if (!notification.isRead) {
      onRead();
    }
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left px-4 py-3 flex gap-3 transition-colors"
      style={{
        backgroundColor: notification.isRead
          ? 'transparent'
          : isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
      }}
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: isDark ? '#374151' : '#f3f4f6',
        }}
      >
        <Icon
          className="w-5 h-5"
          style={{
            color: notification.isRead
              ? (isDark ? '#9ca3af' : '#6b7280')
              : (isDark ? '#818cf8' : '#6366f1'),
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{
            color: isDark ? '#f3f4f6' : '#111827',
          }}
        >
          {notification.title}
        </p>
        <p
          className="text-xs mt-0.5 line-clamp-2"
          style={{
            color: isDark ? '#9ca3af' : '#6b7280',
          }}
        >
          {notification.message}
        </p>
        <p
          className="text-xs mt-1"
          style={{
            color: isDark ? '#6b7280' : '#9ca3af',
          }}
        >
          {getTimeAgo(notification.createdAt)}
        </p>
      </div>
      {!notification.isRead && (
        <div
          className="flex-shrink-0 w-2 h-2 rounded-full mt-2"
          style={{
            backgroundColor: isDark ? '#818cf8' : '#6366f1',
          }}
        />
      )}
    </button>
  );
};

export const NotificationBell = () => {
  const { t } = useTranslation('notifications');
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore(s => s.user);

  const {
    notifications,
    unreadCount,
    isLoading,
    isDropdownOpen,
    hasMore,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    setDropdownOpen,
  } = useNotificationStore();

  // Fetch initial count and connect socket for real-time updates
  useEffect(() => {
    fetchUnreadCount();

    if (!user?.id) return;

    const socket = connectSocket(user.id);
    socket.on('notification:new', () => {
      fetchUnreadCount();
    });

    return () => {
      socket.off('notification:new');
      disconnectSocket();
    };
  }, [fetchUnreadCount, user?.id]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen, setDropdownOpen]);

  const handleBellClick = () => {
    setDropdownOpen(!isDropdownOpen);
  };

  const handleNotificationClick = (notification: Notification) => {
    setDropdownOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleLoadMore = () => {
    fetchNotifications(false);
  };

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    hover: isDark ? '#374151' : '#f9fafb',
    badge: '#ef4444',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleBellClick}
        className="relative p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label={t('title', 'Notifications')}
      >
        <Bell className="w-5 h-5" style={{ color: colors.textSecondary }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-xs font-medium flex items-center justify-center text-white"
            style={{ backgroundColor: colors.badge }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isDropdownOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg shadow-lg overflow-hidden z-50"
          style={{
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: `1px solid ${colors.border}` }}
          >
            <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
              {t('title', 'Notifications')}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                style={{ color: isDark ? '#818cf8' : '#6366f1' }}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {t('mark_all_read', 'Mark all as read')}
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && !isLoading ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-10 h-10 mx-auto mb-2" style={{ color: colors.textSecondary }} />
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  {t('empty', 'No notifications yet')}
                </p>
              </div>
            ) : (
              <>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    style={{ borderBottom: `1px solid ${colors.border}` }}
                  >
                    <NotificationItem
                      notification={notification}
                      onRead={() => markAsRead(notification.id)}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  </div>
                ))}

                {/* Load More */}
                {hasMore && (
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    className="w-full py-3 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                    style={{ color: isDark ? '#818cf8' : '#6366f1' }}
                  >
                    {isLoading ? t('loading', 'Loading...') : t('load_more', 'Load more')}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2 text-center"
            style={{ borderTop: `1px solid ${colors.border}` }}
          >
            <button
              onClick={() => {
                setDropdownOpen(false);
                navigate('/settings');
              }}
              className="text-xs transition-colors hover:underline"
              style={{ color: colors.textSecondary }}
            >
              {t('manage_preferences', 'Manage notification preferences')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
