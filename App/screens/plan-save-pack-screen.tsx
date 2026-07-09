import { useState } from "react";
import { TextInput, Text } from "react-native";
import { T } from "@/components/theme";
import { Header, IconButton, Screen, SoftButton } from "@/components/ui";
import { useQuestEngine } from "@/contexts/QuestEngineContext";

export function PlanSavePackScreen({ questIds, onBack, onDone }: { questIds: string[]; onBack: () => void; onDone: () => void }) {
  const { saveUserPack } = useQuestEngine();
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("🎒");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await saveUserPack({ title: title.trim(), icon, accentColor: T.blue, questIds, description: null });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header eyebrow="Adventure Pack" title="Save your pack" right={<IconButton icon="chevron-back" onPress={onBack} />} />
      <Text style={{ color: T.muted, fontWeight: "700", marginBottom: 8 }}>{questIds.length} quests selected</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="Pack title (e.g. Beach Day)" placeholderTextColor={T.muted} style={{ borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 14, color: T.dark, fontWeight: "700", marginBottom: 12 }} />
      <TextInput value={icon} onChangeText={setIcon} placeholder="Emoji icon" placeholderTextColor={T.muted} style={{ borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 14, color: T.dark, fontWeight: "700", marginBottom: 12, width: 80, textAlign: "center", fontSize: 24 }} />
      <SoftButton label={busy ? "Saving..." : "Save pack"} icon="bookmark" onPress={save} />
    </Screen>
  );
}
