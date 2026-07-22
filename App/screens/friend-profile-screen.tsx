import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { Card, EmptyState, Header, IconButton, Screen, SoftButton, useResponsiveScreenLayout } from "@/components/ui";
import { T } from "@/components/theme";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useSocial } from "@/contexts/SocialContext";
import { fetchFriendProfile } from "@/services/social/socialService";
import { ProfileSearchResult } from "@/types/social";

export function FriendProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();
  const { overview, addFriend } = useSocial();
  const [profile, setProfile] = useState<ProfileSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    if (!userId) { setLoading(false); return; }
    fetchFriendProfile(userId).then((result) => { if (current) setProfile(result); }).catch(() => { if (current) setProfile(null); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [userId]);

  async function add() {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await addFriend(profile.userId);
      setProfile((current) => current ? { ...current, requestStatus: "pending:outgoing" } : null);
    } catch {
      Alert.alert("Couldn’t send request", "Please try again in a moment.");
    } finally { setSaving(false); }
  }

  const isMe = profile?.userId === overview?.me?.userId;
  const status = profile?.isFriend ? "You’re friends" : profile?.requestStatus ? "Friend request sent" : null;
  return <Screen padded={false} contentStyle={{ alignItems: "center", justifyContent: "center" }}>
    <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, gap: 16, transform: [{ translateX: safeAreaOffset }] }}>
      <Header title="Profile" subtitle="QuestLife adventurer" animated={false} right={<IconButton icon="arrow-back" label="Back to Add Friends" onPress={() => router.back()} color={T.dark} />} />
      {loading ? <EmptyState emoji="⏳" title="Opening profile" body="Loading this adventurer…" /> : !profile ? <EmptyState emoji="🧭" title="Profile unavailable" body="This QR code may be old, or the adventurer is no longer available." /> : <Card style={{ borderRadius: 28, padding: 24, gap: 16, alignItems: "center", borderColor: `${profile.avatarColor}55`, borderBottomWidth: 5, borderBottomColor: `${profile.avatarColor}88` }}>
        <ProfileAvatar uri={profile.avatarUrl} color={profile.avatarColor} size={92} label={`${profile.displayName}'s profile photo`} />
        <View style={{ alignItems: "center", gap: 4 }}><Text selectable style={{ color: T.dark, fontSize: 23, fontWeight: "900" }}>{profile.displayName}</Text><Text selectable style={{ color: T.muted, fontSize: 14, fontWeight: "700" }}>{profile.username ? `@${profile.username}` : "QuestLife adventurer"}</Text></View>
        {isMe ? <SoftButton label="This is your profile" icon="person" inverse color={T.muted} /> : status ? <View style={{ minHeight: 50, width: "100%", borderRadius: 17, backgroundColor: profile.isFriend ? `${T.green}16` : `${T.blue}16`, alignItems: "center", justifyContent: "center" }}><Text style={{ color: profile.isFriend ? T.green : T.blue, fontSize: 14, fontWeight: "900" }}>{status}</Text></View> : <SoftButton label={saving ? "Sending…" : "Add friend"} icon="person-add" color={T.blue} onPress={add} style={{ width: "100%" }} />}
      </Card>}
    </View>
  </Screen>;
}
