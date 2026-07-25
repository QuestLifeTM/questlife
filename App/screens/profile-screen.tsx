import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";

import { EmptyState, Header, Screen, Sheet, haptic, useResponsiveScreenLayout } from "@/components/ui";
import { ProfileAvatar } from "@/components/profile-avatar";
import { PartyCategoryIcon } from "@/components/party-category-icon";
import { QuestlifeFlame } from "@/components/questlife-flame";
import { categoryColor, T } from "@/components/theme";
import { QuestFeedThumbnail } from "@/components/quest-feed-card";
import { QuestPostManagementSheet } from "@/components/quest-post-management-sheet";
import { ActivityChartCard } from "@/components/activity-chart-card";
import { ProfileInsightsDashboard } from "@/components/profile-insights-dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { useSocial } from "@/contexts/SocialContext";
import { formatElapsedCompact } from "@/hooks/useElapsedTime";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { DEFAULT_PROFILE_PRIVACY, DEFAULT_PROFILE_STAT_VISIBILITY, fetchProfileOverview, fetchProfileQuestInsights, fetchWeeklyCompletedQuestActivity, ProfileQuestInsights, updateProfile, uploadProfileAvatar, WeeklyCompletedQuestActivity } from "@/services/profile/profileService";
import { fetchFollowers, removeFollower } from "@/services/social/socialService";
import { levelForXp, ProfileAudience, ProfileOverview, ProfilePrivacy, ProfileStatId, ProfileStatVisibility, QuestFeedPost } from "@/types/profile";
import { FollowerProfile } from "@/types/social";

function accountValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function fullProfileName(displayName: string, metadata: unknown) {
  const fullName = [accountValue(metadata, "first_name"), accountValue(metadata, "last_name")].filter(Boolean).join(" ");
  return displayName.trim().split(/\s+/).filter(Boolean).length >= 2 ? displayName : fullName || displayName;
}

function HeaderControl({ label, positive = false, disabled = false, onPress }: { label: string; positive?: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ minHeight: 42, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5, borderRadius: 21, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, opacity: disabled ? 0.45 : pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
    <Text style={{ color: positive ? T.green : T.dark, fontFamily: "RubikBold", fontSize: 14, lineHeight: 18 }}>{label}</Text>
    {positive ? <Ionicons name="checkmark" size={16} color={T.green} /> : null}
  </Pressable>;
}

/**
 * The profile header is an identity surface, so its utilities get a more
 * considered treatment than the app-wide icon button: a coloured inner disk,
 * an ivory outer ring, and a small offset shadow make the pair feel tangible
 * without competing with the profile itself.
 */
function ProfileHeaderIconButton({ icon, label, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    hitSlop={6}
    onPress={() => {
      haptic();
      onPress();
    }}
    style={({ pressed }) => ({
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: T.white,
      borderWidth: 1,
      borderColor: `${color}2b`,
      boxShadow: pressed ? "0px 1px 3px rgba(61,52,56,0.12)" : "0px 5px 12px rgba(61,52,56,0.13)",
      transform: [{ scale: pressed ? 0.94 : 1 }, { translateY: pressed ? 2 : 0 }],
    })}
  >
    <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: `${color}16`, borderWidth: 1, borderColor: `${color}26` }}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
  </Pressable>;
}

function ImageControl({ label, onPress, style }: { label: string; onPress: () => void; style?: object }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: T.white, borderWidth: 2, borderColor: T.border, boxShadow: `2px 2px 0px ${T.border}`, opacity: pressed ? 0.72 : 1 }, style]}><Ionicons name="image-outline" size={21} color={T.dark} /></Pressable>;
}

type ProfileTab = "posts" | "stats";

const PROFILE_STAT_PILL_WIDTH = 152;
const PROFILE_STAT_PILL_GAP = 10;
type ProfileCarouselMetric = { id: ProfileStatId; label: string; value: string; icon: keyof typeof Ionicons.glyphMap; color: string; background: string };

function profileCarouselMetrics(overview: ProfileOverview): ProfileCarouselMetric[] {
  const { profile, stats } = overview;
  const level = levelForXp(profile?.totalXp ?? 0).level;
  return [
    { id: "highestStreak", label: "Highest streak", value: `${stats.longestStreak} days`, icon: "flame", color: T.orange, background: "#fff0df" },
    { id: "level", label: "Level", value: `Level ${level}`, icon: "rocket", color: T.purple, background: "#f2eaff" },
    { id: "questsDone", label: "Quests done", value: stats.totalQuests.toLocaleString(), icon: "checkmark-circle", color: T.green, background: "#e6f8ed" },
    { id: "timeSpent", label: "Time spent", value: formatElapsedCompact((stats.totalQuestDurationSeconds ?? 0) * 1_000), icon: "time", color: T.blue, background: "#e5f3ff" },
    { id: "totalXp", label: "Total XP", value: `${(profile?.totalXp ?? 0).toLocaleString()} XP`, icon: "flash", color: "#d39a00", background: "#fff7d8" },
    { id: "followers", label: "Followers", value: (stats.followers ?? 0).toLocaleString(), icon: "people", color: T.pink, background: "#ffe8f3" },
    { id: "following", label: "Following", value: (stats.following ?? 0).toLocaleString(), icon: "person-add", color: T.cyan, background: "#e1faff" },
  ];
}

export function ProfileStatMarquee({ overview, visibility }: { overview: ProfileOverview; visibility: ProfileStatVisibility }) {
  const reduceMotion = useReducedMotionPreference();
  const translateX = useRef(new Animated.Value(0)).current;
  const metrics = profileCarouselMetrics(overview).filter((metric) => visibility[metric.id]);
  const marqueeDistance = (PROFILE_STAT_PILL_WIDTH + PROFILE_STAT_PILL_GAP) * metrics.length;

  useEffect(() => {
    translateX.stopAnimation();
    translateX.setValue(0);
    if (reduceMotion) return;
    if (!metrics.length) return;
    const animation = Animated.loop(Animated.timing(translateX, { toValue: -marqueeDistance, duration: Math.max(7_000, metrics.length * 4_800), easing: Easing.linear, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [marqueeDistance, metrics.length, reduceMotion, translateX]);

  const pill = (metric: typeof metrics[number], index: number) => <View key={`${metric.label}-${index}`} style={{ width: PROFILE_STAT_PILL_WIDTH, minHeight: 48, paddingHorizontal: 12, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: metric.background, borderWidth: 1.5, borderColor: `${metric.color}38` }}>
    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${metric.color}1c` }}><Ionicons name={metric.icon} size={16} color={metric.color} /></View>
    <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: metric.color, fontFamily: "RubikBold", fontSize: 13, lineHeight: 16 }}>{metric.value}</Text><Text numberOfLines={1} style={{ color: T.muted, marginTop: 1, fontFamily: "RubikBold", fontSize: 9, lineHeight: 12, letterSpacing: 0.45, textTransform: "uppercase" }}>{metric.label}</Text></View>
  </View>;

  if (!metrics.length) return <View style={{ minHeight: 48, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: T.white }}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12 }}>These profile stats are private.</Text></View>;
  if (reduceMotion) return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: PROFILE_STAT_PILL_GAP, paddingHorizontal: 2 }}>{metrics.map(pill)}</ScrollView>;

  return <View accessibilityLabel={`Profile stats: ${metrics.map((metric) => `${metric.label} ${metric.value}`).join(", ")}`} style={{ overflow: "hidden" }}>
    <Animated.View style={{ flexDirection: "row", gap: PROFILE_STAT_PILL_GAP, transform: [{ translateX }] }}>{[...metrics, ...metrics].map(pill)}</Animated.View>
  </View>;
}

function ProfileStatVisibilityBento({ overview, visibility, onToggle }: { overview: ProfileOverview; visibility: ProfileStatVisibility; onToggle: (id: ProfileStatId) => void }) {
  const shownCount = Object.values(visibility).filter(Boolean).length;
  return <View style={{ width: "100%", marginTop: 14, gap: 9 }}>
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}><View><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20 }}>Carousel stats</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 11, lineHeight: 15 }}>Choose what to include · keep at least 3.</Text></View><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 11 }}>{shownCount}/7 shown</Text></View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {profileCarouselMetrics(overview).map((metric) => {
        const visible = visibility[metric.id];
        const mustStayVisible = visible && shownCount <= 3;
        return <View key={metric.id} style={{ width: "48.7%", minHeight: 68, padding: 10, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: visible ? metric.background : T.white, borderWidth: 1.5, borderColor: visible ? `${metric.color}55` : T.border, opacity: visible ? 1 : 0.64 }}>
          <View style={{ width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${metric.color}1c` }}><Ionicons name={metric.icon} size={15} color={metric.color} /></View>
          <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 11, lineHeight: 14 }}>{metric.label}</Text><Text numberOfLines={1} style={{ color: metric.color, marginTop: 1, fontFamily: "RubikBold", fontSize: 12, lineHeight: 15 }}>{metric.value}</Text></View>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: visible, disabled: mustStayVisible }} accessibilityLabel={mustStayVisible ? `${metric.label} must remain visible because at least three stats are required` : `${visible ? "Hide" : "Show"} ${metric.label} from friends`} disabled={mustStayVisible} onPress={() => onToggle(metric.id)} hitSlop={6} style={({ pressed }) => ({ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: visible ? metric.color : T.bg, borderWidth: 1.5, borderColor: visible ? metric.color : T.border, opacity: mustStayVisible ? 0.5 : pressed ? 0.7 : 1 })}><Ionicons name={visible ? "eye" : "eye-off"} size={15} color={visible ? T.white : T.muted} /></Pressable>
        </View>;
      })}
    </View>
  </View>;
}

const audienceLabels: Record<ProfileAudience, string> = { public: "Everyone", followers: "Followers", private: "Only me" };

function ProfilePrivacyControls({ privacy, hasBio, onChange }: { privacy: ProfilePrivacy; hasBio: boolean; onChange: (next: ProfilePrivacy) => void }) {
  const rows: Array<{ key: keyof ProfilePrivacy; label: string; detail: string; options: ProfileAudience[] }> = [
    { key: "stats", label: "Stats carousel", detail: "Who can see your selected stats", options: ["public", "followers", "private"] },
    { key: "bio", label: "Bio", detail: hasBio ? "Who can read your bio" : "Add a bio to share it", options: ["public", "followers"] },
    { key: "posts", label: "Posts", detail: "Who can view your quest posts", options: ["public", "followers", "private"] },
  ];
  return <View style={{ width: "100%", marginTop: 16, gap: 9 }}>
    <View><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20 }}>Profile visibility</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 11, lineHeight: 15 }}>Your name and @username are always visible.</Text></View>
    {rows.map((row) => <View key={row.key} style={{ minHeight: 80, padding: 11, borderRadius: 18, gap: 8, backgroundColor: T.white, borderWidth: 1.5, borderColor: T.border }}><View><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 12, lineHeight: 16 }}>{row.label}</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 10, lineHeight: 14 }}>{row.detail}</Text></View><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{row.options.map((option) => { const active = privacy[row.key] === option; return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => onChange({ ...privacy, [row.key]: option } as ProfilePrivacy)} style={({ pressed }) => ({ minHeight: 30, paddingHorizontal: 9, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: active ? T.blue : T.bg, borderWidth: 1.5, borderColor: active ? T.blue : T.border, opacity: pressed ? 0.72 : 1 })}><Text style={{ color: active ? T.white : T.muted, fontFamily: "RubikBold", fontSize: 10 }}>{audienceLabels[option]}</Text></Pressable>; })}</View></View>)}
  </View>;
}

function FollowerManagerSheet({ visible, onClose, onChanged }: { visible: boolean; onClose: () => void; onChanged: () => void }) {
  const [followers, setFollowers] = useState<FollowerProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  useEffect(() => { if (!visible) return; setLoading(true); fetchFollowers().then(setFollowers).catch(() => setFollowers([])).finally(() => setLoading(false)); }, [visible]);
  async function remove(person: FollowerProfile) { if (removingId) return; setRemovingId(person.userId); try { await removeFollower(person.userId); setFollowers((current) => current.filter((item) => item.userId !== person.userId)); onChanged(); } finally { setRemovingId(null); } }
  return <Sheet visible={visible} onClose={onClose} maxHeight="78%"><View style={{ paddingHorizontal: 22, paddingBottom: 18, gap: 13 }}><View><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 22 }}>Followers</Text><Text style={{ color: T.muted, marginTop: 3, fontFamily: "Rubik", fontSize: 12 }}>Remove anyone you no longer want following you.</Text></View>{loading ? <EmptyState emoji="⏳" title="Loading followers" body="" /> : !followers.length ? <EmptyState emoji="👋" title="No followers yet" body="When someone follows you, they’ll appear here." /> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>{followers.map((person) => <View key={person.userId} style={{ minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10 }}><ProfileAvatar uri={person.avatarUrl} color={person.avatarColor} size={42} label={`${person.displayName}'s profile photo`} /><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 13 }}>{person.displayName}</Text><Text numberOfLines={1} style={{ color: T.muted, marginTop: 2, fontFamily: "Rubik", fontSize: 11 }}>{person.username ? `@${person.username}` : "QuestLife adventurer"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${person.displayName} as a follower`} onPress={() => void remove(person)} style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 10, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: `${T.red}66`, backgroundColor: `${T.red}0c`, opacity: removingId === person.userId ? 0.45 : pressed ? 0.68 : 1 })}><Text style={{ color: T.red, fontFamily: "RubikBold", fontSize: 11 }}>{removingId === person.userId ? "Removing…" : "Remove"}</Text></Pressable></View>)}</ScrollView>}</View></Sheet>;
}

/** Starts chart motion only when the section actually enters the viewport. */
function ScrollTriggered({ scrollY, children }: { scrollY: number; children: (active: boolean) => ReactNode }) {
  const { height } = useWindowDimensions();
  const ref = useRef<View>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (active) return;
    const frame = requestAnimationFrame(() => ref.current?.measureInWindow((_, y, __, sectionHeight) => {
      if (y < height - 64 && y + sectionHeight > 0) setActive(true);
    }));
    return () => cancelAnimationFrame(frame);
  }, [active, height, scrollY]);
  return <View ref={ref} onLayout={() => {}}>{children(active)}</View>;
}

const trailRankColors = ["#D89A19", "#8996A3", "#B9754E"];

function categoryLabel(category: string) {
  return category.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function ProfileTabButton({ tab, activeTab, onPress }: { tab: ProfileTab; activeTab: ProfileTab; onPress: () => void }) {
  const active = tab === activeTab;
  const label = tab === "posts" ? "Posts" : "Stats";
  const icon = tab === "posts" ? "grid-outline" : "stats-chart-outline";
  return <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", borderBottomWidth: active ? 3 : 0, borderBottomColor: active ? T.dark : "transparent", opacity: pressed ? 0.62 : 1 })}><Ionicons name={icon} size={25} color={active ? T.dark : T.muted} /></Pressable>;
}

function QuestTrail({ categories }: { categories: ProfileOverview["stats"]["topCategories"] }) {
  const topCategories = categories.slice(0, 3);
  const leadingCount = topCategories[0]?.completedQuests ?? 0;

  return <View style={{ borderRadius: 20, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#dfd6cc", backgroundColor: T.white, padding: 16, gap: 14 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${T.purple}16` }}><Ionicons name="trail-sign" size={22} color={T.purple} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 19, lineHeight: 24 }}>Your Quest Trail</Text>
        <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 17, fontWeight: "700" }}>The adventures you return to most</Text>
      </View>
    </View>
    {topCategories.length ? <View>{topCategories.map((entry, index) => {
      const category = categoryColor[entry.category];
      const rankColor = trailRankColors[index];
      const progress = leadingCount ? Math.max(8, Math.round((entry.completedQuests / leadingCount) * 100)) : 0;
      return <View key={entry.category} accessibilityLabel={`Rank ${index + 1}: ${categoryLabel(entry.category)}, ${entry.completedQuests} completed quests`} style={{ paddingVertical: 11, gap: 8, borderTopWidth: index ? 1 : 0, borderTopColor: T.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${rankColor}22` }}><Text style={{ color: rankColor, fontFamily: "RubikBlack", fontSize: 12, lineHeight: 15 }}>{index + 1}</Text></View>
          <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: category.bg }}><PartyCategoryIcon category={entry.category} size={19} color={category.text} /></View>
          <Text style={{ flex: 1, minWidth: 0, color: T.dark, fontFamily: "RubikBold", fontSize: 14, lineHeight: 19 }} numberOfLines={1}>{categoryLabel(entry.category)}</Text>
          <Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] }}>{entry.completedQuests} {entry.completedQuests === 1 ? "quest" : "quests"}</Text>
        </View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: leadingCount, now: entry.completedQuests, text: `${entry.completedQuests} completed quests` }} style={{ height: 7, marginLeft: 34, borderRadius: 4, overflow: "hidden", backgroundColor: category.bg }}><View style={{ width: `${progress}%`, height: "100%", borderRadius: 4, backgroundColor: category.text }} /></View>
      </View>;
    })}</View> : <View style={{ paddingVertical: 6, gap: 3 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 14, lineHeight: 19 }}>Your trail starts with one quest.</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 17, fontWeight: "700" }}>Complete adventures to reveal the categories you love most.</Text></View>}
  </View>;
}

function ProfileStats({ overview, weeklyActivity, insights, scrollY }: { overview: ProfileOverview; weeklyActivity: WeeklyCompletedQuestActivity[]; insights: ProfileQuestInsights | null; scrollY: number }) {
  const { profile, stats } = overview;
  const { level, intoLevel, toNext, progress } = levelForXp(profile?.totalXp ?? 0);
  const nextLevel = level + 1;
  const xpRemaining = Math.max(0, toNext - intoLevel);
  const timeSpent = formatElapsedCompact((stats.totalQuestDurationSeconds ?? 0) * 1_000);
  const weeklyTotal = weeklyActivity.reduce((total, point) => total + point.value, 0);
  const overviewMetrics = [
    { label: "Longest streak", value: `${stats.longestStreak}d`, icon: <QuestlifeFlame size={25} />, accent: T.orange },
    { label: "Quests done", value: stats.totalQuests.toLocaleString(), icon: <Ionicons name="checkmark-circle" size={24} color={T.green} />, accent: T.green },
    { label: "Time spent", value: timeSpent, icon: <Ionicons name="time" size={25} color={T.blue} />, accent: T.blue },
    { label: "Total XP earned", value: (profile?.totalXp ?? 0).toLocaleString(), icon: <Ionicons name="flash" size={25} color={T.yellow} />, accent: T.yellow },
  ];

  return <View style={{ gap: 12 }}>
    <View style={{ borderRadius: 22, borderWidth: 2, borderColor: T.border, borderBottomWidth: 6, borderBottomColor: "#dfd6cc", backgroundColor: T.white, padding: 16, gap: 13 }}>
      <View style={{ gap: 1 }}>
        <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28 }}>Level {level}</Text>
        <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 17, fontWeight: "700" }}>{xpRemaining.toLocaleString()} XP to level {nextLevel}</Text>
      </View>
      <View style={{ gap: 7 }}>
        <View style={{ height: 11, borderRadius: 6, overflow: "hidden", backgroundColor: `${T.blue}1f` }}><View style={{ width: `${Math.max(3, Math.round(progress * 100))}%`, height: "100%", borderRadius: 6, backgroundColor: T.blue }} /></View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 12, lineHeight: 16 }}>{intoLevel.toLocaleString()} / {toNext.toLocaleString()} XP</Text><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 11, lineHeight: 15 }}>Level {nextLevel}</Text></View>
      </View>
    </View>
    <ScrollTriggered scrollY={scrollY}>{(active) => <ActivityChartCard totalValue={String(weeklyTotal)} data={weeklyActivity} active={active} />}</ScrollTriggered>
    <View style={{ gap: 10 }}>
      <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 19, lineHeight: 24 }}>Overview</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {overviewMetrics.map((metric) => <View key={metric.label} style={{ width: "48.5%", minHeight: 104, borderRadius: 20, borderWidth: 2, borderColor: T.border, borderBottomWidth: 4, borderBottomColor: "#dfd6cc", backgroundColor: T.white, paddingHorizontal: 10, paddingVertical: 14, alignItems: "center", justifyContent: "center", gap: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 29 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${metric.accent}18` }}>{metric.icon}</View>
            <Text adjustsFontSizeToFit minimumFontScale={0.74} numberOfLines={1} style={{ flexShrink: 1, color: T.dark, fontFamily: "RubikBold", fontSize: 23, lineHeight: 28, fontVariant: ["tabular-nums"] }}>{metric.value}</Text>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ width: "100%", color: T.muted, fontFamily: "RubikBold", fontSize: 11, lineHeight: 15, letterSpacing: 0.3, textTransform: "uppercase", textAlign: "center" }}>{metric.label}</Text>
        </View>)}
      </View>
    </View>
    <QuestTrail categories={stats.topCategories ?? []} />
    {insights ? <ScrollTriggered scrollY={scrollY}>{(active) => <ProfileInsightsDashboard insights={insights} active={active} />}</ScrollTriggered> : null}
  </View>;
}

export function ProfileScreen() {
  const router = useRouter();
  const { user, refreshProfileName } = useAuth();
  const { showFeedback } = useAppFeedback();
  const { refresh: refreshSocial } = useSocial();
  const { contentWidth, horizontalPadding, insets, safeAreaOffset } = useResponsiveScreenLayout();
  const [overview, setOverview] = useState<ProfileOverview | null>(null);
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyCompletedQuestActivity[]>([]);
  const [insights, setInsights] = useState<ProfileQuestInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftAvatarUri, setDraftAvatarUri] = useState<string | null>(null);
  const [draftStatVisibility, setDraftStatVisibility] = useState<ProfileStatVisibility>(DEFAULT_PROFILE_STAT_VISIBILITY);
  const [draftPrivacy, setDraftPrivacy] = useState<ProfilePrivacy>(DEFAULT_PROFILE_PRIVACY);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [readOnlyContentTop, setReadOnlyContentTop] = useState<number | null>(null);
  const [managedPost, setManagedPost] = useState<QuestFeedPost | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [profileScrollY, setProfileScrollY] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const next = await fetchProfileOverview();
      setOverview(next.profile ? next : null);
      // Stats queries are intentionally deferred until the Stats tab is
      // opened, keeping the default Profile view responsive.
      setWeeklyActivity([]);
      setInsights(null);
      if (next.profile) {
        setDraftName(fullProfileName(next.profile.displayName, user?.user_metadata));
        setDraftBio(next.profile.bio ?? "");
        setDraftAvatarUri(next.profile.avatarUrl);
        setDraftStatVisibility({ ...DEFAULT_PROFILE_STAT_VISIBILITY, ...next.profile.statVisibility });
        setDraftPrivacy({ ...DEFAULT_PROFILE_PRIVACY, ...next.profile.privacy });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [user?.id]);

  useEffect(() => {
    if (activeTab !== "stats" || !overview?.profile || insights !== null) return;
    let mounted = true;
    Promise.all([
      fetchWeeklyCompletedQuestActivity().catch(() => []),
      fetchProfileQuestInsights(overview.profile.userId).catch(() => null),
    ]).then(([activity, nextInsights]) => {
      if (!mounted) return;
      setWeeklyActivity(activity);
      setInsights(nextInsights);
    });
    return () => { mounted = false; };
  }, [activeTab, insights, overview?.profile]);

  function startEditing() {
    if (!overview?.profile) return;
    setError(null);
    setDraftName(fullProfileName(overview.profile.displayName, user?.user_metadata));
    setDraftBio(overview.profile.bio ?? "");
    setDraftAvatarUri(overview.profile.avatarUrl);
    setDraftStatVisibility({ ...DEFAULT_PROFILE_STAT_VISIBILITY, ...overview.profile.statVisibility });
    setDraftPrivacy({ ...DEFAULT_PROFILE_PRIVACY, ...overview.profile.privacy });
    setEditing(true);
  }

  function discard() {
    if (!overview?.profile) return;
    setDraftName(fullProfileName(overview.profile.displayName, user?.user_metadata));
    setDraftBio(overview.profile.bio ?? "");
    setDraftAvatarUri(overview.profile.avatarUrl);
    setDraftStatVisibility({ ...DEFAULT_PROFILE_STAT_VISIBILITY, ...overview.profile.statVisibility });
    setDraftPrivacy({ ...DEFAULT_PROFILE_PRIVACY, ...overview.profile.privacy });
    setError(null);
    setEditing(false);
  }

  async function chooseImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.86 });
    if (result.canceled || !result.assets[0]) return;
    setDraftAvatarUri(result.assets[0].uri);
  }

  async function save() {
    if (!overview?.profile || saving) return;
    const displayName = draftName.trim();
    if (!displayName) {
      setError("Add your name before saving.");
      return;
    }
    if (Object.values(draftStatVisibility).filter(Boolean).length < 3) {
      setError("Keep at least three carousel stats visible.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const avatarChanged = Boolean(draftAvatarUri && draftAvatarUri !== overview.profile.avatarUrl);
      const avatarUrl = avatarChanged ? await uploadProfileAvatar(draftAvatarUri!) : undefined;
      const metadataUsername = accountValue(user?.user_metadata, "username");
      await updateProfile({ displayName, bio: draftBio, avatarUrl, username: !overview.profile.username && metadataUsername ? metadataUsername : undefined, statVisibility: draftStatVisibility, privacy: draftPrivacy });
      refreshProfileName();
      await refreshSocial();
      setEditing(false);
      await load();
      showFeedback({
        message: avatarChanged ? "Profile picture updated." : "Profile updated.",
        icon: "person",
        color: T.blue,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "We couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !overview) return <Screen><EmptyState emoji="⏳" title="Loading profile" body="Gathering your QuestLife identity…" /></Screen>;
  if (!overview?.profile) return <Screen><EmptyState emoji="!" title="Profile unavailable" body="Sign in to view your profile." /></Screen>;

  const { profile } = overview;
  const avatarUri = editing ? draftAvatarUri : profile.avatarUrl;
  const displayName = fullProfileName(profile.displayName, user?.user_metadata);
  const username = accountValue(user?.user_metadata, "username") || profile.username || "adventurer";
  const carouselVisibility = editing ? draftStatVisibility : { ...DEFAULT_PROFILE_STAT_VISIBILITY, ...profile.statVisibility };
  const postTileSize = (contentWidth - horizontalPadding * 2 - 12) / 3;
  const profilePosts: QuestFeedPost[] = overview.posts.map((post) => ({
    ...post,
    durationSeconds: post.durationSeconds ?? null,
    userId: profile.userId,
    username,
    displayName,
    emoji: profile.emoji,
    avatarColor: profile.avatarColor,
    avatarUrl: profile.avatarUrl,
    commentCount: 0,
  }));

  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <ScrollView contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={(event) => setProfileScrollY(event.nativeEvent.contentOffset.y)} contentContainerStyle={{ alignItems: "center", paddingBottom: insets.bottom + (editing ? 178 : 112) }}>
      <View style={{ width: contentWidth, transform: [{ translateX: safeAreaOffset }] }}>
      <View style={{ backgroundColor: T.bg }}>
        <View style={{ paddingHorizontal: horizontalPadding, paddingTop: Math.max(insets.top - 12, 12) }}>
          <Header
            animated={false}
            title="Profile"
            right={editing ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><HeaderControl label="Discard" onPress={discard} /><HeaderControl label={saving ? "Saving…" : "Save"} positive disabled={saving} onPress={() => void save()} /></View> : <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><ProfileHeaderIconButton icon="create" label="Edit profile" color={T.blue} onPress={startEditing} /><ProfileHeaderIconButton icon="settings" label="Open settings" color={T.dark} onPress={() => router.push("/settings")} /></View>}
          />

          <View style={{ alignItems: "center", paddingTop: editing ? 4 : 2 }}>
            <View style={{ marginTop: editing ? 7 : 0, position: "relative" }}>
              <ProfileAvatar uri={avatarUri} size={98} label={`${displayName}'s profile photo`} />
              {editing ? <ImageControl label="Change profile picture" onPress={() => void chooseImage()} style={{ width: 34, height: 34, borderRadius: 11, position: "absolute", right: -10, bottom: -7, zIndex: 3, elevation: 3 }} /> : null}
            </View>

            {editing ? <View style={{ width: "100%", maxWidth: 276, minHeight: 40, marginTop: 9, justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: T.dark, backgroundColor: "rgba(255,255,255,0.88)", paddingHorizontal: 12 }}><TextInput value={draftName} onChangeText={setDraftName} accessibilityLabel="Name" autoCapitalize="words" placeholder="Your name" placeholderTextColor={T.muted} style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, textAlign: "center", paddingVertical: 6 }} /></View> : <Text style={{ marginTop: 9, color: T.dark, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, textAlign: "center" }}>{displayName}</Text>}
            <Text style={{ marginTop: editing ? 9 : 4, color: T.dark, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, textAlign: "center" }}>@{username}</Text>

            {editing ? <View style={{ width: "100%", maxWidth: 276, minHeight: 52, marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: T.dark, backgroundColor: "rgba(255,255,255,0.88)", paddingHorizontal: 12, paddingVertical: 6 }}><TextInput value={draftBio} onChangeText={setDraftBio} accessibilityLabel="Bio" placeholder="Write a bio…" placeholderTextColor={T.muted} multiline maxLength={180} textAlignVertical="top" style={{ minHeight: 32, color: T.dark, fontFamily: "Rubik", fontSize: 15, lineHeight: 20 }} /></View> : <Text style={{ maxWidth: 286, marginTop: 8, color: profile.bio ? T.dark : T.muted, fontFamily: "Rubik", fontSize: 15, lineHeight: 20, textAlign: "center" }}>{profile.bio || "Tap the pencil icon to add a bio."}</Text>}
            <View style={{ width: contentWidth, alignSelf: "stretch", marginHorizontal: -horizontalPadding, marginTop: 15 }}><ProfileStatMarquee overview={overview} visibility={carouselVisibility} /></View>
            {editing ? <><ProfileStatVisibilityBento overview={overview} visibility={draftStatVisibility} onToggle={(id) => setDraftStatVisibility((current) => ({ ...current, [id]: !current[id] }))} /><ProfilePrivacyControls privacy={draftPrivacy} hasBio={Boolean(draftBio.trim())} onChange={setDraftPrivacy} /></> : <Pressable accessibilityRole="button" accessibilityLabel="Manage followers" onPress={() => setFollowersOpen(true)} style={({ pressed }) => ({ minHeight: 34, marginTop: 12, paddingHorizontal: 11, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: `${T.pink}12`, borderWidth: 1, borderColor: `${T.pink}42`, opacity: pressed ? 0.7 : 1 })}><Ionicons name="people" size={14} color={T.pink} /><Text style={{ color: T.pink, fontFamily: "RubikBold", fontSize: 11 }}>{overview.stats.followers.toLocaleString()} follower{overview.stats.followers === 1 ? "" : "s"}</Text></Pressable>}
            {error ? <Text accessibilityRole="alert" style={{ marginTop: 7, color: T.red, fontFamily: "RubikBold", fontSize: 12, textAlign: "center" }}>{error}</Text> : null}
          </View>

          <View onLayout={({ nativeEvent }) => setReadOnlyContentTop(nativeEvent.layout.y)} />
        </View>
      </View>
      <View
        importantForAccessibility={editing ? "no-hide-descendants" : "auto"}
        pointerEvents={editing ? "none" : "auto"}
        style={{ width: "100%" }}
      >
      <View style={{ paddingHorizontal: horizontalPadding, paddingTop: 20 }}>
        <View accessibilityRole="tablist" style={{ height: 54, flexDirection: "row" }}>
          <ProfileTabButton tab="posts" activeTab={activeTab} onPress={() => setActiveTab("posts")} />
          <ProfileTabButton tab="stats" activeTab={activeTab} onPress={() => setActiveTab("stats")} />
        </View>
        <View style={{ marginTop: 16 }}>
          {activeTab === "posts" ? (profilePosts.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 6, rowGap: 6 }}>{profilePosts.map((post) => <QuestFeedThumbnail key={post.id} post={post} size={postTileSize} onManage={() => setManagedPost(post)} />)}</View> : <EmptyState emoji="📷" title="No posts yet" body="Complete a quest and share the first story here." />) : <ProfileStats overview={overview} weeklyActivity={weeklyActivity} insights={insights} scrollY={profileScrollY} />}
        </View>
      </View>
      </View>
    </View>
    </ScrollView>

    {editing ? <View style={{ position: "absolute", right: 0, bottom: 0, left: 0, zIndex: 20, elevation: 20, flexDirection: "row", gap: 10, paddingHorizontal: horizontalPadding, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 14), backgroundColor: "rgba(255,252,245,0.97)", borderTopWidth: 1, borderTopColor: T.border }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Discard profile changes" onPress={discard} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: T.border, backgroundColor: T.white, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 14 }}>Discard</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Save profile changes" disabled={saving} onPress={() => void save()} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: T.blue, borderBottomWidth: 4, borderBottomColor: "#258fd8", opacity: saving ? 0.55 : pressed ? 0.72 : 1 })}><Text style={{ color: T.white, fontFamily: "RubikBold", fontSize: 14 }}>{saving ? "Saving…" : "Save"}</Text></Pressable>
    </View> : null}

    {editing && readOnlyContentTop !== null ? <View pointerEvents="none" style={{ position: "absolute", top: readOnlyContentTop, right: 0, bottom: 0, left: 0, overflow: "hidden" }}>
      <BlurView tint="light" intensity={16} style={{ position: "absolute", inset: 0 }} />
      <View style={{ flex: 1, backgroundColor: "rgba(255,252,245,0.48)" }} />
    </View> : null}

    <QuestPostManagementSheet post={managedPost} visible={Boolean(managedPost)} onClose={() => setManagedPost(null)} onUpdated={() => { setManagedPost(null); void load(); }} onDeleted={() => { setManagedPost(null); void load(); }} />
    <FollowerManagerSheet visible={followersOpen} onClose={() => setFollowersOpen(false)} onChanged={() => void load()} />

  </View>;
}
