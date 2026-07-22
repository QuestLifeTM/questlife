import { Text, View } from "react-native";
import { ProfileAvatar } from "@/components/profile-avatar";
import { T } from "@/components/theme";
import { JournalParticipant } from "@/types/journal";

/**
 * Overlapping avatar stack for quests done with others (Party Mode).
 * No overlapping-avatar component existed in the app before this — the
 * closest pattern is the emoji-in-tinted-circle avatar used on the Streak
 * screen, which this follows (emoji, `${color}20` fill, colored ring),
 * adding a white outer ring so overlapped edges stay legible.
 */
export function AvatarPile({ people, size = 26, max = 3 }: { people: JournalParticipant[]; size?: number; max?: number }) {
  if (!people.length) return null;
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {visible.map((person, index) => (
        <View key={person.id} style={{ marginLeft: index ? -size * 0.35 : 0, zIndex: visible.length - index }}>
          <ProfileAvatar uri={person.avatarUrl} color={person.color} size={size} label={`${person.name}'s profile photo`} />
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={{
            height: size,
            minWidth: size,
            borderRadius: size / 2,
            backgroundColor: T.border,
            borderWidth: 2,
            borderColor: T.white,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: -size * 0.35,
            paddingHorizontal: 4
          }}
        >
          <Text style={{ color: T.muted, fontSize: 9, fontWeight: "900" }}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
}
