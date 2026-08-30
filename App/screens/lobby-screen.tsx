import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";

import { getLobbyLayout, lobbyDesign, resolveLobbyStates } from "@/components/lobby-design";
import { ProfileAvatar } from "@/components/profile-avatar";
import { QuestStartBlockSheet } from "@/components/quest-start-block";
import { StreakPill } from "@/components/streak-pill";
import { categoryColor, difficultyColor, radius, T } from "@/components/theme";
import { Card, PillStat, Screen, Sheet, SoftButton, haptic, useResponsiveScreenLayout } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveQuest } from "@/contexts/ActiveQuestContext";
import { useContent } from "@/contexts/ContentContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { formatElapsedCompact, useElapsedDuration } from "@/hooks/useElapsedTime";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useQuestStart } from "@/hooks/useQuestStart";
import { Quest } from "@/types/content";
import { fetchOwnProfileAvatar, fetchRequiredProfileName } from "@/services/profile/profileService";
import { clearMyActiveQuestRecovery } from "@/services/engine/questEngineService";

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

function greetingFor(date: Date, hasCompletedQuestToday: boolean, shuffle: number) {
  const hour = date.getHours();
  const greetings = hour < 12
    ? ["Good morning", "Morning, ready for today?", "New day new quests."]
    : hour < 17
      ? ["Good afternoon", "Afternoon", ...(hasCompletedQuestToday ? ["Ready to continue?", "Keep up the momentum"] : [])]
      : hour < 21
        ? ["Good evening", "Evening", ...(hasCompletedQuestToday ? ["Finish strong", "Ready for one more?"] : [])]
        : ["Late night grind?", "Night owl?", "End strong."];

  return greetings[shuffle % greetings.length];
}

function LobbyAvatar({ uri, onPress }: { uri: string | null; onPress: () => void }) {
  const size = 50;
  const inner = 44;
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

function LobbyBellButton({ onPress, reducedMotion, hasUnreadNotifications }: { onPress: () => void; reducedMotion: boolean; hasUnreadNotifications: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion || !hasUnreadNotifications) {
      rotation.setValue(0);
      return;
    }

    const ring = () => {
      Animated.sequence([
        Animated.timing(rotation, { toValue: -1, duration: 75, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rotation, { toValue: 1, duration: 105, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(rotation, { toValue: -0.7, duration: 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(rotation, { toValue: 0, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    };

    const interval = setInterval(ring, 3_000);
    return () => {
      clearInterval(interval);
      rotation.stopAnimation();
    };
  }, [hasUnreadNotifications, reducedMotion, rotation]);

  return (
    <Pressable
      accessibilityLabel="Open notifications"
      accessibilityRole="button"
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [styles.bellButton, pressed ? styles.bellButtonPressed : null]}
    >
      <View style={styles.bellIconWell}>
        <Animated.View style={{ position: "relative", transform: [{ rotate: rotation.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-11deg", "0deg", "11deg"] }) }] }}>
          <LobbyBellGlyph hasUnreadNotifications={hasUnreadNotifications} />
        </Animated.View>
      </View>
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

function CompletedEmptyFlagIcon() {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" style={{ transform: [{ translateX: 2 }] }}><Path d="M5 3V21" stroke="#FF4560" strokeWidth={2} strokeLinecap="round" /><Path d="M5 4H17.5L14.5 8.5L17.5 13H5V4Z" fill="#FF4560" /></Svg>;
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
        <View style={[styles.energyPill, limitReached ? styles.energyPillDone : null, dailyLimit === 0 ? styles.energyPillUnlimited : null]}>
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
  return <Ionicons name="time" size={18} color={T.dark} />;
}

function RewardIcon() {
  return <Ionicons name="flash" size={18} color={T.blue} />;
}

function LobbyBellGlyph({ hasUnreadNotifications }: { hasUnreadNotifications: boolean }) {
  return <View style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
    <Ionicons name="notifications-outline" size={20} color={T.dark} />
    {hasUnreadNotifications ? <View style={{ position: "absolute", top: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: "#E85D3F", borderWidth: 1.5, borderColor: T.white }} /> : null}
  </View>;
}

function LobbySkeletonBlock({ width, height, radius = 8 }: { width: number | `${number}%`; height: number; radius?: number }) {
  return <View style={{ width, height, borderRadius: radius, backgroundColor: T.border }} />;
}

function LobbyLoadingSkeleton({ contentWidth, horizontalPadding, safeAreaOffset }: { contentWidth: number; horizontalPadding: number; safeAreaOffset: number }) {
  return <View accessibilityRole="progressbar" accessibilityLabel="Loading lobby" style={[styles.container, { width: contentWidth, paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }]}>
    <View style={styles.header}>
      <LobbySkeletonBlock width={58} height={58} radius={29} />
      <View style={{ flex: 1, gap: 7 }}><LobbySkeletonBlock width="64%" height={14} /><LobbySkeletonBlock width="46%" height={20} /></View>
      <LobbySkeletonBlock width={72} height={42} radius={21} />
      <LobbySkeletonBlock width={42} height={42} radius={21} />
    </View>

    <View style={styles.energySection}>
      <View style={styles.energyHeaderRow}><View style={{ flex: 1, gap: 7 }}><LobbySkeletonBlock width="46%" height={22} /><LobbySkeletonBlock width="78%" height={13} /></View><LobbySkeletonBlock width={104} height={34} radius={17} /></View>
      <LobbySkeletonBlock width="100%" height={18} radius={9} />
    </View>

    <View style={styles.section}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><LobbySkeletonBlock width={28} height={28} radius={14} /><LobbySkeletonBlock width={146} height={24} /></View>
      <Card style={{ minHeight: 300, borderRadius: radius.sheet, padding: 20, gap: 17 }}>
        <View style={{ flexDirection: "row", gap: 8 }}><LobbySkeletonBlock width={112} height={32} radius={16} /><LobbySkeletonBlock width={70} height={32} radius={16} /></View>
        <View style={{ gap: 9 }}><LobbySkeletonBlock width="78%" height={26} /><LobbySkeletonBlock width="100%" height={14} /><LobbySkeletonBlock width="72%" height={14} /></View>
        <View style={{ minHeight: 92, borderRadius: 22, backgroundColor: T.bg, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 14 }}><View style={{ flex: 1, gap: 8 }}><LobbySkeletonBlock width="48%" height={12} /><LobbySkeletonBlock width="74%" height={22} /></View><View style={{ width: 1, alignSelf: "stretch", backgroundColor: T.border }} /><View style={{ flex: 1, gap: 8 }}><LobbySkeletonBlock width="52%" height={12} /><LobbySkeletonBlock width="68%" height={22} /></View></View>
        <LobbySkeletonBlock width="100%" height={58} radius={20} />
      </Card>
    </View>

    <View style={styles.section}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><LobbySkeletonBlock width={28} height={28} radius={14} /><LobbySkeletonBlock width={176} height={24} /></View>
      <Card style={{ minHeight: 88, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 12 }}><LobbySkeletonBlock width={44} height={44} radius={14} /><View style={{ flex: 1, gap: 8 }}><LobbySkeletonBlock width="58%" height={16} /><LobbySkeletonBlock width="84%" height={12} /></View></Card>
    </View>
  </View>;
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
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const category = categoryColor[activeQuest.category] ?? { text: activeQuest.color, bg: `${activeQuest.color}18` };
  const difficulty = difficultyColor[activeQuest.difficulty];

  return (
    <LobbyReveal motionKey={`active-quest-${activeQuest.id}`} reducedMotion={reducedMotion}>
      <View style={styles.activeWrap}>
        <View style={styles.activeCard}>
          <View style={styles.activeTopRow}>
            <View style={styles.metaRow}>
              <ActiveQuestMetaPill label={activeQuest.category} color={category.text} background={category.bg} maxWidth="60%" />
              <ActiveQuestMetaPill label={activeQuest.difficulty} color={difficulty.text} background={difficulty.bg} maxWidth="34%" />
            </View>
          </View>
          <View style={styles.activeCopy}>
            <Text adjustsFontSizeToFit minimumFontScale={0.84} style={[styles.activeTitle, compact ? styles.activeTitleCompact : null]} numberOfLines={2}>{activeQuest.title}</Text>
            <Text style={styles.activeDescription} numberOfLines={2}>{activeQuest.description}</Text>
          </View>
          <View style={styles.activeStats}>
            <View style={styles.activeStatCell}><View style={styles.timeIconWrap}><ClockIcon /></View><View style={styles.statCopy}><Text style={[styles.statLabel, styles.timeLabel]}>Time</Text><Text numberOfLines={1} style={[styles.statValue, styles.elapsedStatValue]}>{elapsedLabel}</Text></View></View>
            <View style={styles.statDivider} />
            <View style={styles.activeStatCell}><View style={styles.rewardIconWrap}><RewardIcon /></View><View style={styles.statCopy}><Text style={[styles.statLabel, styles.rewardLabel]}>Reward</Text><Text style={styles.statValue}>+{activeQuest.xp} XP</Text></View></View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`View active quest: ${activeQuest.title}`} onPress={() => { haptic(); onView(); }} style={({ pressed }) => [styles.activePrimaryButton, pressed ? styles.pressed : null]}><Ionicons name="navigate" size={18} color={T.white} /><Text style={styles.activePrimaryText}>View Active Quest</Text><Ionicons name="arrow-forward" size={18} color={T.white} /></Pressable>
        </View>
      </View>
    </LobbyReveal>
  );
}

function RestoredActiveQuestCard({ onView, reducedMotion }: { onView: () => void; reducedMotion: boolean }) {
  return <LobbyReveal motionKey="restored-active-quest" reducedMotion={reducedMotion}>
    <Card style={{ borderRadius: 24, gap: 12, borderColor: `${T.blue}55`, backgroundColor: T.white }}>
      <View style={{ width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: `${T.blue}16` }}><Ionicons name="navigate" size={23} color={T.blue} /></View>
      <View style={{ gap: 4 }}>
        <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 21, lineHeight: 27 }}>Your active quest is ready</Text>
        <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 14, lineHeight: 20 }}>Open it to pick up where you left off.</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="View active quest" onPress={() => { haptic(); onView(); }} style={({ pressed }) => [styles.activePrimaryButton, pressed ? styles.pressed : null]}><Ionicons name="navigate" size={18} color={T.white} /><Text style={styles.activePrimaryText}>View Active Quest</Text><Ionicons name="arrow-forward" size={18} color={T.white} /></Pressable>
    </Card>
  </LobbyReveal>;
}

function ActiveQuestMetaPill({ label, color, background, maxWidth }: { label: string; color: string; background: string; maxWidth: `${number}%` }) {
  return <View style={{ maxWidth, minHeight: 32, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, alignSelf: "flex-start", justifyContent: "center", backgroundColor: background, borderWidth: 2, borderColor: color, borderBottomWidth: 4, borderBottomColor: `${color}88` }}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={{ color, fontFamily: "RubikBold", fontSize: 11, lineHeight: 14, letterSpacing: 0.55, textTransform: "uppercase" }}>{label}</Text></View>;
}

function EmptyActiveQuest({
  onExplore,
  reducedMotion,
}: {
  onExplore: () => void;
  reducedMotion: boolean;
}) {
  return (
    <LobbyReveal motionKey="empty-active-quest" reducedMotion={reducedMotion}>
      <Card style={styles.emptyActiveCard}>
        <View style={styles.emptyQuestCopy}>
          <Text style={styles.emptyQuestTitle}>Choose your next quest</Text>
          <Text style={styles.emptyQuestBody}>Find an adventure that fits your day.</Text>
        </View>
        <View style={styles.emptyActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Explore quests" onPress={() => { haptic(); onExplore(); }} style={({ pressed }) => [styles.activePrimaryButton, pressed ? styles.pressed : null]}><Ionicons name="compass" size={18} color={T.white} /><Text style={styles.activePrimaryText}>Explore quests</Text><Ionicons name="arrow-forward" size={18} color={T.white} /></Pressable>
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
              <CompletedEmptyFlagIcon />
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
  const { unreadCount } = useNotifications();
  const { engine, error: engineError, loading: engineLoading, refresh, saveActiveForLater, abandonActiveQuest } = useQuestEngine();
  const { snapshot } = useActiveQuest();
  const { block, clearBlock, tryStart } = useQuestStart(getQuest);

  const [savedSheet, setSavedSheet] = useState(false);
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [greetingShuffle] = useState(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
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
  const hasActiveSession = Boolean(engine?.activeSession);
  const recoveryRequired = Boolean(engine?.activeSession?.recoveryRequiredAt);
  const activeQuestElapsed = useElapsedDuration(engine?.activeSession?.startedAt);
  const recoveryDuration = snapshot?.session.sessionId === engine?.activeSession?.id
    ? snapshot?.session.activeDurationMs ?? 0
    : activeQuestElapsed;

  useEffect(() => {
    if (recoveryRequired) setRecoveryVisible(true);
  }, [recoveryRequired]);
  const dailyUsed = engine?.dailyUsed ?? 0;
  const dailyLimit = engine?.dailyLimit ?? 5;
  const completions = engine?.todayCompletions ?? [];
  const greeting = greetingFor(now, completions.length > 0, greetingShuffle);
  const lobbyStates = resolveLobbyStates({
    contentLoading: loading,
    contentError,
    engineLoading,
    engineError,
    hasActiveQuest: hasActiveSession,
    hasCompletions: completions.length > 0,
    feedback: savedSheet ? "success" : "idle",
  });
  const isInitialLobbyLoad = !contentError && !engineError && ((loading && !quests.length) || (engineLoading && !engine));

  async function handleSaveForLater() {
    await saveActiveForLater();
    setSavedSheet(true);
    await refresh();
  }

  return (
    <Screen padded={false} contentStyle={styles.screenContent}>
      {isInitialLobbyLoad ? <LobbyLoadingSkeleton contentWidth={contentWidth} horizontalPadding={horizontalPadding} safeAreaOffset={safeAreaOffset} /> : <LobbyReveal motionKey="lobby-page" reducedMotion={reducedMotion}>
        <View
          style={[styles.container, { width: contentWidth, paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }]}
          testID={`lobby-${lobbyStates.request}-${lobbyStates.activity}-${lobbyStates.history}-${lobbyStates.feedback}`}
        >
        <View style={styles.header}>
          <LobbyAvatar uri={avatarUrl} onPress={() => router.navigate("/(tabs)/profile")} />
          <View style={styles.headerCopy}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              style={[styles.greeting, greeting.length > 16 ? styles.greetingLong : null]}
              numberOfLines={1}
            >
              {greeting}
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
            <LobbyBellButton onPress={() => router.push("/notifications")} reducedMotion={reducedMotion} hasUnreadNotifications={unreadCount > 0} />
          </View>
        </View>

        <EnergyCard dailyLimit={dailyLimit} dailyUsed={dailyUsed} reducedMotion={reducedMotion} />

        <View style={styles.section}>
          <SectionHeader icon="sparkles" title={hasActiveSession ? "Active Quest" : "No Quest Is Active"} />
          {hasActiveSession ? activeQuest ? (
            <ActiveQuestCard
              activeQuest={activeQuest}
              elapsedLabel={formatElapsedCompact(activeQuestElapsed)}
              onView={() => router.push("/active-quest")}
              reducedMotion={reducedMotion}
            />
          ) : (
            <RestoredActiveQuestCard onView={() => router.push("/active-quest")} reducedMotion={reducedMotion} />
          ) : (
            <EmptyActiveQuest
              onExplore={() => router.push("/explore")}
              reducedMotion={reducedMotion}
            />
          )}
        </View>

        <CompletedSection completions={completions} getQuest={getQuest} onOpenJournal={() => router.push("/journal")} reducedMotion={reducedMotion} />
        </View>
      </LobbyReveal>}

      <Sheet visible={savedSheet} onClose={() => setSavedSheet(false)}>
        <View style={styles.savedSheet}>
          <Text style={styles.savedEmoji}>🔖</Text>
          <Text style={styles.savedTitle}>Saved for later</Text>
          <Text style={styles.savedBody}>Your quest is waiting in My Stuff whenever you're ready.</Text>
          <SoftButton label="Got it" onPress={() => setSavedSheet(false)} style={styles.fullWidth} />
        </View>
      </Sheet>

      <Sheet visible={recoveryVisible && recoveryRequired} onClose={() => undefined} maxHeight="76%">
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 14 }}>
          <View style={{ alignItems: "center", gap: 7 }}>
            <View style={{ width: 58, height: 58, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: `${activeQuest?.color ?? T.blue}16` }}><Ionicons name="time-outline" size={29} color={activeQuest?.color ?? T.blue} /></View>
            <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 24, textAlign: "center" }}>You left a quest in progress</Text>
            <Text style={{ color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" }}>{activeQuest?.title ?? "Your active quest"} has been waiting for you.</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, minHeight: 82, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: `${activeQuest?.color ?? T.blue}0e`, borderWidth: 1, borderColor: `${activeQuest?.color ?? T.blue}30` }}><Ionicons name="time-outline" size={20} color={activeQuest?.color ?? T.blue} /><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16, fontVariant: ["tabular-nums"] }}>{formatElapsedCompact(recoveryDuration)}</Text><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 10, textTransform: "uppercase" }}>Time spent</Text></View>
            <View style={{ flex: 1, minHeight: 82, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: `${activeQuest?.color ?? T.blue}0e`, borderWidth: 1, borderColor: `${activeQuest?.color ?? T.blue}30` }}><Ionicons name="camera-outline" size={20} color={activeQuest?.color ?? T.blue} /><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16 }}>{snapshot?.photoCount ?? 0}</Text><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 10, textTransform: "uppercase" }}>Photos</Text></View>
            <View style={{ flex: 1, minHeight: 82, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: `${activeQuest?.color ?? T.blue}0e`, borderWidth: 1, borderColor: `${activeQuest?.color ?? T.blue}30` }}><Ionicons name="document-text-outline" size={20} color={activeQuest?.color ?? T.blue} /><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16 }}>{snapshot?.activity.filter((item) => item.kind === "note").length ?? 0}</Text><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 10, textTransform: "uppercase" }}>Notes</Text></View>
          </View>
          <SoftButton label="Resume quest" icon="play" color={activeQuest?.color ?? T.blue} onPress={() => void (async () => { await clearMyActiveQuestRecovery(); await refresh(); setRecoveryVisible(false); router.push("/active-quest"); })()} />
          <SoftButton label="Save to Journal" icon="book-outline" inverse color={activeQuest?.color ?? T.blue} onPress={() => { setRecoveryVisible(false); router.push({ pathname: "/active-quest", params: { saveToJournal: "1" } }); }} />
          <SoftButton label="Abandon quest" inverse color={T.muted} onPress={() => void (async () => { await abandonActiveQuest(); await refresh(); setRecoveryVisible(false); })()} />
        </View>
      </Sheet>

      <Sheet visible={block !== null} onClose={clearBlock}>
        <View style={styles.sheetContent}>
          <QuestStartBlockSheet
            block={block}
            onClose={clearBlock}
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
    marginTop: -8,
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
  greetingLong: {
    fontSize: 16,
    lineHeight: 19,
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
    borderWidth: 2,
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
    borderColor: T.dark,
    borderBottomWidth: 4,
    borderBottomColor: `${T.dark}88`,
    alignItems: "center",
    justifyContent: "center",
  },
  bellButtonPressed: {
    borderBottomWidth: 2,
    transform: [{ scale: 0.96 }, { translateY: 2 }],
  },
  bellIconWell: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: `${T.dark}16`,
    alignItems: "center",
    justifyContent: "center",
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
  energyPillUnlimited: {
    backgroundColor: `${T.cyan}14`,
    borderWidth: 2,
    borderColor: T.cyan,
    borderBottomWidth: 4,
    borderBottomColor: `${T.cyan}88`,
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
    minHeight: 300,
  },
  activeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: -7,
  },
  activeTitle: {
    color: T.dark,
    fontWeight: "900",
    fontSize: 23,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  activeTitleCompact: {
    fontSize: 21,
    lineHeight: 26,
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
    backgroundColor: "#f2eef2",
  },
  rewardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.blue}14`,
  },
  statLabel: {
    fontFamily: "RubikBlack",
    fontWeight: "600",
    fontSize: 15.5,
    lineHeight: 20,
  },
  timeLabel: { color: T.dark },
  rewardLabel: { color: T.blue },
  statValue: {
    color: T.dark,
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
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: T.blue,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    borderBottomWidth: 6,
    borderBottomColor: "#258fd8",
  },
  activePrimaryText: {
    color: T.white,
    fontFamily: "RubikBold",
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 22,
  },
  emptyActiveCard: {
    borderRadius: radius.sheet,
    borderWidth: 2,
    borderColor: T.border,
    backgroundColor: T.white,
    boxShadow: `4px 4px 0px ${T.border}`,
    alignItems: "stretch",
    gap: 20,
    padding: 20,
  },
  emptyQuestCopy: {
    gap: 4,
  },
  emptyQuestTitle: {
    color: T.dark,
    fontFamily: "RubikBlack",
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900",
  },
  emptyQuestBody: {
    color: T.muted,
    fontFamily: "Rubik",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  emptyActions: {
    alignSelf: "stretch",
    gap: 10,
  },
  completedEmpty: {
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  completedEmptyIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#FF456014",
    alignItems: "center",
    justifyContent: "center",
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
