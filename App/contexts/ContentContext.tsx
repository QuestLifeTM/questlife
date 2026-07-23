import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  completeQuest as completeQuestInBackend,
  fetchContentLibrary,
  toggleSavedQuest,
} from "@/services/content/contentService";
import { AdventurePack, Quest } from "@/types/content";

type ContentContextValue = {
  adventurePacks: AdventurePack[];
  completeQuest: (questId: string, reflection?: string) => Promise<void>;
  error: string | null;
  getAdventurePack: (id?: string) => AdventurePack | null;
  getQuest: (id?: string) => Quest | null;
  loading: boolean;
  quests: Quest[];
  refresh: () => Promise<void>;
  toggleSave: (questId: string) => Promise<boolean>;
};

const ContentContext = createContext<ContentContextValue>({
  adventurePacks: [],
  completeQuest: async () => undefined,
  error: null,
  getAdventurePack: () => null,
  getQuest: () => null,
  loading: false,
  quests: [],
  refresh: async () => undefined,
  toggleSave: async () => false,
});

export function ContentProvider({ children }: PropsWithChildren) {
  const { isConfigured, session } = useAuth();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [adventurePacks, setAdventurePacks] = useState<AdventurePack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConfigured || !session) {
      setQuests([]);
      setAdventurePacks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const content = await fetchContentLibrary();
      setQuests(content.quests);
      setAdventurePacks(content.adventurePacks);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load QuestLife content.");
    } finally {
      setLoading(false);
    }
  }, [isConfigured, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getQuest = useCallback(
    (id?: string) => quests.find((quest) => quest.id === id) ?? null,
    [quests],
  );

  const getAdventurePack = useCallback(
    (id?: string) => adventurePacks.find((pack) => pack.id === id) ?? null,
    [adventurePacks],
  );

  const toggleSave = useCallback(
    async (questId: string) => {
      const quest = quests.find((item) => item.id === questId);
      if (!quest) return false;

      setQuests((prev) =>
        prev.map((item) => (item.id === questId ? { ...item, saved: !item.saved } : item)),
      );

      try {
        await toggleSavedQuest(questId, quest.saved);
        return true;
      } catch (nextError) {
        setQuests((prev) =>
          prev.map((item) => (item.id === questId ? { ...item, saved: quest.saved } : item)),
        );
        setError(nextError instanceof Error ? nextError.message : "Unable to update saved quest.");
        return false;
      }
    },
    [quests],
  );

  const completeQuest = useCallback(
    async (questId: string, reflection?: string) => {
      setQuests((prev) =>
        prev.map((item) => (item.id === questId ? { ...item, completed: true } : item)),
      );

      try {
        await completeQuestInBackend(questId, reflection);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to complete quest.");
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      adventurePacks,
      completeQuest,
      error,
      getAdventurePack,
      getQuest,
      loading,
      quests,
      refresh,
      toggleSave,
    }),
    [
      adventurePacks,
      completeQuest,
      error,
      getAdventurePack,
      getQuest,
      loading,
      quests,
      refresh,
      toggleSave,
    ],
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  return useContext(ContentContext);
}
