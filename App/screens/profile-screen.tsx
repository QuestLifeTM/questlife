import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { EmptyState, Screen, Sheet, SoftButton, useResponsiveScreenLayout } from "@/components/ui";
import { ProfileAvatar } from "@/components/profile-avatar";
import { T } from "@/components/theme";
import { QuestFeedThumbnail } from "@/components/quest-feed-card";
import { QuestPostManagementSheet } from "@/components/quest-post-management-sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { useSocial } from "@/contexts/SocialContext";
import { fetchProfileOverview, updateProfile, uploadProfileAvatar } from "@/services/profile/profileService";
import { ProfileOverview, QuestFeedPost } from "@/types/profile";

type ProfileTab = "posts" | "growth" | "achievements";

const profileTabs: ReadonlyArray<{ id: ProfileTab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = [
  { id: "posts", label: "Posts", icon: "grid-outline", activeIcon: "grid" },
  { id: "growth", label: "Personal Growth", icon: "trending-up-outline", activeIcon: "trending-up" },
  { id: "achievements", label: "Achievements", icon: "trophy-outline", activeIcon: "trophy" },
];

function accountValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function fullProfileName(displayName: string, metadata: unknown) {
  const fullName = [accountValue(metadata, "first_name"), accountValue(metadata, "last_name")].filter(Boolean).join(" ");
  return displayName.trim().split(/\s+/).filter(Boolean).length >= 2 ? displayName : fullName || displayName;
}

function HeaderControl({ label, icon, positive = false, disabled = false, onPress }: { label?: string; icon?: keyof typeof Ionicons.glyphMap; positive?: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={label ?? "Profile control"} onPress={onPress} hitSlop={8} style={({ pressed }) => ({ minWidth: 40, minHeight: 40, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4, opacity: disabled ? 0.45 : pressed ? 0.66 : 1 })}>
    {icon ? <Ionicons name={icon} size={20} color={T.dark} /> : <Text style={{ color: positive ? T.green : T.dark, fontFamily: "RubikBold", fontSize: 15 }}>{label}</Text>}
    {positive ? <Ionicons name="checkmark-circle" size={18} color={T.green} /> : null}
  </Pressable>;
}

function ImageControl({ label, onPress, style }: { label: string; onPress: () => void; style?: object }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: T.white, borderWidth: 2, borderColor: T.border, boxShadow: `2px 2px 0px ${T.border}`, opacity: pressed ? 0.72 : 1 }, style]}><Ionicons name="image-outline" size={21} color={T.dark} /></Pressable>;
}

function ProfileTabSwitcher({ activeTab, onChange }: { activeTab: ProfileTab; onChange: (tab: ProfileTab) => void }) {
  return <View accessibilityRole="tablist" style={{ width: "100%", maxWidth: 276, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: T.border }}>
    {profileTabs.map((tab) => {
      const selected = tab.id === activeTab;
      return <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected }} onPress={() => onChange(tab.id)} hitSlop={8} style={({ pressed }) => ({ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: selected ? T.dark : "transparent", opacity: pressed ? 0.66 : 1 })}>
        <Ionicons name={selected ? tab.activeIcon : tab.icon} size={24} color={selected ? T.dark : "#6f767d"} />
      </Pressable>;
    })}
  </View>;
}

export function ProfileScreen() {
  const router = useRouter();
  const { signOut, user, refreshProfileName } = useAuth();
  const { showFeedback } = useAppFeedback();
  const { refresh: refreshSocial } = useSocial();
  const { contentWidth, horizontalPadding, insets, safeAreaOffset } = useResponsiveScreenLayout();
  const [overview, setOverview] = useState<ProfileOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftAvatarUri, setDraftAvatarUri] = useState<string | null>(null);
  const [readOnlyContentTop, setReadOnlyContentTop] = useState<number | null>(null);
  const [managedPost, setManagedPost] = useState<QuestFeedPost | null>(null);

  async function load() {
    setLoading(true);
    try {
      const next = await fetchProfileOverview();
      setOverview(next.profile ? next : null);
      if (next.profile) {
        setDraftName(fullProfileName(next.profile.displayName, user?.user_metadata));
        setDraftBio(next.profile.bio ?? "");
        setDraftAvatarUri(next.profile.avatarUrl);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [user?.id]);

  function startEditing() {
    if (!overview?.profile) return;
    setError(null);
    setDraftName(fullProfileName(overview.profile.displayName, user?.user_metadata));
    setDraftBio(overview.profile.bio ?? "");
    setDraftAvatarUri(overview.profile.avatarUrl);
    setEditing(true);
  }

  function discard() {
    if (!overview?.profile) return;
    setDraftName(fullProfileName(overview.profile.displayName, user?.user_metadata));
    setDraftBio(overview.profile.bio ?? "");
    setDraftAvatarUri(overview.profile.avatarUrl);
    setError(null);
    setEditing(false);
  }

  async function chooseImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.86 });
    if (result.canceled || !result.assets[0]) return;
    setDraftAvatarUri(result.assets[0].uri);
  }

  async function save() {
    if (!overview?.profile || saving) return;
    const displayName = draftName.trim();
    if (!displayName) {
      setError("Add your name before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const avatarChanged = Boolean(draftAvatarUri && draftAvatarUri !== overview.profile.avatarUrl);
      const avatarUrl = avatarChanged ? await uploadProfileAvatar(draftAvatarUri!) : undefined;
      const metadataUsername = accountValue(user?.user_metadata, "username");
      await updateProfile({ displayName, bio: draftBio, avatarUrl, username: !overview.profile.username && metadataUsername ? metadataUsername : undefined });
      refreshProfileName();
      await refreshSocial();
      setEditing(false);
      await load();
      showFeedback({
        message: avatarChanged ? "Profile picture updated." : "Profile updated.",
        icon: "person",
        color: T.blue,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "We couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !overview) return <Screen><EmptyState emoji="⏳" title="Loading profile" body="Gathering your QuestLife identity…" /></Screen>;
  if (!overview?.profile) return <Screen><EmptyState emoji="!" title="Profile unavailable" body="Sign in to view your profile." /></Screen>;

  const { profile, stats } = overview;
  const avatarUri = editing ? draftAvatarUri : profile.avatarUrl;
  const displayName = fullProfileName(profile.displayName, user?.user_metadata);
  const username = accountValue(user?.user_metadata, "username") || profile.username || "adventurer";
  const hasCompletedQuest = stats.totalQuests > 0;
  const postTileSize = (contentWidth - horizontalPadding * 2 - 12) / 3;
  const profilePosts: QuestFeedPost[] = overview.posts.map((post) => ({
    ...post,
    durationSeconds: post.durationSeconds ?? null,
    userId: profile.userId,
    username,
    displayName,
    emoji: profile.emoji,
    avatarColor: profile.avatarColor,
    avatarUrl: profile.avatarUrl,
    commentCount: 0,
  }));

  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <ScrollView scrollEnabled={!editing} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", paddingBottom: insets.bottom + 112 }}>
      <View style={{ width: contentWidth, transform: [{ translateX: safeAreaOffset }] }}>
      <View style={{ backgroundColor: T.bg }}>
        <View style={{ paddingHorizontal: horizontalPadding, paddingTop: Math.max(insets.top - 4, 0) }}>
          <View style={{ height: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {editing ? <HeaderControl label="Discard" onPress={discard} /> : <HeaderControl icon="create-outline" label="Edit profile" onPress={startEditing} />}
            {editing ? <HeaderControl label={saving ? "Saving…" : "Save"} positive disabled={saving} onPress={() => void save()} /> : <HeaderControl icon="settings-outline" label="Open settings" onPress={() => setSettingsOpen(true)} />}
          </View>

          <View style={{ alignItems: "center", paddingTop: editing ? 8 : 5 }}>
            <View style={{ marginTop: editing ? 7 : 0, position: "relative" }}>
              <ProfileAvatar uri={avatarUri} size={92} label={`${displayName}'s profile photo`} />
              {editing ? <ImageControl label="Change profile picture" onPress={() => void chooseImage()} style={{ width: 34, height: 34, borderRadius: 11, position: "absolute", right: -10, bottom: -7, zIndex: 3, elevation: 3 }} /> : null}
            </View>

            {editing ? <View style={{ width: "100%", maxWidth: 276, minHeight: 40, marginTop: 9, justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: T.dark, backgroundColor: "rgba(255,255,255,0.88)", paddingHorizontal: 12 }}><TextInput value={draftName} onChangeText={setDraftName} accessibilityLabel="Name" autoCapitalize="words" placeholder="Your name" placeholderTextColor={T.muted} style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 14, lineHeight: 19, textAlign: "center", paddingVertical: 6 }} /></View> : <Text style={{ marginTop: 9, color: T.dark, fontFamily: "RubikBold", fontSize: 14, lineHeight: 19, textAlign: "center" }}>{displayName}</Text>}
            <Text style={{ marginTop: editing ? 9 : 4, color: T.dark, fontFamily: "RubikBold", fontSize: 14, lineHeight: 19, textAlign: "center" }}>
              @{username}{hasCompletedQuest ? `  •  ${stats.totalQuests.toLocaleString()} ${stats.totalQuests === 1 ? "Quest" : "Quests"} Done` : ""}
            </Text>

            {editing ? <View style={{ width: "100%", maxWidth: 276, minHeight: 52, marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: T.dark, backgroundColor: "rgba(255,255,255,0.88)", paddingHorizontal: 12, paddingVertical: 6 }}><TextInput value={draftBio} onChangeText={setDraftBio} accessibilityLabel="Bio" placeholder="Write a bio…" placeholderTextColor={T.muted} multiline maxLength={180} textAlignVertical="top" style={{ minHeight: 32, color: T.dark, fontFamily: "Rubik", fontSize: 14, lineHeight: 18 }} /></View> : <Text style={{ maxWidth: 286, marginTop: 8, color: profile.bio ? T.dark : T.muted, fontFamily: "Rubik", fontSize: 14, lineHeight: 19, textAlign: "center" }}>{profile.bio || "Tap the pencil icon to add a bio."}</Text>}
            {error ? <Text accessibilityRole="alert" style={{ marginTop: 7, color: T.red, fontFamily: "RubikBold", fontSize: 12, textAlign: "center" }}>{error}</Text> : null}
          </View>

          <View
            accessible={!editing}
            importantForAccessibility={editing ? "no-hide-descendants" : "auto"}
            onLayout={({ nativeEvent }) => setReadOnlyContentTop(nativeEvent.layout.y)}
            pointerEvents={editing ? "none" : "auto"}
            style={{ width: "100%", alignItems: "center", marginTop: 18 }}
          >
              <ProfileTabSwitcher activeTab={activeTab} onChange={setActiveTab} />
          </View>
        </View>
      </View>
      <View
        importantForAccessibility={editing ? "no-hide-descendants" : "auto"}
        pointerEvents={editing ? "none" : "auto"}
        style={{ width: "100%" }}
      >
      {activeTab === "posts" ? <View style={{ paddingHorizontal: horizontalPadding, paddingTop: 20 }}>
        {profilePosts.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 6, rowGap: 6 }}>{profilePosts.map((post) => <QuestFeedThumbnail key={post.id} post={post} size={postTileSize} onManage={() => setManagedPost(post)} />)}</View> : <EmptyState emoji="📷" title="No posts yet" body="Complete a quest and share the first story here." />}
      </View> : null}
      </View>
    </View>
    </ScrollView>

    {editing && readOnlyContentTop !== null ? <View pointerEvents="none" style={{ position: "absolute", top: readOnlyContentTop, right: 0, bottom: 0, left: 0, overflow: "hidden" }}>
      <BlurView tint="light" intensity={16} style={{ position: "absolute", inset: 0 }} />
      <View style={{ flex: 1, backgroundColor: "rgba(255,252,245,0.48)" }} />
    </View> : null}

    <Sheet visible={settingsOpen} onClose={() => setSettingsOpen(false)}>
      <View style={{ padding: 24, gap: 16 }}>
        <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 22 }}>Settings</Text>
        <SoftButton label="Notifications" icon="notifications-outline" inverse color={T.blue} onPress={() => { setSettingsOpen(false); router.push("/notifications"); }} />
        <SoftButton label="Sign out" icon="log-out-outline" inverse color={T.red} onPress={() => { setSettingsOpen(false); void signOut(); }} />
      </View>
    </Sheet>
    <QuestPostManagementSheet post={managedPost} visible={Boolean(managedPost)} onClose={() => setManagedPost(null)} onUpdated={() => { setManagedPost(null); void load(); }} onDeleted={() => { setManagedPost(null); void load(); }} />

  </View>;
}
