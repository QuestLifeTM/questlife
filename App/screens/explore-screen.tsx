import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { categoryColor, difficultyColor, T } from "@/components/theme";
import { PartyCategoryIcon } from "@/components/party-category-icon";
import { Card, EmptyState, Header, Screen, Sheet, SoftButton, useResponsiveScreenLayout } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { categories, sortOptions } from "@/data/questlife";
import { AdventurePack, Quest, QuestDifficulty, questDifficulties } from "@/types/content";

interface Filters {
  duration: string | null;
  difficulty: QuestDifficulty | null;
}

function sortQuests(list: Quest[], sortBy: string) {
  const order: Record<QuestDifficulty, number> = { EASY: 0, MEDIUM: 1, HARD: 2, FORMIDABLE: 3 };
  const copy = [...list];
  if (sortBy === "Most XP") return copy.sort((a, b) => b.xp - a.xp);
  if (sortBy === "Least XP") return copy.sort((a, b) => a.xp - b.xp);
  if (sortBy === "Easiest") return copy.sort((a, b) => order[a.difficulty] - order[b.difficulty]);
  if (sortBy === "Hardest") return copy.sort((a, b) => order[b.difficulty] - order[a.difficulty]);
  if (sortBy === "Shortest") return copy.sort((a, b) => a.timeMin - b.timeMin);
  if (sortBy === "Longest") return copy.sort((a, b) => b.timeMin - a.timeMin);
  return copy;
}

function SectionHeader({
  icon,
  title,
  right,
  subtitle
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <View style={{ gap: subtitle ? 4 : 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Ionicons name={icon} size={21} color={T.blue} />
          <Text style={{ color: T.dark, fontSize: 21, lineHeight: 28, fontWeight: "900" }}>{title}</Text>
        </View>
        {right}
      </View>
      {subtitle ? <Text style={{ color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "700" }}>{subtitle}</Text> : null}
    </View>
  );
}

function ExploreTag({ label, color, bg, compact = false }: { label: string; color: string; bg: string; compact?: boolean }) {
  return (
    <View style={{ borderRadius: 99, paddingHorizontal: compact ? 10 : 12, paddingVertical: compact ? 4 : 6, backgroundColor: bg, alignSelf: "flex-start" }}>
      <Text style={{ color, fontSize: compact ? 10 : 12, lineHeight: compact ? 15 : 16, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</Text>
    </View>
  );
}

function ExploreIconButton({
  icon,
  onPress,
  color = T.muted,
  bg = T.white,
  badge
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  bg?: string;
  badge?: string | number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: bg,
        borderWidth: 2,
        borderColor: T.border,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `3px 3px 0px ${T.border}`,
        transform: [{ scale: pressed ? 0.92 : 1 }]
      })}
    >
      <Ionicons name={icon} size={16} color={color} />
      {badge !== undefined ? (
        <View style={{ position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: T.cyan, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
          <Text style={{ color: T.white, fontWeight: "900", fontSize: 10 }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ExploreSearch({
  value,
  onChangeText,
  onSort,
  onFilter,
  activeSort,
  activeFilters
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSort: () => void;
  onFilter: () => void;
  activeSort: boolean;
  activeFilters: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      <View
        style={{
          flex: 1,
          height: 48,
          borderRadius: 24,
          borderWidth: 2,
          borderColor: T.border,
          backgroundColor: T.white,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 18,
          boxShadow: `3px 3px 0px ${T.border}`
        }}
      >
        <Ionicons name="search" size={16} color={T.muted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Search Quests"
          placeholderTextColor={T.muted}
          style={{ flex: 1, color: T.dark, fontFamily: "Rubik", fontSize: 15, lineHeight: 20, paddingVertical: 0, includeFontPadding: false, textAlignVertical: "center" }}
        />
      </View>
      <ExploreIconButton icon="swap-vertical" onPress={onSort} color={activeSort ? T.blue : T.muted} bg={activeSort ? `${T.blue}16` : T.white} />
      <ExploreIconButton icon="options-outline" onPress={onFilter} color={activeFilters ? T.cyan : T.muted} bg={activeFilters ? `${T.cyan}16` : T.white} badge={activeFilters || undefined} />
    </View>
  );
}

function MetaPill({ icon, text, color = T.blue }: { icon: keyof typeof Ionicons.glyphMap; text: string; color?: string }) {
  return (
    <View style={{ borderRadius: 99, backgroundColor: `${color}14`, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5 }}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={{ color, fontSize: 12, lineHeight: 16, fontWeight: "900" }}>{text}</Text>
    </View>
  );
}

function FeaturedQuestCard({ quest, width, onSave }: { quest: Quest; width: number; onSave: () => void }) {
  const cat = categoryColor[quest.category] ?? { text: quest.color, bg: `${quest.color}18` };
  const diff = difficultyColor[quest.difficulty];

  return (
    <Link href={`/quest/${quest.id}`} asChild>
      <Pressable style={({ pressed }) => ({ width, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
        <Card style={{ height: 216, borderRadius: 32, borderWidth: 1.875, padding: 0, overflow: "hidden", boxShadow: `4px 4px 0px ${T.border}` }}>
          <View
            style={{
              height: 96,
              paddingHorizontal: 20,
              paddingTop: 20,
              gap: 12,
              backgroundColor: `${quest.color}12`,
              borderBottomWidth: 1,
              borderBottomColor: `${quest.color}20`
            }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              <ExploreTag compact label={quest.category} color={cat.text} bg={cat.bg} />
              <ExploreTag compact label={quest.difficulty} color={diff.text} bg={diff.bg} />
            </View>
            <Text style={{ color: T.dark, fontSize: 19, lineHeight: 24, fontWeight: "900" }} numberOfLines={1}>
              {quest.title}
            </Text>
          </View>

          <View style={{ height: 116, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
            <Text style={{ color: T.muted, fontSize: 13, lineHeight: 18, fontWeight: "700" }} numberOfLines={2}>
              {quest.description}
            </Text>

            <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <MetaPill icon="flash" text={`+${quest.xp}`} />
                <MetaPill icon="time" text={quest.timeLabel} color={T.dark} />
              </View>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  onSave();
                }}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: T.border, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name={quest.saved ? "bookmark" : "bookmark-outline"} size={15} color={quest.saved ? T.blue : T.muted} />
              </Pressable>
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

function FeaturedTodaySection({
  featured,
  sideGap,
  width,
  onSave
}: {
  featured: Quest[];
  sideGap: number;
  width: number;
  onSave: (id: string) => void;
}) {
  const cardWidth = Math.min(306, width - sideGap * 2);
  const cardGap = 12;

  return (
    <View style={{ height: 305, gap: 0 }}>
      <View style={{ height: 47, paddingHorizontal: sideGap, paddingTop: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="sparkles-outline" size={18} color={T.blue} />
          <Text style={{ color: T.dark, fontSize: 18, lineHeight: 27, fontWeight: "900" }}>Featured Today</Text>
        </View>
        <Text style={{ color: T.muted, fontSize: 12, lineHeight: 18, fontWeight: "800", marginTop: 4 }}>1 / {featured.length}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: sideGap, paddingRight: sideGap, gap: cardGap, paddingTop: 16, paddingBottom: 8 }}
        snapToInterval={cardWidth + cardGap}
        decelerationRate="fast"
      >
        {featured.map((quest) => (
          <FeaturedQuestCard key={quest.id} quest={quest} width={cardWidth} onSave={() => onSave(quest.id)} />
        ))}
      </ScrollView>

      <View style={{ height: 19, flexDirection: "row", alignSelf: "center", alignItems: "flex-end", gap: 6 }}>
        {featured.map((quest, index) => (
          <View key={quest.id} style={{ width: index === 0 ? 20 : 7, height: 7, borderRadius: 99, backgroundColor: index === 0 ? T.blue : T.border }} />
        ))}
      </View>
    </View>
  );
}

function AdventurePackCard({ pack }: { pack: AdventurePack }) {
  return (
    <Link href={`/adventure-pack/${pack.id}`} asChild>
      <Pressable style={({ pressed }) => ({ width: 285, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
        <Card style={{ height: 194, borderRadius: 24, padding: 0, overflow: "hidden", boxShadow: `4px 4px 0px ${T.border}` }}>
          <View style={{ height: 94, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, backgroundColor: pack.bgColor, borderBottomWidth: 1, borderBottomColor: T.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <ExploreTag label={`${pack.questCount} Quests`} color={pack.color} bg={`${pack.color}18`} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="time-outline" size={11} color={T.muted} />
                <Text style={{ color: T.muted, fontSize: 13, fontWeight: "800" }}>{pack.timeRange}</Text>
              </View>
            </View>
            <Text style={{ color: T.dark, fontSize: 21, lineHeight: 27, fontWeight: "900", marginTop: 8 }} numberOfLines={1}>{pack.icon} {pack.title}</Text>
          </View>
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16, gap: 10 }}>
            <Text style={{ color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "700" }} numberOfLines={2}>
              {pack.subtitle}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <MetaPill icon="flash" text={`${pack.questCount} steps`} color={pack.color} />
              <View style={{ borderRadius: 99, backgroundColor: `${pack.color}14`, paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", gap: 5, alignItems: "center" }}>
                <Text style={{ color: pack.color, fontSize: 13, fontWeight: "900" }}>Open</Text>
                <Ionicons name="chevron-forward" size={11} color={pack.color} />
              </View>
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

function QuestFeedCard({ quest, onSave }: { quest: Quest; onSave: () => void }) {
  const cat = categoryColor[quest.category] ?? { text: quest.color, bg: `${quest.color}18` };
  const diff = difficultyColor[quest.difficulty];

  return (
    <Link href={`/quest/${quest.id}`} asChild>
      <Pressable style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.99 : 1 }] })}>
        <Card style={{ width: "100%", minHeight: quest.description.length > 84 ? 198 : 172, borderRadius: 24, padding: 0, overflow: "hidden", boxShadow: `4px 4px 0px ${T.border}` }}>
          <View style={{ flexDirection: "row", flex: 1 }}>
            <View style={{ width: 5, backgroundColor: quest.color }} />
            <View style={{ flex: 1, padding: 16, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <ExploreTag label={quest.category} color={cat.text} bg={cat.bg} />
                  <ExploreTag label={quest.difficulty} color={diff.text} bg={diff.bg} />
                </View>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onSave();
                  }}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: quest.saved ? `${T.blue}18` : T.bg, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name={quest.saved ? "bookmark" : "bookmark-outline"} size={16} color={quest.saved ? T.blue : T.muted} />
                </Pressable>
              </View>
              <Text style={{ color: T.dark, fontSize: 18, lineHeight: 23, fontWeight: "900" }} numberOfLines={2}>{quest.title}</Text>
              <Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }} numberOfLines={2}>
                {quest.description}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 2 }}>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", flex: 1 }}>
                  <MetaPill icon="flash" text={`+${quest.xp} XP`} />
                  <MetaPill icon="time" text={quest.timeLabel} color={T.dark} />
                </View>
                <View style={{ minWidth: 74, minHeight: 30, borderRadius: 16, backgroundColor: T.blue, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 12 }}>
                  <Text style={{ color: T.white, fontSize: 13, fontWeight: "900" }}>Start</Text>
                  <Ionicons name="chevron-forward" size={12} color={T.white} />
                </View>
              </View>
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

export function ExploreScreen() {
  const router = useRouter();
  const { contentWidth, horizontalPadding: sideGap, safeAreaOffset } = useResponsiveScreenLayout();
  const { adventurePacks, error, loading, quests, refresh, toggleSave } = useContent();
  const { featuredQuestIds } = useQuestEngine();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("Best Match");
  const [filters, setFilters] = useState<Filters>({ duration: null, difficulty: null });
  const [sortVisible, setSortVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const feedCardWidth = contentWidth - sideGap * 2;

  const activeFilters = [filters.duration, filters.difficulty].filter(Boolean).length;
  const feed = useMemo(() => {
    let result = quests.filter((quest) => {
      const query = search.trim().toLowerCase();
      if (query && !`${quest.title} ${quest.description} ${quest.category}`.toLowerCase().includes(query)) return false;
      if (category !== "All" && quest.category !== category) return false;
      if (filters.difficulty && quest.difficulty !== filters.difficulty) return false;
      if (filters.duration === "Under 30min" && quest.timeMin >= 30) return false;
      if (filters.duration === "30-60min" && (quest.timeMin < 30 || quest.timeMin > 60)) return false;
      if (filters.duration === "1-2h" && (quest.timeMin < 60 || quest.timeMin > 120)) return false;
      if (filters.duration === "2h+" && quest.timeMin <= 120) return false;
      return true;
    });
    return sortQuests(result, sortBy);
  }, [category, filters, quests, search, sortBy]);

  const featured = useMemo(() => {
    if (featuredQuestIds.length) {
      return featuredQuestIds.map((id) => quests.find((q) => q.id === id)).filter(Boolean) as Quest[];
    }
    return quests.filter((quest) => quest.featured).slice(0, 6);
  }, [featuredQuestIds, quests]);
  const showDiscoverySections = !search && category === "All" && activeFilters === 0;
  const reset = () => {
    setSearch("");
    setCategory("All");
    setSortBy("Best Match");
    setFilters({ duration: null, difficulty: null });
  };

  return (
    <Screen padded={false} contentStyle={{ alignItems: "center", gap: 0 }}>
      <View style={{ width: contentWidth, paddingHorizontal: sideGap, gap: 16, transform: [{ translateX: safeAreaOffset }] }}>
        <Header title="Explore" subtitle="Find your next adventure" right={<ExploreIconButton icon="folder-open-outline" onPress={() => router.push("/saved")} />} animated={false} />

        <ExploreSearch
          value={search}
          onChangeText={setSearch}
          onSort={() => setSortVisible(true)}
          onFilter={() => setFilterVisible(true)}
          activeSort={sortBy !== "Best Match"}
          activeFilters={activeFilters}
        />
      </View>

      {showDiscoverySections ? (
        <View style={{ width: contentWidth, gap: 13, marginTop: 20, transform: [{ translateX: safeAreaOffset }] }}>
          {featured.length ? (
            <FeaturedTodaySection featured={featured} sideGap={sideGap} width={contentWidth} onSave={toggleSave} />
          ) : null}

          {adventurePacks.length ? (
          <View style={{ gap: 12 }}>
            <View style={{ paddingHorizontal: sideGap }}>
              <SectionHeader
                icon="add-circle"
                title="Adventure Packs"
                subtitle="Dedicated groups of quests for a bigger outing"
                right={
                  <Pressable onPress={() => router.push("/pack-library")}>
                    <Text style={{ color: T.cyan, fontSize: 13, fontWeight: "900" }}>See More</Text>
                  </Pressable>
                }
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: sideGap, gap: 12, paddingBottom: 8 }}>
              {adventurePacks.map((pack) => (
                <AdventurePackCard key={pack.id} pack={pack} />
              ))}
            </ScrollView>
          </View>
          ) : null}
        </View>
      ) : null}

      <View style={{ width: contentWidth, gap: 14, marginTop: showDiscoverySections ? 11 : 20, paddingHorizontal: sideGap, transform: [{ translateX: safeAreaOffset }] }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 0, paddingBottom: 4 }}>
          {categories.map((item) => {
            const active = category === item;
            const tone = item === "All" ? null : categoryColor[item];
            return (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={{
                  borderRadius: 99,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  backgroundColor: active ? tone?.text ?? T.dark : tone?.bg ?? T.white,
                  borderWidth: 2,
                  borderColor: active ? tone?.text ?? T.dark : tone?.bg ?? T.border,
                  boxShadow: active ? "none" : `2px 2px 0px ${T.border}`
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {item === "All" ? <Ionicons name="apps" size={15} color={active ? T.white : T.muted} /> : <PartyCategoryIcon category={item} size={16} color={active ? T.white : tone?.text} />}
                  <Text style={{ color: active ? T.white : tone?.text ?? T.muted, fontWeight: "900", fontSize: 13 }}>{item}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ gap: 12, paddingHorizontal: 0, alignItems: "center" }}>
          <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: T.dark, fontSize: 21, lineHeight: 28, fontWeight: "900" }}>{category === "All" ? "All Quests" : category}</Text>
            <Text style={{ color: T.muted, fontWeight: "800", fontSize: 13 }}>{feed.length} quests</Text>
          </View>
          {loading ? (
            <Card style={{ borderRadius: 24 }}>
              <EmptyState emoji="⏳" title="Loading quests" body="Pulling the latest published quests from QuestLife." />
            </Card>
          ) : error ? (
            <Card style={{ borderRadius: 24 }}>
              <EmptyState emoji="!" title="Could not load quests" body={error} action={<SoftButton label="Try again" icon="refresh" onPress={refresh} />} />
            </Card>
          ) : feed.length ? feed.map((quest) => (
            <View key={quest.id} style={{ width: feedCardWidth }}>
              <QuestFeedCard quest={quest} onSave={() => toggleSave(quest.id)} />
            </View>
          )) : (
            <Card style={{ borderRadius: 24 }}>
              <EmptyState emoji="🔍" title="No quests found" body="Create and publish quests in the admin dashboard, or adjust your filters." action={<SoftButton label="Reset all filters" icon="refresh" onPress={reset} />} />
            </Card>
          )}
        </View>
      </View>

      <Sheet visible={sortVisible} onClose={() => setSortVisible(false)}>
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900", marginBottom: 10 }}>Sort by</Text>
          {sortOptions.map((option) => (
            <Pressable key={option} onPress={() => { setSortBy(option); setSortVisible(false); }} style={{ minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: option === sortBy ? T.blue : T.dark, fontWeight: option === sortBy ? "900" : "700", fontSize: 16 }}>{option}</Text>
              {option === sortBy ? <Ionicons name="checkmark-circle" size={22} color={T.blue} /> : null}
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet visible={filterVisible} onClose={() => setFilterVisible(false)}>
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 18 }}>
          <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900" }}>Filters</Text>
          <View style={{ gap: 9 }}>
            <Text style={{ color: T.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8 }}>Duration</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {["Under 30min", "30-60min", "1-2h", "2h+"].map((duration) => (
                <Pressable key={duration} onPress={() => setFilters((prev) => ({ ...prev, duration: prev.duration === duration ? null : duration }))} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 99, backgroundColor: filters.duration === duration ? `${T.cyan}22` : T.white, borderWidth: 2, borderColor: filters.duration === duration ? T.cyan : T.border }}>
                  <Text style={{ color: filters.duration === duration ? T.cyan : T.muted, fontWeight: "900" }}>{duration}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ gap: 9 }}>
            <Text style={{ color: T.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8 }}>Difficulty</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {questDifficulties.map((difficulty) => (
                <Pressable key={difficulty} onPress={() => setFilters((prev) => ({ ...prev, difficulty: prev.difficulty === difficulty ? null : difficulty }))} style={{ flex: 1, paddingVertical: 11, alignItems: "center", borderRadius: 99, backgroundColor: filters.difficulty === difficulty ? `${T.blue}22` : T.white, borderWidth: 2, borderColor: filters.difficulty === difficulty ? T.blue : T.border }}>
                  <Text style={{ color: filters.difficulty === difficulty ? T.blue : T.muted, fontWeight: "900" }}>{difficulty}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SoftButton label="Reset" inverse color={T.muted} onPress={() => setFilters({ duration: null, difficulty: null })} style={{ flex: 1 }} />
            <SoftButton label="Apply" onPress={() => setFilterVisible(false)} style={{ flex: 1 }} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}
