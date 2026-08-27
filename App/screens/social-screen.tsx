import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";

import { AddFriendIcon } from "@/components/add-friend-icon";
import { QuestFeedCard } from "@/components/quest-feed-card";
import { T } from "@/components/theme";
import { Card, EmptyState, haptic, Header, Screen, SoftButton, usePressGuard, useResponsiveScreenLayout } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useSocial } from "@/contexts/SocialContext";
import { fetchQuestSocialFeed } from "@/services/profile/profileService";
import { QuestFeedPost } from "@/types/profile";
import { FriendRequest, SocialFriend } from "@/types/social";

type Tab = "feed" | "friends";
type FeedScope = "public" | "friends";

function FeedScopeTab({ scope, active, onPress }: { scope: FeedScope; active: boolean; onPress: () => void }) {
  const icon = scope === "public" ? "globe-outline" : "people-outline";
  const label = scope === "public" ? "Public" : "Friends";
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={`${label} feed`} onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 66, alignItems: "center", justifyContent: "center", gap: 4, borderBottomWidth: 4, borderBottomColor: active ? T.blue : "transparent", opacity: pressed ? 0.68 : 1 })}><View style={{ width: 36, height: 30, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: active ? `${T.blue}14` : "transparent" }}><Ionicons name={icon} size={22} color={active ? T.blue : T.muted} /></View><Text style={{ color: active ? T.dark : T.muted, fontSize: 12, fontWeight: "900" }}>{label}</Text></Pressable>;
}

function AddFriendsButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Add friends" onPress={() => { haptic(); onPress(); }} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: T.white, borderWidth: 2, borderColor: T.blue, borderBottomWidth: pressed ? 2 : 4, borderBottomColor: `${T.blue}88`, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }, { translateY: pressed ? 2 : 0 }] })}><View style={{ width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: `${T.blue}16` }}><AddFriendIcon size={19} /></View></Pressable>;
}

function SocialFeedLoading() {
  return <View style={{ gap: 12 }}>{(["88%", "76%", "92%"] as const).map((width) => <View key={width} style={{ height: 180, width, alignSelf: "center", borderRadius: 22, backgroundColor: `${T.border}88` }} />)}</View>;
}

function SocialEmptyCard({ emoji, title, body, action }: { emoji: string; title: string; body: string; action?: ReactNode }) {
  return <Card><EmptyState emoji={emoji} title={title} body={body} action={action} /></Card>;
}

function FriendRequestCard({ request, onOpenProfile, onAccept, onDecline }: { request: FriendRequest; onOpenProfile: () => void; onAccept: () => void; onDecline: () => void }) {
  return <Card style={{ borderRadius: 20, gap: 10 }}><Pressable onPress={onOpenProfile}><Text style={{ color: T.dark, fontSize: 16, fontWeight: "900" }}>{request.displayName}</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>wants to be friends</Text></Pressable><View style={{ flexDirection: "row", gap: 10 }}><SoftButton label="Accept" icon="checkmark" color={T.green} onPress={onAccept} style={{ flex: 1, minHeight: 42 }} /><SoftButton label="Decline" inverse color={T.muted} onPress={onDecline} style={{ flex: 1, minHeight: 42 }} /></View></Card>;
}

function FriendCard({ friend, onOpenProfile }: { friend: SocialFriend; onOpenProfile: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${friend.displayName}'s profile`} onPress={onOpenProfile}><Card style={{ borderRadius: 20, paddingVertical: 13 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: friend.avatarColor, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 20 }}>{friend.emoji}</Text></View><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 15, fontWeight: "900" }}>{friend.displayName}</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>{friend.lastQuestTitle ?? "Ready for a new quest"}</Text></View><Ionicons name="chevron-forward" size={18} color={T.muted} /></View></Card></Pressable>;
}

export function SocialScreen() {
  const router = useRouter();
  const { tab: requestedTab } = useLocalSearchParams<{ tab?: string }>();
  const guardPress = usePressGuard();
  const { contentWidth, horizontalPadding, safeAreaOffset, insets } = useResponsiveScreenLayout();
  const { profileNameVersion } = useAuth();
  const { overview, loading, error, refresh, respondRequest } = useSocial();
  const [tab, setTab] = useState<Tab>("feed");
  const [feedScope, setFeedScope] = useState<FeedScope>("public");
  const [feed, setFeed] = useState<QuestFeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [activeFeedIndex, setActiveFeedIndex] = useState(0);
  const feedRequestIdRef = useRef(0);

  useFocusEffect(useCallback(() => setTab(requestedTab === "friends" ? "friends" : "feed"), [requestedTab]));

  const loadFeed = useCallback(async () => {
    const requestId = ++feedRequestIdRef.current;
    setFeedLoading(true);
    setFeedError(null);
    try {
      const nextFeed = await fetchQuestSocialFeed(feedScope);
      if (requestId === feedRequestIdRef.current) {
        setFeed(nextFeed);
        setActiveFeedIndex(0);
      }
    } catch (nextError) {
      if (requestId === feedRequestIdRef.current) setFeedError(nextError instanceof Error ? nextError.message : "We couldn’t load the feed.");
    } finally {
      if (requestId === feedRequestIdRef.current) setFeedLoading(false);
    }
  }, [feedScope]);

  useEffect(() => { void loadFeed(); }, [loadFeed, profileNameVersion]);
  const onFeedViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null; isViewable: boolean }> }) => {
    const index = viewableItems.find((item) => item.isViewable && item.index !== null)?.index;
    if (typeof index === "number") setActiveFeedIndex(index);
  }).current;
  const renderFeedItem = useCallback(({ item, index }: { item: QuestFeedPost; index: number }) => <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }}><QuestFeedCard post={item} loadMedia={Math.abs(index - activeFeedIndex) <= 3} /></View>, [activeFeedIndex, contentWidth, horizontalPadding, safeAreaOffset]);

  return <Screen scroll={false} padded={false} contentStyle={{ alignItems: "center", paddingTop: Math.max(insets.top - 12, 12) }}>
    <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, gap: 14, transform: [{ translateX: safeAreaOffset }] }}>
      <Header title="Social" subtitle="Quest crew updates" animated={false} right={tab === "friends" ? <AddFriendsButton onPress={() => guardPress(() => router.push("/add-friends"))} /> : undefined} />
      <View style={{ flexDirection: "row", padding: 4, borderRadius: 24, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }}>{(["feed", "friends"] as Tab[]).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} accessibilityLabel={`${item} tab`} onPress={() => { haptic(); setTab(item); }} style={({ pressed }) => ({ flex: 1, minHeight: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tab === item ? T.dark : "transparent", opacity: pressed ? 0.8 : 1 })}><Text style={{ color: tab === item ? T.white : T.muted, fontSize: 13, fontWeight: "900", textTransform: "capitalize" }}>{item}</Text></Pressable>)}</View>
      {tab === "feed" ? <View style={{ marginTop: 3, paddingTop: 13, borderTopWidth: 1, borderTopColor: "rgba(232,223,213,0.82)" }}><View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 2, borderBottomColor: T.border }}>{(["public", "friends"] as FeedScope[]).map((scope) => <FeedScopeTab key={scope} scope={scope} active={feedScope === scope} onPress={() => setFeedScope(scope)} />)}</View></View> : null}
    </View>
    {tab === "feed" ? <FlatList data={feed} keyExtractor={(post) => post.id} renderItem={renderFeedItem} style={{ flex: 1, width: "100%" }} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingTop: 20, paddingBottom: 112, gap: 16 }} onViewableItemsChanged={onFeedViewableItemsChanged} ListHeaderComponent={feedError ? <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding }}><Card><Text style={{ color: T.red, fontWeight: "800" }}>{feedError}</Text><SoftButton label="Try again" icon="refresh" inverse color={T.blue} onPress={() => void loadFeed()} /></Card></View> : null} ListEmptyComponent={feedLoading ? <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding }}><SocialFeedLoading /></View> : <View style={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, transform: [{ translateX: safeAreaOffset }] }}><SocialEmptyCard emoji={feedScope === "public" ? "🌍" : "🤝"} title={feedScope === "public" ? "No public posts yet" : "Your Friends feed is quiet"} body={feedScope === "public" ? "When someone shares a completed quest, their story will appear here." : "Follow friends to see the quests they choose to share."} action={<SoftButton label={feedScope === "public" ? "Explore quests" : "Find friends"} icon={feedScope === "public" ? "compass" : "person-add"} color={T.blue} onPress={() => router.push(feedScope === "public" ? "/(tabs)/explore" : "/add-friends")} />} /></View>} /> : <ScrollView style={{ flex: 1, width: "100%" }} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingTop: 20, paddingBottom: 112 }}><View style={{ flex: 1, width: contentWidth, paddingHorizontal: horizontalPadding, gap: 16, transform: [{ translateX: safeAreaOffset }] }}>{error ? <Card><Text style={{ color: T.red, fontWeight: "800" }}>{error}</Text><SoftButton label="Retry" icon="refresh" inverse color={T.blue} onPress={refresh} /></Card> : null}{overview?.incomingRequests.length ? <View style={{ gap: 9 }}><Text style={{ color: T.muted, fontSize: 13, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Friend requests</Text>{overview.incomingRequests.map((request) => <FriendRequestCard key={request.id} request={request} onOpenProfile={() => router.push(`/add-friend/${request.userId}`)} onAccept={() => void respondRequest(request.id, true)} onDecline={() => void respondRequest(request.id, false)} />)}</View> : null}<View style={{ flex: 1, gap: 10 }}>{overview?.friends.length ? <><Text style={{ color: T.muted, fontSize: 13, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Friends · {overview.friends.length}</Text>{overview.friends.map((friend) => <FriendCard key={friend.userId} friend={friend} onOpenProfile={() => router.push(`/add-friend/${friend.userId}`)} />)}</> : loading && !overview ? <SocialEmptyCard emoji="⏳" title="Finding your crew" body="Loading your friends…" /> : <SocialEmptyCard emoji="👋" title="Your crew starts here" body="Add friends to see their progress and share quests together." action={<SoftButton label="Add friends" icon="person-add" color={T.blue} onPress={() => router.push("/add-friends")} />} />}</View></View></ScrollView>}
  </Screen>;
}
