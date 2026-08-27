import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { categoryColor, difficultyColor, T } from "@/components/theme";
import { CollectionGridSkeleton, SavedQuestListSkeleton } from "@/components/collection-loading-skeleton";
import { Card, EmptyState, Header, IconButton, Screen, Sheet, SoftButton, Tag, useResponsiveScreenLayout } from "@/components/ui";
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
  const [cardPressed, setCardPressed] = useState(false);
  const [moreInfoPressed, setMoreInfoPressed] = useState(false);
  return <Pressable onPress={onOpen} onPressIn={() => setCardPressed(true)} onPressOut={() => setCardPressed(false)} style={{ transform: [{ scale: cardPressed ? 0.99 : 1 }] }}>
    <Card style={{ width: "100%", minHeight: quest.description.length > 84 ? 190 : 166, borderRadius: 24, padding: 0, overflow: "hidden", boxShadow: `4px 4px 0px ${T.border}` }}><View style={{ flexDirection: "row", flex: 1 }}>
      <View style={{ width: 5, backgroundColor: quest.color }} />
      <View style={{ flex: 1, padding: 16, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}><View style={{ flex: 1, flexDirection: "row", gap: 6, flexWrap: "wrap" }}><Tag label={quest.category} color={cat.text} bg={cat.bg} /><Tag label={quest.difficulty} color={diff.text} bg={diff.bg} />{status === "active" ? <Tag label="ACTIVE NOW" color={T.purple} bg={`${T.purple}18`} /> : null}</View><Pressable onPress={onRemove} accessibilityLabel={`Unsave ${quest.title}`} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${T.blue}1f`, alignItems: "center", justifyContent: "center" }}><Ionicons name="bookmark" size={15} color={T.blue} /></Pressable></View>
        <Text style={{ color: T.dark, fontSize: 18, lineHeight: 23, fontWeight: "900" }} numberOfLines={2}>{quest.title}</Text>
        <Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }} numberOfLines={2}>{quest.description}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 2 }}><View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", flex: 1 }}><View style={{ borderRadius: 99, backgroundColor: `${T.blue}14`, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5 }}><Ionicons name="flash" size={12} color={T.blue} /><Text style={{ color: T.blue, fontSize: 12, lineHeight: 16, fontWeight: "900" }}>+{quest.xp} XP</Text></View><View style={{ borderRadius: 99, backgroundColor: `${T.dark}14`, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5 }}><Ionicons name="time" size={12} color={T.dark} /><Text style={{ color: T.dark, fontSize: 12, lineHeight: 16, fontWeight: "900" }}>{quest.timeLabel}</Text></View></View><Link href={`/quest/${quest.id}`} asChild><Pressable onPressIn={() => setMoreInfoPressed(true)} onPressOut={() => setMoreInfoPressed(false)} style={{ minWidth: 74, minHeight: 36, borderRadius: 22, backgroundColor: T.blue, borderBottomWidth: moreInfoPressed ? 1 : 4, borderBottomColor: "#258fd8", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, transform: [{ translateY: moreInfoPressed ? 3 : 0 }] }}><Text style={{ color: T.white, fontFamily: "RubikBlack", fontSize: 13, letterSpacing: 0.55 }}>MORE INFO</Text></Pressable></Link></View>
      </View>
    </View></Card>
  </Pressable>;
}

function SavedSearch({ value, onChangeText, onFilter, activeControls }: { value: string; onChangeText: (text: string) => void; onFilter: () => void; activeControls: boolean }) {
  return <View style={{ height: 56, borderRadius: 28, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 18, paddingRight: 6, boxShadow: `3px 3px 0px ${T.border}` }}><Ionicons name="search" size={20} color={T.dark} /><TextInput value={value} onChangeText={onChangeText} placeholder="Search Quests" placeholderTextColor={T.muted} accessibilityLabel="Search saved quests" style={{ flex: 1, minWidth: 0, color: T.dark, fontFamily: "RubikBold", fontSize: 16, lineHeight: 21, paddingVertical: 0, includeFontPadding: false, textAlignVertical: "center" }} />{value ? <Pressable onPress={() => onChangeText("")} hitSlop={8} style={{ width: 36, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close-circle" size={18} color={T.muted} /></Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel="Sort and filter saved quests" onPress={onFilter} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: activeControls ? `${T.blue}18` : T.bg, transform: [{ scale: pressed ? 0.92 : 1 }] })}><Ionicons name="options-outline" size={21} color={activeControls ? T.blue : T.dark} /></Pressable></View>;
}

const savedCompactSortOptions = [
  { value: "Best Match", label: "Recommended", icon: "star-outline" as const },
  { value: "Most XP", label: "Highest XP", icon: "xp" as const },
  { value: "Shortest", label: "Shortest", icon: "time-outline" as const },
  { value: "Recently saved", label: "Newest", icon: "sparkles-outline" as const },
];

function SavedSortOptionIcon({ icon, color }: { icon: (typeof savedCompactSortOptions)[number]["icon"]; color: string }) {
  if (icon === "xp") return <View style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}><Svg width={26} height={26} viewBox="0 0 32 32" fill="none"><Path d="M16 2.5L27.5 9.25V22.75L16 29.5L4.5 22.75V9.25L16 2.5Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" /></Svg><Text style={{ position: "absolute", color, fontSize: 7, fontWeight: "900" }}>XP</Text></View>;
  return <Ionicons name={icon} size={24} color={color} />;
}

function SavedFilterChoice({ label, selected, icon, onPress }: { label: string; selected: boolean; icon: React.ReactNode; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => ({ width: "30%", minHeight: 42, borderRadius: 22, borderWidth: 2, borderColor: selected ? T.blue : T.border, backgroundColor: selected ? `${T.blue}0f` : T.white, borderBottomWidth: selected ? 4 : 2, borderBottomColor: selected ? `${T.blue}88` : T.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 4, opacity: pressed ? 0.82 : 1 })}><View style={{ opacity: selected ? 1 : 0.88 }}>{icon}</View><Text style={{ color: selected ? T.blue : T.muted, fontSize: 12, fontWeight: "800", textAlign: "center" }} numberOfLines={1}>{label}</Text></Pressable>;
}

function SavedQuestFiltersSheet({ visible, sortBy, filters, onClose, onSortChange, onFiltersChange }: { visible: boolean; sortBy: string; filters: Filters; onClose: () => void; onSortChange: (value: string) => void; onFiltersChange: (update: Filters | ((current: Filters) => Filters)) => void }) {
  const reset = () => { onSortChange("Best Match"); onFiltersChange(emptyFilters); };
  const durationOptions = [[null, "Any"], ["Under 30min", "< 30m"], ["30-60min", "30–60m"], ["1-2h", "1–2h"], ["2h+", "2h+"]] as const;
  return <Sheet visible={visible} onClose={onClose} maxHeight="90%"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 18 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}><View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}><Ionicons name="options-outline" size={23} color={T.dark} /></View><View style={{ flex: 1, gap: 2 }}><Text style={{ color: T.dark, fontSize: 20, lineHeight: 24, fontWeight: "900" }}>Sort & Filter</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 16, fontWeight: "700" }}>Customize your saved quests</Text></View></View><Pressable accessibilityRole="button" accessibilityLabel="Reset sort and filters" hitSlop={6} onPress={reset} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.72 : 1 })}><Ionicons name="reload-outline" size={17} color={T.muted} /><Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>Reset</Text></Pressable></View><View style={{ gap: 10 }}><Text style={{ color: T.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8 }}>Sort by</Text><View accessibilityRole="radiogroup" style={{ height: 86, flexDirection: "row", borderWidth: 1.5, borderColor: T.border, borderRadius: 18, overflow: "hidden" }}>{savedCompactSortOptions.map((option) => { const selected = option.value === sortBy; const color = selected ? T.blue : T.muted; return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onSortChange(option.value)} style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: selected ? `${T.blue}0f` : T.white, opacity: pressed ? 0.8 : 1 })}><SavedSortOptionIcon icon={option.icon} color={color} /><Text style={{ color, fontSize: 11, lineHeight: 14, fontWeight: "800", textAlign: "center" }} numberOfLines={1}>{option.label}</Text></Pressable>; })}</View></View><View style={{ height: 1, backgroundColor: T.border }} /><View style={{ gap: 10 }}><Text style={{ color: T.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8 }}>Duration</Text><View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{durationOptions.map(([value, label]) => <SavedFilterChoice key={label} label={label} icon={<Ionicons name="time-outline" size={18} color={filters.duration === value ? T.blue : T.muted} />} selected={filters.duration === value} onPress={() => onFiltersChange((current) => ({ ...current, duration: value }))} />)}</View></View><View style={{ height: 1, backgroundColor: T.border }} /><View style={{ gap: 10 }}><Text style={{ color: T.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8 }}>Difficulty</Text><View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}><SavedFilterChoice label="Any" icon={<Ionicons name="speedometer-outline" size={18} color={!filters.difficulty ? T.blue : T.muted} />} selected={!filters.difficulty} onPress={() => onFiltersChange((current) => ({ ...current, difficulty: null }))} />{questDifficulties.map((value) => <SavedFilterChoice key={value} label={`${value.charAt(0)}${value.slice(1).toLowerCase()}`} icon={<Ionicons name="speedometer-outline" size={18} color={filters.difficulty === value ? T.blue : T.muted} />} selected={filters.difficulty === value} onPress={() => onFiltersChange((current) => ({ ...current, difficulty: value }))} />)}</View></View><Pressable accessibilityRole="button" accessibilityLabel="Apply sort and filters" onPress={onClose} style={({ pressed }) => ({ minHeight: 58, marginTop: 2, borderRadius: 20, backgroundColor: T.blue, borderBottomWidth: 6, borderBottomColor: "#258fd8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: pressed ? 0.9 : 1, transform: [{ translateY: pressed ? 3 : 0 }] })}><Text style={{ color: T.white, fontFamily: "RubikBold", fontSize: 16, letterSpacing: 0.35 }}>Done</Text><Ionicons name="checkmark-circle-outline" size={20} color={T.white} /></Pressable></ScrollView></Sheet>;
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
    <View style={{ gap: 13 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20 }}>Collections</Text>{userPacks.length > 4 ? <Pressable onPress={() => router.push("/quest-collections")} hitSlop={8}><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 13 }}>See all</Text></Pressable> : null}</View>
      {loading ? <CollectionGridSkeleton cardWidth={collectionWidth} /> : userPacks.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16, columnGap: 12 }}>{userPacks.slice(0, 4).map((pack) => <CollectionPreview key={pack.id} pack={pack} width={collectionWidth} onPress={() => router.push(`/collection/${pack.id}`)} />)}</View> : <Card style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${T.blue}16` }}><Ionicons name="bookmarks-outline" size={21} color={T.blue} /></View><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 14 }}>Group quests you want to do</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, marginTop: 3 }}>Create a collection from Saved.</Text></View><Pressable onPress={() => router.push("/quest-collections")}><Ionicons name="add-circle" size={25} color={T.blue} /></Pressable></Card>}
    </View>
    <View style={{ gap: 12 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20 }}>Saved Quests</Text><Pressable onPress={() => router.push("/manage-saved")} hitSlop={8}><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 13 }}>Manage</Text></Pressable></View>
      {loading ? <SavedQuestListSkeleton /> : filtered.length ? filtered.map((quest) => <QuestRow key={quest.id} quest={quest} status={engine?.activeSession?.questId === quest.id ? "active" : quest.completed ? "completed" : undefined} onOpen={() => router.push(`/quest/${quest.id}`)} onRemove={() => void toggleSave(quest.id)} />) : <EmptyState framed emoji={search || activeFilterCount ? "🔍" : "📭"} title={search || activeFilterCount ? "No matches found" : "No unfiled saved quests"} body={search || activeFilterCount ? "Try adjusting your search, filters, or sorting." : "Quests added to a collection live inside that collection."} action={search || activeFilterCount || sortBy !== "Best Match" ? <SoftButton label="Reset all filters" icon="refresh" onPress={resetFilters} /> : <SoftButton label="Explore quests" icon="compass" color={T.blue} onPress={() => router.push("/(tabs)/explore")} />} />}
    </View>
    <SavedQuestFiltersSheet visible={filterVisible} sortBy={sortBy} filters={filters} onClose={() => setFilterVisible(false)} onSortChange={setSortBy} onFiltersChange={setFilters} />
  </Screen>;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) { return <View style={{ gap: 9, paddingTop: title === "Sort by" ? 0 : 14, borderTopWidth: title === "Sort by" ? 0 : 1, borderTopColor: T.border }}><Text style={{ color: T.muted, fontFamily: "RubikBold", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8 }}>{title}</Text><View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View></View>; }
