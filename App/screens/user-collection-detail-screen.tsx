import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { categoryColor, T } from "@/components/theme";
import { Card, EmptyState, IconButton, Screen, Sheet } from "@/components/ui";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { uploadCollectionCover } from "@/services/engine/questEngineService";
import { Quest } from "@/types/content";

export function UserCollectionDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const { quests } = useContent();
  const { userPacks, saveUserPack, removeUserPack } = useQuestEngine();
  const { showFeedback } = useAppFeedback();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const pack = userPacks.find((item) => item.id === id);
  const packQuests = useMemo(() => pack ? pack.questIds.map((questId) => quests.find((quest) => quest.id === questId)).filter(Boolean) as Quest[] : [], [pack, quests]);
  const candidates = useMemo(() => pack ? quests.filter((quest) => quest.saved && !pack.questIds.includes(quest.id)) : [], [pack, quests]);
  const addSelected = async () => {
    if (!pack || !selectedIds.length) return;
    const count = selectedIds.length;
    await saveUserPack({ id: pack.id, title: pack.title, description: pack.description, icon: pack.icon, accentColor: pack.accentColor, coverImageUrl: pack.coverImageUrl, isPinned: pack.isPinned, questIds: [...new Set([...pack.questIds, ...selectedIds])] });
    setSelectedIds([]);
    setPickerOpen(false);
    showFeedback({ message: `${count} ${count === 1 ? "quest was" : "quests were"} added to “${pack.title}”.`, icon: "add-circle", color: pack.accentColor });
  };
  const startEdit = () => { setTitle(pack?.title ?? ""); setCoverUri(null); setRemoveCover(false); setEditOpen(true); };
  const chooseCover = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.78 }); if (!result.canceled && result.assets[0]) { setCoverUri(result.assets[0].uri); setRemoveCover(false); } };
  const saveEdit = async () => {
    if (!pack || !title.trim()) return;
    const nextTitle = title.trim();
    const titleChanged = nextTitle !== pack.title;
    const coverChanged = removeCover ? Boolean(pack.coverImageUrl) : Boolean(coverUri);
    const coverImageUrl = removeCover ? null : coverUri ? await uploadCollectionCover(coverUri) : pack.coverImageUrl;
    await saveUserPack({ id: pack.id, title: nextTitle, description: pack.description, icon: pack.icon, accentColor: pack.accentColor, coverImageUrl, isPinned: pack.isPinned, questIds: pack.questIds });
    setEditOpen(false);
    showFeedback({
      message: titleChanged && coverChanged
        ? removeCover ? "Collection renamed and cover photo removed." : "Collection renamed and cover photo updated."
        : titleChanged ? "Collection renamed."
          : coverChanged ? removeCover ? "Collection cover photo removed." : "Collection cover photo updated."
            : "Collection updated.",
      icon: "bookmarks",
      color: pack.accentColor,
    });
  };
  const deleteCollection = () => {
    if (!pack) return;
    const currentPack = pack;
    Alert.alert("Delete collection?", `“${currentPack.title}” will be deleted. The quests will remain saved.`, [{ text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { void removeUserPack(currentPack.id).then(() => { showFeedback({ message: `“${currentPack.title}” was deleted.`, icon: "trash", color: T.red }); onBack(); }).catch(() => Alert.alert("Couldn’t delete collection", "Please try again.")); } }]);
  };
  if (!pack) return <Screen><IconButton icon="chevron-back" onPress={onBack} /><EmptyState emoji="🗂️" title="Collection not found" body="It may have been deleted." /></Screen>;
  return <Screen>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><IconButton icon="chevron-back" onPress={onBack} /><View style={{ flexDirection: "row", gap: 8 }}><IconButton icon="ellipsis-horizontal" onPress={startEdit} /><Pressable onPress={() => setPickerOpen(true)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.blue, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={23} color={T.white} /></Pressable></View></View>
    <Card style={{ padding: 0, overflow: "hidden" }}><View style={{ height: 142, backgroundColor: `${pack.accentColor}18`, alignItems: "center", justifyContent: "center" }}>{pack.coverImageUrl ? <Image source={{ uri: pack.coverImageUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, alignItems: "center", justifyContent: "center" }}><Ionicons name="bookmarks" size={31} color={pack.accentColor} /></View>}</View><View style={{ padding: 18, gap: 5 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23 }}>{pack.title}</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Ionicons name="lock-closed" size={12} color={T.muted} /><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12 }}>Private · {packQuests.length} {packQuests.length === 1 ? "quest" : "quests"}</Text></View></View></Card>
    <View style={{ gap: 10 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 19 }}>Quests</Text>{packQuests.length ? packQuests.map((quest) => { const color = categoryColor[quest.category]?.text ?? quest.color; return <Link href={`/quest/${quest.id}`} key={quest.id} asChild><Pressable><Card style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 11 }}><View style={{ width: 6, alignSelf: "stretch", borderRadius: 99, backgroundColor: color }} /><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 14 }}>{quest.title}</Text><Text style={{ color, fontFamily: "RubikBold", fontSize: 10, marginTop: 3 }}>{quest.category} · {quest.timeLabel}</Text></View><Ionicons name="chevron-forward" size={17} color={T.muted} /></Card></Pressable></Link>; }) : <EmptyState emoji="✨" title="Start adding quests" body="Add saved quests to build this collection." />}</View>
    <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} maxHeight="86%" fillHeight><View style={{ flex: 1 }}><View style={{ paddingHorizontal: 22, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Pressable onPress={() => setPickerOpen(false)}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15 }}>Cancel</Text></Pressable><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 18 }}>Add from Saved</Text><Pressable onPress={addSelected}><Text style={{ color: selectedIds.length ? T.blue : T.border, fontFamily: "RubikBold", fontSize: 15 }}>Save</Text></Pressable></View><ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 9 }}>{candidates.length ? candidates.map((quest) => { const color = categoryColor[quest.category]?.text ?? quest.color; const selected = selectedIds.includes(quest.id); return <Pressable key={quest.id} onPress={() => setSelectedIds((ids) => selected ? ids.filter((item) => item !== quest.id) : [...ids, quest.id])} style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: T.border }}><View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: `${color}18`, alignItems: "center", justifyContent: "center" }}><Ionicons name="flag" size={18} color={color} /></View><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 14 }}>{quest.title}</Text><Text style={{ color, fontFamily: "RubikBold", fontSize: 10 }}>{quest.category}</Text></View><Ionicons name={selected ? "checkmark-circle" : "add-circle-outline"} size={24} color={selected ? T.blue : T.muted} /></Pressable>; }) : <EmptyState emoji="📭" title="No other saved quests" body="Save quests from Explore, then return here." />}</ScrollView></View></Sheet>
    <Sheet visible={editOpen} onClose={() => setEditOpen(false)} maxHeight="78%"><View style={{ paddingHorizontal: 24, paddingBottom: 26, gap: 16 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Pressable onPress={() => setEditOpen(false)}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15 }}>Cancel</Text></Pressable><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 18 }}>Edit collection</Text><Pressable onPress={saveEdit}><Text style={{ color: title.trim() ? T.blue : T.border, fontFamily: "RubikBold", fontSize: 15 }}>Save</Text></Pressable></View><Pressable onPress={chooseCover} style={{ alignSelf: "center", width: 96, height: 96, borderRadius: 23, backgroundColor: `${pack.accentColor}18`, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>{removeCover ? <Ionicons name="bookmarks" size={32} color={pack.accentColor} /> : coverUri || pack.coverImageUrl ? <Image source={{ uri: coverUri ?? pack.coverImageUrl ?? undefined }} style={{ width: "100%", height: "100%" }} /> : <Ionicons name="camera-outline" size={30} color={T.blue} />}</Pressable><View style={{ flexDirection: "row", justifyContent: "center", gap: 16 }}><Pressable onPress={chooseCover}><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 13 }}>Change photo</Text></Pressable>{coverUri || pack.coverImageUrl ? <Pressable onPress={() => { setCoverUri(null); setRemoveCover(true); }}><Text style={{ color: T.red, fontFamily: "RubikBold", fontSize: 13 }}>Remove photo</Text></Pressable> : null}</View><TextInput value={title} onChangeText={setTitle} placeholder="Collection name" placeholderTextColor={T.muted} style={{ minHeight: 58, borderRadius: 18, borderWidth: 2, borderColor: T.border, paddingHorizontal: 16, color: T.dark, fontFamily: "Rubik", fontSize: 16 }} /><Pressable onPress={deleteCollection} style={{ alignSelf: "center", padding: 8 }}><Text style={{ color: T.red, fontFamily: "RubikBold", fontSize: 13 }}>Delete collection</Text></Pressable></View></Sheet>
  </Screen>;
}
