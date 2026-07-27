import { useEffect, type PropsWithChildren } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useMotionPreferences } from "@/hooks/useReducedMotionPreference";
import {
  motionDurations,
  motionEasing,
  motionScale,
  motionSprings,
  springConfig,
  timingConfig,
} from "@/motion/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TactilePressable({
  children,
  style,
  scale = motionScale.buttonPressed,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: PropsWithChildren<Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; scale?: number }>) {
  const { reducedMotion } = useMotionPreferences();
  const pressedScale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressedScale.value }] }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        pressedScale.value = reducedMotion ? 1 : withSpring(scale, springConfig(false, motionSprings.press));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressedScale.value = reducedMotion ? 1 : withSpring(1, springConfig(false, motionSprings.press));
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function MotionStateSwap({
  children,
  stateKey,
  style,
}: PropsWithChildren<{ stateKey: string; style?: StyleProp<ViewStyle> }>) {
  const { reducedMotion } = useMotionPreferences();
  const entering = reducedMotion
    ? undefined
    : FadeInDown.duration(motionDurations.state).easing(motionEasing.enter);

  return <Animated.View key={stateKey} entering={entering} style={style}>{children}</Animated.View>;
}

export function MotionProgress({
  value,
  color,
  height = 10,
  trackColor,
  accessibilityLabel,
}: {
  value: number;
  color: string;
  height?: number;
  trackColor: string;
  accessibilityLabel?: string;
}) {
  const { reducedMotion } = useMotionPreferences();
  const normalized = Math.max(0, Math.min(1, value / 100));
  const progress = useSharedValue(normalized);

  useEffect(() => {
    progress.value = reducedMotion
      ? normalized
      : withTiming(normalized, timingConfig(false, motionDurations.state, motionEasing.standard));
  }, [normalized, progress, reducedMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(normalized * 100) }}
      style={{ height, borderRadius: 999, backgroundColor: trackColor, overflow: "hidden" }}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            backgroundColor: color,
            transformOrigin: "left center",
          },
          fillStyle,
        ]}
      />
    </Animated.View>
  );
}

export function MotionToggle({
  value,
  onChange,
  label,
  activeColor,
  inactiveColor,
}: {
  value: boolean;
  onChange: () => void;
  label: string;
  activeColor: string;
  inactiveColor: string;
}) {
  const { reducedMotion } = useMotionPreferences();
  const x = useSharedValue(value ? 17 : 0);

  useEffect(() => {
    x.value = reducedMotion
      ? (value ? 17 : 0)
      : withTiming(value ? 17 : 0, timingConfig(false, motionDurations.control));
  }, [reducedMotion, value, x]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={onChange}
      style={({ pressed }) => ({
        width: 45,
        height: 28,
        padding: 3,
        borderRadius: 14,
        justifyContent: "center",
        backgroundColor: value ? activeColor : inactiveColor,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <Animated.View style={[{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#ffffff", boxShadow: "0px 1px 2px rgba(61,52,56,0.22)" }, thumbStyle]} />
    </Pressable>
  );
}
