import { useEffect, useRef, useState } from "react";
import { AppState, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import Animated, { Easing, FadeIn, FadeInRight, FadeOutLeft, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useResponsiveScreenLayout } from "@/lib/responsive";
import { isHapticFeedbackEnabled } from "@/services/settings/settingsService";

const STEPS = ["3", "2", "1", "GO"] as const;
const CAPTIONS = ["Take a breath.", "Find your focus.", "Make it yours.", "Your quest starts now."];
const BACKGROUNDS = ["#191D50", "#293C83", "#3B5CC4", "#E5DEFF"];
const INKS = ["#F0EBFF", "#F0EBFF", "#F0EBFF", "#302358"];
const EASE = Easing.bezier(0.23, 1, 0.32, 1);
export const QUEST_COUNTDOWN_BEAT_MS = 850;

/** The final page of the same modal. Backgrounding pauses the sequence before handoff. */
export function QuestStartCountdown({ title, onFinished }: { title: string; onFinished: () => void }) {
  const reduced = useReducedMotionPreference();
  const { contentWidth, insets, availableHeight } = useResponsiveScreenLayout(480);
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(AppState.currentState === "active");
  const finished = useRef(false);
  const finish = useRef(onFinished);
  const progress = useSharedValue(0);
  const pulse = useSharedValue(0.94);
  const short = availableHeight < 500;
  const diameter = Math.min(contentWidth - 56, availableHeight * (short ? 0.36 : 0.48), 340);
  useEffect(() => { finish.current = onFinished; }, [onFinished]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!active || finished.current) return;
    progress.set(withTiming(step, { duration: reduced ? 120 : 280, easing: EASE }));
    pulse.set(reduced ? 1 : 0.94);
    if (!reduced) pulse.set(withSpring(1, { damping: 20, stiffness: 180, mass: 1 }));
    if (isHapticFeedbackEnabled()) void Haptics.impactAsync(step === 3 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const timer = setTimeout(() => {
      if (step < 3) setStep(step + 1);
      else { finished.current = true; finish.current(); }
    }, QUEST_COUNTDOWN_BEAT_MS);
    return () => clearTimeout(timer);
  }, [active, step, reduced, progress, pulse]);
  const canvas = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progress.get(), [0, 1, 2, 3], BACKGROUNDS) }));
  const foreground = useAnimatedStyle(() => ({ color: interpolateColor(progress.get(), [0, 1, 2, 3], INKS) }));
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }], borderColor: interpolateColor(progress.get(), [0, 1, 2, 3], ["#55598A", "#687AB3", "#93A4ED", "#BDB0E8"]) }));
  return <Animated.View entering={reduced ? FadeIn.duration(120) : FadeInRight.duration(220)} style={[StyleSheet.absoluteFill, canvas, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <StatusBar style={step === 3 ? "dark" : "light"} />
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, minHeight: availableHeight, width: contentWidth, alignSelf: "center", paddingHorizontal: 28, paddingVertical: short ? 12 : 32, gap: short ? 8 : 20, justifyContent: "space-between", alignItems: "center" }}>
      <View style={{ gap: 12, alignItems: "center" }}>
        <Animated.Text style={[styles.eyebrow, foreground]}>YOUR NEXT CHAPTER</Animated.Text>
        <Animated.Text numberOfLines={2} style={[styles.title, foreground]}>{title}</Animated.Text>
      </View>
      <View style={{ width: diameter, height: diameter, alignItems: "center", justifyContent: "center" }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 2, borderRadius: diameter / 2 }, ring]} />
        <View pointerEvents="none" style={{ position: "absolute", width: diameter * 0.82, height: diameter * 0.82, borderRadius: diameter, backgroundColor: "rgba(160,147,255,0.13)" }} />
        <Animated.Text key={step} allowFontScaling={false} accessibilityRole="header" accessibilityLiveRegion="assertive" entering={reduced ? FadeIn.duration(120) : FadeInRight.duration(220).easing(EASE)} exiting={reduced ? undefined : FadeOutLeft.duration(160).easing(EASE)} style={[styles.number, { fontSize: diameter * (step === 3 ? 0.42 : 0.58), lineHeight: diameter * 0.8, color: INKS[step] }]}>{STEPS[step]}</Animated.Text>
      </View>
      <View style={{ gap: short ? 8 : 26, alignItems: "center", paddingBottom: short ? 0 : 16 }}>
        <Animated.Text key={`caption-${step}`} entering={FadeIn.duration(180)} style={[styles.caption, foreground]}>{CAPTIONS[step]}</Animated.Text>
        <View accessible={false} style={{ flexDirection: "row", gap: 10 }}>{STEPS.map((_, index) => <View key={index} style={{ width: index === step ? 26 : 8, height: 8, borderRadius: 4, backgroundColor: INKS[step], opacity: index <= step ? 1 : 0.25 }} />)}</View>
        <Text style={{ color: INKS[step], opacity: 0.65, fontFamily: "Rubik", fontSize: 12 }}>A little focus. A new adventure.</Text>
      </View>
    </ScrollView>
  </Animated.View>;
}
const styles = StyleSheet.create({
  eyebrow: { fontFamily: "RubikBold", fontSize: 12, letterSpacing: 2 },
  title: { fontFamily: "Rubik", fontSize: 18, lineHeight: 24, textAlign: "center" },
  number: { position: "absolute", fontFamily: "RubikBlack", letterSpacing: -6, textAlign: "center" },
  caption: { fontFamily: "RubikBold", fontSize: 22, textAlign: "center" },
});
