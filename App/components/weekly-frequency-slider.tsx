import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { T } from "@/components/theme";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { isHapticFeedbackEnabled } from "@/services/settings/settingsService";

const MIN_DAYS = 1;
const MAX_DAYS = 7;
const THUMB_SIZE = 34;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function WeeklyFrequencySlider({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const reducedMotion = useReducedMotionPreference();
  const trackWidth = useRef(0);
  const trackSize = useSharedValue(0);
  const valueRef = useRef(value);
  const previousValueRef = useRef(value);
  const thumbX = useSharedValue(0);
  const valueOffsetY = useSharedValue(0);
  const valueOpacity = useSharedValue(1);
  const [measured, setMeasured] = useState(false);
  const [displayedValue, setDisplayedValue] = useState(value);

  useEffect(() => {
    if (value === previousValueRef.current) return;
    const direction = value > previousValueRef.current ? 1 : -1;
    previousValueRef.current = value;
    setDisplayedValue(value);

    valueOffsetY.value = direction * 10;
    valueOpacity.value = 0;
    valueOffsetY.value = reducedMotion ? 0 : withTiming(0, { duration: 180 });
    valueOpacity.value = reducedMotion ? 1 : withTiming(1, { duration: 150 });
  }, [reducedMotion, value, valueOffsetY, valueOpacity]);

  useEffect(() => {
    valueRef.current = value;
    if (!measured) return;
    const nextX = ((value - MIN_DAYS) / (MAX_DAYS - MIN_DAYS)) * trackWidth.current;
    thumbX.value = reducedMotion ? nextX : withTiming(nextX, { duration: 180 });
  }, [measured, reducedMotion, thumbX, value]);

  function commitValue(nextValue: number) {
    if (nextValue !== valueRef.current) {
      valueRef.current = nextValue;
      if (isHapticFeedbackEnabled()) Haptics.selectionAsync().catch(() => {});
      onChange(nextValue);
    }
  }

  const moveThumb = (locationX: number, animate: boolean) => {
    "worklet";
    const width = trackSize.value;
    if (!width) return;
    const x = Math.min(Math.max(locationX, 0), width);
    const nextValue = Math.min(Math.max(Math.round((x / width) * (MAX_DAYS - MIN_DAYS)) + MIN_DAYS, MIN_DAYS), MAX_DAYS);
    const snappedX = ((nextValue - MIN_DAYS) / (MAX_DAYS - MIN_DAYS)) * width;
    thumbX.value = animate && !reducedMotion
      ? withSpring(snappedX, { stiffness: 360, damping: 32, mass: 0.85 })
      : snappedX;
    runOnJS(commitValue)(nextValue);
  };

  const panGesture = Gesture.Pan()
    .onBegin((event) => moveThumb(event.x, false))
    .onUpdate((event) => moveThumb(event.x, false))
    .onEnd((event) => moveThumb(event.x, true));

  const valueStyle = useAnimatedStyle(() => ({ opacity: valueOpacity.value, transform: [{ translateY: valueOffsetY.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: trackSize.value ? thumbX.value / trackSize.value : 0 }] }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: thumbX.value - THUMB_SIZE / 2 }] }));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Days per week you try something completely new"
      accessibilityValue={{ min: MIN_DAYS, max: MAX_DAYS, now: value, text: `Every ${value} ${value === 1 ? "day" : "days"}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        const direction = event.nativeEvent.actionName === "increment" ? 1 : -1;
        onChange(clamp(valueRef.current + direction, MIN_DAYS, MAX_DAYS));
      }}
    >
      <View style={styles.valueRow}>
        <Text style={styles.valuePrefix}>Every</Text>
        <Animated.Text style={[styles.value, valueStyle]}>{displayedValue}</Animated.Text>
        <Text style={styles.valueUnit}>{value === 1 ? "day a week" : "days a week"}</Text>
      </View>
      <GestureDetector gesture={panGesture}>
        <View
          onLayout={(event) => {
            trackWidth.current = event.nativeEvent.layout.width;
            trackSize.value = event.nativeEvent.layout.width;
            setMeasured(true);
          }}
          style={styles.touchTarget}
        >
          <View style={styles.track} />
          <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]} />
          <Animated.View pointerEvents="none" style={[styles.thumb, thumbStyle]} />
          <View pointerEvents="none" style={styles.tickRow}>
            {Array.from({ length: MAX_DAYS }, (_, index) => <View key={index} style={styles.tick} />)}
          </View>
        </View>
      </GestureDetector>
      <View style={styles.labels}>
        {Array.from({ length: MAX_DAYS }, (_, index) => {
          const day = index + 1;
          return <Text key={day} style={[styles.label, day === value && styles.labelActive]}>{day} {day === 1 ? "day" : "days"}</Text>;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  valueRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 7, marginBottom: 30 },
  valuePrefix: { color: T.dark, fontFamily: "RubikBold", fontSize: 17, lineHeight: 22 },
  value: { color: T.blue, fontFamily: "RubikBlack", fontSize: 36, lineHeight: 40, letterSpacing: -0.8 },
  valueUnit: { color: T.dark, fontFamily: "RubikBold", fontSize: 17, lineHeight: 22 },
  touchTarget: { height: 64, justifyContent: "center" },
  track: { height: 8, borderRadius: 99, backgroundColor: "#d6d8dc" },
  fill: { position: "absolute", left: 0, right: 0, height: 8, borderRadius: 99, backgroundColor: T.blue, transformOrigin: "left center" },
  thumb: { position: "absolute", width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2, backgroundColor: T.white, borderWidth: 2, borderColor: T.blue, boxShadow: "0px 3px 0px #258fd8" },
  tickRow: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tick: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#8c939d" },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  label: { flex: 1, color: T.muted, fontFamily: "RubikBold", fontSize: 10, lineHeight: 14, textAlign: "center" },
  labelActive: { color: T.blue },
});
