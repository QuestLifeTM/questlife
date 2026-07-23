import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Image,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AvatarPile } from "@/components/avatar-pile";
import { StreakPill } from "@/components/streak-pill";
import { categoryColor, difficultyColor, radius, T } from "@/components/theme";
import { Card, EmptyState, Entrance, Header, IconButton, Screen, Sheet, SoftButton, Tag, haptic, useResponsiveScreenLayout } from "@/components/ui";
import { fetchJournalData, resolveJournalMedia, toLocalDateKey, upsertJournalEntry } from "@/services/journal/journalService";
import { useActiveQuest } from "@/contexts/ActiveQuestContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { JournalActiveQuest, JournalData, JournalEntry, JournalMemory, JournalMood, PartyJournalCard } from "@/types/journal";

type JournalTab = "journal" | "album";
type CalendarMode = "week" | "month";
type PartyDayCollection = { party: PartyJournalCard; dateKey: string };
type JournalMediaItem = { id: string; source: string; dateKey: string; questTitle: string };

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

// ── Animated text swap (crossfade + slight vertical slide) ───────────────────

function SwapText({ text, style, numberOfLines }: { text: string; style: StyleProp<TextStyle>; numberOfLines?: number }) {
  const [displayed, setDisplayed] = useState(text);
  const opacity = useRef(new Animated.Value(1)).current;
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (text === displayed) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(y, { toValue: -6, duration: 110, useNativeDriver: true })
    ]).start(() => {
      setDisplayed(text);
      y.setValue(7);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(y, { toValue: 0, damping: 18, stiffness: 220, mass: 0.7, useNativeDriver: true })
      ]).start();
    });
  }, [text, displayed, opacity, y]);

  return (
    <Animated.Text numberOfLines={numberOfLines} style={[style, { opacity, transform: [{ translateY: y }] }]}>
      {displayed}
    </Animated.Text>
  );
}

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
      titleContent={<SwapText text={title} numberOfLines={1} style={{ color: T.dark, fontSize: 30, lineHeight: 36, fontWeight: "900" }} />}
      subtitleContent={
        <SwapText
          text={subtitle}
          numberOfLines={1}
          style={{ color: T.muted, fontSize: 13, lineHeight: 18, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase", marginTop: 2 }}
        />
      }
      right={<StreakPill />}
      animated={false}
    />
  );
}

function JournalTabs({ activeTab, onChange }: { activeTab: JournalTab; onChange: (tab: JournalTab) => void }) {
  return (
    <View style={{ flexDirection: "row", padding: 5, borderRadius: 28, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }}>
      {(["journal", "album"] as JournalTab[]).map((tab) => {
        const isActive = activeTab === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => {
              if (isActive) return;
              haptic();
              onChange(tab);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 42,
              borderRadius: 22,
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

// ── Calendar (week/month, animated mode change, scroll-linked indicator) ─────

const DOW_ROW_HEIGHT = 20;
const WEEK_CELL_HEIGHT = 48;
const MONTH_CELL_HEIGHT = 40;
const INDICATOR_SIZE = 34;

function getMonthGrid(anchor: Date): (Date | null)[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const grid: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i += 1) grid.push(null);
  for (let day = 1; day <= last.getDate(); day += 1) grid.push(new Date(anchor.getFullYear(), anchor.getMonth(), day));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function CalendarNavButton({ icon, disabled, onPress }: { icon: keyof typeof Ionicons.glyphMap; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: T.white,
        borderWidth: 2,
        borderColor: T.border,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : 1,
        transform: [{ scale: pressed ? 0.9 : 1 }]
      })}
    >
      <Ionicons name={icon} size={15} color={T.muted} />
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
  const [width, setWidth] = useState(0);
  const active = parseKey(activeKey);
  const join = parseKey(joinKey);
  const today = parseKey(todayKey);
  const weekStart = startOfWeek(active);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthGrid = getMonthGrid(active);
  const monthRows = monthGrid.length / 7;

  const modeAnim = useRef(new Animated.Value(mode === "week" ? 0 : 1)).current;
  const indicator = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const indicatorOpacity = useRef(new Animated.Value(0)).current;

  const weekBodyHeight = DOW_ROW_HEIGHT + WEEK_CELL_HEIGHT;
  const monthBodyHeight = DOW_ROW_HEIGHT + monthRows * MONTH_CELL_HEIGHT;

  useEffect(() => {
    Animated.timing(modeAnim, { toValue: mode === "week" ? 0 : 1, duration: 260, useNativeDriver: false }).start();
  }, [mode, modeAnim]);

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
    Animated.spring(indicator, { toValue: { x, y }, damping: 20, stiffness: 240, mass: 0.8, useNativeDriver: true }).start();
    Animated.timing(indicatorOpacity, { toValue: visible ? 1 : 0, duration: 130, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, mode, width]);

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
        <CalendarNavButton icon="chevron-back" disabled={!canGoBack} onPress={() => shift(-1)} />
        <Text style={{ color: T.dark, fontSize: 14, fontWeight: "900" }}>{label}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <CalendarNavButton icon="chevron-forward" disabled={!canGoForward} onPress={() => shift(1)} />
          <Pressable
            onPress={() => {
              haptic();
              onToggleMode();
            }}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: mode === "month" ? `${T.blue}16` : T.white,
              borderWidth: 2,
              borderColor: mode === "month" ? T.blue : T.border,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.9 : 1 }]
            })}
          >
            <Ionicons name="calendar-outline" size={15} color={mode === "month" ? T.blue : T.muted} />
          </Pressable>
        </View>
      </View>

      <Animated.View
        style={{
          height: modeAnim.interpolate({ inputRange: [0, 1], outputRange: [weekBodyHeight, monthBodyHeight] }),
          overflow: "hidden"
        }}
      >
        <Animated.View
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

        <Animated.View pointerEvents={mode === "week" ? "auto" : "none"} style={{ opacity: modeAnim.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: "clamp" }) }}>
          <View style={{ flexDirection: "row" }}>
            {weekDays.map((day, index) => renderCell(day, WEEK_CELL_HEIGHT, `week-${index}`))}
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents={mode === "month" ? "auto" : "none"}
          style={{
            position: "absolute",
            top: DOW_ROW_HEIGHT,
            left: 0,
            right: 0,
            opacity: modeAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: "clamp" })
          }}
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

function MoodSelector({ mood, editable, onSelect }: { mood: JournalMood | null; editable: boolean; onSelect: (mood: JournalMood) => void }) {
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
          <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>{selectedMood ? selectedMood.description : editable ? "Choose what feels most like you" : "No mood recorded"}</Text>
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
              accessibilityState={{ checked: selected, disabled: !editable }}
              accessibilityLabel={`${option.label}: ${option.description}`}
              disabled={!editable}
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
                opacity: selected || editable ? 1 : 0.56,
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
  const itemKey = items.map((item) => `${item.id}:${item.source}`).join("\u0001");

  useEffect(() => {
    let mounted = true;
    const remoteSources = items.filter((item) => !isDirectMediaUri(item.source)).map((item) => item.source);
    const load = remoteSources.length ? resolveJournalMedia(remoteSources) : Promise.resolve([] as string[]);
    load.then((urls) => {
      if (!mounted) return;
      const resolvedBySource = new Map(remoteSources.map((source, index) => [source, urls[index]]));
      setResolvedItems(items.flatMap((item) => {
        const uri = isDirectMediaUri(item.source) ? item.source : resolvedBySource.get(item.source);
        return uri ? [{ ...item, uri }] : [];
      }));
    }).catch(() => {
      if (mounted) setResolvedItems(items.filter((item) => isDirectMediaUri(item.source)).map((item) => ({ ...item, uri: item.source })));
    });
    return () => { mounted = false; };
  }, [itemKey]);

  return resolvedItems;
}

function TodayMediaSection({ items, onOpenAlbum }: { items: JournalMediaItem[]; onOpenAlbum: () => void }) {
  const resolvedItems = useResolvedMedia(items);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
    if (resolvedItems.length < 2) return;
    const timer = setInterval(() => setActiveIndex((index) => (index + 1) % resolvedItems.length), 3_800);
    return () => clearInterval(timer);
  }, [resolvedItems.length]);

  if (!items.length) return null;
  const activeItem = resolvedItems[activeIndex] ?? null;

  return (
    <View style={{ gap: 9 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Today's media</Text>
        <Text style={{ color: T.muted, fontSize: 11, fontWeight: "800" }}>{items.length} photo{items.length === 1 ? "" : "s"}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open today's photos in your album" onPress={onOpenAlbum} style={({ pressed }) => ({ height: 156, overflow: "hidden", borderRadius: radius.lg, borderWidth: 1.5, borderColor: T.border, backgroundColor: "#eee9e2", transform: [{ scale: pressed ? 0.985 : 1 }] })}>
        {activeItem ? <Image source={{ uri: activeItem.uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 7 }}><Ionicons name="images-outline" size={24} color={T.muted} /><Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>Preparing today's photo…</Text></View>}
        <View style={{ position: "absolute", left: 10, right: 10, bottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(39,34,35,0.66)" }}><Text numberOfLines={1} style={{ color: T.white, fontSize: 11, fontWeight: "900" }}>{activeItem?.questTitle ?? "Quest memory"}</Text></View>
          <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.92)" }}><Ionicons name="grid-outline" size={16} color={T.dark} /></View>
        </View>
      </Pressable>
      {resolvedItems.length > 1 ? <View style={{ flexDirection: "row", justifyContent: "center", gap: 5 }}>{resolvedItems.map((item, index) => <View key={item.id} style={{ width: index === activeIndex ? 16 : 5, height: 5, borderRadius: 99, backgroundColor: index === activeIndex ? T.blue : T.border }} />)}</View> : null}
    </View>
  );
}

function JournalAlbum({ items }: { items: JournalMediaItem[] }) {
  const resolvedItems = useResolvedMedia(items);
  const grouped = resolvedItems.reduce<Record<string, { questTitle: string; dateKey: string; items: (JournalMediaItem & { uri: string })[] }>>((groups, item) => {
    const key = `${item.dateKey}\u0001${item.questTitle}`;
    (groups[key] ??= { questTitle: item.questTitle, dateKey: item.dateKey, items: [] }).items.push(item);
    return groups;
  }, {});
  const quests = Object.values(grouped).sort((a, b) => b.dateKey.localeCompare(a.dateKey) || a.questTitle.localeCompare(b.questTitle));
  const todayKey = toLocalDateKey(new Date());
  const yesterdayKey = toLocalDateKey(addDays(new Date(), -1));
  const displayDate = (dateKey: string) => dateKey === todayKey ? "Today" : dateKey === yesterdayKey ? "Yesterday" : parseKey(dateKey).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (!items.length) return <Card style={{ borderRadius: radius.xl }}><EmptyState emoji="📷" title="Your album is waiting" body="Finish a quest with a photo and it will become part of your journal album." /></Card>;

  return <View style={{ gap: 20 }}>
    {quests.map((quest) => <View key={`${quest.dateKey}-${quest.questTitle}`} style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}><Text numberOfLines={1} style={{ flexShrink: 1, color: T.dark, fontSize: 15, lineHeight: 20, fontWeight: "900" }}>{quest.questTitle}</Text><Text numberOfLines={1} style={{ color: T.muted, fontSize: 11, lineHeight: 16, fontWeight: "800" }}>· {displayDate(quest.dateKey)}</Text></View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {quest.items.map((item) => <View key={item.id} style={{ width: "23.2%", aspectRatio: 1, overflow: "hidden", borderRadius: 13, backgroundColor: T.border }}><Image source={{ uri: item.uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /></View>)}
      </View>
    </View>)}
  </View>;
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
        borderColor: "rgba(232,223,213,0.95)",
        backgroundColor: "#fffaff",
        flexDirection: "row",
        overflow: "hidden"
      }}
    >
      {cells.map((cell, index) => (
        <View key={cell.label} style={{ flex: 1, flexDirection: "row" }}>
          {index > 0 ? <View style={{ width: 1, marginVertical: 13, backgroundColor: T.border }} /> : null}
          <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center", gap: 3 }}>
            <Text style={{ color: T.cyan, fontSize: 10, lineHeight: 13, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>
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
  const cat = categoryColor[memory.category] ?? { text: memory.color, bg: `${memory.color}18` };
  const diff = difficultyColor[memory.difficulty];

  return (
    <Card pressable onPress={onPress} style={{ padding: 0, borderRadius: radius.lg, overflow: "hidden" }}>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 5, backgroundColor: memory.color }} />
        <View style={{ flex: 1, padding: 14, gap: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <View style={{ borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: cat.bg }}>
                <Text style={{ color: cat.text, fontSize: 9, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>{memory.category}</Text>
              </View>
              <View style={{ borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: diff.bg }}>
                <Text style={{ color: diff.text, fontSize: 9, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>{memory.difficulty}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="time-outline" size={11} color={T.muted} />
              <Text style={{ color: T.muted, fontSize: 11, fontWeight: "800" }}>{formatTime(memory.completedAt)}</Text>
            </View>
          </View>

          <Text style={{ color: T.dark, fontSize: 16, lineHeight: 20, fontWeight: "900" }} numberOfLines={2}>
            {memory.title}
          </Text>

          {memory.reflection ? (
            <Text style={{ color: T.muted, fontSize: 13, lineHeight: 18, fontWeight: "600" }} numberOfLines={2}>
              “{memory.reflection}”
            </Text>
          ) : (
            <Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "600", fontStyle: "italic", opacity: 0.8 }}>
              No reflection saved for this quest.
            </Text>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: `${T.blue}1f` }}>
                <Ionicons name="flash" size={11} color={T.blue} />
                <Text style={{ color: T.blue, fontSize: 11, fontWeight: "900" }}>+{memory.xp} XP</Text>
              </View>
              <AvatarPile people={memory.participants} />
            </View>
            <Ionicons name="chevron-forward" size={15} color={T.muted} />
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
  partyChapters,
  isLast,
  onEditTitle,
  onSelectMood,
  onOpenMemory,
  onOpenActiveQuest,
  onOpenAlbum,
  onOpenPartyChapter,
  onExplore
}: {
  dayNumber: number;
  date: Date;
  isToday: boolean;
  entry: JournalEntry | null;
  memories: JournalMemory[];
  todayMediaItems: JournalMediaItem[];
  activeQuest: JournalActiveQuest | null;
  partyChapters: PartyJournalCard[];
  isLast: boolean;
  onEditTitle: () => void;
  onSelectMood: (mood: JournalMood) => void;
  onOpenMemory: (memory: JournalMemory) => void;
  onOpenActiveQuest: () => void;
  onOpenAlbum: () => void;
  onOpenPartyChapter: (party: PartyJournalCard) => void;
  onExplore: () => void;
}) {
  const editable = isToday;
  const customTitle = entry?.title?.trim();
  const milestone = milestoneLabels[dayNumber];
  const xp = memories.reduce((sum, memory) => sum + memory.xp, 0);
  const minutes = memories.reduce((sum, memory) => sum + memory.timeMin, 0);
  const personalMemories = memories.filter((memory) => !memory.partyId);
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
                onPress={() => {
                  haptic();
                  onEditTitle();
                }}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: `${T.blue}14`,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ scale: pressed ? 0.88 : 1 }]
                })}
              >
                <Ionicons name="pencil" size={13} color={T.blue} />
              </Pressable>
            ) : null}
          </View>
          <Text style={{ color: T.muted, fontSize: 12, lineHeight: 16, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" }}>
            {dateLabel}
          </Text>
        </View>
      </View>

      <MoodSelector mood={entry?.mood ?? null} editable={editable} onSelect={onSelectMood} />

      {milestone ? (
        <View style={{ flexDirection: "row" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(254,228,64,0.22)", borderWidth: 1.5, borderColor: "rgba(254,228,64,0.55)" }}>
            <Ionicons name="sparkles" size={12} color={T.orange} />
            <Text style={{ color: T.dark, fontSize: 11, fontWeight: "900" }}>{milestone}</Text>
          </View>
        </View>
      ) : null}

      <DayStatStrip questCount={memories.length} xp={xp} minutes={minutes} />

      {isToday ? <TodayMediaSection items={todayMediaItems} onOpenAlbum={onOpenAlbum} /> : null}

      {activeQuest ? <View style={{ gap: 8 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>In progress</Text><ActiveQuestJournalCard quest={activeQuest} onPress={onOpenActiveQuest} /></View> : null}

      {personalMemories.length ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Memories</Text>
          {personalMemories.map((memory) => (
            <MemoryCard key={memory.completionId} memory={memory} onPress={() => onOpenMemory(memory)} />
          ))}
        </View>
      ) : !memories.length && !activeQuest ? (
        <EmptyDayCard isToday={isToday} onExplore={onExplore} />
      ) : null}

      {partyChapters.length ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>
            Party chapter{partyChapters.length === 1 ? "" : "s"}
          </Text>
          {partyChapters.map((party) => (
            <PartyHistoryCard key={party.partyId} party={party} onOpen={() => onOpenPartyChapter(party)} />
          ))}
        </View>
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

function PartyHistoryCard({ party, onOpen }: { party: PartyJournalCard; onOpen: () => void }) {
  const leaders = party.rankings.slice(0, 3);
  return (
    <Card pressable onPress={onOpen} style={{ borderRadius: radius.lg, gap: 10, backgroundColor: `${T.purple}0b`, borderColor: `${T.purple}35` }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 16, fontWeight: "900" }}>{party.name}</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "800", marginTop: 2 }}>{party.status === "ended" ? "Final Party rankings" : "Live Party rankings"}</Text></View>
        {party.leftEarly ? <Tag label="Left early" color={T.orange} bg={`${T.orange}18`} /> : <Tag label={party.status === "ended" ? "Ended" : "Live"} color={party.status === "ended" ? T.muted : T.green} bg={`${party.status === "ended" ? T.muted : T.green}18`} />}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>{leaders.length ? leaders.map((entry, index) => <View key={`${party.partyId}-${entry.rank}-${entry.name}-${index}`} style={{ flex: 1, borderRadius: 14, backgroundColor: T.white, paddingVertical: 8, alignItems: "center", gap: 2 }}><Text style={{ fontSize: 17 }}>{entry.emoji}</Text><Text style={{ color: T.dark, fontSize: 11, fontWeight: "900" }} numberOfLines={1}>#{entry.rank} {entry.name}</Text><Text style={{ color: T.blue, fontSize: 10, fontWeight: "900" }}>{entry.xp} XP</Text></View>) : <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>No completed Party quests yet.</Text>}</View>
    </Card>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export function JournalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();
  const { markJournalRead } = useNotifications();
  const { snapshot: activeQuestSnapshot } = useActiveQuest();

  const [tab, setTab] = useState<JournalTab>("journal");
  const [mode, setMode] = useState<CalendarMode>("week");
  const [data, setData] = useState<JournalData | null>(null);
  const [entries, setEntries] = useState<Record<string, JournalEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partyCollection, setPartyCollection] = useState<PartyDayCollection | null>(null);

  const [todayKey, setTodayKey] = useState(() => toLocalDateKey(new Date()));
  const [activeKey, setActiveKey] = useState(todayKey);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const scrollRef = useRef<ScrollView>(null);
  const activeKeyRef = useRef(activeKey);
  const sectionOffsets = useRef<Record<string, number>>({});
  const sectionsBaseY = useRef(0);
  const calendarHeight = useRef(140);
  const suppressScrollSyncUntil = useRef(0);

  // The inline media shelf is explicitly for the current local calendar day.
  // Refresh this key at midnight so those captures move to Album without a
  // reload while the journal remains open.
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(() => setTodayKey(toLocalDateKey(new Date())), Math.max(1_000, nextMidnight.getTime() - now.getTime() + 150));
    return () => clearTimeout(timer);
  }, [todayKey]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const journal = await fetchJournalData();
      setData(journal);
      setEntries(journal.entriesByDate);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load your journal.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      void markJournalRead();
    }, [load, markJournalRead])
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
    }))));
    const activeMedia = (activeQuestSnapshot?.photos ?? []).map((photo) => ({
      id: `active-${photo.id}`,
      source: photo.uri,
      dateKey: toLocalDateKey(new Date(photo.capturedAt)),
      questTitle: data?.activeQuest?.title ?? "Active quest",
    }));
    return [...activeMedia, ...completedMedia];
  }, [activeQuestSnapshot?.photos, data?.activeQuest?.title, data?.memoriesByDate]);

  const todayMediaItems = useMemo(() => albumItems.filter((item) => item.dateKey === todayKey), [albumItems, todayKey]);

  function scrollToDay(key: string) {
    const offset = sectionOffsets.current[key];
    if (offset == null) return;
    suppressScrollSyncUntil.current = Date.now() + 700;
    const target = Math.max(0, sectionsBaseY.current + offset - calendarHeight.current - 6);
    scrollRef.current?.scrollTo({ y: target, animated: true });
  }

  function handleSelectDate(key: string) {
    activeKeyRef.current = key;
    setActiveKey(key);
    scrollToDay(key);
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (tab !== "journal") return;
    if (Date.now() < suppressScrollSyncUntil.current) return;
    const probe = event.nativeEvent.contentOffset.y + calendarHeight.current + 24;
    let current = dayKeys[0];
    for (const key of dayKeys) {
      const offset = sectionOffsets.current[key];
      if (offset == null) continue;
      if (sectionsBaseY.current + offset <= probe) current = key;
      else break;
    }
    if (current && current !== activeKeyRef.current) {
      activeKeyRef.current = current;
      setActiveKey(current);
    }
  }

  async function saveEntry(key: string, patch: { title?: string | null; mood?: JournalMood }) {
    const previous = entries[key] ?? null;
    const next: JournalEntry = {
      entryDate: key,
      title: patch.title !== undefined ? patch.title : previous?.title ?? null,
      mood: patch.mood !== undefined ? patch.mood : previous?.mood ?? null
    };
    setEntries((current) => ({ ...current, [key]: next }));

    try {
      await upsertJournalEntry({ entryDate: key, ...patch });
    } catch (nextError) {
      setEntries((current) => {
        const reverted = { ...current };
        if (previous) reverted[key] = previous;
        else delete reverted[key];
        return reverted;
      });
      Alert.alert("Couldn't save", nextError instanceof Error ? nextError.message : "Your change didn't save. Try again.");
    }
  }

  function openTitleEditor() {
    setTitleDraft(entries[todayKey]?.title ?? "");
    setEditingTitle(true);
  }

  const goExplore = () => router.push("/explore");
  const join = parseKey(joinKey);

  const sections = dayKeys.map((key, index) => {
    const date = parseKey(key);
    const dayNumber = Math.round((date.getTime() - join.getTime()) / 86400000) + 1;
    const memories = data?.memoriesByDate[key] ?? [];
    const activeQuest = data?.activeQuest && toLocalDateKey(new Date(data.activeQuest.startedAt)) === key ? data.activeQuest : null;
    const partyIds = new Set(memories.flatMap((memory) => (memory.partyId ? [memory.partyId] : [])));
    const partyChapters = (data?.partyHistory ?? []).filter((party) => partyIds.has(party.partyId));
    return (
      <View key={key} onLayout={(event) => (sectionOffsets.current[key] = event.nativeEvent.layout.y)}>
        <DaySection
          dayNumber={dayNumber}
          date={date}
          isToday={key === todayKey}
          entry={entries[key] ?? null}
          memories={memories}
          todayMediaItems={todayMediaItems}
          activeQuest={activeQuest}
          partyChapters={partyChapters}
          isLast={index === dayKeys.length - 1}
          onEditTitle={openTitleEditor}
          onSelectMood={(mood) => saveEntry(key, { mood })}
          onOpenMemory={(memory) => router.push(`/memory/${memory.completionId}`)}
          onOpenActiveQuest={() => router.push("/active-quest")}
          onOpenAlbum={() => setTab("album")}
          onOpenPartyChapter={(party) => setPartyCollection({ party, dateKey: key })}
          onExplore={goExplore}
        />
      </View>
    );
  });

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={tab === "journal" ? [1] : undefined}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
      >
        <View style={{ alignItems: "center" }}>
          <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, gap: 14, paddingBottom: 14, transform: [{ translateX: safeAreaOffset }] }}>
            <Entrance>
              <JournalHeader tab={tab} />
            </Entrance>
            <Entrance delay={40}>
              <JournalTabs activeTab={tab} onChange={setTab} />
            </Entrance>
          </View>
        </View>

        {tab === "journal" ? (
          <View
            onLayout={(event) => (calendarHeight.current = event.nativeEvent.layout.height)}
            style={{ backgroundColor: T.bg, alignItems: "center", borderBottomWidth: 1, borderBottomColor: T.border, paddingBottom: 8 }}
          >
            <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }}>
              <Entrance delay={80}>
                <JournalCalendar
                  mode={mode}
                  onToggleMode={() => setMode((value) => (value === "week" ? "month" : "week"))}
                  activeKey={activeKey}
                  todayKey={todayKey}
                  joinKey={joinKey}
                  onSelectDate={handleSelectDate}
                />
              </Entrance>
            </View>
          </View>
        ) : null}

        {tab === "journal" ? (
          <View onLayout={(event) => (sectionsBaseY.current = event.nativeEvent.layout.y)} style={{ alignItems: "center" }}>
            <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }}>
              {loading ? (
                <Card style={{ marginTop: 18, borderRadius: radius.lg }}>
                  <EmptyState emoji="⏳" title="Opening your journal" body="Gathering your quests, memories, and days." />
                </Card>
              ) : error ? (
                <Card style={{ marginTop: 18, borderRadius: radius.lg }}>
                  <EmptyState emoji="!" title="Couldn't load your journal" body={error} action={<SoftButton label="Try again" icon="refresh" onPress={load} />} />
                </Card>
              ) : (
                <Entrance delay={120}>
                  {sections}
                  <BeforeJoinMarker joinDate={join} />
                </Entrance>
              )}
            </View>
          </View>
        ) : (
          <View style={{ alignItems: "center" }}>
            <Entrance style={{ width: contentWidth, paddingHorizontal: horizontalPadding, marginTop: 6, transform: [{ translateX: safeAreaOffset }] }}>
              <JournalAlbum items={albumItems} />
            </Entrance>
          </View>
        )}
      </ScrollView>

      <Sheet visible={partyCollection !== null} onClose={() => setPartyCollection(null)} maxHeight="88%">
        <View style={{ padding: 24, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View style={{ flex: 1, gap: 3 }}><Text style={{ color: T.dark, fontSize: 21, fontWeight: "900" }}>{partyCollection?.party.name}</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>Party memories from this day</Text></View><IconButton icon="close" label="Close Party memories" onPress={() => setPartyCollection(null)} /></View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 10 }}>{partyCollection ? (data?.memoriesByDate[partyCollection.dateKey] ?? []).filter((memory) => memory.partyId === partyCollection.party.partyId).sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()).map((memory) => <MemoryCard key={memory.completionId} memory={memory} onPress={() => router.push(`/memory/${memory.completionId}`)} />) : null}</ScrollView>
        </View>
      </Sheet>

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
          <SoftButton
            label="Save title"
            icon="checkmark"
            onPress={() => {
              saveEntry(todayKey, { title: titleDraft.trim() || null });
              setEditingTitle(false);
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}
