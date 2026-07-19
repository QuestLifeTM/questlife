import { useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { QuestlifeFlame } from "@/components/questlife-flame";
import { T } from "@/components/theme";
import { useStreaks } from "@/contexts/StreaksContext";

/**
 * The streak pill from the Lobby header, extracted so other screens
 * (Journal) can reuse the exact same visual and behavior. Shows the user's
 * live personal streak and opens the Streak screen.
 */
export function StreakPill({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { overview } = useStreaks();
  const count = overview?.personal.currentStreak ?? 0;
  const lit = count > 0;

  return (
    <Pressable
      onPress={() => router.push("/streak")}
      style={({ pressed }) => ({
        height: 40,
        minWidth: compact ? 58 : 62,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: "#ffb785",
        backgroundColor: "#fff0e7",
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transform: [{ scale: pressed ? 0.96 : 1 }]
      })}
    >
      <QuestlifeFlame size={lit ? 21 : 19} style={{ opacity: lit ? 1 : 0.45 }} />
      <Text style={{ color: "#5a3027", fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{count}</Text>
    </Pressable>
  );
}
