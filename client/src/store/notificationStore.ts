import { create } from 'zustand';
import { notificationsApi, Notification } from '../api/notifications';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isDropdownOpen: boolean;
  hasMore: boolean;
  lastFetched: number | null;

  // Actions
  fetchNotifications: (reset?: boolean) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  setDropdownOpen: (open: boolean) => void;
  reset: () => void;
}

const POLLING_INTERVAL = 30000; // 30 seconds
const PAGE_SIZE = 20;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isDropdownOpen: false,
  hasMore: true,
  lastFetched: null,

  fetchNotifications: async (reset = false) => {
    const state = get();
    if (state.isLoading) return;

    set({ isLoading: true });

    try {
      const offset = reset ? 0 : state.notifications.length;
      const result = await notificationsApi.getNotifications({
        limit: PAGE_SIZE,
        offset,
      });

      set({
        notifications: reset
          ? result.data
          : [...state.notifications, ...result.data],
        unreadCount: result.unreadCount,
        hasMore: result.pagination.hasMore,
        lastFetched: Date.now(),
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const count = await notificationsApi.getUnreadCount();
      set({ unreadCount: count, lastFetched: Date.now() });
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  },

  markAsRead: async (notificationId: number) => {
    const state = get();
    const notification = state.notifications.find(n => n.id === notificationId);

    if (!notification || notification.isRead) return;

    // Optimistic update
    set({
      notifications: state.notifications.map(n =>
        n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    });

    try {
      await notificationsApi.markAsRead(notificationId);
    } catch (error) {
      // Rollback on error
      set({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      });
      console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    const state = get();

    if (state.unreadCount === 0) return;

    // Optimistic update
    const previousNotifications = state.notifications;
    const previousUnreadCount = state.unreadCount;

    set({
      notifications: state.notifications.map(n => ({
        ...n,
        isRead: true,
        readAt: n.isRead ? n.readAt : new Date().toISOString(),
      })),
      unreadCount: 0,
    });

    try {
      await notificationsApi.markAllAsRead();
    } catch (error) {
      // Rollback on error
      set({
        notifications: previousNotifications,
        unreadCount: previousUnreadCount,
      });
      console.error('Failed to mark all notifications as read:', error);
    }
  },

  setDropdownOpen: (open: boolean) => {
    set({ isDropdownOpen: open });

    // Fetch fresh notifications when opening dropdown
    if (open) {
      get().fetchNotifications(true);
    }
  },

  reset: () => {
    set({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      isDropdownOpen: false,
      hasMore: true,
      lastFetched: null,
    });
  },
}));

// Hook for polling
export const useNotificationPolling = (enabled: boolean) => {
  const { fetchUnreadCount, lastFetched } = useNotificationStore();

  // Start polling when enabled
  if (typeof window !== 'undefined' && enabled) {
    const poll = () => {
      const state = useNotificationStore.getState();
      const now = Date.now();

      // Only poll if we haven't fetched recently
      if (!state.lastFetched || now - state.lastFetched >= POLLING_INTERVAL) {
        fetchUnreadCount();
      }
    };

    // Initial fetch
    if (!lastFetched) {
      fetchUnreadCount();
    }

    // Set up interval
    const interval = setInterval(poll, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }

  return () => {};
};
