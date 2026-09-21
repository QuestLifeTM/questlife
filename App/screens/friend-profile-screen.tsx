import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import Reanimated from "react-native-reanimated";

import { ProfileAvatar } from "@/components/profile-avatar";
import { QuestFeedThumbnail } from "@/components/quest-feed-card";
import { T } from "@/components/theme";
import { EmptyState, IconButton, Screen, Sheet, SoftButton, useResponsiveScreenLayout } from "@/components/ui";
import { ScrollTopBlur, useTopScrollBlur } from "@/components/scroll-top-blur";
import { useSocial } from "@/contexts/SocialContext";
import { ProfileLoadingSkeleton, ProfileStatMarquee, ProfileTitleBadge } from "@/screens/profile-screen";
import { DEFAULT_PROFILE_STAT_VISIBILITY, fetchProfileOverview } from "@/services/profile/profileService";
import { fetchFriendProfile } from "@/services/social/socialService";
import { ProfileOverview, QuestFeedPost } from "@/types/profile";
import { ProfileSearchResult } from "@/types/social";

export function FriendProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { contentWidth, horizontalPadding, insets, safeAreaOffset } = useResponsiveScreenLayout();
  const { overview: socialOverview, addFriend, unfriend } = useSocial();
  const [profile, setProfile] = useState<ProfileSearchResult | null>(null);
  const [profileOverview, setProfileOverview] = useState<ProfileOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unfollowOpen, setUnfollowOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let current = true;
    if (!userId) { setLoading(false); return; }
    Promise.all([
      fetchFriendProfile(userId).catch(() => null),
      fetchProfileOverview(userId).catch(() => null),
    ]).then(([nextProfile, nextOverview]) => {
      if (!current) return;
      setProfile(nextProfile);
      setProfileOverview(nextOverview);
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [userId]);

  async function sendFriendRequest() {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await addFriend(profile.userId);
      setProfile((current) => current ? {
        ...current,
        isFriend: current.requestStatus === "pending:incoming",
        requestStatus: current.requestStatus === "pending:incoming" ? null : "pending:outgoing",
      } : null);
    } catch {
      Alert.alert("Couldn’t send friend request", "Please try again in a moment.");
    } finally { setSaving(false); }
  }

  async function removeFriend() {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await unfriend(profile.userId);
      setProfile((current) => current ? { ...current, isFriend: false } : null);
      setUnfollowOpen(false);
    } catch {
      Alert.alert("Couldn’t remove friend", "Please try again in a moment.");
    } finally { setSaving(false); }
  }

  const isMe = profile?.userId === socialOverview?.me?.userId;
  const isFriend = profile?.isFriend ?? false;
  const requestSent = profile?.requestStatus === "pending:outgoing";
  const requestReceived = profile?.requestStatus === "pending:incoming";
  const friend = profileOverview?.profile;
  const visibility = friend?.statVisibility ?? DEFAULT_PROFILE_STAT_VISIBILITY;
  const profilePosts = useMemo<QuestFeedPost[]>(() => !friend || !profileOverview ? [] : profileOverview.posts.map((post) => ({ ...post, durationSeconds: post.durationSeconds ?? null, userId: friend.userId, username: friend.username, displayName: friend.displayName, emoji: friend.emoji, avatarColor: friend.avatarColor, avatarUrl: friend.avatarUrl, commentCount: 0 })), [friend, profileOverview]);
  const postTileSize = (contentWidth - horizontalPadding * 2 - 12) / 3;
  const { onScroll, scrollY } = useTopScrollBlur();
  const shareProfile = async () => {
    const name = friend?.displayName ?? profile?.displayName ?? "this adventurer";
    await Share.share({ message: `Check out ${name}'s profile on QuestLife.` }).catch(() => undefined);
    setMoreOpen(false);
  };

  return <Screen padded={false} scroll={false} contentStyle={{ alignItems: "center", paddingTop: Math.max(insets.top - 12, 12) }}>
    <Reanimated.ScrollView onScroll={onScroll} scrollEventThrottle={16} style={{ width: "100%" }} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} contentContainerStyle={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, paddingTop: 0, paddingBottom: 112, gap: 18, transform: [{ translateX: safeAreaOffset }] }}>
      <View style={{ minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} size={44} />
        <Text accessibilityRole="header" style={{ position: "absolute", right: 52, left: 52, color: T.dark, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 28, textAlign: "center" }}>Profile</Text>
        <IconButton icon="ellipsis-horizontal" label="Profile options" color={T.dark} onPress={() => setMoreOpen(true)} size={44} />
      </View>
      {loading ? <ProfileLoadingSkeleton includeHeader={false} /> : !profile ? <EmptyState emoji="🧭" title="Profile unavailable" body="This QR code may be old, or the adventurer is no longer available." /> : friend && profileOverview ? <>
        <View style={{ width: "100%", alignItems: "center", paddingTop: 2 }}>
          <ProfileAvatar uri={friend.avatarUrl} color={friend.avatarColor} size={98} label={`${friend.displayName}'s profile photo`} />
          <Text style={{ color: T.dark, marginTop: 10, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 28, textAlign: "center" }}>{friend.displayName}</Text>
          <Text style={{ color: T.muted, marginTop: 3, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18, textAlign: "center" }}>{friend.username ? `@${friend.username}` : "QuestLife adventurer"}</Text>
          <ProfileTitleBadge title={friend.title} />
          {friend.bio ? <Text style={{ maxWidth: 286, color: T.muted, marginTop: 8, fontFamily: "Rubik", fontSize: 14, lineHeight: 20, textAlign: "center" }}>{friend.bio}</Text> : null}
          <View style={{ width: contentWidth, alignSelf: "stretch", marginHorizontal: -horizontalPadding, marginTop: 15 }}><ProfileStatMarquee overview={profileOverview} visibility={visibility} /></View>
          {isMe ? <SoftButton label="This is your profile" icon="person" inverse color={T.muted} style={{ width: "100%", marginTop: 14 }} /> : isFriend ? <FriendsButton saving={saving} onPress={() => setUnfollowOpen(true)} /> : requestSent ? <FriendRequestSentButton /> : <SoftButton label={saving ? "Sending request…" : requestReceived ? "Accept friend request" : "Add friend"} icon={requestReceived ? "checkmark" : "person-add"} color={T.blue} onPress={() => void sendFriendRequest()} style={{ width: "100%", marginTop: 14 }} />}
        </View>
        <View style={{ width: "100%", marginTop: 16 }}>{profilePosts.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 6, rowGap: 6 }}>{profilePosts.map((post) => <QuestFeedThumbnail key={post.id} post={post} size={postTileSize} />)}</View> : <EmptyState emoji="📷" title="No posts yet" body="This adventurer has not shared a quest post yet." />}</View>
      </> : <View style={{ width: "100%", alignItems: "center", paddingTop: 2 }}><ProfileAvatar uri={profile.avatarUrl} color={profile.avatarColor} size={98} label={`${profile.displayName}'s profile photo`} /><Text selectable style={{ color: T.dark, marginTop: 10, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 28, textAlign: "center" }}>{profile.displayName}</Text><Text style={{ color: T.muted, marginTop: 3, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18, textAlign: "center" }}>{profile.username ? `@${profile.username}` : "QuestLife adventurer"}</Text>{isMe ? <SoftButton label="This is your profile" icon="person" inverse color={T.muted} style={{ width: "100%", marginTop: 14 }} /> : isFriend ? <FriendsButton saving={saving} onPress={() => setUnfollowOpen(true)} /> : requestSent ? <FriendRequestSentButton /> : <SoftButton label={saving ? "Sending request…" : requestReceived ? "Accept friend request" : "Add friend"} icon={requestReceived ? "checkmark" : "person-add"} color={T.blue} onPress={() => void sendFriendRequest()} style={{ width: "100%", marginTop: 14 }} />}</View>}
    </Reanimated.ScrollView>
    <ScrollTopBlur scrollY={scrollY} />
    <Sheet visible={moreOpen} onClose={() => setMoreOpen(false)} maxHeight="42%"><View style={{ paddingHorizontal: 24, paddingBottom: 22, gap: 16 }}><View style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12 }}><ProfileAvatar uri={friend?.avatarUrl ?? profile?.avatarUrl ?? null} color={friend?.avatarColor ?? profile?.avatarColor ?? T.blue} size={56} label={`${friend?.displayName ?? profile?.displayName ?? "Adventurer"}'s profile photo`} /><View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text numberOfLines={1} style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20, lineHeight: 25 }}>{friend?.displayName ?? profile?.displayName ?? "QuestLife adventurer"}</Text><Text numberOfLines={1} style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18 }}>{profile?.username ? `@${profile.username}` : "QuestLife adventurer"}</Text></View></View><SoftButton label="Share profile" icon="share-outline" color={T.blue} onPress={() => void shareProfile()} /><SoftButton label="Cancel" inverse color={T.muted} onPress={() => setMoreOpen(false)} /></View></Sheet>
    <Sheet visible={unfollowOpen} onClose={() => setUnfollowOpen(false)} maxHeight="42%"><View style={{ paddingHorizontal: 24, paddingBottom: 20, gap: 13 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 21 }}>Remove {profile?.displayName}?</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 13, lineHeight: 19 }}>You won’t see their activity or appear on each other’s friends leaderboard. They won’t be notified.</Text><View style={{ flexDirection: "row", gap: 9, marginTop: 2 }}><Pressable accessibilityRole="button" onPress={() => setUnfollowOpen(false)} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 13 }}>Cancel</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void removeFriend()} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: T.red, opacity: saving ? 0.5 : pressed ? 0.7 : 1 })}><Text style={{ color: T.white, fontFamily: "RubikBold", fontSize: 13 }}>{saving ? "Removing…" : "Remove"}</Text></Pressable></View></View></Sheet>
  </Screen>;
}

function FriendRequestSentButton() {
  return <View accessibilityRole="text" style={{ width: "100%", minHeight: 52, marginTop: 14, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, backgroundColor: `${T.blue}16`, borderWidth: 1.5, borderColor: `${T.blue}44` }}><Ionicons name="time-outline" size={18} color={T.blue} /><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 15 }}>Friend request sent</Text></View>;
}

function FriendsButton({ saving, onPress }: { saving: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Friends. Open friend options" onPress={onPress} style={({ pressed }) => ({ width: "100%", minHeight: 52, marginTop: 14, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, backgroundColor: `${T.green}16`, borderWidth: 1.5, borderColor: `${T.green}44`, opacity: saving ? 0.5 : pressed ? 0.7 : 1 })}><Text style={{ color: T.green, fontFamily: "RubikBold", fontSize: 15 }}>Friends</Text><Ionicons name="checkmark" size={17} color={T.green} /><Ionicons name="chevron-down" size={15} color={T.green} /></Pressable>;
}
