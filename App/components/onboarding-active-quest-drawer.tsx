import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/components/theme";
import { ActiveQuestScreen } from "@/screens/active-quest-screen";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { playHaptic } from "@/motion/haptics";

const iphoneMockup = require("../assets/onboarding/iphone-mockup.png");
const REFERENCE_WIDTH = 390;
const REFERENCE_HEIGHT = 844;

type OnboardingActiveQuestDrawerProps = {
  /** Whether the full phone is visible when the owning screen first appears. */
  initiallyOpen?: boolean;
  /** Park an initially visible phone after briefly showing the quest state. */
  autoPark?: boolean;
  /** Enables the real guest Active Quest controls after its feature tutorial. */
  interactive?: boolean;
};

export function OnboardingActiveQuestDrawer({
  initiallyOpen = false,
  autoPark = false,
  interactive = false,
}: OnboardingActiveQuestDrawerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const [open, setOpen] = useState(initiallyOpen);
  const progress = useRef(new Animated.Value(initiallyOpen ? 1 : 0)).current;
  const phoneWidth = Math.min(244, Math.max(204, width * 0.6));
  const phoneHeight = phoneWidth * (3407 / 1624);
  const screenWidth = phoneWidth * 0.856;
  const screenHeight = phoneHeight * 0.9085;
  const previewScale = Math.min(screenWidth / REFERENCE_WIDTH, screenHeight / REFERENCE_HEIGHT);
  const drawerTop = Math.max(insets.top + 78, 94);
  // Align the closed drawer handle just above the onboarding's persistent
  // Continue bar: 58px button + 10px top padding + safe-area spacing.
  const handleBottomOffset = Math.max(insets.bottom + 80, 100);
  // Keep the device itself completely out of view. The separate Quest handle
  // remains at the edge for reopening the quest phone.
  const closedX = -phoneWidth;

  useEffect(() => {
    if (!autoPark || !open) return;
    const timer = setTimeout(() => setOpen(false), reduceMotion ? 0 : 620);
    return () => clearTimeout(timer);
  }, [autoPark, open, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(open ? 1 : 0);
      return;
    }
    // One critically damped native spring makes the phone feel attached to the
    // screen edge, with no bounce and no abrupt timing jump.
    Animated.spring(progress, {
      toValue: open ? 1 : 0,
      stiffness: 280,
      damping: 32,
      mass: 0.8,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  }, [open, progress, reduceMotion]);

  return <Animated.View
    accessibilityViewIsModal={open}
    style={[styles.drawer, {
      top: drawerTop,
      width: phoneWidth,
      height: Math.max(phoneHeight, height - drawerTop),
      transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [closedX, 0] }) }],
    }]}
  >
    <View pointerEvents={interactive ? "auto" : "none"} style={[styles.phoneFrame, { height: phoneHeight }]}>
      <View style={{ position: "absolute", left: "7.02%", top: "4.4%", width: "85.6%", height: "90.85%", overflow: "hidden", borderRadius: Math.round(phoneWidth * 0.085), backgroundColor: T.bg }}>
        <View style={{ position: "absolute", width: REFERENCE_WIDTH, height: REFERENCE_HEIGHT, left: (screenWidth - REFERENCE_WIDTH) / 2, top: (screenHeight - REFERENCE_HEIGHT) / 2, transform: [{ scale: previewScale }] }}>
          <ActiveQuestScreen preview={!interactive} onboarding={interactive ? { locked: false, hideExit: true, holdCountdown: false } : { locked: true, hideExit: true, holdCountdown: true }} />
        </View>
      </View>
      <Image pointerEvents="none" source={iphoneMockup} contentFit="fill" style={StyleSheet.absoluteFill} />
    </View>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={open ? "Store active quest" : "Open active quest"}
      accessibilityHint={interactive ? "Open your quest to pause it, add notes or photos, and view your progress." : "Shows your live quest timer and route. Quest controls unlock after onboarding."}
      accessibilityState={{ expanded: open }}
      onPress={() => {
        playHaptic("selection");
        setOpen((current) => !current);
      }}
      style={({ pressed }) => [styles.handle, { bottom: handleBottomOffset }, pressed && styles.handlePressed]}
    >
      <Ionicons name={open ? "chevron-back" : "chevron-forward"} size={19} color={T.white} />
      {!open ? <Text style={styles.handleLabel}>Quest</Text> : null}
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  drawer: { position: "absolute", zIndex: 20, left: 0 },
  phoneFrame: { width: "100%", height: "100%" },
  handle: { position: "absolute", right: -42, width: 42, minHeight: 66, alignItems: "center", justifyContent: "center", gap: 2, borderTopRightRadius: 16, borderBottomRightRadius: 16, backgroundColor: T.blue, borderWidth: 2, borderLeftWidth: 0, borderColor: T.white, boxShadow: "2px 3px 0px rgba(37,143,216,0.72)" },
  handlePressed: { transform: [{ translateX: -2 }], opacity: 0.82 },
  handleLabel: { color: T.white, fontSize: 10, fontWeight: "900" },
});
