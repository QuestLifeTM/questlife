import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { AnimatedFlame } from "@/components/animated-flame";
import { T } from "@/components/theme";
import { Card, EmptyState, Header, IconButton, Screen, Sheet, SoftButton, haptic, useResponsiveScreenLayout } from "@/components/ui";
import { useStreaks } from "@/contexts/StreaksContext";
import { toLocalDateKey } from "@/services/journal/journalService";
import { DuoStreak, IncomingDuoInvite, OutgoingDuoInvite, StreakFriend } from "@/types/streaks";

type StreakTab = "personal" | "friends";

/** The fixed, app-authored encouragement message partners send each other. */
const NUDGE_MESSAGE = "Yoo! Our streak needs you — squeeze in a quest before midnight! 🔥";

const MILESTONES = [
  { days: 3, label: "Spark" },
  { days: 7, label: "Kindled" },
  { days: 14, label: "Bonfire" },
  { days: 30, label: "Blazing" },
  { days: 60, label: "Wildfire" },
  { days: 100, label: "Inferno" },
  { days: 365, label: "Eternal Flame" },
] as const;

const AVATAR_PALETTE = [T.blue, T.pink, T.green, T.cyan, T.purple, T.orange, T.teal, T.red];

const STREAK_ORANGE = "#ff6d45";
const BROKEN_GREY = "#cfc8c1";

// ---------------------------------------------------------------------------
// Date helpers (local calendar)
// ---------------------------------------------------------------------------

function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDateKey(key: string, days: number) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
}

/** Rows of 7 cells for the given month; null pads days outside the month. */
function buildMonthRows(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(first.getDay()).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (Date | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }
  return rows;
}

function hoursUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000));
}

function colorFor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function PersonAvatar({
  name,
  avatarUrl,
  seed,
  size = 46,
}: {
  name: string;
  avatarUrl: string | null;
  seed: string;
  size?: number;
}) {
  const color = colorFor(seed);
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: `${color}66` }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}20`,
        borderWidth: 2,
        borderColor: `${color}66`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color, fontSize: Math.round(size * 0.4), fontWeight: "900" }}>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: T.dark, fontSize: 21, lineHeight: 27, fontWeight: "900" }}>{title}</Text>
      {right}
    </View>
  );
}

function StreakTabs({
  activeTab,
  onChange,
  friendsBadge,
}: {
  activeTab: StreakTab;
  onChange: (tab: StreakTab) => void;
  friendsBadge: number;
}) {
  return (
    <View style={{ flexDirection: "row", padding: 5, borderRadius: 28, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }}>
      {(["personal", "friends"] as StreakTab[]).map((tab) => {
        const isActive = activeTab === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => {
              haptic();
              onChange(tab);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 42,
              borderRadius: 22,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: isActive ? T.dark : "transparent",
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text style={{ color: isActive ? T.white : T.muted, fontSize: 13, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>
              {tab === "personal" ? "Personal" : "Friends"}
            </Text>
            {tab === "friends" && friendsBadge > 0 ? (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: T.cyan, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                <Text style={{ color: T.white, fontSize: 10, fontWeight: "900" }}>{friendsBadge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Personal tab
// ---------------------------------------------------------------------------

function PersonalHero({
  currentStreak,
  questedToday,
  onQuest,
}: {
  currentStreak: number;
  questedToday: boolean;
  onQuest: () => void;
}) {
  const hasStreak = currentStreak > 0;
  return (
    <Card style={{ borderRadius: 30, padding: 22, gap: 16, boxShadow: `7px 8px 0px ${T.border}` }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: hasStreak ? STREAK_ORANGE : T.muted, fontSize: 62, lineHeight: 70, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
            {currentStreak}
          </Text>
          <Text style={{ color: hasStreak ? STREAK_ORANGE : T.muted, fontSize: 23, lineHeight: 30, fontWeight: "900" }}>
            day streak{hasStreak ? "!" : ""}
          </Text>
        </View>
        <AnimatedFlame size={96} animated={hasStreak} dimmed={!hasStreak} />
      </View>

      {questedToday ? (
        <View style={{ borderRadius: 18, backgroundColor: `${T.green}12`, borderWidth: 1.5, borderColor: `${T.green}44`, padding: 13, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name="shield-checkmark" size={19} color={T.green} />
          <Text style={{ flex: 1, color: T.dark, fontSize: 14, lineHeight: 20, fontWeight: "800" }}>
            Quest done — your streak is safe for today.
          </Text>
        </View>
      ) : (
        <View style={{ borderRadius: 18, backgroundColor: "rgba(254,228,64,0.16)", borderWidth: 1.5, borderColor: "rgba(254,228,64,0.55)", padding: 13, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="alarm-outline" size={19} color={T.orange} />
            <Text style={{ flex: 1, color: T.dark, fontSize: 14, lineHeight: 20, fontWeight: "800" }}>
              {hasStreak
                ? "One quest today keeps the flame alive."
                : "Light your flame — complete a quest today to start a streak."}
            </Text>
          </View>
          <SoftButton label="Find a quest" icon="compass" onPress={onQuest} color={T.blue} />
        </View>
      )}
    </Card>
  );
}

function StatTile({ label, value, icon, color }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <Card style={{ flex: 1, alignItems: "center", gap: 8, borderRadius: 26, paddingVertical: 18 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${color}14`, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={21} color={color} />
      </View>
      <Text style={{ color: T.dark, fontSize: 26, lineHeight: 32, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{value}</Text>
      <Text style={{ color: T.muted, fontSize: 11, lineHeight: 15, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center" }}>
        {label}
      </Text>
    </Card>
  );
}

type BandSegment = {
  startCol: number;
  endCol: number;
  isCurrent: boolean;
  continuesLeft: boolean;
  continuesRight: boolean;
};

function rowSegments(
  row: (Date | null)[],
  questDays: Set<string>,
  currentRange: { start: string; end: string } | null,
): BandSegment[] {
  const segments: BandSegment[] = [];
  let start: number | null = null;

  const isQuestDay = (cell: Date | null) => cell !== null && questDays.has(toLocalDateKey(cell));

  for (let col = 0; col <= row.length; col += 1) {
    const active = col < row.length && isQuestDay(row[col]);
    if (active && start === null) start = col;
    if (!active && start !== null) {
      const end = col - 1;
      const startKey = toLocalDateKey(row[start] as Date);
      const endKey = toLocalDateKey(row[end] as Date);
      const isCurrent =
        currentRange !== null && endKey >= currentRange.start && startKey <= currentRange.end;
      segments.push({
        startCol: start,
        endCol: end,
        isCurrent,
        continuesLeft: start === 0 && questDays.has(shiftDateKey(startKey, -1)),
        continuesRight: end === row.length - 1 && questDays.has(shiftDateKey(endKey, 1)),
      });
      start = null;
    }
  }
  return segments;
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function CalendarCard({
  questDays,
  currentRange,
}: {
  questDays: Set<string>;
  currentRange: { start: string; end: string } | null;
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const todayKey = toLocalDateKey(now);
  const atCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  const rows = useMemo(() => buildMonthRows(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthQuestDays = useMemo(() => {
    let count = 0;
    for (const key of questDays) {
      const date = parseDateKey(key);
      if (date.getFullYear() === viewYear && date.getMonth() === viewMonth) count += 1;
    }
    return count;
  }, [questDays, viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    haptic();
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <Card style={{ borderRadius: 26, padding: 18, gap: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ color: T.dark, fontSize: 22, lineHeight: 28, fontWeight: "900" }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>
          <Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "800" }}>
            {monthQuestDays} quest {monthQuestDays === 1 ? "day" : "days"} this month
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#b1aaad" />
          </Pressable>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={8} disabled={atCurrentMonth}>
            <Ionicons name="chevron-forward" size={24} color={atCurrentMonth ? T.border : "#b1aaad"} />
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row" }}>
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} style={{ flex: 1, color: "#aaa5a8", fontSize: 14, fontWeight: "900", textAlign: "center" }}>
              {label}
            </Text>
          ))}
        </View>

        {rows.map((row, rowIndex) => {
          const segments = rowSegments(row, questDays, currentRange);
          return (
            <View key={`row-${rowIndex}`} style={{ height: 44, flexDirection: "row", alignItems: "center", position: "relative" }}>
              {segments.map((segment) => {
                const cellPercent = 100 / 7;
                return (
                  <View
                    key={`band-${segment.startCol}`}
                    style={{
                      position: "absolute",
                      left: `${segment.startCol * cellPercent}%`,
                      width: `${(segment.endCol - segment.startCol + 1) * cellPercent}%`,
                      top: 5,
                      height: 34,
                      backgroundColor: segment.isCurrent ? STREAK_ORANGE : BROKEN_GREY,
                      borderTopLeftRadius: segment.continuesLeft ? 0 : 99,
                      borderBottomLeftRadius: segment.continuesLeft ? 0 : 99,
                      borderTopRightRadius: segment.continuesRight ? 0 : 99,
                      borderBottomRightRadius: segment.continuesRight ? 0 : 99,
                    }}
                  />
                );
              })}
              {row.map((cell, colIndex) => {
                const key = cell ? toLocalDateKey(cell) : null;
                const onBand = key !== null && questDays.has(key);
                const isToday = key === todayKey;
                return (
                  <View key={`cell-${rowIndex}-${colIndex}`} style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                    {cell ? (
                      <View
                        style={{
                          minWidth: 28,
                          height: 28,
                          borderRadius: 14,
                          borderWidth: isToday && !onBand ? 2 : 0,
                          borderColor: "rgba(243,156,18,0.55)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: onBand ? T.white : isToday ? T.orange : "#aaa5a8",
                            fontSize: 15,
                            fontWeight: "900",
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {cell.getDate()}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 16, justifyContent: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: STREAK_ORANGE }} />
          <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>Current streak</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: BROKEN_GREY }} />
          <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>Past streaks</Text>
        </View>
      </View>
    </Card>
  );
}

function MilestoneCard({ currentStreak, longestStreak }: { currentStreak: number; longestStreak: number }) {
  const next = MILESTONES.find((milestone) => milestone.days > currentStreak) ?? MILESTONES[MILESTONES.length - 1];
  const reached = MILESTONES.filter((milestone) => milestone.days <= currentStreak);
  const previousDays = reached.length ? reached[reached.length - 1].days : 0;
  const span = next.days - previousDays;
  const progress = span > 0 ? Math.min(1, (currentStreak - previousDays) / span) : 1;
  const daysToGo = Math.max(0, next.days - currentStreak);

  return (
    <Card style={{ borderRadius: 26, padding: 18, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(254,228,64,0.22)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="trophy" size={22} color={T.orange} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.dark, fontSize: 18, lineHeight: 23, fontWeight: "900" }}>
            Next milestone: {next.label}
          </Text>
          <Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>
            {daysToGo > 0
              ? `${daysToGo} ${daysToGo === 1 ? "day" : "days"} to a ${next.days}-day streak`
              : "You are at the top of the mountain. Keep it burning!"}
          </Text>
        </View>
      </View>

      <View style={{ borderWidth: 2, borderColor: T.border, backgroundColor: T.white, borderRadius: 99, padding: 2 }}>
        <View style={{ height: 10, borderRadius: 99, backgroundColor: T.border, overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${Math.max(4, progress * 100)}%`, borderRadius: 99, backgroundColor: STREAK_ORANGE }} />
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>
          {reached.length ? `Last unlocked: ${reached[reached.length - 1].label}` : "First milestone at 3 days"}
        </Text>
        <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>Best ever: {longestStreak}</Text>
      </View>
    </Card>
  );
}

function LeaderboardCard({
  friends,
  myName,
  myStreak,
  visibilityPublic,
  onToggleVisibility,
}: {
  friends: StreakFriend[];
  myName: string;
  myStreak: number;
  visibilityPublic: boolean;
  onToggleVisibility: () => void;
}) {
  const visibleFriends = friends.filter((friend) => friend.streakVisible);
  const privateCount = friends.length - visibleFriends.length;

  const rows = [
    { userId: "me", name: myName, avatarUrl: null as string | null, streak: myStreak, best: null as number | null, isMe: true },
    ...visibleFriends.map((friend) => ({
      userId: friend.userId,
      name: friend.displayName,
      avatarUrl: friend.avatarUrl,
      streak: friend.currentStreak ?? 0,
      best: friend.longestStreak,
      isMe: false,
    })),
  ].sort((a, b) => b.streak - a.streak);

  return (
    <View style={{ gap: 12 }}>
      <SectionHeader
        title="Friend Leaderboard"
        right={<Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>Personal streaks</Text>}
      />

      {friends.length === 0 ? (
        <Card style={{ borderRadius: 24 }}>
          <EmptyState
            emoji="🫂"
            title="No friends yet"
            body="When you add friends, everyone who shares their streak shows up here for some friendly fire."
          />
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((row, index) => (
            <View
              key={row.userId}
              style={{
                minHeight: 62,
                borderRadius: 22,
                backgroundColor: row.isMe ? `${T.blue}12` : T.white,
                borderWidth: 2,
                borderColor: row.isMe ? `${T.blue}55` : T.border,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Text style={{ width: 24, color: index === 0 ? T.orange : T.muted, fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
                {index + 1}
              </Text>
              <PersonAvatar name={row.name} avatarUrl={row.avatarUrl} seed={row.userId} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.dark, fontSize: 15, fontWeight: "900" }} numberOfLines={1}>
                  {row.isMe ? `${row.name} (you)` : row.name}
                </Text>
                {row.best !== null ? (
                  <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>Best: {row.best}</Text>
                ) : null}
              </View>
              <View style={{ borderRadius: 99, backgroundColor: "rgba(254,228,64,0.18)", borderWidth: 1.5, borderColor: "rgba(254,228,64,0.5)", paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="flame" size={13} color={T.orange} />
                <Text style={{ color: T.dark, fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{row.streak}</Text>
              </View>
            </View>
          ))}
          {privateCount > 0 ? (
            <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700", textAlign: "center" }}>
              {privateCount} {privateCount === 1 ? "friend keeps" : "friends keep"} their streak private.
            </Text>
          ) : null}
        </View>
      )}

      <Card style={{ borderRadius: 22, paddingVertical: 6, paddingHorizontal: 16, boxShadow: "none" }}>
        <Pressable onPress={onToggleVisibility} style={{ paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.dark, fontWeight: "900" }}>Show my streak to friends</Text>
            <Text style={{ color: T.muted, fontWeight: "700", fontSize: 12, marginTop: 2 }}>
              Friends see your streak on their leaderboards
            </Text>
          </View>
          <View style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: visibilityPublic ? T.green : T.border, alignItems: visibilityPublic ? "flex-end" : "flex-start" }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: T.white }} />
          </View>
        </Pressable>
      </Card>
    </View>
  );
}

function PersonalStreakContent() {
  const router = useRouter();
  const { overview, setVisibility } = useStreaks();

  if (!overview) return null;
  const { personal, friends, questDays } = overview;

  const currentRange =
    personal.currentStreak > 0 && personal.streakStartedOn && personal.lastQuestOn
      ? { start: personal.streakStartedOn, end: personal.lastQuestOn }
      : null;

  return (
    <View style={{ gap: 20 }}>
      <PersonalHero
        currentStreak={personal.currentStreak}
        questedToday={personal.questedToday}
        onQuest={() => router.push("/explore")}
      />

      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatTile label="Longest streak" value={String(personal.longestStreak)} icon="trophy-outline" color={T.blue} />
        <StatTile label="Quest days" value={String(questDays.size)} icon="checkmark-circle-outline" color={T.green} />
      </View>

      <CalendarCard questDays={questDays} currentRange={currentRange} />
      <MilestoneCard currentStreak={personal.currentStreak} longestStreak={personal.longestStreak} />

      <LeaderboardCard
        friends={friends}
        myName="You"
        myStreak={personal.currentStreak}
        visibilityPublic={personal.streakVisibility === "public"}
        onToggleVisibility={() =>
          setVisibility(personal.streakVisibility === "public" ? "private" : "public")
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Friends tab
// ---------------------------------------------------------------------------

function TodayChip({ label, done }: { label: string; done: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: done ? `${T.green}55` : T.border,
        backgroundColor: done ? `${T.green}10` : T.white,
        paddingVertical: 9,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
      }}
    >
      <Ionicons name={done ? "checkmark-circle" : "ellipse-outline"} size={16} color={done ? T.green : T.muted} />
      <Text style={{ flex: 1, color: done ? T.dark : T.muted, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function DuoStreakCard({
  duo,
  busy,
  onNudge,
  onQuest,
  onEnd,
}: {
  duo: DuoStreak;
  busy: boolean;
  onNudge: () => void;
  onQuest: () => void;
  onEnd: () => void;
}) {
  const bothDone = duo.myDoneToday && duo.partnerDoneToday;
  const atRisk = duo.currentStreak > 0 && !bothDone;

  return (
    <Card style={{ borderRadius: 26, padding: 18, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <PersonAvatar name={duo.partnerName} avatarUrl={duo.partnerAvatarUrl} seed={duo.partnerId} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.dark, fontSize: 17, lineHeight: 22, fontWeight: "900" }} numberOfLines={1}>
            {duo.partnerName}
          </Text>
          <Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>
            Together since {MONTH_NAMES[parseDateKey(duo.startedOn).getMonth()].slice(0, 3)} {parseDateKey(duo.startedOn).getDate()}
            {" · "}Best {duo.longestStreak}
          </Text>
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
          <AnimatedFlame size={34} animated={duo.currentStreak > 0} dimmed={duo.currentStreak === 0} />
          <Text style={{ color: duo.currentStreak > 0 ? STREAK_ORANGE : T.muted, fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
            {duo.currentStreak}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <TodayChip label={duo.myDoneToday ? "You quested" : "Your quest"} done={duo.myDoneToday} />
        <TodayChip label={duo.partnerDoneToday ? `${duo.partnerName} quested` : `${duo.partnerName}'s quest`} done={duo.partnerDoneToday} />
      </View>

      {duo.nudgeReceivedToday ? (
        <View style={{ borderRadius: 16, backgroundColor: "rgba(254,228,64,0.16)", borderWidth: 1.5, borderColor: "rgba(254,228,64,0.5)", padding: 12, flexDirection: "row", gap: 9, alignItems: "center" }}>
          <Ionicons name="megaphone" size={17} color={T.orange} />
          <Text style={{ flex: 1, color: T.dark, fontSize: 13, lineHeight: 19, fontWeight: "800" }}>
            {duo.partnerName} nudged you: “{NUDGE_MESSAGE}”
          </Text>
        </View>
      ) : null}

      {bothDone ? (
        <View style={{ borderRadius: 16, backgroundColor: `${T.green}10`, borderWidth: 1.5, borderColor: `${T.green}44`, padding: 12, flexDirection: "row", alignItems: "center", gap: 9 }}>
          <Ionicons name="sparkles" size={17} color={T.green} />
          <Text style={{ flex: 1, color: T.dark, fontSize: 13, lineHeight: 19, fontWeight: "800" }}>
            Streak safe for today. See you both tomorrow!
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {!duo.myDoneToday ? <SoftButton label="Do your quest" icon="compass" onPress={onQuest} color={T.blue} /> : null}
          {!duo.partnerDoneToday ? (
            duo.nudgeSentToday ? (
              <View style={{ minHeight: 48, borderRadius: 28, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Ionicons name="checkmark" size={16} color={T.green} />
                <Text style={{ color: T.muted, fontSize: 15, fontWeight: "800" }}>Encouragement sent today</Text>
              </View>
            ) : (
              <SoftButton
                label={busy ? "Sending…" : `Encourage ${duo.partnerName}`}
                icon="megaphone"
                onPress={busy ? undefined : onNudge}
                inverse
                color={T.orange}
              />
            )
          ) : null}
          {atRisk ? (
            <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700", textAlign: "center" }}>
              Both of you need a quest before midnight to keep the streak.
            </Text>
          ) : null}
        </View>
      )}

      <Pressable onPress={onEnd} hitSlop={8} style={{ alignSelf: "center" }}>
        <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800", textDecorationLine: "underline" }}>
          End this streak
        </Text>
      </Pressable>
    </Card>
  );
}

function IncomingInviteRow({
  invite,
  busy,
  onRespond,
}: {
  invite: IncomingDuoInvite;
  busy: boolean;
  onRespond: (accept: boolean) => void;
}) {
  return (
    <Card style={{ borderRadius: 24, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <PersonAvatar name={invite.senderName} avatarUrl={invite.senderAvatarUrl} seed={invite.senderId} size={46} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.dark, fontSize: 15, lineHeight: 21, fontWeight: "900" }}>
            {invite.senderName} wants to start a streak with you!
          </Text>
          <Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>
            One quest each, every day, together.
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SoftButton
          label={busy ? "…" : "Let's go"}
          icon="flame"
          onPress={busy ? undefined : () => onRespond(true)}
          color={T.green}
          style={{ flex: 1 }}
        />
        <SoftButton
          label="Not now"
          onPress={busy ? undefined : () => onRespond(false)}
          inverse
          color={T.muted}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

function OutgoingInviteRow({
  invite,
  busy,
  onCancel,
}: {
  invite: OutgoingDuoInvite;
  busy: boolean;
  onCancel: () => void;
}) {
  const declined = invite.status === "declined";
  return (
    <Card style={{ borderRadius: 22, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, boxShadow: "none" }}>
      <PersonAvatar name={invite.recipientName} avatarUrl={invite.recipientAvatarUrl} seed={invite.recipientId} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.dark, fontSize: 15, lineHeight: 20, fontWeight: "900" }} numberOfLines={1}>
          {invite.recipientName}
        </Text>
        <Text style={{ color: declined ? T.red : T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>
          {declined
            ? invite.cooldownUntil && hoursUntil(invite.cooldownUntil) > 0
              ? `Passed for now — try again in ${hoursUntil(invite.cooldownUntil)}h`
              : "Passed for now — you can invite them again"
            : "Invite sent — waiting for them"}
        </Text>
      </View>
      {declined ? (
        <View style={{ borderRadius: 99, backgroundColor: `${T.red}12`, paddingHorizontal: 10, paddingVertical: 7 }}>
          <Text style={{ color: T.red, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>Declined</Text>
        </View>
      ) : (
        <Pressable onPress={busy ? undefined : onCancel} hitSlop={8}>
          <Text style={{ color: T.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.6 }}>
            {busy ? "…" : "Cancel"}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

function InviteFriendRow({
  friend,
  busy,
  onInvite,
}: {
  friend: StreakFriend;
  busy: boolean;
  onInvite: () => void;
}) {
  const onCooldown = friend.duoStatus === "cooldown";
  return (
    <Card style={{ borderRadius: 22, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, boxShadow: "none" }}>
      <PersonAvatar name={friend.displayName} avatarUrl={friend.avatarUrl} seed={friend.userId} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.dark, fontSize: 15, lineHeight: 20, fontWeight: "900" }} numberOfLines={1}>
          {friend.displayName}
        </Text>
        <Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>
          {onCooldown
            ? friend.cooldownUntil
              ? `Can invite again in ${hoursUntil(friend.cooldownUntil)}h`
              : "Can invite again soon"
            : friend.streakVisible && (friend.currentStreak ?? 0) > 0
              ? `On a ${friend.currentStreak}-day personal streak`
              : "Ready for a shared adventure"}
        </Text>
      </View>
      {onCooldown ? (
        <View style={{ borderRadius: 99, backgroundColor: T.border, paddingHorizontal: 10, paddingVertical: 7 }}>
          <Ionicons name="hourglass-outline" size={14} color={T.muted} />
        </View>
      ) : (
        <SoftButton
          label={busy ? "…" : "Invite"}
          onPress={busy ? undefined : onInvite}
          color={T.blue}
          style={{ minHeight: 38, paddingHorizontal: 14 }}
        />
      )}
    </Card>
  );
}

function FriendsStreakContent() {
  const router = useRouter();
  const { overview, inviteFriend, respondToInvite, cancelInvite, leaveDuoStreak, nudgePartner } = useStreaks();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<StreakFriend | null>(null);
  const [endTarget, setEndTarget] = useState<DuoStreak | null>(null);

  if (!overview) return null;
  const { duoStreaks, friends, incomingInvites, outgoingInvites } = overview;

  const availableFriends = friends.filter(
    (friend) => friend.duoStatus === "available" || friend.duoStatus === "cooldown",
  );

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
    } catch {
      // Error surfaced by the context banner.
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={{ gap: 20 }}>
      <Card style={{ borderRadius: 26, padding: 18, gap: 12, overflow: "hidden" }}>
        <View style={{ position: "absolute", right: -22, top: -24, width: 118, height: 118, borderRadius: 59, backgroundColor: `${T.orange}10` }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: `${T.orange}18`, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="people" size={25} color={T.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.dark, fontSize: 21, lineHeight: 27, fontWeight: "900" }}>Friend Streaks</Text>
            <Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>
              You and a friend each complete one quest a day. Miss a day and the shared flame goes out.
            </Text>
          </View>
        </View>
      </Card>

      {incomingInvites.length > 0 ? (
        <View style={{ gap: 12 }}>
          <SectionHeader title="Streak Invites" />
          {incomingInvites.map((invite) => (
            <IncomingInviteRow
              key={invite.id}
              invite={invite}
              busy={busyId === invite.id}
              onRespond={(accept) => run(invite.id, () => respondToInvite(invite.id, accept))}
            />
          ))}
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <SectionHeader title="Active Streaks" />
        {duoStreaks.length ? (
          duoStreaks.map((duo) => (
            <DuoStreakCard
              key={duo.id}
              duo={duo}
              busy={busyId === duo.id}
              onNudge={() => run(duo.id, () => nudgePartner(duo.id))}
              onQuest={() => router.push("/explore")}
              onEnd={() => setEndTarget(duo)}
            />
          ))
        ) : (
          <Card style={{ borderRadius: 24, alignItems: "center", gap: 12, paddingVertical: 24 }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: `${T.cyan}18`, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="compass-outline" size={25} color={T.cyan} />
            </View>
            <View style={{ alignItems: "center", gap: 5, paddingHorizontal: 12 }}>
              <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900", textAlign: "center" }}>No streak partner yet</Text>
              <Text style={{ color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" }}>
                Streaks are easier to keep when someone is counting on you. Invite a friend below.
              </Text>
            </View>
          </Card>
        )}
      </View>

      {outgoingInvites.length > 0 ? (
        <View style={{ gap: 12 }}>
          <SectionHeader title="Sent Invites" />
          {outgoingInvites.map((invite) => (
            <OutgoingInviteRow
              key={invite.id}
              invite={invite}
              busy={busyId === invite.id}
              onCancel={() => run(invite.id, () => cancelInvite(invite.id))}
            />
          ))}
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <SectionHeader title="Start a New Streak" />
        {friends.length === 0 ? (
          <Card style={{ borderRadius: 24 }}>
            <EmptyState
              emoji="🤝"
              title="No friends to invite yet"
              body="Once you add friends on QuestLife, you can challenge them to keep a shared streak alive with you."
            />
          </Card>
        ) : availableFriends.length ? (
          <View style={{ gap: 10 }}>
            {availableFriends.map((friend) => (
              <InviteFriendRow
                key={friend.userId}
                friend={friend}
                busy={busyId === friend.userId}
                onInvite={() => setInviteTarget(friend)}
              />
            ))}
          </View>
        ) : (
          <Card style={{ borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 12, boxShadow: "none" }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: `${T.green}12`, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark-circle" size={20} color={T.green} />
            </View>
            <Text style={{ flex: 1, color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "700" }}>
              Every friend is already streaking with you or has a pending invite. Nice.
            </Text>
          </Card>
        )}
      </View>

      <Sheet visible={inviteTarget !== null} onClose={() => setInviteTarget(null)}>
        {inviteTarget ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18, gap: 18, alignItems: "center" }}>
            <PersonAvatar name={inviteTarget.displayName} avatarUrl={inviteTarget.avatarUrl} seed={inviteTarget.userId} size={64} />
            <View style={{ alignItems: "center", gap: 7 }}>
              <Text style={{ color: T.dark, fontSize: 24, lineHeight: 30, fontWeight: "900", textAlign: "center" }}>
                Start a streak with {inviteTarget.displayName}?
              </Text>
              <Text style={{ color: T.muted, fontSize: 15, lineHeight: 22, fontWeight: "700", textAlign: "center" }}>
                You'll both need one quest a day to keep the flame alive. If they decline, you can invite them again after 24 hours.
              </Text>
            </View>
            <SoftButton
              label={busyId === inviteTarget.userId ? "Sending…" : "Send invite"}
              icon="paper-plane"
              onPress={
                busyId === inviteTarget.userId
                  ? undefined
                  : () => {
                      const target = inviteTarget;
                      run(target.userId, async () => {
                        await inviteFriend(target.userId);
                        setInviteTarget(null);
                      });
                    }
              }
              color={T.blue}
              style={{ alignSelf: "stretch" }}
            />
            <SoftButton label="Not now" onPress={() => setInviteTarget(null)} inverse color={T.muted} style={{ alignSelf: "stretch" }} />
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={endTarget !== null} onClose={() => setEndTarget(null)}>
        {endTarget ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18, gap: 18, alignItems: "center" }}>
            <PersonAvatar name={endTarget.partnerName} avatarUrl={endTarget.partnerAvatarUrl} seed={endTarget.partnerId} size={64} />
            <View style={{ alignItems: "center", gap: 7 }}>
              <Text style={{ color: T.dark, fontSize: 24, lineHeight: 30, fontWeight: "900", textAlign: "center" }}>
                End your streak with {endTarget.partnerName}?
              </Text>
              <Text style={{ color: T.muted, fontSize: 15, lineHeight: 22, fontWeight: "700", textAlign: "center" }}>
                Your {endTarget.currentStreak}-day shared flame goes out and can't be relit — you'd start again from zero.
              </Text>
            </View>
            <SoftButton
              label={busyId === endTarget.id ? "Ending…" : "End streak"}
              icon="remove-circle"
              onPress={
                busyId === endTarget.id
                  ? undefined
                  : () => {
                      const target = endTarget;
                      run(target.id, async () => {
                        await leaveDuoStreak(target.id);
                        setEndTarget(null);
                      });
                    }
              }
              color={T.red}
              style={{ alignSelf: "stretch" }}
            />
            <SoftButton label="Keep the streak" onPress={() => setEndTarget(null)} inverse color={T.muted} style={{ alignSelf: "stretch" }} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function StreakScreen({ onBack }: { onBack: () => void }) {
  const { error, loading, overview, refresh } = useStreaks();
  const [activeTab, setActiveTab] = useState<StreakTab>("personal");
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();

  // Streak data goes stale as quests are completed elsewhere in the app, so
  // re-fetch whenever the screen is opened.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen padded={false} contentStyle={{ alignItems: "center", gap: 22 }}>
      <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, gap: 22, transform: [{ translateX: safeAreaOffset }] }}>
        <Header title="Streak" subtitle="Keep the chain alive" right={<IconButton icon="chevron-back" onPress={onBack} bg={T.white} />} animated={false} />

        <StreakTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          friendsBadge={overview?.incomingInvites.length ?? 0}
        />

        {error ? (
          <Card style={{ borderRadius: 22, gap: 12, borderColor: `${T.red}55` }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="cloud-offline-outline" size={20} color={T.red} />
              <Text style={{ flex: 1, color: T.dark, fontSize: 14, lineHeight: 20, fontWeight: "800" }}>{error}</Text>
            </View>
            <SoftButton label="Try again" icon="refresh" onPress={refresh} inverse color={T.blue} />
          </Card>
        ) : null}

        {!overview && loading ? (
          <Card style={{ borderRadius: 26, alignItems: "center", paddingVertical: 40, gap: 14 }}>
            <ActivityIndicator color={T.orange} />
            <Text style={{ color: T.muted, fontSize: 14, fontWeight: "800" }}>Warming up your flame…</Text>
          </Card>
        ) : overview ? (
          activeTab === "personal" ? <PersonalStreakContent /> : <FriendsStreakContent />
        ) : !error ? (
          <Card style={{ borderRadius: 26 }}>
            <EmptyState
              emoji="🔥"
              title="Streaks are warming up"
              body="Sign in and complete a quest to start tracking your streak."
            />
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
