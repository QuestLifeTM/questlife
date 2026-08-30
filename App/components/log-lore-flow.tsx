import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { T } from "@/components/theme";
import { haptic, Sheet, SoftButton } from "@/components/ui";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { engineErrorMessage, uploadQuestPhoto } from "@/services/engine/questEngineService";
import { uploadJournalMedia } from "@/services/journal/journalService";
import { createQuestPost } from "@/services/profile/profileService";
import { Quest } from "@/types/content";
import { CompletionResult } from "@/types/engine";

export type CompletionDestination = "feed" | "journal";

const DESCRIPTION_PROMPTS = [
  "What made this quest memorable?",
  "Share a small highlight from your adventure…",
  "What would you tell a friend about this quest?"
];

function RatingStar({ rating, value, onPress }: { rating: number; value: number; onPress: () => void }) {
  const scale = useSharedValue(1);
  const fill = useSharedValue(value >= rating ? 1 : 0);
  const sparkle = useSharedValue(0);
  const selected = value >= rating;

  useEffect(() => {
    fill.value = withDelay(selected ? (rating - 1) * 48 : 0, withTiming(selected ? 1 : 0, { duration: 160 }));
  }, [fill, rating, selected]);

  const starStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ translateX: -15.5 * (1 - fill.value) }, { scaleX: fill.value }] }));
  const sparkleStyle = useAnimatedStyle(() => ({ opacity: sparkle.value, transform: [{ translateY: -6 * sparkle.value }, { scale: 0.55 + sparkle.value * 0.45 }] }));

  const handlePress = () => {
    haptic();
    scale.value = withSequence(withTiming(1.16, { duration: 90 }), withSpring(1, { damping: 13, stiffness: 260 }));
    sparkle.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 240 }));
    onPress();
  };

  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === rating }} accessibilityLabel={`${rating} star${rating === 1 ? "" : "s"}`} onPress={handlePress} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center" }}><Animated.View style={[{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }, starStyle]}><Ionicons name="star-outline" size={32} color={T.muted} style={{ position: "absolute" }} /><Animated.View pointerEvents="none" style={[{ position: "absolute", width: 32, height: 32 }, fillStyle]}><Ionicons name="star" size={32} color={T.orange} /></Animated.View><Animated.View pointerEvents="none" style={[{ position: "absolute", top: -12, right: -14 }, sparkleStyle]}><Ionicons name="sparkles" size={16} color={T.yellow} /></Animated.View></Animated.View></Pressable>;
}

function RatingPicker({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  return <View accessibilityRole="radiogroup" style={{ alignItems: "center", gap: 6 }}><Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>Rate your adventure</Text><View style={{ flexDirection: "row", gap: 5 }}>{[1, 2, 3, 4, 5].map((rating) => <RatingStar key={rating} rating={rating} value={value} onPress={() => onChange(rating)} />)}</View><Text style={{ color: value ? T.orange : T.muted, fontSize: 12, fontWeight: "800" }}>{value ? `${value} of 5 stars` : "Required to save your quest"}</Text></View>;
}

function ImageSlot({ uri, onRemove, onAdd }: { uri?: string; onRemove?: () => void; onAdd?: () => void }) {
  return <View style={{ flex: 1, minWidth: 0, aspectRatio: 1, borderRadius: 15, overflow: "hidden", borderWidth: 1.5, borderColor: uri ? "rgba(255,255,255,0.8)" : `${T.blue}88`, backgroundColor: uri ? "rgba(255,255,255,0.2)" : `${T.blue}10` }}>{uri ? <><Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /><Pressable accessibilityLabel="Remove selected photo" onPress={onRemove} style={{ position: "absolute", top: 5, left: 5, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={19} color={T.dark} /></Pressable></> : <Pressable accessibilityLabel="Add photo from library" onPress={onAdd} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={29} color={T.blue} /></Pressable>}</View>;
}

function postPublishErrorMessage(error: unknown) { return `Your quest is saved, but we couldn't publish the post. ${engineErrorMessage(error)}`; }

export function LogLoreFlow({ guestMode = false, visible, quest, onClose, onFinished, initialTitle, initialReflection = "", photoUris = [], onSaveDraft }: { guestMode?: boolean; visible: boolean; quest: Quest | null; onClose: () => void; onFinished: (result: CompletionResult, destination: CompletionDestination) => void | Promise<void>; initialTitle?: string; initialReflection?: string; photoUris?: string[]; onSaveDraft?: (draft: { title: string; body: string }) => Promise<void> }) {
  const { completeQuest } = useQuestEngine();
  const { refreshNotifications } = useNotifications();
  const { refresh: refreshStreaks } = useStreaks();
  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const initializedForOpen = useRef(false);
  const completedQuest = useRef<CompletionResult | null>(null);

  useEffect(() => {
    if (!visible) { initializedForOpen.current = false; completedQuest.current = null; return; }
    if (initializedForOpen.current) return;
    initializedForOpen.current = true;
    setCaption(""); setPhotos(photoUris.slice(0, 4)); setRating(0); setBusy(false); setError(null); setPromptIndex(0); setDescriptionFocused(false);
  }, [photoUris, visible]);
  useEffect(() => {
    if (!visible || caption.trim() || descriptionFocused) return;
    const timer = setInterval(() => setPromptIndex((current) => (current + 1) % DESCRIPTION_PROMPTS.length), 2_600);
    return () => clearInterval(timer);
  }, [caption, descriptionFocused, visible]);
  if (!quest) return null;

  const requestReturnToQuest = () => {
    if (busy) return;
    Alert.alert("Keep exploring?", "Your quest is still active. You can finish saving it whenever you’re ready.", [{ text: "Keep saving", style: "cancel" }, { text: "Return to quest", onPress: onClose }]);
  };
  const addPhoto = async () => {
    if (photos.length >= 4) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhotos((current) => [...current, result.assets[0].uri].slice(0, 4));
  };
  const save = async (visibility: "private" | "public" | "friends") => {
    if (busy) return;
    if (!rating) { setError("Choose a star rating to save your completed quest."); return; }
    setBusy(true); setError(null);
    let completion = completedQuest.current;
    if (!completion) try {
      await onSaveDraft?.({ title: initialTitle?.trim() || quest.title, body: initialReflection });
      if (guestMode) completion = { completionId: `guest-${Date.now()}`, xpAwarded: 0, dailyUsed: 0, dailyLimit: 5 };
      else {
        const journalPhotoUris = Array.from(new Set([...photoUris, ...photos]));
        const journalPhotoPaths = await Promise.all(journalPhotoUris.map((uri) => uploadJournalMedia(uri)));
        completion = await completeQuest({ questId: quest.id, logged: true, reflection: initialReflection.trim() || null, rating, review: null, reviewPublic: false, photoUrls: journalPhotoPaths });
      }
      completedQuest.current = completion;
    } catch (nextError) { setError(engineErrorMessage(nextError)); setBusy(false); return; }
    try {
      if (!guestMode && visibility !== "private") {
        const uploadedPhotos = await Promise.all(photos.map((uri) => uploadQuestPhoto(uri)));
        await createQuestPost({ questId: quest.id, completionId: completion.completionId, title: quest.title, caption: caption.trim(), photoUrls: uploadedPhotos, visibility, stats: { rating } });
      }
    } catch (nextError) { setError(postPublishErrorMessage(nextError)); setBusy(false); return; }
    try { if (!guestMode) await Promise.allSettled([refreshNotifications(), refreshStreaks()]); await onFinished(completion, visibility === "private" ? "journal" : "feed"); } catch { setError("Your quest was completed, but we couldn't open your saved memory. Please reopen it from the tab bar."); } finally { setBusy(false); }
  };
  const actionsDisabled = busy || !rating;

  return <Sheet visible={visible} onClose={requestReturnToQuest} maxHeight="94%" fillHeight glass><View style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 24, gap: 18 }}><Animated.View entering={FadeInUp.duration(300)} style={{ alignItems: "center", gap: 5 }}><View style={{ width: 54, height: 54, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: `${T.green}18`, borderWidth: 1.5, borderColor: `${T.green}42` }}><Ionicons name="checkmark" size={29} color={T.green} /></View><Text style={{ color: T.dark, fontSize: 25, fontWeight: "900" }}>One more moment</Text><Text style={{ color: T.muted, fontSize: 13, fontWeight: "700", textAlign: "center" }}>Save this adventure the way you want to remember it.</Text></Animated.View><Animated.View entering={FadeInUp.delay(50).duration(300)} style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Quest title</Text><View style={{ minHeight: 56, paddingHorizontal: 14, borderRadius: 17, justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(228,220,211,0.86)", backgroundColor: "rgba(255,255,255,0.54)" }}><Text style={{ color: T.dark, fontSize: 17, lineHeight: 22, fontWeight: "900" }}>{quest.title}</Text></View></Animated.View><Animated.View entering={FadeInUp.delay(100).duration(300)} style={{ gap: 6 }}><View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Description</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "800" }}>Optional</Text></View><View style={{ position: "relative" }}><TextInput value={caption} onChangeText={setCaption} onFocus={() => setDescriptionFocused(true)} onBlur={() => setDescriptionFocused(false)} multiline textAlignVertical="top" style={{ minHeight: 88, borderWidth: 1.5, borderColor: "rgba(228,220,211,0.9)", borderRadius: 17, padding: 14, color: T.dark, lineHeight: 20, fontWeight: "700", backgroundColor: "rgba(255,255,255,0.56)" }} />{!caption.trim() && !descriptionFocused ? <Animated.View key={promptIndex} pointerEvents="none" entering={FadeInUp.duration(180).withInitialValues({ opacity: 0, transform: [{ translateY: 7 }] })} style={{ position: "absolute", top: 14, left: 14, right: 14 }}><Text style={{ color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "700" }}>{DESCRIPTION_PROMPTS[promptIndex]}</Text></Animated.View> : null}</View></Animated.View><Animated.View entering={FadeInUp.delay(150).duration(300)} style={{ gap: 8 }}><View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Your favorite moments</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "800" }}>{photos.length}/4 · Optional</Text></View><View style={{ flexDirection: "row", gap: 8 }}>{[0, 1, 2, 3].map((index) => <ImageSlot key={index} uri={photos[index]} onRemove={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} onAdd={photos.length < 4 ? () => void addPhoto() : undefined} />)}</View></Animated.View><Animated.View entering={FadeInUp.delay(200).duration(300)} style={{ gap: 12, paddingTop: 4 }}><RatingPicker value={rating} onChange={(nextRating) => { setRating(nextRating); setError(null); }} /><View style={{ padding: 13, borderRadius: 16, flexDirection: "row", gap: 10, backgroundColor: "rgba(73,166,244,0.10)", borderWidth: 1, borderColor: "rgba(73,166,244,0.22)" }}><Ionicons name="lock-closed-outline" size={18} color={T.blue} /><Text style={{ flex: 1, color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>Only the photos you select are shared. Your notes and unselected photos stay private in your Journal.</Text></View></Animated.View></ScrollView><View style={{ paddingHorizontal: 24, paddingTop: 13, paddingBottom: 16, gap: 9, borderTopWidth: 1, borderTopColor: "rgba(228,220,211,0.82)", backgroundColor: "rgba(255,255,255,0.38)" }}>{error ? <Text accessibilityRole="alert" style={{ color: T.red, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" }}>{error}</Text> : null}{!rating ? <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800", textAlign: "center" }}>A star rating is required to unlock your save options.</Text> : null}<SoftButton label={busy ? "Saving..." : "Post to Public & save to Journal"} icon="earth" disabled={actionsDisabled} color={T.blue} onPress={() => void save("public")} /><SoftButton label={busy ? "Saving..." : "Post to Friends & save to Journal"} icon="people" disabled={actionsDisabled} color={T.purple} onPress={() => void save("friends")} /><SoftButton label={busy ? "Saving..." : "Just save to Journal"} icon="book" disabled={actionsDisabled} color={T.green} onPress={() => void save("private")} /></View></View></Sheet>;
}
