import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { useContent } from "@/contexts/ContentContext";
import { upsertAdventurePack } from "@/services/content/contentService";
import { AdventurePackFormInput, Quest, QuestStatus } from "@/types/content";

const nova = { blue: "#2563eb", green: "#22c55e", red: "#ef4444" };

const defaultForm: AdventurePackFormInput & { coverImageUrl?: string } = {
  title: "",
  subtitle: "",
  description: "",
  status: "draft",
  color: "#2563eb",
  bgColor: "#dbeafe",
  icon: "🧭",
  questIds: [],
  coverImageUrl: "",
};

export function AdminAdventurePacksScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { adventurePacks, quests, refresh } = useContent();
  const compact = width < 900;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publishedQuests = useMemo(() => quests.filter((q) => q.status === "published"), [quests]);

  useEffect(() => {
    if (!selectedId) {
      setForm(defaultForm);
      return;
    }
    const pack = adventurePacks.find((p) => p.id === selectedId);
    if (!pack) return;
    setForm({
      title: pack.title,
      subtitle: pack.subtitle,
      description: pack.description,
      status: pack.status,
      color: pack.color,
      bgColor: pack.bgColor,
      icon: pack.icon,
      questIds: pack.questIds,
      coverImageUrl: pack.coverImageUrl ?? "",
    });
  }, [adventurePacks, selectedId]);

  const filteredQuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return publishedQuests;
    return publishedQuests.filter((quest) => `${quest.title} ${quest.category}`.toLowerCase().includes(q));
  }, [publishedQuests, search]);

  function toggleQuest(id: string) {
    setForm((prev) => ({
      ...prev,
      questIds: prev.questIds.includes(id) ? prev.questIds.filter((x) => x !== id) : [...prev.questIds, id],
    }));
  }

  async function save(status?: QuestStatus) {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await upsertAdventurePack({
        id: selectedId ?? undefined,
        ...form,
        status: status ?? form.status,
        coverImageUrl: form.coverImageUrl?.trim() || undefined,
      });
      await refresh();
      setMessage(selectedId ? "Adventure pack updated." : "Adventure pack created.");
      if (!selectedId) setSelectedId(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save pack.");
    } finally {
      setBusy(false);
    }
  }

  const previewQuests = form.questIds
    .map((id) => publishedQuests.find((q) => q.id === id))
    .filter(Boolean) as Quest[];

  return (
    <View style={{ flex: 1, backgroundColor: "#f3f4fb" }}>
      <ScrollView contentContainerStyle={{ padding: compact ? 16 : 28, gap: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.push("/admin/published")} style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
            <Ionicons name="chevron-back" size={18} color="#4b5563" />
          </Pressable>
          <View>
            <Text style={{ color: "#111827", fontSize: 26, fontWeight: "900" }}>Adventure Packs</Text>
            <Text style={{ color: "#6b7280", fontWeight: "600", marginTop: 4 }}>Build official quest collections with cover art and mobile preview.</Text>
          </View>
        </View>

        {message ? <Text style={{ color: nova.green, fontWeight: "900" }}>{message}</Text> : null}
        {error ? <Text style={{ color: nova.red, fontWeight: "900" }}>{error}</Text> : null}

        <View style={{ flexDirection: compact ? "column" : "row", gap: 20, alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 12, width: "100%" }}>
            <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", padding: 16, gap: 10 }}>
              <Text style={{ color: "#111827", fontWeight: "900", fontSize: 16 }}>Existing packs</Text>
              {adventurePacks.map((pack) => (
                <Pressable key={pack.id} onPress={() => setSelectedId(pack.id)} style={{ padding: 12, borderRadius: 10, backgroundColor: selectedId === pack.id ? "#dbeafe" : "#f8fafc", flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 22 }}>{pack.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#111827", fontWeight: "900" }}>{pack.title}</Text>
                    <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "700" }}>{pack.questCount} quests · {pack.status}</Text>
                  </View>
                </Pressable>
              ))}
              <Pressable onPress={() => { setSelectedId(null); setForm(defaultForm); }} style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "#cbd5e1", alignItems: "center" }}>
                <Text style={{ color: nova.blue, fontWeight: "900" }}>+ New pack</Text>
              </Pressable>
            </View>

            <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", padding: 20, gap: 12 }}>
              <Field label="Title" value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} />
              <Field label="Subtitle" value={form.subtitle} onChange={(v) => setForm((p) => ({ ...p, subtitle: v }))} />
              <Field label="Description" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} multiline />
              <Field label="Icon (emoji)" value={form.icon} onChange={(v) => setForm((p) => ({ ...p, icon: v }))} />
              <Field label="Accent color" value={form.color} onChange={(v) => setForm((p) => ({ ...p, color: v }))} />
              <Field label="Background color" value={form.bgColor} onChange={(v) => setForm((p) => ({ ...p, bgColor: v }))} />
              <Field label="Cover image URL" value={form.coverImageUrl ?? ""} onChange={(v) => setForm((p) => ({ ...p, coverImageUrl: v }))} placeholder="https://..." />

              <Text style={{ color: "#6b7280", fontWeight: "900", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Quests ({form.questIds.length})</Text>
              <TextInput value={search} onChangeText={setSearch} placeholder="Search quests..." placeholderTextColor="#9ca3af" style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, color: "#111827", fontWeight: "700" }} />
              <View style={{ maxHeight: 260 }}>
                <ScrollView nestedScrollEnabled>
                  {filteredQuests.map((quest) => (
                    <Pressable key={quest.id} onPress={() => toggleQuest(quest.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6" }}>
                      <Ionicons name={form.questIds.includes(quest.id) ? "checkbox" : "square-outline"} size={18} color={form.questIds.includes(quest.id) ? nova.blue : "#9ca3af"} />
                      <Text style={{ flex: 1, color: "#111827", fontWeight: "800" }} numberOfLines={1}>{quest.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={{ flexDirection: compact ? "column" : "row", gap: 10 }}>
                <ActionButton label={busy ? "Saving..." : "Save draft"} onPress={() => save("draft")} secondary />
                <ActionButton label="Publish" onPress={() => save("published")} />
              </View>
            </View>
          </View>

          <View style={{ flex: 1, width: "100%" }}>
            <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", padding: 20, gap: 14 }}>
              <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Mobile preview</Text>
              <View style={{ borderRadius: 26, backgroundColor: "#f7f0df", borderWidth: 1, borderColor: "#eadfcb", padding: 14 }}>
                <View style={{ borderRadius: 22, overflow: "hidden", borderWidth: 2, borderColor: "#f0dfbe", backgroundColor: form.bgColor }}>
                  {form.coverImageUrl ? (
                    <View style={{ height: 120, backgroundColor: form.bgColor, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#607087", fontWeight: "700", fontSize: 12 }}>Cover image set</Text>
                    </View>
                  ) : null}
                  <View style={{ padding: 16, gap: 8 }}>
                    <Text style={{ color: form.color, fontWeight: "900", fontSize: 11 }}>{previewQuests.length} QUESTS</Text>
                    <Text style={{ color: "#152033", fontSize: 22, fontWeight: "900" }}>{form.icon} {form.title || "Pack title"}</Text>
                    <Text style={{ color: "#607087", fontWeight: "700" }}>{form.subtitle || "Subtitle preview"}</Text>
                    {previewQuests.slice(0, 3).map((q) => (
                      <Text key={q.id} style={{ color: "#152033", fontWeight: "800", fontSize: 13 }}>• {q.title}</Text>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChange, multiline, placeholder }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: "#6b7280", fontWeight: "900", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, color: "#111827", fontWeight: "700", minHeight: multiline ? 80 : undefined, textAlignVertical: multiline ? "top" : "auto" }}
      />
    </View>
  );
}

function ActionButton({ label, onPress, secondary }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, backgroundColor: secondary ? "#fff" : nova.blue, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: secondary ? 1 : 0, borderColor: "#e5e7eb" }}>
      <Text style={{ color: secondary ? "#6b7280" : "#fff", fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}
