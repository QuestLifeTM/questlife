import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated as RNAnimated,
  FlatList,
  ListRenderItemInfo,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AvatarPile } from "@/components/avatar-pile";
import { CachedImage } from "@/components/cached-image";
import { StreakPill } from "@/components/streak-pill";
import { categoryColor, difficultyColor, radius, T } from "@/components/theme";
import { Card, EmptyState, Entrance, Header, IconButton, Screen, Sheet, SoftButton, Tag, haptic, useResponsiveScreenLayout } from "@/components/ui";
import { fetchJournalData, resolveJournalMedia, toLocalDateKey, upsertJournalEntry } from "@/services/journal/journalService";
import { useActiveQuest } from "@/contexts/ActiveQuestContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { MotionPulse } from "@/motion/primitives";
import { JournalActiveQuest, JournalData, JournalEntry, JournalMemory, JournalMood } from "@/types/journal";

type JournalTab = "journal" | "album";
type CalendarMode = "week" | "month";
type JournalMediaItem = { id: string; source: string; dateKey: string; questTitle: string; completionId?: string; activePhotoId?: number };

const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const moods: { key: JournalMood; emoji: string; label: string; description: string; color: string }[] = [
  { key: "sad", emoji: "😔", label: "Low", description: "Taking it gently today", color: T.purple },
  { key: "neutral", emoji: "😐", label: "Steady", description: "Finding your rhythm", color: T.cyan },
  { key: "happy", emoji: "😊", label: "Happy", description: "Feeling bright today", color: T.green }
];

const milestoneLabels: Record<number, string> = {
  7: "One week of showing up",
  30: "One month of adventures",
  100: "100 days of quests",
  365: "A whole year of your story"
};

// ── Date helpers (local-time, date-only) ─────────────────────────────────────

function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  return addDays(startOfDay(date), -date.getDay());
}

function clampDate(date: Date, min: Date, max: Date) {
  if (date < min) return new Date(min);
  if (date > max) return new Date(max);
  return date;
}

function shortDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMinutes(minutes: number) {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ── Header + tab switch ──────────────────────────────────────────────────────

function JournalHeader({ tab }: { tab: JournalTab }) {
  const title = tab === "journal" ? "My Journal" : "My Album";
  const subtitle = tab === "journal" ? "Your story, one day at a time" : "Every quest, kept close";

  return (
    <Header
      title={title}
      subtitle={subtitle}
      right={<StreakPill />}
      animated={false}
    />
  );
}

function JournalTabs({ activeTab, onChange }: { activeTab: JournalTab; onChange: (tab: JournalTab) => void }) {
  return (
    <View style={{ flexDirection: "row", padding: 4, borderRadius: 24, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }}>
      {(["journal", "album"] as JournalTab[]).map((tab) => {
        const isActive = activeTab === tab;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab === "journal" ? "My Journal" : "My Album"}
            onPress={() => {
              if (isActive) return;
              haptic();
              onChange(tab);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isActive ? T.dark : "transparent",
              transform: [{ scale: pressed ? 0.98 : 1 }]
            })}
          >
            <Text style={{ color: isActive ? T.white : T.muted, fontSize: 13, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>
              {tab === "journal" ? "My Journal" : "My Album"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function JournalLoadingSkeleton() {
  const block = (width: number | `${number}%`, height: number, radiusValue = 9) => <MotionPulse style={{ width, height, borderRadius: radiusValue, backgroundColor: "#dfe7ed" }} />;

  return <View accessibilityRole="progressbar" accessibilityLabel="Loading your journal" style={{ gap: 18, paddingTop: 18 }}>
    <View style={{ gap: 10 }}><View style={{ flexDirection: "row", justifyContent: "space-between" }}>{block("42%", 24)}{block("25%", 16)}</View>{block("100%", 64, 20)}</View>
    <View style={{ gap: 11 }}>{block("32%", 15)}{[0, 1].map((index) => <Card key={index} style={{ borderRadius: radius.lg, padding: 15, gap: 10 }}><View style={{ flexDirection: "row", justifyContent: "space-between" }}>{block("54%", 16)}{block(42, 14)}</View>{block("86%", 13)}{block("62%", 13)}<View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 3 }}>{block(74, 28, 14)}{block(46, 24, 12)}</View></Card>)}</View>
  </View>;
}

// ── Calendar (week/month, animated mode change, scroll-linked indicator) ─────

const DOW_ROW_HEIGHT = 20;
const WEEK_CELL_HEIGHT = 52;
const MONTH_CELL_HEIGHT = 44;
const INDICATOR_SIZE = 38;

function getMonthGrid(anchor: Date): (Date | null)[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const grid: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i += 1) grid.push(null);
  for (let day = 1; day <= last.getDate(); day += 1) grid.push(new Date(anchor.getFullYear(), anchor.getMonth(), day));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function CalendarNavButton({ icon, label, disabled, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: T.white,
        borderWidth: 2,
        borderColor: T.border,
        borderBottomWidth: pressed ? 2 : 4,
        borderBottomColor: T.border,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }, { translateY: pressed ? 2 : 0 }]
      })}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${T.muted}16` }}>
        <Ionicons name={icon} size={18} color={T.muted} />
      </View>
    </Pressable>
  );
}

function JournalCalendar({
  mode,
  onToggleMode,
  activeKey,
  todayKey,
  joinKey,
  onSelectDate
}: {
  mode: CalendarMode;
  onToggleMode: () => void;
  activeKey: string;
  todayKey: string;
  joinKey: string;
  onSelectDate: (key: string) => void;
}) {
  const reduceMotion = useReducedMotionPreference();
  const [width, setWidth] = useState(0);
  const active = parseKey(activeKey);
  const join = parseKey(joinKey);
  const today = parseKey(todayKey);
  const weekStart = startOfWeek(active);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthGrid = getMonthGrid(active);
  const monthRows = monthGrid.length / 7;

  const modeAnim = useSharedValue(mode === "week" ? 0 : 1);
  const indicator = useRef(new RNAnimated.ValueXY({ x: 0, y: 0 })).current;
  const indicatorOpacity = useRef(new RNAnimated.Value(0)).current;

  const weekBodyHeight = DOW_ROW_HEIGHT + WEEK_CELL_HEIGHT;
  const monthBodyHeight = DOW_ROW_HEIGHT + monthRows * MONTH_CELL_HEIGHT;

  useEffect(() => {
    modeAnim.value = reduceMotion ? (mode === "week" ? 0 : 1) : withTiming(mode === "week" ? 0 : 1, { duration: 260 });
  }, [mode, modeAnim, reduceMotion]);

  const calendarStyle = useAnimatedStyle(() => ({
    height: interpolate(modeAnim.value, [0, 1], [weekBodyHeight, monthBodyHeight]),
  }));
  const weekStyle = useAnimatedStyle(() => ({
    opacity: interpolate(modeAnim.value, [0, 0.4], [1, 0], Extrapolation.CLAMP),
  }));
  const monthStyle = useAnimatedStyle(() => ({
    opacity: interpolate(modeAnim.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    if (!width) return;
    const cellWidth = width / 7;
    let x = 0;
    let y = 0;
    let visible = false;

    if (mode === "week") {
      const index = weekDays.findIndex((day) => toLocalDateKey(day) === activeKey);
      if (index >= 0) {
        visible = true;
        x = index * cellWidth + (cellWidth - INDICATOR_SIZE) / 2;
        y = DOW_ROW_HEIGHT + (WEEK_CELL_HEIGHT - INDICATOR_SIZE) / 2;
      }
    } else {
      const index = monthGrid.findIndex((day) => day && toLocalDateKey(day) === activeKey);
      if (index >= 0) {
        visible = true;
        x = (index % 7) * cellWidth + (cellWidth - INDICATOR_SIZE) / 2;
        y = DOW_ROW_HEIGHT + Math.floor(index / 7) * MONTH_CELL_HEIGHT + (MONTH_CELL_HEIGHT - INDICATOR_SIZE) / 2;
      }
    }

    // The indicator springs from wherever it currently is, so scrolling
    // through day boundaries slides it horizontally in the scroll direction.
    if (reduceMotion) {
      indicator.setValue({ x, y });
      indicatorOpacity.setValue(visible ? 1 : 0);
      return;
    }
    const movement = RNAnimated.spring(indicator, { toValue: { x, y }, damping: 20, stiffness: 240, mass: 0.8, useNativeDriver: true });
    const fade = RNAnimated.timing(indicatorOpacity, { toValue: visible ? 1 : 0, duration: 130, useNativeDriver: true });
    movement.start();
    fade.start();
    return () => {
      movement.stop();
      fade.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, mode, reduceMotion, width]);

  function shift(direction: 1 | -1) {
    if (mode === "week") {
      const target = clampDate(addDays(active, direction * 7), join, today);
      onSelectDate(toLocalDateKey(target));
      return;
    }
    const anchor = new Date(active.getFullYear(), active.getMonth() + direction, 1);
    const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const target = clampDate(new Date(anchor.getFullYear(), anchor.getMonth(), Math.min(active.getDate(), lastDay)), join, today);
    onSelectDate(toLocalDateKey(target));
  }

  const canGoBack =
    mode === "week"
      ? weekStart > startOfWeek(join)
      : active.getFullYear() * 12 + active.getMonth() > join.getFullYear() * 12 + join.getMonth();
  const canGoForward =
    mode === "week"
      ? addDays(weekStart, 6) < startOfWeek(today)
      : active.getFullYear() * 12 + active.getMonth() < today.getFullYear() * 12 + today.getMonth();

  const label =
    mode === "week"
      ? `${shortDate(weekDays[0])} – ${shortDate(weekDays[6])}`
      : active.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function renderCell(day: Date | null, cellHeight: number, key: string) {
    if (!day) return <View key={key} style={{ flex: 1, height: cellHeight }} />;
    const dayKey = toLocalDateKey(day);
    const inRange = dayKey >= joinKey && dayKey <= todayKey;
    const isActive = dayKey === activeKey;
    const isToday = dayKey === todayKey;

    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityLabel={`${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${isToday ? ", today" : ""}`}
        accessibilityState={{ disabled: !inRange, selected: isActive }}
        disabled={!inRange}
        onPress={() => {
          haptic();
          onSelectDate(dayKey);
        }}
        style={{ flex: 1, height: cellHeight, alignItems: "center", justifyContent: "center" }}
      >
        <View
          style={{
            width: INDICATOR_SIZE,
            height: INDICATOR_SIZE,
            borderRadius: INDICATOR_SIZE / 2,
            borderWidth: isToday && !isActive ? 2 : 0,
            borderColor: T.cyan,
            backgroundColor: isToday && !isActive ? `${T.cyan}14` : "transparent",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: isActive || isToday ? "900" : "700",
              color: isActive ? T.white : !inRange ? "#cfc6bc" : isToday ? T.cyan : T.dark,
              fontVariant: ["tabular-nums"]
            }}
          >
            {day.getDate()}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <CalendarNavButton icon="chevron-back" label={mode === "week" ? "Previous week" : "Previous month"} disabled={!canGoBack} onPress={() => shift(-1)} />
        <Text numberOfLines={1} style={{ flex: 1, marginHorizontal: 8, color: T.dark, fontSize: 14, fontWeight: "900", textAlign: "center" }}>{label}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <CalendarNavButton icon="chevron-forward" label={mode === "week" ? "Next week" : "Next month"} disabled={!canGoForward} onPress={() => shift(1)} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mode === "week" ? "Show month calendar" : "Show week calendar"}
            accessibilityState={{ selected: mode === "month" }}
            onPress={() => {
              haptic();
              onToggleMode();
            }}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 16,
              backgroundColor: mode === "month" ? `${T.blue}16` : T.white,
              borderWidth: 2,
              borderColor: mode === "month" ? T.blue : T.border,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.9 : 1 }]
            })}
          >
            <Ionicons name="calendar-outline" size={19} color={mode === "month" ? T.blue : T.muted} />
          </Pressable>
        </View>
      </View>

      <Animated.View
        style={[{ overflow: "hidden" }, calendarStyle]}
      >
        <RNAnimated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: INDICATOR_SIZE,
            height: INDICATOR_SIZE,
            borderRadius: INDICATOR_SIZE / 2,
            backgroundColor: T.blue,
            opacity: indicatorOpacity,
            transform: indicator.getTranslateTransform()
          }}
        />

        <View style={{ height: DOW_ROW_HEIGHT, flexDirection: "row" }}>
          {weekdayLabels.map((weekday, index) => (
            <Text
              key={`${weekday}-${index}`}
              style={{ flex: 1, color: T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.6, textAlign: "center", textTransform: "uppercase" }}
            >
              {weekday}
            </Text>
          ))}
        </View>

        <Animated.View pointerEvents={mode === "week" ? "auto" : "none"} style={weekStyle}>
          <View style={{ flexDirection: "row" }}>
            {weekDays.map((day, index) => renderCell(day, WEEK_CELL_HEIGHT, `week-${index}`))}
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents={mode === "month" ? "auto" : "none"}
          style={[
            {
            position: "absolute",
            top: DOW_ROW_HEIGHT,
            left: 0,
            right: 0,
            },
            monthStyle,
          ]}
        >
          {Array.from({ length: monthRows }, (_, row) => (
            <View key={`row-${row}`} style={{ flexDirection: "row" }}>
              {monthGrid.slice(row * 7, row * 7 + 7).map((day, column) => renderCell(day, MONTH_CELL_HEIGHT, `month-${row}-${column}`))}
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ── Day section pieces ───────────────────────────────────────────────────────

function ChapterDivider() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 24, marginBottom: 6 }}>
      <View style={{ flex: 1, height: 2, borderRadius: 99, backgroundColor: T.border }} />
      <Ionicons name="bookmark" size={11} color="#d3c9be" />
      <View style={{ flex: 1, height: 2, borderRadius: 99, backgroundColor: T.border }} />
    </View>
  );
}

function MoodSelector({ mood, editable, saving = false, onSelect }: { mood: JournalMood | null; editable: boolean; saving?: boolean; onSelect: (mood: JournalMood) => void }) {
  const selectedMood = moods.find((option) => option.key === mood) ?? null;

  return (
    <View
      style={{
        gap: 12,
        padding: 16,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderColor: selectedMood ? `${selectedMood.color}55` : T.border,
        backgroundColor: selectedMood ? `${selectedMood.color}0e` : "#fffaff"
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: T.dark, fontSize: 15, fontWeight: "900" }}>{editable ? "Today's mood" : "Mood"}</Text>
          <Text style={{ color: T.dark, fontSize: 12, fontWeight: "700" }}>{saving ? "Saving your mood…" : selectedMood ? selectedMood.description : editable ? "Choose what feels most like you" : "No mood recorded"}</Text>
        </View>
        {selectedMood ? <View style={{ borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: `${selectedMood.color}18` }}><Text style={{ color: selectedMood.color, fontSize: 11, fontWeight: "900" }}>{selectedMood.label}</Text></View> : null}
      </View>

      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        {moods.map((option) => {
          const selected = mood === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: !editable || saving }}
              accessibilityLabel={`${option.label}: ${option.description}`}
              disabled={!editable || saving}
              onPress={() => {
                haptic();
                onSelect(option.key);
              }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 80,
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                borderRadius: 18,
                backgroundColor: selected ? `${option.color}1d` : T.white,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? option.color : T.border,
                opacity: selected || (editable && !saving) ? 1 : 0.56,
                transform: [{ scale: pressed ? 0.96 : selected ? 1.03 : 1 }]
              })}
            >
              <View style={{ width: selected ? 50 : 38, height: selected ? 50 : 38, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: selected ? `${option.color}35` : "#f1efec" }}>
                <Text style={{ fontSize: selected ? 30 : 20 }}>{option.emoji}</Text>
              </View>
              <Text style={{ color: selected ? T.dark : T.muted, fontSize: 11, fontWeight: "900" }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function isDirectMediaUri(source: string) {
  return /^(?:https?:|file:|content:|ph:|asset:)/i.test(source);
}

function useResolvedMedia(items: JournalMediaItem[]) {
  const [resolvedItems, setResolvedItems] = useState<(JournalMediaItem & { uri: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const itemKey = items.map((item) => `${item.id}:${item.source}`).join("\u0001");

  useEffect(() => {
    let mounted = true;
    const directItems = items.filter((item) => isDirectMediaUri(item.source)).map((item) => ({ ...item, uri: item.source }));
    const remoteSources = [...new Set(items.filter((item) => !isDirectMediaUri(item.source)).map((item) => item.source))];
    setResolvedItems(directItems);
    setFailed(false);
    setLoading(remoteSources.length > 0);
    const load = remoteSources.length ? resolveJournalMedia(remoteSources) : Promise.resolve([] as string[]);
    load.then((urls) => {
      if (!mounted) return;
      const resolvedBySource = new Map(remoteSources.map((source, index) => [source, urls[index]]));
      setResolvedItems(items.flatMap((item) => {
        const uri = isDirectMediaUri(item.source) ? item.source : resolvedBySource.get(item.source);
        return uri ? [{ ...item, uri }] : [];
      }));
      setLoading(false);
    }).catch(() => {
      if (mounted) {
        setResolvedItems(directItems);
        setFailed(true);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [itemKey, reloadKey]);

  return { resolvedItems, loading, failed, retry: () => setReloadKey((key) => key + 1) };
}

function TodayMediaSection({ items, onOpenAlbum }: { items: JournalMediaItem[]; onOpenAlbum: () => void }) {
  const { resolvedItems, loading, failed, retry } = useResolvedMedia(items);

  if (!items.length) return null;
  const activeItem = resolvedItems[0] ?? null;

  return (
    <View style={{ gap: 9 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Today's media</Text>
        <Text style={{ color: T.muted, fontSize: 11, fontWeight: "800" }}>{items.length} photo{items.length === 1 ? "" : "s"}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open today's photos in your album" onPress={activeItem ? onOpenAlbum : failed ? retry : undefined} style={({ pressed }) => ({ height: 156, overflow: "hidden", borderRadius: radius.lg, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
        {activeItem ? <CachedImage uri={activeItem.uri} accessibilityLabel={`Photo from ${activeItem.questTitle}`} style={{ width: "100%", height: "100%" }} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 20 }}><Ionicons name={failed ? "cloud-offline-outline" : "images-outline"} size={24} color={T.muted} /><Text style={{ color: T.dark, fontSize: 12, fontWeight: "800", textAlign: "center" }}>{failed ? "Couldn't load today's photos. Tap to retry." : loading ? "Preparing today's photo…" : "No photos are ready yet."}</Text></View>}
        {activeItem ? <View pointerEvents="none" style={{ position: "absolute", left: 10, right: 10, bottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(39,34,35,0.66)" }}><Text numberOfLines={1} style={{ color: T.white, fontSize: 11, fontWeight: "900" }}>{activeItem.questTitle}</Text></View>
          <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.92)" }}><Ionicons name="grid-outline" size={16} color={T.dark} /></View>
        </View> : null}
      </Pressable>
      {resolvedItems.length > 1 ? <Text style={{ color: T.dark, fontSize: 11, fontWeight: "800", textAlign: "center" }}>{resolvedItems.length} photos in today’s album</Text> : null}
    </View>
  );
}

type AlbumQuestGroup = { questTitle: string; dateKey: string; items: JournalMediaItem[] };

function AlbumQuestGroupCard({ quest, onManageItem }: { quest: AlbumQuestGroup; onManageItem: (item: JournalMediaItem) => void }) {
  const { resolvedItems, loading, failed, retry } = useResolvedMedia(quest.items);
  const todayKey = toLocalDateKey(new Date());
  const yesterdayKey = toLocalDateKey(addDays(new Date(), -1));
  const displayDate = quest.dateKey === todayKey ? "Today" : quest.dateKey === yesterdayKey ? "Yesterday" : parseKey(quest.dateKey).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}><Text numberOfLines={1} style={{ flexShrink: 1, color: T.dark, fontSize: 15, lineHeight: 20, fontWeight: "900" }}>{quest.questTitle}</Text><Text numberOfLines={1} style={{ color: T.dark, fontSize: 11, lineHeight: 16, fontWeight: "700" }}>· {displayDate}</Text></View>
    {resolvedItems.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{resolvedItems.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Manage photo from ${item.questTitle}`} onPress={() => onManageItem(item)} style={({ pressed }) => ({ width: "23.2%", aspectRatio: 1, overflow: "hidden", borderRadius: 13, backgroundColor: T.border, opacity: pressed ? 0.78 : 1 })}><CachedImage uri={item.uri} accessibilityLabel={`Photo from ${item.questTitle}`} style={{ width: "100%", height: "100%" }} /><View pointerEvents="none" style={{ position: "absolute", top: 5, right: 5, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.9)" }}><Ionicons name="ellipsis-horizontal" size={15} color={T.dark} /></View></Pressable>)}</View> : <Pressable accessibilityRole="button" accessibilityLabel={failed ? `Retry photos from ${quest.questTitle}` : `Loading photos from ${quest.questTitle}`} disabled={!failed} onPress={retry} style={{ minHeight: 74, borderRadius: 16, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.white, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }}><Text style={{ color: T.dark, fontSize: 12, fontWeight: "800", textAlign: "center" }}>{failed ? "Photos unavailable — tap to retry" : loading ? "Loading photos…" : "No photos available"}</Text></Pressable>}
  </View>;
}

function JournalAlbum({ items, onExplore, onManageItem, contentWidth, horizontalPadding, safeAreaOffset, bottomInset }: { items: JournalMediaItem[]; onExplore: () => void; onManageItem: (item: JournalMediaItem) => void; contentWidth: number; horizontalPadding: number; safeAreaOffset: number; bottomInset: number }) {
  const grouped = items.reduce<Record<string, AlbumQuestGroup>>((groups, item) => {
    const key = `${item.dateKey}\u0001${item.questTitle}`;
    (groups[key] ??= { questTitle: item.questTitle, dateKey: item.dateKey, items: [] }).items.push(item);
    return groups;
  }, {});
  const quests = Object.values(grouped).sort((a, b) => b.dateKey.localeCompare(a.dateKey) || a.questTitle.localeCompare(b.questTitle));

  return <FlatList data={quests} keyExtractor={(quest) => `${quest.dateKey}-${quest.questTitle}`} style={{ flex: 1 }} removeClippedSubviews windowSize={5} initialNumToRender={4} maxToRenderPerBatch={4} updateCellsBatchingPeriod={80} contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomInset + 112, gap: 20 }} ListEmptyComponent={<View style={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }}><Card style={{ borderRadius: radius.xl }}><EmptyState emoji="📷" title="Your album is waiting" body="Finish a quest with a photo and it will become part of your journal album." action={<SoftButton label="Explore quests" icon="compass" color={T.blue} onPress={onExplore} />} /></Card></View>} renderItem={({ item }) => <View style={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }}><AlbumQuestGroupCard quest={item} onManageItem={onManageItem} /></View>} />;
}

function DayStatStrip({ questCount, xp, minutes }: { questCount: number; xp: number; minutes: number }) {
  const cells = [
    { label: "Quests", value: `${questCount}` },
    { label: "XP Earned", value: `+${xp}` },
    { label: "Time · Est.", value: formatMinutes(minutes) }
  ];

  return (
    <View
      style={{
        minHeight: 64,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.white,
        flexDirection: "row",
        overflow: "hidden"
      }}
    >
      {cells.map((cell, index) => (
        <View key={cell.label} style={{ flex: 1, flexDirection: "row" }}>
          {index > 0 ? <View style={{ width: 1, marginVertical: 13, backgroundColor: T.border }} /> : null}
          <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center", gap: 3 }}>
            <Text style={{ color: T.dark, fontSize: 10, lineHeight: 13, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" }}>
              {cell.label}
            </Text>
            <Text style={{ color: questCount === 0 ? T.muted : T.dark, fontSize: 18, lineHeight: 24, fontWeight: "900", fontVariant: ["tabular-nums"] }} numberOfLines={1}>
              {cell.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function MemoryCard({ memory, onPress }: { memory: JournalMemory; onPress: () => void }) {
  const accentColor = typeof memory.color === "string" && memory.color.trim() ? memory.color : T.blue;
  const cat = categoryColor[memory.category] ?? { text: accentColor, bg: `${accentColor}18` };
  const diff = difficultyColor[memory.difficulty] ?? difficultyColor.MEDIUM;

  return (
    <Card pressable onPress={onPress} style={{ minHeight: 166, borderRadius: 24, overflow: "hidden", padding: 0, boxShadow: `4px 4px 0px ${T.border}` }}>
      <View style={{ flexDirection: "row", flex: 1 }}>
        <View style={{ width: 5, backgroundColor: accentColor }} />
        <View style={{ flex: 1, padding: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <View style={{ flex: 1, minWidth: 0, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Tag label={memory.category} color={cat.text} bg={cat.bg} />
              <Tag label={memory.difficulty} color={diff.text} bg={diff.bg} />
            </View>
            <View accessibilityLabel={`Completed at ${formatTime(memory.completedAt)}`} style={{ minHeight: 32, borderRadius: 16, paddingHorizontal: 9, backgroundColor: `${accentColor}14`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <Ionicons name="time-outline" size={13} color={accentColor} />
              <Text style={{ color: accentColor, fontSize: 11, lineHeight: 15, fontWeight: "900" }}>{formatTime(memory.completedAt)}</Text>
            </View>
          </View>

          <Text style={{ color: T.dark, fontSize: 18, lineHeight: 23, fontWeight: "900" }} numberOfLines={2}>{memory.title}</Text>
          <Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }} numberOfLines={2}>
            {memory.reflection ? `“${memory.reflection}”` : "No reflection saved for this quest yet."}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: `${T.blue}14` }}>
                <Ionicons name="flash" size={12} color={T.blue} />
                <Text style={{ color: T.blue, fontSize: 12, lineHeight: 16, fontWeight: "900" }}>+{memory.xp} XP</Text>
              </View>
              <AvatarPile people={memory.participants} />
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.muted} />
          </View>
        </View>
      </View>
    </Card>
  );
}

function ActiveQuestJournalCard({ quest, onPress }: { quest: JournalActiveQuest; onPress: () => void }) {
  const category = categoryColor[quest.category] ?? { text: quest.color, bg: `${quest.color}18` };
  const difficulty = difficultyColor[quest.difficulty];
  return <Card pressable onPress={onPress} style={{ borderRadius: radius.lg, borderColor: `${T.blue}55`, backgroundColor: `${T.blue}0b`, gap: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 }}><Tag label={quest.category} color={category.text} bg={category.bg} /><Tag label={quest.difficulty} color={difficulty.text} bg={difficulty.bg} /></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: `${T.blue}18` }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: T.blue }} /><Text style={{ color: T.blue, fontSize: 11, fontWeight: "900" }}>Active</Text></View>
    </View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: `${T.blue}18` }}><Ionicons name="navigate" size={18} color={T.blue} /></View><View style={{ flex: 1, gap: 2 }}><Text style={{ color: T.dark, fontSize: 16, lineHeight: 21, fontWeight: "900" }} numberOfLines={1}>{quest.title}</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>Tap to continue your active quest</Text></View><Ionicons name="arrow-forward" size={17} color={T.blue} /></View>
  </Card>;
}

function EmptyDayCard({ isToday, onExplore }: { isToday: boolean; onExplore: () => void }) {
  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: 2,
        borderStyle: "dashed",
        borderColor: T.border,
        alignItems: "center",
        paddingVertical: 22,
        paddingHorizontal: 22,
        gap: 8
      }}
    >
      <Text style={{ fontSize: 26 }}>{isToday ? "🌤️" : "🍃"}</Text>
      <Text style={{ color: T.dark, fontSize: 15, lineHeight: 20, fontWeight: "900", textAlign: "center" }}>
        {isToday ? "No quests yet today" : "A quiet day"}
      </Text>
      <Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "600", textAlign: "center", maxWidth: 270 }}>
        {isToday
          ? "That's okay — a small quest still counts, and tomorrow works too."
          : "No quests this day. Every good story has quiet chapters."}
      </Text>
      {isToday ? <SoftButton label="Find a quest" icon="compass-outline" inverse color={T.blue} onPress={onExplore} style={{ marginTop: 4 }} /> : null}
    </View>
  );
}

function DaySection({
  dayNumber,
  date,
  isToday,
  entry,
  memories,
  todayMediaItems,
  activeQuest,
  isLast,
  savingEntry,
  onEditTitle,
  onSelectMood,
  onOpenMemory,
  onOpenActiveQuest,
  onOpenAlbum,
  onExplore
}: {
  dayNumber: number;
  date: Date;
  isToday: boolean;
  entry: JournalEntry | null;
  memories: JournalMemory[];
  todayMediaItems: JournalMediaItem[];
  activeQuest: JournalActiveQuest | null;
  isLast: boolean;
  savingEntry: boolean;
  onEditTitle: () => void;
  onSelectMood: (mood: JournalMood) => void;
  onOpenMemory: (memory: JournalMemory) => void;
  onOpenActiveQuest: () => void;
  onOpenAlbum: () => void;
  onExplore: () => void;
}) {
  const editable = isToday;
  const customTitle = entry?.title?.trim();
  const milestone = milestoneLabels[dayNumber];
  const xp = memories.reduce((sum, memory) => sum + memory.xp, 0);
  const minutes = memories.reduce((sum, memory) => sum + memory.timeMin, 0);
  const hasDayContent = Boolean(entry?.title || entry?.mood || memories.length || activeQuest);
  const dateLabel = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <View style={{ gap: 14, paddingTop: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{ color: customTitle || editable ? T.dark : T.muted, fontSize: 20, lineHeight: 25, fontWeight: "900", flexShrink: 1 }}
              numberOfLines={2}
            >
              Day {dayNumber}
              {customTitle ? `: ${customTitle}` : ""}
            </Text>
            {editable ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit today's chapter title"
                onPress={() => {
                  haptic();
                  onEditTitle();
                }}
                hitSlop={10}
                style={({ pressed }) => ({
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: `${T.blue}14`,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ scale: pressed ? 0.88 : 1 }]
                })}
              >
                <Ionicons name="pencil" size={14} color={T.blue} />
              </Pressable>
            ) : null}
          </View>
          <Text style={{ color: T.dark, fontSize: 12, lineHeight: 16, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" }}>
            {dateLabel}
          </Text>
        </View>
      </View>

      {(editable || entry?.mood) ? <MoodSelector mood={entry?.mood ?? null} editable={editable} saving={savingEntry} onSelect={onSelectMood} /> : null}

      {milestone ? (
        <View style={{ flexDirection: "row" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(254,228,64,0.22)", borderWidth: 1.5, borderColor: "rgba(254,228,64,0.55)" }}>
            <Ionicons name="sparkles" size={12} color={T.orange} />
            <Text style={{ color: T.dark, fontSize: 11, fontWeight: "900" }}>{milestone}</Text>
          </View>
        </View>
      ) : null}

      {memories.length ? <DayStatStrip questCount={memories.length} xp={xp} minutes={minutes} /> : null}

      {isToday ? <TodayMediaSection items={todayMediaItems} onOpenAlbum={onOpenAlbum} /> : null}

      {activeQuest ? <View style={{ gap: 8 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>In progress</Text><ActiveQuestJournalCard quest={activeQuest} onPress={onOpenActiveQuest} /></View> : null}

      {memories.length ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Memories</Text>
          {memories.map((memory) => (
            <MemoryCard key={memory.completionId} memory={memory} onPress={() => onOpenMemory(memory)} />
          ))}
        </View>
      ) : !memories.length && !activeQuest ? (
        isToday ? <EmptyDayCard isToday onExplore={onExplore} /> : !hasDayContent ? <View style={{ minHeight: 52, paddingHorizontal: 14, borderRadius: 16, backgroundColor: `${T.dark}08`, justifyContent: "center" }}><Text style={{ color: T.dark, fontSize: 13, fontWeight: "700" }}>A quiet day in your story.</Text></View> : null
      ) : null}

      {!isLast ? <ChapterDivider /> : null}
    </View>
  );
}

function BeforeJoinMarker({ joinDate }: { joinDate: Date }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 30, gap: 5 }}>
      <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800", textAlign: "center" }}>✦ You weren't here yet ✦</Text>
      <Text style={{ color: T.muted, fontSize: 11, fontWeight: "600", textAlign: "center", opacity: 0.8 }}>
        Your story starts on Day 1 — {joinDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
      </Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export type JournalScreenPreview = { data: JournalData; todayKey: string };

export function JournalScreen({ preview }: { preview?: JournalScreenPreview } = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();
  const { markJournalRead } = useNotifications();
  const { snapshot: activeQuestSnapshot } = useActiveQuest();

  const [tab, setTab] = useState<JournalTab>("journal");
  const [mode, setMode] = useState<CalendarMode>("week");
  const [data, setData] = useState<JournalData | null>(preview?.data ?? null);
  const [entries, setEntries] = useState<Record<string, JournalEntry>>(preview?.data.entriesByDate ?? {});
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState<string | null>(null);

  const [todayKey, setTodayKey] = useState(() => preview?.todayKey ?? toLocalDateKey(new Date()));
  const [activeKey, setActiveKey] = useState(todayKey);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingEntryDates, setSavingEntryDates] = useState<Set<string>>(() => new Set());

  const journalListRef = useRef<FlatList<string>>(null);
  const activeKeyRef = useRef(activeKey);
  const previousTodayKey = useRef(todayKey);
  const journalLoadId = useRef(0);
  const hasLoadedJournal = useRef(false);
  const savingEntryDatesRef = useRef(new Set<string>());
  const pendingCalendarTargetRef = useRef<string | null>(null);
  const calendarScrollRetryCountRef = useRef(0);

  // The inline media shelf is explicitly for the current local calendar day.
  // Refresh this key at midnight so those captures move to Album without a
  // reload while the journal remains open.
  useEffect(() => {
    if (preview) return;
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(() => setTodayKey(toLocalDateKey(new Date())), Math.max(1_000, nextMidnight.getTime() - now.getTime() + 150));
    return () => clearTimeout(timer);
  }, [preview, todayKey]);

  useEffect(() => {
    // If the user had today's entry open at midnight, keep them on the new
    // current day rather than leaving the Journal seemingly one day behind.
    if (activeKeyRef.current === previousTodayKey.current) {
      activeKeyRef.current = todayKey;
      setActiveKey(todayKey);
    }
    previousTodayKey.current = todayKey;
  }, [todayKey]);

  const load = useCallback(async (showLoading = !hasLoadedJournal.current) => {
    if (preview) {
      setData(preview.data);
      setEntries(preview.data.entriesByDate);
      setLoading(false);
      return;
    }
    const requestId = ++journalLoadId.current;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const journal = await fetchJournalData();
      if (requestId !== journalLoadId.current) return;
      setData(journal);
      setEntries((current) => {
        const merged = { ...journal.entriesByDate };
        for (const key of savingEntryDatesRef.current) {
          if (current[key]) merged[key] = current[key];
        }
        return merged;
      });
      hasLoadedJournal.current = true;
    } catch (nextError) {
      if (requestId !== journalLoadId.current) return;
      setError(nextError instanceof Error ? nextError.message : "Unable to load your journal.");
    } finally {
      if (requestId === journalLoadId.current) setLoading(false);
    }
  }, [preview]);

  useFocusEffect(
    useCallback(() => {
      if (preview) return;
      void load();
      void markJournalRead();
      return () => { journalLoadId.current += 1; };
    }, [load, markJournalRead, preview])
  );

  const joinKey = useMemo(() => {
    if (!data) return todayKey;
    const join = toLocalDateKey(startOfDay(new Date(data.joinedAt)));
    return join <= todayKey ? join : todayKey;
  }, [data, todayKey]);

  // Newest day first: the journal opens on today, and scrolling down reads
  // backwards through the archive — so scrolling down moves the calendar
  // indicator toward earlier dates, matching "past is behind you".
  const dayKeys = useMemo(() => {
    const keys: string[] = [];
    const join = parseKey(joinKey);
    for (let day = parseKey(todayKey); day >= join; day = addDays(day, -1)) {
      keys.push(toLocalDateKey(day));
    }
    return keys;
  }, [joinKey, todayKey]);

  const albumItems = useMemo<JournalMediaItem[]>(() => {
    const completedMedia = Object.entries(data?.memoriesByDate ?? {}).flatMap(([dateKey, memories]) => memories.flatMap((memory) => memory.photoPaths.map((source, index) => ({
      id: `memory-${memory.completionId}-${index}`,
      source,
      dateKey,
      questTitle: memory.title,
      completionId: memory.completionId,
    }))));
    const activeMedia = (activeQuestSnapshot?.photos ?? []).map((photo) => ({
      id: `active-${photo.id}`,
      source: photo.uri,
      dateKey: toLocalDateKey(new Date(photo.capturedAt)),
      questTitle: data?.activeQuest?.title ?? "Active quest",
      activePhotoId: photo.id,
    }));
    return [...activeMedia, ...completedMedia];
  }, [activeQuestSnapshot?.photos, data?.activeQuest?.title, data?.memoriesByDate]);

  const todayMediaItems = useMemo(() => albumItems.filter((item) => item.dateKey === todayKey), [albumItems, todayKey]);

  function scrollToDay(key: string) {
    const index = dayKeys.indexOf(key);
    if (index < 0) return;
    pendingCalendarTargetRef.current = key;
    calendarScrollRetryCountRef.current = 0;
    journalListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
  }

  function handleSelectDate(key: string) {
    activeKeyRef.current = key;
    setActiveKey(key);
    scrollToDay(key);
  }

  async function saveEntry(key: string, patch: { title?: string | null; mood?: JournalMood }) {
    if (savingEntryDatesRef.current.has(key)) return false;
    savingEntryDatesRef.current.add(key);
    setSavingEntryDates(new Set(savingEntryDatesRef.current));
    const previous = entries[key] ?? null;
    const next: JournalEntry = {
      entryDate: key,
      title: patch.title !== undefined ? patch.title : previous?.title ?? null,
      mood: patch.mood !== undefined ? patch.mood : previous?.mood ?? null
    };
    setEntries((current) => ({ ...current, [key]: next }));

    try {
      await upsertJournalEntry({ entryDate: key, ...patch });
      return true;
    } catch (nextError) {
      setEntries((current) => {
        const reverted = { ...current };
        if (previous) reverted[key] = previous;
        else delete reverted[key];
        return reverted;
      });
      Alert.alert("Couldn't save", nextError instanceof Error ? nextError.message : "Your change didn't save. Try again.");
      return false;
    } finally {
      savingEntryDatesRef.current.delete(key);
      setSavingEntryDates(new Set(savingEntryDatesRef.current));
    }
  }

  function openTitleEditor() {
    setTitleDraft(entries[todayKey]?.title ?? "");
    setEditingTitle(true);
  }

  const goExplore = () => router.push("/explore");
  const manageAlbumItem = (item: JournalMediaItem) => {
    if (item.completionId) router.push(`/memory/${item.completionId}`);
    else if (item.activePhotoId) router.push("/active-quest");
  };
  const join = parseKey(joinKey);

  const renderDay = useCallback(({ item: key, index }: ListRenderItemInfo<string>) => {
    const date = parseKey(key);
    const dayNumber = Math.round((date.getTime() - join.getTime()) / 86400000) + 1;
    const memories = data?.memoriesByDate[key] ?? [];
    const activeQuest = data?.activeQuest && toLocalDateKey(new Date(data.activeQuest.startedAt)) === key ? data.activeQuest : null;
    return <View style={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }}>
      <DaySection
        dayNumber={dayNumber}
        date={date}
        isToday={key === todayKey}
        entry={entries[key] ?? null}
        memories={memories}
        todayMediaItems={todayMediaItems}
        activeQuest={activeQuest}
        isLast={index === dayKeys.length - 1}
        savingEntry={savingEntryDates.has(key)}
        onEditTitle={openTitleEditor}
        onSelectMood={(mood) => void saveEntry(key, { mood })}
        onOpenMemory={(memory) => router.push(`/memory/${memory.completionId}`)}
        onOpenActiveQuest={() => router.push("/active-quest")}
        onOpenAlbum={() => setTab("album")}
        onExplore={goExplore}
      />
    </View>;
  }, [contentWidth, data?.activeQuest, data?.memoriesByDate, dayKeys.length, entries, goExplore, horizontalPadding, join, router, safeAreaOffset, savingEntryDates, todayKey, todayMediaItems]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: string | null; isViewable: boolean }> }) => {
    const pendingTarget = pendingCalendarTargetRef.current;
    if (pendingTarget) {
      const targetIsVisible = viewableItems.some((item) => item.isViewable && item.item === pendingTarget);
      if (!targetIsVisible) return;
      pendingCalendarTargetRef.current = null;
      calendarScrollRetryCountRef.current = 0;
    }
    const key = viewableItems.find((item) => item.isViewable && item.item)?.item;
    if (key && key !== activeKeyRef.current) {
      activeKeyRef.current = key;
      setActiveKey(key);
    }
  }).current;
  const journalViewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;

  return (
    <Screen scroll={false} padded={false} contentStyle={{ paddingTop: Math.max(insets.top - 12, 12) }}>
      <View style={{ flex: 1 }}>
        <View style={{ alignItems: "center" }}>
          <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, gap: 8, paddingBottom: 8, transform: [{ translateX: safeAreaOffset }] }}>
            <Entrance><JournalHeader tab={tab} /></Entrance>
            <Entrance delay={40}><JournalTabs activeTab={tab} onChange={setTab} /></Entrance>
          </View>
        </View>

        {tab === "journal" ? <>
          <View style={{ backgroundColor: T.bg, alignItems: "center", borderBottomWidth: 1, borderBottomColor: T.border, paddingBottom: 8 }}>
            <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }}>
              <JournalCalendar mode={mode} onToggleMode={() => setMode((value) => (value === "week" ? "month" : "week"))} activeKey={activeKey} todayKey={todayKey} joinKey={joinKey} onSelectDate={handleSelectDate} />
            </View>
          </View>
          <FlatList
            ref={journalListRef}
            data={loading && !data ? [] : dayKeys}
            keyExtractor={(key) => key}
            renderItem={renderDay}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            updateCellsBatchingPeriod={80}
            windowSize={5}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={journalViewabilityConfig}
            onScrollBeginDrag={() => {
              // A manual gesture takes precedence over a still-pending calendar jump.
              pendingCalendarTargetRef.current = null;
              calendarScrollRetryCountRef.current = 0;
            }}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              const key = dayKeys[index];
              if (!key || pendingCalendarTargetRef.current !== key) return;
              calendarScrollRetryCountRef.current += 1;
              if (calendarScrollRetryCountRef.current > 3) {
                pendingCalendarTargetRef.current = null;
                return;
              }
              journalListRef.current?.scrollToOffset({ offset: Math.max(0, index * Math.max(averageItemLength, 1)), animated: false });
              setTimeout(() => {
                if (pendingCalendarTargetRef.current === key) {
                  journalListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
                }
              }, 60);
            }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
            ListHeaderComponent={error && data ? <View style={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, paddingTop: 14, transform: [{ translateX: safeAreaOffset }] }}><Card style={{ borderRadius: radius.lg, padding: 14, gap: 8 }}><Text style={{ color: T.dark, fontSize: 13, fontWeight: "800" }}>Your latest journal refresh didn’t finish.</Text><SoftButton label="Try again" icon="refresh" inverse color={T.blue} onPress={() => void load(true)} style={{ minHeight: 48 }} /></Card></View> : null}
            ListEmptyComponent={<View style={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }}>{loading ? <JournalLoadingSkeleton /> : <Card style={{ marginTop: 18, borderRadius: radius.lg }}><EmptyState emoji="!" title="Couldn't load your journal" body={error ?? "Please try again."} action={<SoftButton label="Try again" icon="refresh" onPress={() => void load(true)} />} /></Card>}</View>}
            ListFooterComponent={data && !loading ? <View style={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }}><BeforeJoinMarker joinDate={join} /></View> : null}
          />
        </> : <JournalAlbum items={albumItems} onExplore={goExplore} onManageItem={manageAlbumItem} contentWidth={contentWidth} horizontalPadding={horizontalPadding} safeAreaOffset={safeAreaOffset} bottomInset={insets.bottom} />}
      </View>

      <Sheet visible={editingTitle} onClose={() => setEditingTitle(false)}>
        <View style={{ padding: 24, gap: 14 }}>
          <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900" }}>Name today's chapter</Text>
          <Text style={{ color: T.muted, fontWeight: "600", fontSize: 13, lineHeight: 19 }}>
            Give today a title you'll want to reread. You can change it until midnight.
          </Text>
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            placeholder="The sweet memories"
            placeholderTextColor={T.muted}
            maxLength={60}
            style={{ height: 48, borderWidth: 2, borderColor: T.border, borderRadius: 18, paddingHorizontal: 14, color: T.dark, fontWeight: "800", backgroundColor: T.bg }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save chapter title"
            accessibilityState={{ disabled: savingEntryDates.has(todayKey) }}
            disabled={savingEntryDates.has(todayKey)}
            onPress={() => { void saveEntry(todayKey, { title: titleDraft.trim() || null }).then((saved) => { if (saved) setEditingTitle(false); }); }}
            style={({ pressed }) => ({
              minHeight: 58,
              borderRadius: 20,
              backgroundColor: savingEntryDates.has(todayKey) ? T.border : T.blue,
              borderBottomWidth: 6,
              borderBottomColor: savingEntryDates.has(todayKey) ? "#d7cec2" : "#258fd8",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: savingEntryDates.has(todayKey) ? 0.6 : 1,
              transform: [{ translateY: pressed && !savingEntryDates.has(todayKey) ? 3 : 0 }]
            })}
          >
            <Ionicons name="checkmark" size={19} color={T.white} />
            <Text style={{ color: T.white, fontSize: 15, fontWeight: "900", letterSpacing: 0.55, textTransform: "uppercase" }}>
              {savingEntryDates.has(todayKey) ? "Saving…" : "Save title"}
            </Text>
          </Pressable>
        </View>
      </Sheet>
    </Screen>
  );
}
