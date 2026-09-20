import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, Extrapolation, FadeInRight, interpolate, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";

import { OnboardingCompassRoute } from "@/components/onboarding-compass-route";
import { OnboardingQuestionProgress } from "@/components/onboarding-progress";
import { T } from "@/components/theme";
import { useResponsiveScreenLayout } from "@/components/ui";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

const SETUP_STAGES = [
  "Learning what you enjoy",
  "Finding a pace that feels right",
  "Noting the places that inspire you",
  "Mapping nearby possibilities",
  "Balancing solo and social ideas",
  "Choosing quests for your first week",
  "Building your QuestLife path",
  "Your QuestLife is ready",
] as const;
const SETUP_WORK_DURATION_MS = 23_000;
const PROFILE_COMPLETE_DURATION_MS = 4_400;
const PROFILE_ASSEMBLY_DURATION_MS = 2_100;
const CIRCLE_COUNT = 7;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type LoadingPace = {
  duration: number;
  end: number;
};

// The pauses acknowledge a completed thought before the next cluster of
// recommendations is assembled. They make the progress feel considered while
// retaining a predictable, finite 24-second handoff.
const LOADING_PACES: LoadingPace[] = [
  { duration: 2_200, end: 14 },
  { duration: 600, end: 14 },
  { duration: 3_300, end: 32 },
  { duration: 850, end: 35 },
  { duration: 550, end: 35 },
  { duration: 3_900, end: 58 },
  { duration: 1_100, end: 62 },
  { duration: 550, end: 62 },
  { duration: 3_900, end: 82 },
  { duration: 1_150, end: 86 },
  { duration: 550, end: 86 },
  { duration: 3_000, end: 98 },
  { duration: 1_350, end: 100 },
];

function progressForElapsedTime(elapsed: number) {
  let elapsedBeforePace = 0;
  let progressBeforePace = 0;

  for (const pace of LOADING_PACES) {
    const paceEnd = elapsedBeforePace + pace.duration;
    if (elapsed <= paceEnd) {
      const paceProgress = (elapsed - elapsedBeforePace) / pace.duration;
      return Math.round(progressBeforePace + (pace.end - progressBeforePace) * paceProgress);
    }
    elapsedBeforePace = paceEnd;
    progressBeforePace = pace.end;
  }

  return 100;
}

function RainbowDot({ color, delay, reducedMotion }: { color: string; delay: number; reducedMotion: boolean }) {
  const translateY = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  useEffect(() => {
    if (reducedMotion) {
      translateY.set(0);
      return;
    }
    translateY.set(withDelay(delay, withRepeat(withSequence(
      withTiming(-6, { duration: 320, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
      withTiming(0, { duration: 320, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
    ), -1, false)));
    return () => cancelAnimation(translateY);
  }, [delay, reducedMotion, translateY]);

  return <Animated.Text style={[styles.rainbowDot, { color }, style]}>.</Animated.Text>;
}

function CollapsingLoaderElement({ celebration, offsetX, offsetY, children, fillWidth = false }: { celebration: SharedValue<number>; offsetX: number; offsetY: number; children: React.ReactNode; fillWidth?: boolean }) {
  const style = useAnimatedStyle(() => {
    const progress = celebration.get();
    const scatter = interpolate(progress, [0, 0.26, 0.66, 1], [0, 1, 0.14, 0]);
    return {
      opacity: interpolate(progress, [0, 0.56, 0.84, 1], [1, 1, 0.24, 0]),
      transform: [{ translateX: offsetX * scatter }, { translateY: offsetY * scatter }, { scale: 1 + scatter * 0.045 }],
    };
  });
  return <Animated.View style={[fillWidth && styles.loaderElementFullWidth, style]}>{children}</Animated.View>;
}

function CollapsingCompletionCircle({ complete, celebration, index }: { complete: boolean; celebration: SharedValue<number>; index: number }) {
  const style = useAnimatedStyle(() => {
    const progress = celebration.get();
    const scatter = interpolate(progress, [0, 0.26, 0.7, 1], [0, 1, 0, 0]);
    return {
      opacity: interpolate(progress, [0, 0.67, 0.9, 1], [1, 1, 0.3, 0]),
      transform: [
        { translateX: (index - 3) * 18 * scatter + (3 - index) * 43 * interpolate(progress, [0.42, 0.76], [0, 1], Extrapolation.CLAMP) },
        { translateY: ((index % 2 === 0 ? -18 : 20) * scatter) - 12 * interpolate(progress, [0.42, 0.76], [0, 1], Extrapolation.CLAMP) },
        { scale: 1 + scatter * 0.12 },
      ],
    };
  });
  return <Animated.View style={[styles.completionCircle, complete && styles.completionCircleComplete, style]}>{complete ? <Text style={styles.completionCheck}>✓</Text> : null}</Animated.View>;
}

/** A brief handoff that makes the completed preferences feel personal. */
export default function PersonalizingOnboardingScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const { insets, horizontalPadding } = useResponsiveScreenLayout();
  const reducedMotion = useReducedMotionPreference();
  const [progress, setProgress] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const celebration = useSharedValue(0);
  const successFloatY = useSharedValue(0);
  const successFloatRotate = useSharedValue(0);
  const activeStageCount = SETUP_STAGES.length - 1;
  const stageIndex = progress === 100 ? activeStageCount : Math.min(Math.floor((progress / 100) * activeStageCount), activeStageCount - 1);
  const status = SETUP_STAGES[stageIndex];
  const isFinalStatus = progress === 100;
  const completedCircles = Math.floor((progress / 100) * CIRCLE_COUNT);

  useEffect(() => {
    const startedAt = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= SETUP_WORK_DURATION_MS) {
        clearInterval(interval);
        setProgress(100);
        setCelebrating(true);
        return;
      }

      setProgress(progressForElapsedTime(Math.min(elapsed, SETUP_WORK_DURATION_MS)));
    }, 75);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!celebrating) return;
    celebration.set(withTiming(1, { duration: reducedMotion ? 0 : PROFILE_ASSEMBLY_DURATION_MS, easing: EASE_OUT }));
    if (!reducedMotion) {
      successFloatY.set(withDelay(PROFILE_ASSEMBLY_DURATION_MS, withRepeat(withSequence(
        withTiming(-6, { duration: 1_550, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1_550, easing: Easing.inOut(Easing.sin) }),
      ), -1, false)));
      successFloatRotate.set(withDelay(PROFILE_ASSEMBLY_DURATION_MS, withRepeat(withSequence(
        withTiming(1.1, { duration: 1_550, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1_550, easing: Easing.inOut(Easing.sin) }),
      ), -1, false)));
    }
    const timer = setTimeout(() => {
      router.replace({
        pathname: "/(auth)/auth-options",
        params: firstName ? { firstName } : {},
      });
    }, reducedMotion ? 700 : PROFILE_COMPLETE_DURATION_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimation(successFloatY);
      cancelAnimation(successFloatRotate);
    };
  }, [celebrating, celebration, firstName, reducedMotion, successFloatRotate, successFloatY]);

  const compassStyle = useAnimatedStyle(() => ({
    opacity: 1 - celebration.get(),
    transform: [{ translateY: -22 * celebration.get() }, { scale: 1 - celebration.get() * 0.04 }],
  }));

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top + 24, 38), paddingBottom: Math.max(insets.bottom + 32, 42), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
      <Animated.View pointerEvents="none" style={[styles.compass, { top: Math.max(insets.top + 52, 84) }, compassStyle]}><OnboardingCompassRoute /></Animated.View>
      <View style={styles.content}>
        <View accessibilityLiveRegion="polite" style={styles.loader}>
          <CollapsingLoaderElement celebration={celebration} offsetX={-26} offsetY={-44}>
            <Text style={styles.percentage}>{progress}%</Text>
          </CollapsingLoaderElement>
          <CollapsingLoaderElement celebration={celebration} fillWidth offsetX={30} offsetY={20}>
            <View style={styles.progressTrack}>
              <OnboardingQuestionProgress animationDuration={260} currentStep={progress} totalSteps={100} />
            </View>
          </CollapsingLoaderElement>
          <View accessibilityLabel={`${completedCircles} of ${CIRCLE_COUNT} setup steps complete`} style={styles.completionRow}>
            {Array.from({ length: CIRCLE_COUNT }, (_, index) => {
              const complete = index < completedCircles;
              return <CollapsingCompletionCircle celebration={celebration} complete={complete} index={index} key={index} />;
            })}
          </View>
          <CollapsingLoaderElement celebration={celebration} offsetX={-22} offsetY={42}>
            <Animated.View key={status} entering={FadeInRight.duration(reducedMotion ? 0 : 180)} style={styles.statusRow}>
              <Text numberOfLines={1} style={styles.status}>{status}</Text>
              {isFinalStatus && !celebrating ? <View accessibilityElementsHidden style={styles.rainbowDots}>
                <RainbowDot color="#ff6b6b" delay={0} reducedMotion={reducedMotion} />
                <RainbowDot color="#f9c74f" delay={110} reducedMotion={reducedMotion} />
                <RainbowDot color={T.blue} delay={220} reducedMotion={reducedMotion} />
              </View> : null}
            </Animated.View>
          </CollapsingLoaderElement>
          {celebrating ? <ProfileCompletion celebration={celebration} floatRotate={successFloatRotate} floatY={successFloatY} /> : null}
        </View>
      </View>
    </View>
  );
}

function ProfileCompletion({ celebration, floatY, floatRotate }: { celebration: SharedValue<number>; floatY: SharedValue<number>; floatRotate: SharedValue<number> }) {
  const badgeStyle = useAnimatedStyle(() => {
    const progress = celebration.get();
    return {
      opacity: interpolate(progress, [0.35, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(progress, [0, 0.68, 0.84, 1], [0.88, 0.88, 1.1, 1], Extrapolation.CLAMP) },
        { rotate: `${interpolate(progress, [0.38, 0.88, 1], [0, 360, 360], Extrapolation.CLAMP)}deg` },
      ],
    };
  });
  const copyStyle = useAnimatedStyle(() => {
    const progress = celebration.get();
    return {
      opacity: interpolate(progress, [0.5, 1], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: 10 * (1 - progress) }],
    };
  });
  const floatingStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.get() }, { rotate: `${floatRotate.get()}deg` }] }));
  return <Animated.View pointerEvents="none" style={[styles.profileCompletion, floatingStyle]}>
    <Animated.View style={[styles.profileCheck, badgeStyle]}><Ionicons color={T.white} name="checkmark" size={47} /></Animated.View>
    <Animated.View style={copyStyle}><Text accessibilityRole="header" style={styles.profileCompletionTitle}>Your Quest Profile{`\n`}has been made!</Text></Animated.View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  compass: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  content: { flex: 1, width: "100%", maxWidth: 320, alignSelf: "center", justifyContent: "center" },
  // Every element in this compact status group shares a deliberate center line.
  // The rail is widest, while the step markers sit on a narrower measured row.
  loader: { width: "100%", minHeight: 224, alignItems: "center", justifyContent: "center", gap: 16 },
  loaderElementFullWidth: { width: "100%" },
  percentage: { color: T.dark, fontFamily: "RubikBlack", fontSize: 46, lineHeight: 54, letterSpacing: -1.5 },
  progressTrack: { width: "100%" },
  completionRow: { width: 272, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  completionCircle: { width: 26, height: 26, borderRadius: 99, borderWidth: 2, borderColor: T.dark, backgroundColor: T.white, alignItems: "center", justifyContent: "center" },
  completionCircleComplete: { borderColor: T.blue, backgroundColor: T.blue },
  completionCheck: { color: T.white, fontFamily: "RubikBlack", fontSize: 15, lineHeight: 17 },
  statusRow: { width: "100%", minHeight: 24, alignItems: "center", justifyContent: "center" },
  status: { maxWidth: "100%", color: T.blue, fontFamily: "RubikBlack", fontSize: 17, lineHeight: 24, letterSpacing: -0.15, textAlign: "center" },
  rainbowDots: { position: "absolute", right: 0, flexDirection: "row" },
  rainbowDot: { fontFamily: "RubikBlack", fontSize: 24, lineHeight: 24 },
  profileCompletion: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 18 },
  profileCheck: { width: 94, height: 94, borderRadius: 47, alignItems: "center", justifyContent: "center", backgroundColor: T.green, borderWidth: 4, borderColor: T.white, boxShadow: `4px 4px 0px ${T.border}` },
  profileCompletionTitle: { color: T.dark, fontFamily: "RubikBlack", fontSize: 24, lineHeight: 29, letterSpacing: -0.42, textAlign: "center" },
});
