import { useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import Animated, { SensorType, useAnimatedSensor, useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";

import { advanceEyeMotion, initialEyeMotion } from "@/lib/eye-motion";

type Gaze = { x: number; y: number };

/** Mounted only while visible and active; unmounting releases the native sensor and frame callback. */
function TiltDriver({ gaze }: { gaze: SharedValue<Gaze> }) {
  const { sensor } = useAnimatedSensor(SensorType.GRAVITY, { interval: 16, adjustToInterfaceOrientation: true });
  const motion = useSharedValue(initialEyeMotion);
  useFrameCallback(frame => {
    const next = advanceEyeMotion(motion.get(), sensor.get(), frame.timeSincePreviousFrame ?? 0);
    motion.set(next);
    gaze.set({ x: next.x, y: next.y });
  });
  return null;
}

export function MoodMotionEyes({ children, size, active, reduced }: { children: ReactNode; size: number; active: boolean; reduced: boolean }) {
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const gaze = useSharedValue<Gaze>({ x: 0, y: 0 });
  const enabled = active && foreground && !reduced;
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => setForeground(state === "active"));
    setForeground(AppState.currentState === "active");
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!enabled) gaze.set({ x: 0, y: 0 });
  }, [enabled, gaze]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: enabled ? gaze.get().x * size / 300 : 0 },
      { translateY: enabled ? gaze.get().y * size / 300 : 0 },
    ],
  }));
  return <>
    {enabled ? <TiltDriver gaze={gaze} /> : null}
    <Animated.View style={style}>{children}</Animated.View>
  </>;
}
