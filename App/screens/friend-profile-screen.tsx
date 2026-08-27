import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
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
  const { overview: socialOverview, follow, unfollow } = useSocial();
  const [profile, setProfile] = useState<ProfileSearchResult | null>(null);
  const [profileOverview, setProfileOverview] = useState<ProfileOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unfollowOpen, setUnfollowOpen] = useState(false);

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

  async function startFollowing() {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await follow(profile.userId);
      setProfile((current) => current ? { ...current, isFollowing: true, isFriend: current.followsYou } : null);
    } catch {
      Alert.alert("Couldn’t follow", "Please try again in a moment.");
    } finally { setSaving(false); }
  }

  async function stopFollowing() {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await unfollow(profile.userId);
      setProfile((current) => current ? { ...current, isFollowing: false, isFriend: false } : null);
      setUnfollowOpen(false);
    } catch {
      Alert.alert("Couldn’t unfollow", "Please try again in a moment.");
    } finally { setSaving(false); }
  }

  const isMe = profile?.userId === socialOverview?.me?.userId;
  const isFollowing = profile?.isFollowing ?? false;
  const followsYou = profile?.followsYou ?? false;
  const friend = profileOverview?.profile;
  const visibility = friend?.statVisibility ?? DEFAULT_PROFILE_STAT_VISIBILITY;
  const profilePosts = useMemo<QuestFeedPost[]>(() => !friend || !profileOverview ? [] : profileOverview.posts.map((post) => ({ ...post, durationSeconds: post.durationSeconds ?? null, userId: friend.userId, username: friend.username, displayName: friend.displayName, emoji: friend.emoji, avatarColor: friend.avatarColor, avatarUrl: friend.avatarUrl, commentCount: 0 })), [friend, profileOverview]);
  const postTileSize = (contentWidth - horizontalPadding * 2 - 12) / 3;
  const { onScroll, scrollY } = useTopScrollBlur();

  return <Screen padded={false} scroll={false} contentStyle={{ alignItems: "center", paddingTop: Math.max(insets.top - 12, 12) }}>
    <Reanimated.ScrollView onScroll={onScroll} scrollEventThrottle={16} style={{ width: "100%" }} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} contentContainerStyle={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, paddingTop: 0, paddingBottom: 112, gap: 18, transform: [{ translateX: safeAreaOffset }] }}>
      <View style={{ minHeight: 50, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, color: T.dark, fontFamily: "RubikBold", fontSize: 18, lineHeight: 23 }}>{profile?.username ? `@${profile.username}` : "Profile"}</Text>
        </View>
      </View>
      {loading ? <ProfileLoadingSkeleton includeHeader={false} /> : !profile ? <EmptyState emoji="🧭" title="Profile unavailable" body="This QR code may be old, or the adventurer is no longer available." /> : friend && profileOverview ? <>
        <View style={{ width: "100%", alignItems: "center", paddingTop: 2 }}>
          <ProfileAvatar uri={friend.avatarUrl} color={friend.avatarColor} size={98} label={`${friend.displayName}'s profile photo`} />
          <Text style={{ color: T.dark, marginTop: 10, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 28, textAlign: "center" }}>{friend.displayName}</Text>
          <Text style={{ color: T.muted, marginTop: 3, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18, textAlign: "center" }}>{friend.username ? `@${friend.username}` : "QuestLife adventurer"}</Text>
          <ProfileTitleBadge title={friend.title} />
          {friend.bio ? <Text style={{ maxWidth: 286, color: T.muted, marginTop: 8, fontFamily: "Rubik", fontSize: 14, lineHeight: 20, textAlign: "center" }}>{friend.bio}</Text> : null}
          <View style={{ width: contentWidth, alignSelf: "stretch", marginHorizontal: -horizontalPadding, marginTop: 15 }}><ProfileStatMarquee overview={profileOverview} visibility={visibility} /></View>
          {isMe ? <SoftButton label="This is your profile" icon="person" inverse color={T.muted} style={{ width: "100%", marginTop: 14 }} /> : isFollowing ? <FollowStatusButton mutual={followsYou} saving={saving} onPress={() => setUnfollowOpen(true)} /> : <SoftButton label={saving ? "Following…" : "Follow"} icon="person-add" color={T.blue} onPress={() => void startFollowing()} style={{ width: "100%", marginTop: 14 }} />}
        </View>
        <View style={{ width: "100%", marginTop: 16 }}>{profilePosts.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 6, rowGap: 6 }}>{profilePosts.map((post) => <QuestFeedThumbnail key={post.id} post={post} size={postTileSize} />)}</View> : <EmptyState emoji="📷" title="No posts yet" body="This adventurer has not shared a quest post yet." />}</View>
      </> : <View style={{ width: "100%", alignItems: "center", paddingTop: 2 }}><ProfileAvatar uri={profile.avatarUrl} color={profile.avatarColor} size={98} label={`${profile.displayName}'s profile photo`} /><Text selectable style={{ color: T.dark, marginTop: 10, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 28, textAlign: "center" }}>{profile.displayName}</Text><Text style={{ color: T.muted, marginTop: 3, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18, textAlign: "center" }}>{profile.username ? `@${profile.username}` : "QuestLife adventurer"}</Text>{isMe ? <SoftButton label="This is your profile" icon="person" inverse color={T.muted} style={{ width: "100%", marginTop: 14 }} /> : isFollowing ? <FollowStatusButton mutual={followsYou} saving={saving} onPress={() => setUnfollowOpen(true)} /> : <SoftButton label={saving ? "Following…" : "Follow"} icon="person-add" color={T.blue} onPress={() => void startFollowing()} style={{ width: "100%", marginTop: 14 }} />}</View>}
    </Reanimated.ScrollView>
    <ScrollTopBlur scrollY={scrollY} />
    <Sheet visible={unfollowOpen} onClose={() => setUnfollowOpen(false)} maxHeight="46%"><View style={{ paddingHorizontal: 24, paddingBottom: 20, gap: 13 }}><View style={{ width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: `${T.blue}15` }}><Ionicons name="person-remove" size={23} color={T.blue} /></View><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 21 }}>Unfollow {profile?.displayName}?</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 13, lineHeight: 19 }}>You won’t see their activity or appear on each other’s friends leaderboard. They won’t be notified. This won’t remove them as your follower if they follow you.</Text><View style={{ flexDirection: "row", gap: 9, marginTop: 2 }}><Pressable accessibilityRole="button" onPress={() => setUnfollowOpen(false)} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 13 }}>Cancel</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void stopFollowing()} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: T.red, opacity: saving ? 0.5 : pressed ? 0.7 : 1 })}><Text style={{ color: T.white, fontFamily: "RubikBold", fontSize: 13 }}>{saving ? "Unfollowing…" : "Unfollow"}</Text></Pressable></View></View></Sheet>
  </Screen>;
}

function FollowStatusButton({ mutual, saving, onPress }: { mutual: boolean; saving: boolean; onPress: () => void }) {
  const color = mutual ? T.green : T.blue;
  return <Pressable accessibilityRole="button" accessibilityLabel="Following. Open unfollow options" onPress={onPress} style={({ pressed }) => ({ width: "100%", minHeight: 52, marginTop: 14, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, backgroundColor: `${color}16`, borderWidth: 1.5, borderColor: `${color}44`, opacity: saving ? 0.5 : pressed ? 0.7 : 1 })}><Text style={{ color, fontFamily: "RubikBold", fontSize: 15 }}>Following</Text><Ionicons name="checkmark" size={17} color={color} /><Ionicons name="chevron-down" size={15} color={color} /></Pressable>;
}
