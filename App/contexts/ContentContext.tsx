import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  fetchContentLibrary,
  fetchPublishedQuestCatalog,
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
  const userId = session?.user.id;
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const queuedRefreshRef = useRef(false);

  const refreshContent = useCallback(async (background = false) => {
    if (!isConfigured || !userId) {
      setQuests([]);
      return;
    }

    if (refreshInFlightRef.current) {
      queuedRefreshRef.current = true;
      return refreshInFlightRef.current;
    }

    const request = (async () => {
      if (!background) {
        setLoading(true);
        setError(null);
      }

      try {
        if (background) {
          const catalog = await fetchPublishedQuestCatalog();
          setQuests((current) => {
            const userStateByQuestId = new Map(current.map((quest) => [quest.id, { completed: quest.completed, saved: quest.saved, savedAt: quest.savedAt }]));
            return catalog.map((quest) => ({ ...quest, ...userStateByQuestId.get(quest.id) }));
          });
        } else {
          const content = await fetchContentLibrary({ userId });
          setQuests(content.quests);
        }
      } catch (nextError) {
        if (!background) setError(nextError instanceof Error ? nextError.message : "Unable to load QuestLife content.");
      } finally {
        if (!background) setLoading(false);
      }
    })();

    refreshInFlightRef.current = request;
    try {
      await request;
    } finally {
      if (refreshInFlightRef.current !== request) return;
      refreshInFlightRef.current = null;
      if (queuedRefreshRef.current) {
        queuedRefreshRef.current = false;
        setTimeout(() => { void refreshContent(true); }, 0);
      }
    }
  }, [isConfigured, userId]);

  const refresh = useCallback(() => refreshContent(false), [refreshContent]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isConfigured || !userId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const queueBackgroundRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void refreshContent(true);
      }, 150);
    };
    const channel = supabase
      .channel("content-library-quests")
      .on("postgres_changes", { event: "*", schema: "public", table: "quests" }, queueBackgroundRefresh)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [isConfigured, refreshContent, userId]);

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
