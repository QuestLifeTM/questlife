import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";

import { QuestStartBlockModal } from "@/components/quest-start-block";
import { categoryColor, difficultyColor, T } from "@/components/theme";
import { EmptyState, GradientBand, IconButton, Screen, Sheet, Tag, useResponsiveScreenLayout } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useQuestSave } from "@/contexts/QuestSaveContext";
import { useSocial } from "@/contexts/SocialContext";
import { useQuestStart } from "@/hooks/useQuestStart";
import { fetchQuestReviews } from "@/services/engine/questEngineService";
import { Quest } from "@/types/content";
import { QuestReviewData } from "@/types/engine";

const categoryButtonColors: Record<Quest["category"], string> = {
  SOCIAL: "#00B894",
  ADVENTURE: "#4D9CFF",
  "FOOD AND DRINKS": "#E67E22",
  FITNESS: "#E84C63",
  NATURE: "#25A75D",
  SKILLS: "#C59212",
  EVENTS: "#D83B7D",
  CREATIVITY: "#8549D6",
  "WILD CARD": "#B83CD1",
};

function QuestAction({ label, icon, color, onPress, inverse = false, disabled = false, fullWidth = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void; inverse?: boolean; disabled?: boolean; fullWidth?: boolean }) {
  const backgroundColor = disabled ? `${color}38` : inverse ? T.white : color;
  const textColor = disabled ? T.muted : inverse ? color : T.white;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ flex: fullWidth ? undefined : 1, minHeight: 54, borderRadius: 19, borderWidth: inverse ? 2 : 0, borderColor: inverse ? color : "transparent", borderBottomWidth: disabled ? 0 : inverse ? 4 : 5, borderBottomColor: disabled ? "transparent" : inverse ? `${color}99` : "rgba(61,52,56,0.22)", backgroundColor, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, paddingHorizontal: 10, opacity: pressed && !disabled ? 0.88 : 1, transform: [{ translateY: pressed && !disabled ? 2 : 0 }] })}><Ionicons name={icon} size={18} color={textColor} /><Text numberOfLines={1} style={{ color: textColor, fontFamily: "RubikBold", fontSize: 14, textAlign: "center" }}>{label}</Text></Pressable>;
}

function Stat({ label, value, icon, color, bordered }: { label: string; value: string; icon?: keyof typeof Ionicons.glyphMap; color: string; bordered?: boolean }) {
  return <View style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 4, paddingHorizontal: 6, borderLeftWidth: bordered ? 1 : 0, borderLeftColor: T.border }}><View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>{icon ? <Ionicons name={icon} size={15} color={color} /> : null}<Text numberOfLines={1} style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20 }}>{value}</Text></View><Text numberOfLines={1} style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</Text></View>;
}

export function QuestDetailScreen({ id, onBack }: { id?: string; onBack: () => void }) {
  const router = useRouter();
  const { horizontalPadding, insets } = useResponsiveScreenLayout();
  const edgePadding = { paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding };
  const { getQuest, loading } = useContent();
  const { engine, refresh, saveActiveForLater, userPacks } = useQuestEngine();
  const { openQuestSave } = useQuestSave();
  const { overview, shareQuestWith, challengeFriend } = useSocial();
  const quest = getQuest(id);
  const { tryStart, block, clearBlock, starting } = useQuestStart(getQuest);
  const [reviews, setReviews] = useState<QuestReviewData | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareFriendId, setShareFriendId] = useState<string | null>(null);

  const isActive = engine?.activeSession?.questId === quest?.id;
  const hasOtherActive = Boolean(engine?.activeSession && !isActive);

  useEffect(() => {
    if (!quest?.id) return;
    fetchQuestReviews(quest.id).then(setReviews).catch(() => setReviews({ summary: { averageRating: null, ratingCount: 0 }, reviews: [] }));
  }, [quest?.id]);

  if (!quest) return <Screen><IconButton icon="chevron-back" onPress={onBack} /><EmptyState emoji={loading ? "⏳" : "🔍"} title={loading ? "Loading quest" : "Quest unavailable"} body={loading ? "Finding the latest quest details." : "This quest may be unpublished, archived, or unavailable."} /></Screen>;

  const category = categoryColor[quest.category] ?? { text: quest.color, bg: `${quest.color}18` };
  const difficulty = difficultyColor[quest.difficulty];
  const actionColor = categoryButtonColors[quest.category];
  const friends = overview?.friends ?? [];
  const savedCollections = userPacks.filter((pack) => pack.questIds.includes(quest.id)).length;
  const savedAnywhere = quest.saved || savedCollections > 0;
  const savedCount = (quest.saved ? 1 : 0) + savedCollections;
  const completedCount = (quest.completed ? 1 : 0) + (engine?.todayCompletions.filter((completion) => completion.questId === quest.id).length ?? 0);
  const creatorLabel = quest.createdByLabel?.trim();
  const creatorHandle = creatorLabel ? (creatorLabel.startsWith("@") ? creatorLabel : `@${creatorLabel}`) : "@QuestLifeTeam";
  const steps = quest.steps.length ? quest.steps : ["Head out at your own pace — no timer starts until you choose.", "Complete the core challenge described above.", "Log your experience in the Journal after finishing."];

  const startQuest = async () => { const ok = await tryStart({ questId: quest.id, source: "explore" }); if (ok) { await refresh(); router.replace("/active-quest"); } };
  const saveQuest = async () => { await openQuestSave(quest.id); };
  const nativeShare = async () => { await Share.share({ message: `Try the QuestLife quest “${quest.title}”: ${quest.description}` }); };
  const sendToFriend = async (challenge: boolean) => { if (!shareFriendId) return; if (challenge) await challengeFriend(shareFriendId, quest.id); else await shareQuestWith(shareFriendId, quest.id); setShareVisible(false); setShareFriendId(null); };

  return <Screen scroll={false} padded={false}>
    <View style={{ flex: 1 }}>
      <GradientBand color={quest.color} bleedTop><View style={{ ...edgePadding, paddingBottom: 10 }}><View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}><View style={{ flex: 1, minWidth: 0, gap: 10 }}><View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}><Tag label={quest.category} color={category.text} bg={category.bg} /><Tag label={quest.difficulty} color={difficulty.text} bg={difficulty.bg} /></View><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 31, lineHeight: 36 }}>{quest.title}</Text><Text numberOfLines={2} style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 14, lineHeight: 19 }}>by {creatorHandle}</Text></View><IconButton icon="chevron-back" onPress={onBack} /></View></View></GradientBand>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ ...edgePadding, paddingTop: 12, paddingBottom: 18, gap: 25 }}>
        <View style={{ minHeight: 78, borderRadius: 20, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, flexDirection: "row", alignItems: "center", paddingVertical: 13, boxShadow: `3px 4px 0px ${T.border}` }}><Stat label="Completed" value={String(completedCount)} icon="checkmark-circle" color={actionColor} /><Stat label="Saved" value={String(savedCount)} icon="bookmark" color={actionColor} bordered /><Stat label="Rating" value={reviews?.summary.averageRating ? reviews.summary.averageRating.toFixed(1) : "—"} icon="star" color={T.orange} bordered /></View>
        <View style={{ gap: 9 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 21 }}>About this quest</Text><Text style={{ color: T.dark, fontFamily: "Rubik", fontSize: 16, lineHeight: 25 }}>{quest.description}</Text></View>
        <View style={{ gap: 16, borderRadius: 22, borderWidth: 2, borderColor: `${category.text}55`, backgroundColor: `${category.text}0d`, padding: 18 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20 }}>How it works</Text><View style={{ gap: 14 }}>{steps.map((step, index) => <View key={`${index}-${step}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}><View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: actionColor, alignItems: "center", justifyContent: "center", marginTop: 1 }}><Text style={{ color: T.white, fontFamily: "RubikBold", fontSize: 13 }}>{index + 1}</Text></View><Text style={{ flex: 1, color: T.dark, fontFamily: "Rubik", fontSize: 14, lineHeight: 20 }}>{step}</Text></View>)}</View></View>
      </ScrollView>
      <View style={{ ...edgePadding, paddingTop: 12, paddingBottom: Math.max(insets.bottom + 8, 16), gap: 10, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.bg }}><View style={{ flexDirection: "row", gap: 10 }}><QuestAction label="Save Quest" icon={savedAnywhere ? "bookmark" : "bookmark-outline"} color={actionColor} inverse onPress={saveQuest} /><QuestAction label="Challenge friends" icon="share-social-outline" color={actionColor} inverse onPress={() => setShareVisible(true)} /></View>{isActive ? <QuestAction label="View Active Quest" icon="navigate" color={actionColor} fullWidth onPress={() => router.push("/active-quest")} /> : <QuestAction label={starting ? "Starting…" : hasOtherActive ? "Another Quest is Active" : "Start Quest"} icon="play" color={actionColor} fullWidth disabled={hasOtherActive || starting} onPress={startQuest} />}</View>
    </View>
    <QuestStartBlockModal block={block} visible={Boolean(block)} onClose={clearBlock} onGoActive={() => { clearBlock(); if (engine?.activeSession) router.push("/active-quest"); }} onSaveActive={async () => { await saveActiveForLater(); clearBlock(); await refresh(); }} />
    <Sheet visible={shareVisible} onClose={() => { setShareVisible(false); setShareFriendId(null); }} maxHeight="76%"><View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 15 }}><View style={{ gap: 4 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 22 }}>Challenge friends</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 13 }}>Invite a friend or share this quest in another app.</Text></View>{friends.length ? <View style={{ gap: 3 }}>{friends.map((friend) => <Pressable key={friend.userId} accessibilityRole="radio" accessibilityState={{ selected: shareFriendId === friend.userId }} onPress={() => setShareFriendId(friend.userId)} style={{ flexDirection: "row", alignItems: "center", gap: 11, minHeight: 58 }}><View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: `${actionColor}18`, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 20 }}>{friend.emoji}</Text></View><Text style={{ flex: 1, color: T.dark, fontFamily: "RubikBold", fontSize: 15 }}>{friend.displayName}</Text><Ionicons name={shareFriendId === friend.userId ? "checkmark-circle" : "radio-button-off"} size={22} color={shareFriendId === friend.userId ? actionColor : T.muted} /></Pressable>)}</View> : <EmptyState emoji="👋" title="No friends added yet" body="You can still send this quest through your favorite messaging app." />}{shareFriendId ? <View style={{ flexDirection: "row", gap: 9 }}><QuestAction label="Share" icon="paper-plane-outline" color={actionColor} inverse onPress={() => void sendToFriend(false)} /><QuestAction label="Challenge" icon="flash" color={actionColor} onPress={() => void sendToFriend(true)} /></View> : null}<QuestAction label="Share via other apps" icon="share-outline" color={actionColor} fullWidth inverse onPress={() => void nativeShare()} /></View></Sheet>
  </Screen>;
}
