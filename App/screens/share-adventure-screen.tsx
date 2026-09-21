import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CachedImage } from "@/components/cached-image";
import { categoryColor, radius, T } from "@/components/theme";
import { IconButton } from "@/components/ui";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { uploadQuestPhoto } from "@/services/engine/questEngineService";
import { fetchJournalMemory, resolveJournalMedia } from "@/services/journal/journalService";
import { createQuestPost } from "@/services/profile/profileService";
import { JournalMemory } from "@/types/journal";

type Visibility = "public" | "friends" | "private";
type ComposerPhoto = { id: string; uri: string; source: "quest" | "device" };
const MAX_POST_PHOTOS = 4;

const audienceOptions: ReadonlyArray<{ value: Visibility; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: "public", label: "Everyone", icon: "earth-outline" },
  { value: "friends", label: "Friends", icon: "people-outline" },
];

function isPublicQuestPhoto(uri: string) {
  return /\/storage\/v1\/object\/public\/quest-photos\//i.test(uri);
}

function parsePhotoUris(value: string | undefined) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((uri): uri is string => typeof uri === "string" && uri.trim().length > 0).slice(0, MAX_POST_PHOTOS) : [];
  } catch {
    return [];
  }
}

function postErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "We couldn't post your quest experience. Your draft is still here.";
}

function ComposerPhotoCard({ photo, index, onRemove, accentColor }: { photo: ComposerPhoto; index: number; onRemove: () => void; accentColor: string }) {
  return <View style={{ width: 218, height: 218, borderRadius: radius.lg, overflow: "hidden", backgroundColor: T.border, borderWidth: 2, borderColor: `${accentColor}52` }}>
    {photo.source === "quest" ? <CachedImage uri={photo.uri} accessibilityLabel={`Selected quest photo ${index + 1}`} style={{ width: "100%", height: "100%" }} /> : <Image source={{ uri: photo.uri }} accessibilityLabel={`Selected new photo ${index + 1}`} style={{ width: "100%", height: "100%" }} resizeMode="cover" />}
    <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1} from post`} onPress={onRemove} hitSlop={7} style={({ pressed }) => ({ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1.5, borderColor: T.border, opacity: pressed ? 0.7 : 1 })}><Ionicons name="close" size={20} color={T.dark} /></Pressable>
  </View>;
}

function AddPhotoCard({ onPress, disabled, accentColor }: { onPress: () => void; disabled: boolean; accentColor: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Add a photo to this post" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ width: 138, height: 218, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: 9, borderWidth: 2, borderStyle: "dashed", borderColor: `${accentColor}8e`, backgroundColor: `${accentColor}0d`, opacity: disabled ? 0.45 : pressed ? 0.72 : 1 })}>
    <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: `${accentColor}18` }}><Ionicons name="add" size={25} color={accentColor} /></View><Text style={{ color: accentColor, fontFamily: "RubikBold", fontSize: 13, textAlign: "center" }}>Add photo</Text>
  </Pressable>;
}

function QuestToggle({ value, label, disabled, accentColor, onChange }: { value: boolean; label: string; disabled: boolean; accentColor: string; onChange: () => void }) {
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={onChange} hitSlop={6} style={({ pressed }) => ({ width: 52, height: 30, padding: 3, borderRadius: 15, justifyContent: "center", alignItems: value ? "flex-end" : "flex-start", backgroundColor: value ? accentColor : "#e5ddd3", borderWidth: 1.5, borderColor: value ? accentColor : T.border, opacity: disabled ? 0.45 : pressed ? 0.72 : 1, transform: [{ translateY: pressed ? 1 : 0 }] })}>
    <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: T.white, boxShadow: "0px 1px 2px rgba(61,52,56,0.22)" }}><Ionicons name={value ? "checkmark" : "close"} size={14} color={value ? accentColor : T.muted} /></View>
  </Pressable>;
}

export function ShareAdventureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showFeedback } = useAppFeedback();
  const { completionId, questId, title, rating, sharePhotos } = useLocalSearchParams<{ completionId?: string; questId?: string; title?: string; rating?: string; sharePhotos?: string }>();
  const [memory, setMemory] = useState<JournalMemory | null>(null);
  const [photos, setPhotos] = useState<ComposerPhoto[]>([]);
  const [review, setReview] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("friends");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accentColor = useMemo(() => !memory ? T.blue : categoryColor[memory.category]?.text ?? memory.color ?? T.blue, [memory]);
  const questTitle = memory?.title ?? title ?? "Completed quest";
  const handoffPhotos = useMemo(() => parsePhotoUris(sharePhotos), [sharePhotos]);

  useEffect(() => {
    let current = true;
    if (!completionId) { setLoading(false); setError("We couldn't find the completed quest to share."); return () => { current = false; }; }
    if (handoffPhotos.length) setPhotos(handoffPhotos.map((uri, index) => ({ id: `handoff-${index}-${uri}`, uri, source: "quest" })));
    setLoading(true);
    fetchJournalMemory(completionId).then(async (nextMemory) => {
      if (!nextMemory) throw new Error("This quest memory is no longer available.");
      const urls = await resolveJournalMedia(nextMemory.photoPaths);
      if (!current) return;
      setMemory(nextMemory);
      if (urls.length) setPhotos(urls.slice(0, MAX_POST_PHOTOS).map((uri, index) => ({ id: `quest-${index}-${uri}`, uri, source: "quest" })));
    }).catch((nextError) => { if (current && !handoffPhotos.length) setError(nextError instanceof Error ? nextError.message : "We couldn't load your quest photos."); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [completionId, handoffPhotos]);

  const addPhoto = async () => {
    if (posting || photos.length >= MAX_POST_PHOTOS) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.82 });
    if (result.canceled || !result.assets[0]) return;
    setPhotos((current) => current.length >= MAX_POST_PHOTOS ? current : [...current, { id: `device-${Date.now()}`, uri: result.assets[0].uri, source: "device" }]);
  };

  const post = async () => {
    if (!completionId || !questId || posting) return;
    setPosting(true); setError(null);
    try {
      const photoUrls = await Promise.all(photos.map((photo) => isPublicQuestPhoto(photo.uri) ? photo.uri : uploadQuestPhoto(photo.uri)));
      const createdPost = await createQuestPost({ questId, completionId, title: questTitle, caption: review.trim(), photoUrls, visibility, commentsEnabled, stats: { rating: Number(rating) || 0 } });
      showFeedback({ message: "Your quest experience is live.", icon: "checkmark-circle", color: accentColor });
      router.replace({ pathname: "/(tabs)/social", params: { postId: createdPost.id, scope: visibility === "public" ? "public" : "friends" } });
    } catch (nextError) { setError(postErrorMessage(nextError)); } finally { setPosting(false); }
  };

  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} backAccent={accentColor} size={42} />
      <View style={{ flex: 1 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28 }} numberOfLines={2}>Share your Experience</Text></View>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 28, gap: 22 }}>
      <View style={{ gap: 9 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15 }}>Quest photos</Text><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12 }}>{photos.length}/{MAX_POST_PHOTOS}</Text></View>
        {loading && !photos.length ? <View accessibilityRole="progressbar" style={{ height: 218, borderRadius: radius.lg, backgroundColor: `${accentColor}12` }} /> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>{photos.map((photo, index) => <ComposerPhotoCard key={photo.id} photo={photo} index={index} accentColor={accentColor} onRemove={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))} />)}{photos.length < MAX_POST_PHOTOS ? <AddPhotoCard onPress={() => void addPhoto()} disabled={posting} accentColor={accentColor} /> : null}</ScrollView>}
        {!loading && !photos.length ? <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 17 }}>No quest photos yet. Add one from your library if you want.</Text> : null}
      </View>
      <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 26, lineHeight: 32 }} numberOfLines={3}>{questTitle}</Text>
      <View style={{ gap: 8 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16 }}>Write your Review</Text><View style={{ position: "relative" }}><TextInput value={review} onChangeText={(value) => setReview(value.slice(0, 1_000))} editable={!posting} multiline textAlignVertical="top" maxLength={1_000} placeholder="What made this quest memorable?" placeholderTextColor={T.muted} style={{ minHeight: 130, borderRadius: radius.md, borderWidth: 2, borderColor: T.border, borderBottomWidth: 4, borderBottomColor: "#d9d0c6", paddingTop: 15, paddingHorizontal: 15, paddingBottom: 31, color: T.dark, fontFamily: "Rubik", fontSize: 15, lineHeight: 22, fontWeight: "600", backgroundColor: T.white }} /><Text pointerEvents="none" style={{ position: "absolute", right: 13, bottom: 10, color: T.muted, fontFamily: "RubikBold", fontSize: 11 }}>{review.length}/1000</Text></View></View>
      <View style={{ minHeight: 68, paddingHorizontal: 15, borderRadius: radius.md, borderWidth: 2, borderColor: T.border, borderBottomWidth: 4, borderBottomColor: "#d9d0c6", backgroundColor: T.white, flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: `${accentColor}16` }}><Ionicons name="chatbubble-ellipses-outline" size={20} color={accentColor} /></View><View style={{ flex: 1, gap: 2 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15 }}>Allow comments</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 16 }}>Let people respond to this quest.</Text></View><QuestToggle label="Allow comments" value={commentsEnabled} disabled={posting} accentColor={accentColor} onChange={() => setCommentsEnabled((current) => !current)} /></View>
      <View style={{ gap: 9 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16 }}>Who can see this?</Text><View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8 }}>{audienceOptions.map((option) => { const selected = visibility === option.value; return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={option.label} disabled={posting} onPress={() => setVisibility(option.value)} style={({ pressed }) => ({ flex: 1, minHeight: 76, paddingHorizontal: 5, borderRadius: 17, borderWidth: 2, borderColor: selected ? accentColor : T.border, borderBottomWidth: selected ? 4 : 3, borderBottomColor: selected ? `${accentColor}99` : "#d9d0c6", backgroundColor: selected ? `${accentColor}12` : T.white, alignItems: "center", justifyContent: "center", gap: 5, opacity: posting ? 0.45 : pressed ? 0.72 : 1, transform: [{ translateY: pressed ? 1 : 0 }] })}><Ionicons name={option.icon} size={20} color={selected ? accentColor : T.muted} /><Text style={{ color: selected ? accentColor : T.dark, fontFamily: "RubikBold", fontSize: 11, textAlign: "center" }} numberOfLines={1}>{option.label}</Text></Pressable>; })}</View></View>
      {error ? <View accessibilityRole="alert" style={{ padding: 12, borderRadius: 15, backgroundColor: `${T.red}12`, borderWidth: 1.5, borderColor: `${T.red}5c`, flexDirection: "row", gap: 8 }}><Ionicons name="alert-circle" size={18} color={T.red} /><Text style={{ flex: 1, color: T.red, fontFamily: "RubikBold", fontSize: 12, lineHeight: 17 }}>{error}</Text></View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Post quest experience" accessibilityState={{ disabled: posting || loading, busy: posting }} disabled={posting || loading} onPress={() => void post()} style={({ pressed }) => ({ minHeight: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, backgroundColor: accentColor, borderBottomWidth: 6, borderBottomColor: `${accentColor}b3`, opacity: posting || loading ? 0.48 : pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}><Ionicons name="paper-plane-outline" size={18} color={T.white} /><Text style={{ color: T.white, fontFamily: "RubikBold", fontWeight: "700", fontSize: 16, lineHeight: 22 }}>{posting ? "Posting…" : "Post"}</Text><Ionicons name="arrow-forward" size={18} color={T.white} /></Pressable>
    </ScrollView>
  </View>;
}
