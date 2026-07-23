import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { PartyCategoryIcon } from "@/components/party-category-icon";
import { T } from "@/components/theme";
import { Sheet } from "@/components/ui";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { uploadCollectionCover } from "@/services/engine/questEngineService";
import { Quest } from "@/types/content";
import { UserPack } from "@/types/engine";

type QuestSaveSheetProps = {
  quest: Quest | null;
  visible: boolean;
  onClose: () => void;
  onSaveSelections: (quest: Quest, destinations: string[], changed: boolean) => void;
  onToggleSaved: (questId: string) => Promise<boolean>;
};

function BookmarkBurst() {
  return (
    <View accessible={false} style={{ width: 88, height: 80, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", top: 5, left: 19, width: 10, height: 3, borderRadius: 3, backgroundColor: T.yellow, transform: [{ rotate: "35deg" }] }} />
      <View style={{ position: "absolute", top: 3, right: 17, width: 10, height: 3, borderRadius: 3, backgroundColor: T.pink, transform: [{ rotate: "-35deg" }] }} />
      <View style={{ position: "absolute", top: 28, left: 6, width: 11, height: 3, borderRadius: 3, backgroundColor: T.orange }} />
      <View style={{ position: "absolute", top: 28, right: 6, width: 11, height: 3, borderRadius: 3, backgroundColor: T.purple }} />
      <View style={{ position: "absolute", bottom: 11, left: 13, width: 10, height: 3, borderRadius: 3, backgroundColor: T.pink, transform: [{ rotate: "-35deg" }] }} />
      <View style={{ position: "absolute", bottom: 11, right: 13, width: 10, height: 3, borderRadius: 3, backgroundColor: T.purple, transform: [{ rotate: "35deg" }] }} />
      <Ionicons name="bookmark-outline" size={55} color={T.dark} />
    </View>
  );
}

function RaisedCollectionButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start a new quest collection"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 54,
        borderRadius: 18,
        backgroundColor: T.blue,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        boxShadow: pressed ? "0px 2px 0px #2588D8" : "0px 6px 0px #2588D8",
        transform: [{ translateY: pressed ? 4 : 0 }],
      })}
    >
      <Ionicons name="add" size={20} color={T.white} />
      <Text style={{ color: T.white, fontFamily: "RubikBold", fontSize: 15, letterSpacing: 0.5 }}>START A COLLECTION</Text>
    </Pressable>
  );
}

function CollectionThumbnail({ pack }: { pack: UserPack }) {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 14, overflow: "hidden", backgroundColor: `${pack.accentColor}18`, alignItems: "center", justifyContent: "center" }}>
      {pack.coverImageUrl ? (
        <Image source={{ uri: pack.coverImageUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : (
        <View style={{ width: 31, height: 31, borderRadius: 11, backgroundColor: T.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: `${pack.accentColor}22` }}>
          <Ionicons name="bookmarks" size={17} color={pack.accentColor} />
        </View>
      )}
    </View>
  );
}

export function QuestSaveSheet({ quest, visible, onClose, onSaveSelections, onToggleSaved }: QuestSaveSheetProps) {
  const { saveUserPack, userPacks } = useQuestEngine();
  const [mode, setMode] = useState<"collections" | "create">("collections");
  const [collectionName, setCollectionName] = useState("");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [privateSaved, setPrivateSaved] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingState, setSavingState] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const initializedQuestId = useRef<string | null>(null);

  useEffect(() => {
    if (!visible || !quest) {
      initializedQuestId.current = null;
      return;
    }
    if (initializedQuestId.current === quest.id) return;
    initializedQuestId.current = quest.id;
    setMode("collections");
    setCollectionName("");
    setSelectedCollectionIds(userPacks.filter((pack) => pack.questIds.includes(quest.id)).map((pack) => pack.id));
    // Opening the sheet expresses intent to save. Persist only when the user
    // confirms with Save, so dismissing the sheet never creates a hidden save.
    setPrivateSaved(true);
    setCreating(false);
    setSavingState(false);
    setCoverUri(null);
    setError(null);
    setInputFocused(false);
  }, [quest, userPacks, visible]);

  const collections = useMemo(() => userPacks.filter((pack) => pack.title.trim()), [userPacks]);

  if (!quest) return null;

  const isSavedByCollection = selectedCollectionIds.length > 0;
  const isSavedToMyStuff = privateSaved || isSavedByCollection;

  const toggleCollection = (packId: string) => {
    setSelectedCollectionIds((current) => current.includes(packId) ? current.filter((id) => id !== packId) : [...current, packId]);
  };

  const createCollection = async () => {
    const title = collectionName.trim();
    if (!title || creating) return;
    if (collections.some((pack) => pack.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase())) {
      setError("A collection with this name already exists.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      if (!quest.saved && !(await onToggleSaved(quest.id))) {
        throw new Error("Unable to save this quest to My Stuff.");
      }
      const coverImageUrl = coverUri ? await uploadCollectionCover(coverUri) : null;
      await saveUserPack({
        title,
        description: "Private quest collection",
        icon: "🧭",
        accentColor: T.blue,
        coverImageUrl,
        questIds: [quest.id],
      });
      onSaveSelections(quest, ["My Stuff", title], true);
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create the collection.");
    } finally {
      setCreating(false);
    }
  };

  const saveSelections = async () => {
    if (savingState) return;
    setSavingState(true);
    setError(null);
    try {
      const initialCollectionIds = collections.filter((pack) => pack.questIds.includes(quest.id)).map((pack) => pack.id);
      const membershipsChanged = collections.some((pack) => initialCollectionIds.includes(pack.id) !== selectedCollectionIds.includes(pack.id));
      const selectedCollections = collections.filter((pack) => selectedCollectionIds.includes(pack.id));
      const savedToMyStuff = privateSaved || selectedCollections.length > 0;
      const changed = savedToMyStuff !== quest.saved || membershipsChanged;
      const destinations = [
        ...(savedToMyStuff ? ["My Stuff"] : []),
        ...selectedCollections.map((pack) => pack.title),
      ];

      if (!changed) {
        onSaveSelections(quest, destinations, false);
        onClose();
        return;
      }

      if (savedToMyStuff !== quest.saved && !(await onToggleSaved(quest.id))) {
        throw new Error(savedToMyStuff ? "Unable to save this quest to My Stuff." : "Unable to remove this quest from My Stuff.");
      }

      await Promise.all(collections.map((pack) => {
        const wasIncluded = pack.questIds.includes(quest.id);
        const shouldInclude = selectedCollectionIds.includes(pack.id);
        if (wasIncluded === shouldInclude) return Promise.resolve();
        return saveUserPack({
          id: pack.id,
          title: pack.title,
          description: pack.description,
          icon: pack.icon,
          accentColor: pack.accentColor,
          coverImageUrl: pack.coverImageUrl,
          questIds: shouldInclude ? [...pack.questIds, quest.id] : pack.questIds.filter((id) => id !== quest.id),
        });
      }));

      onSaveSelections(quest, destinations, true);
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save these quest selections.");
    } finally {
      setSavingState(false);
    }
  };

  const chooseCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.78,
    });
    if (!result.canceled && result.assets[0]) setCoverUri(result.assets[0].uri);
  };

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="84%">
      {mode === "collections" ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28 }}>Save quest</Text>
              <Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18 }} numberOfLines={1}>{quest.title}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: savingState }} disabled={savingState} onPress={saveSelections} hitSlop={8}>
              <Text style={{ color: savingState ? T.border : T.blue, fontFamily: "RubikBold", fontSize: 15 }}>{savingState ? "Saving…" : "Save"}</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 18, backgroundColor: T.bg }}>
            <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: `${quest.color}18`, alignItems: "center", justifyContent: "center" }}>
              <PartyCategoryIcon category={quest.category} size={24} color={quest.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 16 }}>Saved Quests</Text>
              <Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12, marginTop: 2 }}>Private · available in My Stuff</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSavedToMyStuff ? "Saved to My Stuff" : "Save to My Stuff"}
              accessibilityHint={isSavedByCollection ? "Quests in a collection remain saved to My Stuff." : "This does not change collection memberships"}
              accessibilityState={{ checked: isSavedToMyStuff, disabled: isSavedByCollection }}
              disabled={isSavedByCollection}
              onPress={() => setPrivateSaved((saved) => !saved)}
              hitSlop={8}
              style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", opacity: isSavedByCollection ? 1 : pressed ? 0.64 : 1 })}
            >
              <Ionicons name={isSavedToMyStuff ? "bookmark" : "bookmark-outline"} size={22} color={isSavedToMyStuff ? T.blue : T.muted} />
            </Pressable>
          </View>

          {collections.length ? <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 16 }}>Add to a collection</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Create a new collection" onPress={() => setMode("create")} hitSlop={6}>
                <Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 13 }}>New collection</Text>
              </Pressable>
            </View>

            {collections.map((pack) => {
              const included = selectedCollectionIds.includes(pack.id);
              return (
                <Pressable
                  key={pack.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: included }}
                  onPress={() => toggleCollection(pack.id)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    minHeight: 66,
                    padding: 10,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: included ? `${T.blue}55` : "transparent",
                    backgroundColor: included ? `${T.blue}12` : T.bg,
                    opacity: pressed ? 0.76 : 1,
                  })}
                >
                  <CollectionThumbnail pack={pack} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 15 }}>{pack.title}</Text>
                    <Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12, marginTop: 2 }}>{pack.questIds.length} {pack.questIds.length === 1 ? "quest" : "quests"}</Text>
                  </View>
                  <Ionicons name={included ? "checkmark-circle" : "add-circle-outline"} size={24} color={included ? T.blue : T.muted} />
                </Pressable>
              );
            })}
          </View> : (
            <View style={{ alignItems: "center", paddingTop: 4, gap: 13 }}>
              <BookmarkBurst />
              <View style={{ alignSelf: "stretch", gap: 7 }}>
                <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 27 }}>Collect the quests you want to try</Text>
                <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 14, lineHeight: 20 }}>Save quests into private collections for future adventures, goals, and ideas.</Text>
              </View>
              <View style={{ alignSelf: "stretch", marginTop: 4 }}>
                <RaisedCollectionButton onPress={() => setMode("create")} />
              </View>
            </View>
          )}

          {error ? <Text accessibilityRole="alert" style={{ color: T.red, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18 }}>{error}</Text> : null}
        </ScrollView>
      ) : (
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 22 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable accessibilityRole="button" onPress={() => { setError(null); setMode("collections"); }} hitSlop={6}>
            <Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15 }}>Cancel</Text>
          </Pressable>
          <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 18 }}>New collection</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !collectionName.trim() || creating }} disabled={!collectionName.trim() || creating} onPress={createCollection} hitSlop={6}>
              <Text style={{ color: collectionName.trim() ? T.blue : T.border, fontFamily: "RubikBold", fontSize: 15 }}>{creating ? "Saving…" : "Save"}</Text>
            </Pressable>
          </View>

          <View style={{ alignItems: "center", gap: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={coverUri ? "Change collection cover photo" : "Add collection cover photo"} onPress={chooseCover} style={({ pressed }) => ({ width: 92, height: 92, borderRadius: 26, overflow: "hidden", backgroundColor: `${quest.color}18`, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: `${quest.color}35`, opacity: pressed ? 0.8 : 1 })}>
              {coverUri ? <Image source={{ uri: coverUri }} style={{ width: "100%", height: "100%" }} /> : <PartyCategoryIcon category={quest.category} size={42} color={quest.color} />}
              <View style={{ position: "absolute", right: 5, bottom: 5, width: 26, height: 26, borderRadius: 13, backgroundColor: T.blue, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: T.white }}><Ionicons name="camera" size={13} color={T.white} /></View>
            </Pressable>
            <Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12 }} numberOfLines={1}>Adding “{quest.title}”</Text>
            <Pressable accessibilityRole="button" onPress={chooseCover} hitSlop={7}><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 13 }}>{coverUri ? "Change cover photo" : "Add an optional cover photo"}</Text></Pressable>
          </View>

          <View style={{ minHeight: 58, flexDirection: "row", alignItems: "center", borderRadius: 18, borderWidth: inputFocused ? 3 : 2, borderColor: inputFocused ? T.blue : T.border, backgroundColor: inputFocused ? `${T.blue}0d` : T.white, paddingLeft: 16, paddingRight: 8 }}>
            <TextInput
              autoFocus
              value={collectionName}
              onChangeText={setCollectionName}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Collection name"
              placeholderTextColor={T.muted}
              accessibilityLabel="Collection name"
              maxLength={50}
              returnKeyType="done"
              onSubmitEditing={createCollection}
              style={{ flex: 1, minHeight: 54, color: T.dark, fontFamily: "Rubik", fontSize: 16, paddingVertical: 0 }}
            />
            {collectionName ? <Pressable accessibilityRole="button" accessibilityLabel="Clear collection name" onPress={() => setCollectionName("")} hitSlop={8} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close-circle" size={21} color={T.dark} />
            </Pressable> : null}
          </View>
          <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 18 }}>Collections are private. This quest will remain in Saved Quests too.</Text>
          {error ? <Text accessibilityRole="alert" style={{ color: T.red, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18 }}>{error}</Text> : null}
        </View>
      )}
    </Sheet>
  );
}
