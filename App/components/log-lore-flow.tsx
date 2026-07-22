import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { T } from "@/components/theme";
import { Sheet, SoftButton } from "@/components/ui";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { engineErrorMessage, uploadQuestPhoto } from "@/services/engine/questEngineService";
import { uploadJournalMedia } from "@/services/journal/journalService";
import { createQuestPost } from "@/services/profile/profileService";
import { Quest } from "@/types/content";
import { CompletionResult } from "@/types/engine";

type ComposerTab = "choice" | "post" | "journal";

const POST_DESCRIPTION_PROMPTS = ["💭 What surprised you?", "😂 What made you laugh?", "📸 Describe your favorite moment…", "🌅 How did this place make you feel?", "🤝 Who did you do this with?", "⭐ Would you recommend this quest?", "🍕 Did you discover anything unexpected?", "✨ What would you tell someone trying this?"];
let composerHasRating = false;
let composerShowsDuration = true;
let quickSaveJournal: (() => void) | null = null;

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ComposerTabs({ active, onChange }: { active: Exclude<ComposerTab, "choice">; onChange: (tab: Exclude<ComposerTab, "choice">) => void }) {
  return <View style={{ flexDirection: "row", gap: 6, padding: 5, borderRadius: 18, borderWidth: 1, borderColor: T.border, backgroundColor: "#f7f3ee" }}>{(["post", "journal"] as const).map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: active === tab }} onPress={() => onChange(tab)} style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: active === tab ? T.white : "transparent", borderWidth: active === tab ? 1 : 0, borderColor: active === tab ? `${T.blue}45` : "transparent", transform: [{ scale: pressed ? 0.98 : 1 }] })}><Text style={{ color: active === tab ? T.blue : T.muted, fontSize: 13, fontWeight: "900" }}>{tab === "post" ? "Post" : "Journal"}</Text></Pressable>)}</View>;
}

function RatingStar({ rating, value, onPress }: { rating: number; value: number; onPress: () => void }) {
  const scale = useSharedValue(1);
  const fill = useSharedValue(rating <= value ? 1 : 0);
  const sparkle = useSharedValue(0);
  const filled = rating <= value;
  useEffect(() => { fill.value = withDelay(filled ? (rating - 1) * 48 : 0, withTiming(filled ? 1 : 0, { duration: 160 })); }, [fill, filled, rating]);
  const starStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ translateX: -15.5 * (1 - fill.value) }, { scaleX: fill.value }] }));
  const sparkleStyle = useAnimatedStyle(() => ({ opacity: sparkle.value, transform: [{ translateY: -6 * sparkle.value }, { scale: 0.55 + sparkle.value * 0.45 }] }));
  const handlePress = () => { scale.value = withSequence(withTiming(1.16, { duration: 90 }), withSpring(1, { damping: 13, stiffness: 260 })); sparkle.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 240 })); onPress(); };
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === rating }} accessibilityLabel={`${value} star${value === 1 ? "" : "s"}`} onPress={handlePress} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Animated.View style={[{ width: 31, height: 31, alignItems: "center", justifyContent: "center" }, starStyle]}><Ionicons name="star-outline" size={31} color={T.muted} style={{ position: "absolute" }} /><Animated.View pointerEvents="none" style={[{ position: "absolute", width: 31, height: 31 }, fillStyle]}><Ionicons name="star" size={31} color={T.orange} /></Animated.View><Animated.View pointerEvents="none" style={[{ position: "absolute", top: -12, right: -14 }, sparkleStyle]}><Ionicons name="sparkles" size={16} color={T.yellow} /></Animated.View></Animated.View></Pressable>;
}

function RatingPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  composerHasRating = value > 0;
  return <View accessibilityRole="radiogroup" style={{ alignItems: "center", gap: 5 }}><Text style={{ color: T.dark, fontSize: 14, fontWeight: "900" }}>How was your adventure?</Text><View style={{ flexDirection: "row", gap: 6 }}>{[1, 2, 3, 4, 5].map((rating) => <RatingStar key={rating} rating={rating} value={value} onPress={() => onChange(rating)} />)}</View><Text style={{ color: T.muted, fontSize: 11, fontWeight: "700" }}>{value ? `${value} of 5 stars` : "Tap a star to rate your experience"}</Text></View>;
}

function ImageSlot({ uri, onRemove, onAdd }: { uri?: string; onRemove?: () => void; onAdd?: () => void }) {
  return <View style={{ flex: 1, minWidth: 0, aspectRatio: 1, borderRadius: 15, overflow: "hidden", borderWidth: 1.5, borderColor: uri ? "rgba(255,255,255,0.78)" : `${T.blue}88`, backgroundColor: uri ? "rgba(255,255,255,0.2)" : `${T.blue}10` }}>{uri ? <><Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /><Pressable accessibilityLabel="Remove photo" onPress={onRemove} style={{ position: "absolute", top: 5, left: 5, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={19} color={T.dark} /></Pressable></> : <Pressable accessibilityLabel="Add photo from library" onPress={onAdd} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={29} color={T.blue} /></Pressable>}</View>;
}

function DurationDetail({ seconds }: { seconds: number }) {
  const [visible, setVisible] = useState(composerShowsDuration);
  const toggleVisibility = () => { const next = !visible; composerShowsDuration = next; setVisible(next); };
  return <View style={{ minHeight: 62, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: visible ? `${T.green}38` : T.border, backgroundColor: visible ? `${T.green}0e` : T.bg, flexDirection: "row", alignItems: "center", gap: 11, opacity: visible ? 1 : 0.68 }}><View style={{ width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: visible ? `${T.green}19` : "rgba(0,0,0,0.05)" }}><Ionicons name="time-outline" size={20} color={visible ? T.green : T.muted} /></View><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 15, fontWeight: "900" }}>Quest duration</Text><Text style={{ color: T.muted, marginTop: 1, fontSize: 11, fontWeight: "700" }}>{visible ? "Shown on your post" : "Private — hidden from your post"}</Text></View><Text style={{ color: visible ? T.green : T.muted, fontSize: 19, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{formatDuration(seconds)}</Text><Pressable accessibilityRole="switch" accessibilityState={{ checked: visible }} accessibilityLabel={visible ? "Hide quest duration from post" : "Show quest duration on post"} onPress={toggleVisibility} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: visible ? `${T.green}19` : "rgba(0,0,0,0.05)", opacity: pressed ? 0.72 : 1 })}><Ionicons name={visible ? "eye" : "eye-off"} size={19} color={visible ? T.green : T.muted} /></Pressable></View>;
}

function PublishButton({ label, icon, color, disabled, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; disabled: boolean; onPress: () => void }) {
  const ratingRequired = !composerHasRating;
  const unavailable = disabled || ratingRequired;
  const lowerEdge = color === T.blue ? "#258fd8" : "#7973c7";
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 58, minWidth: 0, paddingHorizontal: 12, borderRadius: 22, backgroundColor: unavailable ? "#ddd8d2" : color, borderBottomWidth: 6, borderBottomColor: unavailable ? "#c8c1b9" : lowerEdge, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, opacity: unavailable ? 0.76 : 1, transform: [{ translateY: pressed && !unavailable ? 3 : 0 }] })}><Ionicons name={icon} size={19} color={unavailable ? "#9c9592" : T.white} /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1, color: unavailable ? "#9c9592" : T.white, fontSize: 16, fontWeight: "900" }}>{label}</Text></Pressable>;
}

function MemoryPathOption({ title, detail, icon, color, emphasized = false, onPress }: { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; color: string; emphasized?: boolean; onPress: () => void }) {
  const lowerEdge = color === T.green ? "#20894d" : color === T.blue ? "#258fd8" : "#e6ddd2";
  const handlePress = title === "Just save to Journal" && quickSaveJournal ? quickSaveJournal : onPress;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={handlePress} style={({ pressed }) => ({ minHeight: 82, padding: 13, borderRadius: 20, borderWidth: 2, borderColor: emphasized ? `${color}50` : T.border, borderBottomWidth: 5, borderBottomColor: emphasized ? lowerEdge : "#e6ddd2", backgroundColor: emphasized ? `${color}10` : T.white, flexDirection: "row", alignItems: "center", gap: 12, transform: [{ translateY: pressed ? 3 : 0 }] })}><View style={{ width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: `${color}1a` }}><Ionicons name={icon} size={23} color={color} /></View><View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text style={{ color: T.dark, fontSize: 16, lineHeight: 21, fontWeight: "900" }}>{title}</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>{detail}</Text></View><Ionicons name="chevron-forward" size={20} color={emphasized ? color : T.muted} /></Pressable>;
}

function postPublishErrorMessage(error: unknown) { return `Your quest is saved, but we couldn't publish the post. ${engineErrorMessage(error)}`; }

export function LogLoreFlow({ visible, quest, onClose, onFinished, initialTitle, initialReflection = "", photoUris = [], durationSeconds = 0, onSaveDraft }: { visible: boolean; quest: Quest | null; onClose: () => void; onFinished: (result: CompletionResult) => void | Promise<void>; initialTitle?: string; initialReflection?: string; photoUris?: string[]; durationSeconds?: number; distanceMeters?: number; onSaveDraft?: (draft: { title: string; body: string }) => Promise<void> }) {
  const { completeQuest } = useQuestEngine();
  const { refreshNotifications } = useNotifications();
  const { refresh: refreshStreaks } = useStreaks();
  const [tab, setTab] = useState<ComposerTab>("choice");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalBody, setJournalBody] = useState("");
  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postRetryReady, setPostRetryReady] = useState(false);
  const [descriptionPromptIndex, setDescriptionPromptIndex] = useState(0);
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const initializedForOpen = useRef(false);
  const completedQuest = useRef<CompletionResult | null>(null);

  useEffect(() => { if (!visible) { initializedForOpen.current = false; completedQuest.current = null; return; } if (initializedForOpen.current) return; initializedForOpen.current = true; composerShowsDuration = true; setTab("choice"); setJournalTitle(initialTitle?.trim() || quest?.title || ""); setJournalBody(initialReflection); setCaption(""); setPhotos(photoUris.slice(0, 4)); setRating(0); setPostRetryReady(false); setError(null); setDescriptionPromptIndex(0); setDescriptionFocused(false); }, [initialReflection, initialTitle, photoUris, quest?.title, visible]);
  useEffect(() => { if (!visible || tab !== "post" || caption.trim() || descriptionFocused) return; const timer = setInterval(() => setDescriptionPromptIndex((index) => (index + 1) % POST_DESCRIPTION_PROMPTS.length), 2_300); return () => clearInterval(timer); }, [caption, descriptionFocused, tab, visible]);
  const bodyForCompletion = useMemo(() => { const title = journalTitle.trim(); const body = journalBody.trim(); return title && title !== quest?.title ? `${title}\n\n${body}`.trim() : body; }, [journalBody, journalTitle, quest?.title]);
  if (!quest) return null;
  const requestReturnToQuest = () => { if (!busy) Alert.alert("Continue your quest?", "Your notes and photos are still here. You can return to finish logging whenever you’re ready.", [{ text: "Keep logging", style: "cancel" }, { text: "Continue quest", onPress: onClose }]); };
  const addPhoto = async () => { if (photos.length >= 4) return; const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 }); if (!result.canceled && result.assets[0]) setPhotos((current) => [...current, result.assets[0].uri].slice(0, 4)); };
  const save = async (visibility: "private" | "public" | "friends") => {
    if (busy) return;
    if (!rating && visibility !== "private") { setError("A star rating is required to finish this quest."); return; }
    setBusy(true); setError(null);
    let completion = completedQuest.current;
    if (!completion) try { await onSaveDraft?.({ title: journalTitle, body: journalBody }); const journalPhotoUris = Array.from(new Set([...photoUris, ...photos])); const journalPhotoPaths = await Promise.all(journalPhotoUris.map((uri) => uploadJournalMedia(uri))); completion = await completeQuest({ questId: quest.id, logged: true, reflection: bodyForCompletion || null, rating, review: null, reviewPublic: false, photoUrls: journalPhotoPaths }); completedQuest.current = completion; } catch (nextError) { setError(engineErrorMessage(nextError)); setBusy(false); return; }
    try { if (visibility !== "private") { const uploaded = await Promise.all(photos.map((uri) => uploadQuestPhoto(uri))); await createQuestPost({ questId: quest.id, completionId: completion.completionId, title: quest.title, caption, photoUrls: uploaded, visibility, durationSeconds, stats: { rating, ...(composerShowsDuration ? { durationSeconds } : {}) } }); } } catch (nextError) { setError(postPublishErrorMessage(nextError)); setPostRetryReady(true); setBusy(false); return; }
    try { await Promise.allSettled([refreshNotifications(), refreshStreaks()]); await onFinished(completion); } catch { setError("Your quest was completed, but we couldn't open your Journal. Please reopen it from the tab bar."); } finally { setBusy(false); }
  };
  quickSaveJournal = () => { void save("private"); };
  return <Sheet visible={visible} onClose={requestReturnToQuest} maxHeight={tab === "choice" ? "76%" : "88%"} fillHeight={tab !== "choice"}>{tab === "choice" ? <View style={{ paddingHorizontal: 24, paddingBottom: 26, gap: 12 }}><View style={{ alignItems: "center", gap: 7, paddingTop: 2, paddingBottom: 5 }}><View style={{ width: 62, height: 62, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: `${T.green}18`, borderWidth: 2, borderColor: `${T.green}42`, borderBottomWidth: 5, borderBottomColor: `${T.green}72` }}><Ionicons name="checkmark" size={32} color={T.green} /></View><Text style={{ color: T.dark, fontSize: 26, lineHeight: 31, fontWeight: "900" }}>Quest complete!</Text><Text style={{ color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" }}>Choose how you’d like to remember it.</Text></View><MemoryPathOption title="Share a post" detail="Share selected photos and a caption with Friends or Everyone. Your Journal entry stays private." icon="paper-plane-outline" color={T.blue} emphasized onPress={() => setTab("post")} /><MemoryPathOption title="Just save to Journal" detail="Save your quest, photos, and reflection to your Journal. Only you can see it." icon="book-outline" color={T.green} onPress={() => setTab("journal")} /></View> : <View style={{ flex: 1 }}><View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 13 }}><ComposerTabs active={tab} onChange={setTab} /><RatingPicker value={rating} onChange={(nextRating) => { setRating(nextRating); setError(null); }} /></View>{tab === "journal" ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 18, gap: 12 }}><View style={{ gap: 4 }}><Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Personal journal</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>Only you can see anything written here.</Text></View><View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Title</Text><TextInput value={journalTitle} onChangeText={setJournalTitle} placeholder="A title for this memory" placeholderTextColor={T.muted} style={{ minHeight: 52, borderWidth: 2, borderColor: T.border, borderRadius: 16, paddingHorizontal: 13, color: T.dark, fontWeight: "800", backgroundColor: T.bg }} /></View><View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Journal entry</Text><TextInput value={journalBody} onChangeText={setJournalBody} multiline textAlignVertical="top" placeholder="What do you want to remember?" placeholderTextColor={T.muted} style={{ minHeight: 190, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 13, color: T.dark, lineHeight: 21, fontWeight: "700", backgroundColor: T.bg }} /></View></ScrollView> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 18, gap: 14 }}><View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Quest title</Text><View style={{ minHeight: 54, paddingHorizontal: 13, borderWidth: 2, borderColor: T.border, borderRadius: 16, backgroundColor: T.bg, justifyContent: "center" }}><Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>{quest.title}</Text></View></View><View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Description</Text><View style={{ position: "relative" }}><TextInput value={caption} onChangeText={setCaption} onFocus={() => setDescriptionFocused(true)} onBlur={() => setDescriptionFocused(false)} multiline textAlignVertical="top" style={{ minHeight: 84, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 13, color: T.dark, lineHeight: 20, fontWeight: "700", backgroundColor: "rgba(255,255,255,0.58)" }} />{!caption.trim() && !descriptionFocused ? <Animated.View key={descriptionPromptIndex} pointerEvents="none" entering={FadeInUp.duration(220).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })} exiting={FadeOutUp.duration(180)} style={{ position: "absolute", top: 13, left: 13, right: 13 }}><Text style={{ color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "700" }}>{POST_DESCRIPTION_PROMPTS[descriptionPromptIndex]}</Text></Animated.View> : null}</View></View><View style={{ gap: 8 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Add your favorite moments</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>{photos.length}/4</Text></View><View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>{[0, 1, 2, 3].map((index) => <ImageSlot key={index} uri={photos[index]} onRemove={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} onAdd={photos.length < 4 ? () => void addPhoto() : undefined} />)}</View></View><DurationDetail seconds={durationSeconds} /></ScrollView>}<View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 10, borderTopWidth: 1, borderTopColor: "rgba(228,220,211,0.9)", backgroundColor: "rgba(255,255,255,0.45)" }}><Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "700", textAlign: "center" }}>Your Journal entry stays private—only you can see it. Edit it anytime in the Journal tab.</Text>{error ? <Text accessibilityRole="alert" style={{ color: T.red, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" }}>{error}</Text> : null}{tab === "journal" ? null : <View style={{ flexDirection: "row", gap: 12, marginTop: 2 }}><PublishButton label={postRetryReady ? "Retry Public" : "Post to Public"} icon="earth" color={T.blue} disabled={busy} onPress={() => void save("public")} /><PublishButton label={postRetryReady ? "Retry Friends" : "Friends only"} icon="people" color={T.purple} disabled={busy} onPress={() => void save("friends")} /></View>}</View></View>}</Sheet>;
}
