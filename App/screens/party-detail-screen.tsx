import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { T } from "@/components/theme";
import { Card, EmptyState, Header, IconButton, Screen, Sheet, SoftButton, Tag } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useSocial } from "@/contexts/SocialContext";
import { uploadPartyMedia } from "@/services/social/socialService";
import { PartyDetail, PartyQuest } from "@/types/social";

type PartyTab = "quests" | "feed" | "leaderboard";

function elapsed(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m ${seconds % 60}s`;
}

function formatDuration(seconds?: number | null) {
  if (seconds == null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function Avatar({ emoji, color, size = 38 }: { emoji: string; color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: `${color}22`, borderWidth: 2, borderColor: `${color}55` }}><Text style={{ fontSize: size * 0.42 }}>{emoji}</Text></View>;
}

function PartyButton({ label, icon, color = T.blue, onPress, disabled = false, compact = false }: { label: string; icon?: keyof typeof Ionicons.glyphMap; color?: string; onPress?: () => void; disabled?: boolean; compact?: boolean }) {
  const lowerEdge = color === T.blue ? "#258fd8" : color === T.purple ? "#7973c7" : color === T.green ? "#20894d" : color;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: compact ? 42 : 58, paddingHorizontal: compact ? 14 : 18, borderRadius: compact ? 16 : 20, backgroundColor: disabled ? T.border : color, borderBottomWidth: compact ? 4 : 6, borderBottomColor: disabled ? "#d7cec2" : lowerEdge, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.6 : 1, transform: [{ translateY: pressed && !disabled ? 3 : 0 }] })}>
    {icon ? <Ionicons name={icon} size={compact ? 16 : 19} color={T.white} /> : null}
    <Text style={{ color: T.white, fontSize: compact ? 12 : 15, fontWeight: "900", letterSpacing: compact ? 0.45 : 0.55, textTransform: "uppercase" }}>{label}</Text>
  </Pressable>;
}

function PartyTabs({ active, onChange }: { active: PartyTab; onChange: (next: PartyTab) => void }) {
  return <View style={{ flexDirection: "row", padding: 4, borderRadius: 23, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }}>
    {(["quests", "feed", "leaderboard"] as PartyTab[]).map((tab) => <Pressable key={tab} onPress={() => onChange(tab)} style={{ flex: 1, minHeight: 39, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: active === tab ? T.dark : "transparent" }}><Text style={{ color: active === tab ? T.white : T.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>{tab}</Text></Pressable>)}
  </View>;
}

function LiveRound({ party, onEnd }: { party: PartyDetail; onEnd: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => { if (!party.activeRound) return; const interval = setInterval(() => tick((value) => value + 1), 1000); return () => clearInterval(interval); }, [party.activeRound]);
  if (!party.activeRound) return null;
  const quest = party.quests.find((item) => item.questId === party.activeRound?.questId);
  return <Card style={{ borderRadius: 20, padding: 15, gap: 10, backgroundColor: `${T.purple}0c`, borderColor: `${T.purple}40`, boxShadow: "none", borderBottomWidth: 5, borderBottomColor: `${T.purple}45` }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Tag label="Live shared quest" color={T.purple} bg={`${T.purple}18`} /><Text style={{ color: T.purple, fontSize: 13, fontWeight: "900" }}>{elapsed(party.activeRound.startedAt)}</Text></View>
    <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>{quest?.title ?? "Shared quest"}</Text>
    <Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>Finish before the host locks results.</Text>
    {party.isHost ? <PartyButton label="Lock results" icon="flag" color={T.purple} onPress={onEnd} /> : null}
  </Card>;
}

function QuestRow({ quest, party, onStart, onComplete }: { quest: PartyQuest; party: PartyDetail; onStart: () => void; onComplete: () => void }) {
  const sharedStarted = party.activeRound?.questId === quest.questId;
  const blockedByOtherRound = party.gameMode === "everyone_together" && party.activeRound && !sharedStarted;
  const canComplete = party.gameMode === "everyone_together" ? sharedStarted && !quest.myCompletion : !quest.myCompletion;
  return <Card style={{ borderRadius: 18, padding: 14, gap: 10, boxShadow: "none", borderBottomWidth: 4, borderBottomColor: T.border }}>
    <View style={{ flexDirection: "row", gap: 10 }}><View style={{ width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${quest.color}18` }}><Ionicons name="sparkles" size={18} color={quest.color} /></View><View style={{ flex: 1, gap: 2 }}><Text style={{ color: T.dark, fontSize: 16, fontWeight: "900" }}>{quest.title}</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "800" }} numberOfLines={1}>{quest.description}</Text></View><Tag label={`+${quest.xp}`} color={quest.color} bg={`${quest.color}18`} /></View>
    {quest.suggestionCount ? <Text style={{ color: T.purple, fontSize: 11, fontWeight: "900" }}>{quest.suggestionCount}× suggestions</Text> : null}
    {quest.fastest ? <Text style={{ color: T.muted, fontSize: 11, fontWeight: "800" }}>⚡ {quest.fastest.name} · {formatDuration(quest.fastest.elapsedSeconds)}</Text> : null}
    {quest.myCompletion ? <Tag label="Completed" color={T.green} bg={`${T.green}18`} /> : canComplete ? <PartyButton compact label="Quest completed" icon="checkmark" color={T.green} onPress={onComplete} /> : blockedByOtherRound || (party.gameMode === "everyone_together" && !party.isHost) ? <SoftButton label={blockedByOtherRound ? "Shared quest in progress" : "Waiting for host"} icon="time-outline" inverse color={T.muted} style={{ minHeight: 42 }} /> : <PartyButton compact label={party.gameMode === "everyone_together" ? "Start shared quest" : "Start quest"} icon={party.gameMode === "everyone_together" ? "play" : "rocket"} color={party.gameMode === "everyone_together" ? T.purple : T.blue} onPress={onStart} />}
  </Card>;
}

function Leaderboard({ party }: { party: PartyDetail }) {
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => { rise.setValue(8); Animated.timing(rise, { toValue: 0, duration: 220, useNativeDriver: true }).start(); }, [party.leaderboard, rise]);
  return <View style={{ gap: 10 }}>
    <Card style={{ borderRadius: 18, padding: 14, gap: 4, backgroundColor: `${T.blue}0d`, borderColor: `${T.blue}30`, boxShadow: "none", borderBottomWidth: 4, borderBottomColor: `${T.blue}42` }}><Text style={{ color: T.dark, fontWeight: "900" }}>{party.gameMode === "free_for_all" ? "Base XP ranks this Party." : "Base XP + speed bonuses."}</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>{party.gameMode === "free_for_all" ? "Fastest time is for bragging rights." : "1st +50% · 2nd +25% · 3rd +10%"}</Text></Card>
    {party.leaderboard.length ? party.leaderboard.map((entry) => <Animated.View key={entry.userId} style={{ transform: [{ translateY: rise }] }}><Card style={{ borderRadius: 18, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, boxShadow: "none", borderBottomWidth: 4, borderBottomColor: T.border }}><View style={{ width: 27, alignItems: "center" }}><Text style={{ color: entry.rank <= 3 ? T.orange : T.muted, fontSize: 16, fontWeight: "900" }}>#{entry.rank}</Text></View><Avatar emoji={entry.emoji} color={entry.avatarColor} size={34} /><Text style={{ flex: 1, color: T.dark, fontWeight: "900" }}>{entry.displayName}</Text><Text style={{ color: T.blue, fontWeight: "900" }}>{entry.xp} XP</Text></Card></Animated.View>) : <EmptyState emoji="🏁" title="No scores yet" body="Complete a Party quest to rank." />}
  </View>;
}

export function PartyDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const partyId = String(params.id ?? "");
  const { quests: contentQuests } = useContent();
  const { getParty, beginPartyQuest, completePartyQuest, finishPartyQuest, finishParty, addQuestsToParty, suggestQuestsForParty, reactToPartyFeed, exitParty } = useSocial();
  const [party, setParty] = useState<PartyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PartyTab>("quests");
  const [completeQuest, setCompleteQuest] = useState<PartyQuest | null>(null);
  const [reflection, setReflection] = useState("");
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);

  const load = useCallback(async () => {
    if (!partyId) return;
    setLoading(true);
    try { const next = await getParty(partyId); setParty(next); setBriefingOpen((wasOpen) => !wasOpen && !next.isHost); setError(null); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to load this Party."); }
    finally { setLoading(false); }
  }, [getParty, partyId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unavailableQuestIds = useMemo(() => new Set(party?.quests.map((quest) => quest.questId) ?? []), [party?.quests]);
  const start = async (quest: PartyQuest) => { try { await beginPartyQuest(partyId, quest.questId); await load(); } catch (nextError) { Alert.alert("Couldn’t start quest", nextError instanceof Error ? nextError.message : "Please try again."); } };
  const chooseProof = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.78 }); if (!result.canceled) setProofUri(result.assets[0]?.uri ?? null); };
  const submit = async () => { if (!completeQuest || !party) return; if (party.photoProofRequired && !proofUri) { Alert.alert("Photo required", "This Party requires a photo before your completion can be submitted."); return; } try { const photoPaths = proofUri ? [await uploadPartyMedia(partyId, proofUri)] : []; const result = await completePartyQuest(partyId, completeQuest.questId, reflection, photoPaths); setCompleteQuest(null); setReflection(""); setProofUri(null); await load(); Alert.alert("Quest complete!", `+${result.xpAwarded} XP added to QuestLife. ${result.fastest ? `${result.fastest.name} currently holds the fastest time.` : ""}`); } catch (nextError) { Alert.alert("Couldn’t complete quest", nextError instanceof Error ? nextError.message : "Please try again."); } };
  const endRound = async () => { if (!party?.activeRound) return; try { await finishPartyQuest(partyId, party.activeRound.questId); await load(); Alert.alert("Results locked", "Speed bonuses have been added to the Party leaderboard."); } catch (nextError) { Alert.alert("Couldn’t end shared quest", nextError instanceof Error ? nextError.message : "Please try again."); } };
  const addOrSuggest = async () => { if (!selectedQuestIds.length || !party) return; try { if (party.isHost) await addQuestsToParty(partyId, selectedQuestIds); else await suggestQuestsForParty(partyId, selectedQuestIds); setPickerOpen(false); setSelectedQuestIds([]); await load(); } catch (nextError) { Alert.alert("Couldn’t update quests", nextError instanceof Error ? nextError.message : "Please try again."); } };

  if (loading && !party) return <Screen><EmptyState emoji="⏳" title="Loading Party" body="Gathering your crew…" /></Screen>;
  if (!party) return <Screen><EmptyState emoji="🧭" title="Party unavailable" body={error ?? "This Party may have ended or you no longer have access."} /><SoftButton label="Back to Social" icon="arrow-back" onPress={() => router.back()} /></Screen>;

  return <Screen padded={false} contentStyle={{ alignItems: "center" }}>
    <View style={{ width: "100%", maxWidth: 430, paddingHorizontal: 24, gap: 16 }}>
      <Header title={party.name} subtitle={party.goal ?? (party.gameMode === "everyone_together" ? "Everyone Together" : "Free for All")} animated={false} right={<View style={{ flexDirection: "row", gap: 6 }}><IconButton icon="arrow-back" label="Back to Parties" onPress={() => router.back()} color={T.muted} /><Pressable onPress={() => setInfoOpen(true)} style={{ height: 38, borderRadius: 19, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: `${T.blue}12`, borderWidth: 2, borderColor: `${T.blue}30` }}><Ionicons name="information-circle-outline" size={16} color={T.blue} /><Text style={{ color: T.blue, fontWeight: "900", fontSize: 11 }}>Party Info</Text></Pressable></View>} />
      <Card style={{ borderRadius: 20, padding: 15, gap: 12, boxShadow: "none", borderBottomWidth: 5, borderBottomColor: T.border }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.dark, fontWeight: "900" }}>{party.memberCount} adventurers</Text><Tag label={party.status === "active" ? "Active" : "Ended"} color={party.status === "active" ? T.green : T.muted} bg={`${party.status === "active" ? T.green : T.muted}18`} /></View><View style={{ flexDirection: "row", gap: 4 }}>{party.members.map((member) => <Avatar key={member.userId} emoji={member.emoji} color={member.avatarColor} size={34} />)}</View>{party.viewerLeftEarly ? <Tag label="Left early" color={T.orange} bg={`${T.orange}18`} /> : null}</Card>
      <PartyTabs active={tab} onChange={setTab} />
      {tab === "quests" ? <View style={{ gap: 12 }}><LiveRound party={party} onEnd={endRound} />{party.quests.length ? party.quests.map((quest) => <QuestRow key={quest.questId} party={party} quest={quest} onStart={() => start(quest)} onComplete={() => setCompleteQuest(quest)} />) : <EmptyState emoji="🧭" title="No quests yet" body={party.isHost ? "Add a quest to get moving." : "Your host is choosing quests."} />}{party.status === "active" ? <PartyButton label={party.isHost ? "Add quests" : "Suggest quests"} icon="add" onPress={() => setPickerOpen(true)} /> : null}</View> : null}
      {tab === "feed" ? <View style={{ gap: 10 }}>{party.feed.length ? party.feed.map((post) => <Card key={post.id} style={{ borderRadius: 18, padding: 14, gap: 8, boxShadow: "none", borderBottomWidth: 4, borderBottomColor: T.border }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ fontSize: 20 }}>{post.userEmoji}</Text><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontWeight: "900" }}>{post.userName}</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "700" }}>{post.questTitle}</Text></View></View>{post.caption ? <Text style={{ color: T.dark, fontSize: 14, lineHeight: 20, fontWeight: "700" }}>{post.caption}</Text> : <Text style={{ color: T.muted, fontSize: 13, fontWeight: "700" }}>Quest complete ✨</Text>}<View style={{ flexDirection: "row", gap: 8 }}>{["👏", "🔥", "💙"].map((emoji) => { const reaction = post.reactions.find((item) => item.emoji === emoji); return <Pressable key={emoji} onPress={() => reactToPartyFeed(post.id, emoji).then(load)} style={{ paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, backgroundColor: reaction?.reacted ? `${T.blue}18` : T.bg }}><Text>{emoji}{reaction?.count ? ` ${reaction.count}` : ""}</Text></Pressable>; })}</View></Card>) : <EmptyState emoji="📸" title="No Party posts yet" body="Complete a quest to post here." />}</View> : null}
      {tab === "leaderboard" ? <Leaderboard party={party} /> : null}
    </View>

    <Sheet visible={completeQuest !== null} onClose={() => setCompleteQuest(null)}><View style={{ padding: 24, gap: 14 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: T.dark, fontSize: 21, fontWeight: "900" }}>Complete quest</Text><IconButton icon="close" label="Close completion" onPress={() => setCompleteQuest(null)} color={T.muted} /></View><Text style={{ color: T.muted, fontSize: 13, fontWeight: "700" }}>{completeQuest?.title}</Text><Pressable onPress={chooseProof} style={{ minHeight: 56, borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: party.photoProofRequired && !proofUri ? T.orange : T.border, backgroundColor: proofUri ? `${T.green}12` : T.white, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}><Ionicons name={proofUri ? "checkmark-circle" : "camera"} size={18} color={proofUri ? T.green : T.blue} /><Text style={{ color: proofUri ? T.green : T.blue, fontWeight: "900" }}>{proofUri ? "Photo attached" : party.photoProofRequired ? "Add required photo" : "Add photo (optional)"}</Text></Pressable><TextInput value={reflection} onChangeText={setReflection} placeholder="Describe your experience (optional)" placeholderTextColor={T.muted} multiline style={{ minHeight: 100, textAlignVertical: "top", borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 12, color: T.dark, fontWeight: "700", backgroundColor: T.white }} /><PartyButton label="Submit completion" icon="checkmark" color={T.green} onPress={submit} /></View></Sheet>
    <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} maxHeight="90%"><ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: T.dark, fontSize: 21, fontWeight: "900" }}>{party.isHost ? "Add Party quests" : "Suggest quests"}</Text><IconButton icon="close" label="Close quest picker" onPress={() => setPickerOpen(false)} color={T.muted} /></View>{contentQuests.filter((quest) => !unavailableQuestIds.has(quest.id)).map((quest) => { const selected = selectedQuestIds.includes(quest.id); return <Pressable key={quest.id} onPress={() => setSelectedQuestIds((items) => selected ? items.filter((id) => id !== quest.id) : [...items, quest.id])} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, borderWidth: 2, borderBottomWidth: selected ? 4 : 2, borderColor: selected ? T.blue : T.border, borderBottomColor: selected ? "#258fd8" : T.border, backgroundColor: selected ? `${T.blue}12` : T.white }}><Ionicons name={selected ? "checkbox" : "square-outline"} size={20} color={selected ? T.blue : T.muted} /><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontWeight: "900" }}>{quest.title}</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "700", marginTop: 2 }}>+{quest.xp} XP · {quest.timeMin} min</Text></View></Pressable>; })}<PartyButton label={party.isHost ? `Add selected (${selectedQuestIds.length})` : `Suggest selected (${selectedQuestIds.length})`} icon="add" onPress={addOrSuggest} disabled={!selectedQuestIds.length} /></ScrollView></Sheet>
    <Sheet visible={infoOpen} onClose={() => setInfoOpen(false)}><View style={{ padding: 24, gap: 14 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: T.dark, fontSize: 21, fontWeight: "900" }}>Party Info</Text><IconButton icon="close" label="Close Party Info" onPress={() => setInfoOpen(false)} color={T.muted} /></View><Text style={{ color: T.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" }}>Code</Text><Text style={{ color: T.blue, fontWeight: "900", fontSize: 24, letterSpacing: 3 }}>{party.code}</Text><Text style={{ color: T.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" }}>Rules</Text>{party.rules.length ? party.rules.map((rule) => <View key={rule} style={{ flexDirection: "row", gap: 8 }}><Ionicons name="checkmark-circle" size={17} color={T.green} /><Text style={{ color: T.dark, flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>{rule}</Text></View>) : <Text style={{ color: T.muted, fontWeight: "700" }}>No additional rules.</Text>}<Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>Location: {party.locationType.replace("_", " ")}{party.locationLabel ? ` · ${party.locationLabel}` : ""}</Text>{party.isHost && party.status === "active" ? <SoftButton label="End Party" icon="flag" inverse color={T.red} onPress={() => Alert.alert("End this Party?", "Its final rankings will be preserved in everyone’s Journal.", [{ text: "Cancel", style: "cancel" }, { text: "End Party", style: "destructive", onPress: () => finishParty(partyId).then(() => router.replace("/(tabs)/social")) }])} /> : party.status === "active" ? <SoftButton label="Leave Party" icon="exit-outline" inverse color={T.red} onPress={() => exitParty(partyId).then(() => router.replace("/(tabs)/social"))} /> : null}</View></Sheet>
    <Sheet visible={briefingOpen} onClose={() => setBriefingOpen(false)}><View style={{ padding: 24, gap: 14 }}><Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Welcome to {party.name}</Text><Text style={{ color: T.muted, fontSize: 14, lineHeight: 21, fontWeight: "700" }}>{party.goal ?? "Complete quests and cheer each other on."}</Text><Tag label={party.gameMode === "everyone_together" ? "Everyone Together" : "Free for All"} color={party.gameMode === "everyone_together" ? T.purple : T.blue} bg={`${party.gameMode === "everyone_together" ? T.purple : T.blue}18`} /><Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>{party.gameMode === "everyone_together" ? "Host starts. Finish before results lock." : "Pick any quest. Base XP ranks."}</Text><PartyButton label="Let’s go" icon="arrow-forward" onPress={() => setBriefingOpen(false)} /></View></Sheet>
  </Screen>;
}
