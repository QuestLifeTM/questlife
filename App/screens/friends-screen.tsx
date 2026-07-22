import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { T } from "@/components/theme";
import { ProfileAvatar } from "@/components/profile-avatar";
import { EmptyState, Header, IconButton, Screen, SoftButton, useResponsiveScreenLayout } from "@/components/ui";
import { useSocial } from "@/contexts/SocialContext";
import { SocialFriend } from "@/types/social";

function FriendAvatar({ friend }: { friend: SocialFriend }) { return <ProfileAvatar uri={friend.avatarUrl} color={friend.avatarColor} size={48} label={`${friend.displayName}'s profile photo`} />; }

function FriendRow({ friend }: { friend: SocialFriend }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${friend.displayName}`} style={({ pressed }) => ({ minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
    <FriendAvatar friend={friend} />
    <View style={{ flex: 1, gap: 3 }}><Text numberOfLines={1} style={{ color: T.dark, fontSize: 16, fontWeight: "900" }}>{friend.displayName}</Text><Text numberOfLines={1} style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>{friend.username ? `@${friend.username}` : "QuestLife friend"}</Text></View>
    <Ionicons name="chevron-forward" size={19} color={T.muted} />
  </Pressable>;
}

export function FriendsScreen() {
  const router = useRouter();
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();
  const { overview, loading } = useSocial();
  const [query, setQuery] = useState("");
  const friends = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (overview?.friends ?? []).filter((friend) => !needle || friend.displayName.toLowerCase().includes(needle) || (friend.username ?? "").toLowerCase().includes(needle));
  }, [overview?.friends, query]);

  return <Screen padded={false} contentStyle={{ alignItems: "center" }}>
    <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, gap: 16, transform: [{ translateX: safeAreaOffset }] }}>
      <Header title="Friends" subtitle="Your quest crew" animated={false} right={<IconButton icon="arrow-back" label="Back to Social" onPress={() => router.back()} color={T.dark} />} />
      <SoftButton label="Find friends" icon="person-add" color={T.blue} onPress={() => router.push("/add-friends")} style={{ minHeight: 54, borderRadius: 19 }} />
      <View style={{ height: 52, borderRadius: 18, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 9 }}><Ionicons name="search" size={19} color={T.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search your friends" placeholderTextColor={T.muted} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: T.dark, fontSize: 15, fontWeight: "700", paddingVertical: 0 }} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear friend search" onPress={() => setQuery("")} hitSlop={6}><Ionicons name="close-circle" size={20} color={T.muted} /></Pressable> : null}</View>
      <View style={{ gap: 8 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}><Text style={{ color: T.dark, fontSize: 13, fontWeight: "900", letterSpacing: 0.55, textTransform: "uppercase" }}>{query ? "Search results" : "Your friends"}</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>{friends.length}</Text></View>{loading && !overview ? <EmptyState emoji="⏳" title="Finding your crew" body="Loading your friends…" /> : friends.length ? <View style={{ borderRadius: 22, paddingHorizontal: 14, paddingVertical: 3, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#e6ddd2" }}>{friends.map((friend, index) => <View key={friend.userId} style={{ borderBottomWidth: index === friends.length - 1 ? 0 : 1, borderBottomColor: T.border }}><FriendRow friend={friend} /></View>)}</View> : <EmptyState emoji={query ? "🔎" : "👋"} title={query ? "No friends found" : "Your crew starts here"} body={query ? "Try another name or username." : "Find people to share quests and Party invites with."} />}</View>
    </View>
  </Screen>;
}
