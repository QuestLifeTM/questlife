import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { useContent } from "@/contexts/ContentContext";
import {
  deleteFeaturedBatch,
  featuredDateKey,
  fetchFeaturedBatches,
  upsertFeaturedBatch,
} from "@/services/content/featuredService";
import { Quest } from "@/types/content";

const nova = { blue: "#2563eb", green: "#22c55e", red: "#ef4444", orange: "#f97316" };

function addDays(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return featuredDateKey(d);
}

export function AdminFeaturedScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { quests } = useContent();
  const compact = width < 900;

  const today = featuredDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publishedQuests = useMemo(() => quests.filter((q) => q.status === "published"), [quests]);

  const loadBatch = useCallback(async (date: string) => {
    setError(null);
    try {
      const batches = await fetchFeaturedBatches(date, date);
      setSelectedQuestIds(batches[0]?.questIds ?? []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load featured batch.");
      setSelectedQuestIds([]);
    }
  }, []);

  useEffect(() => {
    loadBatch(selectedDate);
  }, [loadBatch, selectedDate]);

  const filteredQuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return publishedQuests;
    return publishedQuests.filter((quest) => `${quest.title} ${quest.category}`.toLowerCase().includes(q));
  }, [publishedQuests, search]);

  function toggleQuest(id: string) {
    setSelectedQuestIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await upsertFeaturedBatch(selectedDate, selectedQuestIds);
      setMessage(`Featured batch saved for ${selectedDate}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save batch.");
    } finally {
      setBusy(false);
    }
  }

  async function clearBatch() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await deleteFeaturedBatch(selectedDate);
      setSelectedQuestIds([]);
      setMessage(`Cleared featured batch for ${selectedDate}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to clear batch.");
    } finally {
      setBusy(false);
    }
  }

  const isPast = selectedDate < today;
  const dates = [-2, -1, 0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(today, offset));

  return (
    <View style={{ flex: 1, backgroundColor: "#f3f4fb" }}>
      <ScrollView contentContainerStyle={{ padding: compact ? 16 : 28, gap: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.push("/admin/published")} style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
            <Ionicons name="chevron-back" size={18} color="#4b5563" />
          </Pressable>
          <View>
            <Text style={{ color: "#111827", fontSize: 26, fontWeight: "900" }}>Featured Quests</Text>
            <Text style={{ color: "#6b7280", fontWeight: "600", marginTop: 4 }}>Schedule 6 quests per day for Explore's "Featured Today" carousel.</Text>
          </View>
        </View>

        {message ? <Text style={{ color: nova.green, fontWeight: "900" }}>{message}</Text> : null}
        {error ? <Text style={{ color: nova.red, fontWeight: "900" }}>{error}</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {dates.map((date) => {
            const active = date === selectedDate;
            const past = date < today;
            return (
              <Pressable
                key={date}
                onPress={() => setSelectedDate(date)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: active ? nova.blue : "#e5e7eb",
                  backgroundColor: active ? "#dbeafe" : "#fff",
                }}
              >
                <Text style={{ color: active ? nova.blue : past ? "#9ca3af" : "#111827", fontWeight: "900", fontSize: 13 }}>{date}</Text>
                {date === today ? <Text style={{ color: nova.blue, fontSize: 10, fontWeight: "800", marginTop: 2 }}>TODAY</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", padding: 20, gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>{selectedDate} · {selectedQuestIds.length}/6 selected</Text>
            {isPast ? <Text style={{ color: nova.orange, fontWeight: "900", fontSize: 12 }}>Read-only (past date)</Text> : null}
          </View>

          {selectedQuestIds.length ? (
            <View style={{ gap: 8 }}>
              {selectedQuestIds.map((id, index) => {
                const quest = publishedQuests.find((q) => q.id === id);
                if (!quest) return null;
                return (
                  <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, backgroundColor: "#f8fafc" }}>
                    <Text style={{ color: nova.blue, fontWeight: "900", width: 20 }}>{index + 1}</Text>
                    <View style={{ width: 4, height: 32, borderRadius: 99, backgroundColor: quest.color }} />
                    <Text style={{ flex: 1, color: "#111827", fontWeight: "800" }} numberOfLines={1}>{quest.title}</Text>
                    {!isPast ? (
                      <Pressable onPress={() => toggleQuest(id)}>
                        <Ionicons name="close-circle" size={20} color="#9ca3af" />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: "#6b7280", fontWeight: "700" }}>No quests scheduled for this date yet.</Text>
          )}
        </View>

        {!isPast ? (
          <>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search published quests..."
              placeholderTextColor="#9ca3af"
              style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, backgroundColor: "#fff", color: "#111827", fontWeight: "700" }}
            />
            <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" }}>
              {filteredQuests.map((quest) => (
                <QuestPickRow key={quest.id} quest={quest} selected={selectedQuestIds.includes(quest.id)} disabled={!selectedQuestIds.includes(quest.id) && selectedQuestIds.length >= 6} onToggle={() => toggleQuest(quest.id)} />
              ))}
            </View>
            <View style={{ flexDirection: compact ? "column" : "row", gap: 12 }}>
              <Pressable onPress={save} disabled={busy || selectedQuestIds.length !== 6} style={{ flex: 1, backgroundColor: selectedQuestIds.length === 6 ? nova.blue : "#93c5fd", borderRadius: 12, padding: 16, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "900" }}>{busy ? "Saving..." : "Save batch"}</Text>
              </Pressable>
              <Pressable onPress={clearBatch} disabled={busy} style={{ flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" }}>
                <Text style={{ color: "#6b7280", fontWeight: "900" }}>Clear batch</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function QuestPickRow({ quest, selected, disabled, onToggle }: { quest: Quest; selected: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={disabled && !selected ? undefined : onToggle}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#f3f4f6", opacity: disabled && !selected ? 0.45 : 1 }}
    >
      <Ionicons name={selected ? "checkbox" : "square-outline"} size={20} color={selected ? nova.blue : "#9ca3af"} />
      <View style={{ width: 4, height: 36, borderRadius: 99, backgroundColor: quest.color }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#111827", fontWeight: "900" }}>{quest.title}</Text>
        <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "700" }}>{quest.category} · +{quest.xp} XP</Text>
      </View>
    </Pressable>
  );
}
