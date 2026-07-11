import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { LogLoreFlow } from "@/components/log-lore-flow";
import { getLobbyLayout, lobbyDesign, resolveLobbyStates } from "@/components/lobby-design";
import { QuestStartBlockSheet } from "@/components/quest-start-block";
import { StreakPill } from "@/components/streak-pill";
import { categoryColor, difficultyColor, radius, T } from "@/components/theme";
import { Card, PillStat, Screen, Sheet, SoftButton, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { useQuestStart } from "@/hooks/useQuestStart";
import { Quest } from "@/types/content";

function msToLabel(startedAt: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function hoursUntilDailyReset(now = new Date()) {
  const reset = new Date(now);
  reset.setDate(reset.getDate() + 1);
  reset.setHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil((reset.getTime() - now.getTime()) / 3600000));
}

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Good Night";
}

function LobbyAvatar() {
  const size = 50;
  const inner = 38;
  const dot = 14;

  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <View style={[styles.avatarRing, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.avatarInner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
          <Text style={styles.avatarEmoji}>😊</Text>
        </View>
      </View>
      <View style={[styles.avatarDot, { width: dot, height: dot, borderRadius: dot / 2 }]} />
    </View>
  );
}

function LobbyBellButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Open notifications"
      accessibilityRole="button"
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [styles.bellButton, pressed ? styles.pressedSmall : null]}
    >
      <Ionicons name="notifications-outline" size={17} color={T.muted} />
    </Pressable>
  );
}

function SectionHeader({
  icon,
  title,
  right,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon ? <Ionicons name={icon} size={18} color={T.blue} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

function EnergyCard({
  dailyLimit,
  dailyUsed,
}: {
  dailyLimit: number;
  dailyUsed: number;
}) {
  const limitReached = dailyLimit > 0 && dailyUsed >= dailyLimit;
  const percent = dailyLimit > 0 ? Math.max(0, Math.min(100, (dailyUsed / dailyLimit) * 100)) : 0;
  const resetLabel = `Resets in ${hoursUntilDailyReset()}h`;
  const progressColor = limitReached ? T.red : T.cyan;

  return (
    <View
      accessibilityLabel={`Daily Energy. ${dailyUsed} of ${dailyLimit} quests completed. ${resetLabel}.`}
      style={styles.energySection}
    >
      <View style={styles.energyHeaderRow}>
        <View style={styles.energyCopy}>
          <Text style={styles.energyTitle}>Daily Energy</Text>
          <Text style={styles.energySubtitle}>
            {dailyUsed} of {dailyLimit} quests completed
          </Text>
        </View>
        <View style={[styles.energyPill, limitReached ? styles.energyPillDone : null]}>
          <Text style={[styles.energyPillText, limitReached ? styles.energyPillTextDone : null]} numberOfLines={1}>
            {limitReached ? "Limit reached" : resetLabel}
          </Text>
        </View>
      </View>
      <View style={styles.energyTrack}>
        {percent > 0 ? (
          <View
            style={[
              styles.energyFill,
              {
                width: `${percent}%`,
                backgroundColor: progressColor,
              },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

function ActiveTag({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.activeTag, { backgroundColor: bg }]}>
      <Text style={[styles.activeTagText, { color }]}>{label}</Text>
    </View>
  );
}

function QuestMeta({ quest }: { quest: Quest }) {
  const category = categoryColor[quest.category] ?? { text: quest.color, bg: `${quest.color}18` };
  const difficulty = difficultyColor[quest.difficulty];

  return (
    <View style={styles.metaRow}>
      <ActiveTag label={quest.category} color={category.text} bg={category.bg} />
      <ActiveTag label={quest.difficulty} color={difficulty.text} bg={difficulty.bg} />
    </View>
  );
}

function ActivePrimaryButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [styles.activePrimaryButton, pressed ? styles.pressed : null]}
    >
      <View style={styles.activePrimaryIcon}>
        <Ionicons name="checkmark" size={19} color={T.blue} />
      </View>
      <Text style={styles.activePrimaryText}>Complete Quest</Text>
    </Pressable>
  );
}

function ActiveSecondaryButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [styles.activeSecondaryButton, pressed ? styles.pressed : null]}
    >
      <Ionicons name="bookmark" size={25} color={T.muted} />
      <Text style={styles.activeSecondaryText}>Save For Later</Text>
    </Pressable>
  );
}

function ActiveQuestCard({
  activeQuest,
  elapsedLabel,
  onComplete,
  onSaveForLater,
}: {
  activeQuest: Quest;
  elapsedLabel: string;
  onComplete: () => void;
  onSaveForLater: () => void;
}) {
  return (
    <View style={styles.activeWrap}>
      <Card style={styles.activeCard}>
      <QuestMeta quest={activeQuest} />
      <View style={styles.activeTitleGroup}>
        <Text style={styles.activeTitle}>{activeQuest.title}</Text>
        <Text style={styles.activeDescription} numberOfLines={3}>
          {activeQuest.description}
        </Text>
      </View>
      <View style={styles.activeStats}>
        <View style={styles.activeStatCell}>
          <Text style={styles.statLabel}>Elapsed Time</Text>
          <Text style={styles.statValue}>{elapsedLabel}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.activeStatCell}>
          <Text style={styles.statLabel}>Reward</Text>
          <Text style={styles.statValue}>+{activeQuest.xp} XP</Text>
        </View>
      </View>
        <View style={styles.buttonStack}>
          <ActivePrimaryButton onPress={onComplete} />
          <ActiveSecondaryButton onPress={onSaveForLater} />
        </View>
      </Card>
      <View style={styles.activeBadge}>
        <Text style={styles.activeBadgeText}>ACTIVE!</Text>
      </View>
    </View>
  );
}

function EmptyActiveQuest({
  loading,
  nextQuest,
  onExplore,
  onStartPlan,
  starting,
}: {
  loading: boolean;
  nextQuest: Quest | null;
  onExplore: () => void;
  onStartPlan: () => void;
  starting: boolean;
}) {
  if (loading) {
    return (
      <Card style={styles.emptyLoadingCard}>
        <Text style={styles.emptyEmoji}>⏳</Text>
        <Text style={styles.emptyLoadingTitle}>Checking your quest status</Text>
        <Text style={styles.emptyLoadingBody}>QuestLife is catching up with your latest adventure.</Text>
      </Card>
    );
  }

  if (nextQuest) {
    return (
      <Card style={styles.nextQuestCard}>
        <View style={styles.nextQuestAccent} />
        <View style={styles.nextQuestContent}>
          <View style={styles.nextQuestTop}>
            <Text style={styles.nextQuestLabel}>Up next from your plan</Text>
            <PillStat icon="flash" text={`+${nextQuest.xp}`} />
          </View>
          <Text style={styles.nextQuestTitle} numberOfLines={2}>
            {nextQuest.title}
          </Text>
          <Text style={styles.nextQuestBody} numberOfLines={2}>
            {nextQuest.description}
          </Text>
          <View style={styles.nextQuestActions}>
            <SoftButton
              label={starting ? "Starting..." : "Start planned quest"}
              icon="play"
              onPress={onStartPlan}
              color={T.blue}
              style={styles.flexButton}
            />
            <Pressable
              accessibilityLabel="Explore quests"
              accessibilityRole="button"
              onPress={() => {
                haptic();
                onExplore();
              }}
              style={({ pressed }) => [styles.iconOnlyButton, pressed ? styles.pressedSmall : null]}
            >
              <Ionicons name="compass" size={18} color={T.blue} />
            </Pressable>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.emptyActiveCard}>
      <View style={styles.emptyQuestHeader}>
        <View style={styles.emptyQuestPlus}>
          <Ionicons name="add" size={22} color={T.blue} />
        </View>
        <View style={styles.emptyQuestCopy}>
          <Text style={styles.emptyQuestTitle}>No quest is active</Text>
          <Text style={styles.emptyQuestBody}>Let’s choose your next quest.</Text>
        </View>
      </View>
      <View style={styles.emptyActions}>
        <SoftButton label="Explore quests" icon="compass" onPress={onExplore} style={styles.flexButton} />
      </View>
    </Card>
  );
}

function CompletedSection({
  completions,
  getQuest,
  onOpenJournal,
}: {
  completions: { completionId: string; questId: string; xpAwarded: number; logged: boolean; completedAt: string }[];
  getQuest: (id?: string) => Quest | null;
  onOpenJournal: () => void;
}) {
  const visibleCompletions = completions.slice(0, 3);

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Completed Today"
        right={
          completions.length ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptic();
                onOpenJournal();
              }}
              hitSlop={8}
            >
              <Text style={styles.sectionLink}>Journal</Text>
            </Pressable>
          ) : null
        }
      />
      {completions.length === 0 ? (
        <Card style={styles.completedEmpty}>
          <View style={styles.completedEmptyIcon}>
            <Text style={styles.completedEmptyEmoji}>📋</Text>
          </View>
          <View style={styles.completedEmptyCopy}>
            <Text style={styles.completedEmptyTitle}>Nothing completed yet</Text>
            <Text style={styles.completedEmptyBody}>Finish a quest and it will land here.</Text>
          </View>
        </Card>
      ) : (
        <View style={styles.completedList}>
          {visibleCompletions.map((completion) => {
            const quest = getQuest(completion.questId);
            return (
              <Card key={completion.completionId} style={styles.completedItem}>
                <View style={[styles.completedStripe, { backgroundColor: quest?.color ?? T.blue }]} />
                <View style={styles.completedCopy}>
                  <Text style={styles.completedTitle} numberOfLines={1}>
                    {quest?.title ?? "Quest"}
                  </Text>
                  <Text style={styles.completedMeta}>
                    {formatTime(completion.completedAt)} · {completion.logged ? "Logged" : "Skipped lore"}
                  </Text>
                </View>
                <PillStat icon="flash" text={`+${completion.xpAwarded}`} />
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function LobbyScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { error: contentError, getQuest, loading, quests } = useContent();
  const { engine, error: engineError, loading: engineLoading, refresh, saveActiveForLater, todayPlan } = useQuestEngine();
  const { refresh: refreshStreaks } = useStreaks();
  const { block, clearBlock, starting, tryStart } = useQuestStart(getQuest);

  const [logQuest, setLogQuest] = useState<Quest | null>(null);
  const [savedSheet, setSavedSheet] = useState(false);

  const { contentWidth, horizontalInset, isCompact: compact } = getLobbyLayout(width);
  const now = new Date();
  const metadata = user?.user_metadata ?? {};
  const displayName =
    String(metadata.display_name ?? metadata.full_name ?? metadata.name ?? metadata.user_name ?? "").trim() ||
    "Adventurer";
  const firstName = displayName.split(/\s+/)[0] || "Adventurer";

  const activeQuest = engine?.activeSession ? getQuest(engine.activeSession.questId) : null;
  const dailyUsed = engine?.dailyUsed ?? 0;
  const dailyLimit = engine?.dailyLimit ?? 5;
  const completions = engine?.todayCompletions ?? [];
  const planQuests = useMemo(
    () => (todayPlan?.questIds ?? []).map((id) => getQuest(id)).filter((quest): quest is Quest => Boolean(quest)),
    [todayPlan, getQuest, quests],
  );
  const lobbyStates = resolveLobbyStates({
    contentLoading: loading,
    contentError,
    engineLoading,
    engineError,
    hasActiveQuest: Boolean(activeQuest && engine?.activeSession),
    hasPlan: planQuests.length > 0,
    hasCompletions: completions.length > 0,
    feedback: savedSheet ? "success" : "idle",
  });

  async function handleSaveForLater() {
    await saveActiveForLater();
    setSavedSheet(true);
    await refresh();
  }

  async function startPlannedQuest(quest: Quest) {
    const started = await tryStart({ questId: quest.id, source: "plan" });
    if (started) {
      await refresh();
    }
  }

  return (
    <Screen padded={false} contentStyle={styles.screenContent}>
      <View
        style={[styles.container, { width: contentWidth, paddingHorizontal: horizontalInset }]}
        testID={`lobby-${lobbyStates.request}-${lobbyStates.activity}-${lobbyStates.plan}-${lobbyStates.history}-${lobbyStates.feedback}`}
      >
        <View style={styles.header}>
          <LobbyAvatar />
          <View style={styles.headerCopy}>
            <Text style={styles.greeting} numberOfLines={1}>
              {greetingFor(now)}!
            </Text>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={[styles.headerName, compact ? styles.headerNameCompact : null]}
              numberOfLines={1}
            >
              {firstName}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <StreakPill compact={compact} />
            <LobbyBellButton onPress={() => router.push("/notifications")} />
          </View>
        </View>

        <EnergyCard dailyLimit={dailyLimit} dailyUsed={dailyUsed} />

        <View style={styles.section}>
          <SectionHeader icon="sparkles" title="Active Quest" />
          {activeQuest && engine?.activeSession ? (
            <ActiveQuestCard
              activeQuest={activeQuest}
              elapsedLabel={msToLabel(engine.activeSession.startedAt)}
              onComplete={() => setLogQuest(activeQuest)}
              onSaveForLater={handleSaveForLater}
            />
          ) : (
            <EmptyActiveQuest
              loading={loading}
              nextQuest={planQuests[0] ?? null}
              onExplore={() => router.push("/explore")}
              onStartPlan={() => {
                if (planQuests[0]) startPlannedQuest(planQuests[0]);
              }}
              starting={starting}
            />
          )}
        </View>

        <CompletedSection completions={completions} getQuest={getQuest} onOpenJournal={() => router.push("/journal")} />
      </View>

      <LogLoreFlow
        visible={logQuest !== null}
        quest={logQuest}
        onClose={() => setLogQuest(null)}
        onFinished={async () => {
          await refresh();
          refreshStreaks();
          setLogQuest(null);
        }}
      />

      <Sheet visible={savedSheet} onClose={() => setSavedSheet(false)}>
        <View style={styles.savedSheet}>
          <Text style={styles.savedEmoji}>🔖</Text>
          <Text style={styles.savedTitle}>Saved for later</Text>
          <Text style={styles.savedBody}>Your quest is waiting in My Stuff whenever you're ready.</Text>
          <SoftButton label="Got it" onPress={() => setSavedSheet(false)} style={styles.fullWidth} />
        </View>
      </Sheet>

      <Sheet visible={block !== null} onClose={clearBlock}>
        <View style={styles.sheetContent}>
          <QuestStartBlockSheet
            block={block}
            onClose={clearBlock}
            onGoActive={() => {
              clearBlock();
              if (engine?.activeSession) router.push(`/quest/${engine.activeSession.questId}`);
            }}
            onSaveActive={async () => {
              await handleSaveForLater();
              clearBlock();
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    alignItems: "center",
    gap: 0,
  },
  container: {
    gap: lobbyDesign.spacing.section,
  },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  greeting: {
    color: lobbyDesign.color.mutedInk,
    fontFamily: "RubikBlack",
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: 0,
  },
  headerName: {
    color: lobbyDesign.color.ink,
    fontFamily: "RubikBlack",
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: 0,
  },
  headerNameCompact: {
    fontSize: 25,
    lineHeight: 28,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  avatarRing: {
    position: "absolute",
    left: 0,
    top: 0,
    borderWidth: 5,
    borderColor: T.blue,
    backgroundColor: T.white,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    backgroundColor: "rgba(77,168,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 20,
    lineHeight: 28,
  },
  avatarDot: {
    position: "absolute",
    right: 1,
    bottom: 3,
    backgroundColor: T.green,
    borderWidth: 4,
    borderColor: T.bg,
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: T.white,
    borderWidth: 2,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `3px 3px 0px ${T.border}`,
  },
  energySection: {
    gap: 13,
    paddingTop: 4,
    paddingBottom: 2,
  },
  energyHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  energyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  energyTitle: {
    color: T.dark,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
  },
  energySubtitle: {
    color: T.muted,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  energyPill: {
    minWidth: 118,
    minHeight: 42,
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: `${T.cyan}10`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  energyPillDone: {
    backgroundColor: `${T.red}12`,
  },
  energyPillText: {
    color: T.cyan,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  energyPillTextDone: {
    color: T.red,
  },
  energyTrack: {
    height: 18,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: T.border,
    backgroundColor: T.white,
    padding: 2,
    boxShadow: `3px 4px 0px ${T.border}`,
    overflow: "hidden",
  },
  energyFill: {
    height: "100%",
    minWidth: 12,
    borderRadius: 99,
    boxShadow: "0px 2px 5px rgba(0,187,249,0.32)",
  },
  section: {
    gap: 9,
  },
  sectionHeader: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  sectionTitle: {
    color: T.dark,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
  },
  sectionLink: {
    color: T.blue,
    fontSize: 13,
    fontWeight: "900",
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  activeTag: {
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  activeTagText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  activeWrap: {
    position: "relative",
  },
  activeCard: {
    borderRadius: radius.xl,
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 18,
    boxShadow: `4px 5px 0px ${T.border}`,
  },
  activeTitleGroup: {
    gap: 6,
  },
  activeTitle: {
    color: T.dark,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
  },
  activeDescription: {
    color: T.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  activeStats: {
    flexDirection: "row",
    minHeight: 68,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: T.border,
    backgroundColor: "rgba(252,239,246,0.38)",
    overflow: "hidden",
  },
  activeStatCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  statLabel: {
    color: T.cyan,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  statValue: {
    color: T.dark,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
  },
  statDivider: {
    width: 2,
    height: 42,
    alignSelf: "center",
    backgroundColor: T.border,
  },
  activeBadge: {
    position: "absolute",
    right: -8,
    top: -12,
    borderRadius: 16,
    backgroundColor: T.yellow,
    borderWidth: 2.5,
    borderColor: T.white,
    paddingHorizontal: 11,
    paddingVertical: 7,
    boxShadow: "0px 4px 8px rgba(61,52,56,0.18)",
    transform: [{ rotate: "10deg" }],
  },
  activeBadgeText: {
    color: T.dark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  buttonStack: {
    gap: 10,
  },
  activePrimaryButton: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: T.blue,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
    boxShadow: "0px 6px 10px rgba(77,168,255,0.24)",
  },
  activePrimaryIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: T.white,
    alignItems: "center",
    justifyContent: "center",
  },
  activePrimaryText: {
    color: T.white,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  activeSecondaryButton: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: T.border,
    backgroundColor: T.white,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
  },
  activeSecondaryText: {
    color: T.muted,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  emptyActiveCard: {
    borderRadius: radius.xl,
    borderWidth: 2.5,
    borderStyle: "dashed",
    borderColor: T.border,
    backgroundColor: "transparent",
    boxShadow: "none",
    alignItems: "stretch",
    gap: lobbyDesign.spacing.control,
    padding: lobbyDesign.spacing.control,
  },
  emptyLoadingCard: {
    borderRadius: radius.xl,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  emptyQuestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: lobbyDesign.spacing.compact,
  },
  emptyQuestPlus: {
    width: lobbyDesign.control.iconButtonSize,
    height: lobbyDesign.control.iconButtonSize,
    borderRadius: lobbyDesign.control.iconButtonSize / 2,
    backgroundColor: `${T.blue}14`,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyQuestCopy: {
    flex: 1,
    minWidth: 0,
    gap: lobbyDesign.spacing.micro,
  },
  emptyEmoji: {
    fontSize: 28,
    lineHeight: 35,
  },
  emptyLoadingTitle: {
    color: T.dark,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyLoadingBody: {
    color: T.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyQuestTitle: {
    color: T.dark,
    fontSize: lobbyDesign.type.sectionTitle.fontSize,
    lineHeight: lobbyDesign.type.sectionTitle.lineHeight,
    fontWeight: "900",
  },
  emptyQuestBody: {
    color: T.muted,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  emptyActions: {
    alignSelf: "stretch",
  },
  nextQuestCard: {
    borderRadius: radius.xl,
    flexDirection: "row",
    padding: 0,
    overflow: "hidden",
  },
  nextQuestAccent: {
    width: 5,
    backgroundColor: T.blue,
  },
  nextQuestContent: {
    flex: 1,
    gap: 8,
    padding: 14,
  },
  nextQuestTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  nextQuestLabel: {
    color: T.cyan,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  nextQuestTitle: {
    color: T.dark,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
  },
  nextQuestBody: {
    color: T.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  nextQuestActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  iconOnlyButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: `${T.blue}14`,
    borderWidth: 2,
    borderColor: `${T.blue}33`,
    alignItems: "center",
    justifyContent: "center",
  },
  flexButton: {
    flex: 1,
  },
  completedEmpty: {
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  completedEmptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: `${T.muted}12`,
    alignItems: "center",
    justifyContent: "center",
  },
  completedEmptyEmoji: {
    fontSize: 24,
  },
  completedEmptyCopy: {
    flex: 1,
    gap: 2,
  },
  completedEmptyTitle: {
    color: T.dark,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  completedEmptyBody: {
    color: T.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  completedList: {
    gap: 10,
  },
  completedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.lg,
    paddingVertical: 12,
  },
  completedStripe: {
    width: 5,
    alignSelf: "stretch",
    borderRadius: 99,
  },
  completedCopy: {
    flex: 1,
    minWidth: 0,
  },
  completedTitle: {
    color: T.dark,
    fontWeight: "900",
  },
  completedMeta: {
    color: T.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  sheetTitle: {
    color: T.dark,
    fontSize: 22,
    fontWeight: "900",
  },
  sheetSubtitle: {
    color: T.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    marginTop: -4,
    marginBottom: 4,
  },
  savedSheet: {
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  savedEmoji: {
    fontSize: 40,
  },
  savedTitle: {
    color: T.dark,
    fontSize: 20,
    fontWeight: "900",
  },
  savedBody: {
    color: T.muted,
    fontWeight: "700",
    textAlign: "center",
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  pressedSmall: {
    transform: [{ scale: 0.94 }],
  },
});
