import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { OnboardingQuestionHeader } from "@/components/onboarding-question-header";
import { T } from "@/components/theme";
import { haptic, useResponsiveScreenLayout } from "@/components/ui";

type Option = { id: string; label: string; emoji?: string; icon?: ImageSourcePropType };
type Question = {
  id: "ageRange" | "socialCircle" | "discoverySource";
  options: Option[];
  maximumSelections?: number;
  helper?: string;
};

const QUESTIONS: Question[] = [
  {
    id: "ageRange",
    options: [
      { id: "under-18", label: "Under 18" },
      { id: "18-24", label: "18 – 24" },
      { id: "25-34", label: "25 – 34" },
      { id: "35-44", label: "35 – 44" },
      { id: "45-54", label: "45 – 54" },
      { id: "55-plus", label: "55+" },
    ],
  },
  {
    id: "socialCircle",
    options: [
      { id: "myself", label: "Myself" },
      { id: "partner", label: "With my partner" },
      { id: "family", label: "My family" },
      { id: "friends", label: "My friends" },
    ],
  },
  {
    id: "discoverySource",
    options: [
      { id: "instagram", label: "Instagram" },
      { id: "tiktok", label: "TikTok" },
      { id: "friends-family", label: "Friends/Family" },
      { id: "play-store", label: "Play Store" },
      { id: "youtube", label: "YouTube" },
      { id: "reddit", label: "Reddit" },
      { id: "ai-chat", label: "AI chat" },
    ],
  },
];

export default function AboutYouOnboardingScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const { insets, horizontalPadding } = useResponsiveScreenLayout();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<Question["id"], string[]>>({} as Record<Question["id"], string[]>);
  const question = QUESTIONS[questionIndex];
  const selectedIds = answers[question.id] ?? [];
  const maximumSelections = question.maximumSelections ?? 1;
  const canContinue = selectedIds.length >= maximumSelections;

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
    if (!canContinue) return;
    haptic();

    if (questionIndex < QUESTIONS.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    router.replace({ pathname: "/onboarding/understanding", params: firstName ? { firstName } : {} });
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
      case "ageRange":
        return <>How <Text style={styles.titleAccent}>old</Text> are you?</>;
      case "socialCircle":
        return <>Who do you usually spend the <Text style={styles.titleAccent}>most time</Text> with?</>;
      case "discoverySource":
        return <>Where did you <Text style={styles.titleAccent}>find</Text> us?</>;
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 6, 18), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
        <View style={styles.progressSection}><OnboardingQuestionHeader currentStep={questionIndex + 1} onBack={goBack} /></View>
        <View style={styles.questionHeader}>
          {questionIndex === 0 && firstName?.trim() ? <Text style={styles.greeting}>Nice to meet you, <Text style={styles.greetingName}>{firstName.trim()}</Text>.</Text> : null}
          <Text style={styles.title}>{questionTitle()}</Text>
          {question.helper ? <Text style={styles.helper}>{question.helper}</Text> : null}
        </View>
        <ScrollView style={styles.optionScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.optionList}>
          {question.options.map((option) => {
            const selected = selectedIds.includes(option.id);
            return <Pressable key={option.id} accessibilityRole={maximumSelections === 1 ? "radio" : "checkbox"} accessibilityLabel={option.label} accessibilityState={{ checked: selected, disabled: maximumSelections > 1 && !selected && selectedIds.length >= maximumSelections }} onPress={() => chooseOption(option.id)} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}>
              {option.icon ? <View style={styles.optionIconFrame}><Image source={option.icon} resizeMode="contain" style={styles.optionIcon} /></View> : option.emoji ? <View style={styles.optionIconFrame}><Text style={styles.optionEmoji}>{option.emoji}</Text></View> : null}
              <Text style={styles.optionLabel}>{option.label}</Text>
              {selected ? <Ionicons name="checkmark" size={18} color={T.blue} /> : null}
            </Pressable>;
          })}
        </ScrollView>
      </View>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 20), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue" accessibilityState={{ disabled: !canContinue }} disabled={!canContinue} onPress={continueOnboarding} style={({ pressed }) => [styles.continueButton, !canContinue && styles.continueButtonDisabled, pressed && canContinue && styles.continueButtonPressed]}>
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
  questionHeader: { paddingTop: 28, paddingBottom: 18, gap: 8 },
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
