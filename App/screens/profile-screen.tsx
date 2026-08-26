import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";

import { EmptyState, Header, Screen, Sheet, SoftButton, haptic, useResponsiveScreenLayout } from "@/components/ui";
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

function saveErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "We couldn't save your profile. Please try again.";
}

function HeaderControl({ label, positive = false, disabled = false, onPress }: { label: string; positive?: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ minHeight: 42, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5, borderRadius: 21, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, opacity: disabled ? 0.45 : pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
    <Text style={{ color: positive ? T.green : T.dark, fontFamily: "RubikBold", fontSize: 14, lineHeight: 18 }}>{label}</Text>
    {positive ? <Ionicons name="checkmark" size={16} color={T.green} /> : null}
  </Pressable>;
}

/** Compact category-pill treatment for profile utilities. */
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
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: T.white,
      borderWidth: 2,
      borderColor: color,
      borderBottomWidth: pressed ? 2 : 4,
      borderBottomColor: `${color}88`,
      transform: [{ scale: pressed ? 0.96 : 1 }, { translateY: pressed ? 2 : 0 }],
    })}
  >
    <View style={{ width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: `${color}16` }}>
      <Ionicons name={icon} size={17} color={color} />
    </View>
  </Pressable>;
}

function ImageControl({ label, onPress, style }: { label: string; onPress: () => void; style?: object }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: T.white, borderWidth: 2, borderColor: T.border, boxShadow: `2px 2px 0px ${T.border}`, opacity: pressed ? 0.72 : 1 }, style]}><Ionicons name="image-outline" size={21} color={T.dark} /></Pressable>;
}

type ProfileTab = "posts" | "stats";

function ProfileSkeletonBlock({ width, height, radius = 10 }: { width: number | `${number}%`; height: number; radius?: number }) {
  return <View style={{ width, height, borderRadius: radius, backgroundColor: T.border }} />;
}

/** Keeps the profile layout calm and stable while identity data is loading. */
export function ProfileLoadingSkeleton({ includeHeader = true }: { includeHeader?: boolean }) {
  return <View accessibilityRole="progressbar" accessibilityLabel="Loading profile" style={{ width: "100%", alignItems: "center", gap: 18 }}>
    {includeHeader ? <View style={{ width: "100%", minHeight: 70, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><ProfileSkeletonBlock width={96} height={30} radius={9} /><View style={{ flexDirection: "row", gap: 9 }}><ProfileSkeletonBlock width={44} height={44} radius={22} /><ProfileSkeletonBlock width={44} height={44} radius={22} /></View></View> : null}
    <View style={{ alignItems: "center", gap: 9 }}><ProfileSkeletonBlock width={98} height={98} radius={49} /><ProfileSkeletonBlock width={148} height={22} radius={7} /><ProfileSkeletonBlock width={92} height={14} radius={6} /><ProfileSkeletonBlock width={216} height={14} radius={6} /></View>
    <View style={{ width: "100%", gap: 10 }}><View style={{ flexDirection: "row", gap: 10 }}><ProfileSkeletonBlock width={152} height={48} radius={24} /><ProfileSkeletonBlock width={152} height={48} radius={24} /></View><ProfileSkeletonBlock width={138} height={42} radius={21} /></View>
    <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-around", paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: T.border }}><ProfileSkeletonBlock width={34} height={26} radius={7} /><ProfileSkeletonBlock width={34} height={26} radius={7} /></View>
    <View style={{ width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 10 }}><ProfileSkeletonBlock width="48.5%" height={106} radius={20} /><ProfileSkeletonBlock width="48.5%" height={106} radius={20} /></View>
  </View>;
}

export function ProfileTitleBadge({ title }: { title: string | null | undefined }) {
  const value = title?.trim();
  if (!value) return null;
  return <View style={{ maxWidth: 236, minHeight: 28, marginTop: 7, paddingHorizontal: 10, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${T.yellow}36`, borderWidth: 1.5, borderColor: `${T.yellow}a8` }}><Ionicons name="flash" size={13} color="#b57d00" /><Text numberOfLines={1} style={{ flexShrink: 1, color: T.dark, fontFamily: "RubikBold", fontSize: 11, lineHeight: 14 }}>{value}</Text></View>;
}

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
  const metrics = profileCarouselMetrics(overview).filter((metric) => visibility[metric.id]);
  const marqueeDistance = (PROFILE_STAT_PILL_WIDTH + PROFILE_STAT_PILL_GAP) * metrics.length;
  const translateX = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const dragStartRef = useRef(0);
  const dragOriginRef = useRef(0);
  const pausedRef = useRef(false);
  const interactionTokenRef = useRef(0);
  const animationRunningRef = useRef(false);
  const startAnimationRef = useRef<() => void>(() => {});

  const normaliseOffset = useCallback((value: number) => {
    if (!marqueeDistance) return 0;
    // Keep the content in the middle copy. This lets either direction of a
    // manual drag wrap cleanly without ever revealing an empty edge.
    const travelled = ((-value % marqueeDistance) + marqueeDistance) % marqueeDistance;
    return -marqueeDistance - travelled;
  }, [marqueeDistance]);

  const pauseAutoScroll = useCallback(() => {
    if (reduceMotion || metrics.length < 2 || !marqueeDistance) return;
    const interactionToken = interactionTokenRef.current + 1;
    interactionTokenRef.current = interactionToken;
    pausedRef.current = true;
    animationRef.current?.stop();
    animationRunningRef.current = false;
    translateX.stopAnimation((value) => {
      // A native stop callback can arrive after the user releases. Do not let
      // that stale callback interrupt the animation that has already resumed.
      if (interactionToken !== interactionTokenRef.current || !pausedRef.current) return;
      const next = normaliseOffset(value);
      dragStartRef.current = next;
      dragOriginRef.current = next;
      translateX.setValue(next);
    });
  }, [marqueeDistance, metrics.length, normaliseOffset, reduceMotion, translateX]);

  const resumeAutoScroll = useCallback(() => {
    if (reduceMotion || metrics.length < 2 || !marqueeDistance) return;
    interactionTokenRef.current += 1;
    pausedRef.current = false;
    startAnimationRef.current();
  }, [marqueeDistance, metrics.length, reduceMotion]);

  useEffect(() => {
    animationRef.current?.stop();
    animationRunningRef.current = false;
    pausedRef.current = false;
    if (reduceMotion || metrics.length < 2 || !marqueeDistance) {
      translateX.setValue(0);
      startAnimationRef.current = () => {};
      return;
    }

    let active = true;
    const fullDuration = Math.max(9_000, metrics.length * 5_000);
    translateX.setValue(-marqueeDistance);
    dragStartRef.current = -marqueeDistance;
    dragOriginRef.current = -marqueeDistance;

    const startAnimation = () => {
      if (!active || pausedRef.current || animationRunningRef.current) return;
      // dragStartRef is updated while the user is moving, so starting from it
      // avoids waiting on a native stop callback after the finger is released.
      const start = normaliseOffset(dragStartRef.current);
      const travelled = Math.abs(start + marqueeDistance);
      const remaining = Math.max(0.04, 1 - travelled / marqueeDistance);
      dragStartRef.current = start;
      dragOriginRef.current = start;
      translateX.setValue(start);
      const animation = Animated.timing(translateX, {
        toValue: -marqueeDistance * 2,
        duration: Math.max(180, Math.round(fullDuration * remaining)),
        easing: Easing.linear,
        useNativeDriver: true,
      });
      animationRef.current = animation;
      animationRunningRef.current = true;
      animation.start(({ finished }) => {
        if (animationRef.current === animation) animationRunningRef.current = false;
        if (!active || !finished || pausedRef.current) return;
        translateX.setValue(-marqueeDistance);
        dragStartRef.current = -marqueeDistance;
        dragOriginRef.current = -marqueeDistance;
        startAnimation();
      });
    };

    startAnimationRef.current = startAnimation;
    startAnimation();
    return () => {
      active = false;
      animationRef.current?.stop();
      animationRunningRef.current = false;
      startAnimationRef.current = () => {};
    };
  }, [marqueeDistance, metrics.length, normaliseOffset, reduceMotion, translateX]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: () => {
      pauseAutoScroll();
      dragOriginRef.current = dragStartRef.current;
    },
    onPanResponderMove: (_, gesture) => {
      const next = normaliseOffset(dragOriginRef.current + gesture.dx);
      dragStartRef.current = next;
      translateX.setValue(next);
    },
    onPanResponderRelease: resumeAutoScroll,
    onPanResponderTerminate: resumeAutoScroll,
    onPanResponderTerminationRequest: () => true,
  }), [normaliseOffset, pauseAutoScroll, resumeAutoScroll, translateX]);

  const pill = (metric: typeof metrics[number], index: number) => <View key={`${metric.label}-${index}`} style={{ width: PROFILE_STAT_PILL_WIDTH, minHeight: 48, paddingHorizontal: 12, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.white, borderWidth: 2, borderColor: metric.color, borderBottomWidth: 4, borderBottomColor: `${metric.color}88` }}>
    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: metric.background, borderWidth: 1, borderColor: `${metric.color}24` }}><Ionicons name={metric.icon} size={16} color={metric.color} /></View>
    <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: metric.color, fontFamily: "RubikBold", fontSize: 13, lineHeight: 16 }}>{metric.value}</Text><Text numberOfLines={1} style={{ color: T.muted, marginTop: 1, fontFamily: "RubikBold", fontSize: 9, lineHeight: 12, letterSpacing: 0.45, textTransform: "uppercase" }}>{metric.label}</Text></View>
  </View>;

  if (!metrics.length) return <View style={{ minHeight: 48, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: T.white }}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12 }}>These profile stats are private.</Text></View>;
  if (reduceMotion || metrics.length < 2) return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: PROFILE_STAT_PILL_GAP, paddingHorizontal: 2 }}>{metrics.map(pill)}</ScrollView>;

  return <View
    {...panResponder.panHandlers}
    accessible
    accessibilityRole="adjustable"
    accessibilityLabel={`Profile stats: ${metrics.map((metric) => `${metric.label} ${metric.value}`).join(", ")}. Touch and hold to pause, or swipe to browse.`}
    onTouchStart={pauseAutoScroll}
    onTouchCancel={resumeAutoScroll}
    onTouchEnd={resumeAutoScroll}
    style={{ overflow: "hidden" }}
  >
    <Animated.View style={{ flexDirection: "row", gap: PROFILE_STAT_PILL_GAP, transform: [{ translateX }] }}>
      {[...metrics, ...metrics, ...metrics].map(pill)}
    </Animated.View>
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
  return <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", borderBottomWidth: active ? 3 : 0, borderBottomColor: active ? T.blue : "transparent", opacity: pressed ? 0.62 : 1 })}><Ionicons name={icon} size={25} color={T.blue} /></Pressable>;
}

function ProfileFollowersButton({ count, onPress }: { count: number; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Manage followers" onPress={onPress} style={({ pressed }) => ({ minHeight: 42, marginTop: 14, paddingHorizontal: 14, borderRadius: 21, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: T.white, borderWidth: 2, borderColor: `${T.pink}55`, borderBottomWidth: pressed ? 2 : 4, borderBottomColor: `${T.pink}92`, opacity: pressed ? 0.78 : 1, transform: [{ translateY: pressed ? 2 : 0 }] })}><Ionicons name="people" size={16} color={T.pink} /><Text style={{ color: T.pink, fontFamily: "RubikBold", fontSize: 12, lineHeight: 16 }}>{count.toLocaleString()} follower{count === 1 ? "" : "s"}</Text><Ionicons name="chevron-forward" size={15} color={T.pink} /></Pressable>;
}

function ProfilePrivacySheet({ visible, privacy, hasBio, onChange, onClose }: { visible: boolean; privacy: ProfilePrivacy; hasBio: boolean; onChange: (next: ProfilePrivacy) => void; onClose: () => void }) {
  return <Sheet visible={visible} onClose={onClose} maxHeight="82%"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 22, gap: 14 }}><View style={{ gap: 4 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 28 }}>Privacy settings</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 13, lineHeight: 19 }}>Choose who can see the personal parts of your profile.</Text></View><ProfilePrivacyControls privacy={privacy} hasBio={hasBio} onChange={onChange} /><SoftButton label="Done" icon="checkmark" color={T.blue} onPress={onClose} style={{ marginTop: 4 }} /></ScrollView></Sheet>;
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
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [readOnlyContentTop, setReadOnlyContentTop] = useState<number | null>(null);
  const [managedPost, setManagedPost] = useState<QuestFeedPost | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [profileScrollY, setProfileScrollY] = useState(0);

  const updateStatsScrollPosition = useCallback((offsetY: number) => {
    // The charts only need coarse scroll changes to know when they are visible.
    // Avoiding a full Profile render on every native scroll event keeps taps and
    // the rest of the screen responsive.
    setProfileScrollY((current) => Math.abs(current - offsetY) >= 24 ? offsetY : current);
  }, []);

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
    setPrivacyOpen(false);
    setEditing(true);
  }

  function discard() {
    if (!overview?.profile) return;
    setDraftName(fullProfileName(overview.profile.displayName, user?.user_metadata));
    setDraftBio(overview.profile.bio ?? "");
    setDraftAvatarUri(overview.profile.avatarUrl);
    setDraftStatVisibility({ ...DEFAULT_PROFILE_STAT_VISIBILITY, ...overview.profile.statVisibility });
    setDraftPrivacy({ ...DEFAULT_PROFILE_PRIVACY, ...overview.profile.privacy });
    setPrivacyOpen(false);
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
      const validMetadataUsername = metadataUsername && /^[A-Za-z0-9_]{3,20}$/.test(metadataUsername) ? metadataUsername : undefined;
      await updateProfile({ displayName, bio: draftBio, avatarUrl, username: !overview.profile.username ? validMetadataUsername : undefined, statVisibility: draftStatVisibility, privacy: draftPrivacy });
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
      setError(saveErrorMessage(nextError));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !overview) return <Screen scroll={false} ambientGlow={false} contentStyle={{ alignItems: "center" }}><ProfileLoadingSkeleton /></Screen>;
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
    <ScrollView contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEventThrottle={32} onScroll={activeTab === "stats" ? (event) => updateStatsScrollPosition(event.nativeEvent.contentOffset.y) : undefined} contentContainerStyle={{ alignItems: "center", paddingBottom: insets.bottom + 112 }}>
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

            {editing ? <View style={{ width: "100%", maxWidth: 276, minHeight: 40, marginTop: 9, justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: T.dark, backgroundColor: "rgba(255,255,255,0.88)", paddingHorizontal: 12 }}><TextInput value={draftName} onChangeText={setDraftName} accessibilityLabel="Name" autoCapitalize="words" placeholder="Your name" placeholderTextColor={T.muted} style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, textAlign: "center", paddingVertical: 6 }} /></View> : <Text style={{ marginTop: 10, color: T.dark, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 28, textAlign: "center" }}>{displayName}</Text>}
            <Text style={{ marginTop: editing ? 9 : 3, color: T.muted, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18, textAlign: "center" }}>@{username}</Text>
            {!editing ? <ProfileTitleBadge title={profile.title} /> : null}

            {editing ? <View style={{ width: "100%", maxWidth: 276, minHeight: 52, marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: T.dark, backgroundColor: "rgba(255,255,255,0.88)", paddingHorizontal: 12, paddingVertical: 6 }}><TextInput value={draftBio} onChangeText={setDraftBio} accessibilityLabel="Bio" placeholder="Write a bio…" placeholderTextColor={T.muted} multiline maxLength={180} textAlignVertical="top" style={{ minHeight: 32, color: T.dark, fontFamily: "Rubik", fontSize: 15, lineHeight: 20 }} /></View> : <Text style={{ maxWidth: 286, marginTop: 8, color: profile.bio ? T.dark : T.muted, fontFamily: "Rubik", fontSize: 15, lineHeight: 20, textAlign: "center" }}>{profile.bio || "Tap the pencil icon to add a bio."}</Text>}
            <View style={{ width: contentWidth, alignSelf: "stretch", marginHorizontal: -horizontalPadding, marginTop: 15 }}><ProfileStatMarquee overview={overview} visibility={carouselVisibility} /></View>
            {editing ? <><ProfileStatVisibilityBento overview={overview} visibility={draftStatVisibility} onToggle={(id) => setDraftStatVisibility((current) => ({ ...current, [id]: !current[id] }))} /><SoftButton label="Privacy settings" icon="lock-closed-outline" inverse color={T.purple} onPress={() => setPrivacyOpen(true)} style={{ width: "100%", marginTop: 14, minHeight: 48 }} /></> : null}
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
          {activeTab === "posts" ? (profilePosts.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 6, rowGap: 6 }}>{profilePosts.map((post) => <QuestFeedThumbnail key={post.id} post={post} size={postTileSize} onManage={() => setManagedPost(post)} />)}</View> : <EmptyState framed emoji="📷" title="No posts yet" body="Complete a quest and share the first story here." action={<SoftButton label="Explore quests" icon="compass-outline" inverse color={T.blue} onPress={() => router.push("/(tabs)/explore")} style={{ marginTop: 6 }} />} />) : <ProfileStats overview={overview} weeklyActivity={weeklyActivity} insights={insights} scrollY={profileScrollY} />}
        </View>
      </View>
      </View>
    </View>
    </ScrollView>

    {editing && readOnlyContentTop !== null ? <View pointerEvents="none" style={{ position: "absolute", top: readOnlyContentTop, right: 0, bottom: 0, left: 0, overflow: "hidden" }}>
      <BlurView tint="light" intensity={16} style={{ position: "absolute", inset: 0 }} />
      <View style={{ flex: 1, backgroundColor: "rgba(255,252,245,0.48)" }} />
    </View> : null}

    <QuestPostManagementSheet post={managedPost} visible={Boolean(managedPost)} onClose={() => setManagedPost(null)} onUpdated={() => { setManagedPost(null); void load(); }} onDeleted={() => { setManagedPost(null); void load(); }} />
    <FollowerManagerSheet visible={followersOpen} onClose={() => setFollowersOpen(false)} onChanged={() => void load()} />
    <ProfilePrivacySheet visible={privacyOpen} privacy={draftPrivacy} hasBio={Boolean(draftBio.trim())} onChange={setDraftPrivacy} onClose={() => setPrivacyOpen(false)} />

  </View>;
}
