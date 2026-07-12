import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { T } from "@/components/theme";
import { Card, EmptyState, Header, IconButton, PillStat, Screen, Sheet, SoftButton, useResponsiveScreenLayout } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { createQuestPost, fetchProfileOverview, togglePostLike, updateProfile } from "@/services/profile/profileService";
import { ProfileOverview, QuestPost, levelForXp } from "@/types/profile";

export function ProfileScreen() {
  const { signOut } = useAuth();
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();
  const [overview, setOverview] = useState<ProfileOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<QuestPost | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ displayName: "", username: "", bio: "", emoji: "😊", title: "" });
  const [postForm, setPostForm] = useState({ questId: "", caption: "", visibility: "friends" as "public" | "friends" | "private" });

  async function load() {
    setLoading(true);
    try {
      const data = await fetchProfileOverview();
      if (!data.profile) {
        setOverview(null);
        return;
      }

      setOverview(data);
      setEditForm({
        displayName: data.profile.displayName,
        username: data.profile.username ?? "",
        bio: data.profile.bio ?? "",
        emoji: data.profile.emoji,
        title: data.profile.title ?? "",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const level = overview?.profile ? levelForXp(overview.profile.totalXp) : { level: 1, progress: 0, intoLevel: 0, toNext: 500 };

  async function saveProfile() {
    await updateProfile(editForm);
    setEditOpen(false);
    await load();
  }

  async function publishPost() {
    if (!postForm.questId) return;
    await createQuestPost({ questId: postForm.questId, caption: postForm.caption, visibility: postForm.visibility });
    setCreateOpen(false);
    setPostForm({ questId: "", caption: "", visibility: "friends" });
    await load();
  }

  async function toggleLike(post: QuestPost) {
    await togglePostLike(post.id, post.likedByMe);
    await load();
  }

  async function confirmSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      setSignOutOpen(false);
      // The root auth guard redirects to Login after the session is cleared.
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "We couldn't sign you out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  if (loading && !overview) {
    return (
      <Screen>
        <EmptyState emoji="⏳" title="Loading profile" body="Gathering your stats..." />
      </Screen>
    );
  }

  if (!overview?.profile) {
    return (
      <Screen>
        <EmptyState emoji="!" title="Profile unavailable" body="Sign in to view your profile." />
      </Screen>
    );
  }

  const { profile, stats, posts, recentCompletions } = overview;

  return (
    <Screen padded={false} contentStyle={{ alignItems: "center" }}>
      <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, gap: 18, transform: [{ translateX: safeAreaOffset }] }}>
        <Header title="Profile" subtitle="Your quest identity" right={<IconButton icon="settings-outline" onPress={() => setEditOpen(true)} />} animated={false} />

        <Card style={{ borderRadius: 28, gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: `${profile.avatarColor}22`, borderWidth: 3, borderColor: profile.avatarColor, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 34 }}>{profile.emoji}</Text>
            </View>
            <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-around" }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>{stats.totalQuests}</Text>
                <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>Quests</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>{level.level}</Text>
                <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>Level</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>{stats.friendsCount}</Text>
                <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>Friends</Text>
              </View>
            </View>
          </View>
          <View>
            <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>{profile.displayName}</Text>
            {profile.title ? <Text style={{ color: T.blue, fontWeight: "800", marginTop: 2 }}>{profile.title}</Text> : null}
            <Text style={{ color: T.muted, fontWeight: "700", marginTop: 4 }}>@{profile.username}</Text>
            {profile.bio ? <Text style={{ color: T.dark, fontWeight: "600", marginTop: 8, lineHeight: 20 }}>{profile.bio}</Text> : null}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <PillStat icon="flame" text={`${stats.currentStreak} streak`} color={T.orange} />
            <PillStat icon="flash" text={`${profile.totalXp} XP`} />
          </View>
          <SoftButton label="Edit profile" icon="create-outline" inverse color={T.blue} onPress={() => setEditOpen(true)} />
        </Card>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>Quest posts</Text>
          <SoftButton label="New post" icon="add" onPress={() => setCreateOpen(true)} color={T.blue} style={{ minHeight: 38, paddingHorizontal: 14 }} />
        </View>

        {posts.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {posts.map((post) => (
              <Pressable key={post.id} onPress={() => setSelectedPost(post)} style={{ width: "48.5%", aspectRatio: 1, borderRadius: 18, overflow: "hidden", borderWidth: 2, borderColor: T.border }}>
                {post.photoUrls[0] ? (
                  <Image source={{ uri: post.photoUrls[0] }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <View style={{ flex: 1, backgroundColor: `${post.questColor}22`, alignItems: "center", justifyContent: "center", padding: 10 }}>
                    <Text style={{ color: T.dark, fontWeight: "900", textAlign: "center", fontSize: 13 }} numberOfLines={3}>{post.questTitle}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState emoji="📸" title="No posts yet" body="Share a completed quest to show friends what you've been up to." />
        )}
      </View>

      <Sheet visible={editOpen} onClose={() => setEditOpen(false)} maxHeight="88%">
        <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
          <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Edit profile</Text>
          {(["displayName", "username", "bio", "emoji", "title"] as const).map((field) => (
            <TextInput
              key={field}
              value={editForm[field]}
              onChangeText={(v) => setEditForm((f) => ({ ...f, [field]: v }))}
              placeholder={field}
              placeholderTextColor={T.muted}
              style={{ borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 14, color: T.dark, fontWeight: "700" }}
            />
          ))}
          <SoftButton label="Save" icon="checkmark" onPress={saveProfile} />
          <View style={{ marginTop: 8, paddingTop: 14, borderTopWidth: 2, borderTopColor: T.border, gap: 8 }}>
            <Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>Account</Text>
            <SoftButton label="Sign out" icon="log-out-outline" inverse color={T.red} onPress={() => { setEditOpen(false); setSignOutOpen(true); }} />
          </View>
        </ScrollView>
      </Sheet>

      <Sheet visible={signOutOpen} onClose={() => !signingOut && setSignOutOpen(false)}>
        <View style={{ padding: 24, gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: `${T.red}16`, alignItems: "center", justifyContent: "center" }}><Ionicons name="log-out-outline" size={24} color={T.red} /></View>
          <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Sign out?</Text>
          <Text style={{ color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "700" }}>You’ll be signed out on this device. Your quests, memories, and Party progress stay safely in your account.</Text>
          {signOutError ? <Text accessibilityRole="alert" style={{ color: T.red, fontSize: 12, lineHeight: 18, fontWeight: "800" }}>{signOutError}</Text> : null}
          <SoftButton label={signingOut ? "Signing out…" : "Sign out"} icon="log-out-outline" inverse color={T.red} onPress={confirmSignOut} />
          <SoftButton label="Stay signed in" inverse color={T.muted} onPress={() => { if (!signingOut) setSignOutOpen(false); }} />
        </View>
      </Sheet>

      <Sheet visible={createOpen} onClose={() => setCreateOpen(false)} maxHeight="88%">
        <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
          <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Create post</Text>
          <Text style={{ color: T.muted, fontWeight: "800", fontSize: 12, textTransform: "uppercase" }}>Pick a completed quest</Text>
          {recentCompletions.map((c) => (
            <Pressable key={c.completionId} onPress={() => setPostForm((f) => ({ ...f, questId: c.questId }))} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
              <Ionicons name={postForm.questId === c.questId ? "radio-button-on" : "radio-button-off"} size={18} color={T.blue} />
              <Text style={{ color: T.dark, fontWeight: "800" }}>{c.questTitle}</Text>
            </Pressable>
          ))}
          <TextInput value={postForm.caption} onChangeText={(v) => setPostForm((f) => ({ ...f, caption: v }))} placeholder="Caption..." placeholderTextColor={T.muted} multiline style={{ minHeight: 80, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 14, color: T.dark, fontWeight: "700", textAlignVertical: "top" }} />
          <SoftButton label="Post" icon="send" onPress={publishPost} />
        </ScrollView>
      </Sheet>

      <Sheet visible={selectedPost !== null} onClose={() => setSelectedPost(null)}>
        {selectedPost ? (
          <View style={{ padding: 24, gap: 14 }}>
            <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>{selectedPost.questTitle}</Text>
            {selectedPost.caption ? <Text style={{ color: T.muted, fontWeight: "700", lineHeight: 20 }}>{selectedPost.caption}</Text> : null}
            <Pressable onPress={() => toggleLike(selectedPost)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name={selectedPost.likedByMe ? "heart" : "heart-outline"} size={22} color={T.red} />
              <Text style={{ color: T.dark, fontWeight: "900" }}>{selectedPost.likeCount}</Text>
            </Pressable>
            <Link href={`/quest/${selectedPost.questId}`} asChild>
              <Pressable><SoftButton label="Do this quest" icon="compass" /></Pressable>
            </Link>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
