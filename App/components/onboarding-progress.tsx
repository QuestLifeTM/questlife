import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { T } from "@/components/theme";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

const ADVENTURE_CATEGORY_BLUE = "#4D9CFF";
export const ONBOARDING_QUESTION_TOTAL = 13;

/** Shared progress treatment for every question in the onboarding flow. */
export function OnboardingQuestionProgress({ currentStep, totalSteps = ONBOARDING_QUESTION_TOTAL }: { currentStep: number; totalSteps?: number }) {
  const reduceMotion = useReducedMotionPreference();
  const fillProgress = useSharedValue(Math.max(0, (currentStep - 1) / totalSteps));

  useEffect(() => {
    fillProgress.set(withTiming(currentStep / totalSteps, {
      duration: reduceMotion ? 0 : 520,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
    }));
  }, [currentStep, fillProgress, reduceMotion, totalSteps]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fillProgress.get() * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Onboarding progress: question ${currentStep} of ${totalSteps}`}
      accessibilityValue={{ min: 0, max: totalSteps, now: currentStep }}
      style={styles.track}
    >
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 14, overflow: "hidden", borderRadius: 99, borderWidth: 2, borderColor: ADVENTURE_CATEGORY_BLUE, borderBottomWidth: 4, borderBottomColor: `${ADVENTURE_CATEGORY_BLUE}88`, backgroundColor: T.white },
  fill: { height: "100%", minWidth: 8, borderRadius: 99, backgroundColor: T.blue },
});
