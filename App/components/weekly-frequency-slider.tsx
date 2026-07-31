import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";

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
  const valueRef = useRef(value);
  const previousValueRef = useRef(value);
  const reducedMotionRef = useRef(reducedMotion);
  const thumbX = useRef(new Animated.Value(0)).current;
  const valueOffsetY = useRef(new Animated.Value(0)).current;
  const valueOpacity = useRef(new Animated.Value(1)).current;
  const [measured, setMeasured] = useState(false);
  const [displayedValue, setDisplayedValue] = useState(value);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    if (value === previousValueRef.current) return;
    const direction = value > previousValueRef.current ? 1 : -1;
    previousValueRef.current = value;
    setDisplayedValue(value);

    valueOffsetY.setValue(direction * 10);
    valueOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(valueOffsetY, { toValue: 0, duration: reducedMotion ? 0 : 180, useNativeDriver: true }),
      Animated.timing(valueOpacity, { toValue: 1, duration: reducedMotion ? 0 : 150, useNativeDriver: true }),
    ]).start();
  }, [reducedMotion, value, valueOffsetY, valueOpacity]);

  useEffect(() => {
    valueRef.current = value;
    if (!measured) return;
    const nextX = ((value - MIN_DAYS) / (MAX_DAYS - MIN_DAYS)) * trackWidth.current;
    // `thumbX` drives the fill's width as well as the thumb transform. Width is
    // a layout property, so this animation must stay on the JS driver.
    Animated.timing(thumbX, { toValue: nextX, duration: reducedMotion ? 0 : 180, useNativeDriver: false }).start();
  }, [measured, reducedMotion, thumbX, value]);

  function moveTo(locationX: number, animate = false) {
    if (!trackWidth.current) return;
    const x = clamp(locationX, 0, trackWidth.current);
    const nextValue = clamp(Math.round((x / trackWidth.current) * (MAX_DAYS - MIN_DAYS)) + MIN_DAYS, MIN_DAYS, MAX_DAYS);
    const snappedX = ((nextValue - MIN_DAYS) / (MAX_DAYS - MIN_DAYS)) * trackWidth.current;

    if (nextValue !== valueRef.current) {
      valueRef.current = nextValue;
      if (isHapticFeedbackEnabled()) Haptics.selectionAsync().catch(() => {});
      onChange(nextValue);
    }

    if (animate) {
      Animated.spring(thumbX, { toValue: snappedX, stiffness: 360, damping: 32, mass: 0.85, useNativeDriver: false }).start();
    } else {
      thumbX.setValue(snappedX);
    }
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => moveTo(event.nativeEvent.locationX),
    onPanResponderMove: (event) => moveTo(event.nativeEvent.locationX),
    onPanResponderRelease: (event) => moveTo(event.nativeEvent.locationX, !reducedMotionRef.current),
    onPanResponderTerminate: (event) => moveTo(event.nativeEvent.locationX, !reducedMotionRef.current),
  })).current;

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
        <Animated.Text style={[styles.value, { opacity: valueOpacity, transform: [{ translateY: valueOffsetY }] }]}>{displayedValue}</Animated.Text>
        <Text style={styles.valueUnit}>{value === 1 ? "day a week" : "days a week"}</Text>
      </View>
      <View
        {...panResponder.panHandlers}
        onLayout={(event) => {
          trackWidth.current = event.nativeEvent.layout.width;
          setMeasured(true);
        }}
        style={styles.touchTarget}
      >
        <View style={styles.track} />
        <Animated.View pointerEvents="none" style={[styles.fill, { width: thumbX }]} />
        <Animated.View pointerEvents="none" style={[styles.thumb, { transform: [{ translateX: Animated.subtract(thumbX, THUMB_SIZE / 2) }] }]} />
        <View pointerEvents="none" style={styles.tickRow}>
          {Array.from({ length: MAX_DAYS }, (_, index) => <View key={index} style={styles.tick} />)}
        </View>
      </View>
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
  fill: { position: "absolute", left: 0, height: 8, borderRadius: 99, backgroundColor: T.blue },
  thumb: { position: "absolute", width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2, backgroundColor: T.white, borderWidth: 2, borderColor: T.blue, boxShadow: "0px 3px 0px #258fd8" },
  tickRow: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tick: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#8c939d" },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  label: { flex: 1, color: T.muted, fontFamily: "RubikBold", fontSize: 10, lineHeight: 14, textAlign: "center" },
  labelActive: { color: T.blue },
});
