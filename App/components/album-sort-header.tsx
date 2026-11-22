import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Header, haptic } from "./ui";
import { T } from "./theme";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import type { AlbumGrouping } from "@/services/journal/album-model";

const options: AlbumGrouping[] = ["quest", "week", "month", "category"];

/** Mounted only on the iOS album tab; unmounting also dismisses the menu. */
export function AlbumSortHeader({ grouping, onChange }: { grouping: AlbumGrouping; onChange: (value: AlbumGrouping) => void }) {
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [bounds, setBounds] = useState({ width: 0, height: 70 });
  const reduced = useReducedMotionPreference();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(open ? 1 : 0, { duration: reduced ? 0 : 250, easing: Easing.bezier(0.77, 0, 0.175, 1) }));
  }, [open, reduced, progress]);
  const surface = useAnimatedStyle(() => ({
    width: 62 + (bounds.width - 62) * progress.get(),
    height: 40 + (bounds.height - 40) * progress.get(),
    top: (bounds.height - 40) / 2 * (1 - progress.get()),
    borderRadius: 22 - 6 * progress.get(),
    transform: [{ scale: pressed && !open ? 0.96 : 1 }, { translateY: pressed && !open ? 2 : 0 }],
    borderBottomWidth: pressed && !open ? 2 : 4,
  }));
  const contents = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 0.65, 1], [0, 0, 1]) }));
  const label = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 0.25, 1], [1, 0, 0]) }));
  const ink = T.isDark ? "#cce7ff" : "#155c99";
  return <View onLayout={({ nativeEvent }) => setBounds({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })}>
    <View accessibilityElementsHidden={open} importantForAccessibility={open ? "no-hide-descendants" : "auto"}>
      <Header title="My Album" subtitle="Every quest, kept close" animated={false} right={<View style={{ width: 62, height: 44 }} />} />
    </View>
    <Animated.View pointerEvents="none" style={[{ position: "absolute", right: 0, backgroundColor: T.isDark ? "#15344e" : "#e9f4ff", borderWidth: 2, borderColor: "#85bcf0", borderBottomWidth: 4, borderBottomColor: "#5798d3" }, surface]} />
    <Animated.View pointerEvents={open ? "none" : "auto"} accessibilityElementsHidden={open} style={[{ position: "absolute", right: 0, top: (bounds.height - 44) / 2 }, label]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Sort albums" accessibilityState={{ expanded: open }} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} onPress={() => { haptic(); setOpen(true); }} style={({ pressed }) => ({ width: 62, height: 44, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.96 : 1 }, { translateY: pressed ? 2 : 0 }] })}>
        <Text style={{ color: ink, fontSize: 14, fontWeight: "900", fontFamily: "Rubik" }}>Sort</Text>
      </Pressable>
    </Animated.View>
    <Animated.View pointerEvents={open ? "auto" : "none"} accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"} onAccessibilityEscape={() => setOpen(false)} style={[{ position: "absolute", inset: 0, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", gap: 2 }, contents]}>
      {options.map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: grouping === option }} onPress={() => { haptic(); onChange(option); setOpen(false); }} style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: grouping === option ? T.blue : "transparent", opacity: pressed ? 0.7 : 1 })}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: grouping === option ? T.onAccent : ink, fontFamily: "Rubik", fontWeight: "800", fontSize: 12 }}>{option.charAt(0).toUpperCase() + option.slice(1)}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Close sort menu" onPress={() => setOpen(false)} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}><Ionicons name="close" size={20} color={ink} /></Pressable>
    </Animated.View>
  </View>;
}
