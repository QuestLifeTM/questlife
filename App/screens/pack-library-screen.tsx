import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { T } from "@/components/theme";
import { Card, EmptyState, Header, IconButton, PillStat, Screen, SearchInput } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";

export function PackLibraryScreen({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { adventurePacks, loading } = useContent();
  const { userPacks } = useQuestEngine();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return adventurePacks;
    return adventurePacks.filter((p) => `${p.title} ${p.subtitle} ${p.description}`.toLowerCase().includes(q));
  }, [adventurePacks, search]);

  return (
    <Screen>
      <Header eyebrow="Explore" title="Adventure Packs" right={<IconButton icon="chevron-back" onPress={onBack} />} />
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search packs..." />
      <Text style={{ color: T.muted, fontWeight: "700", lineHeight: 20 }}>
        Ready-made quest collections for a place, a trip, a date night, or a whole vibe. Pick one and plan your day around it.
      </Text>

      <Pressable
        onPress={() => router.push("/plan/pick-quests")}
        style={{ minHeight: 120, borderRadius: 24, borderWidth: 2.5, borderStyle: "dashed", borderColor: T.border, alignItems: "center", justifyContent: "center", gap: 8, padding: 20 }}
      >
        <Ionicons name="add-circle-outline" size={28} color={T.blue} />
        <Text style={{ color: T.dark, fontWeight: "900", textAlign: "center" }}>Create your own adventure pack</Text>
        <Text style={{ color: T.muted, fontWeight: "700", fontSize: 13, textAlign: "center" }}>For a particular place, trip, or occasion</Text>
      </Pressable>

      <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>Official packs</Text>
      {loading ? (
        <Card><EmptyState emoji="⏳" title="Loading packs" body="Finding adventures..." /></Card>
      ) : filtered.length ? (
        filtered.map((pack) => (
          <Link key={pack.id} href={`/adventure-pack/${pack.id}`} asChild>
            <Pressable style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
              <Card style={{ borderRadius: 24, padding: 0, overflow: "hidden" }}>
                <View style={{ padding: 18, backgroundColor: pack.bgColor, borderBottomWidth: 1, borderBottomColor: T.border, gap: 8 }}>
                  <PillStat text={`${pack.questCount} quests`} color={pack.color} />
                  <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>{pack.icon} {pack.title}</Text>
                  <Text style={{ color: T.muted, fontWeight: "700" }}>{pack.subtitle}</Text>
                </View>
                <View style={{ padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <PillStat icon="time" text={pack.timeRange} color={T.muted} />
                  <Ionicons name="chevron-forward" size={18} color={pack.color} />
                </View>
              </Card>
            </Pressable>
          </Link>
        ))
      ) : (
        <EmptyState emoji="🧭" title="No packs found" body="Try a different search or check back later." />
      )}

      {userPacks.length ? (
        <>
          <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900", marginTop: 8 }}>Your packs</Text>
          {userPacks.map((pack) => (
            <Card key={pack.id} style={{ borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 28 }}>{pack.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.dark, fontWeight: "900" }}>{pack.title}</Text>
                <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>{pack.questIds.length} quests</Text>
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
