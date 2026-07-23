import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { categoryColor, T } from "@/components/theme";
import { Card, EmptyState, IconButton, Screen, Sheet, useResponsiveScreenLayout } from "@/components/ui";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { uploadCollectionCover } from "@/services/engine/questEngineService";
import { Quest } from "@/types/content";
import { UserPack } from "@/types/engine";

function Cover({ pack, height = 112 }: { pack: UserPack; height?: number }) {
  return <View style={{ height, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden", backgroundColor: `${pack.accentColor}16`, alignItems: "center", justifyContent: "center" }}>
    {pack.coverImageUrl ? <Image source={{ uri: pack.coverImageUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: T.white, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: T.border }}><Ionicons name="bookmarks" size={24} color={pack.accentColor} /></View>}
  </View>;
}

function CollectionCard({ pack, quests, width, onOpen }: { pack: UserPack; quests: Quest[]; width: number; onOpen: () => void }) {
  const visibleQuests = quests.slice(0, 3);
  return <Card style={{ width, padding: 0, overflow: "hidden", gap: 0 }}>
    <Cover pack={pack} />
    <View style={{ padding: 12, gap: 8 }}>
      <Text numberOfLines={1} style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 15 }}>{pack.title}</Text>
      <View style={{ minHeight: 55, gap: 5 }}>{visibleQuests.length ? visibleQuests.map((quest) => <View key={quest.id} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Ionicons name="ellipse" size={8} color={categoryColor[quest.category]?.text ?? quest.color} /><Text numberOfLines={1} style={{ flex: 1, color: T.muted, fontFamily: "Rubik", fontSize: 11 }}>{quest.title}</Text></View>) : <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 11 }}>No quests yet</Text>}{quests.length > 3 ? <Text style={{ color: pack.accentColor, fontFamily: "RubikBold", fontSize: 11 }}>+{quests.length - 3} more</Text> : null}</View>
      <View style={{ paddingTop: 9, borderTopWidth: 1, borderTopColor: T.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 11 }}>{quests.length} {quests.length === 1 ? "quest" : "quests"}</Text><Pressable onPress={onOpen} hitSlop={6}><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 11 }}>View all</Text></Pressable></View>
    </View>
  </Card>;
}

function SavedQuestPicker({ quest, selected, onPress }: { quest: Quest; selected: boolean; onPress: () => void }) {
  const color = categoryColor[quest.category]?.text ?? quest.color;
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, borderWidth: 2, borderColor: selected ? T.blue : T.border, backgroundColor: selected ? `${T.blue}0d` : T.white, opacity: pressed ? 0.7 : 1 })}><View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: `${color}18`, alignItems: "center", justifyContent: "center" }}><Ionicons name="flag" size={18} color={color} /></View><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 14 }}>{quest.title}</Text><Text style={{ color, fontFamily: "RubikBold", fontSize: 10, marginTop: 2 }}>{quest.category}</Text></View><Ionicons name={selected ? "checkmark-circle" : "add-circle-outline"} size={24} color={selected ? T.blue : T.muted} /></Pressable>;
}

export function QuestCollectionsScreen({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { contentWidth, horizontalPadding } = useResponsiveScreenLayout();
  const { quests } = useContent();
  const { userPacks, saveUserPack } = useQuestEngine();
  const { showFeedback } = useAppFeedback();
  const [stage, setStage] = useState<"closed" | "details" | "pick">("closed");
  const [name, setName] = useState("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `Screen` applies this same horizontal gutter. Size cards from the usable
  // content area, not the viewport, so two cards always occupy one row.
  const cardWidth = (contentWidth - horizontalPadding * 2 - 12) / 2;
  const availableQuests = useMemo(() => quests.filter((quest) => quest.saved), [quests]);

  const reset = () => { setStage("closed"); setName(""); setCoverUri(null); setSelectedQuestIds([]); setError(null); };
  const chooseCover = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.78 }); if (!result.canceled && result.assets[0]) setCoverUri(result.assets[0].uri); };
  const createCollection = async () => {
    const title = name.trim();
    if (!title || saving) return;
    if (userPacks.some((pack) => pack.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase())) { setError("A collection with this name already exists."); return; }
    setSaving(true); setError(null);
    try {
      const coverImageUrl = coverUri ? await uploadCollectionCover(coverUri) : null;
      await saveUserPack({ title, description: "Private quest collection", icon: "🧭", accentColor: T.blue, coverImageUrl, questIds: selectedQuestIds });
      reset();
      showFeedback({
        message: coverImageUrl ? `“${title}” was created with its cover photo.` : `“${title}” was created.`,
        icon: "bookmarks",
        color: T.blue,
      });
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to create this collection."); } finally { setSaving(false); }
  };

  return <Screen>
    <View style={{ minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><IconButton icon="chevron-back" onPress={onBack} /><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 22 }}>Quest Collections</Text><IconButton icon="add" color={T.white} bg={T.blue} onPress={() => setStage("details")} /></View>
    {userPacks.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{userPacks.map((pack) => <CollectionCard key={pack.id} pack={pack} quests={pack.questIds.map((id) => quests.find((quest) => quest.id === id)).filter(Boolean) as Quest[]} width={cardWidth} onOpen={() => router.push(`/collection/${pack.id}`)} />)}</View> : <EmptyState emoji="🗂️" title="Your collections live here" body="Create a collection to organize saved quests for a future adventure." />}
    <Sheet visible={stage === "details"} onClose={reset} maxHeight="80%"><View style={{ paddingHorizontal: 24, paddingBottom: 26, gap: 18 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Pressable onPress={reset}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15 }}>Cancel</Text></Pressable><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 18 }}>New collection</Text><Pressable disabled={!name.trim()} onPress={() => setStage("pick")}><Text style={{ color: name.trim() ? T.blue : T.border, fontFamily: "RubikBold", fontSize: 15 }}>Next</Text></Pressable></View><Pressable onPress={chooseCover} style={{ alignSelf: "center", width: 106, height: 106, borderRadius: 25, overflow: "hidden", backgroundColor: `${T.blue}16`, alignItems: "center", justifyContent: "center", borderWidth: 2, borderStyle: coverUri ? "solid" : "dashed", borderColor: T.border }}>{coverUri ? <Image source={{ uri: coverUri }} style={{ width: "100%", height: "100%" }} /> : <><Ionicons name="camera-outline" size={28} color={T.blue} /><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 11, marginTop: 4 }}>Add photo</Text></>}<View style={{ position: "absolute", right: 5, bottom: 5, width: 26, height: 26, borderRadius: 13, backgroundColor: T.blue, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={15} color={T.white} /></View></Pressable><TextInput autoFocus value={name} onChangeText={setName} placeholder="Collection name" placeholderTextColor={T.muted} style={{ minHeight: 58, borderRadius: 18, borderWidth: 2, borderColor: T.border, paddingHorizontal: 16, color: T.dark, fontFamily: "Rubik", fontSize: 16 }} /><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 17 }}>Private collection · you can add a cover photo now or later.</Text></View></Sheet>
    <Sheet visible={stage === "pick"} onClose={reset} maxHeight="90%" fillHeight><View style={{ flex: 1 }}><View style={{ paddingHorizontal: 22, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Pressable onPress={() => setStage("details")}><Ionicons name="chevron-back" size={25} color={T.dark} /></Pressable><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 18 }}>Add from Saved</Text><Pressable onPress={createCollection} disabled={saving}><Text style={{ color: saving ? T.border : T.blue, fontFamily: "RubikBold", fontSize: 15 }}>{saving ? "Saving…" : "Save"}</Text></Pressable></View><ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 10 }}>{availableQuests.length ? availableQuests.map((quest) => <SavedQuestPicker key={quest.id} quest={quest} selected={selectedQuestIds.includes(quest.id)} onPress={() => setSelectedQuestIds((ids) => ids.includes(quest.id) ? ids.filter((id) => id !== quest.id) : [...ids, quest.id])} />) : <EmptyState emoji="📭" title="No saved quests yet" body="Save a quest from Explore first, then add it to one or more collections." />}{error ? <Text style={{ color: T.red, fontFamily: "RubikBold", fontSize: 13 }}>{error}</Text> : null}</ScrollView></View></Sheet>
  </Screen>;
}
