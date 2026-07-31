import { StyleSheet, View } from "react-native";

import { T } from "@/components/theme";

const ADVENTURE_CATEGORY_BLUE = "#4D9CFF";

/** Shared progress treatment for the preference questions, including routes between them. */
export function OnboardingQuestionProgress({ currentStep, totalSteps = 8 }: { currentStep: number; totalSteps?: number }) {
  const progress = `${Math.round((currentStep / totalSteps) * 100)}%` as `${number}%`;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Onboarding progress: question ${currentStep} of ${totalSteps}`}
      accessibilityValue={{ min: 0, max: totalSteps, now: currentStep }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: progress }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 14, overflow: "hidden", borderRadius: 99, borderWidth: 2, borderColor: ADVENTURE_CATEGORY_BLUE, borderBottomWidth: 4, borderBottomColor: `${ADVENTURE_CATEGORY_BLUE}88`, backgroundColor: T.white },
  fill: { height: "100%", minWidth: 8, borderRadius: 99, backgroundColor: T.blue },
});
