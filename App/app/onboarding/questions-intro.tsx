import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { T } from "@/components/theme";
import { haptic, useResponsiveScreenLayout } from "@/components/ui";
import { OnboardingQuestionProgress } from "@/components/onboarding-progress";

type OnboardingOption = {
  id: string;
  label: string;
  emoji?: string;
  icon?: ImageSourcePropType;
};

type OnboardingQuestion = {
  id: string;
  title: string;
  helper: string;
  maximumSelections: number;
  options: OnboardingOption[];
};

const QUESTION_OPTION_ICONS = {
  backpack: require("../../assets/onboarding/question-icons/backpack.png"),
  personalGrowth: require("../../assets/onboarding/question-icons/personal-growth.png"),
  campingTent: require("../../assets/onboarding/question-icons/camping-tent.png"),
  heartWithPulse: require("../../assets/onboarding/question-icons/heart-with-pulse.png"),
  hourglass: require("../../assets/onboarding/question-icons/hourglass.png"),
  lightning: require("../../assets/onboarding/question-icons/lightning.png"),
  fortuneCookie: require("../../assets/onboarding/question-icons/fortune-cookie.png"),
  happy: require("../../assets/onboarding/question-icons/happy.png"),
  friends: require("../../assets/onboarding/question-icons/friends.png"),
  goal: require("../../assets/onboarding/question-icons/goal.png"),
};

// Add future questions here. The progress indicator and handoff automatically
// use this list, so new question screens cannot get out of sync with progress.
const QUESTIONS: OnboardingQuestion[] = [
  {
    id: "questlife-goals",
    title: "What do you want to achieve with QuestLife?",
    helper: "Choose 3 options",
    maximumSelections: 3,
    options: [
      { id: "explore-less-scroll", icon: QUESTION_OPTION_ICONS.backpack, label: "explore more, scroll less" },
      { id: "more-consistent", icon: QUESTION_OPTION_ICONS.personalGrowth, label: "become more consistent" },
      { id: "comfort-zone", icon: QUESTION_OPTION_ICONS.campingTent, label: "break out of my comfort zone" },
      { id: "life-exciting", icon: QUESTION_OPTION_ICONS.lightning, label: "make life exciting again" },
      { id: "stop-procrastinating", icon: QUESTION_OPTION_ICONS.hourglass, label: "finally stop procrastinating" },
      { id: "best-self", emoji: "🌱", label: "become my best self" },
      { id: "unforgettable-memories", icon: QUESTION_OPTION_ICONS.heartWithPulse, label: "make unforgettable memories" },
    ],
  },
  {
    id: "ideal-life",
    title: "Think bigger, what does an ideal life look like to you?",
    helper: "Choose 1 option",
    maximumSelections: 1,
    options: [
      { id: "purpose", icon: QUESTION_OPTION_ICONS.goal, label: "living each day with purpose" },
      { id: "amazing-people", icon: QUESTION_OPTION_ICONS.friends, label: "surrounding myself with amazing people" },
      { id: "no-regrets", icon: QUESTION_OPTION_ICONS.happy, label: "looking back with no regrets" },
      { id: "proud-self", icon: QUESTION_OPTION_ICONS.fortuneCookie, label: "becoming someone I'm proud to be" },
    ],
  },
];

export default function QuestionsIntroScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const { insets, horizontalPadding } = useResponsiveScreenLayout();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const question = QUESTIONS[questionIndex];
  const selectedIds = answers[question.id] ?? [];
  const hasRequiredSelections = selectedIds.length >= question.maximumSelections;
  const progressStep = questionIndex + 1;

  function toggleOption(id: string) {
    haptic();
    setAnswers((current) => {
      const currentSelections = current[question.id] ?? [];
      const isSelected = currentSelections.includes(id);
      if (!isSelected && question.maximumSelections === 1) {
        return { ...current, [question.id]: [id] };
      }
      if (!isSelected && currentSelections.length >= question.maximumSelections) return current;

      return {
        ...current,
        [question.id]: isSelected ? currentSelections.filter((selectedId) => selectedId !== id) : [...currentSelections, id],
      };
    });
  }

  function continueOnboarding() {
    if (!hasRequiredSelections) return;
    haptic();

    if (questionIndex < QUESTIONS.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    router.replace({
      pathname: "/onboarding/reassurance",
      params: {
        ...(firstName ? { firstName } : {}),
        goalIds: JSON.stringify(answers["questlife-goals"] ?? []),
        idealLifeId: answers["ideal-life"]?.[0] ?? "",
      },
    });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 6, 18), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
        <View style={styles.progressSection}><OnboardingQuestionProgress currentStep={progressStep} /></View>

        <View style={styles.questionHeader}>
          <Text numberOfLines={question.id === "ideal-life" ? 2 : undefined} adjustsFontSizeToFit={question.id === "ideal-life"} minimumFontScale={0.82} style={[styles.title, question.id === "ideal-life" && styles.secondQuestionTitle]}>{question.id === "questlife-goals" ? <>What do you want to <Text style={styles.titleAccent}>achieve</Text> with QuestLife?</> : question.id === "ideal-life" ? <>Think bigger, what does an <Text style={styles.titleAccent}>ideal{"\u00A0"}life</Text> look like to you?</> : question.title}</Text>
          <Text style={styles.helper}>{question.helper}</Text>
        </View>

        <ScrollView style={styles.optionScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.optionList}>
          {question.options.map((option) => {
            const selected = selectedIds.includes(option.id);
            return (
              <Pressable
                key={option.id}
                accessibilityRole="checkbox"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: selected, disabled: question.maximumSelections > 1 && !selected && selectedIds.length >= question.maximumSelections }}
                onPress={() => toggleOption(option.id)}
                style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
              >
                {option.icon ? <View style={styles.optionIconFrame}><Image source={option.icon} resizeMode="contain" style={styles.optionIcon} /></View> : option.emoji ? <View style={styles.optionIconFrame}><Text style={styles.optionEmoji}>{option.emoji}</Text></View> : null}
                <Text style={styles.optionLabel}>{option.label}</Text>
                {selected ? <Ionicons name="checkmark" size={18} color={T.blue} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 20), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue" accessibilityState={{ disabled: !hasRequiredSelections }} disabled={!hasRequiredSelections} onPress={continueOnboarding} style={({ pressed }) => [styles.continueButton, !hasRequiredSelections && styles.continueButtonDisabled, pressed && hasRequiredSelections && styles.continueButtonPressed]}>
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
  questionHeader: { paddingTop: 28, paddingBottom: 14, gap: 4 },
  // These match the Lobby's sheet title, supporting copy, and stat-label scale.
  title: { maxWidth: 348, color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28, letterSpacing: -0.35 },
  titleAccent: { color: T.blue },
  secondQuestionTitle: { fontSize: 23, lineHeight: 28, letterSpacing: -0.35 },
  helper: { color: T.muted, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18 },
  optionScroll: { flex: 1, marginHorizontal: -4, paddingHorizontal: 4 },
  optionList: { gap: 9, paddingBottom: 12 },
  // Mirrors the active-quest card on Lobby: clean surface, 2px outline, and
  // a 4px tactile shadow. Selection preserves that structure in Quest blue.
  option: { minHeight: 58, paddingHorizontal: 14, borderRadius: 20, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, boxShadow: `4px 4px 0px ${T.border}`, flexDirection: "row", alignItems: "center", gap: 9 },
  optionSelected: { borderColor: T.blue, boxShadow: "4px 4px 0px #258fd8", backgroundColor: T.white },
  optionPressed: { transform: [{ translateY: 2 }] },
  optionIconFrame: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  optionEmoji: { fontSize: 21, lineHeight: 26 },
  optionIcon: { width: 28, height: 28 },
  optionLabel: { flex: 1, color: T.dark, fontFamily: "Rubik", fontWeight: "600", fontSize: 15.5, lineHeight: 20, letterSpacing: -0.1 },
  footer: { backgroundColor: T.bg, paddingTop: 10 },
  continueButton: { minHeight: 58, paddingHorizontal: 18, borderRadius: 20, backgroundColor: T.blue, borderBottomWidth: 6, borderBottomColor: "#258fd8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  continueButtonDisabled: { backgroundColor: T.border, borderBottomColor: "#d7cec2" },
  continueButtonPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 3 },
  continueText: { color: T.white, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, letterSpacing: 0.55, textTransform: "uppercase" },
});
