import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { ONBOARDING_QUESTION_TOTAL, OnboardingQuestionProgress } from "@/components/onboarding-progress";
import { T } from "@/components/theme";

/** Consistent question navigation with phase-specific, accessible progress. */
export function OnboardingQuestionHeader({ currentStep, onBack, totalSteps = ONBOARDING_QUESTION_TOTAL, phaseLabel }: { currentStep: number; onBack: () => void; totalSteps?: number; phaseLabel?: string }) {
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous question" hitSlop={8} onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
        <Ionicons name="chevron-back" size={31} color={T.dark} />
      </Pressable>
      <View style={styles.progress}>
        <OnboardingQuestionProgress currentStep={currentStep} totalSteps={totalSteps} phaseLabel={phaseLabel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 10 },
  backButton: { width: 34, height: 36, alignItems: "flex-start", justifyContent: "center" },
  backButtonPressed: { opacity: 0.55, transform: [{ translateX: -1 }] },
  progress: { flex: 1 },
});
