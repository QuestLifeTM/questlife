import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Animated, Pressable, Text, TextInput, View } from "react-native";
import { T } from "@/components/theme";
import { PillStat, Sheet, SoftButton } from "@/components/ui";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { uploadQuestPhoto } from "@/services/engine/questEngineService";
import { Quest } from "@/types/content";
import { CompletionResult } from "@/types/engine";

type Phase = "celebrate" | "choice" | "logging" | "done";

const REFLECTION_PROMPTS = [
  "What was the highlight?",
  "Who did you share it with?",
  "What surprised you?",
];

/**
 * Multi-step quest completion flow: celebration → log-or-skip → optional lore
 * logging with rating → slide-away finish.
 */
export function LogLoreFlow({
  visible,
  quest,
  onClose,
  onFinished,
}: {
  visible: boolean;
  quest: Quest | null;
  onClose: () => void;
  onFinished: (result: CompletionResult) => void;
}) {
  const router = useRouter();
  const { completeQuest } = useQuestEngine();
  const { refresh: refreshStreaks } = useStreaks();
  const [phase, setPhase] = useState<Phase>("celebrate");
  const [reflection, setReflection] = useState("");
  const [review, setReview] = useState("");
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompletionResult | null>(null);
  const bookScale = useRef(new Animated.Value(0.6)).current;
  const bookOpacity = useRef(new Animated.Value(0)).current;

  if (!quest) return null;

  const halfXp = Math.floor(quest.xp / 2);

  function reset() {
    setPhase("celebrate");
    setReflection("");
    setReview("");
    setRating(0);
    setResult(null);
    bookScale.setValue(0.6);
    bookOpacity.setValue(0);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function finish(logged: boolean) {
    setBusy(true);
    try {
      const completion = await completeQuest({
        questId: quest!.id,
        logged,
        reflection: logged ? reflection : null,
        rating: logged ? rating : null,
        review: logged ? review : null,
        reviewPublic: true,
        photoUrls: [],
      });
      setResult(completion);
      refreshStreaks();
      onFinished(completion);
      if (logged) {
        setPhase("done");
        setTimeout(handleClose, 1200);
      } else {
        handleClose();
      }
    } finally {
      setBusy(false);
    }
  }

  function openLogging() {
    setPhase("logging");
    Animated.parallel([
      Animated.spring(bookScale, { toValue: 1, damping: 14, stiffness: 160, useNativeDriver: true }),
      Animated.timing(bookOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }

  if (phase === "celebrate") {
    return (
      <Sheet visible={visible} onClose={handleClose}>
        <View style={{ padding: 24, alignItems: "center", gap: 14 }}>
          <Text style={{ fontSize: 52 }}>🎉</Text>
          <Text style={{ color: T.dark, fontSize: 26, fontWeight: "900", textAlign: "center" }}>Quest complete!</Text>
          <Text style={{ color: T.muted, fontWeight: "700", textAlign: "center", lineHeight: 21 }}>
            You did it — {quest.title} is in the books.
          </Text>
          <SoftButton label="Continue" icon="arrow-forward" onPress={() => setPhase("choice")} style={{ alignSelf: "stretch" }} />
        </View>
      </Sheet>
    );
  }

  if (phase === "choice") {
    return (
      <Sheet visible={visible} onClose={handleClose} maxHeight="88%">
        <View style={{ padding: 24, gap: 16 }}>
          <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900", textAlign: "center" }}>Log your lore?</Text>
          <Text style={{ color: T.muted, fontWeight: "700", textAlign: "center", lineHeight: 20 }}>
            Takes about 2 minutes. Photos feed your weekly Memory Wrap — private unless you share them.
          </Text>
          <View style={{ borderRadius: 20, backgroundColor: "rgba(254,228,64,0.14)", borderWidth: 1.5, borderColor: "rgba(254,228,64,0.45)", padding: 14, gap: 6 }}>
            <Text style={{ color: T.dark, fontWeight: "900", fontSize: 14 }}>Memory Wrap teaser</Text>
            <Text style={{ color: T.muted, fontWeight: "700", fontSize: 13, lineHeight: 19 }}>
              Log 3 quests this week and we'll stitch your photos into a shareable recap every Sunday.
            </Text>
          </View>
          <SoftButton
            label={`Log your lore · +${quest.xp} XP`}
            icon="book"
            onPress={openLogging}
            color={T.green}
          />
          <SoftButton
            label={`Skip · +${halfXp} XP only`}
            icon="flash-outline"
            inverse
            color={T.muted}
            onPress={() => finish(false)}
          />
        </View>
      </Sheet>
    );
  }

  if (phase === "logging") {
    return (
      <Sheet visible={visible} onClose={handleClose} maxHeight="92%">
        <View style={{ padding: 24, gap: 14 }}>
          <Animated.View style={{ alignItems: "center", opacity: bookOpacity, transform: [{ scale: bookScale }] }}>
            <Text style={{ fontSize: 48 }}>📖</Text>
            <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900", marginTop: 8 }}>{quest.title}</Text>
          </Animated.View>

          <View style={{ gap: 8 }}>
            <Text style={{ color: T.muted, fontWeight: "900", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>
              Rating (required)
            </Text>
            <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setRating(star)}>
                  <Ionicons name={star <= rating ? "star" : "star-outline"} size={32} color={T.orange} />
                </Pressable>
              ))}
            </View>
          </View>

          {REFLECTION_PROMPTS.map((prompt) => (
            <View key={prompt} style={{ gap: 6 }}>
              <Text style={{ color: T.muted, fontWeight: "800", fontSize: 12 }}>{prompt}</Text>
              <TextInput
                multiline
                placeholder="Optional..."
                placeholderTextColor={T.muted}
                value={reflection}
                onChangeText={setReflection}
                style={{ minHeight: 56, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 12, color: T.dark, fontWeight: "700", textAlignVertical: "top", backgroundColor: T.bg }}
              />
            </View>
          ))}

          <View style={{ gap: 6 }}>
            <Text style={{ color: T.muted, fontWeight: "800", fontSize: 12 }}>Public review (optional)</Text>
            <TextInput
              multiline
              placeholder="Help others know what to expect..."
              placeholderTextColor={T.muted}
              value={review}
              onChangeText={setReview}
              style={{ minHeight: 64, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 12, color: T.dark, fontWeight: "700", textAlignVertical: "top", backgroundColor: T.bg }}
            />
          </View>

          <SoftButton
            label={busy ? "Saving..." : `Save to journal · +${quest.xp} XP`}
            icon="checkmark"
            onPress={rating >= 1 ? () => finish(true) : undefined}
            color={rating >= 1 ? T.green : T.muted}
          />
        </View>
      </Sheet>
    );
  }

  // done phase
  return (
    <Sheet visible={visible} onClose={handleClose}>
      <View style={{ padding: 24, alignItems: "center", gap: 14 }}>
        <Text style={{ fontSize: 44 }}>📔</Text>
        <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Added to your journal</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <PillStat icon="flash" text={`+${result?.xpAwarded ?? quest.xp}`} />
        </View>
        <Text style={{ color: T.muted, fontWeight: "700" }}>Sliding away to Journal...</Text>
      </View>
    </Sheet>
  );
}

/** Unused but kept for future photo picker integration */
export async function pickAndUploadPhoto(uri: string) {
  return uploadQuestPhoto(uri);
}
