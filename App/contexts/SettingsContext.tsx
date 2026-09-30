import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, useColorScheme } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { setTheme } from "@/components/theme";
import { isHapticFeedbackEnabled, loadLastAppearancePreference, loadUserSettings, saveLastAppearancePreference, saveUserSettings, setHapticFeedbackEnabled } from "@/services/settings/settingsService";
import { AppearancePreference, defaultUserSettings, NotificationPreferenceKey, UserSettings } from "@/types/settings";

type SettingsContextValue = {
  loading: boolean;
  settings: UserSettings;
  themeKey: string;
  setHapticFeedback: (enabled: boolean) => Promise<void>;
  setReduceMotion: (enabled: boolean) => Promise<void>;
  setHighContrast: (enabled: boolean) => Promise<void>;
  setAppearance: (appearance: AppearancePreference) => Promise<void>;
  setNotificationPreference: (key: NotificationPreferenceKey, enabled: boolean) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue>({
  loading: false,
  settings: { ...defaultUserSettings, hapticFeedback: isHapticFeedbackEnabled() },
  themeKey: "system:light:standard",
  setHapticFeedback: async () => undefined,
  setReduceMotion: async () => undefined,
  setHighContrast: async () => undefined,
  setAppearance: async () => undefined,
  setNotificationPreference: async () => undefined,
});

export function SettingsProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const systemAppearance = useColorScheme() === "dark" ? "dark" : "light";
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings);
  const [loading, setLoading] = useState(true);
  const themeKey = `${settings.appearance}:${systemAppearance}:${settings.highContrast ? "high" : "standard"}`;

  // Theme tokens are read while rendering. Apply the selected palette before
  // descendants render so every mounted route receives the new colors in the
  // same render that changes the preference.
  setTheme(settings.appearance, settings.highContrast, systemAppearance);

  // Keep React Native's native surfaces aligned with an explicit app choice.
  // React Native resets the native override with `null`; the installed type
  // declaration omits that documented reset value.
  useEffect(() => {
    Appearance.setColorScheme((settings.appearance === "system" ? null : settings.appearance) as never);
  }, [settings.appearance]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setHapticFeedbackEnabled(defaultUserSettings.hapticFeedback);
      loadLastAppearancePreference()
        .then((appearance) => {
          if (!active) return;
          setSettings({ ...defaultUserSettings, appearance });
        })
        .catch(() => {
          if (active) setSettings(defaultUserSettings);
        })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }
    setLoading(true);
    loadUserSettings(user.id)
      .then((next) => {
        if (!active) return;
        setSettings(next);
        setHapticFeedbackEnabled(next.hapticFeedback);
        setTheme(next.appearance, next.highContrast, systemAppearance);
      })
      .catch(() => {
        if (!active) return;
        setSettings(defaultUserSettings);
        setHapticFeedbackEnabled(defaultUserSettings.hapticFeedback);
        setTheme(defaultUserSettings.appearance, defaultUserSettings.highContrast, systemAppearance);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [systemAppearance, user?.id]);

  const persist = useCallback(async (next: UserSettings) => {
    setSettings(next);
    setHapticFeedbackEnabled(next.hapticFeedback);
    setTheme(next.appearance, next.highContrast, systemAppearance);
    try { await saveLastAppearancePreference(next.appearance); } catch { /* Keep the active preference in memory. */ }
    if (user) {
      // The current session should remain responsive even if local secure storage
      // is temporarily unavailable. A later change will try to persist again.
      try { await saveUserSettings(user.id, next); } catch { /* Keep the in-memory preference. */ }
    }
  }, [systemAppearance, user]);

  const setHapticFeedback = useCallback(async (enabled: boolean) => {
    await persist({ ...settings, hapticFeedback: enabled });
  }, [persist, settings]);

  const setReduceMotion = useCallback(async (enabled: boolean) => {
    await persist({ ...settings, reduceMotion: enabled });
  }, [persist, settings]);

  const setHighContrast = useCallback(async (enabled: boolean) => {
    await persist({ ...settings, highContrast: enabled });
  }, [persist, settings]);

  const setAppearance = useCallback(async (appearance: AppearancePreference) => {
    await persist({ ...settings, appearance });
  }, [persist, settings]);

  const setNotificationPreference = useCallback(async (key: NotificationPreferenceKey, enabled: boolean) => {
    await persist({ ...settings, notifications: { ...settings.notifications, [key]: enabled } });
  }, [persist, settings]);

  const value = useMemo(() => ({ loading, settings, themeKey, setAppearance, setHapticFeedback, setReduceMotion, setHighContrast, setNotificationPreference }), [loading, setAppearance, setHapticFeedback, setHighContrast, setNotificationPreference, setReduceMotion, settings, themeKey]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

/** Subscribe a route or shared primitive to appearance changes. */
export function useThemeKey() {
  return useContext(SettingsContext).themeKey;
}
