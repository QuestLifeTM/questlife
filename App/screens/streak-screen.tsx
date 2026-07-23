import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { Accelerometer } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Image, ImageBackground, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedFlame } from "@/components/animated-flame";
import { ProfileAvatar } from "@/components/profile-avatar";
import { QuestlifeFlame } from "@/components/questlife-flame";
import { T } from "@/components/theme";
import { EmptyState, Sheet, SoftButton, haptic, responsiveScreenGutter } from "@/components/ui";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { useSocial } from "@/contexts/SocialContext";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { toLocalDateKey } from "@/services/journal/journalService";
import { DuoStreak, IncomingDuoInvite, OutgoingDuoInvite, StreakFriend } from "@/types/streaks";

type StreakTab = "personal" | "friends" | "achievements";

const STREAK_ORANGE = "#ff6d45";
const STREAK_DEEP = "#422b31";
const STREAK_INK = "#282124";
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ACHIEVEMENTS = [
  { days: 3, label: "First flame", note: "Show up for 3 days", badge: require("@/assets/streaks/streak-badge-day-3.png") },
  { days: 7, label: "Week warrior", note: "Keep a flame for 7 days", badge: require("@/assets/streaks/streak-badge-day-7.png") },
  { days: 14, label: "Two-week torch", note: "A fortnight of showing up", badge: require("@/assets/streaks/streak-badge-day-14.png") },
  { days: 30, label: "Month maker", note: "Build a 30-day rhythm", badge: require("@/assets/streaks/streak-badge-day-30.png") },
  { days: 50, label: "Half-century spark", note: "Make 50 days your new normal", badge: require("@/assets/streaks/streak-badge-day-50.png") },
  { days: 100, label: "Centurion", note: "Reach 100 days in a row", badge: require("@/assets/streaks/streak-badge-day-100.png") },
  { days: 365, label: "Year of fire", note: "Keep your promise all year", badge: require("@/assets/streaks/streak-badge-day-365.png") },
] as const;

function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function buildMonthRows(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(first.getDay()).fill(null);
  for (let day = 1; day <= days; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}

function colorFor(id: string) {
  const colors = [T.pink, T.cyan, T.purple, T.green, T.orange, T.teal];
  return colors[Array.from(id).reduce((total, letter) => total + letter.charCodeAt(0), 0) % colors.length];
}

function PersonAvatar({ name, avatarUrl, seed, size = 44 }: { name: string; avatarUrl: string | null; seed: string; size?: number }) { return <ProfileAvatar uri={avatarUrl} color={colorFor(seed)} size={size} label={`${name}'s profile photo`} />; }

function WhitePanel({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[{ backgroundColor: T.white, borderRadius: 22, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#e6ddd2", padding: 16 }, style]}>{children}</View>;
}

function StreakActionButton({ label, icon, onPress, disabled = false, style }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress?: () => void; disabled?: boolean; style?: object }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => { if (!disabled) haptic(); onPress?.(); }} style={({ pressed }) => [{ minHeight: 52, paddingHorizontal: 16, borderRadius: 18, backgroundColor: disabled ? T.border : STREAK_ORANGE, borderBottomWidth: 5, borderBottomColor: disabled ? "#d7cec2" : "#d44c31", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.65 : 1, transform: [{ translateY: pressed && !disabled ? 3 : 0 }] }, style]}>
    {icon ? <Ionicons name={icon} size={18} color={T.white} /> : null}
    <Text style={{ color: T.white, fontSize: 14, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</Text>
  </Pressable>;
}

function StreakVisibilityToggle({ value, onChange, reducedMotion }: { value: boolean; onChange: () => void; reducedMotion: boolean }) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      position.setValue(value ? 1 : 0);
      return;
    }
    Animated.timing(position, { toValue: value ? 1 : 0, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [position, reducedMotion, value]);

  const translateX = position.interpolate({ inputRange: [0, 1], outputRange: [0, 24] });
  const checkScale = position.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel="Show my streak to friends" onPress={() => { haptic(); onChange(); }} style={({ pressed }) => ({ width: 58, height: 34, borderRadius: 17, padding: 3, justifyContent: "center", backgroundColor: value ? `${STREAK_ORANGE}20` : T.bg, borderWidth: 2, borderColor: value ? STREAK_ORANGE : T.border, borderBottomWidth: 4, borderBottomColor: value ? "#d44c31" : T.border, transform: [{ translateY: pressed ? 2 : 0 }] })}>
    <Animated.View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: value ? STREAK_ORANGE : T.white, borderWidth: value ? 0 : 1, borderColor: T.border, transform: [{ translateX }] }}>
      <Animated.View style={{ opacity: position, transform: [{ scale: checkScale }] }}><Ionicons name="checkmark" size={14} color={T.white} /></Animated.View>
    </Animated.View>
  </Pressable>;
}

function useBadgeTilt(enabled: boolean) {
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      x.setValue(0);
      y.setValue(0);
      return;
    }

    let active = true;
    let subscription: { remove: () => void } | undefined;
    let restingTilt: { x: number; y: number } | undefined;

    const start = async () => {
      try {
        if (!(await Accelerometer.isAvailableAsync()) || !active) return;
        Accelerometer.setUpdateInterval(200);
        subscription = Accelerometer.addListener(({ x: deviceX, y: deviceY }) => {
          if (!restingTilt) restingTilt = { x: deviceX, y: deviceY };
          const horizontalTilt = Math.max(-1, Math.min(1, (deviceX - restingTilt.x) / 0.18));
          const verticalTilt = Math.max(-1, Math.min(1, (deviceY - restingTilt.y) / 0.18));
          Animated.parallel([
            Animated.spring(x, { toValue: horizontalTilt, damping: 22, stiffness: 180, mass: 0.55, useNativeDriver: true }),
            Animated.spring(y, { toValue: verticalTilt, damping: 22, stiffness: 180, mass: 0.55, useNativeDriver: true }),
          ]).start();
        });
      } catch {
        // The badges remain fully usable on simulators and devices without motion sensors.
      }
    };

    void start();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled, x, y]);

  return { x, y };
}

function StreakBadge({ source, days, unlocked, tiltX, tiltY }: { source: number; days: number; unlocked: boolean; tiltX: Animated.Value; tiltY: Animated.Value }) {
  const shimmerX = tiltX.interpolate({ inputRange: [-1, 1], outputRange: [-20, 20] });
  const shimmerY = tiltY.interpolate({ inputRange: [-1, 1], outputRange: [18, -18] });

  return <View accessibilityLabel={`${days}-day streak achievement${unlocked ? ", unlocked" : ", locked"}`} style={{ width: 78, height: 78, alignItems: "center", justifyContent: "center" }}>
    <Image source={source} style={{ width: 78, height: 78 }} resizeMode="contain" />
    {unlocked ? <MaskedView pointerEvents="none" androidRenderingMode="software" maskElement={<Image source={source} style={{ width: 78, height: 78 }} resizeMode="contain" />} style={{ position: "absolute", width: 78, height: 78 }}>
      <Animated.View style={{ position: "absolute", width: 126, height: 126, left: -26, top: -26, transform: [{ translateX: shimmerX }, { translateY: shimmerY }, { rotate: "-24deg" }] }}>
        <LinearGradient colors={["rgba(246,239,225,0)", "rgba(246,239,225,0.03)", "rgba(246,239,225,0.32)", "rgba(246,239,225,0.03)", "rgba(246,239,225,0)"]} locations={[0, 0.3, 0.5, 0.7, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      </Animated.View>
    </MaskedView> : null}
  </View>;
}

function StreakHero({ days, onBack, topInset }: { days: number; onBack: () => void; topInset: number }) {
  const currentDay = Math.min(7, Math.max(1, days || 1));
  return (
    <View style={{ height: 384 }}>
      <ImageBackground source={require("@/assets/streaks/streak-hero-orange-v4.png")} resizeMode="cover" style={{ height: 306, overflow: "hidden", paddingHorizontal: 20 }}>
        <View style={{ height: topInset + 54, paddingTop: topInset + 6, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, backgroundColor: T.white, borderWidth: 3, borderColor: T.border, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.92 : 1 }] })}>
            <Ionicons name="arrow-back" size={24} color={STREAK_INK} />
          </Pressable>
        </View>
        <View style={{ alignItems: "center", paddingTop: 10, transform: [{ translateY: -10 }] }}>
          <Text style={{ color: T.white, fontSize: 54, lineHeight: 60, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{days}</Text>
          <Text style={{ color: T.white, fontSize: 29, lineHeight: 36, fontWeight: "900" }}>day streak</Text>
        </View>
      </ImageBackground>
      <View style={{ position: "absolute", top: 246, left: 20, right: 20, backgroundColor: T.white, borderRadius: 22, padding: 16, gap: 14, borderWidth: 2, borderColor: "#f4c7ae", borderBottomWidth: 5, borderBottomColor: "#eebf9f" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: STREAK_DEEP, fontSize: 16, fontWeight: "900" }}>7 Day Challenge</Text>
          <Text style={{ color: "#957d7c", fontSize: 13, fontWeight: "800" }}>Day {currentDay} of 7</Text>
        </View>
        <View style={{ flexDirection: "row" }}>
          {WEEKDAYS.map((day, index) => {
            const complete = index < currentDay - 1;
            const today = index === currentDay - 1;
            return <View key={`${day}-${index}`} style={{ flex: 1, alignItems: "center", gap: 6 }}><Text style={{ color: today ? STREAK_ORANGE : "#957d7c", fontSize: 12, fontWeight: "900" }}>{day}</Text><View style={{ width: 31, height: 31, borderRadius: 16, backgroundColor: today ? STREAK_ORANGE : complete ? "#f5c7b0" : "#fff0e7", borderWidth: today ? 0 : 1.5, borderColor: complete ? "#edb99d" : "#f2d8c9", alignItems: "center", justifyContent: "center" }}>{today ? <Ionicons name="checkmark" size={19} color={T.white} /> : <Ionicons name="flame" size={16} color={complete ? "#d95b3d" : "#c8aaa0"} />}</View></View>;
          })}
        </View>
      </View>
    </View>
  );
}

function StreakTabs({ activeTab, onChange, inviteCount, reducedMotion }: { activeTab: StreakTab; onChange: (value: StreakTab) => void; inviteCount: number; reducedMotion: boolean }) {
  const labels: { key: StreakTab; label: string }[] = [{ key: "personal", label: "Personal" }, { key: "friends", label: "Friends" }, { key: "achievements", label: "Achievements" }];
  const [tabWidth, setTabWidth] = useState(0);
  const underlineX = useRef(new Animated.Value(0)).current;
  const activeIndex = labels.findIndex((tab) => tab.key === activeTab);

  useEffect(() => {
    const nextX = activeIndex * (tabWidth / labels.length);
    if (reducedMotion) {
      underlineX.setValue(nextX);
      return;
    }
    Animated.timing(underlineX, { toValue: nextX, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [activeIndex, reducedMotion, tabWidth, underlineX]);

  return <View onLayout={(event) => setTabWidth(event.nativeEvent.layout.width)} style={{ position: "relative", flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#eadfd9" }}>
    {tabWidth ? <Animated.View pointerEvents="none" style={{ position: "absolute", bottom: -2, left: 0, width: tabWidth / labels.length, height: 4, borderRadius: 2, backgroundColor: STREAK_ORANGE, transform: [{ translateX: underlineX }] }} /> : null}
    {labels.map(({ key, label }) => { const selected = key === activeTab; return <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => { haptic(); onChange(key); }} style={({ pressed }) => ({ flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.97 : 1 }] })}><View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}><Text numberOfLines={1} style={{ color: selected ? STREAK_ORANGE : T.muted, fontSize: 15, lineHeight: 20, fontWeight: "900" }}>{label}</Text>{key === "friends" && inviteCount > 0 ? <View style={{ minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: STREAK_ORANGE }}><Text style={{ color: T.white, fontSize: 9, fontWeight: "900" }}>{inviteCount}</Text></View> : null}</View></Pressable>; })}
  </View>;
}

function StreakTabContent({ activeTab, reducedMotion, children }: { activeTab: StreakTab; reducedMotion: boolean; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    opacity.setValue(0);
    translateY.setValue(10);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [activeTab, opacity, reducedMotion, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function CalendarCard({ questDays, currentRange }: { questDays: Set<string>; currentRange: { start: string; end: string } | null }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const rows = useMemo(() => buildMonthRows(year, month), [year, month]);
  const today = toLocalDateKey(now);
  const shift = (delta: number) => { const next = new Date(year, month + delta, 1); if (next <= new Date(now.getFullYear(), now.getMonth(), 1)) { haptic(); setYear(next.getFullYear()); setMonth(next.getMonth()); } };
  const nextMonthDisabled = year === now.getFullYear() && month === now.getMonth();
  return <WhitePanel style={{ gap: 15 }}><View style={{ minHeight: 44, flexDirection: "row", alignItems: "center" }}><Pressable accessibilityLabel="Previous month" onPress={() => shift(-1)} hitSlop={10} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Ionicons name="chevron-back" size={22} color={T.muted} /></Pressable><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: T.dark, fontSize: 22, lineHeight: 27, fontWeight: "900", textAlign: "center" }}>{MONTH_NAMES[month]} {year}</Text></View><Pressable accessibilityLabel="Next month" onPress={() => shift(1)} hitSlop={10} disabled={nextMonthDisabled} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Ionicons name="chevron-forward" size={22} color={nextMonthDisabled ? "#ded6d1" : T.muted} /></Pressable></View><View style={{ height: 1, backgroundColor: "#eee7e2" }} /><View style={{ gap: 10 }}><View style={{ flexDirection: "row" }}>{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <Text key={`${day}-${index}`} style={{ flex: 1, textAlign: "center", color: T.muted, fontSize: 12, fontWeight: "900" }}>{day}</Text>)}</View>{rows.map((row, index) => <View key={index} style={{ flexDirection: "row" }}>{row.map((date, col) => { const key = date ? toLocalDateKey(date) : ""; const complete = Boolean(date && questDays.has(key)); const live = Boolean(currentRange && key >= currentRange.start && key <= currentRange.end); const isToday = key === today; return <View key={col} style={{ flex: 1, height: 40, alignItems: "center", justifyContent: "center" }}>{date ? <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: complete ? (live ? STREAK_ORANGE : "#f2c9b5") : "#f2f0ef", borderWidth: isToday && !complete ? 2 : 0, borderColor: STREAK_ORANGE }}><Text style={{ color: complete ? T.white : isToday ? STREAK_ORANGE : T.muted, fontSize: 13, fontWeight: "900" }}>{date.getDate()}</Text></View> : null}</View>; })}</View>)}</View><Text style={{ textAlign: "center", color: T.muted, fontSize: 11, fontWeight: "700" }}>Orange marks your current streak · dates show completed quests</Text></WhitePanel>;
}

function PersonalContent() {
  const { overview, setVisibility, restorePersonalStreak } = useStreaks();
  const { overview: socialOverview } = useSocial();
  const { showFeedback } = useAppFeedback();
  const router = useRouter();
  const reducedMotion = useReducedMotionPreference();
  const [restoring, setRestoring] = useState(false);

  if (!overview) return null;
  const { personal, friends, questDays } = overview;
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const canRestore = personal.lastQuestOn === toLocalDateKey(twoDaysAgo);
  const restore = () => {
    if (restoring) return;
    Alert.alert("Restore your streak?", "Use one grace day to cover yesterday. You can use this once every 30 days.", [
      { text: "Not now", style: "cancel" },
      { text: "Restore streak", onPress: () => void (async () => {
        setRestoring(true);
        try {
          await restorePersonalStreak();
          showFeedback({ message: "Your streak was restored with a grace day.", icon: "flame", color: STREAK_ORANGE });
        } catch (error) {
          const message = error instanceof Error && error.message.includes("COOLDOWN") ? "Your next streak recovery is available 30 days after the last one." : "We couldn't restore that streak. Please try again.";
          showFeedback({ message, icon: "alert-circle", color: T.red });
        } finally {
          setRestoring(false);
        }
      })() },
    ]);
  };
  const currentRange = personal.currentStreak && personal.streakStartedOn && personal.lastQuestOn ? { start: personal.streakStartedOn, end: personal.lastQuestOn } : null;
  const leaderRows = [
    { id: "you", name: "You", avatarUrl: socialOverview?.me.avatarUrl ?? null, streak: personal.currentStreak, self: true },
    ...friends.filter((friend) => friend.streakVisible).map((friend) => ({ id: friend.userId, name: friend.displayName, avatarUrl: friend.avatarUrl, streak: friend.currentStreak ?? 0, self: false })),
  ].sort((a, b) => b.streak - a.streak);

  return <View style={{ gap: 18 }}>
    <View style={{ gap: 11 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: T.dark, fontSize: 19, fontWeight: "900" }}>Streak leaderboard</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>Personal streaks</Text></View>
      <WhitePanel style={{ padding: 3, gap: 0 }}>
        <View style={{ overflow: "hidden", borderRadius: 17 }}>
          {leaderRows.map((row, index) => <Pressable key={row.id} accessibilityRole={row.self ? undefined : "button"} accessibilityLabel={row.self ? undefined : `View ${row.name}'s profile`} disabled={row.self} onPress={() => { if (!row.self) router.push(`/add-friend/${row.id}`); }} style={({ pressed }) => ({ minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, borderBottomWidth: index === leaderRows.length - 1 ? 0 : 1.5, borderBottomColor: "#eee7e2", backgroundColor: row.self ? "#fff7f2" : T.white, opacity: pressed && !row.self ? 0.7 : 1 })}>
            <Text style={{ width: 22, color: index === 0 ? STREAK_ORANGE : T.muted, fontSize: 16, fontWeight: "900" }}>{index + 1}</Text>
            <PersonAvatar name={row.name} avatarUrl={row.avatarUrl} seed={row.id} size={42} />
            <Text style={{ flex: 1, color: T.dark, fontSize: 16, fontWeight: "900" }}>{row.name}</Text>
            <View style={{ minWidth: 42, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 }}><QuestlifeFlame size={20} /><Text style={{ color: STREAK_DEEP, fontSize: 16, fontWeight: "900" }}>{row.streak}</Text></View>
          </Pressable>)}
        </View>
      </WhitePanel>
      {canRestore ? (
        <WhitePanel style={{ gap: 10, borderColor: `${STREAK_ORANGE}66`, backgroundColor: "#fff7f2" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: `${STREAK_ORANGE}18` }}>
              <Ionicons name="shield-checkmark-outline" size={21} color={STREAK_ORANGE} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: STREAK_DEEP, fontSize: 15, fontWeight: "900" }}>Yesterday can be a grace day</Text>
              <Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>Restore this streak once every 30 days. It never creates a fake quest.</Text>
            </View>
          </View>
          <StreakActionButton label={restoring ? "Restoring..." : "Restore streak"} icon="shield-checkmark" disabled={restoring} onPress={restore} style={{ minHeight: 46 }} />
        </WhitePanel>
      ) : null}
      <View style={{ minHeight: 74, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: personal.streakVisibility === "public" ? `${STREAK_ORANGE}10` : T.white, borderWidth: 2, borderColor: personal.streakVisibility === "public" ? STREAK_ORANGE : T.border }}>
        <View style={{ flex: 1, gap: 2 }}><Text style={{ color: T.dark, fontSize: 15, fontWeight: "900" }}>Show my streak</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>Let friends see you on their leaderboard</Text></View>
        <StreakVisibilityToggle value={personal.streakVisibility === "public"} reducedMotion={reducedMotion} onChange={() => setVisibility(personal.streakVisibility === "public" ? "private" : "public")} />
      </View>
    </View>

    <View style={{ gap: 9 }}><Text style={{ color: T.dark, fontSize: 19, fontWeight: "900" }}>Monthly Overview</Text><CalendarCard questDays={questDays} currentRange={currentRange} /></View>
  </View>;
}

function DuoCard({ duo, onNudge, onQuest, onEnd, busy }: { duo: DuoStreak; onNudge: () => void; onQuest: () => void; onEnd: () => void; busy: boolean }) {
  const safe = duo.myDoneToday && duo.partnerDoneToday;
  return <WhitePanel style={{ gap: 13 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}><PersonAvatar name={duo.partnerName} avatarUrl={duo.partnerAvatarUrl} seed={duo.partnerId} size={48} /><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 16, fontWeight: "900" }}>{duo.partnerName}</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>Together since {MONTH_NAMES[parseDateKey(duo.startedOn).getMonth()].slice(0, 3)} {parseDateKey(duo.startedOn).getDate()}</Text></View><AnimatedFlame size={36} animated={duo.currentStreak > 0} dimmed={!duo.currentStreak} /><Text style={{ color: STREAK_ORANGE, fontSize: 22, fontWeight: "900" }}>{duo.currentStreak}</Text></View><View style={{ flexDirection: "row", gap: 8 }}><View style={{ flex: 1, borderRadius: 12, backgroundColor: duo.myDoneToday ? "#e9f8ee" : "#f6f1ee", padding: 9, flexDirection: "row", gap: 5, alignItems: "center" }}><Ionicons name={duo.myDoneToday ? "checkmark-circle" : "ellipse-outline"} size={15} color={duo.myDoneToday ? T.green : T.muted} /><Text style={{ fontSize: 11, fontWeight: "800", color: T.dark }}>You</Text></View><View style={{ flex: 1, borderRadius: 12, backgroundColor: duo.partnerDoneToday ? "#e9f8ee" : "#f6f1ee", padding: 9, flexDirection: "row", gap: 5, alignItems: "center" }}><Ionicons name={duo.partnerDoneToday ? "checkmark-circle" : "ellipse-outline"} size={15} color={duo.partnerDoneToday ? T.green : T.muted} /><Text numberOfLines={1} style={{ flex: 1, fontSize: 11, fontWeight: "800", color: T.dark }}>{duo.partnerName}</Text></View></View>{safe ? <Text style={{ color: T.green, fontSize: 12, fontWeight: "900", textAlign: "center" }}>Streak safe for today</Text> : <View style={{ flexDirection: "row", gap: 8 }}><StreakActionButton label="Do quest" icon="compass" onPress={onQuest} style={{ flex: 1, minHeight: 46 }} />{!duo.partnerDoneToday ? <StreakActionButton label={busy ? "Sending…" : "Nudge"} icon="megaphone" onPress={onNudge} disabled={busy} style={{ flex: 1, minHeight: 46 }} /> : null}</View>}<Pressable onPress={onEnd} style={{ alignSelf: "center" }}><Text style={{ color: T.muted, fontSize: 12, fontWeight: "800", textDecorationLine: "underline" }}>End this streak</Text></Pressable></WhitePanel>;
}

function FriendsContent() {
  const router = useRouter();
  const { overview, respondToInvite, cancelInvite, leaveDuoStreak, nudgePartner } = useStreaks();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [endTarget, setEndTarget] = useState<DuoStreak | null>(null);
  if (!overview) return null;
  const run = async (id: string, action: () => Promise<void>) => { setBusyId(id); try { await action(); } catch {} finally { setBusyId(null); } };
  return <View style={{ gap: 18 }}>
    {overview.incomingInvites.length ? <View style={{ gap: 9 }}><Text style={{ color: T.dark, fontSize: 19, fontWeight: "900" }}>New invites</Text>{overview.incomingInvites.map((invite: IncomingDuoInvite) => <WhitePanel key={invite.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><PersonAvatar name={invite.senderName} avatarUrl={invite.senderAvatarUrl} seed={invite.senderId} size={42} /><Text style={{ flex: 1, color: T.dark, fontWeight: "900" }}>{invite.senderName}</Text><StreakActionButton label={busyId === invite.id ? "…" : "Accept"} onPress={() => run(invite.id, () => respondToInvite(invite.id, true))} disabled={busyId === invite.id} style={{ minHeight: 40, borderRadius: 14, paddingHorizontal: 12 }} /><Pressable accessibilityLabel={`Decline ${invite.senderName}'s streak invite`} onPress={() => run(invite.id, () => respondToInvite(invite.id, false))}><Ionicons name="close" size={23} color={T.muted} /></Pressable></WhitePanel>)}</View> : null}

    <View style={{ gap: 10 }}>
      <Text style={{ color: T.dark, fontSize: 19, fontWeight: "900" }}>Friend streaks</Text>
      {overview.duoStreaks.map((duo) => <DuoCard key={duo.id} duo={duo} busy={busyId === duo.id} onNudge={() => run(duo.id, () => nudgePartner(duo.id))} onQuest={() => router.push("/explore")} onEnd={() => setEndTarget(duo)} />)}
      {overview.outgoingInvites.map((invite: OutgoingDuoInvite) => <WhitePanel key={invite.id} style={{ minHeight: 66, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 }}><PersonAvatar name={invite.recipientName} avatarUrl={invite.recipientAvatarUrl} seed={invite.recipientId} size={40} /><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontWeight: "900" }}>{invite.recipientName}</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>Streak invite pending</Text></View><Pressable onPress={() => run(invite.id, () => cancelInvite(invite.id))}><Text style={{ color: STREAK_ORANGE, fontSize: 12, fontWeight: "900" }}>CANCEL</Text></Pressable></WhitePanel>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Invite a friend to a streak" onPress={() => router.push("/streak-invite")} style={({ pressed }) => ({ minHeight: 70, borderRadius: 22, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#e6ddd2", backgroundColor: T.white, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 12, transform: [{ translateY: pressed ? 2 : 0 }] })}>
        <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderStyle: "dashed", borderColor: "#b7aeac", alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={24} color="#a39a98" /></View>
        <Text style={{ color: T.muted, fontSize: 16, fontWeight: "900" }}>Invite a friend</Text>
      </Pressable>
    </View>

    <Sheet visible={endTarget !== null} onClose={() => setEndTarget(null)}>{endTarget ? <View style={{ padding: 20, gap: 16, alignItems: "center" }}><PersonAvatar name={endTarget.partnerName} avatarUrl={endTarget.partnerAvatarUrl} seed={endTarget.partnerId} size={64} /><Text style={{ color: T.dark, fontSize: 23, fontWeight: "900", textAlign: "center" }}>End your streak with {endTarget.partnerName}?</Text><StreakActionButton label="End streak" icon="remove-circle" style={{ alignSelf: "stretch" }} onPress={() => run(endTarget.id, async () => { await leaveDuoStreak(endTarget.id); setEndTarget(null); })} /><SoftButton label="Keep it going" inverse color={STREAK_ORANGE} style={{ alignSelf: "stretch" }} onPress={() => setEndTarget(null)} /></View> : null}</Sheet>
  </View>;
}

function AchievementsContent({ currentStreak }: { currentStreak: number }) {
  const reducedMotion = useReducedMotionPreference();
  const tilt = useBadgeTilt(!reducedMotion && currentStreak >= ACHIEVEMENTS[0].days);
  return <View style={{ gap: 18 }}><View style={{ alignItems: "center", gap: 6, paddingVertical: 5 }}><Text style={{ color: T.dark, fontSize: 19, fontWeight: "900" }}>Streak achievements</Text><Text style={{ color: T.muted, fontSize: 13, fontWeight: "700", textAlign: "center" }}>Every day you show up makes your flame stronger.</Text></View><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{ACHIEVEMENTS.map((achievement) => { const unlocked = currentStreak >= achievement.days; const progress = Math.min(1, currentStreak / achievement.days); return <WhitePanel key={achievement.days} style={{ width: "48%", alignItems: "center", gap: 8, opacity: unlocked ? 1 : 0.46, backgroundColor: unlocked ? "#fff6f0" : T.white, borderColor: unlocked ? "#f4c7ae" : "#eadfd9" }}><StreakBadge source={achievement.badge} days={achievement.days} unlocked={unlocked} tiltX={tilt.x} tiltY={tilt.y} /><Text style={{ color: T.dark, fontSize: 14, fontWeight: "900", textAlign: "center" }}>{achievement.days}-day streak</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "700", textAlign: "center" }}>{achievement.label}</Text><View style={{ width: "100%", height: 5, backgroundColor: "#eadfd9", borderRadius: 3, overflow: "hidden" }}><View style={{ width: `${Math.max(3, progress * 100)}%`, height: "100%", backgroundColor: unlocked ? STREAK_ORANGE : "#cfc5c1" }} /></View><Text style={{ color: unlocked ? STREAK_ORANGE : T.muted, fontSize: 11, fontWeight: "900" }}>{unlocked ? "UNLOCKED" : `${currentStreak}/${achievement.days}`}</Text></WhitePanel>; })}</View></View>;
}

export function StreakScreen({ onBack }: { onBack: () => void }) {
  const { error, loading, overview, refresh } = useStreaks();
  const [activeTab, setActiveTab] = useState<StreakTab>("personal");
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotionPreference();
  const gutter = responsiveScreenGutter(390);
  useEffect(() => { refresh(); }, [refresh]);
  return <View style={{ flex: 1, backgroundColor: T.bg }}><StatusBar style="light" translucent /><ScrollView contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: insets.bottom + 108 }}><StreakHero days={overview?.personal.currentStreak ?? 0} onBack={onBack} topInset={insets.top} /><View style={{ backgroundColor: T.bg, paddingHorizontal: gutter }}><StreakTabs activeTab={activeTab} onChange={setActiveTab} inviteCount={overview?.incomingInvites.length ?? 0} reducedMotion={reducedMotion} /></View><View style={{ paddingHorizontal: gutter, paddingTop: 14 }}>{error ? <WhitePanel style={{ borderColor: `${T.red}77`, gap: 10 }}><Text style={{ color: T.red, fontWeight: "900" }}>{error}</Text><SoftButton label="Try again" inverse color={STREAK_ORANGE} onPress={refresh} /></WhitePanel> : null}{!overview && loading ? <View style={{ paddingVertical: 54, alignItems: "center", gap: 12 }}><ActivityIndicator color={STREAK_ORANGE} /><Text style={{ color: T.muted, fontWeight: "800" }}>Warming up your flame…</Text></View> : overview ? <StreakTabContent activeTab={activeTab} reducedMotion={reducedMotion}>{activeTab === "personal" ? <PersonalContent /> : activeTab === "friends" ? <FriendsContent /> : <AchievementsContent currentStreak={overview.personal.currentStreak} />}</StreakTabContent> : !error ? <EmptyState artwork={<QuestlifeFlame size={64} />} title="Streaks are warming up" body="Sign in and complete a quest to start tracking your streak." /> : null}</View></ScrollView></View>;
}
