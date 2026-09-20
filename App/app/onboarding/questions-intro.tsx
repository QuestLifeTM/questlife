import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";

import { T } from "@/components/theme";
import { haptic, useResponsiveScreenLayout } from "@/components/ui";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { OnboardingQuestionHeader } from "@/components/onboarding-question-header";
import { ONBOARDING_PERSONALIZATION_TOTAL } from "@/components/onboarding-progress";

type OnboardingOption = {
  id: string;
  label: string;
  emoji?: string;
  icon?: ImageSourcePropType;
};

type OnboardingQuestion = {
  id: string;
  titlePrefix: string;
  titleAccent: string;
  titleSuffix: string;
  helper: string;
  maximumSelections: number;
  minimumSelections: number;
  options: OnboardingOption[];
};

const QUESTION_OPTION_ICONS = {
  backpack: require("../../assets/onboarding/question-icons/backpack.png"),
  bed: require("../../assets/onboarding/question-icons/bed.png"),
  campingTent: require("../../assets/onboarding/question-icons/camping-tent.png"),
  clock: require("../../assets/onboarding/question-icons/clock.png"),
  confused: require("../../assets/onboarding/question-icons/confused.png"),
  forest: require("../../assets/onboarding/question-icons/forest.png"),
  fortuneCookie: require("../../assets/onboarding/question-icons/fortune-cookie.png"),
  goal: require("../../assets/onboarding/question-icons/goal.png"),
  happy: require("../../assets/onboarding/question-icons/happy.png"),
  personalGrowth: require("../../assets/onboarding/question-icons/personal-growth.png"),
  hourglass: require("../../assets/onboarding/question-icons/hourglass.png"),
  lightning: require("../../assets/onboarding/question-icons/lightning.png"),
  paintPalette: require("../../assets/onboarding/question-icons/paint-palette.png"),
  rollerCoaster: require("../../assets/onboarding/question-icons/roller-coaster.png"),
  shocked: require("../../assets/onboarding/question-icons/shocked.png"),
  smiling: require("../../assets/onboarding/question-icons/smiling.png"),
  social: require("../../assets/onboarding/question-icons/social.png"),
  star: require("../../assets/onboarding/question-icons/star.png"),
  strawberryCheesecake: require("../../assets/onboarding/question-icons/strawberry-cheesecake.png"),
};

const QUESTIONS: OnboardingQuestion[] = [
  {
    id: "quest-style",
    titlePrefix: "What sounds like your kind of ",
    titleAccent: "quest",
    titleSuffix: "?",
    helper: "Choose up to 3",
    maximumSelections: 3,
    minimumSelections: 1,
    options: [
      { id: "chill", icon: QUESTION_OPTION_ICONS.bed, label: "Chill & laid-back" },
      { id: "exploring", icon: QUESTION_OPTION_ICONS.forest, label: "Exploring & discovering" },
      { id: "creative", icon: QUESTION_OPTION_ICONS.paintPalette, label: "Creative & unique" },
      { id: "active", icon: QUESTION_OPTION_ICONS.lightning, label: "Active & energetic" },
      { id: "competitive", icon: QUESTION_OPTION_ICONS.rollerCoaster, label: "Competitive & challenging" },
      { id: "social", icon: QUESTION_OPTION_ICONS.social, label: "Social & outgoing" },
      { id: "spontaneous", icon: QUESTION_OPTION_ICONS.shocked, label: "Spontaneous & unexpected" },
    ],
  },
  {
    id: "places",
    titlePrefix: "What kind of ",
    titleAccent: "places",
    titleSuffix: " would you love to discover?",
    helper: "Choose up to 3",
    maximumSelections: 3,
    minimumSelections: 1,
    options: [
      { id: "nature", icon: QUESTION_OPTION_ICONS.forest, label: "Nature & parks" },
      { id: "beaches", icon: QUESTION_OPTION_ICONS.campingTent, label: "Beaches & water" },
      { id: "restaurants", icon: QUESTION_OPTION_ICONS.strawberryCheesecake, label: "Restaurants & cafés" },
      { id: "entertainment", icon: QUESTION_OPTION_ICONS.rollerCoaster, label: "Entertainment & games" },
      { id: "museums", icon: QUESTION_OPTION_ICONS.goal, label: "Museums & attractions" },
      { id: "hidden-spots", icon: QUESTION_OPTION_ICONS.confused, label: "Hidden local spots" },
      { id: "anywhere-new", icon: QUESTION_OPTION_ICONS.backpack, label: "Anywhere I've never been" },
    ],
  },
  {
    id: "time",
    titlePrefix: "How much ",
    titleAccent: "time",
    titleSuffix: " do you usually have for a quest?",
    helper: "Choose 1",
    maximumSelections: 1,
    minimumSelections: 1,
    options: [
      { id: "10-30", icon: QUESTION_OPTION_ICONS.clock, label: "10–30 minutes" },
      { id: "30-60", icon: QUESTION_OPTION_ICONS.hourglass, label: "30–60 minutes" },
      { id: "1-2", icon: QUESTION_OPTION_ICONS.personalGrowth, label: "1–2 hours" },
      { id: "2-4", icon: QUESTION_OPTION_ICONS.campingTent, label: "2–4 hours" },
      { id: "half-day", icon: QUESTION_OPTION_ICONS.happy, label: "Half a day" },
      { id: "full-day", icon: QUESTION_OPTION_ICONS.star, label: "A full day" },
    ],
  },
  {
    id: "adventure-level",
    titlePrefix: "How ",
    titleAccent: "adventurous",
    titleSuffix: " should your quests be?",
    helper: "Choose 1",
    maximumSelections: 1,
    minimumSelections: 1,
    options: [
      { id: "easy", icon: QUESTION_OPTION_ICONS.smiling, label: "Keep it easy" },
      { id: "comfort-zone", icon: QUESTION_OPTION_ICONS.personalGrowth, label: "A little outside my comfort zone" },
      { id: "mixed", icon: QUESTION_OPTION_ICONS.fortuneCookie, label: "Mix it up" },
      { id: "push", icon: QUESTION_OPTION_ICONS.lightning, label: "Push me" },
      { id: "surprise", icon: QUESTION_OPTION_ICONS.shocked, label: "Surprise me" },
    ],
  },
];

export default function QuestionsIntroScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const { insets, horizontalPadding } = useResponsiveScreenLayout();
  const reduceMotion = useReducedMotionPreference();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const question = QUESTIONS[questionIndex];
  const selectedIds = answers[question.id] ?? [];
  const hasRequiredSelections = selectedIds.length >= question.minimumSelections;
  const progressStep = questionIndex + 2;

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

    router.replace({ pathname: "/onboarding/personalizing", params: firstName ? { firstName } : {} });
  }

  function goBack() {
    haptic();
    if (questionIndex > 0) {
      setQuestionIndex((current) => current - 1);
      return;
    }
    router.replace({ pathname: "/onboarding/claim-username", params: firstName ? { firstName } : {} });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 6, 18), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
        <View style={styles.progressSection}><OnboardingQuestionHeader currentStep={progressStep} totalSteps={ONBOARDING_PERSONALIZATION_TOTAL} phaseLabel="Personalizing your experience" onBack={goBack} /></View>

        <Animated.View key={question.id} entering={FadeInRight.duration(reduceMotion ? 0 : 280)} style={styles.questionStage}>
        <View style={styles.questionHeader}>
          <Text style={styles.title}>
            {question.titlePrefix}<Text style={styles.titleAccent}>{question.titleAccent}</Text>
            {question.id === "quest-style" ? <Text style={styles.titleAccent}>{question.titleSuffix}</Text> : question.titleSuffix}
          </Text>
          <Text style={styles.helper}>{question.helper}</Text>
        </View>

        <ScrollView style={styles.optionScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.optionList}>
          {question.options.map((option) => {
            const selected = selectedIds.includes(option.id);
            return (
              <Pressable
                key={option.id}
                accessibilityRole={question.maximumSelections === 1 ? "radio" : "checkbox"}
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
        </Animated.View>
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
  questionStage: { flex: 1 },
  questionHeader: { paddingTop: 18, paddingBottom: 14, gap: 4 },
  // These match the Lobby's sheet title, supporting copy, and stat-label scale.
  title: { maxWidth: 348, color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28, letterSpacing: -0.35 },
  titleAccent: { color: T.blue },
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
