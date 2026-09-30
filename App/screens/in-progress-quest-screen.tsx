import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { categoryColor, radius, T } from "@/components/theme";
import { IconButton, Screen } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { engineErrorMessage } from "@/services/engine/questEngineService";
import { uploadJournalMedia } from "@/services/journal/journalService";

const MAX_JOURNAL_PHOTOS = 4;

function tactileEdge(color: string) {
  const match = /^#([\da-f]{6})$/i.exec(color);
  if (!match) return `${color}a8`;
  const channels = [0, 2, 4].map((offset) => Math.round(parseInt(match[1].slice(offset, offset + 2), 16) * 0.72).toString(16).padStart(2, "0"));
  return `#${channels.join("")}`;
}

function ReflectionPhotoCard({ uri, index, accent, onRemove }: { uri: string; index: number; accent: string; onRemove: () => void }) {
  return <View style={{ width: 218, height: 218, borderRadius: radius.lg, overflow: "hidden", backgroundColor: T.border, borderWidth: 2, borderColor: `${accent}52` }}>
    <Image source={{ uri }} accessibilityLabel={`Selected quest photo ${index + 1}`} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
    <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} onPress={onRemove} hitSlop={7} style={({ pressed }) => ({ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: T.raised, borderWidth: 1.5, borderColor: T.border, opacity: pressed ? 0.7 : 1 })}><Ionicons name="close" size={20} color={T.dark} /></Pressable>
  </View>;
}

function AddReflectionPhotoCard({ accent, disabled, onPress }: { accent: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Add a photo to your journal" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ width: 138, height: 218, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: 9, borderWidth: 2, borderStyle: "dashed", borderColor: `${accent}8e`, backgroundColor: `${accent}0d`, opacity: disabled ? 0.45 : pressed ? 0.72 : 1 })}><View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: `${accent}18` }}><Ionicons name="add" size={25} color={accent} /></View><Text style={{ color: accent, fontFamily: "RubikBold", fontSize: 13, textAlign: "center" }}>Add photo</Text></Pressable>;
}

function QuestRatingStar({ rating, value, onPress, disabled }: { rating: number; value: number; onPress: () => void; disabled: boolean }) {
  const scale = useSharedValue(1);
  const fill = useSharedValue(0);
  const selected = value >= rating;
  useEffect(() => { fill.value = withTiming(selected ? 1 : 0, { duration: 170 }); }, [fill, selected]);
  const starStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ scale: 0.82 + fill.value * 0.18 }] }));
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === rating, disabled }} accessibilityLabel={`${rating} star${rating === 1 ? "" : "s"}`} disabled={disabled} onPress={() => { scale.value = withSequence(withTiming(1.18, { duration: 90 }), withSpring(1, { damping: 13, stiffness: 260 })); onPress(); }} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.78 : 1 })}><Animated.View style={[{ width: 31, height: 31, alignItems: "center", justifyContent: "center" }, starStyle]}><Ionicons name="star-outline" size={31} color={T.muted} style={{ position: "absolute" }} /><Animated.View pointerEvents="none" style={[{ position: "absolute" }, fillStyle]}><Ionicons name="star" size={31} color="#f6b90b" style={{ textShadowColor: "rgba(255, 191, 24, 0.9)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } }} /></Animated.View></Animated.View></Pressable>;
}

function QuestRating({ value, onChange, disabled }: { value: number; onChange: (next: number) => void; disabled: boolean }) {
  return <View accessibilityRole="radiogroup" style={{ alignSelf: "center", flexDirection: "row", gap: 4 }}>{[1, 2, 3, 4, 5].map((rating) => <QuestRatingStar key={rating} rating={rating} value={value} disabled={disabled} onPress={() => onChange(rating)} />)}</View>;
}

export function InProgressQuestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { engine, completeQuest, refresh } = useQuestEngine();
  const { getQuest } = useContent();
  const [completionQuest, setCompletionQuest] = useState<ReturnType<typeof getQuest>>(null);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [ratingError, setRatingError] = useState(false);
  const [savingDestination, setSavingDestination] = useState<"journal" | "share" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const session = engine?.inProgressSessions.find((item) => item.id === sessionId) ?? null;
  const quest = getQuest(session?.questId);
  const displayedQuest = quest ?? completionQuest;
  const accent = displayedQuest ? (categoryColor[displayedQuest.category]?.text ?? displayedQuest.color) : T.blue;
  const actionEdge = tactileEdge(accent);
  const addPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert("Photo access needed", "Allow photo access to add a moment to this quest."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.82 });
    if (!result.canceled && result.assets[0]?.uri) setPhotos((current) => [...current, result.assets[0].uri].slice(0, MAX_JOURNAL_PHOTOS));
  };
  const finish = async (destination: "journal" | "share") => {
    if (!quest || !session || savingDestination) return;
    if (!rating) { setRatingError(true); return; }
    setCompletionQuest(quest);
    setSavingDestination(destination);
    setSaveError(null);
    try {
      const uploads = await Promise.allSettled(photos.map((uri) => uploadJournalMedia(uri)));
      const photoUrls = uploads.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const completion = await completeQuest({ questId: quest.id, sessionId: session.id, logged: false, reflection: note.trim() || null, rating, review: null, reviewPublic: false, photoUrls });
      await refresh();
      if (destination === "share") {
        router.replace({ pathname: "/share-adventure", params: { completionId: completion.completionId, questId: quest.id, title: quest.title, rating: String(rating), sharePhotos: JSON.stringify(photos) } });
        return;
      }
      router.replace({ pathname: "/(tabs)/journal", params: { completionId: completion.completionId } });
    } catch (nextError) {
      setSaveError(engineErrorMessage(nextError));
      setSavingDestination(null);
    }
  };

  if (!displayedQuest || (!session && !savingDestination)) return <Screen><View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}><Ionicons name="sparkles-outline" size={38} color={T.muted} /><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 22 }}>Quest unavailable</Text><Pressable onPress={() => router.replace("/(tabs)")}><Text style={{ color: T.blue, fontFamily: "RubikBold" }}>Back to Home</Text></Pressable></View></Screen>;

  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 }}><IconButton icon="chevron-back" label="Back" onPress={() => router.back()} backAccent={accent} size={42} /><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28 }} numberOfLines={2}>Add to Journal</Text></View></View>
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, gap: 22 }}>
      <View style={{ gap: 9 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15 }}>Quest photos</Text><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12 }}>{photos.length}/{MAX_JOURNAL_PHOTOS}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>{photos.map((uri, index) => <ReflectionPhotoCard key={uri} uri={uri} index={index} accent={accent} onRemove={() => setPhotos((current) => current.filter((item) => item !== uri))} />)}{photos.length < MAX_JOURNAL_PHOTOS ? <AddReflectionPhotoCard accent={accent} disabled={false} onPress={() => void addPhoto()} /> : null}</ScrollView></View>
      <View style={{ gap: 10 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 26, lineHeight: 32 }} numberOfLines={3}>{displayedQuest.title}</Text><View style={{ gap: 8 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16 }}>Write your Reflection</Text><View style={{ position: "relative" }}><TextInput value={note} onChangeText={(value) => setNote(value.slice(0, 1_000))} editable={!savingDestination} multiline textAlignVertical="top" maxLength={1_000} placeholder="What made this quest memorable?" placeholderTextColor={T.muted} style={{ minHeight: 130, borderRadius: radius.md, borderWidth: 2, borderColor: T.border, borderBottomWidth: 4, borderBottomColor: T.isDark ? T.borderStrong : "#d9d0c6", paddingTop: 15, paddingHorizontal: 15, paddingBottom: 31, color: T.dark, fontFamily: "Rubik", fontSize: 15, lineHeight: 22, fontWeight: "600", backgroundColor: T.isDark ? T.input : T.white }} /><Text pointerEvents="none" style={{ position: "absolute", right: 13, bottom: 10, color: T.muted, fontFamily: "RubikBold", fontSize: 11 }}>{note.length}/1000</Text></View></View></View>
      <View style={{ gap: 7 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16 }}>Rate this quest</Text><QuestRating value={rating} disabled={Boolean(savingDestination)} onChange={(next) => { setRating(next); setRatingError(false); }} />{ratingError ? <Text accessibilityRole="alert" style={{ color: T.red, fontFamily: "RubikBold", fontSize: 12, lineHeight: 17 }}>Choose a star rating to continue.</Text> : null}</View>
    </ScrollView>
    <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), gap: 10, backgroundColor: T.bg }}>{saveError ? <Text accessibilityRole="alert" style={{ color: T.red, fontFamily: "RubikBold", fontSize: 12, lineHeight: 17, textAlign: "center" }}>{saveError}</Text> : null}<View style={{ flexDirection: "row", gap: 10 }}><Pressable accessibilityRole="button" accessibilityLabel="Finish and open Journal" disabled={Boolean(savingDestination)} onPress={() => void finish("journal")} style={({ pressed }) => ({ flex: 1, minHeight: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, backgroundColor: T.white, borderWidth: 2, borderColor: accent, borderBottomWidth: pressed ? 2 : 6, borderBottomColor: actionEdge, opacity: savingDestination ? 0.48 : pressed ? 0.78 : 1, transform: [{ translateY: pressed ? 3 : 0 }] })}><Ionicons name="checkmark" size={18} color={accent} /><Text style={{ color: accent, fontFamily: "RubikBold", fontSize: 16, lineHeight: 22 }}>{savingDestination === "journal" ? "Saving…" : "Done"}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Share your adventure" disabled={Boolean(savingDestination)} onPress={() => void finish("share")} style={({ pressed }) => ({ flex: 2, minHeight: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: accent, borderBottomWidth: 6, borderBottomColor: actionEdge, opacity: savingDestination ? 0.48 : pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}><Text style={{ color: T.onAccent, fontFamily: "RubikBold", fontWeight: "700", fontSize: 16, lineHeight: 22 }}>{savingDestination === "share" ? "Saving…" : "Share your adventure"}</Text><Ionicons name="arrow-forward" size={18} color={T.onAccent} /></Pressable></View></View>
  </View>;
}
