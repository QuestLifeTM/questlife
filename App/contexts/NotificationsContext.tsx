import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { ensureEngagementNotifications, fetchAppNotifications, markAppNotificationsRead, markJournalNotificationsRead } from "@/services/notifications/notificationService";
import { supabase } from "@/lib/supabase";
import { AppNotification } from "@/types/notifications";

type NotificationsContextValue = {
  notifications: AppNotification[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  hasUnreadJournal: boolean;
  refreshNotifications: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markJournalRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  loading: false,
  error: null,
  unreadCount: 0,
  hasUnreadJournal: false,
  refreshNotifications: async () => undefined,
  markRead: async () => undefined,
  markJournalRead: async () => undefined,
});

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { isConfigured, session } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshNotifications = useCallback(async () => {
    if (!isConfigured || !session) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ensureEngagementNotifications();
      setNotifications(await fetchAppNotifications());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [isConfigured, session]);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    if (!isConfigured || !session) return;
    const channel = supabase
      .channel(`app-notifications:${session.user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "app_notifications", filter: `user_id=eq.${session.user.id}` }, () => {
        void refreshNotifications();
      })
      .subscribe();
    const interval = setInterval(() => void refreshNotifications(), 10 * 60 * 1000);
    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [isConfigured, refreshNotifications, session]);

  const markRead = useCallback(async (ids: string[]) => {
    await markAppNotificationsRead(ids);
    setNotifications((current) => current.map((item) => ids.includes(item.id) ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item));
  }, []);

  const markJournalRead = useCallback(async () => {
    const ids = notifications.filter((item) => item.kind === "journal_entry_ready" && item.readAt === null).map((item) => item.id);
    if (!ids.length) return;
    await markJournalNotificationsRead();
    setNotifications((current) => current.map((item) => ids.includes(item.id) ? { ...item, readAt: new Date().toISOString() } : item));
  }, [notifications]);

  const value = useMemo(() => ({
    notifications,
    loading,
    error,
    unreadCount: notifications.filter((item) => item.readAt === null).length,
    hasUnreadJournal: notifications.some((item) => item.kind === "journal_entry_ready" && item.readAt === null),
    refreshNotifications,
    markRead,
    markJournalRead,
  }), [error, loading, markJournalRead, markRead, notifications, refreshNotifications]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
