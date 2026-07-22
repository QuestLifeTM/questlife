import { Text, View } from "react-native";
import { T } from "@/components/theme";
import { Card, SoftButton } from "@/components/ui";
import { QuestStartBlock } from "@/hooks/useQuestStart";
import { Quest } from "@/types/content";

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
    return (
      <Card style={{ borderRadius: 24, gap: 12, borderColor: `${T.orange}55`, backgroundColor: "#fffaf2" }}>
        <View style={{ width: 54, height: 54, borderRadius: 19, alignSelf: "center", alignItems: "center", justifyContent: "center", backgroundColor: `${T.orange}18` }}><Text style={{ fontSize: 27 }}>🔁</Text></View>
        <Text style={{ color: T.dark, fontSize: 21, lineHeight: 26, fontWeight: "900", textAlign: "center" }}>You’ve already completed this quest</Text>
        <Text style={{ color: T.muted, fontSize: 14, lineHeight: 21, fontWeight: "700", textAlign: "center" }}>
          You can do it again and earn {block.repeatXp} XP — 20% of the usual {block.quest.xp} XP — to keep adventures fair for everyone.
        </Text>
        <View style={{ gap: 10 }}>
          {onRepeatQuest ? <SoftButton label="Do this adventure again" icon="refresh" color={T.orange} onPress={() => void onRepeatQuest()} /> : null}
          <SoftButton label="Just okay" inverse color={T.muted} onPress={onClose} />
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
