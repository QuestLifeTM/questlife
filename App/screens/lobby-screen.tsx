import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { LogLoreFlow } from "@/components/log-lore-flow";
import { QuestStartBlockSheet } from "@/components/quest-start-block";
import { StreakPill } from "@/components/streak-pill";
import { categoryColor, difficultyColor, T } from "@/components/theme";
import { Card, EmptyState, PillStat, ProgressBar, Screen, Sheet, SoftButton, Tag, haptic } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useStreaks } from "@/contexts/StreaksContext";

function horizontalGap(width: number) {
  if (width < 380) return 14;
  return 24;
}

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

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Good Night";
}

function ordinal(day: number) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}TH`;
  const mod10 = day % 10;
  if (mod10 === 1) return `${day}ST`;
  if (mod10 === 2) return `${day}ND`;
  if (mod10 === 3) return `${day}RD`;
  return `${day}TH`;
}

function dateLabel(date: Date) {
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  return `${month} ${ordinal(date.getDate())}, ${weekday}`;
}

function LobbyAvatar() {
  const size = 52;
  const inner = 40;
  const dot = 14;
  const border = 5;

  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: border,
          borderColor: T.blue,
          backgroundColor: T.white,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: "rgba(77,168,255,0.16)",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ fontSize: 20, lineHeight: 28 }}>😊</Text>
        </View>
      </View>
      <View
        style={{
          position: "absolute",
          right: 2,
          bottom: 4,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: T.green,
          borderWidth: 4,
          borderColor: T.bg
        }}
      />
    </View>
  );
}

function LobbyBellButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: T.white,
        borderWidth: 2,
        borderColor: T.border,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `3px 3px 0px ${T.border}`,
        transform: [{ scale: pressed ? 0.92 : 1 }]
      })}
    >
      <Ionicons name="notifications-outline" size={17} color={T.muted} />
    </Pressable>
  );
}

export function LobbyScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { getQuest, loading, quests } = useContent();
  const { engine, refresh, saveActiveForLater, savePlan, todayPlan } = useQuestEngine();
  const { refresh: refreshStreaks } = useStreaks();

  const [planSheet, setPlanSheet] = useState(false);
  const [logQuest, setLogQuest] = useState<ReturnType<typeof getQuest>>(null);
  const [savedSheet, setSavedSheet] = useState(false);

  const contentWidth = Math.min(width, 430);
  const sideGap = horizontalGap(width);
  const compact = width < 390;
  const now = new Date();
  const metadata = user?.user_metadata ?? {};
  const displayName = String(metadata.display_name ?? metadata.full_name ?? metadata.name ?? metadata.user_name ?? "Adventurer");
  const firstName = displayName.trim().split(/\s+/)[0] || "Adventurer";

  const activeQuest = engine?.activeSession ? getQuest(engine.activeSession.questId) : null;
  const dailyUsed = engine?.dailyUsed ?? 0;
  const dailyLimit = engine?.dailyLimit ?? 5;
  const completions = engine?.todayCompletions ?? [];
  const visibleCompletions = completions.slice(0, 3);

  const planQuests = useMemo(
    () => (todayPlan?.questIds ?? []).map((id) => getQuest(id)).filter(Boolean),
    [todayPlan, getQuest, quests],
  );

  async function handleSaveForLater() {
    await saveActiveForLater();
    setSavedSheet(true);
    await refresh();
  }

  return (
    <Screen padded={false} contentStyle={{ alignItems: "center", gap: 0 }}>
      <View style={{ width: contentWidth, paddingHorizontal: sideGap }}>
        <View style={{ minHeight: 66, flexDirection: "row", alignItems: "center", gap: compact ? 12 : 16 }}>
          <LobbyAvatar />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: T.dark, fontSize: 20, lineHeight: 24, fontWeight: "900", letterSpacing: -0.5 }} numberOfLines={2}>
              {greetingFor(now)}, {firstName}!
            </Text>
            <Text style={{ color: T.muted, fontSize: 11, lineHeight: 17, fontWeight: "900", letterSpacing: 0.35, textTransform: "uppercase" }} numberOfLines={1}>
              {dateLabel(now)}
            </Text>
          </View>
          <View style={{ width: 106, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <StreakPill compact={compact} />
            <LobbyBellButton onPress={() => router.push("/notifications")} />
          </View>
        </View>
      </View>

      <View style={{ width: contentWidth, paddingHorizontal: sideGap, gap: 18, marginTop: 12 }}>
        <View style={{ gap: 9 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ color: T.dark, fontSize: 21, fontWeight: "900" }}>Daily Energy</Text>
              <Text style={{ color: T.muted, fontSize: 14, fontWeight: "800" }}>
                {dailyUsed} of {dailyLimit} quests used today
              </Text>
            </View>
            <View style={{ borderRadius: 99, backgroundColor: dailyUsed >= dailyLimit ? `${T.red}14` : `${T.cyan}14`, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: dailyUsed >= dailyLimit ? T.red : T.cyan, fontSize: 12, fontWeight: "900" }}>
                {dailyUsed >= dailyLimit ? "Limit reached" : `${dailyLimit - dailyUsed} left`}
              </Text>
            </View>
          </View>
          <View style={{ borderWidth: 2, borderColor: T.border, backgroundColor: T.white, borderRadius: 99, padding: 2 }}>
            <ProgressBar value={(dailyUsed / dailyLimit) * 100} color={dailyUsed >= dailyLimit ? T.red : T.yellow} height={8} />
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="sparkles" size={19} color={T.blue} />
            <Text style={{ color: T.dark, fontSize: 21, fontWeight: "900" }}>Active Quest</Text>
          </View>
          {activeQuest && engine?.activeSession ? (
            <View style={{ position: "relative" }}>
              <Card style={{ padding: 0, borderRadius: 30, overflow: "visible", boxShadow: `7px 8px 0px ${T.border}` }}>
                <View style={{ padding: 24, gap: 18 }}>
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    <Tag label={activeQuest.category} color={(categoryColor[activeQuest.category] ?? { text: activeQuest.color }).text} bg={(categoryColor[activeQuest.category] ?? { bg: `${activeQuest.color}18` }).bg} />
                    <Tag label={activeQuest.difficulty} color={difficultyColor[activeQuest.difficulty].text} bg={difficultyColor[activeQuest.difficulty].bg} />
                  </View>
                  <Text style={{ color: T.dark, fontSize: 24, fontWeight: "900" }}>{activeQuest.title}</Text>
                  <Text style={{ color: T.muted, fontSize: 15, fontWeight: "600", lineHeight: 22 }} numberOfLines={2}>{activeQuest.description}</Text>
                  <View style={{ flexDirection: "row", borderRadius: 22, borderWidth: 1, borderColor: T.border, overflow: "hidden" }}>
                    <View style={{ flex: 1, padding: 16, gap: 4 }}>
                      <Text style={{ color: T.cyan, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Elapsed</Text>
                      <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900" }}>{msToLabel(engine.activeSession.startedAt)}</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: T.border }} />
                    <View style={{ flex: 1, padding: 16, gap: 4 }}>
                      <Text style={{ color: T.cyan, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Reward</Text>
                      <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900" }}>+{activeQuest.xp} XP</Text>
                    </View>
                  </View>
                  <SoftButton label="Complete Quest" icon="checkmark" onPress={() => setLogQuest(activeQuest)} color={T.blue} />
                  <SoftButton label="Move to saved for later" icon="bookmark-outline" inverse color={T.muted} onPress={handleSaveForLater} />
                </View>
              </Card>
              <View style={{ position: "absolute", right: -8, top: -10, borderRadius: 14, backgroundColor: T.yellow, borderWidth: 1.5, borderColor: "#e4d033", paddingHorizontal: 12, paddingVertical: 6, transform: [{ rotate: "12deg" }] }}>
                <Text style={{ color: T.dark, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 }}>ACTIVE!</Text>
              </View>
            </View>
          ) : (
            <Card style={{ borderRadius: 28, minHeight: 200, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
              {loading ? (
                <EmptyState emoji="⏳" title="Loading" body="Checking your quest status..." />
              ) : (
                <>
                  <Text style={{ fontSize: 36 }}>🗺️</Text>
                  <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900", textAlign: "center" }}>No active quest</Text>
                  <Text style={{ color: T.muted, fontWeight: "700", textAlign: "center", lineHeight: 20 }}>Start one from Explore or your plan below.</Text>
                  <SoftButton label="Explore quests" icon="compass" onPress={() => router.push("/explore")} />
                </>
              )}
            </Card>
          )}
        </View>

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="add-circle" size={19} color={T.blue} />
            <Text style={{ color: T.dark, fontSize: 21, fontWeight: "900" }}>Plan Today's Adventure</Text>
          </View>
          {planQuests.length ? (
            <Card style={{ borderRadius: 26, gap: 12 }}>
              <Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>Today's plan · {planQuests.length} quests</Text>
              {planQuests.slice(0, 4).map((q) => q && (
                <View key={q.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 4, height: 28, borderRadius: 99, backgroundColor: q.color }} />
                  <Text style={{ flex: 1, color: T.dark, fontWeight: "800" }} numberOfLines={1}>{q.title}</Text>
                  <Link href={`/quest/${q.id}`} asChild><Pressable><Ionicons name="chevron-forward" size={16} color={T.muted} /></Pressable></Link>
                </View>
              ))}
              <SoftButton label="Change plan" icon="create-outline" inverse color={T.blue} onPress={() => setPlanSheet(true)} />
            </Card>
          ) : (
            <Pressable onPress={() => setPlanSheet(true)} style={{ minHeight: 180, borderRadius: 28, borderWidth: 2.5, borderStyle: "dashed", borderColor: T.border, alignItems: "center", justifyContent: "center", gap: 10, padding: 20 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: T.blue, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="add" size={26} color={T.white} />
              </View>
              <Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>Create a plan</Text>
              <Text style={{ color: T.muted, fontWeight: "700", textAlign: "center", fontSize: 13 }}>Pick quests or browse adventure packs</Text>
            </Pressable>
          )}
        </View>

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: T.dark, fontSize: 21, fontWeight: "900" }}>Completed Today</Text>
            {completions.length > 3 ? (
              <Pressable onPress={() => router.push("/journal")} hitSlop={8}>
                <Text style={{ color: T.blue, fontSize: 13, fontWeight: "900" }}>View all</Text>
              </Pressable>
            ) : null}
          </View>
          {completions.length === 0 ? (
            <Card style={{ borderRadius: 24, alignItems: "center", paddingVertical: 28, gap: 8 }}>
              <Text style={{ fontSize: 28 }}>📋</Text>
              <Text style={{ color: T.muted, fontWeight: "700" }}>Nothing completed yet today</Text>
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {visibleCompletions.map((c) => {
                const q = getQuest(c.questId);
                return (
                  <Card key={c.completionId} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 22, paddingVertical: 14 }}>
                    <View style={{ width: 5, alignSelf: "stretch", backgroundColor: q?.color ?? T.blue, borderRadius: 99 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: T.dark, fontWeight: "900" }} numberOfLines={1}>{q?.title ?? "Quest"}</Text>
                      <Text style={{ color: T.muted, fontWeight: "700", fontSize: 12 }}>{formatTime(c.completedAt)} · {c.logged ? "Logged" : "Skipped lore"}</Text>
                    </View>
                    <PillStat icon="flash" text={`+${c.xpAwarded}`} />
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      </View>

      <Sheet visible={planSheet} onClose={() => setPlanSheet(false)}>
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 12 }}>
          <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900", marginBottom: 4 }}>Create a plan</Text>
          <SoftButton label="Pick your own quests" icon="checkbox-outline" onPress={() => { setPlanSheet(false); router.push("/plan/pick-quests"); }} />
          <SoftButton label="Browse Adventure Packs" icon="map-outline" inverse color={T.blue} onPress={() => { setPlanSheet(false); router.push("/pack-library"); }} />
        </View>
      </Sheet>

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
        <View style={{ padding: 24, alignItems: "center", gap: 12 }}>
          <Text style={{ fontSize: 40 }}>🔖</Text>
          <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900" }}>Saved for later</Text>
          <Text style={{ color: T.muted, fontWeight: "700", textAlign: "center" }}>Your quest is waiting in My Stuff whenever you're ready.</Text>
          <SoftButton label="Got it" onPress={() => setSavedSheet(false)} style={{ alignSelf: "stretch" }} />
        </View>
      </Sheet>
    </Screen>
  );
}
