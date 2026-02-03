/**
 * Notification System
 * 
 * Toast notifications and alerts for the application.
 */

import { create } from 'zustand';
import { useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  duration?: number;
  timestamp: number;
  dismissed: boolean;
}

// ============================================================================
// Notification Store
// ============================================================================

interface NotificationState {
  notifications: Notification[];
  maxNotifications: number;
  defaultDuration: number;
  
  // Actions
  add: (notification: Omit<Notification, 'id' | 'timestamp' | 'dismissed'>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  clear: () => void;
  setMaxNotifications: (max: number) => void;
  setDefaultDuration: (duration: number) => void;
}

let notificationCounter = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  maxNotifications: 5,
  defaultDuration: 4000,

  add: (notification) => {
    const id = `notification-${++notificationCounter}`;
    const { maxNotifications, defaultDuration } = get();
    
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      dismissed: false,
      duration: notification.duration ?? defaultDuration,
    };

    set((state) => {
      // Remove oldest notifications if over limit
      let notifications = [...state.notifications, newNotification];
      if (notifications.length > maxNotifications) {
        notifications = notifications.slice(-maxNotifications);
      }
      return { notifications };
    });

    return id;
  },

  dismiss: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, dismissed: true } : n
      ),
    }));
  },

  dismissAll: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, dismissed: true })),
    }));
  },

  clear: () => {
    set({ notifications: [] });
  },

  setMaxNotifications: (max) => {
    set({ maxNotifications: max });
  },

  setDefaultDuration: (duration) => {
    set({ defaultDuration: duration });
  },
}));

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for showing notifications
 */
export function useNotifications() {
  const notifications = useNotificationStore((s) => s.notifications);

  const info = useCallback((message: string, title?: string) => {
    return useNotificationStore.getState().add({ type: 'info', message, title });
  }, []);

  const success = useCallback((message: string, title?: string) => {
    return useNotificationStore.getState().add({ type: 'success', message, title });
  }, []);

  const warning = useCallback((message: string, title?: string) => {
    return useNotificationStore.getState().add({ type: 'warning', message, title });
  }, []);

  const error = useCallback((message: string, title?: string) => {
    return useNotificationStore.getState().add({ type: 'error', message, title });
  }, []);

  const dismiss = useCallback((id: string) => {
    useNotificationStore.getState().dismiss(id);
  }, []);

  const dismissAll = useCallback(() => {
    useNotificationStore.getState().dismissAll();
  }, []);

  return {
    notifications: notifications.filter((n) => !n.dismissed),
    info,
    success,
    warning,
    error,
    dismiss,
    dismissAll,
  };
}

/**
 * Hook for auto-dismissing notifications
 */
export function useNotificationAutoDismiss() {
  const notifications = useNotificationStore((s) => s.notifications);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    for (const notification of notifications) {
      if (!notification.dismissed && notification.duration && notification.duration > 0) {
        const remaining = notification.duration - (Date.now() - notification.timestamp);
        if (remaining > 0) {
          const timer = setTimeout(() => {
            useNotificationStore.getState().dismiss(notification.id);
          }, remaining);
          timers.push(timer);
        } else {
          useNotificationStore.getState().dismiss(notification.id);
        }
      }
    }

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [notifications]);
}

/**
 * Hook for latest notification (for single toast display)
 */
export function useLatestNotification() {
  const notifications = useNotificationStore((s) => s.notifications);
  return notifications.filter((n) => !n.dismissed).slice(-1)[0] ?? null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quick notification functions (for use outside React)
 */
export const notify = {
  info: (message: string, title?: string) => 
    useNotificationStore.getState().add({ type: 'info', message, title }),
  success: (message: string, title?: string) => 
    useNotificationStore.getState().add({ type: 'success', message, title }),
  warning: (message: string, title?: string) => 
    useNotificationStore.getState().add({ type: 'warning', message, title }),
  error: (message: string, title?: string) => 
    useNotificationStore.getState().add({ type: 'error', message, title }),
};

export default {
  useNotificationStore,
  useNotifications,
  useNotificationAutoDismiss,
  useLatestNotification,
  notify,
};
