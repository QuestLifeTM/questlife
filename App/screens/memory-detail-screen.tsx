import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { AvatarPile } from "@/components/avatar-pile";
import { categoryColor, difficultyColor, radius, T } from "@/components/theme";
import { Card, EmptyState, GradientBand, IconButton, Screen, Sheet, SoftButton, useResponsiveScreenLayout } from "@/components/ui";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { fetchJournalMemory, resolveJournalMedia, updateJournalMemoryReflection } from "@/services/journal/journalService";
import { JournalMemory } from "@/types/journal";

const memoryDifficultyIcons: Record<JournalMemory["difficulty"], keyof typeof Ionicons.glyphMap> = {
  EASY: "leaf-outline",
  MEDIUM: "flame-outline",
  HARD: "thunderstorm-outline",
  FORMIDABLE: "shield-outline",
};

function MemoryHeaderPill({ label, color, backgroundColor, icon }: { label: string; color: string; backgroundColor: string; icon: React.ReactNode }) {
  return <View style={{ minHeight: 27, paddingHorizontal: 8, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor, borderWidth: 1, borderColor: `${color}20` }}>{icon}<Text numberOfLines={1} style={{ color, fontFamily: "RubikBlack", fontSize: 10, lineHeight: 12, letterSpacing: 0.45, textTransform: "uppercase" }}>{label}</Text></View>;
}

function MemoryStat({ label, value, icon, color, bordered }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; color: string; bordered?: boolean }) {
  return <View style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 4, paddingHorizontal: 6, borderLeftWidth: bordered ? 1 : 0, borderLeftColor: T.border }}><View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name={icon} size={15} color={color} /><Text numberOfLines={1} style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20 }}>{value}</Text></View><Text numberOfLines={1} style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</Text></View>;
}

function MemoryAction({ label, icon, color, onPress, inverse = false, fullWidth = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void; inverse?: boolean; fullWidth?: boolean }) {
  const textColor = inverse ? color : T.white;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flex: fullWidth ? undefined : 1, minHeight: 54, borderRadius: 19, borderWidth: inverse ? 2 : 0, borderColor: inverse ? color : "transparent", borderBottomWidth: inverse ? 4 : 5, borderBottomColor: inverse ? `${color}99` : "rgba(61,52,56,0.22)", backgroundColor: inverse ? T.white : color, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, paddingHorizontal: 10, opacity: pressed ? 0.86 : 1, transform: [{ translateY: pressed ? 2 : 0 }] })}><Ionicons name={icon} size={18} color={textColor} /><Text numberOfLines={1} style={{ color: textColor, fontFamily: "RubikBold", fontSize: 14, textAlign: "center" }}>{label}</Text></Pressable>;
}

export function MemoryDetailScreen({ completionId, onBack }: { completionId?: string; onBack: () => void }) {
  const router = useRouter();
  const { horizontalPadding, insets } = useResponsiveScreenLayout();
  const edgePadding = { paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding };
  const [memory, setMemory] = useState<JournalMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [reflectionEditorVisible, setReflectionEditorVisible] = useState(false);
  const [reflectionDraft, setReflectionDraft] = useState("");
  const [savingReflection, setSavingReflection] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const { showFeedback } = useAppFeedback();

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

  // Completed quests can outlive category, difficulty, or accent-color changes.
  // Keep older memories renderable even when their stored metadata is no longer mapped.
  const accentColor = typeof memory.color === "string" && memory.color.trim() ? memory.color : T.blue;
  const categoryLabel = typeof memory.category === "string" && memory.category.trim() ? memory.category : "Quest";
  const difficultyLabel = typeof memory.difficulty === "string" && memory.difficulty.trim() ? memory.difficulty : "MEDIUM";
  const cat = categoryColor[categoryLabel] ?? { text: accentColor, bg: `${accentColor}18` };
  const diff = difficultyColor[difficultyLabel as keyof typeof difficultyColor] ?? difficultyColor.MEDIUM;
  const difficultyIcon = memoryDifficultyIcons[difficultyLabel as keyof typeof memoryDifficultyIcons] ?? memoryDifficultyIcons.MEDIUM;
  const completedAt = new Date(memory.completedAt);
  const dateLabel = completedAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeLabel = completedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const openReflectionEditor = () => {
    setReflectionDraft(memory.reflection ?? "");
    setReflectionError(null);
    setReflectionEditorVisible(true);
  };
  const saveReflection = async () => {
    if (savingReflection) return;
    setSavingReflection(true);
    setReflectionError(null);
    try {
      const reflection = reflectionDraft.trim() || null;
      await updateJournalMemoryReflection({ completionId: memory.completionId, reflection });
      setMemory((current) => current ? { ...current, reflection } : current);
      setReflectionEditorVisible(false);
      showFeedback({ message: reflection ? "Your reflection was updated." : "Your reflection was removed.", icon: "book", color: T.purple });
    } catch {
      setReflectionError("We couldn't save that reflection. Please try again.");
    } finally {
      setSavingReflection(false);
    }
  };
  const shareMemory = async () => {
    try {
      await Share.share({ title: memory.title, message: `I completed “${memory.title}” on QuestLife. +${memory.xp} XP from a ${memory.timeMin}-minute ${memory.category.toLowerCase()} quest.` });
    } catch {
      showFeedback({ message: "We couldn't open sharing right now.", icon: "alert-circle", color: T.red });
    }
  };

  const actionColor = cat.text;

  return (
    <Screen scroll={false} padded={false}>
      <View style={{ flex: 1 }}>
        <GradientBand color={accentColor} bleedTop bleedTopSpacing={6}>
          <View style={{ ...edgePadding, paddingBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <MemoryHeaderPill label={categoryLabel} color={cat.text} backgroundColor={cat.bg} icon={<Ionicons name="sparkles-outline" size={13} color={cat.text} />} />
                  <MemoryHeaderPill label={difficultyLabel} color={diff.text} backgroundColor={diff.bg} icon={<Ionicons name={difficultyIcon} size={13} color={diff.text} />} />
                </View>
                <Text numberOfLines={2} style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 29, lineHeight: 32 }}>{memory.title}</Text>
                <View accessibilityLabel={`Completed ${dateLabel} at ${timeLabel}`} style={{ flexDirection: "row", alignItems: "center", minHeight: 23, gap: 5 }}><Ionicons name="time-outline" size={15} color={T.muted} /><Text numberOfLines={2} style={{ flex: 1, color: T.muted, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18 }}>Completed {dateLabel} · {timeLabel}</Text></View>
              </View>
              <View style={{ paddingTop: 1 }}><IconButton icon="chevron-back" label="Back to Journal" onPress={onBack} /></View>
            </View>
          </View>
        </GradientBand>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ ...edgePadding, paddingTop: 12, paddingBottom: 18, gap: 25 }}>
          <View style={{ minHeight: 78, borderRadius: 20, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, flexDirection: "row", alignItems: "center", paddingVertical: 13, boxShadow: `3px 4px 0px ${T.border}` }}>
            <MemoryStat label="XP earned" value={`+${memory.xp}`} icon="flash" color={actionColor} />
            <MemoryStat label="Duration" value={`${memory.timeMin}m`} icon="time" color={actionColor} bordered />
            <MemoryStat label="Photos" value={String(photoUrls.length)} icon="images" color={actionColor} bordered />
          </View>

          {memory.participants.length ? <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><AvatarPile people={memory.participants} size={32} /><View style={{ flex: 1, gap: 2 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 14 }}>Shared adventure</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 17 }}>You completed this with {memory.participants.length} other{memory.participants.length > 1 ? "s" : ""}.</Text></View></Card> : null}

          {photoUrls.length ? <View style={{ gap: 10 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 21 }}>Photos from this quest</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{photoUrls.map((uri, index) => <Image key={uri} accessibilityLabel={`Quest photo ${index + 1} of ${photoUrls.length}`} source={{ uri }} style={{ width: 180, height: 132, borderRadius: radius.lg, backgroundColor: T.border }} />)}</ScrollView></View> : null}

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 21 }}>Your reflection</Text><Pressable accessibilityRole="button" accessibilityLabel={memory.reflection ? "Edit reflection" : "Add a reflection"} onPress={openReflectionEditor} hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.68 : 1 })}><Ionicons name={memory.reflection ? "create-outline" : "add-circle-outline"} size={16} color={actionColor} /><Text style={{ color: actionColor, fontFamily: "RubikBold", fontSize: 12, lineHeight: 16 }}>{memory.reflection ? "Edit" : "Add"}</Text></Pressable></View>
            {memory.reflection ? <Pressable accessibilityRole="button" accessibilityLabel="Edit reflection" onPress={openReflectionEditor}><Card style={{ backgroundColor: `${actionColor}0b`, borderColor: `${actionColor}30`, gap: 0 }}><Text style={{ color: T.dark, fontFamily: "Rubik", fontSize: 16, lineHeight: 24 }}>“{memory.reflection}”</Text></Card></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Add a reflection" onPress={openReflectionEditor}><View style={{ minHeight: 118, borderRadius: 20, borderWidth: 2, borderColor: `${actionColor}45`, backgroundColor: `${actionColor}0b`, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 8 }}><Ionicons name="create-outline" size={24} color={actionColor} /><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 14 }}>Add a thought to this memory</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 18, textAlign: "center" }}>A sentence is enough to help future you remember this moment.</Text></View></Pressable>}
          </View>
        </ScrollView>

        <View style={{ ...edgePadding, paddingTop: 12, paddingBottom: Math.max(insets.bottom + 8, 16), gap: 10, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.bg }}>
          <MemoryAction label="Share" icon="share-outline" color={actionColor} inverse fullWidth onPress={() => void shareMemory()} />
          <MemoryAction label="View this quest" icon="sparkles" color={actionColor} fullWidth onPress={() => router.push(`/quest/${memory.questId}`)} />
        </View>
      </View>
      <Sheet visible={reflectionEditorVisible} onClose={() => { if (!savingReflection) setReflectionEditorVisible(false); }} maxHeight="72%">
        <View style={{ paddingHorizontal: 24, paddingBottom: 26, gap: 13 }}>
          <View style={{ alignItems: "center", gap: 7 }}><View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: `${T.purple}15`, alignItems: "center", justifyContent: "center" }}><Ionicons name="book-outline" size={25} color={T.purple} /></View><Text style={{ color: T.dark, fontSize: 22, lineHeight: 28, fontWeight: "900" }}>Edit reflection</Text><Text style={{ color: T.muted, fontSize: 13, lineHeight: 18, fontWeight: "700", textAlign: "center" }}>This stays private in your Journal.</Text></View>
          <TextInput value={reflectionDraft} onChangeText={setReflectionDraft} multiline textAlignVertical="top" autoFocus placeholder="What do you want to remember?" placeholderTextColor={T.muted} style={{ minHeight: 156, borderRadius: 18, borderWidth: 2, borderColor: T.border, backgroundColor: T.bg, padding: 13, color: T.dark, fontSize: 15, lineHeight: 22, fontWeight: "700" }} />
          {reflectionError ? <Text accessibilityRole="alert" style={{ color: T.red, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" }}>{reflectionError}</Text> : null}
          <View style={{ gap: 9 }}><SoftButton label={savingReflection ? "Saving..." : "Save reflection"} icon="checkmark" disabled={savingReflection} onPress={() => void saveReflection()} /><SoftButton label="Cancel" inverse color={T.muted} disabled={savingReflection} onPress={() => setReflectionEditorVisible(false)} /></View>
        </View>
      </Sheet>
    </Screen>
  );
}
