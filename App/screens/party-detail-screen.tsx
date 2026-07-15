import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Reanimated, { Easing, FadeIn, FadeInDown, FadeOutUp, ZoomIn, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { PartyCategoryIcon } from "@/components/party-category-icon";
import { T } from "@/components/theme";
import { EmptyState, IconButton, Screen, Sheet, SoftButton, Tag, haptic, useResponsiveScreenLayout } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useSocial } from "@/contexts/SocialContext";
import { supabase } from "@/lib/supabase";
import { resolvePartyMedia, uploadJournalMedia, uploadPartyMedia } from "@/services/social/socialService";
import { Quest, questCategories, QuestCategory, questCategoryColors } from "@/types/content";
import { PartyCompletedQuest, PartyCompletionResult, PartyDetail, PartyFeedPost, PartyLeaderboardEntry, PartyQuest, PartyQuestSuggestion } from "@/types/social";

type EndRoundPrompt = { completed: number; total: number } | null;
type PartyTab = "quests" | "feed" | "leaderboard";
type CompletionCelebration = { quest: PartyQuest; result: PartyCompletionResult } | null;

function elapsed(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m ${seconds % 60}s`;
}

function partyElapsed(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return days ? `${days}d ${hours}h ${minutes}m ${remainder}s` : hours ? `${hours}h ${minutes}m ${remainder}s` : `${minutes}m ${remainder}s`;
}

function formatDuration(seconds?: number | null) {
  if (seconds == null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function messageFromError(error: unknown, fallback = "Please try again.") {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

type QuestPickerSort = "Recommended" | "Most XP" | "Shortest" | "Longest";

function sortPickerQuests(quests: Quest[], sort: QuestPickerSort) {
  const next = [...quests];
  if (sort === "Most XP") return next.sort((a, b) => b.xp - a.xp);
  if (sort === "Shortest") return next.sort((a, b) => a.timeMin - b.timeMin);
  if (sort === "Longest") return next.sort((a, b) => b.timeMin - a.timeMin);
  return next.sort((a, b) => Number(b.featured) - Number(a.featured) || b.xp - a.xp || a.title.localeCompare(b.title));
}

function Avatar({ emoji, color, size = 40 }: { emoji: string; color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: `${color}1b`, borderWidth: 2, borderColor: T.white }}><Text style={{ fontSize: size * 0.44 }}>{emoji}</Text></View>;
}

function darkerButtonEdge(color: string) {
  const match = /^#([\da-f]{6})$/i.exec(color);
  if (!match) return color;

  const toChannel = (offset: number) => Math.round(parseInt(match[1].slice(offset, offset + 2), 16) * 0.78).toString(16).padStart(2, "0");
  return `#${toChannel(0)}${toChannel(2)}${toChannel(4)}`;
}

function PartyButton({ label, icon, color = T.blue, onPress, disabled = false, compact = false, muted = false }: { label: string; icon?: keyof typeof Ionicons.glyphMap; color?: string; onPress?: () => void; disabled?: boolean; compact?: boolean; muted?: boolean }) {
  const lowerEdge = color === T.blue ? "#258fd8" : color === T.purple ? "#7973c7" : color === T.green ? "#20894d" : color === T.red ? "#d73b57" : darkerButtonEdge(color);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => { if (!disabled) haptic(); onPress?.(); }} style={({ pressed }) => ({ minHeight: compact ? 44 : 58, paddingHorizontal: compact ? 14 : 18, borderRadius: compact ? 16 : 20, backgroundColor: disabled ? T.border : muted ? "#a9c9e7" : color, borderBottomWidth: compact ? 4 : 6, borderBottomColor: disabled ? "#d7cec2" : muted ? "#86afd5" : lowerEdge, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.6 : 1, transform: [{ translateY: pressed && !disabled ? 3 : 0 }] })}>
    {icon ? <Ionicons name={icon} size={compact ? 16 : 19} color={T.white} /> : null}
    <Text style={{ color: T.white, fontSize: compact ? 12 : 15, fontWeight: "900", letterSpacing: compact ? 0.42 : 0.5, textTransform: "uppercase" }}>{label}</Text>
  </Pressable>;
}

function Badge({ value, symbol = false }: { value: number; symbol?: boolean }) {
  if (!value) return null;
  return <View style={{ minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: T.red, alignItems: "center", justifyContent: "center" }}><Text style={{ color: T.white, fontSize: 10, lineHeight: 12, fontWeight: "900" }}>{symbol ? "!" : value > 9 ? "9+" : value}</Text></View>;
}

function PartyTabs({ active, unreadFeed, unreadLeaderboard, onChange }: { active: PartyTab; unreadFeed: number; unreadLeaderboard: number; onChange: (next: PartyTab) => void }) {
  return <View style={{ flexDirection: "row", padding: 4, borderRadius: 23, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }}>
    {(["quests", "feed", "leaderboard"] as PartyTab[]).map((tab) => {
      const selected = active === tab;
      const unread = tab === "feed" ? unreadFeed : tab === "leaderboard" ? unreadLeaderboard : 0;
      return <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(tab)} style={({ pressed }) => ({ flex: 1, minHeight: 40, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: selected ? T.dark : "transparent", transform: [{ scale: pressed ? 0.97 : 1 }] })}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Text style={{ color: selected ? T.white : T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.35, textTransform: "uppercase" }}>{tab}</Text><Badge value={unread} symbol={tab === "leaderboard"} /></View>
      </Pressable>;
    })}
  </View>;
}

function PartyHeader({ party, onBack, onInfo }: { party: PartyDetail; onBack: () => void; onInfo: () => void }) {
  const [, tick] = useState(0);
  const accent = party.gameMode === "everyone_together" ? T.purple : T.pink;
  const liveStartedAt = party.status === "active" ? party.partyStartedAt ?? (party.gameMode === "everyone_together" ? party.activeRound?.startedAt ?? null : null) : null;
  const waitingCopy = party.status === "ended" ? "This Party has ended" : party.gameMode === "everyone_together" ? "Waiting for the host to start a quest" : party.questsEnabled ? "Quest list is open" : "Waiting for the host to open quests";

  useEffect(() => {
    if (!liveStartedAt) return;
    const interval = setInterval(() => tick((value) => value + 1), 1_000);
    return () => clearInterval(interval);
  }, [liveStartedAt]);

  return <View style={{ gap: 13 }}>
    <View style={{ minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <IconButton icon="arrow-back" label="Back to Parties" color={T.muted} onPress={onBack} />
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 24, lineHeight: 29 }} numberOfLines={2}>{party.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <View style={{ flexDirection: "row", paddingLeft: 2 }}>{party.members.slice(0, 4).map((member, index) => <View key={member.userId} style={{ marginLeft: index ? -9 : 0 }}><Avatar emoji={member.emoji} color={member.avatarColor} size={27} /></View>)}</View>
          <Text style={{ color: T.muted, fontSize: 12, fontWeight: "900" }}>{party.memberCount} {party.memberCount === 1 ? "member" : "members"}</Text>
          <Tag label={party.gameMode === "everyone_together" ? "Together" : "Free for all"} color={accent} bg={`${accent}18`} />
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Party Info" onPress={() => { haptic(); onInfo(); }} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 11, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: T.white, borderWidth: 2, borderBottomWidth: 4, borderColor: `${T.blue}4a`, borderBottomColor: `${T.blue}78`, transform: [{ translateY: pressed ? 2 : 0 }] })}>
        <Ionicons name="information-circle" size={16} color={T.blue} /><Text style={{ color: T.blue, fontSize: 11, fontWeight: "900" }}>Party info</Text>
      </Pressable>
    </View>
    {party.goal ? <Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }} numberOfLines={2}>{party.goal}</Text> : null}
    {liveStartedAt ? <View accessibilityLiveRegion="polite" accessibilityLabel={`Party live for ${partyElapsed(liveStartedAt)}`} style={{ minHeight: 62, borderRadius: 17, paddingHorizontal: 14, backgroundColor: `${accent}14`, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", left: 14, flexDirection: "row", alignItems: "center", gap: 7 }}><View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: accent }} /><Text style={{ color: accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 }}>LIVE</Text></View>
      <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{partyElapsed(liveStartedAt)}</Text>
    </View> : <View style={{ minHeight: 52, borderRadius: 16, paddingHorizontal: 14, backgroundColor: `${accent}0d`, flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons name={party.status === "ended" ? "flag-outline" : "lock-closed-outline"} size={17} color={accent} /><Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>{waitingCopy}</Text></View>}
  </View>;
}

function EmptyActiveQuest({ party, onOpenQuestList, onInvite }: { party: PartyDetail; onOpenQuestList: () => void; onInvite: () => void }) {
  const needsCrew = party.memberCount < 2;
  const freePlayPaused = party.gameMode === "free_for_all" && !party.questsEnabled;
  const message = needsCrew ? (party.isHost ? "Invite one more adventurer before your Party can begin." : "This Party needs one more adventurer before it can begin.") : party.gameMode === "everyone_together" ? (party.isHost ? "Choose a quest for your crew." : "Your host will start the next quest.") : freePlayPaused ? (party.isHost ? "Open the quest list when your crew is ready." : "Your host will open the quest list soon.") : "Pick any Party quest to begin.";
  return <View style={{ minHeight: 126, borderRadius: 20, borderWidth: 2, borderStyle: "dashed", borderColor: `${T.blue}55`, backgroundColor: T.white, padding: 18, alignItems: "center", justifyContent: "center", gap: 7 }}>
    <View style={{ width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${T.blue}15` }}><Ionicons name={party.gameMode === "everyone_together" ? "people" : "play"} size={20} color={T.blue} /></View>
    <Text style={{ color: T.dark, fontSize: 16, fontWeight: "900" }}>No active quest</Text>
    <Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center" }}>{message}</Text>
    {needsCrew && party.isHost ? <PartyButton compact label="Invite friends" icon="person-add" onPress={onInvite} /> : freePlayPaused && party.isHost ? <PartyButton compact label="Open quest list" icon="play" onPress={onOpenQuestList} /> : null}
  </View>;
}

function ActiveQuestCard({ party, quest, category, onComplete, onEnd, onAbandon, remoteStart }: { party: PartyDetail; quest: PartyQuest; category: QuestCategory; onComplete: () => void; onEnd: () => void; onAbandon: () => void; remoteStart: boolean }) {
  const [, tick] = useState(0);
  const reducedMotion = useReducedMotion();
  const startedAt = party.activeRound?.startedAt;
  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => tick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  const isShared = party.gameMode === "everyone_together";
  const isComplete = isShared && quest.myCompletion;
  const finishers = party.activeRound?.topFinishers ?? [];
  const viewerId = party.members[0]?.userId;
  const viewerFinish = finishers.find((finisher) => finisher.userId === viewerId);
  const animation = reducedMotion ? FadeIn.duration(1) : remoteStart ? FadeInDown.duration(320) : ZoomIn.duration(260);
  return <Reanimated.View entering={animation} style={{ borderRadius: 22, borderWidth: 2, borderColor: `${quest.color}58`, borderBottomWidth: 6, borderBottomColor: `${quest.color}88`, backgroundColor: T.white, padding: 16, gap: 13 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Tag label={isShared ? "Live shared quest" : "Your active quest"} color={quest.color} bg={`${quest.color}18`} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Ionicons name="time-outline" size={15} color={T.muted} /><Text style={{ color: T.muted, fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{startedAt ? elapsed(startedAt) : "In progress"}</Text></View>
    </View>
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <View style={{ width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: `${quest.color}18` }}><PartyCategoryIcon category={category} size={25} color={quest.color} /></View>
      <View style={{ flex: 1, gap: 3 }}><Text style={{ color: T.dark, fontSize: 19, lineHeight: 24, fontFamily: "RubikBlack" }}>{quest.title}</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }} numberOfLines={2}>{quest.description}</Text></View>
    </View>
    {isShared && party.activeRound ? <View style={{ flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 14, backgroundColor: `${T.purple}10`, gap: 7 }}><Ionicons name="people" size={17} color={T.purple} /><Text style={{ flex: 1, color: T.purple, fontSize: 12, fontWeight: "900" }}>{party.activeRound.completedCount ?? 0}/{party.activeRound.totalMembers ?? party.memberCount} finished</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "800" }}>Top 3 earn a bonus</Text></View> : null}
    {isShared && finishers.length ? <View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" }}>Fastest so far</Text>{finishers.slice(0, 3).map((finisher) => <View key={finisher.userId} style={{ minHeight: 31, paddingHorizontal: 9, borderRadius: 11, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: `${finisher.rank === 1 ? T.orange : T.purple}10` }}><Text style={{ color: finisher.rank === 1 ? T.orange : T.purple, fontSize: 12, fontWeight: "900" }}>#{finisher.rank}</Text><Text style={{ fontSize: 14 }}>{finisher.emoji}</Text><Text style={{ flex: 1, color: T.dark, fontSize: 12, fontWeight: "800" }}>{finisher.name}</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{formatDuration(finisher.elapsedSeconds)}</Text></View>)}{viewerFinish && viewerFinish.rank > 3 ? <View style={{ minHeight: 31, paddingHorizontal: 9, borderRadius: 11, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: `${T.blue}10` }}><Text style={{ color: T.blue, fontSize: 12, fontWeight: "900" }}>#{viewerFinish.rank}</Text><Text style={{ fontSize: 14 }}>{viewerFinish.emoji}</Text><Text style={{ flex: 1, color: T.dark, fontSize: 12, fontWeight: "800" }}>Your time</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{formatDuration(viewerFinish.elapsedSeconds)}</Text></View> : null}</View> : null}
    {isComplete ? <View style={{ minHeight: 46, borderRadius: 15, backgroundColor: `${T.green}15`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}><Ionicons name="checkmark-circle" size={20} color={T.green} /><Text style={{ color: T.green, fontSize: 13, fontWeight: "900" }}>Completed — cheering on the crew</Text></View> : <><PartyButton label="Complete Quest" icon="checkmark" color={quest.color} onPress={onComplete} />{!isShared ? <SoftButton label="Abandon quest" icon="close-circle" inverse color={T.red} onPress={onAbandon} style={{ minHeight: 44 }} /> : null}</>}
    {party.isHost && isShared ? <SoftButton label="End quest" icon="flag" inverse color={T.purple} onPress={onEnd} style={{ minHeight: 44 }} /> : null}
  </Reanimated.View>;
}

function QuestRow({ quest, party, category, launching, locked, onStart, onLocked }: { quest: PartyQuest; party: PartyDetail; category: QuestCategory; launching: boolean; locked: boolean; onStart: () => void; onLocked: () => void }) {
  const reducedMotion = useReducedMotion();
  const waitingForHost = party.gameMode === "everyone_together" && !party.isHost;
  const freePlayPaused = party.gameMode === "free_for_all" && !party.questsEnabled;
  return <Reanimated.View exiting={launching && !reducedMotion ? FadeOutUp.duration(180) : undefined} style={{ borderRadius: 19, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#e6ddd2", backgroundColor: T.white, padding: 13, gap: 10 }}>
    <View style={{ flexDirection: "row", gap: 11, alignItems: "center" }}>
      <View style={{ width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: `${quest.color}18` }}><PartyCategoryIcon category={category} size={27} color={quest.color} /></View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ flex: 1, color: T.dark, fontSize: 16, fontWeight: "900" }} numberOfLines={1}>{quest.title}</Text><Tag label={`+${quest.xp}`} color={quest.color} bg={`${quest.color}18`} /></View>
        <Text style={{ color: T.muted, fontSize: 11, lineHeight: 16, fontWeight: "800" }}>+{quest.xp} XP</Text>
        <Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }} numberOfLines={2}>{quest.description}</Text>
      </View>
    </View>
    {quest.suggestionCount ? <Text style={{ color: T.purple, fontSize: 11, fontWeight: "900" }}>{quest.suggestionCount}× suggested by the crew</Text> : null}
    {waitingForHost || freePlayPaused ? <View style={{ minHeight: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}><Text style={{ color: T.muted, fontSize: 12, fontWeight: "900" }}>{waitingForHost ? "Waiting for host to start" : "Quest list opens when your host is ready"}</Text></View> : <PartyButton compact muted={locked} label={locked ? "Finish current quest first" : party.gameMode === "everyone_together" ? "Start shared quest" : "Start quest"} icon={locked ? "lock-closed" : party.gameMode === "everyone_together" ? "play" : "rocket"} color={party.gameMode === "everyone_together" ? T.purple : T.blue} onPress={locked ? onLocked : onStart} />}
  </Reanimated.View>;
}

function CompletedQuestRow({ quest, shared }: { quest: PartyCompletedQuest; shared: boolean }) {
  return <View style={{ minHeight: 64, borderRadius: 17, padding: 11, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, borderBottomWidth: 4, borderBottomColor: "#e6ddd2", flexDirection: "row", alignItems: "center", gap: 10 }}>
    <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: `${quest.color}17`, alignItems: "center", justifyContent: "center" }}><PartyCategoryIcon category={quest.category} size={21} /></View>
    <View style={{ flex: 1, gap: 3 }}><Text style={{ color: T.dark, fontSize: 14, fontWeight: "900" }} numberOfLines={1}>{quest.title}</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "800" }}>{shared ? `${quest.completedCount} crew members finished` : `Completed ${new Date(quest.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}</Text></View>
    <View style={{ alignItems: "flex-end", gap: 3 }}><Ionicons name="checkmark-circle" size={19} color={T.green} /><Text style={{ color: T.green, fontSize: 10, fontWeight: "900" }}>+{quest.xp} XP</Text></View>
  </View>;
}

function FeedSkeletonBlock({ width = "100%", height, radius = 9 }: { width?: number | `${number}%`; height: number; radius?: number }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.56);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    opacity.value = reducedMotion ? 0.56 : withRepeat(withTiming(0.28, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [opacity, reducedMotion]);

  return <Reanimated.View style={[{ width, height, borderRadius: radius, backgroundColor: T.border }, pulseStyle]} />;
}

function FeedPostSkeleton({ media = true }: { media?: boolean }) {
  return <View accessibilityRole="progressbar" accessibilityLabel="Loading Party post" style={{ borderRadius: 22, borderWidth: 2, borderColor: T.border, borderBottomWidth: 4, borderBottomColor: "#e6ddd2", backgroundColor: T.white, padding: 18, gap: 13 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <FeedSkeletonBlock width={42} height={42} radius={21} />
      <View style={{ flex: 1, gap: 7 }}><FeedSkeletonBlock width="46%" height={14} /><FeedSkeletonBlock width="31%" height={11} /></View>
      <FeedSkeletonBlock width={20} height={20} radius={10} />
    </View>
    <View style={{ gap: 7 }}><FeedSkeletonBlock width="91%" height={13} /><FeedSkeletonBlock width="58%" height={13} /></View>
    {media ? <FeedSkeletonBlock height={218} radius={16} /> : null}
    <View style={{ gap: 9 }}><FeedSkeletonBlock width="20%" height={11} /><FeedSkeletonBlock width={58} height={20} radius={10} /></View>
  </View>;
}

function PartyFeedLoading() {
  return <View accessibilityLabel="Loading Party Feed" style={{ gap: 11 }}><FeedPostSkeleton /><FeedPostSkeleton media={false} /></View>;
}

function FeedPostCard({ post, onReact }: { post: PartyFeedPost; onReact: (emoji: string) => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  const reducedMotion = useReducedMotion();
  const photoPathsKey = post.photoPaths.join("\u0001");
  useEffect(() => {
    let mounted = true;
    const photoPaths = photoPathsKey ? photoPathsKey.split("\u0001") : [];
    if (!photoPaths.length) { setUrls((current) => current.length ? [] : current); return; }
    resolvePartyMedia(photoPaths).then((next) => {
      if (!mounted) return;
      const nextUrls = next.filter((url): url is string => Boolean(url));
      setUrls((current) => current.length === nextUrls.length && current.every((url, index) => url === nextUrls[index]) ? current : nextUrls);
    }).catch(() => { if (mounted) setUrls((current) => current.length ? [] : current); });
    return () => { mounted = false; };
  }, [photoPathsKey]);
  const bodyCopy = post.caption?.trim() || (post.postType === "activity" ? `Completed “${post.questTitle}”` : null);
  const heart = post.reactions.find((reaction) => reaction.emoji === "💙");
  const secondsSincePosting = Math.max(0, Math.floor((Date.now() - new Date(post.createdAt).getTime()) / 1000));
  const minutesSincePosting = Math.floor(secondsSincePosting / 60);
  const postedLabel = minutesSincePosting < 1 ? "Just now" : minutesSincePosting < 60 ? `${minutesSincePosting} min ago` : minutesSincePosting < 1440 ? `${Math.floor(minutesSincePosting / 60)} hr ago` : `${Math.floor(minutesSincePosting / 1440)} days ago`;

  return <Reanimated.View entering={reducedMotion ? FadeIn.duration(1) : FadeInDown.duration(180)} style={{ borderRadius: 22, borderWidth: 2, borderColor: T.border, borderBottomWidth: 4, borderBottomColor: "#e6ddd2", backgroundColor: T.white, overflow: "hidden" }}>
    <View style={{ padding: 18, gap: 13 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: T.bg, borderWidth: 2, borderColor: T.border }}><Text style={{ fontSize: 21 }}>{post.userEmoji}</Text></View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ color: T.dark, fontSize: 16, lineHeight: 20, fontWeight: "900" }} numberOfLines={1}>{post.userName}</Text>
          <Text style={{ color: T.muted, fontSize: 12, lineHeight: 16, fontWeight: "700" }} numberOfLines={1}>{post.questTitle} · {formatDuration(post.elapsedSeconds)}</Text>
        </View>
        <Ionicons name={post.postType === "proof" ? "shield-checkmark" : "checkmark-circle"} size={20} color={post.postType === "proof" ? T.orange : T.green} />
      </View>

      {bodyCopy ? <Text style={{ color: T.dark, fontSize: 15, lineHeight: 22, fontWeight: "700" }}>{bodyCopy}</Text> : null}

      {photoPathsKey && !urls.length ? <FeedSkeletonBlock height={218} radius={16} /> : null}
      {urls.length === 1 ? <Image source={{ uri: urls[0], cache: "force-cache" }} style={{ width: "100%", height: 218, borderRadius: 16, backgroundColor: T.border }} resizeMode="cover" /> : null}
      {urls.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>{urls.map((url) => <Image key={url} source={{ uri: url, cache: "force-cache" }} style={{ width: 188, height: 144, borderRadius: 16, backgroundColor: T.border }} resizeMode="cover" />)}</ScrollView> : null}

      <View style={{ gap: 7 }}>
        <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>{postedLabel}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={heart?.reacted ? "Unlike this Party post" : "Like this Party post"} accessibilityState={{ selected: Boolean(heart?.reacted) }} onPress={() => onReact("💙")} style={({ pressed }) => ({ alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 2, flexDirection: "row", alignItems: "center", gap: 7, opacity: pressed ? 0.72 : 1 })}>
          <Ionicons name={heart?.reacted ? "heart" : "heart-outline"} size={23} color={heart?.reacted ? T.pink : T.muted} />
          <Text style={{ color: heart?.reacted ? T.pink : T.muted, fontSize: 13, fontWeight: "900" }}>{heart?.count ? heart.count : "Like"}</Text>
        </Pressable>
      </View>
    </View>
  </Reanimated.View>;
}

function LeaderboardConfetti() {
  const pieces: { left: `${number}%`; top: number; color: string; width: number; height: number; rotate: string }[] = [
    { left: "3%", top: 47, color: T.green, width: 26, height: 3, rotate: "-45deg" },
    { left: "16%", top: 18, color: T.orange, width: 9, height: 9, rotate: "0deg" },
    { left: "30%", top: 43, color: T.red, width: 18, height: 3, rotate: "35deg" },
    { left: "66%", top: 16, color: T.yellow, width: 9, height: 9, rotate: "0deg" },
    { left: "78%", top: 49, color: T.purple, width: 20, height: 3, rotate: "-25deg" },
    { left: "91%", top: 28, color: T.red, width: 26, height: 3, rotate: "-12deg" },
  ];
  return <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 104, overflow: "hidden" }}>{pieces.map((piece, index) => <View key={index} style={{ position: "absolute", left: piece.left, top: piece.top, width: piece.width, height: piece.height, borderRadius: piece.height, backgroundColor: piece.color, transform: [{ rotate: piece.rotate }] }} />)}</View>;
}

function PodiumPlayer({ entry, placement }: { entry?: PartyLeaderboardEntry; placement: 1 | 2 | 3 }) {
  const accent = placement === 1 ? T.yellow : placement === 2 ? T.blue : T.red;
  const avatarSize = placement === 1 ? 92 : 68;
  const podiumHeight = placement === 1 ? 82 : placement === 2 ? 62 : 52;
  const rank = entry?.rank ?? placement;
  if (!entry) return <View style={{ flex: 1, minWidth: 0, height: 282 }} />;
  return <View style={{ flex: 1, minWidth: 0, height: 282, alignItems: "center", justifyContent: "flex-end" }}>
    <View style={{ position: "relative", marginTop: placement === 1 ? 25 : 0 }}>
      {placement === 1 ? <Text style={{ position: "absolute", top: -34, left: 0, right: 0, textAlign: "center", fontSize: 31, lineHeight: 34 }}>👑</Text> : null}
      <View style={{ width: avatarSize + 8, height: avatarSize + 8, borderRadius: (avatarSize + 8) / 2, padding: 4, backgroundColor: `${accent}25`, borderWidth: 3, borderColor: accent }}><Avatar emoji={entry.emoji} color={entry.avatarColor} size={avatarSize} /></View>
    </View>
    <Text style={{ width: "100%", marginTop: 10, paddingHorizontal: 3, color: T.dark, fontSize: placement === 1 ? 15 : 13, lineHeight: 18, fontWeight: "900", textAlign: "center" }} numberOfLines={1}>{entry.displayName}</Text>
    <Text style={{ marginTop: 2, color: "#655a60", fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{entry.xp} XP</Text>
    <View style={{ width: "100%", height: podiumHeight, marginTop: 16, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderTopWidth: 2, borderColor: `${accent}70`, backgroundColor: `${accent}18`, alignItems: "center", justifyContent: "center" }}>
      <View accessibilityLabel={`Rank ${rank}`} style={{ position: "absolute", top: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: accent, borderWidth: 3, borderColor: T.bg, alignItems: "center", justifyContent: "center" }}><Text style={{ color: T.dark, fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{rank}</Text></View>
      {placement === 1 ? <Ionicons name="trophy" size={20} color={T.orange} /> : <Ionicons name="ribbon-outline" size={19} color={placement === 2 ? T.blue : T.red} />}
    </View>
  </View>;
}

function Leaderboard({ party, stampSelf }: { party: PartyDetail; stampSelf: boolean }) {
  const reducedMotion = useReducedMotion();
  const viewerId = party.members[0]?.userId;
  const mutedText = "#655a60";
  const podiumEntries = party.leaderboard.slice(0, 3);
  const remainingEntries = party.leaderboard.slice(3);
  const viewerEntry = party.leaderboard.find((entry) => entry.userId === viewerId);
  const modeCopy = party.gameMode === "free_for_all" ? "Party XP from completed quests" : "XP and locked shared-quest bonuses";

  return <View style={{ gap: 16 }}>
    <View style={{ paddingTop: 10, paddingHorizontal: 4 }}>
      {stampSelf ? <LeaderboardConfetti /> : null}
      <View style={{ paddingHorizontal: 14, marginBottom: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23 }}>Party standings</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name="flash" size={15} color={T.purple} /><Text style={{ color: mutedText, fontSize: 11, fontWeight: "900" }}>LIVE XP</Text></View></View>
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}><PodiumPlayer placement={2} entry={podiumEntries[1]} /><PodiumPlayer placement={1} entry={podiumEntries[0]} /><PodiumPlayer placement={3} entry={podiumEntries[2]} /></View>
    </View>

    {viewerEntry ? <Reanimated.View entering={stampSelf && !reducedMotion ? ZoomIn.springify().damping(17).stiffness(220) : FadeIn.duration(reducedMotion ? 1 : 180)} style={{ minHeight: 76, paddingHorizontal: 17, borderRadius: 18, backgroundColor: `${T.purple}16`, flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 39, height: 39, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: `${T.purple}28` }}><Ionicons name="trophy" size={19} color={T.purple} /></View><View style={{ flex: 1, gap: 2 }}><Text style={{ color: T.dark, fontSize: 15, fontWeight: "900" }}>Your standing</Text><Text style={{ color: mutedText, fontSize: 11, fontWeight: "800" }}>{modeCopy}</Text></View><View style={{ alignItems: "flex-end" }}><Text style={{ color: T.purple, fontSize: 21, lineHeight: 24, fontWeight: "900", fontVariant: ["tabular-nums"] }}>#{viewerEntry.rank}</Text><Text style={{ color: T.purple, fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{viewerEntry.xp} XP</Text></View></Reanimated.View> : null}

    {remainingEntries.length ? <View style={{ gap: 11 }}>
      <View style={{ paddingHorizontal: 4, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}><Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>More adventurers</Text><Text style={{ color: mutedText, fontSize: 11, fontWeight: "800" }}>{remainingEntries.length} ranked</Text></View>
      {remainingEntries.map((entry, index) => {
        const isViewer = entry.userId === viewerId;
        return <Reanimated.View key={entry.userId} entering={stampSelf && isViewer && !reducedMotion ? ZoomIn.springify().damping(17).stiffness(220) : FadeInDown.delay(index * (reducedMotion ? 0 : 45)).duration(reducedMotion ? 1 : 170)} style={{ minHeight: 78, paddingHorizontal: 15, borderRadius: 18, backgroundColor: isViewer ? `${T.blue}14` : "#f2eef2", flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar emoji={entry.emoji} color={entry.avatarColor} size={48} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}><Text style={{ color: T.dark, fontSize: 15, lineHeight: 19, fontWeight: "900" }} numberOfLines={1}>{entry.displayName}</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name="flash" size={13} color={T.purple} /><Text style={{ color: mutedText, fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{entry.xp} Party XP</Text></View></View>
          <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: `${isViewer ? T.blue : T.white}b8` }}><Text style={{ color: isViewer ? T.blue : T.muted, fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{entry.rank}</Text></View>
        </Reanimated.View>;
      })}
    </View> : null}
  </View>;
}

function CompletionSheet({ party, quest, onClose, onSubmit }: { party: PartyDetail; quest: PartyQuest | null; onClose: () => void; onSubmit: (input: { reflection: string; journalUris: string[]; shareToFeed: boolean; feedCaption: string }) => Promise<void> }) {
  const [reflection, setReflection] = useState("");
  const [journalUris, setJournalUris] = useState<string[]>([]);
  const [shareToFeed, setShareToFeed] = useState(false);
  const [includeCaption, setIncludeCaption] = useState(false);
  const [feedCaption, setFeedCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const proofMode = party.photoProofMode ?? "disabled";
  const mandatoryProof = proofMode === "required";
  const canShare = journalUris.length > 0 && !mandatoryProof;
  const selectedShare = mandatoryProof || shareToFeed;
  useEffect(() => { if (!quest) { setReflection(""); setJournalUris([]); setShareToFeed(false); setIncludeCaption(false); setFeedCaption(""); } }, [quest]);
  const choosePhotos = async () => {
    const remaining = 5 - journalUris.length;
    if (!remaining) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.78 });
    if (!result.canceled) setJournalUris((current) => [...current, ...result.assets.map((asset) => asset.uri)].slice(0, 5));
  };
  const submit = async () => {
    if (mandatoryProof && !journalUris.length) { Alert.alert("Photo proof required", "Add at least one photo before completing this Party quest."); return; }
    setSubmitting(true);
    try { await onSubmit({ reflection, journalUris, shareToFeed: selectedShare, feedCaption: includeCaption ? feedCaption : "" }); }
    finally { setSubmitting(false); }
  };
  return <Sheet visible={quest !== null} onClose={onClose} maxHeight="92%"><ScrollView keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 14, paddingBottom: 34 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><View><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23 }}>Complete quest</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "800", marginTop: 2 }}>{quest?.title}</Text></View><IconButton icon="close" label="Close completion" onPress={onClose} color={T.muted} /></View>
    <View style={{ borderRadius: 17, padding: 13, gap: 5, backgroundColor: `${T.blue}0e`, borderWidth: 2, borderColor: `${T.blue}38` }}><Text style={{ color: T.dark, fontSize: 14, fontWeight: "900" }}>Your private Journal</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>This reflection is private and will only be visible to you in your Journal.</Text></View>
    <Pressable accessibilityRole="button" onPress={choosePhotos} style={({ pressed }) => ({ minHeight: 58, borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: mandatoryProof && !journalUris.length ? T.orange : T.border, backgroundColor: T.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, transform: [{ scale: pressed ? 0.985 : 1 }] })}><Ionicons name={journalUris.length ? "images" : "camera"} size={19} color={journalUris.length ? T.green : T.blue} /><Text style={{ color: journalUris.length ? T.green : T.blue, fontSize: 13, fontWeight: "900" }}>{journalUris.length ? `${journalUris.length}/5 photos added` : mandatoryProof ? "Add required proof photo" : "Add photos to your Journal"}</Text></Pressable>
    {journalUris.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{journalUris.map((uri) => <View key={uri} style={{ position: "relative" }}><Image source={{ uri }} style={{ width: 74, height: 74, borderRadius: 13 }} /><Pressable accessibilityLabel="Remove photo" onPress={() => setJournalUris((items) => items.filter((item) => item !== uri))} style={{ position: "absolute", top: -5, right: -5, width: 22, height: 22, borderRadius: 11, backgroundColor: T.red, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={14} color={T.white} /></Pressable></View>)}</ScrollView> : null}
    <TextInput value={reflection} onChangeText={setReflection} placeholder="Write about your experience (optional)" placeholderTextColor={T.muted} multiline textAlignVertical="top" style={{ minHeight: 104, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 13, color: T.dark, fontSize: 14, lineHeight: 20, fontWeight: "700", backgroundColor: T.white }} />
    {mandatoryProof ? <View style={{ borderRadius: 16, padding: 13, backgroundColor: `${T.orange}12`, flexDirection: "row", gap: 9 }}><Ionicons name="shield-checkmark" size={19} color={T.orange} /><Text style={{ flex: 1, color: T.dark, fontSize: 12, lineHeight: 18, fontWeight: "800" }}>Proof is required for this Party, so your photo will also be shared privately with its members.</Text></View> : canShare ? <View style={{ borderRadius: 17, overflow: "hidden", borderWidth: 2, borderColor: selectedShare ? `${T.blue}55` : T.border, backgroundColor: T.white }}><Pressable accessibilityRole="switch" accessibilityState={{ checked: shareToFeed }} onPress={() => setShareToFeed((value) => !value)} style={{ minHeight: 58, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 14, fontWeight: "900" }}>Share this adventure on the Party Feed</Text><Text style={{ color: T.muted, fontSize: 11, lineHeight: 16, fontWeight: "700", marginTop: 2 }}>Only Party members can see it.</Text></View><View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: shareToFeed ? T.blue : "#c7c6ca", alignItems: shareToFeed ? "flex-end" : "flex-start" }}><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: T.white }} /></View></Pressable>{shareToFeed ? <View style={{ padding: 13, paddingTop: 0, gap: 10 }}><Pressable accessibilityRole="switch" accessibilityState={{ checked: includeCaption }} onPress={() => setIncludeCaption((value) => !value)} style={{ minHeight: 42, flexDirection: "row", alignItems: "center", gap: 9 }}><Ionicons name={includeCaption ? "checkbox" : "square-outline"} size={21} color={includeCaption ? T.blue : T.muted} /><Text style={{ color: T.dark, flex: 1, fontSize: 13, fontWeight: "900" }}>Add a description to this post</Text></Pressable>{includeCaption ? <TextInput value={feedCaption} onChangeText={setFeedCaption} placeholder="Tell the Party about it (optional)" placeholderTextColor={T.muted} multiline style={{ minHeight: 76, borderWidth: 2, borderColor: T.border, borderRadius: 14, padding: 11, textAlignVertical: "top", color: T.dark, fontWeight: "700" }} /> : null}</View> : null}</View> : proofMode === "optional" ? <Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>Add a photo to share your adventure with the Party, or complete without proof.</Text> : null}
    <PartyButton label={submitting ? "Saving your adventure…" : "Complete Quest"} icon="checkmark" color={T.green} disabled={submitting} onPress={submit} />
  </ScrollView></Sheet>;
}

function CompletionCelebrationSheet({ celebration, onContinue }: { celebration: CompletionCelebration; onContinue: () => void }) {
  const reducedMotion = useReducedMotion();
  const colors = [T.blue, T.green, T.orange, T.pink, T.purple, T.yellow];
  if (!celebration) return null;
  const { quest, result } = celebration;
  return <Sheet visible onClose={onContinue} maxHeight="90%"><View style={{ padding: 24, gap: 16, overflow: "hidden" }}>
    <View pointerEvents="none" style={{ position: "absolute", top: 2, left: 0, right: 0, height: 100 }}>{colors.map((color, index) => <Reanimated.View key={color} entering={reducedMotion ? FadeIn.duration(1) : ZoomIn.delay(index * 55).duration(260)} style={{ position: "absolute", top: 12 + (index % 3) * 20, left: `${7 + index * 16}%`, width: index % 2 ? 8 : 11, height: index % 2 ? 14 : 11, borderRadius: index % 2 ? 3 : 6, backgroundColor: color, transform: [{ rotate: `${index % 2 ? 25 : -20}deg` }] }} />)}</View>
    <View style={{ alignItems: "center", gap: 7, paddingTop: 12 }}><Reanimated.View entering={reducedMotion ? FadeIn.duration(1) : ZoomIn.duration(300)} style={{ width: 72, height: 72, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: `${T.green}18`, borderWidth: 2, borderColor: `${T.green}45`, borderBottomWidth: 5, borderBottomColor: `${T.green}75` }}><Ionicons name="checkmark" size={38} color={T.green} /></Reanimated.View><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 26, lineHeight: 31, textAlign: "center" }}>Quest complete!</Text><Text style={{ color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "800", textAlign: "center" }}>{quest.title}</Text></View>
    <View style={{ flexDirection: "row", gap: 9 }}><View style={{ flex: 1, minHeight: 64, padding: 10, borderRadius: 16, backgroundColor: `${T.green}12`, alignItems: "center", justifyContent: "center", gap: 2 }}><Text style={{ color: T.green, fontSize: 18, fontWeight: "900" }}>+{result.xpAwarded} XP</Text><Text style={{ color: T.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.45 }}>earned</Text></View><View style={{ flex: 1, minHeight: 64, padding: 10, borderRadius: 16, backgroundColor: `${T.blue}12`, alignItems: "center", justifyContent: "center", gap: 2 }}><Text style={{ color: T.blue, fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{formatDuration(result.elapsedSeconds)}</Text><Text style={{ color: T.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.45 }}>your time</Text></View></View>
    <View style={{ gap: 8 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}><Text style={{ color: T.dark, fontSize: 16, fontWeight: "900" }}>Fastest finishes</Text><Text style={{ color: T.muted, fontSize: 10, fontWeight: "900" }}>{result.topFinishers.length ? "Live results" : "You’re first"}</Text></View>{result.topFinishers.length ? result.topFinishers.map((finisher) => { const accent = finisher.rank === 1 ? T.orange : finisher.rank === 2 ? T.blue : T.purple; return <View key={`${finisher.rank}-${finisher.name}`} style={{ minHeight: 42, paddingHorizontal: 11, borderRadius: 14, backgroundColor: `${accent}12`, flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ width: 19, color: accent, fontSize: 13, fontWeight: "900" }}>#{finisher.rank}</Text><Text style={{ fontSize: 17 }}>{finisher.emoji}</Text><Text style={{ flex: 1, color: T.dark, fontSize: 13, fontWeight: "900" }} numberOfLines={1}>{finisher.name}</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{formatDuration(finisher.elapsedSeconds)}</Text></View>; }) : <View style={{ minHeight: 42, borderRadius: 14, backgroundColor: `${T.orange}12`, alignItems: "center", justifyContent: "center" }}><Text style={{ color: T.orange, fontSize: 12, fontWeight: "900" }}>Set the pace for the crew!</Text></View>}</View>
    <View style={{ borderRadius: 15, padding: 11, backgroundColor: T.bg, flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons name="flame" size={18} color={T.orange} /><Text style={{ flex: 1, color: T.muted, fontSize: 12, fontWeight: "800" }}>{result.dailyLimit > 0 ? `${result.dailyUsed} of ${result.dailyLimit} daily quests completed` : `${result.dailyUsed} quests completed · No daily limit`}</Text></View>
    <PartyButton label="See leaderboard" icon="trophy" color={T.blue} onPress={onContinue} />
  </View></Sheet>;
}

function QuestPicker({ party, contentQuests, selectedIds, onToggle, onClose, onConfirm }: { party: PartyDetail; contentQuests: Quest[]; selectedIds: string[]; onToggle: (id: string) => void; onClose: () => void; onConfirm: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | QuestCategory>("All");
  const [sort, setSort] = useState<QuestPickerSort>("Recommended");
  const [duration, setDuration] = useState<"quick" | "long" | null>(null);
  const [difficulty, setDifficulty] = useState<Quest["difficulty"] | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const unavailable = useMemo(() => new Set([...party.quests.map((quest) => quest.questId), ...(party.isHost ? [] : party.mySuggestedQuestIds ?? [])]), [party.isHost, party.mySuggestedQuestIds, party.quests]);
  const choices = useMemo(() => sortPickerQuests(contentQuests.filter((quest) => {
    if (unavailable.has(quest.id)) return false;
    if (category !== "All" && quest.category !== category) return false;
    if (difficulty && quest.difficulty !== difficulty) return false;
    if (duration === "quick" && quest.timeMin > 30) return false;
    if (duration === "long" && quest.timeMin < 60) return false;
    const searchable = `${quest.title} ${quest.description} ${quest.category}`.toLowerCase();
    return !query.trim() || searchable.includes(query.trim().toLowerCase());
  }), sort), [category, contentQuests, difficulty, duration, query, sort, unavailable]);
  const activeFilters = Number(Boolean(duration)) + Number(Boolean(difficulty));
  const togglePanel = (panel: "sort" | "filter") => { if (panel === "sort") { setSortOpen((open) => !open); setFilterOpen(false); } else { setFilterOpen((open) => !open); setSortOpen(false); } };
  return <Reanimated.View entering={FadeInDown.duration(230)} exiting={FadeOutUp.duration(150)} style={{ position: "absolute", inset: 0, zIndex: 20, backgroundColor: T.bg }}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 118, gap: 13 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 25 }}>{party.isHost ? "Add quests" : "Suggest quests"}</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "800", marginTop: 2 }}>{party.isHost ? "Build your Party list" : "Your host will review these"}</Text></View><IconButton icon="close" label="Close quest selection" onPress={onClose} color={T.muted} /></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1, minHeight: 52, paddingHorizontal: 14, borderRadius: 17, borderWidth: 2, borderColor: `${T.blue}45`, backgroundColor: T.white, flexDirection: "row", alignItems: "center", gap: 9 }}><Ionicons name="search" size={20} color={T.blue} /><TextInput value={query} onChangeText={setQuery} placeholder="Search Quests" placeholderTextColor={T.muted} autoCapitalize="none" style={{ flex: 1, color: T.dark, fontFamily: "Rubik", fontSize: 15, lineHeight: 20, paddingVertical: 0, includeFontPadding: false, textAlignVertical: "center" }} /></View><Pressable accessibilityLabel="Sort quests" onPress={() => togglePanel("sort")} style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: sortOpen ? `${T.blue}16` : T.white, borderWidth: 2, borderColor: sortOpen ? T.blue : T.border, borderBottomWidth: 4, borderBottomColor: sortOpen ? "#258fd8" : "#e6ddd2", transform: [{ translateY: pressed ? 2 : 0 }] })}><Ionicons name="swap-vertical" size={20} color={sortOpen ? T.blue : T.muted} /></Pressable><Pressable accessibilityLabel="Filter quests" onPress={() => togglePanel("filter")} style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: filterOpen || activeFilters ? `${T.green}14` : T.white, borderWidth: 2, borderColor: filterOpen || activeFilters ? T.green : T.border, borderBottomWidth: 4, borderBottomColor: filterOpen || activeFilters ? "#20894d" : "#e6ddd2", transform: [{ translateY: pressed ? 2 : 0 }] })}><Ionicons name="options" size={20} color={filterOpen || activeFilters ? T.green : T.muted} />{activeFilters ? <View style={{ position: "absolute", top: -4, right: -3, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: T.green }}><Text style={{ color: T.white, fontSize: 9, fontWeight: "900" }}>{activeFilters}</Text></View> : null}</Pressable></View>
      {sortOpen ? <View style={{ borderRadius: 17, padding: 10, gap: 7, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }}><Text style={{ color: T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.45 }}>SORT BY</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{(["Recommended", "Most XP", "Shortest", "Longest"] as QuestPickerSort[]).map((item) => <Pressable key={item} onPress={() => { setSort(item); setSortOpen(false); }} style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 11, borderRadius: 12, justifyContent: "center", backgroundColor: sort === item ? `${T.blue}16` : T.bg, borderWidth: 1.5, borderColor: sort === item ? T.blue : "transparent", transform: [{ scale: pressed ? 0.97 : 1 }] })}><Text style={{ color: sort === item ? T.blue : T.muted, fontSize: 11, fontWeight: "900" }}>{item}</Text></Pressable>)}</View></View> : null}
      {filterOpen ? <View style={{ borderRadius: 17, padding: 11, gap: 10, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }}><View><Text style={{ color: T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.45 }}>DURATION</Text><View style={{ flexDirection: "row", gap: 7, marginTop: 7 }}>{(["quick", "long"] as const).map((item) => <Pressable key={item} onPress={() => setDuration((value) => value === item ? null : item)} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 12, justifyContent: "center", backgroundColor: duration === item ? `${T.green}16` : T.bg, borderWidth: 1.5, borderColor: duration === item ? T.green : "transparent" }}><Text style={{ color: duration === item ? T.green : T.muted, fontSize: 11, fontWeight: "900" }}>{item === "quick" ? "Up to 30 min" : "60+ min"}</Text></Pressable>)}</View></View><View><Text style={{ color: T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.45 }}>DIFFICULTY</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 7 }}>{(["EASY", "MEDIUM", "HARD", "FORMIDABLE"] as Quest["difficulty"][]).map((item) => <Pressable key={item} onPress={() => setDifficulty((value) => value === item ? null : item)} style={{ minHeight: 36, paddingHorizontal: 11, borderRadius: 12, justifyContent: "center", backgroundColor: difficulty === item ? `${T.green}16` : T.bg, borderWidth: 1.5, borderColor: difficulty === item ? T.green : "transparent" }}><Text style={{ color: difficulty === item ? T.green : T.muted, fontSize: 11, fontWeight: "900" }}>{item}</Text></Pressable>)}</View></View>{activeFilters ? <Pressable onPress={() => { setDuration(null); setDifficulty(null); }}><Text style={{ alignSelf: "flex-start", color: T.red, fontSize: 11, fontWeight: "900" }}>Clear filters</Text></Pressable> : null}</View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>{questCategories.map((item) => { const selected = category === item; const tone = item === "All" ? { text: T.dark, bg: T.white } : questCategoryColors[item]; const itemColor = item === "All" ? (selected ? T.white : T.dark) : tone.text; return <Pressable key={item} onPress={() => setCategory(item)} style={({ pressed }) => ({ minHeight: 39, paddingHorizontal: 12, borderRadius: 15, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: selected ? tone.bg : T.white, borderWidth: 2, borderColor: selected ? tone.text : T.border, borderBottomWidth: 4, borderBottomColor: selected ? `${tone.text}9a` : "#e6ddd2", transform: [{ translateY: pressed ? 2 : 0 }] })}>{item !== "All" ? <PartyCategoryIcon category={item} size={16} color={itemColor} /> : <Ionicons name="apps" size={15} color={itemColor} />}<Text style={{ color: selected ? itemColor : T.muted, fontSize: 11, fontWeight: "900" }}>{item === "FOOD AND DRINKS" ? "Food & Drinks" : item}</Text></Pressable>; })}</ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20 }}>{category === "All" ? "All quests" : category}</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900" }}>{choices.length} found</Text></View>
      {choices.length ? choices.map((quest) => { const selected = selectedIds.includes(quest.id); const tone = questCategoryColors[quest.category]; return <Pressable key={quest.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => onToggle(quest.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 18, borderWidth: 2, borderColor: selected ? T.blue : T.border, borderBottomWidth: selected ? 5 : 3, borderBottomColor: selected ? "#258fd8" : "#e6ddd2", backgroundColor: T.white, transform: [{ translateY: pressed ? 2 : 0 }] })}><View style={{ width: 6, alignSelf: "stretch", borderRadius: 99, backgroundColor: tone.text }} /><View style={{ flex: 1, gap: 3 }}><Text style={{ color: T.dark, fontSize: 15, fontWeight: "900" }} numberOfLines={1}>{quest.title}</Text><Text style={{ color: tone.text, fontSize: 10, fontWeight: "900" }}>{quest.category} <Text style={{ color: T.muted }}>+{quest.xp} XP · {quest.timeMin} min</Text></Text></View><Ionicons name={selected ? "checkbox" : "add-circle-outline"} size={23} color={selected ? T.blue : T.muted} /></Pressable>; }) : <EmptyState emoji="🔎" title="No quests found" body="Try another category or clear a filter." />}
    </ScrollView>
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: T.white, borderTopWidth: 2, borderTopColor: T.border }}><PartyButton label={party.isHost ? `Add selected (${selectedIds.length})` : `Suggest selected (${selectedIds.length})`} icon="add" disabled={!selectedIds.length} onPress={onConfirm} /></View>
  </Reanimated.View>;
}

export function PartyDetailScreen() {
  const router = useRouter();
  const { contentWidth, horizontalPadding, safeAreaOffset, insets } = useResponsiveScreenLayout(480);
  const params = useLocalSearchParams<{ id: string }>();
  const partyId = String(params.id ?? "");
  const { quests: contentQuests } = useContent();
  const { overview, getParty, beginPartyQuest, abandonPartyQuest, setPartyQuestsEnabled, completePartyQuest, finishPartyQuest, finishParty, addQuestsToParty, suggestQuestsForParty, reactToPartyFeed, inviteFriendToParty, exitParty, markPartyNotificationsRead, dismissPartyBriefing } = useSocial();
  const [party, setParty] = useState<PartyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PartyTab>("quests");
  const [completeQuest, setCompleteQuest] = useState<PartyQuest | null>(null);
  const [completionCelebration, setCompletionCelebration] = useState<CompletionCelebration>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoView, setInfoView] = useState<"details" | "invite">("details");
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [endPrompt, setEndPrompt] = useState<EndRoundPrompt>(null);
  const [recommendationsOpen, setRecommendationsOpen] = useState(true);
  const [launchingQuestId, setLaunchingQuestId] = useState<string | null>(null);
  const [remoteRound, setRemoteRound] = useState(false);
  const [stampLeaderboard, setStampLeaderboard] = useState(false);
  const previousRoundId = useRef<string | null>(null);
  const leaderboardStampTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSequence = useRef(0);
  const liveRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!partyId) return;
    const request = ++loadSequence.current;
    if (!quiet) setLoading(true);
    try {
      const next = await getParty(partyId);
      if (request !== loadSequence.current) return;
      setParty((previous) => {
        const startedRemotely = next.gameMode === "everyone_together" && Boolean(next.activeRound?.id) && next.activeRound?.id !== previousRoundId.current && !next.isHost;
        setRemoteRound(startedRemotely);
        previousRoundId.current = next.activeRound?.id ?? null;
        return next;
      });
      setBriefingOpen(next.showWelcomeBriefing);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load this Party.");
    } finally { if (!quiet && request === loadSequence.current) setLoading(false); }
  }, [getParty, partyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => () => { if (leaderboardStampTimer.current) clearTimeout(leaderboardStampTimer.current); if (liveRefreshTimer.current) clearTimeout(liveRefreshTimer.current); }, []);
  useEffect(() => {
    if (!partyId) return;
    const refreshSoon = () => {
      if (liveRefreshTimer.current) clearTimeout(liveRefreshTimer.current);
      liveRefreshTimer.current = setTimeout(() => load(true), 400);
    };
    const channel = supabase
      .channel(`party-live:${partyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "parties", filter: `id=eq.${partyId}` }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_members", filter: `party_id=eq.${partyId}` }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_quests", filter: `party_id=eq.${partyId}` }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_quest_suggestions", filter: `party_id=eq.${partyId}` }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_quest_rounds", filter: `party_id=eq.${partyId}` }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_quest_sessions", filter: `party_id=eq.${partyId}` }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_completions", filter: `party_id=eq.${partyId}` }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_feed_posts", filter: `party_id=eq.${partyId}` }, refreshSoon)
      .subscribe();
    return () => { if (liveRefreshTimer.current) clearTimeout(liveRefreshTimer.current); supabase.removeChannel(channel); };
  }, [load, partyId]);
  useEffect(() => {
    if (!party || party.status !== "active") return;
    const interval = setInterval(() => load(true), 120000);
    return () => clearInterval(interval);
  }, [load, party?.status]);

  const activeQuest = useMemo(() => {
    if (!party) return null;
    const questId = party.gameMode === "everyone_together" ? party.activeRound?.questId : party.myActiveQuestId;
    return party.quests.find((quest) => quest.questId === questId) ?? null;
  }, [party]);
  const categoryByQuestId = useMemo(() => new Map(contentQuests.map((quest) => [quest.id, quest.category])), [contentQuests]);
  const categoryForQuest = useCallback((questId: string): QuestCategory => categoryByQuestId.get(questId) ?? "WILD CARD", [categoryByQuestId]);
  const visibleQuests = useMemo(() => party?.quests.filter((quest) => quest.questId !== activeQuest?.questId) ?? [], [activeQuest?.questId, party?.quests]);

  const selectTab = (next: PartyTab) => {
    setTab(next);
    if (!party || (next !== "feed" && next !== "leaderboard")) return;
    const kind = next;
    setParty((current) => current ? { ...current, unreadFeedCount: kind === "feed" ? 0 : current.unreadFeedCount, unreadLeaderboardCount: kind === "leaderboard" ? 0 : current.unreadLeaderboardCount } : current);
    markPartyNotificationsRead(party.id, kind).catch(() => undefined);
    if (next === "leaderboard" && party.unreadLeaderboardCount > 0) {
      setStampLeaderboard(true);
      if (leaderboardStampTimer.current) clearTimeout(leaderboardStampTimer.current);
      leaderboardStampTimer.current = setTimeout(() => setStampLeaderboard(false), 500);
    }
  };

  const startQuest = async (quest: PartyQuest) => {
    if (party?.gameMode === "free_for_all" && party.myActiveQuestId) {
      Alert.alert("Finish your active quest", "Complete or abandon your current quest before starting another one.");
      return;
    }
    setLaunchingQuestId(quest.questId);
    try { await beginPartyQuest(partyId, quest.questId); await load(); }
    catch (nextError) {
      const message = messageFromError(nextError);
      if (message.includes("two active members")) Alert.alert("Invite one more adventurer", "Parties need two active members to begin. Invite a friend from Party Info, then have them accept the Party invite.");
      else if (message.includes("ACTIVE_PARTY_SESSION_EXISTS")) Alert.alert("Finish your active quest", "Complete or abandon your current quest before starting another one.");
      else Alert.alert("Couldn’t start quest", message);
    }
    finally { setLaunchingQuestId(null); }
  };

  const abandonActiveQuest = () => {
    if (!party || party.gameMode !== "free_for_all") return;
    Alert.alert("Abandon this quest?", "Your progress on this quest won’t count, and you can start another Party quest afterward.", [
      { text: "Keep quest", style: "cancel" },
      {
        text: "Abandon quest",
        style: "destructive",
        onPress: () => abandonPartyQuest(partyId)
          .then(() => load())
          .catch((nextError) => Alert.alert("Couldn’t abandon quest", messageFromError(nextError))),
      },
    ]);
  };

  const openQuestList = async () => {
    try { await setPartyQuestsEnabled(partyId, true); await load(); }
    catch (nextError) { Alert.alert("Couldn’t open quests", nextError instanceof Error ? nextError.message : "Please try again."); }
  };

  const sendPartyInvite = async (friendId: string) => {
    setSendingInviteId(friendId);
    try { await inviteFriendToParty(partyId, friendId); Alert.alert("Invite sent", "Your friend can accept it from Social → Parties."); }
    catch (nextError) { Alert.alert("Couldn’t send invite", nextError instanceof Error ? nextError.message : "Please try again."); }
    finally { setSendingInviteId(null); }
  };

  const closeBriefing = async () => {
    setBriefingOpen(false);
    try { await dismissPartyBriefing(partyId); }
    catch { /* The sheet stays dismissed for this visit; the next load can retry persistence. */ }
  };

  const submitCompletion = async ({ reflection, journalUris, shareToFeed, feedCaption }: { reflection: string; journalUris: string[]; shareToFeed: boolean; feedCaption: string }) => {
    if (!party || !completeQuest) return;
    try {
      const journalPhotoPaths = await Promise.all(journalUris.map((uri) => uploadJournalMedia(uri)));
      const sharedPhotoPaths = shareToFeed ? await Promise.all(journalUris.map((uri) => uploadPartyMedia(partyId, uri))) : [];
      const result = await completePartyQuest(partyId, completeQuest.questId, { reflection, journalPhotoPaths, shareToFeed, feedCaption, sharedPhotoPaths });
      setCompleteQuest(null);
      await load();
      setCompletionCelebration({ quest: completeQuest, result });
    } catch (nextError) { Alert.alert("Couldn’t complete quest", messageFromError(nextError)); }
  };

  const confirmEndRound = async () => {
    if (!party?.activeRound) return;
    try { await finishPartyQuest(partyId, party.activeRound.questId); setEndPrompt(null); await load(); Alert.alert("Results locked", "Final speed bonuses have been added to the Party leaderboard."); }
    catch (nextError) { Alert.alert("Couldn’t end shared quest", nextError instanceof Error ? nextError.message : "Please try again."); }
  };

  const addOrSuggest = async () => {
    if (!party || !selectedQuestIds.length) return;
    try { if (party.isHost) await addQuestsToParty(partyId, selectedQuestIds); else await suggestQuestsForParty(partyId, selectedQuestIds); setSelectedQuestIds([]); setPickerOpen(false); await load(); }
    catch (nextError) { Alert.alert("Couldn’t update quests", nextError instanceof Error ? nextError.message : "Please try again."); }
  };

  const acceptSuggestion = async (suggestion: PartyQuestSuggestion) => {
    try { await addQuestsToParty(partyId, [suggestion.questId]); await load(); }
    catch (nextError) { Alert.alert("Couldn’t add recommendation", nextError instanceof Error ? nextError.message : "Please try again."); }
  };

  if (loading && !party) return <Screen><EmptyState emoji="⏳" title="Loading Party" body="Gathering your crew…" /></Screen>;
  if (!party) return <Screen><EmptyState emoji="🧭" title="Party unavailable" body={error ?? "This Party may have ended or you no longer have access."} /><SoftButton label="Back to Social" icon="arrow-back" onPress={() => router.back()} /></Screen>;

  return <Screen scroll={false} padded={false} contentStyle={{ paddingTop: 0 }}>
    <View style={{ flex: 1, width: "100%" }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, paddingTop: 16, paddingBottom: party.status === "active" ? 112 : 28, gap: 16, transform: [{ translateX: safeAreaOffset }] }}>
        <PartyHeader party={party} onBack={() => router.back()} onInfo={() => setInfoOpen(true)} />
        <PartyTabs active={tab} unreadFeed={party.unreadFeedCount ?? 0} unreadLeaderboard={party.unreadLeaderboardCount ?? 0} onChange={selectTab} />
        {tab === "quests" ? <View style={{ gap: 13 }}>
          <View style={{ gap: 5 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 21 }}>Active quest</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>{party.gameMode === "everyone_together" ? "One quest, one shared clock." : activeQuest ? "Complete or abandon your active quest before starting another." : "Choose a Party quest whenever you’re ready."}</Text></View>
          {activeQuest ? <ActiveQuestCard party={party} quest={activeQuest} category={categoryForQuest(activeQuest.questId)} remoteStart={remoteRound} onComplete={() => setCompleteQuest(activeQuest)} onEnd={() => setEndPrompt({ completed: party.activeRound?.completedCount ?? 0, total: party.activeRound?.totalMembers ?? party.memberCount })} onAbandon={abandonActiveQuest} /> : <EmptyActiveQuest party={party} onOpenQuestList={openQuestList} onInvite={() => { setInfoView("invite"); setInfoOpen(true); }} />}
          {party.isHost && party.suggestedQuests.length ? <View style={{ borderRadius: 20, borderWidth: 2, borderColor: `${T.purple}48`, borderBottomWidth: 5, borderBottomColor: `${T.purple}65`, backgroundColor: T.white, overflow: "hidden" }}><Pressable onPress={() => setRecommendationsOpen((open) => !open)} style={({ pressed }) => ({ minHeight: 58, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: pressed ? `${T.purple}08` : T.white })}><View style={{ width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${T.purple}17` }}><Ionicons name="people" size={18} color={T.purple} /></View><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 15, fontWeight: "900" }}>Recommended by the crew</Text><Text style={{ color: T.muted, fontSize: 10, fontWeight: "800", marginTop: 2 }}>Review ideas before adding them</Text></View><View style={{ minWidth: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${T.purple}16` }}><Text style={{ color: T.purple, fontSize: 12, fontWeight: "900" }}>{party.suggestedQuests.length}</Text></View><Ionicons name={recommendationsOpen ? "chevron-up" : "chevron-down"} size={18} color={T.muted} /></Pressable>{recommendationsOpen ? <View style={{ padding: 11, paddingTop: 0, gap: 9 }}>{party.suggestedQuests.map((suggestion) => <View key={suggestion.questId} style={{ minHeight: 64, borderRadius: 16, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.bg }}><View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${suggestion.color}18` }}><PartyCategoryIcon category={suggestion.category} size={21} /></View><View style={{ flex: 1, gap: 3 }}><Text style={{ color: T.dark, fontSize: 13, fontWeight: "900" }} numberOfLines={1}>{suggestion.title}</Text><Text style={{ color: T.muted, fontSize: 10, fontWeight: "800" }}>{suggestion.count}× suggested · +{suggestion.xp} XP</Text></View><Pressable accessibilityLabel={`Add ${suggestion.title}`} onPress={() => acceptSuggestion(suggestion)} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: T.purple, borderBottomWidth: 3, borderBottomColor: "#7973c7", transform: [{ translateY: pressed ? 2 : 0 }] })}><Ionicons name="add" size={21} color={T.white} /></Pressable></View>)}</View> : null}</View> : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 21 }}>Party quests</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "900" }}>{party.quests.length} total</Text></View>
          {visibleQuests.length ? visibleQuests.map((quest) => <QuestRow key={quest.questId} quest={quest} party={party} category={categoryForQuest(quest.questId)} launching={launchingQuestId === quest.questId} locked={party.gameMode === "free_for_all" && Boolean(activeQuest)} onStart={() => startQuest(quest)} onLocked={() => Alert.alert("Finish your active quest", `Complete or abandon “${activeQuest?.title ?? "your current quest"}” before starting another one.`)} />) : <EmptyState emoji="✨" title="All caught up" body="Start another quest or let the host add more." />}
          {party.completedQuests.length ? <View style={{ gap: 10, marginTop: 5 }}><View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20 }}>Completed quests</Text><Text style={{ color: T.green, fontSize: 11, fontWeight: "900" }}>{party.completedQuests.length} done</Text></View>{party.completedQuests.map((quest) => <CompletedQuestRow key={quest.id} quest={quest} shared={party.gameMode === "everyone_together"} />)}</View> : null}
        </View> : null}
        {tab === "feed" ? <View style={{ gap: 11 }}><View><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 22 }}>Party Feed</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "700", marginTop: 3 }}>Your crew’s adventures, just for this Party.</Text></View>{loading ? <PartyFeedLoading /> : party.feed.length ? party.feed.map((post) => <FeedPostCard key={post.id} post={post} onReact={(emoji) => reactToPartyFeed(post.id, emoji).then(() => load(true))} />) : <EmptyState emoji="📸" title="No Party posts yet" body="Your first completed quest will show up here." />}</View> : null}
        {tab === "leaderboard" ? <Leaderboard party={party} stampSelf={stampLeaderboard} /> : null}
      </ScrollView>
      {tab === "quests" && party.status === "active" ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 16, paddingBottom: 16, paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding, backgroundColor: T.white, borderTopWidth: 2, borderTopColor: T.border }}><PartyButton label={party.isHost ? "Add quests" : "Suggest quests"} icon="add" onPress={() => setPickerOpen(true)} /></View> : null}
      {pickerOpen ? <QuestPicker party={party} contentQuests={contentQuests} selectedIds={selectedQuestIds} onToggle={(id) => setSelectedQuestIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])} onClose={() => setPickerOpen(false)} onConfirm={addOrSuggest} /> : null}
    </View>
    <CompletionSheet party={party} quest={completeQuest} onClose={() => setCompleteQuest(null)} onSubmit={submitCompletion} />
    <CompletionCelebrationSheet celebration={completionCelebration} onContinue={() => { setCompletionCelebration(null); setTab("leaderboard"); setStampLeaderboard(true); if (leaderboardStampTimer.current) clearTimeout(leaderboardStampTimer.current); leaderboardStampTimer.current = setTimeout(() => setStampLeaderboard(false), 500); }} />
    <Sheet visible={endPrompt !== null} onClose={() => setEndPrompt(null)}><View style={{ padding: 24, gap: 14 }}><View style={{ width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: `${T.purple}18` }}><Ionicons name="flag" size={24} color={T.purple} /></View><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23 }}>End this quest?</Text><Text style={{ color: T.muted, fontSize: 14, lineHeight: 21, fontWeight: "700" }}>{endPrompt?.completed ?? 0} of {endPrompt?.total ?? party.memberCount} members have finished. Ending now locks the time ranking and awards the top-three bonuses.</Text><PartyButton label="Proceed to end quest" icon="flag" color={T.purple} onPress={confirmEndRound} /><SoftButton label="Keep it open" inverse color={T.muted} onPress={() => setEndPrompt(null)} /></View></Sheet>
    <Sheet visible={infoOpen} onClose={() => { setInfoOpen(false); setInfoView("details"); }} maxHeight="88%"><ScrollView contentContainerStyle={{ padding: 24, gap: 14 }} keyboardShouldPersistTaps="handled">{infoView === "details" ? <><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23 }}>Party Info</Text><IconButton icon="close" label="Close Party Info" onPress={() => { setInfoOpen(false); setInfoView("details"); }} color={T.muted} /></View><View style={{ borderRadius: 17, padding: 14, backgroundColor: `${T.blue}10`, gap: 5 }}><Text style={{ color: T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }}>PARTY CODE</Text><Text selectable style={{ color: T.blue, fontSize: 24, fontWeight: "900", letterSpacing: 3 }}>{party.code}</Text></View>{party.status === "active" && (party.isHost || party.memberInvitesEnabled) ? <PartyButton label="Invite friends" icon="person-add" onPress={() => setInfoView("invite")} /> : null}<Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 }}>RULES</Text>{party.rules.length ? party.rules.map((rule) => <View key={rule} style={{ flexDirection: "row", gap: 8 }}><Ionicons name="checkmark-circle" size={18} color={T.green} /><Text style={{ flex: 1, color: T.dark, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>{rule}</Text></View>) : <Text style={{ color: T.muted, fontSize: 13, fontWeight: "700" }}>No extra rules have been set.</Text>}<Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>Location: {party.locationType.replace("_", " ")}{party.locationLabel ? ` · ${party.locationLabel}` : ""}</Text>{party.isHost && party.status === "active" ? <SoftButton label="End Party" icon="flag" inverse color={T.red} onPress={() => Alert.alert("End this Party?", "Final rankings will be preserved in everyone’s Journal.", [{ text: "Cancel", style: "cancel" }, { text: "End Party", style: "destructive", onPress: () => finishParty(partyId).then(() => router.replace("/(tabs)/social")) }])} /> : party.status === "active" ? <SoftButton label="Leave Party" icon="exit-outline" inverse color={T.red} onPress={() => exitParty(partyId).then(() => router.replace("/(tabs)/social"))} /> : null}</> : <><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><IconButton icon="arrow-back" label="Back to Party Info" onPress={() => setInfoView("details")} color={T.muted} /><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 21 }}>Invite friends</Text><View style={{ width: 44 }} /></View><Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>They’ll receive a Party invite in Social. You need two active members before a quest can begin.</Text>{(overview?.friends ?? []).filter((friend) => !party.members.some((member) => member.userId === friend.userId && member.status === "active")).length ? (overview?.friends ?? []).filter((friend) => !party.members.some((member) => member.userId === friend.userId && member.status === "active")).map((friend) => <View key={friend.userId} style={{ minHeight: 60, borderRadius: 17, padding: 10, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, flexDirection: "row", alignItems: "center", gap: 9 }}><Avatar emoji={friend.emoji} color={friend.avatarColor} size={36} /><Text style={{ flex: 1, color: T.dark, fontSize: 14, fontWeight: "900" }} numberOfLines={1}>{friend.displayName}</Text><PartyButton compact label={sendingInviteId === friend.userId ? "Sending" : "Invite"} icon="person-add" disabled={sendingInviteId !== null} onPress={() => sendPartyInvite(friend.userId)} /></View>) : <EmptyState emoji="👋" title="Add a friend first" body="Party invites are for your QuestLife friends. Add someone in the Friends tab, then return here." />}</>}</ScrollView></Sheet>
    <Sheet visible={briefingOpen} onClose={closeBriefing}><View style={{ padding: 24, gap: 14 }}><View style={{ width: 50, height: 50, borderRadius: 18, backgroundColor: `${party.gameMode === "everyone_together" ? T.purple : T.pink}18`, alignItems: "center", justifyContent: "center" }}><Ionicons name={party.gameMode === "everyone_together" ? "people" : "rocket"} size={25} color={party.gameMode === "everyone_together" ? T.purple : T.pink} /></View><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23 }}>Welcome to {party.name}</Text><Text style={{ color: T.muted, fontSize: 14, lineHeight: 21, fontWeight: "700" }}>{party.gameMode === "everyone_together" ? "Your host starts each shared quest. Finish before they lock the round to earn a speed bonus." : "Choose any Party quest in any order. Your total base XP decides the ranking."}</Text>{party.rules.length ? <View style={{ gap: 7, padding: 12, borderRadius: 15, backgroundColor: T.bg }}>{party.rules.map((rule) => <View key={rule} style={{ flexDirection: "row", gap: 7 }}><Ionicons name="checkmark-circle" size={16} color={T.green} /><Text style={{ flex: 1, color: T.dark, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>{rule}</Text></View>)}</View> : null}<PartyButton label="Let’s go" icon="arrow-forward" onPress={closeBriefing} /></View></Sheet>
  </Screen>;
}
