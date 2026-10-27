import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CachedImage } from "@/components/cached-image";
import { categoryColor, T } from "@/components/theme";
import { IconButton } from "@/components/ui";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { uploadQuestPhoto } from "@/services/engine/questEngineService";
import { fetchJournalMemory, resolveJournalMedia } from "@/services/journal/journalService";
import { createQuestPost } from "@/services/profile/profileService";
import { useAppViewport, useResponsiveScreenLayout } from "@/lib/responsive";
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

function ComposerPhotoCard({ photo, index, onRemove, accentColor, disabled }: { disabled: boolean; photo: ComposerPhoto; index: number; onRemove: () => void; accentColor: string }) {
  return <View style={{ width: 154, height: 168, borderRadius: 16, overflow: "hidden", backgroundColor: T.border, borderWidth: 2, borderColor: `${accentColor}52` }}>
    {photo.source === "quest" ? <CachedImage uri={photo.uri} accessibilityLabel={`Selected quest photo ${index + 1}`} style={{ width: "100%", height: "100%" }} /> : <Image source={{ uri: photo.uri }} accessibilityLabel={`Selected new photo ${index + 1}`} style={{ width: "100%", height: "100%" }} resizeMode="cover" />}
    <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1} from post`} disabled={disabled} accessibilityState={{ disabled }} onPress={onRemove} hitSlop={0} style={({ pressed }) => ({ position: "absolute", top: 10, right: 10, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: T.raised, borderWidth: 1.5, borderColor: T.border, opacity: pressed ? 0.7 : 1 })}><Ionicons name="close" size={20} color={T.dark} /></Pressable>
  </View>;
}

function AddPhotoCard({ onPress, disabled, accentColor }: { onPress: () => void; disabled: boolean; accentColor: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Add a photo to this post" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ width: 126, height: 168, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 9, borderWidth: 2, borderStyle: "dashed", borderColor: `${accentColor}8e`, backgroundColor: `${accentColor}0d`, opacity: disabled ? 0.45 : pressed ? 0.72 : 1 })}>
    <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: `${accentColor}18` }}><Ionicons name="add" size={25} color={accentColor} /></View><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 13, textAlign: "center" }}>Add photo</Text>
  </Pressable>;
}

function QuestToggle({ value, label, disabled, accentColor, onChange }: { value: boolean; label: string; disabled: boolean; accentColor: string; onChange: () => void }) {
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={onChange} hitSlop={6} style={({ pressed }) => ({ width: 56, height: 44, padding: 8, borderRadius: 22, justifyContent: "center", alignItems: value ? "flex-end" : "flex-start", backgroundColor: value ? accentColor : T.toggleOff, borderWidth: 1.5, borderColor: value ? accentColor : T.border, opacity: disabled ? 0.45 : pressed ? 0.72 : 1, transform: [{ translateY: pressed ? 1 : 0 }] })}>
    <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: T.white, boxShadow: "0px 1px 2px rgba(61,52,56,0.22)" }}><Ionicons name={value ? "checkmark" : "close"} size={14} color={value ? accentColor : T.muted} /></View>
  </Pressable>;
}

export function ShareAdventureScreen() {
  const router = useRouter();
  const layout = useResponsiveScreenLayout(760);
  const viewport = useAppViewport();
  const postLock = useRef(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [edited, setEdited] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [focused, setFocused] = useState(false);
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
    setLoading(true); setError(null);
    fetchJournalMemory(completionId).then(async (nextMemory) => {
      if (!nextMemory) throw new Error("This quest memory is no longer available.");
      const urls = await resolveJournalMedia(nextMemory.photoPaths);
      if (!current) return;
      setMemory(nextMemory);
      if (urls.length) setPhotos(urls.slice(0, MAX_POST_PHOTOS).map((uri, index) => ({ id: `quest-${index}-${uri}`, uri, source: "quest" })));
    }).catch((nextError) => { if (current) setError(nextError instanceof Error ? nextError.message : "We couldn't load your quest photos."); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [completionId, handoffPhotos, loadAttempt]);

  const close = () => {
    if (postLock.current) return;
    const leave = () => router.canGoBack() ? router.back() : router.replace("/(tabs)/journal");
    if (!edited) { leave(); return; }
    Alert.alert("Discard this post?", "Your quest is saved in your Journal. Changes to this post will be discarded.", [
      { text: "Keep writing", style: "cancel" },
      { text: "Discard post", style: "destructive", onPress: leave },
    ]);
  };

  const addPhoto = async () => {
    if (posting || pickingPhoto || loading || photos.length >= MAX_POST_PHOTOS) return;
    setPickingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.82 });
      if (result.canceled || !result.assets[0]) return;
      setEdited(true);
      setPhotos((current) => current.length >= MAX_POST_PHOTOS ? current : [...current, { id: `device-${Date.now()}`, uri: result.assets[0].uri, source: "device" }]);
    } catch { setError("We couldn't open that photo. Check photo access and try again. Your draft is still here."); }
    finally { setPickingPhoto(false); }
  };

  const post = async () => {
    if (!completionId || !(memory?.questId ?? questId) || postLock.current || loading || pickingPhoto || !memory) return;
    postLock.current = true;
    setPosting(true); setError(null);
    try {
      const photoUrls = await Promise.all(photos.map((photo) => isPublicQuestPhoto(photo.uri) ? photo.uri : uploadQuestPhoto(photo.uri)));
      const createdPost = await createQuestPost({ questId: memory.questId ?? questId!, completionId, title: questTitle, caption: review.trim(), photoUrls, visibility, commentsEnabled, stats: { rating: Number(rating) || 0 } });
      showFeedback({ message: "Your quest experience is live.", icon: "checkmark-circle", color: accentColor });
      router.replace({ pathname: "/(tabs)/social", params: { postId: createdPost.id, scope: visibility === "public" ? "public" : "friends" } });
    } catch (nextError) { setError(postErrorMessage(nextError)); } finally { postLock.current = false; setPosting(false); }
  };

  const disabled = posting || loading || pickingPhoto || !memory;
  const labelStyle = { color: T.dark, fontFamily: "RubikBold", fontSize: 14 } as const;
  const supportingStyle = { color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 18 } as const;
  const wide = viewport.width >= 680;

  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <View style={{ width: "100%", maxWidth: layout.contentWidth, alignSelf: "center", paddingTop: insets.top + 10, paddingHorizontal: layout.horizontalPadding, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ opacity: posting ? 0.45 : 1 }}><IconButton icon="close" label="Close post composer" onPress={close} color={accentColor} size={44} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Post quest experience" accessibilityState={{ disabled, busy: posting }} disabled={disabled} onPress={() => void post()} style={({ pressed }) => ({ minHeight: 46, minWidth: 100, paddingHorizontal: 20, borderRadius: 23, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: accentColor, borderBottomWidth: 3, borderBottomColor: `${accentColor}99`, opacity: disabled ? 0.5 : pressed ? 0.78 : 1 })}>
        {posting ? <ActivityIndicator size="small" color={T.dark} /> : <Ionicons name="arrow-up" size={17} color={T.dark} />}<Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15 }}>{posting ? "Posting…" : "Post"}</Text>
      </Pressable>
    </View>
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ width: "100%", maxWidth: layout.contentWidth, alignSelf: "center", paddingHorizontal: layout.horizontalPadding, paddingBottom: insets.bottom + 32, gap: 24 }}>
      <View style={{ gap: 12, paddingTop: 8 }}>
        <Text selectable style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: wide ? 32 : 27, lineHeight: wide ? 39 : 34 }}>{questTitle}</Text>
        {memory ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}><Text style={{ ...supportingStyle, textTransform: "capitalize" }}>{memory.category.toLowerCase()}</Text><Text style={supportingStyle}>·</Text><Text style={supportingStyle}>{memory.timeMin} min quest</Text><Text style={supportingStyle}>·</Text><Text style={{ ...supportingStyle, fontFamily: "RubikBold" }}>+{memory.xp} XP earned</Text></View> : null}
      </View>

      <View style={{ backgroundColor: T.white, borderRadius: 16, borderWidth: 1.5, borderColor: focused ? T.focus : T.border, padding: 18, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons name="create-outline" size={18} color={T.dark} /><Text style={labelStyle}>The story behind the quest</Text></View>
        <TextInput accessibilityLabel="Your quest story" value={review} onChangeText={(value) => { setReview(value.slice(0, 1_000)); setEdited(true); }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} editable={!posting} multiline textAlignVertical="top" maxLength={1_000} placeholder="What will you remember about this one?" placeholderTextColor={T.muted} style={{ minHeight: wide ? 170 : 136, padding: 0, color: T.dark, fontFamily: "Rubik", fontSize: 17, lineHeight: 26 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}><Text style={{ ...supportingStyle, flex: 1 }}>A little moment. A good discovery. Your words.</Text><Text style={{ ...supportingStyle, fontVariant: ["tabular-nums"] }}>{review.length}/1000</Text></View>
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={labelStyle}>Moments from your quest</Text><Text style={supportingStyle}>{photos.length} / {MAX_POST_PHOTOS} photos</Text></View>
        {loading ? <View accessibilityRole="progressbar" accessibilityLabel="Loading quest photos" style={{ height: 168, borderRadius: 16, backgroundColor: T.borderSubtle, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={T.dark} /></View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>{photos.map((photo, index) => <ComposerPhotoCard key={photo.id} photo={photo} index={index} accentColor={accentColor} disabled={posting} onRemove={() => { setEdited(true); setPhotos((current) => current.filter((item) => item.id !== photo.id)); }} />)}{photos.length < MAX_POST_PHOTOS ? <AddPhotoCard onPress={() => void addPhoto()} disabled={posting || pickingPhoto} accentColor={accentColor} /> : null}</ScrollView>}
      </View>

      <View style={{ borderTopWidth: 1, borderColor: T.border, paddingTop: 20, gap: 18 }}>
        <View style={{ gap: 10 }}><Text style={labelStyle}>Share with</Text><View accessibilityRole="radiogroup" accessibilityLabel="Post audience" style={{ flexDirection: "row", gap: 10 }}>{audienceOptions.map((option) => {
          const selected = visibility === option.value;
          return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: posting }} accessibilityLabel={option.label} disabled={posting} onPress={() => { setVisibility(option.value); setEdited(true); }} style={({ pressed }) => ({ flex: 1, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: selected ? accentColor : T.border, backgroundColor: selected ? `${accentColor}12` : T.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: posting ? 0.5 : pressed ? 0.7 : 1 })}><Ionicons name={option.icon} size={18} color={T.dark} /><Text style={labelStyle}>{option.label}</Text>{selected ? <Ionicons name="checkmark-circle" size={17} color={accentColor} /> : null}</Pressable>;
        })}</View></View>
        <View style={{ minHeight: 76, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 20, borderWidth: 2, borderColor: T.border, borderBottomWidth: 4, borderBottomColor: T.borderStrong, backgroundColor: T.white, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: `${accentColor}16` }}><Ionicons name="chatbubble-ellipses-outline" size={20} color={accentColor} /></View>
          <View style={{ flex: 1, gap: 3 }}><Text style={labelStyle}>Allow comments</Text><Text style={supportingStyle}>Let people respond to this quest.</Text></View>
          <QuestToggle label="Allow comments" value={commentsEnabled} disabled={posting} accentColor={accentColor} onChange={() => { setCommentsEnabled((current) => !current); setEdited(true); }} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 7 }}><Ionicons name={visibility === "public" ? "earth-outline" : "people-outline"} size={15} color={T.muted} /><Text style={{ ...supportingStyle, flex: 1 }}>{visibility === "public" ? "Everyone can see this post." : "Only your friends can see this post."} Your original memory stays in your Journal.</Text></View>
      </View>
      {error ? <View accessibilityRole="alert" style={{ padding: 14, borderRadius: 14, backgroundColor: T.white, borderWidth: 1.5, borderColor: T.red, gap: 10 }}><View style={{ flexDirection: "row", gap: 8 }}><Ionicons name="alert-circle" size={18} color={T.dark} /><Text selectable style={{ ...supportingStyle, color: T.dark, flex: 1 }}>{error}</Text></View>{!memory && completionId ? <Pressable accessibilityRole="button" accessibilityLabel="Retry loading quest" disabled={loading} onPress={() => setLoadAttempt((value) => value + 1)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={labelStyle}>Try again</Text></Pressable> : null}</View> : null}
    </ScrollView>
  </View>;
}
