import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/components/theme";
import { Card, EmptyState, Header, IconButton, Screen, SoftButton } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";

export function PlanPickQuestsScreen({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { quests, loading } = useContent();
  const { savePlan } = useQuestEngine();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function saveToday() {
    setBusy(true);
    try {
      await savePlan(selected);
      onBack();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header eyebrow="Plan" title="Pick quests" right={<IconButton icon="chevron-back" onPress={onBack} />} />
      <Text style={{ color: T.muted, fontWeight: "700", lineHeight: 20 }}>Select quests for today's plan. This won't create an adventure pack unless you choose to save it as one.</Text>

      {loading ? (
        <Card><EmptyState emoji="⏳" title="Loading quests" body="Finding quests..." /></Card>
      ) : (
        <View style={{ gap: 10 }}>
          {quests.map((q) => {
            const on = selected.includes(q.id);
            return (
              <Pressable key={q.id} onPress={() => toggle(q.id)}>
                <Card style={{ borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 12, boxShadow: "none", borderColor: on ? T.blue : T.border }}>
                  <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? T.blue : T.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.dark, fontWeight: "900" }}>{q.title}</Text>
                    <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>{q.category} · +{q.xp} XP</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ gap: 10, marginTop: 8 }}>
        <SoftButton label={busy ? "Saving..." : `Save plan (${selected.length})`} icon="checkmark" onPress={selected.length ? saveToday : undefined} />
        {selected.length ? (
          <SoftButton
            label="Save as Adventure Pack"
            icon="albums-outline"
            inverse
            color={T.blue}
            onPress={() => router.push({ pathname: "/plan/save-pack", params: { questIds: selected.join(",") } })}
          />
        ) : null}
      </View>
    </Screen>
  );
}
