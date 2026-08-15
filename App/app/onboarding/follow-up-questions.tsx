import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { OnboardingQuestionProgress } from "@/components/onboarding-progress";
import { T } from "@/components/theme";
import { haptic, useResponsiveScreenLayout } from "@/components/ui";

type Option = { id: string; emoji?: string; icon?: ImageSourcePropType; label: string };
type Question = { id: string; title: string; titleAccent?: string; titleSuffix?: string; helper?: string; helperAccent?: string; helperSuffix?: string; maximumSelections: number; options: Option[] };

const QUESTION_OPTION_ICONS = {
  bed: require("../../assets/onboarding/question-icons/bed.png"),
  campingTent: require("../../assets/onboarding/question-icons/camping-tent.png"),
  campingTentFears: require("../../assets/onboarding/question-icons/camping-tent-fears.png"),
  clock: require("../../assets/onboarding/question-icons/clock.png"),
  confused: require("../../assets/onboarding/question-icons/confused.png"),
  friends: require("../../assets/onboarding/question-icons/friends.png"),
  forest: require("../../assets/onboarding/question-icons/forest.png"),
  lightning: require("../../assets/onboarding/question-icons/lightning.png"),
  meetingFriends: require("../../assets/onboarding/question-icons/meeting-friends.png"),
  meetingInterests: require("../../assets/onboarding/question-icons/meeting-interests.png"),
  meeting: require("../../assets/onboarding/question-icons/meeting.png"),
  phone: require("../../assets/onboarding/question-icons/phone.png"),
  paintPalette: require("../../assets/onboarding/question-icons/paint-palette.png"),
  rollerCoaster: require("../../assets/onboarding/question-icons/roller-coaster.png"),
  shocked: require("../../assets/onboarding/question-icons/shocked.png"),
  smiling: require("../../assets/onboarding/question-icons/smiling.png"),
  social: require("../../assets/onboarding/question-icons/social.png"),
  strawberryCheesecake: require("../../assets/onboarding/question-icons/strawberry-cheesecake.png"),
};

const QUESTIONS: Question[] = [
  {
    id: "life-now",
    title: "How would you describe your life right now?",
    maximumSelections: 1,
    options: [
      { id: "comfortable-repetitive", emoji: "🌱", label: "comfortable, but a little repetitive" },
      { id: "exciting-moments", icon: QUESTION_OPTION_ICONS.lightning, label: "it has its exciting moments" },
      { id: "seeking-experiences", emoji: "🕘", label: "i'm always looking for new experiences" },
      { id: "weekly-adventure", icon: QUESTION_OPTION_ICONS.campingTent, label: "every week feels like an adventure" },
    ],
  },
  {
    id: "life-obstacles",
    title: "What's the biggest thing getting in your way from ",
    titleAccent: "living the life",
    titleSuffix: " that you want?",
    helper: "Choose up to 3",
    maximumSelections: 3,
    options: [
      { id: "phone-time", icon: QUESTION_OPTION_ICONS.phone, label: "spending too much time on my phone" },
      { id: "too-busy", icon: QUESTION_OPTION_ICONS.clock, label: "being too busy or having no time" },
      { id: "no-company", icon: QUESTION_OPTION_ICONS.meetingFriends, label: "not having anyone to go with" },
      { id: "no-ideas", icon: QUESTION_OPTION_ICONS.confused, label: "never knowing what to do" },
      { id: "home-comfort", icon: QUESTION_OPTION_ICONS.bed, label: "getting too comfortable staying home" },
    ],
  },
  {
    id: "deeper-fears",
    title: "Sometimes, its ",
    titleAccent: "deeper fears",
    titleSuffix: " that hold us back. Which one gets in your way?",
    helper: "Choose any that apply",
    maximumSelections: 5,
    options: [
      { id: "fear-new", icon: QUESTION_OPTION_ICONS.shocked, label: "fear of trying something new" },
      { id: "people-think", icon: QUESTION_OPTION_ICONS.meeting, label: "worrying about what people might think" },
      { id: "social-anxiety", icon: QUESTION_OPTION_ICONS.social, label: "social anxiety or meeting new people" },
      { id: "comfort-over-adventure", icon: QUESTION_OPTION_ICONS.campingTentFears, label: "choosing comfort over adventure" },
      { id: "none", emoji: "🌱", label: "none of these feel like me" },
    ],
  },
  {
    id: "experience-interests",
    title: "What kind of experiences excite you the most?",
    helper: "to recommend adventure ",
    helperAccent: "you'll actually enjoy",
    maximumSelections: 5,
    options: [
      { id: "nature", icon: QUESTION_OPTION_ICONS.forest, label: "exploring nature" },
      { id: "food-places", icon: QUESTION_OPTION_ICONS.strawberryCheesecake, label: "trying new food & places" },
      { id: "people", icon: QUESTION_OPTION_ICONS.meetingInterests, label: "meeting new people" },
      { id: "creative", icon: QUESTION_OPTION_ICONS.paintPalette, label: "creative & unique activities" },
      { id: "adrenaline", icon: QUESTION_OPTION_ICONS.rollerCoaster, label: "adrenaline & adventure" },
    ],
  },
  {
    id: "adventure-readiness",
    title: "How ",
    titleAccent: "adventurous",
    titleSuffix: " are you feeling?",
    helper: "everyone's comfort zone is different",
    maximumSelections: 1,
    options: [
      { id: "small", icon: QUESTION_OPTION_ICONS.campingTentFears, label: "start me with small adventures" },
      { id: "mixed", icon: QUESTION_OPTION_ICONS.smiling, label: "mix easy and challenging quests" },
      { id: "deep-end", icon: QUESTION_OPTION_ICONS.rollerCoaster, label: "throw me into the deep end" },
    ],
  },
];

export default function FollowUpQuestionsOnboardingScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const { insets, horizontalPadding } = useResponsiveScreenLayout();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const question = QUESTIONS[questionIndex];
  const selectedIds = answers[question.id] ?? [];
  const canContinue = selectedIds.length > 0;

  function toggleOption(id: string) {
    haptic();
    setAnswers((current) => {
      const selections = current[question.id] ?? [];
      const selected = selections.includes(id);
      if (!selected && question.maximumSelections === 1) {
        return { ...current, [question.id]: [id] };
      }
      if (!selected && selections.length >= question.maximumSelections) return current;
      return { ...current, [question.id]: selected ? selections.filter((selectedId) => selectedId !== id) : [...selections, id] };
    });
  }

  function continueOnboarding() {
    if (!canContinue) return;
    haptic();
    if (questionIndex < QUESTIONS.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }
    router.replace({ pathname: "/onboarding/personalizing", params: firstName ? { firstName } : {} });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 6, 18), paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }]}>
        <View style={styles.progressSection}><OnboardingQuestionProgress currentStep={questionIndex + 4} /></View>
        <View style={styles.questionHeader}>
          <Text style={styles.title}>
            {question.id === "life-now" ? (
              <>How would you <Text style={styles.titleAccent}>describe</Text> your life right now?</>
            ) : question.titleAccent ? (
              <>{question.title}<Text style={styles.titleAccent}>{question.titleAccent}</Text>{question.titleSuffix}</>
            ) : question.title}
          </Text>
          {question.helper ? <Text style={styles.helper}>{question.helperAccent ? <>{question.helper}<Text style={styles.helperAccent}>{question.helperAccent}</Text>{question.helperSuffix}</> : question.helper}</Text> : null}
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
                <View style={styles.optionIconFrame}>{option.icon ? <Image source={option.icon} resizeMode="contain" style={styles.optionIcon} /> : <Text style={styles.optionEmoji}>{option.emoji}</Text>}</View>
                <Text style={styles.optionLabel}>{option.label}</Text>
                {selected ? <Ionicons name="checkmark" size={18} color={T.blue} /> : null}
              </Pressable>
            );
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
  questionHeader: { paddingTop: 28, paddingBottom: 14, gap: 4 },
  title: { maxWidth: 348, color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28, letterSpacing: -0.35 },
  titleAccent: { color: T.blue },
  helper: { color: T.muted, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18 },
  helperAccent: { color: T.blue },
  optionScroll: { flex: 1, marginHorizontal: -4, paddingHorizontal: 4 },
  optionList: { gap: 9, paddingBottom: 12 },
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
