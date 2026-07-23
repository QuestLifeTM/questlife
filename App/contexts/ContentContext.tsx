import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  fetchContentLibrary,
  toggleSavedQuest,
} from "@/services/content/contentService";
import { Quest } from "@/types/content";

type ContentContextValue = {
  error: string | null;
  getQuest: (id?: string) => Quest | null;
  loading: boolean;
  quests: Quest[];
  refresh: () => Promise<void>;
  toggleSave: (questId: string) => Promise<boolean>;
};

const ContentContext = createContext<ContentContextValue>({
  error: null,
  getQuest: () => null,
  loading: false,
  quests: [],
  refresh: async () => undefined,
  toggleSave: async () => false,
});

export function ContentProvider({ children }: PropsWithChildren) {
  const { isConfigured, session } = useAuth();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConfigured || !session) {
      setQuests([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const content = await fetchContentLibrary();
      setQuests(content.quests);
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

  const toggleSave = useCallback(
    async (questId: string) => {
      const quest = quests.find((item) => item.id === questId);
      if (!quest) return false;

      const nextSavedAt = quest.saved ? null : new Date().toISOString();
      setQuests((prev) =>
        prev.map((item) => (item.id === questId ? { ...item, saved: !item.saved, savedAt: nextSavedAt } : item)),
      );

      try {
        await toggleSavedQuest(questId, quest.saved);
        return true;
      } catch (nextError) {
        setQuests((prev) =>
          prev.map((item) => (item.id === questId ? { ...item, saved: quest.saved, savedAt: quest.savedAt } : item)),
        );
        setError(nextError instanceof Error ? nextError.message : "Unable to update saved quest.");
        return false;
      }
    },
    [quests],
  );

  const value = useMemo(
    () => ({
      error,
      getQuest,
      loading,
      quests,
      refresh,
      toggleSave,
    }),
    [
      error,
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
