import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { categoryColor, difficultyColor, T } from "@/components/theme";
import { Card, EmptyState, Header, IconButton, PillStat, Screen, Sheet, SoftButton, Tag, useResponsiveScreenLayout } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { Quest, QuestDifficulty, questDifficulties } from "@/types/content";
import { UserPack } from "@/types/engine";

interface Filters { duration: string | null; difficulty: QuestDifficulty | null; }
const emptyFilters: Filters = { duration: null, difficulty: null };
const savedSortOptions = ["Best Match", "Recently saved", "Most XP", "Least XP", "Easiest", "Hardest", "Shortest", "Longest"];

function applyFilters(list: Quest[], filters: Filters) {
  return list.filter((quest) => {
    if (filters.duration === "Under 30min" && quest.timeMin >= 30) return false;
    if (filters.duration === "30-60min" && (quest.timeMin < 30 || quest.timeMin > 60)) return false;
    if (filters.duration === "1-2h" && (quest.timeMin < 60 || quest.timeMin > 120)) return false;
    if (filters.duration === "2h+" && quest.timeMin <= 120) return false;
    return !filters.difficulty || quest.difficulty === filters.difficulty;
  });
}

function sortSaved(list: Quest[], sortBy: string, availableMinutes: number | null) {
  const rank: Record<QuestDifficulty, number> = { EASY: 0, MEDIUM: 1, HARD: 2, FORMIDABLE: 3 };
  const copy = [...list];
  if (sortBy === "Recently saved") return copy.sort((a, b) => new Date(b.savedAt ?? 0).getTime() - new Date(a.savedAt ?? 0).getTime());
  if (sortBy === "Most XP") return copy.sort((a, b) => b.xp - a.xp);
  if (sortBy === "Least XP") return copy.sort((a, b) => a.xp - b.xp);
  if (sortBy === "Easiest") return copy.sort((a, b) => rank[a.difficulty] - rank[b.difficulty]);
  if (sortBy === "Hardest") return copy.sort((a, b) => rank[b.difficulty] - rank[a.difficulty]);
  if (sortBy === "Shortest") return copy.sort((a, b) => a.timeMin - b.timeMin);
  if (sortBy === "Longest") return copy.sort((a, b) => b.timeMin - a.timeMin);
  return copy.sort((a, b) => {
    const savedPenalty = Number(a.completed) - Number(b.completed);
    if (savedPenalty) return savedPenalty;
    if (availableMinutes !== null) {
      const aScore = Math.abs(a.timeMin - availableMinutes) + (a.timeMin > availableMinutes ? 120 : 0);
      const bScore = Math.abs(b.timeMin - availableMinutes) + (b.timeMin > availableMinutes ? 120 : 0);
      if (aScore !== bScore) return aScore - bScore;
    }
    return new Date(b.savedAt ?? 0).getTime() - new Date(a.savedAt ?? 0).getTime();
  });
}

function recentSaveLabel(savedAt?: string | null) {
  if (!savedAt) return null;
  const elapsedHours = Math.max(0, Math.floor((Date.now() - new Date(savedAt).getTime()) / 3_600_000));
  if (elapsedHours < 24) return "SAVED TODAY";
  const days = Math.floor(elapsedHours / 24);
  return days <= 7 ? `SAVED ${days}D AGO` : null;
}

function CollectionThumb({ pack, size = 54 }: { pack: UserPack; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: `${pack.accentColor}18` }}>
    {pack.coverImageUrl ? <Image source={{ uri: pack.coverImageUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : <Ionicons name="bookmarks" size={Math.round(size * 0.45)} color={pack.accentColor} />}
  </View>;
}

function CollectionPreview({ pack, onPress, width }: { pack: UserPack; onPress: () => void; width: number }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${pack.title} collection`} onPress={onPress} style={({ pressed }) => ({ width, flexDirection: "row", gap: 8, alignItems: "center", opacity: pressed ? 0.68 : 1 })}>
    <CollectionThumb pack={pack} size={50} />
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <Text numberOfLines={1} style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 13 }}>{pack.title}</Text>
      <View style={{ flexDirection: "row", gap: 3, alignItems: "center" }}><Ionicons name="lock-closed" size={11} color={T.muted} /><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 11 }}>Private</Text></View>
    </View>
  </Pressable>;
}

function QuestRow({ quest, status, onOpen, onRemove }: { quest: Quest; status?: "active" | "completed"; onOpen: () => void; onRemove: () => void }) {
  const cat = categoryColor[quest.category] ?? { text: quest.color, bg: `${quest.color}18` };
  const diff = difficultyColor[quest.difficulty];
  return <Pressable onPress={onOpen} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
    <Card style={{ padding: 0, overflow: "hidden" }}><View style={{ flexDirection: "row" }}>
      <View style={{ width: 5, backgroundColor: quest.color }} />
      <View style={{ flex: 1, padding: 16, gap: 9 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}><View style={{ flex: 1, flexDirection: "row", gap: 6, flexWrap: "wrap" }}><Tag label={quest.category} color={cat.text} bg={cat.bg} /><Tag label={quest.difficulty} color={diff.text} bg={diff.bg} />{status === "active" ? <Tag label="ACTIVE NOW" color={T.purple} bg={`${T.purple}18`} /> : null}{status === "completed" ? <Tag label="COMPLETED" color={T.green} bg={`${T.green}18`} /> : null}{recentSaveLabel(quest.savedAt) ? <Tag label={recentSaveLabel(quest.savedAt)!} color={T.blue} bg={`${T.blue}12`} /> : null}</View><Pressable onPress={onRemove} accessibilityLabel={`Unsave ${quest.title}`} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${T.blue}1f`, alignItems: "center", justifyContent: "center" }}><Ionicons name="bookmark" size={15} color={T.blue} /></Pressable></View>
        <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 16, lineHeight: 21 }}>{quest.title}</Text>
        <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{quest.description}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}><View style={{ flexDirection: "row", gap: 8, flex: 1 }}><PillStat icon="flash" text={`+${quest.xp} XP`} /><PillStat icon="time" text={quest.timeLabel} color={T.dark} /></View><Link href={`/quest/${quest.id}`} asChild><Pressable style={{ flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: T.blue, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 }}><Text style={{ color: T.white, fontFamily: "RubikBold", fontSize: 12 }}>Start</Text><Ionicons name="chevron-forward" size={12} color={T.white} /></Pressable></Link></View>
      </View>
    </View></Card>
  </Pressable>;
}

function SavedSearch({ value, onChangeText, onFilter, activeControls }: { value: string; onChangeText: (text: string) => void; onFilter: () => void; activeControls: boolean }) {
  return <View style={{ height: 56, borderRadius: 28, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 18, paddingRight: 6, boxShadow: `3px 3px 0px ${T.border}` }}><Ionicons name="search" size={20} color={T.dark} /><TextInput value={value} onChangeText={onChangeText} placeholder="Search Quests" placeholderTextColor={T.muted} accessibilityLabel="Search saved quests" style={{ flex: 1, minWidth: 0, color: T.dark, fontFamily: "RubikBold", fontSize: 16, lineHeight: 21, paddingVertical: 0, includeFontPadding: false, textAlignVertical: "center" }} />{value ? <Pressable onPress={() => onChangeText("")} hitSlop={8} style={{ width: 36, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close-circle" size={18} color={T.muted} /></Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel="Sort and filter saved quests" onPress={onFilter} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: activeControls ? `${T.blue}18` : T.bg, transform: [{ scale: pressed ? 0.92 : 1 }] })}><Ionicons name="options-outline" size={21} color={activeControls ? T.blue : T.dark} /></Pressable></View>;
}

function SavedFilterChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => ({ minHeight: 40, borderRadius: 14, borderWidth: 2, borderColor: selected ? T.blue : T.border, backgroundColor: selected ? `${T.blue}0f` : T.white, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, opacity: pressed ? 0.8 : 1 })}><Text style={{ color: selected ? T.blue : T.muted, fontFamily: "RubikBold", fontSize: 12, textAlign: "center" }}>{label}</Text></Pressable>;
}

export function SavedScreen({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { contentWidth, horizontalPadding } = useResponsiveScreenLayout();
  const { loading, quests, toggleSave } = useContent();
  const { userPacks, engine } = useQuestEngine();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("Best Match");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [availableMinutes, setAvailableMinutes] = useState<number | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [openQuest, setOpenQuest] = useState<Quest | null>(null);
  const activeFilterCount = [filters.duration, filters.difficulty].filter(Boolean).length;
  // `Screen` adds horizontal gutters, so use its inner content width. This
  // keeps the first four collection previews in a true 2 × 2 grid.
  const collectionWidth = (contentWidth - horizontalPadding * 2 - 12) / 2;
  const filedQuestIds = useMemo(() => new Set(userPacks.flatMap((pack) => pack.questIds)), [userPacks]);
  const filtered = useMemo(() => {
    let result = quests.filter((quest) => quest.saved && !filedQuestIds.has(quest.id));
    if (search.trim()) { const query = search.toLowerCase(); result = result.filter((quest) => `${quest.title} ${quest.description} ${quest.category}`.toLowerCase().includes(query)); }
    return sortSaved(applyFilters(result, filters), sortBy, availableMinutes);
  }, [availableMinutes, filedQuestIds, filters, quests, search, sortBy]);
  const resetFilters = () => { setSearch(""); setFilters(emptyFilters); setSortBy("Best Match"); setAvailableMinutes(null); };

  return <Screen>
    <Header eyebrow="My Stuff" title="Saved" right={<IconButton icon="chevron-back" onPress={onBack} />} />
    <SavedSearch value={search} onChangeText={setSearch} onFilter={() => setFilterVisible(true)} activeControls={sortBy !== "Best Match" || activeFilterCount > 0} />
    <View style={{ gap: 8 }}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" }}>Best match for your time</Text><View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8 }}>{[[null, "Any time"], [10, "10 min"], [20, "20 min"], [45, "45 min"]].map(([minutes, label]) => { const selected = availableMinutes === minutes; return <Pressable key={label} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => { setAvailableMinutes(minutes as number | null); setSortBy("Best Match"); }} style={({ pressed }) => ({ minHeight: 36, borderRadius: 14, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", backgroundColor: selected ? `${T.blue}18` : T.white, borderWidth: 1.5, borderColor: selected ? T.blue : T.border, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: selected ? T.blue : T.muted, fontFamily: "RubikBold", fontSize: 12 }}>{label}</Text></Pressable>; })}</View></View>
    <View style={{ gap: 13 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20 }}>Collections</Text><Pressable onPress={() => router.push("/quest-collections")} hitSlop={8}><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 13 }}>See all</Text></Pressable></View>
      {userPacks.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16, columnGap: 12 }}>{userPacks.slice(0, 4).map((pack) => <CollectionPreview key={pack.id} pack={pack} width={collectionWidth} onPress={() => router.push(`/collection/${pack.id}`)} />)}</View> : <Card style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${T.blue}16` }}><Ionicons name="bookmarks-outline" size={21} color={T.blue} /></View><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 14 }}>Group quests you want to do</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, marginTop: 3 }}>Create a collection from Saved.</Text></View><Pressable onPress={() => router.push("/quest-collections")}><Ionicons name="add-circle" size={25} color={T.blue} /></Pressable></Card>}
    </View>
    <View style={{ gap: 12 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20 }}>Saved Quests</Text><Pressable onPress={() => router.push("/manage-saved")} hitSlop={8}><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 13 }}>Manage</Text></Pressable></View>
      {loading ? <Card><EmptyState emoji="⏳" title="Loading saved quests" body="Finding the quests you saved." /></Card> : filtered.length ? filtered.map((quest) => <QuestRow key={quest.id} quest={quest} status={engine?.activeSession?.questId === quest.id ? "active" : quest.completed ? "completed" : undefined} onOpen={() => setOpenQuest(quest)} onRemove={() => void toggleSave(quest.id)} />) : <EmptyState emoji={search || activeFilterCount ? "🔍" : "📭"} title={search || activeFilterCount ? "No matches found" : "No unfiled saved quests"} body={search || activeFilterCount ? "Try adjusting your search, filters, or sorting." : "Quests added to a collection live inside that collection."} action={search || activeFilterCount || sortBy !== "Best Match" ? <SoftButton label="Reset all filters" icon="refresh" onPress={resetFilters} /> : <SoftButton label="Explore quests" icon="compass" color={T.blue} onPress={() => router.push("/(tabs)/explore")} />} />}
    </View>
    <Sheet visible={!!openQuest} onClose={() => setOpenQuest(null)}>{openQuest ? <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 14 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23 }}>{openQuest.title}</Text><Text style={{ color: T.muted, fontFamily: "Rubik", lineHeight: 21 }}>{openQuest.description}</Text><Link href={`/quest/${openQuest.id}`} asChild><Pressable><SoftButton label="Start Quest" icon="play" /></Pressable></Link><SoftButton label="Remove from saved" icon="trash-outline" color={T.red} onPress={() => { void toggleSave(openQuest.id); setOpenQuest(null); }} /></View> : null}</Sheet>
    <Sheet visible={filterVisible} onClose={() => setFilterVisible(false)} maxHeight="90%" fillHeight><View style={{ flex: 1 }}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 18, gap: 16 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}><View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}><Ionicons name="options-outline" size={23} color={T.dark} /></View><View style={{ flex: 1, gap: 2 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20 }}>Sort & Filter</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12 }}>Customize your saved quests</Text></View></View><Pressable onPress={() => { setSortBy("Best Match"); setFilters(emptyFilters); }}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12 }}>Reset</Text></Pressable></View><FilterGroup title="Sort by">{savedSortOptions.map((option) => <SavedFilterChoice key={option} label={option} selected={option === sortBy} onPress={() => setSortBy(option)} />)}</FilterGroup><FilterGroup title="Duration"><SavedFilterChoice label="Any duration" selected={!filters.duration} onPress={() => setFilters((prev) => ({ ...prev, duration: null }))} />{[["Under 30min", "Under 30 min"], ["30-60min", "30–60 min"], ["1-2h", "1–2 hours"], ["2h+", "2+ hours"]].map(([value, label]) => <SavedFilterChoice key={value} label={label} selected={filters.duration === value} onPress={() => setFilters((prev) => ({ ...prev, duration: value }))} />)}</FilterGroup><FilterGroup title="Difficulty"><SavedFilterChoice label="Any difficulty" selected={!filters.difficulty} onPress={() => setFilters((prev) => ({ ...prev, difficulty: null }))} />{questDifficulties.map((value) => <SavedFilterChoice key={value} label={value[0] + value.slice(1).toLowerCase()} selected={filters.difficulty === value} onPress={() => setFilters((prev) => ({ ...prev, difficulty: value }))} />)}</FilterGroup></ScrollView><View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.white }}><Pressable onPress={() => setFilterVisible(false)} style={({ pressed }) => ({ minHeight: 58, borderRadius: 20, backgroundColor: T.blue, borderBottomWidth: 6, borderBottomColor: "#258fd8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, transform: [{ translateY: pressed ? 3 : 0 }] })}><Text style={{ color: T.white, fontFamily: "RubikBold", fontSize: 16 }}>Done</Text><Ionicons name="checkmark-circle-outline" size={20} color={T.white} /></Pressable></View></View></Sheet>
  </Screen>;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) { return <View style={{ gap: 9, paddingTop: title === "Sort by" ? 0 : 14, borderTopWidth: title === "Sort by" ? 0 : 1, borderTopColor: T.border }}><Text style={{ color: T.muted, fontFamily: "RubikBold", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8 }}>{title}</Text><View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View></View>; }
