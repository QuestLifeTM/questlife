import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { T } from "@/components/theme";
import { Sheet, SoftButton } from "@/components/ui";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { engineErrorMessage, uploadQuestPhoto } from "@/services/engine/questEngineService";
import { createQuestPost } from "@/services/profile/profileService";
import { Quest } from "@/types/content";
import { CompletionResult } from "@/types/engine";

type ComposerTab = "choice" | "post" | "journal";
type PostStatKey = "photos" | "distance" | "time" | "reward";

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ComposerTabs({ active, onChange }: { active: Exclude<ComposerTab, "choice">; onChange: (tab: Exclude<ComposerTab, "choice">) => void }) {
  return <View style={{ flexDirection: "row", gap: 6, padding: 5, borderRadius: 18, borderWidth: 1, borderColor: T.border, backgroundColor: "#f7f3ee" }}>
    {(["post", "journal"] as const).map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: active === tab }} onPress={() => onChange(tab)} style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: active === tab ? T.white : "transparent", borderWidth: active === tab ? 1 : 0, borderColor: active === tab ? `${T.blue}45` : "transparent", transform: [{ scale: pressed ? 0.98 : 1 }] })}><Text style={{ color: active === tab ? T.blue : T.muted, fontSize: 13, fontWeight: "900" }}>{tab === "post" ? "Post" : "Journal"}</Text></Pressable>)}
  </View>;
}

function RatingPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <View accessibilityRole="radiogroup" style={{ alignItems: "center", gap: 5 }}>
    <Text style={{ color: T.dark, fontSize: 14, fontWeight: "900" }}>How was this quest?</Text>
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((rating) => <Pressable key={rating} accessibilityRole="radio" accessibilityState={{ checked: value === rating }} accessibilityLabel={`${rating} star${rating === 1 ? "" : "s"}`} onPress={() => onChange(rating)} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.9 : 1 }] })}><Ionicons name={rating <= value ? "star" : "star-outline"} size={31} color={rating <= value ? T.orange : T.muted} /></Pressable>)}
    </View>
    <Text style={{ color: T.muted, fontSize: 11, fontWeight: "700" }}>{value ? `${value} of 5 stars` : "Choose a star rating to finish"}</Text>
  </View>;
}

function ImageSlot({ uri, onRemove, onAdd }: { uri?: string; onRemove?: () => void; onAdd?: () => void }) {
  return <View style={{ flex: 1, minWidth: 0, aspectRatio: 1, borderRadius: 15, overflow: "hidden", borderWidth: 1.5, borderColor: uri ? "rgba(255,255,255,0.78)" : `${T.blue}88`, backgroundColor: uri ? "rgba(255,255,255,0.2)" : `${T.blue}10` }}>
    {uri ? <><Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /><Pressable accessibilityRole="button" accessibilityLabel="Remove photo" hitSlop={4} onPress={onRemove} style={({ pressed }) => ({ position: "absolute", top: 5, left: 5, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.75 : 1 })}><Ionicons name="close" size={19} color={T.dark} /></Pressable></> : <Pressable accessibilityRole="button" accessibilityLabel="Add photo from library" onPress={onAdd} style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? `${T.blue}12` : "transparent" })}><Ionicons name="add" size={29} color={T.blue} /></Pressable>}
  </View>;
}

/** Matches the raised, tactile action treatment used for Party actions. */
function PublishButton({ label, icon, color, disabled, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; disabled: boolean; onPress: () => void }) {
  const lowerEdge = color === T.blue ? "#258fd8" : color === T.purple ? "#7973c7" : color;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 58, minWidth: 0, paddingHorizontal: 12, borderRadius: 22, backgroundColor: disabled ? T.border : color, borderBottomWidth: 6, borderBottomColor: disabled ? "#d7cec2" : lowerEdge, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, opacity: disabled ? 0.6 : 1, transform: [{ translateY: pressed && !disabled ? 3 : 0 }] })}><Ionicons name={icon} size={19} color={T.white} /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1, color: T.white, fontSize: 16, fontWeight: "900", textAlign: "center" }}>{label}</Text></Pressable>;
}

function postPublishErrorMessage(error: unknown) {
  const message = engineErrorMessage(error);
  if (/post_(title|stats)|duration_seconds|column .* does not exist/i.test(message)) return "Your quest is saved, but posting needs the latest Supabase migration. Apply it, then retry.";
  if (/row-level security|permission denied|not authorized/i.test(message)) return "Your quest is saved, but we couldn't publish this post. Please sign in again, then retry.";
  return `Your quest is saved, but we couldn't publish the post. ${message}`;
}

function QuestStats({ photos, distanceMeters, durationSeconds, xp, visibleStats, onToggle }: { photos: number; distanceMeters: number; durationSeconds: number; xp: number; visibleStats: Record<PostStatKey, boolean>; onToggle: (key: PostStatKey) => void }) {
  const stats = [
    { key: "photos" as const, label: "PHOTOS", value: String(photos), color: T.blue },
    { key: "distance" as const, label: "DISTANCE", value: `${(distanceMeters / 1_000).toFixed(2)} km`, color: T.purple },
    { key: "time" as const, label: "QUEST TIME", value: formatDuration(durationSeconds), color: T.green },
    { key: "reward" as const, label: "REWARD", value: `+${xp} XP`, color: T.orange },
  ];
  return <View style={{ gap: 7 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: T.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Post stats</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "700" }}>Tap an eye to hide it</Text></View><View style={{ flexDirection: "row", flexWrap: "wrap", borderRadius: 18, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(228,220,211,0.9)", backgroundColor: "rgba(255,255,255,0.48)" }}>{stats.map((stat, index) => <View key={stat.key} style={{ width: "50%", minHeight: 82, justifyContent: "center", alignItems: "center", gap: 3, opacity: visibleStats[stat.key] ? 1 : 0.42, borderRightWidth: index % 2 === 0 ? 1 : 0, borderBottomWidth: index < 2 ? 1 : 0, borderColor: "rgba(228,220,211,0.82)" }}><Text adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.72} style={{ maxWidth: "88%", color: T.dark, fontSize: 24, lineHeight: 28, fontWeight: "900", fontVariant: ["tabular-nums"], textAlign: "center" }}>{stat.value}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${visibleStats[stat.key] ? "Hide" : "Show"} ${stat.label.toLowerCase()} on this post`} onPress={() => onToggle(stat.key)} hitSlop={6} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 10, backgroundColor: pressed ? `${stat.color}16` : "transparent" })}><Text style={{ color: stat.color, fontSize: 10, fontWeight: "900", letterSpacing: 0.55 }}>{stat.label}</Text><Ionicons name={visibleStats[stat.key] ? "eye" : "eye-off"} size={14} color={stat.color} /></Pressable></View>)}</View></View>;
}

/** The completion sheet keeps a journal private by default and only creates a
 * social post when the user explicitly selects one of the publish actions. */
export function LogLoreFlow({
  visible,
  quest,
  onClose,
  onFinished,
  initialTitle,
  initialReflection = "",
  photoUris = [],
  durationSeconds = 0,
  distanceMeters = 0,
  onSaveDraft,
}: {
  visible: boolean;
  quest: Quest | null;
  onClose: () => void;
  onFinished: (result: CompletionResult) => void | Promise<void>;
  initialTitle?: string;
  initialReflection?: string;
  photoUris?: string[];
  durationSeconds?: number;
  distanceMeters?: number;
  onSaveDraft?: (draft: { title: string; body: string }) => Promise<void>;
}) {
  const { completeQuest } = useQuestEngine();
  const { refreshNotifications } = useNotifications();
  const { refresh: refreshStreaks } = useStreaks();
  const [tab, setTab] = useState<ComposerTab>("choice");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalBody, setJournalBody] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [visiblePostStats, setVisiblePostStats] = useState<Record<PostStatKey, boolean>>({ photos: true, distance: true, time: true, reward: true });
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postRetryReady, setPostRetryReady] = useState(false);
  const initializedForOpen = useRef(false);
  const completedQuest = useRef<CompletionResult | null>(null);

  useEffect(() => {
    if (!visible) {
      initializedForOpen.current = false;
      completedQuest.current = null;
      return;
    }
    if (initializedForOpen.current) return;
    initializedForOpen.current = true;
    setTab("choice");
    setJournalTitle(initialTitle?.trim() || quest?.title || "");
    setJournalBody(initialReflection);
    setPostTitle(quest?.title || "");
    setCaption("");
    setPhotos(photoUris.slice(0, 4));
    setVisiblePostStats({ photos: true, distance: true, time: true, reward: true });
    setRating(0);
    setPostRetryReady(false);
    setError(null);
  }, [initialReflection, initialTitle, photoUris, quest?.title, visible]);

  const bodyForCompletion = useMemo(() => {
    const title = journalTitle.trim();
    const body = journalBody.trim();
    return title && title !== quest?.title ? `${title}\n\n${body}`.trim() : body;
  }, [journalBody, journalTitle, quest?.title]);

  if (!quest) return null;

  const requestReturnToQuest = () => {
    if (busy) return;
    Alert.alert("Continue your quest?", "Your notes and photos are still here. You can return to finish logging whenever you’re ready.", [
      { text: "Keep logging", style: "cancel" },
      { text: "Continue quest", onPress: onClose },
    ]);
  };

  const addPhoto = async () => {
    if (photos.length >= 4) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhotos((current) => [...current, result.assets[0].uri].slice(0, 4));
  };

  const save = async (visibility: "private" | "public" | "friends") => {
    if (busy) return;
    if (!rating) {
      setError("Choose a star rating to finish this quest.");
      return;
    }
    setBusy(true);
    setError(null);
    let completion = completedQuest.current;
    if (!completion) {
      try {
        await onSaveDraft?.({ title: journalTitle, body: journalBody });
        completion = await completeQuest({ questId: quest.id, logged: true, reflection: bodyForCompletion || null, rating, review: null, reviewPublic: false, photoUrls: [] });
        completedQuest.current = completion;
      } catch (nextError) {
        setError(engineErrorMessage(nextError));
        setBusy(false);
        return;
      }
    }

    try {
      if (visibility !== "private") {
        const uploaded = await Promise.all(photos.map((uri) => uploadQuestPhoto(uri)));
        await createQuestPost({ questId: quest.id, completionId: completion.completionId, title: postTitle, caption, photoUrls: uploaded, visibility, durationSeconds, stats: {
          ...(visiblePostStats.photos ? { photos: photos.length } : {}),
          ...(visiblePostStats.distance ? { distanceMeters } : {}),
          ...(visiblePostStats.time ? { durationSeconds } : {}),
          ...(visiblePostStats.reward ? { rewardXp: quest.xp } : {}),
        } });
      }
    } catch (nextError) {
      setError(postPublishErrorMessage(nextError));
      setPostRetryReady(true);
      setBusy(false);
      return;
    }

    try {
      await Promise.allSettled([refreshNotifications(), refreshStreaks()]);
      await onFinished(completion);
    } catch (nextError) {
      // The quest still completed successfully; only surface an error if the
      // local hand-off itself fails.
      setError("Your quest was completed, but we couldn't open your Journal. Please reopen it from the tab bar.");
    } finally {
      setBusy(false);
    }
  };

  return <Sheet visible={visible} onClose={requestReturnToQuest} maxHeight="84%" fillHeight glass>
    {tab === "choice" ? <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 28, justifyContent: "center", gap: 14 }}>
      <View style={{ alignItems: "center", gap: 7, marginBottom: 4 }}><View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: `${T.blue}18`, alignItems: "center", justifyContent: "center" }}><Ionicons name="checkmark" size={31} color={T.blue} /></View><Text style={{ color: T.dark, fontSize: 26, fontWeight: "900", textAlign: "center" }}>Quest complete!</Text><Text style={{ color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" }}>Keep the memory private, or share it with your people.</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Make a quest post" onPress={() => setTab("post")} style={({ pressed }) => ({ minHeight: 84, borderRadius: 18, paddingHorizontal: 17, paddingVertical: 14, gap: 5, backgroundColor: `${T.blue}e8`, borderBottomWidth: 5, borderBottomColor: "#258fd8", justifyContent: "center", transform: [{ translateY: pressed ? 3 : 0 }] })}><View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><Ionicons name="paper-plane" size={20} color={T.white} /><Text style={{ color: T.white, fontSize: 18, fontWeight: "900" }}>Share a post</Text></View><Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, lineHeight: 17, fontWeight: "700" }}>Add a caption, photos, and choose Public or Friends.</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Save a private journal entry" onPress={() => setTab("journal")} style={({ pressed }) => ({ minHeight: 84, borderRadius: 18, paddingHorizontal: 17, paddingVertical: 14, gap: 5, backgroundColor: "rgba(255,255,255,0.58)", borderWidth: 1.5, borderColor: T.border, justifyContent: "center", transform: [{ translateY: pressed ? 2 : 0 }] })}><View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><Ionicons name="lock-closed" size={19} color={T.purple} /><Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>Keep it private</Text></View><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>Save your reflection to your personal Journal.</Text></Pressable>
    </View> : <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 13 }}><ComposerTabs active={tab} onChange={setTab} /><RatingPicker value={rating} onChange={(nextRating) => { setRating(nextRating); setError(null); }} /></View>
      {tab === "journal" ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 18, gap: 12 }}><View style={{ gap: 4 }}><Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Personal journal</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>Only you can see anything written here.</Text></View><View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Title</Text><TextInput value={journalTitle} onChangeText={setJournalTitle} placeholder="A title for this memory" placeholderTextColor={T.muted} style={{ minHeight: 52, borderWidth: 2, borderColor: T.border, borderRadius: 16, paddingHorizontal: 13, color: T.dark, fontWeight: "800", backgroundColor: T.bg }} /></View><View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Journal entry</Text><TextInput value={journalBody} onChangeText={setJournalBody} multiline textAlignVertical="top" placeholder="What do you want to remember?" placeholderTextColor={T.muted} style={{ minHeight: 190, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 13, color: T.dark, lineHeight: 21, fontWeight: "700", backgroundColor: T.bg }} /></View></ScrollView> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 18, gap: 14 }}><View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Post title</Text><TextInput value={postTitle} onChangeText={setPostTitle} placeholder={quest.title} placeholderTextColor={T.muted} maxLength={80} style={{ minHeight: 54, borderWidth: 2, borderColor: T.border, borderRadius: 16, paddingHorizontal: 13, color: T.dark, fontSize: 19, fontWeight: "900", backgroundColor: "rgba(255,255,255,0.58)" }} /></View><View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Description</Text><TextInput value={caption} onChangeText={setCaption} multiline textAlignVertical="top" placeholder="Share a little about your experience…" placeholderTextColor={T.muted} style={{ minHeight: 84, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 13, color: T.dark, lineHeight: 20, fontWeight: "700", backgroundColor: "rgba(255,255,255,0.58)" }} /></View><View style={{ gap: 8 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Photos</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>{photos.length}/4</Text></View><View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>{[0, 1, 2, 3].map((index) => <ImageSlot key={index} uri={photos[index]} onRemove={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} onAdd={photos.length < 4 ? () => void addPhoto() : undefined} />)}</View></View><QuestStats photos={photos.length} distanceMeters={distanceMeters} durationSeconds={durationSeconds} xp={quest.xp} visibleStats={visiblePostStats} onToggle={(key) => setVisiblePostStats((current) => ({ ...current, [key]: !current[key] }))} /></ScrollView>}
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 10, borderTopWidth: 1, borderTopColor: "rgba(228,220,211,0.9)", backgroundColor: "rgba(255,255,255,0.45)" }}><Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700", textAlign: "center" }}>Your journal and path stay private. Share only the post details you choose.</Text>{error ? <Text accessibilityRole="alert" style={{ color: T.red, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" }}>{error}</Text> : null}{tab === "journal" ? <SoftButton label={busy ? "Saving…" : "End & save journal entry"} icon="checkmark" color={T.green} disabled={busy} onPress={() => void save("private")} /> : <View style={{ flexDirection: "row", gap: 12, marginTop: 2 }}><PublishButton label={postRetryReady ? "Retry Public" : "Post to Public"} icon="earth" color={T.blue} disabled={busy} onPress={() => void save("public")} /><PublishButton label={postRetryReady ? "Retry Friends" : "Friends only"} icon="people" color={T.purple} disabled={busy} onPress={() => void save("friends")} /></View>}</View>
    </View>}
  </Sheet>;
}
