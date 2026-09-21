import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/components/theme";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { engineErrorMessage, uploadQuestPhoto } from "@/services/engine/questEngineService";
import { fetchJournalMemory, resolveJournalMedia } from "@/services/journal/journalService";
import { createQuestPost } from "@/services/profile/profileService";

type Visibility = "public" | "friends";

function VisibilityOption({ value, selected, icon, label, onPress }: { value: Visibility; selected: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: (value: Visibility) => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label} onPress={() => onPress(value)} style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: selected ? `${T.green}25` : T.white, borderWidth: 1.5, borderColor: selected ? `${T.green}70` : T.border, opacity: pressed ? 0.76 : 1 })}><Ionicons name={icon} size={19} color={selected ? T.green : T.dark} /><Text style={{ color: selected ? T.green : T.dark, fontFamily: "RubikBold", fontSize: 14, lineHeight: 18 }}>{label}</Text></Pressable>;
}

export function ShareAdventureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completionId, questId, title, rating } = useLocalSearchParams<{ completionId?: string; questId?: string; title?: string; rating?: string }>();
  const { showFeedback } = useAppFeedback();
  const [photos, setPhotos] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!completionId) { setError("This completed quest is no longer available to share."); setLoading(false); return; }
    let current = true;
    void (async () => {
      try {
        const memory = await fetchJournalMemory(completionId);
        if (!memory) throw new Error("This completed quest is no longer available to share.");
        const resolved = await resolveJournalMedia(memory.photoPaths);
        if (current) setPhotos(resolved.slice(0, 4));
      } catch (nextError) { if (current) setError(engineErrorMessage(nextError)); }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; };
  }, [completionId]);

  const addPhotos = async () => {
    if (photos.length >= 4) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 4 - photos.length, quality: 0.8 });
    if (!result.canceled) setPhotos((current) => [...current, ...result.assets.map((asset) => asset.uri)].slice(0, 4));
  };
  const post = async () => {
    if (!completionId || !questId || posting) return;
    setPosting(true); setError(null);
    try {
      const uploadedPhotos = await Promise.all(photos.map((uri) => uploadQuestPhoto(uri)));
      await createQuestPost({ questId, completionId, title: title ?? "Completed quest", caption: caption.trim(), photoUrls: uploadedPhotos, visibility, stats: { rating: Number(rating) || 0 } });
      showFeedback({ message: "Your adventure is live.", icon: "checkmark-circle", color: T.green });
      router.replace("/(tabs)/social");
    } catch (nextError) { setError(engineErrorMessage(nextError)); setPosting(false); }
  };

  return <View style={{ flex: 1, backgroundColor: T.bg }}><View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: T.white }}><Pressable accessibilityRole="button" accessibilityLabel="Close sharing" onPress={() => router.replace("/(tabs)/journal")} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, opacity: pressed ? 0.68 : 1 })}><Ionicons name="close" size={23} color={T.dark} /></Pressable><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 21, lineHeight: 27 }}>Share your adventure</Text><View style={{ width: 42 }} /></View><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 28, gap: 18 }}><Animated.View entering={FadeInUp.duration(250)} style={{ gap: 9 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16, lineHeight: 21 }}>{title ?? "Your completed quest"}</Text><Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>Choose up to four moments to share.</Text>{loading ? <View accessibilityRole="progressbar" style={{ height: 190, borderRadius: 20, backgroundColor: `${T.blue}12` }} /> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{photos.map((uri, index) => <View key={`${uri}-${index}`} style={{ width: "31.7%", aspectRatio: 1, borderRadius: 16, overflow: "hidden", backgroundColor: T.border }}><Image source={{ uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /><Pressable accessibilityRole="button" accessibilityLabel="Remove photo from post" onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} style={{ position: "absolute", top: 5, right: 5, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.94)" }}><Ionicons name="close" size={16} color={T.dark} /></Pressable></View>)}{photos.length < 4 ? <Pressable accessibilityRole="button" accessibilityLabel="Add photos to post" onPress={() => void addPhotos()} style={({ pressed }) => ({ width: "31.7%", aspectRatio: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: `${T.blue}10`, borderWidth: 1.5, borderStyle: "dashed", borderColor: `${T.blue}75`, opacity: pressed ? 0.7 : 1 })}><Ionicons name="add" size={27} color={T.blue} /><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 11 }}>Add photo</Text></Pressable> : null}</View>}</Animated.View><Animated.View entering={FadeInUp.delay(45).duration(250)} style={{ gap: 8 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16, lineHeight: 21 }}>Add a caption</Text><TextInput value={caption} onChangeText={(value) => setCaption(value.slice(0, 280))} multiline textAlignVertical="top" maxLength={280} placeholder="What made this quest memorable?" placeholderTextColor={T.muted} style={{ minHeight: 112, borderRadius: 18, borderWidth: 1.5, borderColor: T.border, padding: 14, color: T.dark, fontSize: 15, lineHeight: 21, fontWeight: "700", backgroundColor: T.white }} /><Text style={{ color: T.muted, alignSelf: "flex-end", fontSize: 11, lineHeight: 15, fontWeight: "800" }}>{caption.length}/280</Text></Animated.View><Animated.View entering={FadeInUp.delay(90).duration(250)} style={{ gap: 9 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16, lineHeight: 21 }}>Who can see this?</Text><View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 10 }}><VisibilityOption value="public" selected={visibility === "public"} icon="earth-outline" label="Everyone" onPress={setVisibility} /><VisibilityOption value="friends" selected={visibility === "friends"} icon="people-outline" label="Friends" onPress={setVisibility} /></View></Animated.View>{error ? <Text accessibilityRole="alert" style={{ color: T.red, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" }}>{error}</Text> : null}<Animated.View entering={FadeInUp.delay(135).duration(250)} style={{ gap: 8, paddingTop: 2 }}><Pressable accessibilityRole="button" accessibilityLabel="Post adventure" accessibilityState={{ disabled: posting || loading }} disabled={posting || loading} onPress={() => void post()} style={({ pressed }) => ({ minHeight: 58, borderRadius: 21, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: T.green, borderBottomWidth: 6, borderBottomColor: "#1d8750", opacity: posting || loading ? 0.45 : pressed ? 0.78 : 1, transform: [{ translateY: pressed ? 3 : 0 }] })}><Ionicons name="paper-plane-outline" size={20} color={T.white} /><Text style={{ color: T.white, fontFamily: "RubikBold", fontSize: 17, lineHeight: 22 }}>{posting ? "Posting..." : "Post"}</Text></Pressable><Text style={{ color: T.muted, fontSize: 11, lineHeight: 15, textAlign: "center", fontWeight: "700" }}>You can always change this later.</Text></Animated.View></ScrollView></View>;
}
