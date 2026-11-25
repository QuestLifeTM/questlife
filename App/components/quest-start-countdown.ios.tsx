import { Pressable } from "@/components/raised-pressable";
import { getQuestLaunchState, subscribeQuestLaunch, retryQuestPreparation } from "@/services/engine/quest-launch-state.ios";
import { scheduleOnRN } from "react-native-worklets";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import Animated, { Easing, FadeIn, FadeInRight, FadeOutLeft, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useResponsiveScreenLayout } from "@/lib/responsive";
import { isHapticFeedbackEnabled } from "@/services/settings/settingsService";

const STEPS = ["3", "2", "1", "GO"] as const;
const CAPTIONS = ["Take a breath.", "Find your focus.", "Make it yours.", "Your quest starts now."];
const BACKGROUNDS = ["#FF856F", "#F7CA55", "#C9E47B", "#C9E47B"];
const INKS = ["#8F1D0E", "#79500C", "#30560D", "#30560D"];
const EASE = Easing.bezier(0.23, 1, 0.32, 1);
export const QUEST_COUNTDOWN_BEAT_MS = 850;

/** The final page of the same modal. Backgrounding pauses the sequence before handoff. */
export function QuestStartCountdown({ title, onFinished, sessionId }: { title: string; onFinished: () => void; sessionId?: string }) {
  const reduced = useReducedMotionPreference();
  const { contentWidth, insets, availableHeight } = useResponsiveScreenLayout(480);
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(AppState.currentState === "active");
  const finished = useRef(false);
  const launch = useSyncExternalStore(subscribeQuestLaunch, getQuestLaunchState, getQuestLaunchState);
  const [goElapsed, setGoElapsed] = useState(false);
  const opacity = useSharedValue(1);
  const finishReveal = () => finish.current();
  useEffect(() => {
    if (!active || !goElapsed || finished.current || !sessionId || launch?.sessionId !== sessionId || !launch.destinationReady) return;
    finished.current = true;
    opacity.set(withTiming(0, { duration: reduced ? 120 : 240 }, done => { if (done) scheduleOnRN(finishReveal); }));
  }, [active, goElapsed, launch, sessionId, reduced]);
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
      else setGoElapsed(true);
    }, QUEST_COUNTDOWN_BEAT_MS);
    return () => clearTimeout(timer);
  }, [active, step, reduced, progress, pulse]);
  const canvas = useAnimatedStyle(() => ({ opacity: opacity.get(), backgroundColor: interpolateColor(progress.get(), [0, 1, 2, 3], BACKGROUNDS) }));
  const foreground = useAnimatedStyle(() => ({ color: interpolateColor(progress.get(), [0, 1, 2, 3], INKS) }));
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }], borderColor: interpolateColor(progress.get(), [0, 1, 2, 3], ["#8F1D0E55", "#79500C55", "#30560D55", "#30560D55"]) }));
  return <Animated.View entering={reduced ? FadeIn.duration(120) : FadeInRight.duration(220)} style={[StyleSheet.absoluteFill, canvas, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <StatusBar style="dark" />
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, minHeight: availableHeight, width: contentWidth, alignSelf: "center", paddingHorizontal: 28, paddingVertical: short ? 12 : 32, gap: short ? 8 : 20, justifyContent: "space-between", alignItems: "center" }}>
      <View style={{ gap: 12, alignItems: "center" }}>
        <Animated.Text style={[styles.eyebrow, foreground]}>YOUR NEXT CHAPTER</Animated.Text>
        <Animated.Text numberOfLines={2} style={[styles.title, foreground]}>{title}</Animated.Text>
      </View>
      <View style={{ width: diameter, height: diameter, alignItems: "center", justifyContent: "center" }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 2, borderRadius: diameter / 2 }, ring]} />
        <View pointerEvents="none" style={{ position: "absolute", width: diameter * 0.82, height: diameter * 0.82, borderRadius: diameter, backgroundColor: "rgba(255,255,255,0.13)" }} />
        <Animated.Text key={step} allowFontScaling={false} accessibilityRole="header" accessibilityLiveRegion="assertive" entering={reduced ? FadeIn.duration(120) : FadeInRight.duration(220).easing(EASE)} exiting={reduced ? undefined : FadeOutLeft.duration(160).easing(EASE)} style={[styles.number, { fontSize: diameter * (step === 3 ? 0.42 : 0.58), lineHeight: diameter * 0.8, color: INKS[step] }]}>{STEPS[step]}</Animated.Text>
      </View>
      <View style={{ gap: short ? 8 : 26, alignItems: "center", paddingBottom: short ? 0 : 16 }}>
        <Animated.Text key={`caption-${step}`} entering={FadeIn.duration(180)} style={[styles.caption, foreground]}>{CAPTIONS[step]}</Animated.Text>
        <View accessible={false} style={{ flexDirection: "row", gap: 10 }}>{STEPS.map((_, index) => <View key={index} style={{ width: index === step ? 26 : 8, height: 8, borderRadius: 4, backgroundColor: INKS[step], opacity: index <= step ? 1 : 0.25 }} />)}</View>
        {step === 3 && goElapsed && !launch?.destinationReady ? <View style={{ alignItems: "center", gap: 8 }}>
          <Text accessibilityLiveRegion="polite" style={{ color: INKS[step], textAlign: "center" }}>{launch?.preparationError ?? "Preparing your activity…"}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry opening quest" onPress={() => sessionId && retryQuestPreparation(sessionId)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: INKS[step], fontFamily: "RubikBold" }}>Try again</Text></Pressable>
        </View> : null}
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
