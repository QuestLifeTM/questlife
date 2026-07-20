import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

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

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ComposerTabs({ active, onChange }: { active: Exclude<ComposerTab, "choice">; onChange: (tab: Exclude<ComposerTab, "choice">) => void }) {
  return <View style={{ flexDirection: "row", gap: 6, padding: 5, borderRadius: 18, borderWidth: 1, borderColor: T.border, backgroundColor: "#f7f3ee" }}>
    {(["post", "journal"] as const).map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: active === tab }} onPress={() => onChange(tab)} style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: active === tab ? T.white : "transparent", borderWidth: active === tab ? 1 : 0, borderColor: active === tab ? `${T.blue}45` : "transparent", transform: [{ scale: pressed ? 0.98 : 1 }] })}><Text style={{ color: active === tab ? T.blue : T.muted, fontSize: 13, fontWeight: "900" }}>{tab === "post" ? "Make a post" : "Personal journal"}</Text></Pressable>)}
  </View>;
}

function ImageSlot({ uri, onRemove, onAdd }: { uri?: string; onRemove?: () => void; onAdd?: () => void }) {
  return <View style={{ width: 70, height: 70, borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: uri ? T.border : `${T.blue}77`, backgroundColor: uri ? T.bg : `${T.blue}0c` }}>
    {uri ? <><Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /><Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={onRemove} style={{ position: "absolute", top: 4, left: 4, width: 23, height: 23, borderRadius: 12, backgroundColor: T.white, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={16} color={T.dark} /></Pressable></> : <Pressable accessibilityRole="button" accessibilityLabel="Add photo from library" onPress={onAdd} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={28} color={T.blue} /></Pressable>}
  </View>;
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
  onSaveDraft?: (draft: { title: string; body: string }) => Promise<void>;
}) {
  const { completeQuest } = useQuestEngine();
  const { refreshNotifications } = useNotifications();
  const { refresh: refreshStreaks } = useStreaks();
  const [tab, setTab] = useState<ComposerTab>("choice");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalBody, setJournalBody] = useState("");
  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTab("choice");
    setJournalTitle(initialTitle?.trim() || quest?.title || "");
    setJournalBody(initialReflection);
    setCaption("");
    setPhotos(photoUris.slice(0, 4));
    setError(null);
  }, [initialReflection, initialTitle, photoUris, quest?.title, visible]);

  const bodyForCompletion = useMemo(() => {
    const title = journalTitle.trim();
    const body = journalBody.trim();
    return title && title !== quest?.title ? `${title}\n\n${body}`.trim() : body;
  }, [journalBody, journalTitle, quest?.title]);

  if (!quest) return null;

  const addPhoto = async () => {
    if (photos.length >= 4) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhotos((current) => [...current, result.assets[0].uri].slice(0, 4));
  };

  const save = async (visibility: "private" | "public" | "friends") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSaveDraft?.({ title: journalTitle, body: journalBody });
      const completion = await completeQuest({ questId: quest.id, logged: true, reflection: bodyForCompletion || null, rating: null, review: null, reviewPublic: false, photoUrls: [] });
      if (visibility !== "private") {
        const uploaded = await Promise.all(photos.map((uri) => uploadQuestPhoto(uri)));
        await createQuestPost({ questId: quest.id, completionId: completion.completionId, caption, photoUrls: uploaded, visibility, durationSeconds });
      }
      await Promise.all([refreshNotifications(), refreshStreaks()]);
      await onFinished(completion);
    } catch (nextError) {
      setError(engineErrorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  return <Sheet visible={visible} onClose={busy ? () => undefined : onClose} maxHeight="94%" fillHeight>
    {tab === "choice" ? <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 20, justifyContent: "center", gap: 16 }}>
      <View style={{ alignItems: "center", gap: 8 }}><View style={{ width: 58, height: 58, borderRadius: 21, backgroundColor: `${T.blue}15`, alignItems: "center", justifyContent: "center" }}><Ionicons name="book-outline" size={29} color={T.blue} /></View><Text style={{ color: T.dark, fontSize: 24, fontWeight: "900", textAlign: "center" }}>Your quest is complete</Text><Text style={{ color: T.muted, fontSize: 14, lineHeight: 21, fontWeight: "700", textAlign: "center" }}>Would you like to share your experience through a post, or keep your journal entry just for you? You can choose Public or Friends when you post.</Text></View>
      <Pressable accessibilityRole="button" onPress={() => setTab("post")} style={({ pressed }) => ({ borderRadius: 21, padding: 16, gap: 7, backgroundColor: `${T.blue}12`, borderWidth: 2, borderColor: `${T.blue}55`, borderBottomWidth: 5, borderBottomColor: "#a8d8ff", transform: [{ translateY: pressed ? 3 : 0 }] })}><View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><Ionicons name="paper-plane" size={21} color={T.blue} /><Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>Make a post</Text></View><Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>Share a caption, up to four photos, and your quest time.</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setTab("journal")} style={({ pressed }) => ({ borderRadius: 21, padding: 16, gap: 7, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, transform: [{ translateY: pressed ? 2 : 0 }] })}><View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><Ionicons name="lock-closed-outline" size={20} color={T.purple} /><Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>Just save my journal</Text></View><Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>Keep this reflection private and revisit it in Journal.</Text></Pressable>
    </View> : <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 13 }}><ComposerTabs active={tab} onChange={setTab} /></View>
      {tab === "journal" ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 18, gap: 12 }}><View style={{ gap: 4 }}><Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Personal journal</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>Only you can see anything written here.</Text></View><View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Title</Text><TextInput value={journalTitle} onChangeText={setJournalTitle} placeholder="A title for this memory" placeholderTextColor={T.muted} style={{ minHeight: 52, borderWidth: 2, borderColor: T.border, borderRadius: 16, paddingHorizontal: 13, color: T.dark, fontWeight: "800", backgroundColor: T.bg }} /></View><View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Journal entry</Text><TextInput value={journalBody} onChangeText={setJournalBody} multiline textAlignVertical="top" placeholder="What do you want to remember?" placeholderTextColor={T.muted} style={{ minHeight: 190, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 13, color: T.dark, lineHeight: 21, fontWeight: "700", backgroundColor: T.bg }} /></View></ScrollView> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 18, gap: 13 }}><View style={{ gap: 4 }}><Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Make a post</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>Your journal entry stays private. Only this caption and these photos will be shared.</Text></View><View style={{ borderRadius: 16, padding: 13, backgroundColor: `${quest.color}12`, borderWidth: 1, borderColor: `${quest.color}40` }}><Text style={{ color: T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }}>QUEST</Text><Text style={{ color: T.dark, fontSize: 18, fontWeight: "900", marginTop: 2 }}>{quest.title}</Text></View><View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Description</Text><TextInput value={caption} onChangeText={setCaption} multiline textAlignVertical="top" placeholder="Share a little about your experience…" placeholderTextColor={T.muted} style={{ minHeight: 92, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 13, color: T.dark, lineHeight: 20, fontWeight: "700", backgroundColor: T.bg }} /></View><View style={{ gap: 7 }}><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Photos</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "800" }}>{photos.length}/4</Text></View><View style={{ flexDirection: "row", gap: 8 }}>{[0, 1, 2, 3].map((index) => <ImageSlot key={index} uri={photos[index]} onRemove={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} onAdd={photos.length < 4 ? () => void addPhoto() : undefined} />)}</View></View><View style={{ minHeight: 68, borderRadius: 17, padding: 13, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }}><View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: `${quest.color}18`, alignItems: "center", justifyContent: "center" }}><Ionicons name="time-outline" size={20} color={quest.color} /></View><View><Text style={{ color: T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }}>QUEST TIME</Text><Text style={{ color: T.dark, fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{formatDuration(durationSeconds)}</Text></View></View></ScrollView>}
      <View style={{ paddingHorizontal: 24, paddingTop: 11, paddingBottom: 12, gap: 9, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.white }}><Text style={{ color: T.muted, fontSize: 11, lineHeight: 16, fontWeight: "700", textAlign: "center" }}>Anything written in Personal Journal stays private and is available from your Journal screen.</Text>{error ? <Text accessibilityRole="alert" style={{ color: T.red, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" }}>{error}</Text> : null}{tab === "journal" ? <SoftButton label={busy ? "Saving…" : "End & save journal entry"} icon="checkmark" color={T.green} disabled={busy} onPress={() => void save("private")} /> : <View style={{ flexDirection: "row", gap: 8 }}><SoftButton label="Post to Public" icon="earth" color={T.blue} disabled={busy} onPress={() => void save("public")} style={{ flex: 1, minHeight: 50, paddingHorizontal: 8 }} /><SoftButton label="Friends only" icon="people" color={T.purple} disabled={busy} onPress={() => void save("friends")} style={{ flex: 1, minHeight: 50, paddingHorizontal: 8 }} /></View>}</View>
    </View>}
  </Sheet>;
}
