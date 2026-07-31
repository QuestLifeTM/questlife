import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { OnboardingQuestionProgress } from "@/components/onboarding-progress";
import { T } from "@/components/theme";
import { haptic, useResponsiveScreenLayout } from "@/components/ui";
import { WeeklyFrequencySlider } from "@/components/weekly-frequency-slider";

export default function FrequencyOnboardingScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const { insets, horizontalPadding } = useResponsiveScreenLayout();
  const [daysPerWeek, setDaysPerWeek] = useState(3);

  function continueOnboarding() {
    haptic();
    router.replace({
      pathname: "/onboarding/follow-up-questions",
      params: {
        ...(firstName ? { firstName } : {}),
        daysTryingNewThings: String(daysPerWeek),
      },
    });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 6, 18), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
        <View style={styles.progressSection}><OnboardingQuestionProgress currentStep={3} /></View>
        <View style={styles.questionHeader}>
          <Text style={styles.title}>Be honest, how often do you try <Text style={styles.titleAccent}>something</Text> new?</Text>
        </View>
        <View style={styles.sliderSection}>
          <WeeklyFrequencySlider value={daysPerWeek} onChange={setDaysPerWeek} />
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 20), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue" onPress={continueOnboarding} style={({ pressed }) => [styles.continueButton, pressed && styles.continueButtonPressed]}>
          <Ionicons name="arrow-forward" size={19} color={T.white} />
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  content: { flex: 1 },
  progressSection: { paddingTop: 2 },
  questionHeader: { paddingTop: 28 },
  title: { maxWidth: 348, color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28, letterSpacing: -0.35 },
  titleAccent: { color: T.blue },
  sliderSection: { flex: 1, justifyContent: "center", paddingHorizontal: 4, paddingBottom: 60 },
  footer: { backgroundColor: T.bg, paddingTop: 10 },
  continueButton: { minHeight: 58, paddingHorizontal: 18, borderRadius: 20, backgroundColor: T.blue, borderBottomWidth: 6, borderBottomColor: "#258fd8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  continueButtonPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 3 },
  continueText: { color: T.white, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, letterSpacing: 0.55, textTransform: "uppercase" },
});
