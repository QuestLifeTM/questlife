import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
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
        height: 38,
        minWidth: compact ? 54 : 58,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: T.yellow,
        backgroundColor: "rgba(254,228,64,0.18)",
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        transform: [{ scale: pressed ? 0.96 : 1 }]
      })}
    >
      <Ionicons name={lit ? "flame" : "flame-outline"} size={14} color={T.orange} />
      <Text style={{ color: T.dark, fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{count}</Text>
    </Pressable>
  );
}
