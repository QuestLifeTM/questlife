import * as Haptics from "expo-haptics";

import { isHapticFeedbackEnabled } from "@/services/settings/settingsService";

export type HapticIntent = "selection" | "commit" | "success" | "warning";

/** Supplemental semantic feedback; visual and text state never depend on it. */
export function playHaptic(intent: HapticIntent = "commit") {
  if (!isHapticFeedbackEnabled()) return;

  const feedback = intent === "selection"
    ? Haptics.selectionAsync()
    : intent === "success"
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : intent === "warning"
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  feedback.catch(() => {});
}
