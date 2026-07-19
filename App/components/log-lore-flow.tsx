import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { T } from "@/components/theme";
import { PillStat, Sheet, SoftButton } from "@/components/ui";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { uploadQuestPhoto } from "@/services/engine/questEngineService";
import { Quest } from "@/types/content";
import { CompletionResult } from "@/types/engine";

const REVIEW_PROMPTS = [
  { key: "highlight", label: "What was the highlight?" },
  { key: "shared", label: "Who did you share it with?" },
  { key: "surprised", label: "What surprised you?" },
] as const;

type PromptKey = (typeof REVIEW_PROMPTS)[number]["key"];

/**
 * Finalises an Active Quest with its already-saved Entry draft. Ratings and
 * review prompts add context, but never force the user to recreate the entry
 * they wrote while completing the quest.
 */
export function LogLoreFlow({
  visible,
  quest,
  onClose,
  onFinished,
  initialReflection = "",
  photoUrls = [],
}: {
  visible: boolean;
  quest: Quest | null;
  onClose: () => void;
  onFinished: (result: CompletionResult) => void;
  initialReflection?: string;
  photoUrls?: string[];
}) {
  const { completeQuest } = useQuestEngine();
  const { refreshNotifications } = useNotifications();
  const { refresh: refreshStreaks } = useStreaks();
  const [answers, setAnswers] = useState<Record<PromptKey, string>>({ highlight: "", shared: "", surprised: "" });
  const [review, setReview] = useState("");
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAnswers({ highlight: "", shared: "", surprised: "" });
    setReview("");
    setRating(0);
    setError(null);
    setResult(null);
    setFinished(false);
  }, [visible]);

  if (!quest) return null;

  const combinedReflection = [
    initialReflection.trim(),
    ...REVIEW_PROMPTS.flatMap(({ key, label }) => {
      const answer = answers[key].trim();
      return answer ? [`${label}\n${answer}`] : [];
    }),
  ].filter(Boolean).join("\n\n");

  async function finishQuest() {
    setBusy(true);
    setError(null);
    try {
      const completion = await completeQuest({
        questId: quest!.id,
        logged: true,
        reflection: combinedReflection || null,
        rating: rating || null,
        review: review.trim() || null,
        reviewPublic: true,
        photoUrls,
      });
      await refreshNotifications();
      await refreshStreaks();
      setResult(completion);
      setFinished(true);
      onFinished(completion);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "We couldn't finish this quest. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (finished) {
    return <Sheet visible={visible} onClose={onClose}><View style={{ padding: 24, alignItems: "center", gap: 14 }}><Text style={{ fontSize: 44 }}>📔</Text><Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Added to your journal</Text><PillStat icon="flash" text={`+${result?.xpAwarded ?? quest.xp} XP`} /><Text style={{ color: T.muted, fontWeight: "700", textAlign: "center" }}>Your quest record is safely saved.</Text></View></Sheet>;
  }

  return <Sheet visible={visible} onClose={onClose} maxHeight="92%">
    <View style={{ padding: 24, gap: 14 }}>
      <View style={{ alignItems: "center", gap: 6 }}><Text style={{ fontSize: 42 }}>📖</Text><Text style={{ color: T.dark, fontSize: 21, fontWeight: "900" }}>{quest.title}</Text><Text style={{ color: T.muted, fontSize: 13, lineHeight: 18, fontWeight: "700", textAlign: "center" }}>Your quest entry is already saved. Add anything else you want to remember.</Text></View>

      {initialReflection.trim() ? <View style={{ borderRadius: 16, padding: 13, gap: 5, backgroundColor: `${T.blue}0d`, borderWidth: 1, borderColor: `${T.blue}32` }}><Text style={{ color: T.blue, fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>Journal entry saved</Text><Text style={{ color: T.dark, fontSize: 13, lineHeight: 19, fontWeight: "700" }} numberOfLines={3}>{initialReflection}</Text></View> : null}

      <View style={{ gap: 8 }}>
        <Text style={{ color: T.muted, fontWeight: "900", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>Rating (optional)</Text>
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>{[1, 2, 3, 4, 5].map((star) => <Pressable key={star} accessibilityRole="button" accessibilityLabel={`${star} star rating`} onPress={() => setRating(star)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.9 : 1 }] })}><Ionicons name={star <= rating ? "star" : "star-outline"} size={31} color={T.orange} /></Pressable>)}</View>
      </View>

      {REVIEW_PROMPTS.map(({ key, label }) => <View key={key} style={{ gap: 6 }}><Text style={{ color: T.muted, fontWeight: "800", fontSize: 12 }}>{label}</Text><TextInput multiline placeholder="Optional..." placeholderTextColor={T.muted} value={answers[key]} onChangeText={(value) => setAnswers((current) => ({ ...current, [key]: value }))} style={{ minHeight: 52, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 12, color: T.dark, fontWeight: "700", textAlignVertical: "top", backgroundColor: T.bg }} /></View>)}

      <View style={{ gap: 6 }}><Text style={{ color: T.muted, fontWeight: "800", fontSize: 12 }}>Public review (optional)</Text><TextInput multiline placeholder="Help others know what to expect..." placeholderTextColor={T.muted} value={review} onChangeText={setReview} style={{ minHeight: 62, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 12, color: T.dark, fontWeight: "700", textAlignVertical: "top", backgroundColor: T.bg }} /></View>

      {error ? <View style={{ borderRadius: 14, padding: 12, backgroundColor: `${T.red}12`, borderWidth: 1, borderColor: `${T.red}45` }}><Text style={{ color: T.red, fontSize: 12, lineHeight: 18, fontWeight: "800" }}>{error}</Text></View> : null}
      <SoftButton label={busy ? "Saving..." : `Finish quest · +${quest.xp} XP`} icon="checkmark" onPress={busy ? undefined : () => void finishQuest()} color={T.green} />
    </View>
  </Sheet>;
}

/** Unused but kept for future photo picker integration. */
export async function pickAndUploadPhoto(uri: string) {
  return uploadQuestPhoto(uri);
}
