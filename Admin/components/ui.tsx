import * as Haptics from "expo-haptics";
import { View } from "react-native";

export function haptic() {
  if (process.env.EXPO_OS === "ios") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export function AmbientGlow({ right = true }: { right?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: 280,
        height: 280,
        top: -70,
        [right ? "right" : "left"]: -65,
        borderRadius: 140,
        backgroundColor: "rgba(77,168,255,0.07)",
        opacity: 0.9,
      }}
    />
  );
}
