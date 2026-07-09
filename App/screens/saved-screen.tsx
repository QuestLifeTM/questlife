import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { categoryColor, difficultyColor, T } from "@/components/theme";
import { Card, EmptyState, Header, IconButton, PillStat, Screen, SearchInput, Sheet, SoftButton, Tag } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { sortOptions } from "@/data/questlife";
import { Quest, QuestDifficulty, questDifficulties } from "@/types/content";

interface Filters {
  duration: string | null;
  difficulty: QuestDifficulty | null;
}

const emptyFilters: Filters = { duration: null, difficulty: null };

function applyFilters(list: Quest[], filters: Filters) {
  return list.filter((quest) => {
    if (filters.duration === "Under 30min" && quest.timeMin >= 30) return false;
    if (filters.duration === "30-60min" && (quest.timeMin < 30 || quest.timeMin > 60)) return false;
    if (filters.duration === "1-2h" && (quest.timeMin < 60 || quest.timeMin > 120)) return false;
    if (filters.duration === "2h+" && quest.timeMin <= 120) return false;
    if (filters.difficulty && quest.difficulty !== filters.difficulty) return false;
    return true;
  });
}

function sortSaved(list: Quest[], sortBy: string) {
  const d: Record<QuestDifficulty, number> = { EASY: 0, MEDIUM: 1, HARD: 2, FORMIDABLE: 3 };
  const copy = [...list];
  if (sortBy === "Most XP") return copy.sort((a, b) => b.xp - a.xp);
  if (sortBy === "Least XP") return copy.sort((a, b) => a.xp - b.xp);
  if (sortBy === "Easiest") return copy.sort((a, b) => d[a.difficulty] - d[b.difficulty]);
  if (sortBy === "Hardest") return copy.sort((a, b) => d[b.difficulty] - d[a.difficulty]);
  if (sortBy === "Shortest") return copy.sort((a, b) => a.timeMin - b.timeMin);
  if (sortBy === "Longest") return copy.sort((a, b) => b.timeMin - a.timeMin);
  return copy;
}

function QuestRow({ quest, onOpen, onRemove }: { quest: Quest; onOpen: () => void; onRemove: () => void }) {
  const cat = categoryColor[quest.category] ?? { text: quest.color, bg: `${quest.color}18` };
  const diff = difficultyColor[quest.difficulty];
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: 5, backgroundColor: quest.color }} />
          <View style={{ flex: 1, padding: 16, gap: 9 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <View style={{ flex: 1, flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <Tag label={quest.category} color={cat.text} bg={cat.bg} />
                <Tag label={quest.difficulty} color={diff.text} bg={diff.bg} />
              </View>
              <Pressable onPress={onRemove} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${T.blue}1f`, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="bookmark" size={15} color={T.blue} />
              </Pressable>
            </View>
            <Text style={{ color: T.dark, fontSize: 16, lineHeight: 21, fontWeight: "900" }}>{quest.title}</Text>
            <Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "600" }} numberOfLines={3}>{quest.description}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", flex: 1 }}>
                <PillStat icon="flash" text={`+${quest.xp} XP`} />
                <PillStat icon="time" text={quest.timeLabel} color={T.dark} />
              </View>
              <Link href={`/quest/${quest.id}`} asChild>
                <Pressable style={{ flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: T.blue, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 }}>
                  <Text style={{ color: T.white, fontWeight: "900", fontSize: 12 }}>Start</Text>
                  <Ionicons name="chevron-forward" size={12} color={T.white} />
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export function SavedScreen({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { loading, quests, toggleSave } = useContent();
  const { userPacks, removeUserPack } = useQuestEngine();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("Best Match");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showSort, setShowSort] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [openQuest, setOpenQuest] = useState<Quest | null>(null);
  const activeFilterCount = [filters.duration, filters.difficulty].filter(Boolean).length;

  const filtered = useMemo(() => {
    let result = quests.filter((quest) => quest.saved);
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter((quest) => `${quest.title} ${quest.description} ${quest.category}`.toLowerCase().includes(query));
    }
    result = applyFilters(result, filters);
    return sortSaved(result, sortBy);
  }, [filters, quests, search, sortBy]);

  function resetFilters() {
    setSearch("");
    setFilters(emptyFilters);
    setSortBy("Best Match");
  }

  return (
    <Screen>
      <Header eyebrow="My Stuff" title="Saved" right={<IconButton icon="chevron-back" onPress={onBack} />} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <SearchInput value={search} onChangeText={setSearch} placeholder="Search saved quests..." />
        <IconButton icon="swap-vertical" onPress={() => setShowSort(true)} color={sortBy !== "Best Match" ? T.blue : T.muted} bg={sortBy !== "Best Match" ? `${T.blue}1f` : T.white} />
        <IconButton icon="options-outline" onPress={() => setShowFilter(true)} color={activeFilterCount ? T.cyan : T.muted} bg={activeFilterCount ? `${T.cyan}1f` : T.white} badge={activeFilterCount || undefined} />
      </View>

      {userPacks.length ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>My Adventure Packs</Text>
            <Pressable onPress={() => router.push("/pack-library")}>
              <Text style={{ color: T.cyan, fontWeight: "900", fontSize: 13 }}>See all</Text>
            </Pressable>
          </View>
          {userPacks.map((pack) => (
            <Card key={pack.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 28 }}>{pack.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.dark, fontWeight: "900" }}>{pack.title}</Text>
                <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>{pack.questIds.length} quests</Text>
              </View>
              <Pressable onPress={() => removeUserPack(pack.id)} style={{ padding: 8 }}>
                <Ionicons name="trash-outline" size={18} color={T.muted} />
              </Pressable>
            </Card>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>Saved Quests</Text>
          <Text style={{ color: T.muted, fontWeight: "800", fontSize: 12 }}>{filtered.length} quests</Text>
        </View>
        {loading ? (
          <Card>
            <EmptyState emoji="⏳" title="Loading saved quests" body="Finding the quests you saved." />
          </Card>
        ) : filtered.length ? filtered.map((quest) => (
          <QuestRow key={quest.id} quest={quest} onOpen={() => setOpenQuest(quest)} onRemove={() => toggleSave(quest.id)} />
        )) : (
          <EmptyState
            emoji={search || activeFilterCount ? "🔍" : "📭"}
            title={search || activeFilterCount ? "No matches found" : "No saved quests yet"}
            body={search || activeFilterCount ? "Try adjusting your search, filters, or sorting." : "Save quests from Explore to see them here."}
            action={search || activeFilterCount || sortBy !== "Best Match" ? <SoftButton label="Reset all filters" icon="refresh" onPress={resetFilters} /> : undefined}
          />
        )}
      </View>

      <Sheet visible={!!openQuest} onClose={() => setOpenQuest(null)}>
        {openQuest ? (
          <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 14 }}>
            <Text style={{ color: T.dark, fontSize: 24, lineHeight: 29, fontWeight: "900" }}>{openQuest.title}</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Tag label={openQuest.category} color={(categoryColor[openQuest.category] ?? { text: openQuest.color }).text} bg={(categoryColor[openQuest.category] ?? { bg: `${openQuest.color}18` }).bg} />
              <Tag label={openQuest.difficulty} color={difficultyColor[openQuest.difficulty].text} bg={difficultyColor[openQuest.difficulty].bg} />
              <PillStat icon="flash" text={`+${openQuest.xp} XP`} />
              <PillStat icon="time" text={openQuest.timeLabel} color={T.dark} />
            </View>
            <Text style={{ color: T.muted, fontWeight: "600", lineHeight: 21 }}>{openQuest.description}</Text>
            <Link href={`/quest/${openQuest.id}`} asChild>
              <Pressable>
                <SoftButton label="Start Quest" icon="play" />
              </Pressable>
            </Link>
            <SoftButton label="Remove from saved" icon="trash-outline" color={T.red} onPress={() => { toggleSave(openQuest.id); setOpenQuest(null); }} />
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={showSort} onClose={() => setShowSort(false)}>
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900", marginBottom: 10 }}>Sort by</Text>
          {sortOptions.map((option) => (
            <Pressable key={option} onPress={() => { setSortBy(option); setShowSort(false); }} style={{ minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: option === sortBy ? T.blue : T.dark, fontWeight: option === sortBy ? "900" : "700", fontSize: 16 }}>{option}</Text>
              {option === sortBy ? <Ionicons name="checkmark-circle" size={22} color={T.blue} /> : null}
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet visible={showFilter} onClose={() => setShowFilter(false)}>
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 18 }}>
          <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900" }}>Filters</Text>
          <View style={{ gap: 8 }}>
            <Text style={{ color: T.muted, fontWeight: "900", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>Duration</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {["Under 30min", "30-60min", "1-2h", "2h+"].map((value) => {
                const active = filters.duration === value;
                return (
                  <Pressable key={value} onPress={() => setFilters((prev) => ({ ...prev, duration: active ? null : value }))} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 99, backgroundColor: active ? `${T.cyan}1f` : T.white, borderWidth: 2, borderColor: active ? T.cyan : T.border }}>
                    <Text style={{ color: active ? T.cyan : T.muted, fontWeight: "900" }}>{value}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: T.muted, fontWeight: "900", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>Difficulty</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {questDifficulties.map((value) => {
                const active = filters.difficulty === value;
                return (
                  <Pressable key={value} onPress={() => setFilters((prev) => ({ ...prev, difficulty: active ? null : value }))} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 99, backgroundColor: active ? `${T.blue}1f` : T.white, borderWidth: 2, borderColor: active ? T.blue : T.border }}>
                    <Text style={{ color: active ? T.blue : T.muted, fontWeight: "900" }}>{value}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SoftButton label="Reset" inverse color={T.muted} onPress={() => setFilters(emptyFilters)} style={{ flex: 1 }} />
            <SoftButton label="Apply" onPress={() => setShowFilter(false)} style={{ flex: 1 }} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}
