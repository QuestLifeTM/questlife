import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { T } from "@/components/theme";
import { EmptyState, IconButton, Screen, useResponsiveScreenLayout } from "@/components/ui";
import { useSocial } from "@/contexts/SocialContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { SocialFriend } from "@/types/social";

const STREAK_ORANGE = "#ff6d45";

function FriendAvatar({ friend }: { friend: SocialFriend }) {
  return <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${friend.avatarColor}22`, borderWidth: 2, borderColor: `${friend.avatarColor}77`, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 22 }}>{friend.emoji}</Text></View>;
}

function InviteButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 42, paddingHorizontal: 14, borderRadius: 15, backgroundColor: disabled ? "#f1eae5" : STREAK_ORANGE, borderBottomWidth: 4, borderBottomColor: disabled ? "#ddd4ce" : "#d44c31", alignItems: "center", justifyContent: "center", transform: [{ translateY: pressed && !disabled ? 2 : 0 }] })}><Text style={{ color: disabled ? T.muted : T.white, fontSize: 12, fontWeight: "900", letterSpacing: 0.35, textTransform: "uppercase" }}>{label}</Text></Pressable>;
}

export function StreakInviteFriendsScreen() {
  const router = useRouter();
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();
  const { overview: socialOverview, loading: socialLoading } = useSocial();
  const { overview: streakOverview, inviteFriend } = useStreaks();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const streakStatusByFriend = useMemo(() => new Map((streakOverview?.friends ?? []).map((friend) => [friend.userId, friend.duoStatus])), [streakOverview?.friends]);
  const friends = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (socialOverview?.friends ?? []).filter((friend) => !needle || friend.displayName.toLowerCase().includes(needle) || (friend.username ?? "").toLowerCase().includes(needle));
  }, [query, socialOverview?.friends]);

  async function sendInvite(friendId: string) {
    setBusyId(friendId);
    try {
      await inviteFriend(friendId);
    } catch {
      // The streak context presents request errors on the Streak screen.
    } finally {
      setBusyId(null);
    }
  }

  return <Screen padded={false} contentStyle={{ alignItems: "center", gap: 14 }}>
    <StatusBar style="dark" />
    <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, gap: 14, transform: [{ translateX: safeAreaOffset }] }}>
      <View style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton icon="chevron-back" label="Back to streaks" onPress={() => router.back()} color={T.dark} />
        <View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 23, fontWeight: "900" }}>Invite a friend</Text><Text style={{ color: T.muted, fontSize: 13, fontWeight: "700" }}>Choose a friend for a shared streak.</Text></View>
      </View>

      <View style={{ minHeight: 52, borderRadius: 18, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 9 }}>
        <Ionicons name="search" size={19} color={T.muted} />
        <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search your friends" placeholderTextColor={T.muted} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: T.dark, fontSize: 15, fontWeight: "700", paddingVertical: 0 }} />
        {query ? <Pressable accessibilityLabel="Clear search" onPress={() => setQuery("")}><Ionicons name="close-circle" size={19} color={T.muted} /></Pressable> : null}
      </View>
    </View>

    <ScrollView contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} contentContainerStyle={{ width: contentWidth, paddingHorizontal: horizontalPadding, paddingBottom: 32, gap: 10, transform: [{ translateX: safeAreaOffset }] }}>
      {socialLoading ? <View style={{ paddingVertical: 44, alignItems: "center", gap: 12 }}><ActivityIndicator color={STREAK_ORANGE} /><Text style={{ color: T.muted, fontWeight: "800" }}>Finding your friends…</Text></View> : friends.length ? <View style={{ backgroundColor: T.white, borderRadius: 22, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#e6ddd2", overflow: "hidden" }}>{friends.map((friend, index) => {
        const status = streakStatusByFriend.get(friend.userId);
        const unavailable = status === "active" || status === "pending" || status === "cooldown";
        const label = busyId === friend.userId ? "Sending…" : status === "active" ? "Streaking" : status === "pending" ? "Pending" : status === "cooldown" ? "Soon" : "Invite";
        return <View key={friend.userId} style={{ minHeight: 74, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, borderBottomWidth: index === friends.length - 1 ? 0 : 1.5, borderBottomColor: "#eee7e2" }}><FriendAvatar friend={friend} /><View style={{ flex: 1, gap: 2 }}><Text style={{ color: T.dark, fontSize: 16, fontWeight: "900" }} numberOfLines={1}>{friend.displayName}</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>{friend.username ? `@${friend.username}` : "QuestLife friend"}</Text></View><InviteButton label={label} disabled={unavailable || busyId === friend.userId} onPress={() => sendInvite(friend.userId)} /></View>;
      })}</View> : <EmptyState emoji="🫂" title={query ? "No friends found" : "No friends to invite yet"} body={query ? "Try a name or username from your friends list." : "Add friends in Social to start a shared streak."} />}
    </ScrollView>
  </Screen>;
}
