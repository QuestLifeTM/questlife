import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { categoryColor, difficultyColor, T } from "@/components/theme";
import { PartyCategoryIcon } from "@/components/party-category-icon";
import { Card, EmptyState, Header, Screen, Sheet, SoftButton, haptic, useResponsiveScreenLayout } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useQuestSave } from "@/contexts/QuestSaveContext";
import { categories } from "@/data/questlife";
import { AdventurePack, Quest, QuestDifficulty, questDifficulties } from "@/types/content";

interface Filters {
  duration: string | null;
  difficulty: QuestDifficulty | null;
}

function sortQuests(list: Quest[], sortBy: string) {
  const copy = [...list];
  if (sortBy === "Most XP") return copy.sort((a, b) => b.xp - a.xp);
  if (sortBy === "Shortest") return copy.sort((a, b) => a.timeMin - b.timeMin);
  if (sortBy === "Newest") return copy.sort((a, b) => publishedTime(b) - publishedTime(a));
  return copy;
}

function publishedTime(quest: Quest) {
  const timestamp = Date.parse(quest.publishedAt ?? quest.createdAt ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
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
  onFilter,
  activeControls,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onFilter: () => void;
  activeControls: boolean;
}) {
  return (
    <View
      style={{
        height: 56,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: T.border,
        backgroundColor: T.white,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingLeft: 18,
        paddingRight: 6,
        boxShadow: `3px 3px 0px ${T.border}`,
      }}
    >
      <Ionicons name="search" size={20} color={T.dark} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search Quests"
        placeholderTextColor={T.muted}
        accessibilityLabel="Search quests"
        style={{
          flex: 1,
          minWidth: 0,
          color: T.dark,
          fontFamily: "RubikBold",
          fontSize: 16,
          lineHeight: 21,
          letterSpacing: 0,
          paddingVertical: 0,
          includeFontPadding: false,
          textAlignVertical: "center",
        }}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear quest search" hitSlop={8} onPress={() => onChangeText("")} style={{ width: 36, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="close-circle" size={18} color={T.muted} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sort and filter quests"
        onPress={onFilter}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: activeControls ? `${T.blue}18` : T.bg,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        })}
      >
        <Ionicons name="options-outline" size={21} color={activeControls ? T.blue : T.dark} />
      </Pressable>
    </View>
  );
}

const compactSortOptions = [
  { value: "Best Match", label: "Recommended", icon: "star-outline" as const },
  { value: "Most XP", label: "Highest XP", icon: "xp" as const },
  { value: "Shortest", label: "Shortest", icon: "time-outline" as const },
  { value: "Newest", label: "Newest", icon: "sparkles-outline" as const },
];

function SortOptionIcon({ icon, color }: { icon: (typeof compactSortOptions)[number]["icon"]; color: string }) {
  if (icon === "xp") {
    return (
      <View style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}>
        <Svg width={26} height={26} viewBox="0 0 32 32" fill="none">
          <Path d="M16 2.5L27.5 9.25V22.75L16 29.5L4.5 22.75V9.25L16 2.5Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
        </Svg>
        <Text style={{ position: "absolute", color, fontSize: 7, fontWeight: "900" }}>XP</Text>
      </View>
    );
  }

  return <Ionicons name={icon} size={24} color={color} />;
}

function FilterChoice({
  label,
  selected,
  color = T.blue,
  icon,
  onPress,
}: {
  label: string;
  selected: boolean;
  color?: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const foreground = selected ? color : T.muted;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: "30%",
        minHeight: 54,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: selected ? color : T.border,
        backgroundColor: selected ? `${color}0f` : T.white,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        paddingHorizontal: 4,
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <View style={{ opacity: selected ? 1 : 0.88 }}>{icon}</View>
      <Text style={{ color: foreground, fontSize: 12, fontWeight: "800", textAlign: "center" }} numberOfLines={1}>{label}</Text>
    </Pressable>
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
  const { userPacks } = useQuestEngine();
  const savedAnywhere = quest.saved || userPacks.some((pack) => pack.questIds.includes(quest.id));

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
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: savedAnywhere ? `${T.blue}18` : T.border, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name={savedAnywhere ? "bookmark" : "bookmark-outline"} size={15} color={savedAnywhere ? T.blue : T.muted} />
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
  const { userPacks } = useQuestEngine();
  const savedAnywhere = quest.saved || userPacks.some((pack) => pack.questIds.includes(quest.id));

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
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: savedAnywhere ? `${T.blue}18` : T.bg, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name={savedAnywhere ? "bookmark" : "bookmark-outline"} size={16} color={savedAnywhere ? T.blue : T.muted} />
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
  const { adventurePacks, error, loading, quests, refresh } = useContent();
  const { featuredQuestIds } = useQuestEngine();
  const { openQuestSave } = useQuestSave();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("Best Match");
  const [filters, setFilters] = useState<Filters>({ duration: null, difficulty: null });
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
          onFilter={() => setFilterVisible(true)}
          activeControls={sortBy !== "Best Match" || activeFilters > 0}
        />
      </View>

      {showDiscoverySections ? (
        <View style={{ width: contentWidth, gap: 13, marginTop: 20, transform: [{ translateX: safeAreaOffset }] }}>
          {featured.length ? (
            <FeaturedTodaySection featured={featured} sideGap={sideGap} width={contentWidth} onSave={openQuestSave} />
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -sideGap }} contentContainerStyle={{ gap: 8, paddingHorizontal: sideGap, paddingBottom: 4 }}>
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
              <QuestFeedCard quest={quest} onSave={() => openQuestSave(quest.id)} />
            </View>
          )) : (
            <Card style={{ borderRadius: 24 }}>
              <EmptyState emoji="🔍" title="No quests found" body="Create and publish quests in the admin dashboard, or adjust your filters." action={<SoftButton label="Reset all filters" icon="refresh" onPress={reset} />} />
            </Card>
          )}
        </View>
      </View>

      <Sheet visible={filterVisible} onClose={() => setFilterVisible(false)} maxHeight="90%">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="options-outline" size={23} color={T.dark} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: T.dark, fontSize: 20, lineHeight: 24, fontWeight: "900" }}>Sort & Filter</Text>
                <Text style={{ color: T.muted, fontSize: 12, lineHeight: 16, fontWeight: "700" }}>Customize how you see quests</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Reset sort and filters" hitSlop={6} onPress={() => { setSortBy("Best Match"); setFilters({ duration: null, difficulty: null }); }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.72 : 1 })}>
              <Ionicons name="reload-outline" size={17} color={T.muted} />
              <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>Reset</Text>
            </Pressable>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ color: T.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8 }}>Sort by</Text>
            <View accessibilityRole="radiogroup" style={{ height: 104, flexDirection: "row", borderWidth: 1.5, borderColor: T.border, borderRadius: 18, overflow: "hidden" }}>
              {compactSortOptions.map((option) => {
                const selected = option.value === sortBy;
                const color = selected ? T.blue : T.muted;
                return (
                  <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setSortBy(option.value)} style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: selected ? `${T.blue}0f` : T.white, opacity: pressed ? 0.8 : 1 })}>
                    <SortOptionIcon icon={option.icon} color={color} />
                    <Text style={{ color, fontSize: 11, lineHeight: 14, fontWeight: "800", textAlign: "center" }} numberOfLines={1}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: T.border }} />

          <View style={{ gap: 10 }}>
            <Text style={{ color: T.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8 }}>Duration</Text>
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <FilterChoice label="Any" selected={!filters.duration} color={T.blue} icon={<Ionicons name="time-outline" size={18} color={!filters.duration ? T.blue : T.muted} />} onPress={() => setFilters((prev) => ({ ...prev, duration: null }))} />
              <FilterChoice label="< 30m" selected={filters.duration === "Under 30min"} icon={<Ionicons name="time-outline" size={18} color={filters.duration === "Under 30min" ? T.blue : T.muted} />} onPress={() => setFilters((prev) => ({ ...prev, duration: "Under 30min" }))} />
              <FilterChoice label="30–60m" selected={filters.duration === "30-60min"} icon={<Ionicons name="time-outline" size={18} color={filters.duration === "30-60min" ? T.blue : T.muted} />} onPress={() => setFilters((prev) => ({ ...prev, duration: "30-60min" }))} />
              <FilterChoice label="1–2h" selected={filters.duration === "1-2h"} icon={<Ionicons name="time-outline" size={18} color={filters.duration === "1-2h" ? T.blue : T.muted} />} onPress={() => setFilters((prev) => ({ ...prev, duration: "1-2h" }))} />
              <FilterChoice label="2h+" selected={filters.duration === "2h+"} icon={<Ionicons name="time-outline" size={18} color={filters.duration === "2h+" ? T.blue : T.muted} />} onPress={() => setFilters((prev) => ({ ...prev, duration: "2h+" }))} />
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: T.border }} />

          <View style={{ gap: 10 }}>
            <Text style={{ color: T.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8 }}>Difficulty</Text>
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <FilterChoice label="Any" selected={!filters.difficulty} color={T.blue} icon={<PartyCategoryIcon category="ADVENTURE" size={18} color={!filters.difficulty ? T.blue : T.muted} />} onPress={() => setFilters((prev) => ({ ...prev, difficulty: null }))} />
              {questDifficulties.map((difficulty) => {
                const tone = difficultyColor[difficulty];
                return <FilterChoice key={difficulty} label={`${difficulty.charAt(0)}${difficulty.slice(1).toLowerCase()}`} selected={filters.difficulty === difficulty} color={tone.text} icon={<PartyCategoryIcon category="ADVENTURE" size={18} color={filters.difficulty === difficulty ? tone.text : T.muted} />} onPress={() => setFilters((prev) => ({ ...prev, difficulty }))} />;
              })}
            </View>
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="Apply sort and filters" onPress={() => { haptic(); setFilterVisible(false); }} style={({ pressed }) => ({ minHeight: 58, marginTop: 2, borderRadius: 20, backgroundColor: T.blue, borderBottomWidth: 6, borderBottomColor: "#258fd8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: pressed ? 0.9 : 1, transform: [{ translateY: pressed ? 3 : 0 }] })}>
            <Text style={{ color: T.white, fontFamily: "RubikBold", fontSize: 16, letterSpacing: 0.35 }}>Done</Text>
            <Ionicons name="checkmark-circle-outline" size={20} color={T.white} />
          </Pressable>
        </ScrollView>
      </Sheet>
    </Screen>
  );
}
