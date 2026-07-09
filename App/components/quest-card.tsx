import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { categoryColor, difficultyColor, T } from "@/components/theme";
import { Card, PillStat, Tag, haptic } from "@/components/ui";
import { Quest } from "@/types/content";

export function QuestCard({
  quest,
  compact = false,
  onSave
}: {
  quest: Quest;
  compact?: boolean;
  onSave?: () => void;
}) {
  const cat = categoryColor[quest.category] ?? { text: quest.color, bg: `${quest.color}18` };
  const diff = difficultyColor[quest.difficulty];
  return (
    <Link href={`/quest/${quest.id}`} asChild>
      <Pressable onPress={haptic} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
        <Card style={{ padding: 0, overflow: "hidden", width: compact ? 306 : undefined }}>
          <View style={{ height: 5, backgroundColor: quest.color }} />
          <View style={{ padding: 16, gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 }}>
                <Tag label={quest.category} color={cat.text} bg={cat.bg} />
                <Tag label={quest.difficulty} color={diff.text} bg={diff.bg} />
              </View>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  haptic();
                  onSave?.();
                }}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: quest.saved ? `${T.blue}1f` : T.border, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name={quest.saved ? "bookmark" : "bookmark-outline"} size={16} color={quest.saved ? T.blue : T.muted} />
              </Pressable>
            </View>
            <Text style={{ color: T.dark, fontSize: compact ? 20 : 16, lineHeight: compact ? 25 : 21, fontWeight: "900" }}>
              {quest.title}
            </Text>
            <Text style={{ color: T.muted, fontWeight: "600", lineHeight: 18, fontSize: 12 }}>
              {quest.description}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <PillStat icon="flash" text={`+${quest.xp} XP`} />
                <PillStat icon="time" text={quest.timeLabel} color={T.dark} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: T.blue }}>
                <Text style={{ color: T.white, fontWeight: "900", fontSize: 12 }}>Start</Text>
                <Ionicons name="chevron-forward" size={12} color={T.white} />
              </View>
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

export function HorizontalQuestList({ quests, onSave }: { quests: Quest[]; onSave?: (id: string) => void }) {
  return (
    <View style={{ marginHorizontal: -24 }}>
      <View style={{ paddingHorizontal: 24 }}>
        <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900", marginBottom: 12 }}>Featured Today</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 24, paddingBottom: 4 }} snapToInterval={318} decelerationRate="fast">
          {quests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} compact onSave={() => onSave?.(quest.id)} />
          ))}
      </ScrollView>
    </View>
  );
}
