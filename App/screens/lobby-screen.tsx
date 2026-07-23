import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { getLobbyLayout, lobbyDesign, resolveLobbyStates } from "@/components/lobby-design";
import { ProfileAvatar } from "@/components/profile-avatar";
import { QuestStartBlockSheet } from "@/components/quest-start-block";
import { StreakPill } from "@/components/streak-pill";
import { categoryColor, difficultyColor, radius, T } from "@/components/theme";
import { Card, PillStat, Screen, Sheet, SoftButton, Tag, haptic, useResponsiveScreenLayout } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { formatElapsedCompact, useElapsedDuration } from "@/hooks/useElapsedTime";
import { useQuestStart } from "@/hooks/useQuestStart";
import { Quest } from "@/types/content";
import { fetchOwnProfileAvatar, fetchRequiredProfileName } from "@/services/profile/profileService";

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

function LobbyReveal({
  children,
  motionKey,
  delay = 0,
  reducedMotion,
}: PropsWithChildren<{ motionKey: string; delay?: number; reducedMotion: boolean }>) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    opacity.stopAnimation();
    translateY.stopAnimation();

    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(10);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 260, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, motionKey, opacity, reducedMotion, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function LobbySwapText({ text, style, reducedMotion }: { text: string; style: StyleProp<TextStyle>; reducedMotion: boolean }) {
  const [displayed, setDisplayed] = useState(text);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (text === displayed) return;
    if (reducedMotion) {
      setDisplayed(text);
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -6, duration: 110, useNativeDriver: true }),
    ]).start(() => {
      setDisplayed(text);
      translateY.setValue(7);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 220, mass: 0.7, useNativeDriver: true }),
      ]).start();
    });
  }, [displayed, opacity, reducedMotion, text, translateY]);

  return <Animated.Text style={[style, { opacity, transform: [{ translateY }] }]}>{displayed}</Animated.Text>;
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

function LobbyAvatar({ uri, onPress }: { uri: string | null; onPress: () => void }) {
  const size = 50;
  const inner = 38;
  const dot = 14;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open your profile"
      hitSlop={8}
      onPress={onPress}
      style={{ width: size, height: size, position: "relative" }}
    >
      <View style={[styles.avatarRing, { width: size, height: size, borderRadius: size / 2 }]}><ProfileAvatar uri={uri} color={T.blue} size={inner} label="Your profile photo" /></View>
      <View style={[styles.avatarDot, { width: dot, height: dot, borderRadius: dot / 2 }]} />
    </Pressable>
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
  leading,
  title,
  right,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  leading?: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {leading ?? (icon ? <Ionicons name={icon} size={18} color={T.blue} /> : null)}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

function EnergyHeadingIcon() {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M13.4999 2L3.99994 13.2C3.62994 13.64 3.43994 13.86 3.43994 14.05C3.43994 14.21 3.51994 14.37 3.63994 14.47C3.79994 14.6 4.07994 14.6 4.63994 14.6H10.9999L10.4999 22L19.5599 10.8C19.9299 10.36 20.1199 10.14 20.1199 9.95C20.1199 9.79 20.0399 9.63 19.9199 9.53C19.7599 9.4 19.4799 9.4 18.9199 9.4H12.9999L13.4999 2Z" fill="#4DA8FF" stroke="#4DA8FF" strokeWidth={1.5} strokeLinejoin="round" /></Svg>;
}

function CompletedHeadingIcon() {
  return <Svg width={17} height={12} viewBox="0 0 17 12" fill="none"><Path d="M15.5722 0.916016L5.49609 10.9922L0.916016 6.41212" stroke="#4DA8FF" strokeWidth={1.83203} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function EnergyCard({
  dailyLimit,
  dailyUsed,
  reducedMotion,
}: {
  dailyLimit: number;
  dailyUsed: number;
  reducedMotion: boolean;
}) {
  const limitReached = dailyLimit > 0 && dailyUsed >= dailyLimit;
  const percent = dailyLimit > 0 ? Math.max(0, Math.min(100, (dailyUsed / dailyLimit) * 100)) : 0;
  const resetLabel = `Resets in ${hoursUntilDailyReset()}h`;
  const progressColor = limitReached ? T.red : T.cyan;

  return (
    <View
      accessibilityLabel={dailyLimit > 0 ? `Daily Energy. ${dailyUsed} of ${dailyLimit} quests completed. ${resetLabel}.` : `Daily Energy. ${dailyUsed} quests completed today. No daily limit.`}
      style={styles.energySection}
    >
      <View style={styles.energyHeaderRow}>
        <View style={styles.energyCopy}>
          <View style={styles.energyTitleRow}>
            <EnergyHeadingIcon />
            <Text style={styles.energyTitle}>Daily Energy</Text>
          </View>
          <LobbySwapText text={dailyLimit > 0 ? `${dailyUsed} of ${dailyLimit} quests completed` : `${dailyUsed} quests completed · Unlimited`} style={styles.energySubtitle} reducedMotion={reducedMotion} />
        </View>
        <View style={[styles.energyPill, limitReached ? styles.energyPillDone : null]}>
          <LobbySwapText text={dailyLimit > 0 ? (limitReached ? "Limit reached" : resetLabel) : "No limit"} style={[styles.energyPillText, limitReached ? styles.energyPillTextDone : null]} reducedMotion={reducedMotion} />
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

function ClockIcon() {
  return <Svg width={18} height={18} viewBox="0 0 18 18" fill="none"><Path d="M9 16.5C13.1421 16.5 16.5 13.1421 16.5 9C16.5 4.85786 13.1421 1.5 9 1.5C4.85786 1.5 1.5 4.85786 1.5 9C1.5 13.1421 4.85786 16.5 9 16.5Z" stroke="#F39C12" strokeWidth={1.875} strokeLinecap="round" strokeLinejoin="round" /><Path d="M9 4.5V9L12 10.5" stroke="#F39C12" strokeWidth={1.875} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function RewardIcon() {
  return <Svg width={18} height={18} viewBox="0 0 18 18"><Path d="M8.64376 1.72117C8.67662 1.65477 8.7274 1.59887 8.79035 1.55979C8.85329 1.52071 8.92591 1.5 9.00001 1.5C9.0741 1.5 9.14672 1.52071 9.20967 1.55979C9.27262 1.59887 9.32339 1.65477 9.35626 1.72117L11.0888 5.23042C11.2029 5.4614 11.3714 5.66123 11.5797 5.81276C11.7881 5.96429 12.0301 6.063 12.285 6.10042L16.1595 6.66742C16.2329 6.67806 16.3019 6.70902 16.3586 6.75682C16.4154 6.80462 16.4576 6.86733 16.4805 6.93788C16.5035 7.00842 16.5062 7.08398 16.4884 7.156C16.4707 7.22802 16.4331 7.29363 16.38 7.34542L13.578 10.0739C13.3932 10.254 13.255 10.4763 13.1751 10.7216C13.0953 10.967 13.0763 11.2281 13.1198 11.4824L13.7813 15.3374C13.7942 15.4108 13.7863 15.4863 13.7584 15.5554C13.7305 15.6245 13.6837 15.6844 13.6234 15.7282C13.5631 15.772 13.4917 15.7979 13.4174 15.8031C13.3431 15.8083 13.2688 15.7924 13.203 15.7574L9.73951 13.9364C9.51129 13.8166 9.25739 13.754 8.99963 13.754C8.74187 13.754 8.48797 13.8166 8.25976 13.9364L4.79701 15.7574C4.73126 15.7922 4.65705 15.8079 4.58285 15.8026C4.50864 15.7973 4.4374 15.7713 4.37723 15.7276C4.31706 15.6838 4.27038 15.6241 4.2425 15.5551C4.21462 15.4861 4.20665 15.4107 4.21951 15.3374L4.88026 11.4832C4.9239 11.2287 4.90499 10.9675 4.82516 10.722C4.74533 10.4764 4.60696 10.254 4.42201 10.0739L1.62001 7.34617C1.56645 7.29444 1.5285 7.22872 1.51048 7.15648C1.49246 7.08423 1.49508 7.00838 1.51807 6.93756C1.54105 6.86674 1.58346 6.8038 1.64046 6.75591C1.69747 6.70801 1.76678 6.67709 1.84051 6.66667L5.71426 6.10042C5.96945 6.06329 6.2118 5.96471 6.42044 5.81316C6.62909 5.66161 6.79778 5.46162 6.91201 5.23042L8.64376 1.72117Z" fill="#A06BFF" stroke="#A06BFF" strokeWidth={1.875} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function LobbyLoadingCard({ reducedMotion }: { reducedMotion: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  return (
    <LobbyReveal motionKey="lobby-loading" reducedMotion={reducedMotion}>
      <Animated.View style={{ opacity: pulse }}>
        <Card style={styles.emptyLoadingCard}>
          <Text style={styles.emptyEmoji}>⏳</Text>
          <Text style={styles.emptyLoadingTitle}>Checking your quest status</Text>
          <Text style={styles.emptyLoadingBody}>QuestLife is catching up with your latest adventure.</Text>
        </Card>
      </Animated.View>
    </LobbyReveal>
  );
}

function ActiveQuestCard({
  activeQuest,
  elapsedLabel,
  onView,
  reducedMotion,
}: {
  activeQuest: Quest;
  elapsedLabel: string;
  onView: () => void;
  reducedMotion: boolean;
}) {
  const category = categoryColor[activeQuest.category] ?? { text: activeQuest.color, bg: `${activeQuest.color}18` };
  const difficulty = difficultyColor[activeQuest.difficulty];

  return (
    <LobbyReveal motionKey={`active-quest-${activeQuest.id}`} reducedMotion={reducedMotion}>
      <View style={styles.activeWrap}>
        <View style={styles.activeCard}>
          <View style={styles.activeTopRow}>
            <View style={styles.metaRow}>
              <Tag label={activeQuest.category} color={category.text} bg={category.bg} />
              <Tag label={activeQuest.difficulty} color={difficulty.text} bg={difficulty.bg} />
            </View>
          </View>
          <View style={styles.activeCopy}>
            <Text style={styles.activeTitle} numberOfLines={1}>{activeQuest.title}</Text>
            <Text style={styles.activeDescription} numberOfLines={2}>{activeQuest.description}</Text>
          </View>
          <View style={styles.activeStats}>
            <View style={styles.activeStatCell}><View style={styles.timeIconWrap}><ClockIcon /></View><View style={styles.statCopy}><Text style={[styles.statLabel, styles.timeLabel]}>Time elapsed</Text><Text numberOfLines={1} style={[styles.statValue, styles.elapsedStatValue]}>{elapsedLabel}</Text></View></View>
            <View style={styles.statDivider} />
            <View style={styles.activeStatCell}><View style={styles.rewardIconWrap}><RewardIcon /></View><View style={styles.statCopy}><Text style={[styles.statLabel, styles.rewardLabel]}>Reward</Text><Text style={styles.statValue}>+{activeQuest.xp} XP</Text></View></View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`View active quest: ${activeQuest.title}`} onPress={() => { haptic(); onView(); }} style={({ pressed }) => [styles.activePrimaryButton, pressed ? styles.pressed : null]}><Ionicons name="navigate" size={18} color={T.white} /><Text style={styles.activePrimaryText}>View Active Quest</Text><Ionicons name="arrow-forward" size={18} color={T.white} /></Pressable>
        </View>
      </View>
    </LobbyReveal>
  );
}

function EmptyActiveQuest({
  loading,
  onExplore,
  reducedMotion,
}: {
  loading: boolean;
  onExplore: () => void;
  reducedMotion: boolean;
}) {
  if (loading) {
    return <LobbyLoadingCard reducedMotion={reducedMotion} />;
  }

  return (
    <LobbyReveal motionKey="empty-active-quest" reducedMotion={reducedMotion}>
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
    </LobbyReveal>
  );
}

function CompletedSection({
  completions,
  getQuest,
  onOpenJournal,
  reducedMotion,
}: {
  completions: { completionId: string; questId: string; xpAwarded: number; logged: boolean; completedAt: string }[];
  getQuest: (id?: string) => Quest | null;
  onOpenJournal: () => void;
  reducedMotion: boolean;
}) {
  const visibleCompletions = completions.slice(0, 3);

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Completed Today"
        leading={<CompletedHeadingIcon />}
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
        <LobbyReveal motionKey="completed-empty" reducedMotion={reducedMotion}>
          <Card style={styles.completedEmpty}>
            <View style={styles.completedEmptyIcon}>
              <Text style={styles.completedEmptyEmoji}>📋</Text>
            </View>
            <View style={styles.completedEmptyCopy}>
              <Text style={styles.completedEmptyTitle}>Nothing completed yet</Text>
              <Text style={styles.completedEmptyBody}>Finish a quest and it will land here.</Text>
            </View>
          </Card>
        </LobbyReveal>
      ) : (
        <View style={styles.completedList}>
          {visibleCompletions.map((completion, index) => {
            const quest = getQuest(completion.questId);
            return (
              <LobbyReveal key={completion.completionId} motionKey={`completion-${completion.completionId}`} delay={index * 45} reducedMotion={reducedMotion}>
                <Card style={styles.completedItem}>
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
              </LobbyReveal>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function LobbyScreen() {
  const router = useRouter();
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();
  const reducedMotion = useReducedMotionPreference();
  const { profileNameVersion, user } = useAuth();
  const { error: contentError, getQuest, loading, quests } = useContent();
  const { engine, error: engineError, loading: engineLoading, refresh, saveActiveForLater } = useQuestEngine();
  const { block, clearBlock, starting, tryStart } = useQuestStart(getQuest);

  const [savedSheet, setSavedSheet] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const { isCompact: compact } = getLobbyLayout(contentWidth);
  const now = new Date();
  useEffect(() => {
    let active = true;
    if (!user) return;
    void fetchRequiredProfileName(user.id)
      .then((profile) => {
        if (active) setFirstName(profile?.first_name?.trim() ?? "");
      })
      .catch(() => {
        if (active) setFirstName("");
      });
    void fetchOwnProfileAvatar(user.id)
      .then((url) => { if (active) setAvatarUrl(url); })
      .catch(() => { if (active) setAvatarUrl(null); });
    return () => { active = false; };
  }, [profileNameVersion, user?.id]);

  const activeQuest = engine?.activeSession ? getQuest(engine.activeSession.questId) : null;
  const activeQuestElapsed = useElapsedDuration(engine?.activeSession?.startedAt);
  const dailyUsed = engine?.dailyUsed ?? 0;
  const dailyLimit = engine?.dailyLimit ?? 5;
  const completions = engine?.todayCompletions ?? [];
  const lobbyStates = resolveLobbyStates({
    contentLoading: loading,
    contentError,
    engineLoading,
    engineError,
    hasActiveQuest: Boolean(activeQuest && engine?.activeSession),
    hasCompletions: completions.length > 0,
    feedback: savedSheet ? "success" : "idle",
  });

  async function handleSaveForLater() {
    await saveActiveForLater();
    setSavedSheet(true);
    await refresh();
  }

  return (
    <Screen padded={false} contentStyle={styles.screenContent}>
      <LobbyReveal motionKey="lobby-page" reducedMotion={reducedMotion}>
        <View
          style={[styles.container, { width: contentWidth, paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }]}
          testID={`lobby-${lobbyStates.request}-${lobbyStates.activity}-${lobbyStates.history}-${lobbyStates.feedback}`}
        >
        <View style={styles.header}>
          <LobbyAvatar uri={avatarUrl} onPress={() => router.navigate("/(tabs)/profile")} />
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
              {firstName || "Welcome"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <StreakPill compact={compact} />
            <LobbyBellButton onPress={() => router.push("/notifications")} />
          </View>
        </View>

        <EnergyCard dailyLimit={dailyLimit} dailyUsed={dailyUsed} reducedMotion={reducedMotion} />

        <View style={styles.section}>
          <SectionHeader icon="sparkles" title="Active Quest" />
          {activeQuest && engine?.activeSession ? (
            <ActiveQuestCard
              activeQuest={activeQuest}
              elapsedLabel={formatElapsedCompact(activeQuestElapsed)}
              onView={() => router.push("/active-quest")}
              reducedMotion={reducedMotion}
            />
          ) : (
            <EmptyActiveQuest
              loading={loading || engineLoading}
              onExplore={() => router.push("/explore")}
              reducedMotion={reducedMotion}
            />
          )}
        </View>

        <CompletedSection completions={completions} getQuest={getQuest} onOpenJournal={() => router.push("/journal")} reducedMotion={reducedMotion} />
        </View>
      </LobbyReveal>

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
              if (engine?.activeSession) router.push("/active-quest");
            }}
            onSaveActive={async () => {
              await handleSaveForLater();
              clearBlock();
            }}
            onRepeatQuest={async () => {
              if (block?.type !== "repeat_quest") return;
              const started = await tryStart({ questId: block.quest.id, source: "explore", confirmedRepeat: true });
              if (started) {
                await refresh();
                router.push("/active-quest");
              }
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
    gap: 8,
    paddingTop: 3,
    paddingBottom: 3,
  },
  energyHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  energyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  energyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  energyTitle: {
    color: T.dark,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
  },
  energySubtitle: {
    color: T.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  energyPill: {
    minWidth: 104,
    minHeight: 34,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
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
    gap: 12,
  },
  sectionHeader: {
    minHeight: 25,
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
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
  },
  sectionLink: {
    color: T.blue,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  metaRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  activeWrap: {
    position: "relative",
  },
  activeCard: {
    borderRadius: radius.sheet,
    borderWidth: 2,
    borderColor: T.border,
    backgroundColor: T.white,
    boxShadow: `4px 4px 0px ${T.border}`,
    padding: 18,
    gap: 16,
  },
  activeTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  activeTitle: {
    color: T.dark,
    fontFamily: "RubikBlack",
    fontWeight: "900",
    fontSize: 23,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  activeCopy: { gap: 5 },
  activeDescription: {
    color: T.muted,
    fontFamily: "Rubik",
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 19,
  },
  activeStats: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 70,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(232,223,213,0.5)",
    backgroundColor: "rgba(252,239,246,0.5)",
    overflow: "hidden",
  },
  activeStatCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  statCopy: {
    flexShrink: 1,
  },
  timeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(243,156,18,0.12)",
  },
  rewardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(160,107,255,0.12)",
  },
  statLabel: {
    fontFamily: "RubikBlack",
    fontWeight: "600",
    fontSize: 10,
    lineHeight: 14,
  },
  timeLabel: { color: T.orange },
  rewardLabel: { color: "#a06bff" },
  statValue: {
    color: T.dark,
    fontFamily: "RubikBlack",
    fontWeight: "900",
    fontSize: 17,
    lineHeight: 23,
  },
  elapsedStatValue: {
    flexShrink: 1,
    fontVariant: ["tabular-nums"],
  },
  statDivider: {
    width: 1,
    height: 49,
    alignSelf: "center",
    backgroundColor: "rgba(232,223,213,0.5)",
  },
  activePrimaryButton: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: T.blue,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    boxShadow: "0px 3px 0px rgba(49,140,223,0.42)",
  },
  activePrimaryText: {
    color: T.white,
    fontFamily: "RubikBold",
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 22,
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
    borderRadius: radius.lg,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 22,
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
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyLoadingBody: {
    color: T.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyQuestTitle: {
    color: T.dark,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },
  emptyQuestBody: {
    color: T.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  emptyActions: {
    alignSelf: "stretch",
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
    lineHeight: 20,
    fontWeight: "900",
  },
  completedEmptyBody: {
    color: T.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  completedList: {
    gap: 10,
  },
  completedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.lg,
    padding: 14,
    height: 80,
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
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },
  completedMeta: {
    color: T.muted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 18,
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
