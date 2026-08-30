import { router, useLocalSearchParams } from "expo-router";
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { T } from "@/components/theme";
import { haptic, useResponsiveScreenLayout } from "@/components/ui";

type Goal = {
  id: string;
  label: string;
  description: string;
  icon?: ImageSourcePropType;
  emoji?: string;
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

const GOALS: Record<string, Goal> = {
  "explore-less-scroll": {
    id: "explore-less-scroll",
    label: "Explore more, scroll less",
    description: "Trade passive scrolling for real experiences, real connection, and stories you’ll actually remember.",
    icon: QUESTION_OPTION_ICONS.backpack,
  },
  "more-consistent": {
    id: "more-consistent",
    label: "Become more consistent",
    description: "Small adventures, repeated over time, build momentum, helping you become someone who chooses to live intentionally instead of waiting.",
    icon: QUESTION_OPTION_ICONS.personalGrowth,
  },
  "comfort-zone": {
    id: "comfort-zone",
    label: "Break out of my comfort zone",
    description: "Every step beyond what feels familiar builds confidence, making new experiences feel easier, more exciting, and more possible.",
    icon: QUESTION_OPTION_ICONS.campingTent,
  },
  "life-exciting": {
    id: "life-exciting",
    label: "Make life exciting again",
    description: "Give yourself something to look forward to, turning ordinary days into surprising moments, stories, and memories worth keeping.",
    icon: QUESTION_OPTION_ICONS.lightning,
  },
  "stop-procrastinating": {
    id: "stop-procrastinating",
    label: "Finally stop procrastinating",
    description: "Stop waiting for the perfect moment. One small decision today can break the cycle and start something unexpected.",
    icon: QUESTION_OPTION_ICONS.hourglass,
  },
  "best-self": {
    id: "best-self",
    label: "Become my best self",
    description: "Discover what you’re capable of by choosing experiences that challenge you, surprise you, and reveal strengths you never noticed.",
    emoji: "🌱",
  },
  "unforgettable-memories": {
    id: "unforgettable-memories",
    label: "Make unforgettable memories",
    description: "The moments you remember most are lived with people, in places, doing things you’ll still smile about years later.",
    icon: QUESTION_OPTION_ICONS.heartWithPulse,
  },
};

const IDEAL_LIFE_OPTIONS: Record<string, Pick<Goal, "label" | "icon">> = {
  purpose: { label: "Living each day with purpose", icon: QUESTION_OPTION_ICONS.goal },
  "amazing-people": { label: "Surrounding myself with amazing people", icon: QUESTION_OPTION_ICONS.friends },
  "no-regrets": { label: "Looking back with no regrets", icon: QUESTION_OPTION_ICONS.happy },
  "proud-self": { label: "Becoming someone I'm proud to be", icon: QUESTION_OPTION_ICONS.fortuneCookie },
};

function OptionIcon({ icon, emoji }: Pick<Goal, "icon" | "emoji">) {
  if (icon) return <Image source={icon} resizeMode="contain" style={styles.optionIcon} />;
  return emoji ? <Text style={styles.optionEmoji}>{emoji}</Text> : null;
}

function parseGoalIds(value: string | string[] | undefined) {
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && Boolean(GOALS[id])) : [];
  } catch {
    return [];
  }
}

export default function ReassuranceOnboardingScreen() {
  const { firstName, goalIds, idealLifeId } = useLocalSearchParams<{ firstName?: string; goalIds?: string | string[]; idealLifeId?: string }>();
  const { insets } = useResponsiveScreenLayout();
  const selectedGoals = parseGoalIds(goalIds).map((id) => GOALS[id]);
  const destination = typeof idealLifeId === "string" ? IDEAL_LIFE_OPTIONS[idealLifeId] : undefined;

  function continueOnboarding() {
    haptic();
    router.replace({
      pathname: "/onboarding/frequency",
      params: {
        ...(firstName ? { firstName } : {}),
        ...(typeof goalIds === "string" ? { goalIds } : {}),
        ...(typeof idealLifeId === "string" ? { idealLifeId } : {}),
      },
    });
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 20), paddingBottom: Math.max(insets.bottom + 20, 30), paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cards}>
          {selectedGoals.map((goal, index) => (
            <View key={goal.id} style={[styles.goalCard, index === 0 && styles.firstGoalCard, index === 1 && styles.secondGoalCard, index === 2 && styles.thirdGoalCard]}>
              <View style={styles.cardTitleRow}>
                <OptionIcon icon={goal.icon} emoji={goal.emoji} />
                <Text selectable style={styles.cardTitle}>{goal.label}</Text>
              </View>
              <Text selectable style={styles.cardDescription}>{goal.description}</Text>
            </View>
          ))}

          {destination ? (
            <View style={styles.destinationCard}>
              <Text selectable style={styles.destinationEyebrow}>This is where you'll be headed</Text>
              <View style={styles.destinationTitleRow}>
                <View style={styles.destinationIcon}><OptionIcon icon={destination.icon} /></View>
                <Text selectable style={styles.destinationTitle}>{destination.label}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.reassuranceCopy}>
          <Text selectable style={styles.reassuranceTitle}>You're in the right place</Text>
          <Text selectable style={styles.reassuranceBody}>Tens of thousands have started with the same goals, and QuestLife helped them get there.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue" onPress={continueOnboarding} style={({ pressed }) => [styles.continueButton, pressed && styles.continueButtonPressed]}>
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.blue },
  content: { paddingHorizontal: 12 },
  cards: { gap: 23, marginBottom: 26 },
  goalCard: { gap: 6, borderRadius: 16, borderWidth: 2, borderColor: T.dark, backgroundColor: T.white, padding: 14, boxShadow: `3px 3px 0px ${T.dark}` },
  firstGoalCard: { marginVertical: 2, transform: [{ rotate: "-2deg" }] },
  secondGoalCard: { marginVertical: 2, transform: [{ rotate: "0.9deg" }] },
  thirdGoalCard: { marginVertical: 2, transform: [{ rotate: "-2deg" }] },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  optionIcon: { width: 24, height: 24 },
  optionEmoji: { fontSize: 22, lineHeight: 24 },
  cardTitle: { flex: 1, color: T.dark, fontFamily: "RubikBold", fontSize: 17, lineHeight: 22, letterSpacing: -0.15 },
  cardDescription: { color: T.muted, fontFamily: "Rubik", fontSize: 13.5, lineHeight: 18 },
  destinationCard: { gap: 10, marginTop: 30, borderRadius: 16, borderWidth: 2, borderColor: T.dark, backgroundColor: T.white, paddingHorizontal: 14, paddingVertical: 16, boxShadow: `3px 3px 0px ${T.dark}` },
  destinationEyebrow: { color: T.muted, fontFamily: "RubikBold", fontSize: 14, lineHeight: 19, textAlign: "center" },
  destinationTitleRow: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  destinationIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  destinationTitle: { color: T.dark, fontFamily: "RubikBold", fontSize: 17, lineHeight: 22, textAlign: "center" },
  reassuranceCopy: { gap: 5, marginBottom: 22 },
  reassuranceTitle: { color: T.white, fontFamily: "RubikBlack", fontSize: 26, lineHeight: 31, letterSpacing: -0.45 },
  reassuranceBody: { color: T.white, fontFamily: "Rubik", fontSize: 16.5, lineHeight: 22 },
  continueButton: { minHeight: 58, borderRadius: 20, borderWidth: 2, borderColor: T.blue, borderBottomWidth: 4, borderBottomColor: `${T.blue}88`, backgroundColor: T.white, alignItems: "center", justifyContent: "center" },
  continueButtonPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  continueText: { color: T.blue, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, letterSpacing: 0.55, textTransform: "uppercase" },
});
