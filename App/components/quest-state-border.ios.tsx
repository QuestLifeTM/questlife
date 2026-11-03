import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, { cubicBezier, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useAppViewport } from "@/lib/responsive";

const ACTIVE_COLOR = "#58B68B";
const PAUSED_COLOR = "#E3BA50";
const breathe = {
  "0%": { opacity: 0.3 },
  "50%": { opacity: 0.5 },
  "100%": { opacity: 0.3 },
};

export function QuestStateBorder({ paused }: { paused: boolean }) {
  const reduced = useReducedMotionPreference();
  const insets = useSafeAreaInsets();
  const { width, height } = useAppViewport();
  const state = useSharedValue(paused ? 1 : 0);
  // Safe-area measurements are a conservative radius estimate, not hardware
  // corner metadata. Include the side cutout in landscape. The outer fill
  // covers any space between this curve and the physical display mask.
  const cutoutInset = Math.max(insets.top, insets.left, insets.right);
  const roundedPhone = Math.min(width, height) < 600 && cutoutInset >= 44;
  const displayRadius = roundedPhone ? cutoutInset + 6 : insets.bottom > 0 ? 20 : 0;
  const radius = Math.max(0, Math.min(displayRadius, Math.min(width, height) / 2));
  const frame = { borderRadius: radius, borderCurve: "continuous" as const };
  useEffect(() => {
    state.set(withTiming(paused ? 1 : 0, { duration: reduced ? 120 : 300 }));
    AccessibilityInfo.announceForAccessibility(paused ? "Quest paused" : "Quest active");
  }, [paused, reduced, state]);
  const edge = useAnimatedStyle(() => {
    const color = interpolateColor(state.get(), [0, 1], [ACTIVE_COLOR, PAUSED_COLOR]);
    return {
      borderColor: color,
      // A solid outward spread fills only the outside of the rounded frame;
      // the center remains transparent and the viewport clips the excess.
      boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: Math.max(width, height), color }],
    };
  });
  const activeGlow = useAnimatedStyle(() => ({ opacity: 1 - state.get() }));
  const pausedGlow = useAnimatedStyle(() => ({ opacity: state.get() }));

  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden style={[StyleSheet.absoluteFill, { overflow: "hidden", zIndex: 30 }]}>
      {/* Inset light remains visible even when the display clips outer shadows. */}
      <Animated.View style={[StyleSheet.absoluteFill, reduced ? { opacity: 0.4 } : {
        animationName: breathe,
        animationDuration: 4200,
        animationIterationCount: "infinite",
        animationTimingFunction: cubicBezier(0.77, 0, 0.175, 1),
      }]}>
        <Animated.View style={[StyleSheet.absoluteFill, frame, { boxShadow: `inset 0 0 8px 0 ${ACTIVE_COLOR}` }, activeGlow]} />
        <Animated.View style={[StyleSheet.absoluteFill, frame, { boxShadow: `inset 0 0 8px 0 ${PAUSED_COLOR}` }, pausedGlow]} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, frame, { borderWidth: 2.5 }, edge]} />
    </View>
  );
}
