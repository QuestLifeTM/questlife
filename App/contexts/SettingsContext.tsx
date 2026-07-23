import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { setHighContrastTheme } from "@/components/theme";
import { isHapticFeedbackEnabled, loadUserSettings, saveUserSettings, setHapticFeedbackEnabled } from "@/services/settings/settingsService";
import { defaultUserSettings, NotificationPreferenceKey, UserSettings } from "@/types/settings";

type SettingsContextValue = {
  loading: boolean;
  settings: UserSettings;
  setHapticFeedback: (enabled: boolean) => Promise<void>;
  setReduceMotion: (enabled: boolean) => Promise<void>;
  setHighContrast: (enabled: boolean) => Promise<void>;
  setNotificationPreference: (key: NotificationPreferenceKey, enabled: boolean) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue>({
  loading: false,
  settings: { ...defaultUserSettings, hapticFeedback: isHapticFeedbackEnabled() },
  setHapticFeedback: async () => undefined,
  setReduceMotion: async () => undefined,
  setHighContrast: async () => undefined,
  setNotificationPreference: async () => undefined,
});

export function SettingsProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) {
      setHapticFeedbackEnabled(defaultUserSettings.hapticFeedback);
      setHighContrastTheme(defaultUserSettings.highContrast);
      setSettings(defaultUserSettings);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    loadUserSettings(user.id)
      .then((next) => {
        if (!active) return;
        setSettings(next);
        setHapticFeedbackEnabled(next.hapticFeedback);
        setHighContrastTheme(next.highContrast);
      })
      .catch(() => {
        if (!active) return;
        setSettings(defaultUserSettings);
        setHapticFeedbackEnabled(defaultUserSettings.hapticFeedback);
        setHighContrastTheme(defaultUserSettings.highContrast);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  const persist = useCallback(async (next: UserSettings) => {
    setSettings(next);
    setHapticFeedbackEnabled(next.hapticFeedback);
    setHighContrastTheme(next.highContrast);
    if (user) {
      // The current session should remain responsive even if local secure storage
      // is temporarily unavailable. A later change will try to persist again.
      try { await saveUserSettings(user.id, next); } catch { /* Keep the in-memory preference. */ }
    }
  }, [user]);

  const setHapticFeedback = useCallback(async (enabled: boolean) => {
    await persist({ ...settings, hapticFeedback: enabled });
  }, [persist, settings]);

  const setReduceMotion = useCallback(async (enabled: boolean) => {
    await persist({ ...settings, reduceMotion: enabled });
  }, [persist, settings]);

  const setHighContrast = useCallback(async (enabled: boolean) => {
    await persist({ ...settings, highContrast: enabled });
  }, [persist, settings]);

  const setNotificationPreference = useCallback(async (key: NotificationPreferenceKey, enabled: boolean) => {
    await persist({ ...settings, notifications: { ...settings.notifications, [key]: enabled } });
  }, [persist, settings]);

  const value = useMemo(() => ({ loading, settings, setHapticFeedback, setReduceMotion, setHighContrast, setNotificationPreference }), [loading, setHapticFeedback, setHighContrast, setNotificationPreference, setReduceMotion, settings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
