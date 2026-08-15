import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { OnboardingQuestionProgress } from "@/components/onboarding-progress";
import { T } from "@/components/theme";
import { useResponsiveScreenLayout } from "@/components/ui";

const LOADING_MESSAGES = [
  { minimumProgress: 0, label: "locking in your goals..." },
  { minimumProgress: 32, label: "building your first plan..." },
  { minimumProgress: 62, label: "making it feel like you..." },
  { minimumProgress: 88, label: "setting up your plan..." },
  { minimumProgress: 100, label: "your plan is ready!" },
];

// A staged curve makes the handoff feel intentional: each visible phase gets
// time to read, while the last few percent remain visible before we continue.
const PROGRESS_PLAN = [
  { from: 0, to: 18, duration: 800 },
  { from: 18, to: 45, duration: 1_450 },
  { from: 45, to: 69, duration: 1_550 },
  { from: 69, to: 84, duration: 1_400 },
  { from: 84, to: 88, duration: 900 },
  { from: 88, to: 88, duration: 750 },
  { from: 88, to: 96, duration: 1_500 },
  { from: 96, to: 96, duration: 650 },
  { from: 96, to: 100, duration: 850 },
] as const;

/** A brief handoff that makes the completed preferences feel personal. */
export default function PersonalizingOnboardingScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const { insets, horizontalPadding } = useResponsiveScreenLayout();
  const [progress, setProgress] = useState(0);
  const status = useMemo(
    () => [...LOADING_MESSAGES].reverse().find((message) => progress >= message.minimumProgress)?.label ?? LOADING_MESSAGES[0].label,
    [progress],
  );
  const completedPills = Math.floor((progress / 100) * 8);

  useEffect(() => {
    const startedAt = Date.now();
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;

    const interval = setInterval(() => {
      let elapsed = Date.now() - startedAt;

      for (const phase of PROGRESS_PLAN) {
        if (elapsed > phase.duration) {
          elapsed -= phase.duration;
          continue;
        }

        // Ease each moving phase so it reads as work progressing, not a timer.
        const ratio = elapsed / phase.duration;
        const easedRatio = 1 - Math.pow(1 - ratio, 2);
        setProgress(Math.round(phase.from + (phase.to - phase.from) * easedRatio));
        return;
      }

      setProgress(100);
      clearInterval(interval);
      redirectTimer = setTimeout(() => {
        router.replace({ pathname: "/(auth)/register", params: firstName ? { firstName } : {} });
      }, 1_000);
    }, 80);

    return () => {
      clearInterval(interval);
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [firstName]);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top + 24, 38), paddingBottom: Math.max(insets.bottom + 32, 42), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
      <View style={styles.header}>
        <View style={styles.eyebrow}><Text style={styles.eyebrowText}>QUESTLIFE</Text></View>
        <Text style={styles.title}>Making your next adventure feel personal</Text>
      </View>

      <View accessibilityLiveRegion="polite" style={styles.loader}>
        <Text style={styles.percentage}>{progress}%</Text>
        <View style={styles.progressTrack}>
          <OnboardingQuestionProgress currentStep={progress} totalSteps={100} />
        </View>
        <View style={styles.pillRow}>
          {Array.from({ length: 8 }, (_, index) => (
            <View key={index} style={[styles.pill, index < completedPills && styles.pillComplete]}>
              {index < completedPills ? <Text style={styles.pillCheck}>✓</Text> : null}
            </View>
          ))}
        </View>
        <Text style={styles.status}>{status}</Text>
      </View>

      <Text style={styles.footer}>We’re using your answers to shape the quests you see first.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between", backgroundColor: T.bg },
  header: { alignItems: "center", gap: 12 },
  eyebrow: { borderRadius: 99, borderWidth: 2, borderColor: T.blue, backgroundColor: `${T.blue}18`, paddingHorizontal: 12, paddingVertical: 5 },
  eyebrowText: { color: T.blue, fontFamily: "RubikBlack", fontSize: 11, letterSpacing: 1.1 },
  title: { maxWidth: 320, color: T.dark, fontFamily: "RubikBlack", fontSize: 27, lineHeight: 33, letterSpacing: -0.55, textAlign: "center" },
  loader: { alignItems: "center", gap: 20 },
  percentage: { color: T.dark, fontFamily: "RubikBlack", fontSize: 52, lineHeight: 60, letterSpacing: -2 },
  progressTrack: { width: "100%", maxWidth: 340 },
  pillRow: { flexDirection: "row", justifyContent: "center", gap: 9 },
  pill: { width: 23, height: 23, borderRadius: 12, borderWidth: 2, borderColor: T.dark, alignItems: "center", justifyContent: "center", backgroundColor: T.white },
  pillComplete: { borderColor: T.blue, backgroundColor: T.blue },
  pillCheck: { color: T.white, fontFamily: "RubikBlack", fontSize: 13, lineHeight: 16 },
  status: { color: T.blue, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 28, letterSpacing: -0.35, textAlign: "center" },
  footer: { maxWidth: 310, alignSelf: "center", color: T.muted, fontFamily: "Rubik", fontSize: 15, lineHeight: 21, fontWeight: "700", textAlign: "center" },
});
