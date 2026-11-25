import { useEffect, type ReactNode } from "react";
import { View } from "react-native";
import Reanimated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import type { ActiveQuestTab } from "@/hooks/useActiveQuestTabTransition.ios";
import { T } from "./theme";

/** Both pages occupy the same responsive viewport throughout the crossfade. */
export function ActiveQuestTabScene({ name, active, present, progress, request, reduced, onReady, children }: {
  name: ActiveQuestTab; active: boolean; present: boolean; progress: SharedValue<number>; request: number;
  reduced: boolean; onReady: (tab: ActiveQuestTab, request: number) => void; children: ReactNode;
}) {
  const motion = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: reduced ? 0 : (1 - progress.get()) * 8 }],
  }));
  useEffect(() => {
    // Native layout events can be skipped/coalesced when Moments is remounted
    // at the same size. React commit is the reliable readiness signal; never
    // leave a selected page transparent waiting for another layout event.
    if (active && present) onReady(name, request);
  }, [active, present, name, request, onReady]);
  return <Reanimated.View collapsable={false} pointerEvents={active ? "auto" : "none"}
    accessibilityElementsHidden={!active} importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    style={[{ position: "absolute", inset: 0, zIndex: active ? 2 : 1, backgroundColor: T.bg }, motion]}>
    {present ? <View collapsable={false} style={{ flex: 1 }} onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      if (active && width > 0 && height > 0) onReady(name, request);
    }}>{children}</View> : null}
  </Reanimated.View>;
}
