import { PropsWithChildren, createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "expo-router";

import { PartyCategoryIcon } from "@/components/party-category-icon";
import { QuestSaveSheet } from "@/components/quest-save-sheet";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { useContent } from "@/contexts/ContentContext";

type QuestSaveContextValue = {
  openQuestSave: (questId: string) => Promise<void>;
};

const QuestSaveContext = createContext<QuestSaveContextValue>({
  openQuestSave: async () => undefined,
});

export function QuestSaveProvider({ children }: PropsWithChildren) {
  const { getQuest, toggleSave } = useContent();
  const router = useRouter();
  const { showFeedback } = useAppFeedback();
  const [questId, setQuestId] = useState<string | null>(null);

  const openQuestSave = useCallback(async (id: string) => {
    const quest = getQuest(id);
    if (!quest) return;
    setQuestId(id);
  }, [getQuest]);

  const selectedQuest = getQuest(questId ?? undefined);
  const value = useMemo(() => ({ openQuestSave }), [openQuestSave]);

  return (
    <QuestSaveContext.Provider value={value}>
      {children}
      <QuestSaveSheet
        quest={selectedQuest}
        visible={Boolean(questId && selectedQuest)}
        onClose={() => setQuestId(null)}
        onSaveSelections={(quest, destinations, changed) => showFeedback({
          color: quest.color,
          iconElement: <PartyCategoryIcon category={quest.category} size={23} color={quest.color} />,
          actionLabel: "View",
          onAction: () => router.push("/saved"),
          message: destinations.length
            ? changed
              ? `This quest was saved to ${formatDestinations(destinations)}.`
              : `This quest is already saved to ${formatDestinations(destinations)}.`
            : changed
              ? "This quest was removed from My Stuff."
              : "This quest was not saved.",
        })}
        onToggleSaved={toggleSave}
      />
    </QuestSaveContext.Provider>
  );
}

function formatDestinations(destinations: string[]) {
  if (destinations.length < 2) return destinations[0] ?? "My Stuff";
  if (destinations.length === 2) return `${destinations[0]} and ${destinations[1]}`;
  return `${destinations.slice(0, -1).join(", ")}, and ${destinations.at(-1)}`;
}

export function useQuestSave() {
  return useContext(QuestSaveContext);
}
