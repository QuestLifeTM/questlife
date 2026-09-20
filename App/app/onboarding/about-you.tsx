import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInRight, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { OnboardingQuestionHeader } from "@/components/onboarding-question-header";
import { ONBOARDING_DISCOVERY_TOTAL } from "@/components/onboarding-progress";
import { T } from "@/components/theme";
import { haptic, useResponsiveScreenLayout } from "@/components/ui";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

type Option = { id: string; label: string; emoji?: string; icon?: ImageSourcePropType; ionicon?: keyof typeof Ionicons.glyphMap; iconColor?: string };
type Question = {
  id: "lookingFor" | "socialCircle" | "discoverySource" | "idealLife";
  options: Option[];
  maximumSelections?: number;
  minimumSelections?: number;
  helper?: string;
};

const QUESTIONS: Question[] = [
  {
    id: "lookingFor",
    maximumSelections: 7,
    minimumSelections: 1,
    helper: "Choose all that apply",
    options: [
      { id: "discover", icon: require("../../assets/onboarding/question-icons/backpack.png"), label: "Discover something new" },
      { id: "friends", icon: require("../../assets/onboarding/question-icons/friends.png"), label: "Something to do with friends" },
      { id: "someone", icon: require("../../assets/onboarding/question-icons/heart-with-pulse.png"), label: "Something to do with someone" },
      { id: "outside", icon: require("../../assets/onboarding/question-icons/forest.png"), label: "Get outside" },
      { id: "creative", icon: require("../../assets/onboarding/question-icons/paint-palette.png"), label: "Try something creative" },
      { id: "push-myself", icon: require("../../assets/onboarding/question-icons/lightning.png"), label: "Push myself" },
      { id: "good-time", icon: require("../../assets/onboarding/question-icons/smiling.png"), label: "Just have a good time" },
    ],
  },
  {
    id: "socialCircle",
    options: [
      { id: "myself", icon: require("../../assets/onboarding/question-icons/person.png"), label: "Just me" },
      { id: "friends", icon: require("../../assets/onboarding/question-icons/meeting-friends.png"), label: "Friends" },
      { id: "family", icon: require("../../assets/onboarding/question-icons/social.png"), label: "Family" },
      { id: "partner", icon: require("../../assets/onboarding/question-icons/star.png"), label: "Someone special" },
      { id: "open-to-meeting", icon: require("../../assets/onboarding/question-icons/meeting.png"), label: "I'm open to meeting people" },
    ],
  },
  {
    id: "discoverySource",
    options: [
      { id: "instagram", ionicon: "logo-instagram", iconColor: "#E4405F", label: "Instagram" },
      { id: "tiktok", ionicon: "logo-tiktok", iconColor: T.dark, label: "TikTok" },
      { id: "friends-family", ionicon: "people", iconColor: T.blue, label: "Friends/Family" },
      { id: "play-store", ionicon: "logo-google-playstore", iconColor: "#34A853", label: "Play Store" },
      { id: "youtube", ionicon: "logo-youtube", iconColor: "#FF0000", label: "YouTube" },
      { id: "reddit", ionicon: "logo-reddit", iconColor: "#FF4500", label: "Reddit" },
      { id: "ai-chat", ionicon: "sparkles", iconColor: "#7C5CFC", label: "AI chat" },
    ],
  },
  {
    id: "idealLife",
    helper: "Choose 1 option",
    options: [
      { id: "purpose", icon: require("../../assets/onboarding/question-icons/goal.png"), label: "Living each day with purpose" },
      { id: "amazing-people", icon: require("../../assets/onboarding/question-icons/friends.png"), label: "Surrounding myself with amazing people" },
      { id: "no-regrets", icon: require("../../assets/onboarding/question-icons/happy.png"), label: "Looking back with no regrets" },
      { id: "proud-self", icon: require("../../assets/onboarding/question-icons/fortune-cookie.png"), label: "Becoming someone I'm proud to be" },
    ],
  },
];

export default function AboutYouOnboardingScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const { insets, horizontalPadding } = useResponsiveScreenLayout();
  const reduceMotion = useReducedMotionPreference();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<Question["id"], string[]>>({} as Record<Question["id"], string[]>);
  const [isCompleting, setIsCompleting] = useState(false);
  const completionOpacity = useSharedValue(1);
  const completionStyle = useAnimatedStyle(() => ({ opacity: completionOpacity.get() }));
  const question = QUESTIONS[questionIndex];
  const selectedIds = answers[question.id] ?? [];
  const maximumSelections = question.maximumSelections ?? 1;
  const minimumSelections = question.minimumSelections ?? maximumSelections;
  const canContinue = selectedIds.length >= minimumSelections;

  useEffect(() => {
    // Warm the next scene while the user answers these questions. It never
    // gates interaction, but prevents a late image decode at the handoff.
    void Asset.loadAsync([
      require("../../assets/onboarding/iphone-mockup.png"),
      require("../../assets/onboarding/stone-arch-background.png"),
    ]).catch(() => {});
  }, []);

  function chooseOption(optionId: string) {
    haptic();
    setAnswers((current) => {
      const currentSelections = current[question.id] ?? [];
      const selected = currentSelections.includes(optionId);
      if (!selected && maximumSelections === 1) return { ...current, [question.id]: [optionId] };
      if (!selected && currentSelections.length >= maximumSelections) return current;
      return { ...current, [question.id]: selected ? currentSelections.filter((id) => id !== optionId) : [...currentSelections, optionId] };
    });
  }

  function continueOnboarding() {
    if (!canContinue || isCompleting) return;
    haptic();

    if (questionIndex < QUESTIONS.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    setIsCompleting(true);
    const duration = reduceMotion ? 0 : 260;
    completionOpacity.set(withTiming(0, { duration, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    setTimeout(() => {
      router.replace({
        pathname: "/onboarding/understanding",
        params: {
          ...(firstName ? { firstName } : {}),
          ...(answers.idealLife?.[0] ? { idealLifeId: answers.idealLife[0] } : {}),
        },
      });
    }, duration);
  }

  function goBack() {
    haptic();
    if (questionIndex > 0) {
      setQuestionIndex((current) => current - 1);
      return;
    }
    router.replace("/");
  }

  function questionTitle() {
    switch (question.id) {
      case "lookingFor":
        return <>What are you really looking for <Text style={styles.titleAccent}>right now</Text>?</>;
      case "socialCircle":
        return <>Who do you usually go on <Text style={styles.titleAccent}>adventures</Text> with?</>;
      case "discoverySource":
        return <>Where did you <Text style={styles.titleAccent}>find</Text> us?</>;
      case "idealLife":
        return <>What do you want your <Text style={styles.titleAccent}>life</Text> to be about?</>;
    }
  }

  return (
    <View style={styles.root}>
      <Animated.View pointerEvents={isCompleting ? "none" : "auto"} style={[styles.completionLayer, completionStyle]}>
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 6, 18), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
        <View style={styles.progressSection}><OnboardingQuestionHeader currentStep={questionIndex + 1} totalSteps={ONBOARDING_DISCOVERY_TOTAL} phaseLabel="Getting to know you" onBack={goBack} /></View>
        <Animated.View key={question.id} entering={FadeInRight.duration(reduceMotion ? 0 : 280)} style={styles.questionStage}>
          <View style={styles.questionHeader}>
            {questionIndex === 0 && firstName?.trim() ? <Text style={styles.greeting}>Nice to meet you, <Text style={styles.greetingName}>{firstName.trim()}</Text>.</Text> : null}
            <Text style={styles.title}>{questionTitle()}</Text>
            {question.helper ? <Text style={styles.helper}>{question.helper}</Text> : null}
          </View>
          <ScrollView style={styles.optionScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.optionList}>
          {question.options.map((option) => {
            const selected = selectedIds.includes(option.id);
            return <Pressable key={option.id} accessibilityRole={maximumSelections === 1 ? "radio" : "checkbox"} accessibilityLabel={option.label} accessibilityState={{ checked: selected, disabled: maximumSelections > 1 && !selected && selectedIds.length >= maximumSelections }} onPress={() => chooseOption(option.id)} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}>
              {option.icon ? <View style={styles.optionIconFrame}><Image source={option.icon} resizeMode="contain" style={styles.optionIcon} /></View> : option.ionicon ? <View style={styles.optionIconFrame}><Ionicons name={option.ionicon} size={25} color={option.iconColor ?? T.dark} /></View> : option.emoji ? <View style={styles.optionIconFrame}><Text style={styles.optionEmoji}>{option.emoji}</Text></View> : null}
              <Text style={styles.optionLabel}>{option.label}</Text>
              {selected ? <Ionicons name="checkmark" size={18} color={T.blue} /> : null}
            </Pressable>;
          })}
          </ScrollView>
        </Animated.View>
      </View>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 20), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue" accessibilityState={{ disabled: !canContinue || isCompleting }} disabled={!canContinue || isCompleting} onPress={continueOnboarding} style={({ pressed }) => [styles.continueButton, (!canContinue || isCompleting) && styles.continueButtonDisabled, pressed && canContinue && !isCompleting && styles.continueButtonPressed]}>
          <Ionicons name="arrow-forward" size={19} color={T.white} />
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The final question fades onto the same dark foundation as the mockup
  // route, eliminating the white frame between the two screens.
  root: { flex: 1, backgroundColor: "#101510" },
  completionLayer: { flex: 1, backgroundColor: T.bg },
  content: { flex: 1 },
  progressSection: { paddingTop: 2 },
  questionStage: { flex: 1 },
  questionHeader: { paddingTop: 18, paddingBottom: 18, gap: 8 },
  greeting: { color: T.muted, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20 },
  greetingName: { color: T.blue },
  title: { maxWidth: 348, color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28, letterSpacing: -0.35 },
  titleAccent: { color: T.blue },
  helper: { color: T.muted, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18 },
  optionScroll: { flex: 1, marginHorizontal: -4, paddingHorizontal: 4 },
  optionList: { gap: 9, paddingBottom: 12 },
  option: { minHeight: 58, paddingHorizontal: 16, borderRadius: 20, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, boxShadow: `4px 4px 0px ${T.border}`, flexDirection: "row", alignItems: "center", gap: 9 },
  optionSelected: { borderColor: T.blue, boxShadow: "4px 4px 0px #258fd8" },
  optionPressed: { transform: [{ translateY: 2 }] },
  optionLabel: { flex: 1, color: T.dark, fontFamily: "Rubik", fontWeight: "600", fontSize: 15.5, lineHeight: 20, letterSpacing: -0.1 },
  optionIconFrame: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  optionIcon: { width: 28, height: 28 },
  optionEmoji: { fontSize: 21, lineHeight: 26 },
  footer: { backgroundColor: T.bg, paddingTop: 10 },
  continueButton: { minHeight: 58, paddingHorizontal: 18, borderRadius: 20, backgroundColor: T.blue, borderBottomWidth: 6, borderBottomColor: "#258fd8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  continueButtonDisabled: { backgroundColor: T.border, borderBottomColor: "#d7cec2" },
  continueButtonPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 3 },
  continueText: { color: T.white, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, letterSpacing: 0.55, textTransform: "uppercase" },
});
