import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { categoryColor, T } from "@/components/theme";
import { Card, EmptyState, GradientBand, IconButton, PillStat, ProgressBar, Screen, Sheet, SoftButton, Tag, useResponsiveScreenLayout } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { Quest } from "@/types/content";

export function AdventurePackDetailScreen({ id, onBack }: { id?: string; onBack: () => void }) {
  const { horizontalPadding, insets } = useResponsiveScreenLayout();
  const edgePadding = { paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding };
  const { adventurePacks, completeQuest, getAdventurePack, loading, quests } = useContent();
  const { refresh: refreshStreaks } = useStreaks();
  const pack = getAdventurePack(id) ?? adventurePacks[0] ?? null;
  const list = useMemo(() => {
    if (!pack) return [];
    return pack.questIds
      .map((questId) => quests.find((quest) => quest.id === questId))
      .filter(Boolean) as Quest[];
  }, [pack, quests]);
  const totalXp = list.reduce((sum, quest) => sum + quest.xp, 0);
  const [saved, setSaved] = useState(false);
  const [started, setStarted] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"start" | "save" | "done" | null>(null);
  const progress = list.length ? (completedIds.length / list.length) * 100 : 0;
  const nextQuest = list.find((quest) => !completedIds.includes(quest.id)) ?? list[0];

  if (!pack) {
    return (
      <Screen>
        <IconButton icon="chevron-back" onPress={onBack} />
        <Card>
          <EmptyState
            emoji={loading ? "⏳" : "🧭"}
            title={loading ? "Loading Adventure Pack" : "Adventure Pack unavailable"}
            body={loading ? "Finding the latest pack details." : "This Adventure Pack may be unpublished, archived, or unavailable."}
          />
        </Card>
      </Screen>
    );
  }

  function startPack() {
    setStarted(true);
    setFeedback("start");
  }

  function toggleSaved() {
    setSaved((value) => !value);
    setFeedback("save");
  }

  async function markQuestDone(quest: Quest) {
    setStarted(true);
    setCompletedIds((prev) => prev.includes(quest.id) ? prev : [...prev, quest.id]);
    await completeQuest(quest.id);
    refreshStreaks();
    setFeedback("done");
  }

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, gap: 0 }}>
      <GradientBand color={pack.color}>
        <View style={{ ...edgePadding, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <IconButton icon="chevron-back" onPress={onBack} />
            <View style={{ flexDirection: "row", gap: 9 }}>
              <IconButton icon={saved ? "bookmark" : "bookmark-outline"} color={saved ? pack.color : T.muted} onPress={toggleSaved} />
              <IconButton icon="share-outline" />
            </View>
          </View>
          <Text style={{ fontSize: 46 }}>{pack.icon}</Text>
          <View>
            <Text style={{ color: T.muted, fontWeight: "900", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>Adventure Pack</Text>
            <Text style={{ color: T.dark, fontSize: 31, lineHeight: 36, fontWeight: "900", marginTop: 4 }}>{pack.title}</Text>
            <Text style={{ color: T.muted, fontWeight: "700", lineHeight: 21, marginTop: 7 }}>{pack.subtitle}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <PillStat icon="time" text={pack.timeRange} color={T.muted} />
            <PillStat icon="flash" text={`${pack.questCount} quests`} color={pack.color} />
            <PillStat icon="trophy" text={`+${totalXp} XP`} color={T.blue} />
          </View>
        </View>
      </GradientBand>

      <View style={{ paddingTop: 24, paddingBottom: 24, ...edgePadding, gap: 18 }}>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>{started ? "Adventure Pack Progress" : "Ready-made adventure"}</Text>
              <Text style={{ color: T.muted, fontWeight: "700", fontSize: 12 }}>{completedIds.length}/{list.length} quests completed</Text>
            </View>
            <PillStat text={`${Math.round(progress)}%`} color={pack.color} />
          </View>
          <ProgressBar value={progress} color={pack.color} height={10} />
          {nextQuest ? (
            <View style={{ borderRadius: 22, backgroundColor: pack.bgColor, padding: 14, gap: 8 }}>
              <Text style={{ color: T.muted, fontWeight: "900", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.7 }}>{started ? "Next up" : "Suggested first quest"}</Text>
              <Text style={{ color: T.dark, fontWeight: "900", fontSize: 16 }}>{nextQuest.title}</Text>
              <Text style={{ color: T.muted, fontWeight: "700", lineHeight: 18 }}>{nextQuest.description}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SoftButton label={started ? "Continue" : "Start Pack"} icon="sparkles" color={pack.color} onPress={startPack} style={{ flex: 1 }} />
            <SoftButton label={saved ? "Saved" : "Save"} icon={saved ? "bookmark" : "bookmark-outline"} inverse color={saved ? pack.color : T.muted} onPress={toggleSaved} style={{ flex: 1 }} />
          </View>
        </Card>

        <View style={{ gap: 12 }}>
          <Text style={{ color: T.muted, fontWeight: "900", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>Quests in this Adventure Pack</Text>
          {list.length ? list.map((quest, index) => {
            const cat = categoryColor[quest.category] ?? { text: quest.color, bg: `${quest.color}18` };
            const done = completedIds.includes(quest.id) || quest.completed;
            return (
              <Card key={quest.id} style={{ padding: 0, overflow: "hidden", opacity: done ? 0.76 : 1 }}>
                <View style={{ flexDirection: "row" }}>
                  <View style={{ width: 6, backgroundColor: done ? T.green : quest.color }} />
                  <View style={{ flex: 1, padding: 16, gap: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: done ? "rgba(39,174,96,0.14)" : `${quest.color}18`, alignItems: "center", justifyContent: "center" }}>
                        {done ? <Ionicons name="checkmark" size={17} color={T.green} /> : <Text style={{ color: quest.color, fontWeight: "900" }}>{index + 1}</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: T.dark, fontWeight: "900", fontSize: 16 }}>{quest.title}</Text>
                        <Text style={{ color: T.muted, fontWeight: "700", fontSize: 12, marginTop: 2 }}>{quest.timeLabel} · +{quest.xp} XP</Text>
                      </View>
                    </View>
                    <Text style={{ color: T.muted, fontWeight: "700", lineHeight: 18 }}>{quest.description}</Text>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      <Tag label={quest.category} color={cat.text} bg={cat.bg} />
                      <PillStat text={quest.difficulty} color={quest.color} />
                    </View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Link href={`/quest/${quest.id}`} asChild>
                        <Pressable style={{ flex: 1 }}>
                          <SoftButton label="Open" icon="chevron-forward" inverse color={T.blue} />
                        </Pressable>
                      </Link>
                      <SoftButton label={done ? "Done" : "Mark Done"} icon={done ? "checkmark-circle" : "checkmark"} color={done ? T.green : pack.color} onPress={() => markQuestDone(quest)} style={{ flex: 1 }} />
                    </View>
                  </View>
                </View>
              </Card>
            );
          }) : (
            <Card>
              <EmptyState emoji="🧭" title="No quests in this pack" body="Add quests to this Adventure Pack from the admin dashboard." />
            </Card>
          )}
        </View>
      </View>

      <Sheet visible={feedback !== null} onClose={() => setFeedback(null)}>
        <View style={{ padding: 24, alignItems: "center", gap: 14 }}>
          <Text style={{ fontSize: 46 }}>{feedback === "done" ? "✅" : feedback === "save" ? "🔖" : pack.icon}</Text>
          <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900", textAlign: "center" }}>
            {feedback === "done" ? "Quest marked complete" : feedback === "save" ? saved ? "Adventure Pack saved" : "Adventure Pack removed" : "Adventure Pack started"}
          </Text>
          <Text style={{ color: T.muted, fontWeight: "700", textAlign: "center", lineHeight: 20 }}>
            {feedback === "done" ? `Nice. ${completedIds.length}/${list.length} quests are now done.` : feedback === "save" ? saved ? "You can find it again in My Stuff." : "You can save it again whenever you want." : `${pack.title} is now your active adventure plan.`}
          </Text>
          <SoftButton label="Continue" color={pack.color} onPress={() => setFeedback(null)} style={{ alignSelf: "stretch" }} />
        </View>
      </Sheet>
    </Screen>
  );
}
