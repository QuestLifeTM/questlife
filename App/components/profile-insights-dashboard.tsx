import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { categoryColor, difficultyColor, T } from "@/components/theme";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { ProfileQuestInsights } from "@/services/profile/profileService";

function AnimatedFill({ value, color, delay = 0, active = true }: { value: number; color: string; delay?: number; active?: boolean }) {
  const reduceMotion = useReducedMotionPreference();
  const progress = useSharedValue(reduceMotion || !active ? value : 0);
  useEffect(() => {
    progress.value = reduceMotion || !active ? value : 0;
    if (!active || reduceMotion) return;
    progress.value = withDelay(delay, withTiming(value, { duration: 560 }));
  }, [active, delay, progress, reduceMotion, value]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  return <Animated.View style={[{ position: "absolute", inset: 0, borderRadius: 99, backgroundColor: color, transformOrigin: "left center" }, animatedStyle]} />;
}

function AnimatedWeekBar({ value, max, delay, active = true }: { value: number; max: number; delay: number; active?: boolean }) {
  const reduceMotion = useReducedMotionPreference();
  const target = Math.max(0.07, value / max);
  const progress = useSharedValue(reduceMotion || !active ? target : 0);
  useEffect(() => {
    progress.value = reduceMotion || !active ? target : 0;
    if (!active || reduceMotion) return;
    progress.value = withDelay(delay, withTiming(target, { duration: 520 }));
  }, [active, delay, progress, reduceMotion, target]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: progress.value }] }));
  return <Animated.View style={[{ position: "absolute", inset: 0, borderRadius: 12, backgroundColor: T.blue, transformOrigin: "bottom center" }, animatedStyle]} />;
}

function InsightTile({ label, value, detail, icon, color }: { label: string; value: string; detail: string; icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return <View style={{ width: "48.5%", minHeight: 112, borderRadius: 20, borderWidth: 2, borderColor: T.border, borderBottomWidth: 4, borderBottomColor: "#dfd6cc", backgroundColor: T.white, padding: 13, justifyContent: "space-between", gap: 8 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}><View style={{ width: 29, height: 29, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: `${color}18` }}><Ionicons name={icon} size={17} color={color} /></View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ flex: 1, color: T.dark, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 27, textAlign: "right", fontVariant: ["tabular-nums"] }}>{value}</Text></View>
    <View><Text numberOfLines={1} style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 10, lineHeight: 13, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</Text><Text numberOfLines={1} style={{ color: T.dark, fontFamily: "Rubik", fontSize: 11, lineHeight: 15, fontWeight: "700", marginTop: 2 }}>{detail}</Text></View>
  </View>;
}

export function ProfileInsightsDashboard({ insights, active = true }: { insights: ProfileQuestInsights; active?: boolean }) {
  const categoryMax = useMemo(() => Math.max(1, ...insights.categoryBreakdown.map((entry) => entry.count)), [insights.categoryBreakdown]);
  const weekMax = useMemo(() => Math.max(1, ...insights.monthlyWeeks.map((entry) => entry.value)), [insights.monthlyWeeks]);
  const monthlyProgress = Math.min(1, insights.completedThisMonth / insights.monthlyGoal);

  return <View style={{ gap: 12 }}>
    <View style={{ borderRadius: 22, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#dfd6cc", backgroundColor: T.white, padding: 16, gap: 13 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}><View style={{ flex: 1, gap: 2 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 19, lineHeight: 24 }}>This month</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 17, fontWeight: "700" }}>Keep your adventure rhythm going.</Text></View><View style={{ alignItems: "flex-end" }}><Text style={{ color: T.blue, fontFamily: "RubikBlack", fontSize: 24, lineHeight: 29, fontVariant: ["tabular-nums"] }}>{insights.completedThisMonth}/{insights.monthlyGoal}</Text><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" }}>quest goal</Text></View></View>
      <View style={{ height: 10, borderRadius: 6, overflow: "hidden", backgroundColor: `${T.blue}18` }}><AnimatedFill value={monthlyProgress} color={T.blue} active={active} /></View>
    </View>

    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      <InsightTile label="Active days" value={String(insights.activeDaysThisMonth)} detail="this month" icon="calendar-outline" color={T.green} />
      <InsightTile label="Completion rate" value={insights.completionRate === null ? "—" : `${insights.completionRate}%`} detail="quests you finish" icon="checkmark-done-outline" color={T.blue} />
      <InsightTile label="Avg. quest" value={insights.averageQuestMinutes ? `${insights.averageQuestMinutes}m` : "—"} detail="your usual length" icon="time-outline" color={T.orange} />
      <InsightTile label="Quest variety" value={String(insights.questVariety)} detail="categories this month" icon="color-palette-outline" color={T.purple} />
      <InsightTile label="Best week" value={String(insights.bestWeekCompletions)} detail="quests completed" icon="trophy-outline" color={T.yellow} />
      <InsightTile label="Quest moments" value={String(insights.photosCaptured)} detail="photos captured" icon="images-outline" color={T.cyan} />
    </View>

    <View style={{ borderRadius: 22, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#dfd6cc", backgroundColor: T.white, padding: 16, gap: 14 }}>
      <View><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 19, lineHeight: 24 }}>Your adventure mix</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 17, fontWeight: "700" }}>{insights.preferredTimeLabel ?? "Complete a quest to find your rhythm."}</Text></View>
      {insights.categoryBreakdown.length ? insights.categoryBreakdown.slice(0, 5).map((entry, index) => {
        const color = categoryColor[entry.category];
        return <View key={entry.category} style={{ gap: 6 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 7, flex: 1 }}><View style={{ width: 25, height: 25, borderRadius: 9, backgroundColor: color.bg, alignItems: "center", justifyContent: "center" }}><Ionicons name="compass-outline" size={14} color={color.text} /></View><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 13, lineHeight: 17 }}>{entry.category}</Text></View><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12 }}>{entry.count}</Text></View><View style={{ height: 7, borderRadius: 4, overflow: "hidden", backgroundColor: color.bg }}><AnimatedFill value={entry.count / categoryMax} color={color.text} delay={index * 70} active={active} /></View></View>;
      }) : <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 13, lineHeight: 19, fontWeight: "700" }}>Your category mix will appear after your first completed quest.</Text>}
    </View>

    <View style={{ borderRadius: 22, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#dfd6cc", backgroundColor: T.white, padding: 16, gap: 13 }}>
      <View><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 19, lineHeight: 24 }}>Four-week rhythm</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 17, fontWeight: "700" }}>Completed quests by week.</Text></View>
      <View style={{ height: 120, flexDirection: "row", alignItems: "flex-end", gap: 10 }}>{insights.monthlyWeeks.map((week, index) => <View key={week.label} style={{ flex: 1, alignItems: "center", gap: 7 }}><View style={{ width: "100%", height: 88, justifyContent: "flex-end", overflow: "hidden", borderRadius: 12, backgroundColor: `${T.blue}12` }}><AnimatedWeekBar value={week.value} max={weekMax} delay={index * 80} active={active} /></View><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 10, lineHeight: 13 }}>{week.label}</Text></View>)}</View>
      {insights.difficultyBreakdown.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{insights.difficultyBreakdown.map((entry) => { const color = difficultyColor[entry.difficulty as keyof typeof difficultyColor]?.text ?? T.muted; return <View key={entry.difficulty} style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: `${color}14` }}><Text style={{ color, fontFamily: "RubikBold", fontSize: 10 }}>{entry.difficulty}</Text><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 10 }}>{entry.count}</Text></View>; })}</View> : null}
    </View>
  </View>;
}
