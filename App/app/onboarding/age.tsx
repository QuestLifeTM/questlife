import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { T } from "@/components/theme";
import { haptic, useResponsiveScreenLayout } from "@/components/ui";

const AGE_OPTIONS = ["14–24", "25–34", "35–44", "45–54", "55+"];

export default function AgeOnboardingScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const { insets, horizontalPadding } = useResponsiveScreenLayout();
  const [ageRange, setAgeRange] = useState<string | null>(null);

  function continueOnboarding() {
    if (!ageRange) return;
    haptic();
    router.replace({ pathname: "/onboarding/understanding", params: firstName ? { firstName, stage: "quest" } : { stage: "quest" } });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 6, 18), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
        <View style={styles.questionHeader}>
          <Text style={styles.title}>How old are you?</Text>
          <Text style={styles.helper}>Choose 1 option</Text>
        </View>

        <View style={styles.optionList}>
          {AGE_OPTIONS.map((option) => {
            const selected = option === ageRange;
            return <Pressable key={option} accessibilityRole="radio" accessibilityLabel={option} accessibilityState={{ selected }} onPress={() => { haptic(); setAgeRange(option); }} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}>
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option}</Text>
              {selected ? <Ionicons name="checkmark" size={18} color={T.blue} /> : null}
            </Pressable>;
          })}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 20), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue" accessibilityState={{ disabled: !ageRange }} disabled={!ageRange} onPress={continueOnboarding} style={({ pressed }) => [styles.continueButton, !ageRange && styles.continueButtonDisabled, pressed && ageRange && styles.continueButtonPressed]}>
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
  // The extra top inset replaces the visual breathing room usually occupied by
  // the question-progress bar, without making age part of that progress flow.
  questionHeader: { paddingTop: 44, paddingBottom: 14, gap: 4 },
  title: { maxWidth: 348, color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28, letterSpacing: -0.35 },
  helper: { color: T.muted, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18 },
  optionList: { gap: 9 },
  option: { minHeight: 58, paddingHorizontal: 14, borderRadius: 20, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, boxShadow: `4px 4px 0px ${T.border}`, flexDirection: "row", alignItems: "center", gap: 9 },
  optionSelected: { borderColor: T.blue, boxShadow: "4px 4px 0px #258fd8" },
  optionPressed: { transform: [{ translateY: 2 }] },
  optionLabel: { flex: 1, color: T.dark, fontFamily: "Rubik", fontWeight: "600", fontSize: 15.5, lineHeight: 20, letterSpacing: -0.1 },
  optionLabelSelected: { color: T.dark },
  footer: { backgroundColor: T.bg, paddingTop: 10 },
  continueButton: { minHeight: 58, paddingHorizontal: 18, borderRadius: 20, backgroundColor: T.blue, borderBottomWidth: 6, borderBottomColor: "#258fd8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  continueButtonDisabled: { backgroundColor: T.border, borderBottomColor: "#d7cec2" },
  continueButtonPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 3 },
  continueText: { color: T.white, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, letterSpacing: 0.55, textTransform: "uppercase" },
});
