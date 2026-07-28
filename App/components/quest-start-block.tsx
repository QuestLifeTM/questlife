import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { T } from "@/components/theme";
import { Card, SoftButton } from "@/components/ui";
import { QuestStartBlock } from "@/hooks/useQuestStart";
import { Quest, QuestCategory } from "@/types/content";

const repeatQuestPresentation: Record<QuestCategory, { accent: string; encouragement: string }> = {
  ADVENTURE: { accent: T.blue, encouragement: "Take a different path this time." },
  "FOOD AND DRINKS": { accent: T.orange, encouragement: "Try a new flavor or bring someone along." },
  FITNESS: { accent: T.red, encouragement: "Keep your momentum going." },
  CREATIVITY: { accent: T.purple, encouragement: "Make something new from the same spark." },
  EVENTS: { accent: T.pink, encouragement: "Make another moment of it." },
  SOCIAL: { accent: "#087d73", encouragement: "Bring someone along this time." },
  "WILD CARD": { accent: "#9b42b6", encouragement: "See where round two takes you." },
};

export function QuestStartBlockSheet({
  block,
  onClose,
  onGoActive,
  onSaveActive,
  onRepeatQuest,
}: {
  block: QuestStartBlock | null;
  onClose: () => void;
  onGoActive?: () => void;
  onSaveActive?: () => void;
  onRepeatQuest?: () => void | Promise<void>;
}) {
  if (!block) return null;

  if (block.type === "daily_limit") {
    return (
      <Card style={{ borderRadius: 24, gap: 12, borderColor: `${T.orange}55` }}>
        <Text style={{ fontSize: 36, textAlign: "center" }}>⚡</Text>
        <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900", textAlign: "center" }}>Daily limit reached</Text>
        <Text style={{ color: T.muted, fontWeight: "700", textAlign: "center", lineHeight: 20 }}>
          You've used all 5 quests for today. Your energy resets at midnight — rest up and come back tomorrow!
        </Text>
        <SoftButton label="Got it" onPress={onClose} inverse color={T.muted} />
      </Card>
    );
  }

  if (block.type === "active_quest") {
    const title = block.activeQuest?.title ?? "another quest";
    return (
      <Card style={{ borderRadius: 24, gap: 12, borderColor: `${T.blue}55` }}>
        <Text style={{ fontSize: 36, textAlign: "center" }}>🗺️</Text>
        <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900", textAlign: "center" }}>Quest already active</Text>
        <Text style={{ color: T.muted, fontWeight: "700", textAlign: "center", lineHeight: 20 }}>
          You're already doing "{title}". Complete it or move it to saved for later before starting a new one.
        </Text>
        <View style={{ gap: 10 }}>
          {onGoActive ? <SoftButton label="Go to active quest" icon="arrow-forward" onPress={onGoActive} /> : null}
          {onSaveActive ? <SoftButton label="Save active for later" icon="bookmark-outline" inverse color={T.blue} onPress={onSaveActive} /> : null}
          <SoftButton label="Not now" inverse color={T.muted} onPress={onClose} />
        </View>
      </Card>
    );
  }

  if (block.type === "repeat_quest") {
    const presentation = repeatQuestPresentation[block.quest.category];
    return (
      <Card style={{ borderRadius: 28, gap: 16, borderColor: `${presentation.accent}48`, borderBottomColor: `${presentation.accent}78`, borderBottomWidth: 5, backgroundColor: T.white, padding: 22 }}>
        <View style={{ width: 56, height: 56, borderRadius: 20, alignSelf: "center", alignItems: "center", justifyContent: "center", backgroundColor: `${presentation.accent}16`, borderWidth: 1, borderColor: `${presentation.accent}2d` }}><Ionicons name="refresh" size={27} color={presentation.accent} /></View>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text style={{ color: presentation.accent, fontFamily: "RubikBold", fontSize: 11, lineHeight: 15, letterSpacing: 0.65, textTransform: "uppercase" }}>{block.quest.category}</Text>
          <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 24, lineHeight: 30, textAlign: "center" }}>Give it another go?</Text>
          <Text style={{ maxWidth: 320, color: T.muted, fontFamily: "Rubik", fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" }}>
            Repeat this quest for {block.repeatXp} XP. {presentation.encouragement}
          </Text>
        </View>
        <View style={{ gap: 9 }}>
          {onRepeatQuest ? <SoftButton label="Repeat quest" icon="refresh" color={presentation.accent} onPress={() => void onRepeatQuest()} /> : null}
          <SoftButton label="Maybe later" inverse color={presentation.accent} onPress={onClose} />
        </View>
      </Card>
    );
  }

  return (
    <Card style={{ borderRadius: 24, gap: 12 }}>
      <Text style={{ color: T.dark, fontWeight: "900", textAlign: "center" }}>{block.message}</Text>
      <SoftButton label="OK" onPress={onClose} inverse color={T.muted} />
    </Card>
  );
}

export function QuestStartBlockModal({
  block,
  visible,
  onClose,
  onGoActive,
  onSaveActive,
  onRepeatQuest,
}: {
  block: QuestStartBlock | null;
  visible: boolean;
  onClose: () => void;
  onGoActive?: () => void;
  onSaveActive?: () => void;
  onRepeatQuest?: () => void | Promise<void>;
}) {
  if (!visible || !block) return null;
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, backgroundColor: "rgba(61,52,56,0.42)", justifyContent: "flex-end", padding: 20, zIndex: 100 }}>
      <QuestStartBlockSheet block={block} onClose={onClose} onGoActive={onGoActive} onSaveActive={onSaveActive} onRepeatQuest={onRepeatQuest} />
    </View>
  );
}
