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
    description: "Trade passive scrolling for real experiences. You'll spend less time watching life happen and more time creating stories worth remembering.",
    icon: QUESTION_OPTION_ICONS.backpack,
  },
  "more-consistent": {
    id: "more-consistent",
    label: "Become more consistent",
    description: "Small actions repeated over time create extraordinary results. You'll build momentum through simple quests that keep you moving forward.",
    icon: QUESTION_OPTION_ICONS.personalGrowth,
  },
  "comfort-zone": {
    id: "comfort-zone",
    label: "Break out of my comfort zone",
    description: "Growth rarely happens in familiar places. QuestLife helps you take small steps into experiences that build confidence and courage.",
    icon: QUESTION_OPTION_ICONS.campingTent,
  },
  "life-exciting": {
    id: "life-exciting",
    label: "Make life exciting again",
    description: "Routine can make life feel smaller than it is. You'll discover new experiences, unexpected moments, and reasons to look forward to each day.",
    icon: QUESTION_OPTION_ICONS.lightning,
  },
  "stop-procrastinating": {
    id: "stop-procrastinating",
    label: "Finally stop procrastinating",
    description: "The hardest part is usually getting started. Quests turn good intentions into action by giving you a simple next step to take today.",
    icon: QUESTION_OPTION_ICONS.hourglass,
  },
  "best-self": {
    id: "best-self",
    label: "Become my best self",
    description: "The person you want to become is built through daily choices. Every completed quest helps you grow into a stronger version of yourself.",
    emoji: "🌱",
  },
  "unforgettable-memories": {
    id: "unforgettable-memories",
    label: "Make unforgettable memories",
    description: "The moments you'll treasure most are often the ones you never planned. QuestLife helps fill your life with experiences worth looking back on.",
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
  const { insets, horizontalPadding } = useResponsiveScreenLayout();
  const selectedGoals = parseGoalIds(goalIds).map((id) => GOALS[id]);
  const destination = typeof idealLifeId === "string" ? IDEAL_LIFE_OPTIONS[idealLifeId] : undefined;

  function continueOnboarding() {
    haptic();
    router.replace({ pathname: "/(auth)/register", params: firstName ? { firstName } : {} });
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 20, 32), paddingBottom: Math.max(insets.bottom + 24, 34), paddingHorizontal: insets.left + horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cards}>
          {selectedGoals.map((goal, index) => (
            <View key={goal.id} style={[styles.goalCard, index === 0 && styles.firstGoalCard]}>
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
                <OptionIcon icon={destination.icon} />
                <Text selectable style={styles.destinationTitle}>{destination.label}</Text>
              </View>
              <Text selectable style={styles.destinationStat}>92.02% of people formed this daily habit</Text>
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
  content: { gap: 48, paddingHorizontal: 20 },
  cards: { gap: 16 },
  goalCard: { gap: 7, borderRadius: 18, borderWidth: 2.5, borderColor: T.dark, backgroundColor: T.white, padding: 16, boxShadow: `4px 4px 0px ${T.dark}` },
  firstGoalCard: { marginVertical: 2, transform: [{ rotate: "-2deg" }] },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  optionIcon: { width: 24, height: 24 },
  optionEmoji: { fontSize: 22, lineHeight: 24 },
  cardTitle: { flex: 1, color: T.dark, fontFamily: "RubikBold", fontSize: 17, lineHeight: 22, letterSpacing: -0.15 },
  cardDescription: { color: T.muted, fontFamily: "Rubik", fontSize: 13.5, lineHeight: 19 },
  destinationCard: { gap: 10, borderRadius: 18, borderWidth: 2.5, borderColor: T.dark, backgroundColor: T.white, padding: 16, boxShadow: `4px 4px 0px ${T.dark}` },
  destinationEyebrow: { color: T.muted, fontFamily: "RubikBold", fontSize: 12, lineHeight: 16, textAlign: "center" },
  destinationTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  destinationTitle: { color: T.dark, fontFamily: "RubikBold", fontSize: 17, lineHeight: 22, textAlign: "center" },
  destinationStat: { color: T.blue, fontFamily: "RubikBold", fontSize: 12.5, lineHeight: 17, textAlign: "center" },
  reassuranceCopy: { gap: 7 },
  reassuranceTitle: { color: T.white, fontFamily: "RubikBlack", fontSize: 25, lineHeight: 31, letterSpacing: -0.45 },
  reassuranceBody: { color: T.white, fontFamily: "Rubik", fontSize: 15, lineHeight: 21 },
  continueButton: { minHeight: 58, borderRadius: 20, borderWidth: 1.25, borderColor: "rgba(255,255,255,0.48)", borderBottomWidth: 6, borderBottomColor: "#258fd8", backgroundColor: T.blue, alignItems: "center", justifyContent: "center" },
  continueButtonPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 3 },
  continueText: { color: T.white, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, letterSpacing: 0.55, textTransform: "uppercase" },
});
