import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { useSettings } from "@/contexts/SettingsContext";

/** Combines the device accessibility setting with QuestLife's in-app preference. */
export function useReducedMotionPreference() {
  const { settings } = useSettings();
  const [deviceReducedMotion, setDeviceReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setDeviceReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setDeviceReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return deviceReducedMotion || settings.reduceMotion;
}
