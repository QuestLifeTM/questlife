import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Modal, Pressable, Text, View } from "react-native";

import { QuestSaveSheet } from "@/components/quest-save-sheet";
import { PartyCategoryIcon } from "@/components/party-category-icon";
import { T } from "@/components/theme";
import { useContent } from "@/contexts/ContentContext";
import { Quest } from "@/types/content";

type QuestSaveContextValue = {
  openQuestSave: (questId: string) => Promise<void>;
};

const QuestSaveContext = createContext<QuestSaveContextValue>({
  openQuestSave: async () => undefined,
});

export function QuestSaveProvider({ children }: PropsWithChildren) {
  const { getQuest, toggleSave } = useContent();
  const router = useRouter();
  const [questId, setQuestId] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<{ message: string; quest: Quest } | null>(null);

  const openQuestSave = useCallback(async (id: string) => {
    const quest = getQuest(id);
    if (!quest) return;

    if (!quest.saved) {
      await toggleSave(id);
    }
    setQuestId(id);
  }, [getQuest, toggleSave]);

  const selectedQuest = getQuest(questId ?? undefined);
  const value = useMemo(() => ({ openQuestSave }), [openQuestSave]);

  useEffect(() => {
    if (!savedNotice) return;
    const timer = setTimeout(() => setSavedNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [savedNotice]);

  return (
    <QuestSaveContext.Provider value={value}>
      {children}
      <QuestSaveSheet
        quest={selectedQuest}
        visible={Boolean(questId && selectedQuest)}
        onClose={() => setQuestId(null)}
        onCollectionCreated={(collectionName, quest) => setSavedNotice({ quest, message: `This quest was saved to ${collectionName}.` })}
        onSaveSelections={(quest, destinations, changed) => setSavedNotice({
          quest,
          message: !changed
            ? "No changes were made."
            : destinations.length
              ? `This quest was saved to ${destinations.join(", ")}.`
              : "This quest was removed from your saved lists.",
        })}
        onToggleSaved={toggleSave}
      />
      <Modal transparent visible={Boolean(savedNotice)} animationType="fade" onRequestClose={() => setSavedNotice(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", paddingHorizontal: 14, paddingBottom: 24 }} pointerEvents="box-none">
          {savedNotice ? <View style={{ minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 18, backgroundColor: "rgba(61,52,56,0.9)", paddingHorizontal: 10, paddingVertical: 9, boxShadow: "0px 4px 12px rgba(61,52,56,0.22)" }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: `${savedNotice.quest.color}2a`, alignItems: "center", justifyContent: "center" }}>
              <PartyCategoryIcon category={savedNotice.quest.category} size={23} color={savedNotice.quest.color} />
            </View>
            <Text style={{ flex: 1, color: T.white, fontFamily: "Rubik", fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{savedNotice.message}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="View saved quests and collections" onPress={() => { setSavedNotice(null); router.push("/saved"); }} hitSlop={8}>
              <Text style={{ color: T.white, fontFamily: "RubikBold", fontSize: 14 }}>View</Text>
            </Pressable>
          </View> : null}
        </View>
      </Modal>
    </QuestSaveContext.Provider>
  );
}

export function useQuestSave() {
  return useContext(QuestSaveContext);
}
