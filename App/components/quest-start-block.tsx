import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { T } from "@/components/theme";
import { Card, Sheet, SoftButton } from "@/components/ui";
import { QuestStartBlock } from "@/hooks/useQuestStart";
import { Quest, QuestCategory } from "@/types/content";

export type ActiveQuestSummary = {
  title: string;
  durationLabel: string;
  photoCount: number;
  noteCount: number;
  color: string;
};

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
  onRepeatQuest,
  onResumeActiveQuest,
  onAbandonActiveAndRetry,
}: {
  block: QuestStartBlock | null;
  onClose: () => void;
  onRepeatQuest?: () => void | Promise<void>;
  onResumeActiveQuest?: () => void;
  onAbandonActiveAndRetry?: () => void | Promise<void>;
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

  if (block.type === "repeat_quest") {
    const presentation = repeatQuestPresentation[block.quest.category];
    return (
      <View style={{ gap: 16, paddingBottom: 6 }}>
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
      </View>
    );
  }

  if (block.type === "active_session") {
    const requestedQuest = block.requestedQuest;
    const actionColor = block.actionColor ?? requestedQuest?.color ?? T.orange;
    return (
      <View style={{ gap: 16, paddingBottom: 6 }}>
        <View style={{ width: 56, height: 56, borderRadius: 20, alignSelf: "center", alignItems: "center", justifyContent: "center", backgroundColor: `${actionColor}16`, borderWidth: 1, borderColor: `${actionColor}2d` }}><Ionicons name={requestedQuest ? "lock-closed" : "compass"} size={25} color={actionColor} /></View>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 24, lineHeight: 30, textAlign: "center" }}>{requestedQuest ? "A quest is active right now" : "An unfinished quest was found"}</Text>
          <Text style={{ maxWidth: 320, color: T.muted, fontFamily: "Rubik", fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" }}>{requestedQuest ? `Abandon your active quest and start “${requestedQuest.title}” instead?` : `${block.quest ? `${block.quest.title} is still active.` : "A previous quest is still active on this account."} You can resume it or abandon it to start fresh.`}</Text>
        </View>
        <View style={{ gap: 9 }}>
          {requestedQuest ? <><SoftButton label="Go back" color={actionColor} onPress={onClose} />{onAbandonActiveAndRetry ? <SoftButton label="Abandon quest & start this" icon="refresh" inverse color={actionColor} onPress={() => void onAbandonActiveAndRetry()} /> : null}</> : <>{onResumeActiveQuest ? <SoftButton label="Resume active quest" icon="navigate" color={T.blue} onPress={onResumeActiveQuest} /> : null}{onAbandonActiveAndRetry ? <SoftButton label="Abandon and start fresh" icon="refresh" inverse color={T.red} onPress={() => void onAbandonActiveAndRetry()} /> : null}<SoftButton label="Maybe later" inverse color={T.muted} onPress={onClose} /></>}
        </View>
      </View>
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
  onRepeatQuest,
  onResumeActiveQuest,
  onAbandonActiveAndRetry,
}: {
  block: QuestStartBlock | null;
  visible: boolean;
  onClose: () => void;
  onRepeatQuest?: () => void | Promise<void>;
  onResumeActiveQuest?: () => void;
  onAbandonActiveAndRetry?: () => void | Promise<void>;
}) {
  if (!visible || !block) return null;
  return <Sheet visible={visible} onClose={onClose} maxHeight="78%">
    <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
      <QuestStartBlockSheet block={block} onClose={onClose} onRepeatQuest={onRepeatQuest} onResumeActiveQuest={onResumeActiveQuest} onAbandonActiveAndRetry={onAbandonActiveAndRetry} />
    </View>
  </Sheet>;
}

export function QuestAbandonReviewModal({
  summary,
  visible,
  onClose,
  onSaveToJournal,
  onDeleteAndStart,
}: {
  summary: ActiveQuestSummary | null;
  visible: boolean;
  onClose: () => void;
  onSaveToJournal: () => void;
  onDeleteAndStart: () => void | Promise<void>;
}) {
  if (!visible || !summary) return null;

  const details = [
    { icon: "time-outline" as const, label: "Time spent", value: summary.durationLabel },
    ...(summary.photoCount ? [{ icon: "camera-outline" as const, label: "Photos", value: String(summary.photoCount) }] : []),
    ...(summary.noteCount ? [{ icon: "document-text-outline" as const, label: "Notes", value: String(summary.noteCount) }] : []),
  ];

  return <Sheet visible={visible} onClose={onClose} maxHeight="78%"><View style={{ paddingHorizontal: 20, paddingBottom: 18, gap: 16 }}>
    <View style={{ alignItems: "center", gap: 7 }}>
      <View style={{ width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: `${summary.color}16`, borderWidth: 1, borderColor: `${summary.color}2d` }}><Ionicons name="archive-outline" size={27} color={summary.color} /></View>
      <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 24, lineHeight: 30, textAlign: "center" }}>Before you leave</Text>
      <Text numberOfLines={1} style={{ color: T.muted, fontFamily: "Rubik", fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" }}>Here’s what you captured on</Text>
      <Text numberOfLines={2} style={{ maxWidth: 320, color: T.dark, fontFamily: "RubikBold", fontSize: 16, lineHeight: 21, textAlign: "center" }}>{summary.title}</Text>
    </View>
    <View style={{ flexDirection: "row", gap: 8 }}>{details.map((detail) => <View key={detail.label} style={{ flex: 1, minWidth: 0, minHeight: 112, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 17, alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: `${summary.color}0e`, borderWidth: 1, borderColor: `${summary.color}2d` }}><Ionicons name={detail.icon} size={22} color={summary.color} /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 19, fontVariant: ["tabular-nums"] }}>{detail.value}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 10, letterSpacing: 0.35, textTransform: "uppercase" }}>{detail.label}</Text></View>)}</View>
    <View style={{ gap: 9 }}>
      <SoftButton label="Keep active quest" color={summary.color} onPress={onClose} />
      <SoftButton label="Save to Journal" icon="book-outline" inverse color={summary.color} onPress={onSaveToJournal} />
      <SoftButton label="Delete quest stats & start this" icon="trash-outline" inverse color={T.muted} onPress={() => void onDeleteAndStart()} />
    </View>
  </View></Sheet>;
}
