import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { AvatarPile } from "@/components/avatar-pile";
import { categoryColor, difficultyColor, radius, T } from "@/components/theme";
import { Card, EmptyState, GradientBand, IconButton, PillStat, Screen, SoftButton, Tag, useResponsiveScreenLayout } from "@/components/ui";
import { fetchJournalMemory, resolveJournalMedia } from "@/services/journal/journalService";
import { JournalMemory } from "@/types/journal";

export function MemoryDetailScreen({ completionId, onBack }: { completionId?: string; onBack: () => void }) {
  const router = useRouter();
  const { horizontalPadding, insets } = useResponsiveScreenLayout();
  const edgePadding = { paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding };
  const [memory, setMemory] = useState<JournalMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    if (!completionId) {
      setLoading(false);
      return;
    }
    fetchJournalMemory(completionId)
      .then((result) => {
        if (mounted) setMemory(result);
      })
      .catch((nextError) => {
        if (mounted) setError(nextError instanceof Error ? nextError.message : "Unable to load this memory.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [completionId]);

  useEffect(() => {
    let mounted = true;
    if (!memory?.photoPaths.length) { setPhotoUrls([]); return; }
    resolveJournalMedia(memory.photoPaths).then((urls) => { if (mounted) setPhotoUrls(urls); }).catch(() => { if (mounted) setPhotoUrls([]); });
    return () => { mounted = false; };
  }, [memory?.photoPaths]);

  if (!memory) {
    return (
      <Screen>
        <IconButton icon="chevron-back" onPress={onBack} />
        <Card>
          <EmptyState
            emoji={loading ? "⏳" : "🔍"}
            title={loading ? "Opening memory" : "Memory unavailable"}
            body={loading ? "Finding this moment in your journal." : error ?? "This memory may have been removed or its quest is no longer available."}
          />
        </Card>
      </Screen>
    );
  }

  const cat = categoryColor[memory.category] ?? { text: memory.color, bg: `${memory.color}18` };
  const diff = difficultyColor[memory.difficulty];
  const completedAt = new Date(memory.completedAt);
  const dateLabel = completedAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeLabel = completedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, gap: 0 }}>
      <GradientBand color={memory.color}>
        <View style={{ ...edgePadding, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <IconButton icon="chevron-back" onPress={onBack} />
            <Text style={{ color: T.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Journal Memory</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Tag label={memory.category} color={cat.text} bg={cat.bg} />
            <Tag label={memory.difficulty} color={diff.text} bg={diff.bg} />
          </View>
          <Text style={{ color: T.dark, fontSize: 28, lineHeight: 34, fontWeight: "900" }}>{memory.title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="time-outline" size={14} color={T.muted} />
            <Text style={{ color: T.muted, fontWeight: "700", fontSize: 13 }}>
              Completed {dateLabel} · {timeLabel}
            </Text>
          </View>
        </View>
      </GradientBand>

      <View style={{ paddingTop: 24, paddingBottom: 24, ...edgePadding, gap: 18 }}>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <PillStat icon="flash" text={`+${memory.xp} XP`} />
          <PillStat icon="time" text={`~${memory.timeMin} min`} color={T.dark} />
          <PillStat text={memory.difficulty} color={diff.text} />
        </View>

        {memory.participants.length ? (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <AvatarPile people={memory.participants} size={32} />
            <Text style={{ flex: 1, color: T.muted, fontWeight: "700", fontSize: 13, lineHeight: 19 }}>
              You did this quest with {memory.participants.length} other{memory.participants.length > 1 ? "s" : ""}.
            </Text>
          </Card>
        ) : null}

        {photoUrls.length ? <View style={{ gap: 10 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Your photos</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{photoUrls.map((uri) => <Image key={uri} source={{ uri }} style={{ width: 180, height: 132, borderRadius: radius.lg, backgroundColor: T.border }} />)}</ScrollView></View> : null}

        <View style={{ gap: 10 }}>
          <Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Your reflection</Text>
          {memory.reflection ? (
            <Card style={{ backgroundColor: `${memory.color}08`, borderColor: `${memory.color}25` }}>
              <Text style={{ color: T.dark, fontWeight: "600", fontSize: 15, lineHeight: 24 }}>“{memory.reflection}”</Text>
            </Card>
          ) : (
            <View
              style={{
                borderRadius: radius.lg,
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: T.border,
                alignItems: "center",
                paddingVertical: 24,
                paddingHorizontal: 20,
                gap: 8
              }}
            >
              <Ionicons name="pencil-outline" size={22} color={T.muted} />
              <Text style={{ color: T.muted, fontWeight: "600", fontSize: 13, lineHeight: 19, textAlign: "center" }}>
                No reflection was saved for this quest. Next time, a sentence is plenty.
              </Text>
            </View>
          )}
        </View>

        <View style={{ gap: 10 }}>
          <SoftButton label="View this quest" icon="sparkles" onPress={() => router.push(`/quest/${memory.questId}`)} />
          <SoftButton label="Back to Journal" inverse color={T.muted} onPress={onBack} />
        </View>
      </View>
    </Screen>
  );
}
