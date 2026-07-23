import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { T } from "@/components/theme";
import { Sheet, SoftButton } from "@/components/ui";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { uploadQuestPhoto } from "@/services/engine/questEngineService";
import { deleteQuestPost, updateQuestPost } from "@/services/profile/profileService";
import { QuestFeedPost } from "@/types/profile";

type PostPhoto = { uri: string; uploaded: boolean };
type EditorMode = "actions" | "edit";

const audienceOptions: ReadonlyArray<{ id: QuestFeedPost["visibility"]; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = [
  { id: "public", label: "Everyone", icon: "earth", color: T.blue },
  { id: "friends", label: "Friends", icon: "people", color: T.purple },
  { id: "private", label: "Only me", icon: "lock-closed", color: T.green },
];

function ActionRow({ icon, color, label, detail, destructive = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; detail: string; destructive?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ minHeight: 70, paddingHorizontal: 13, borderRadius: 18, borderWidth: 2, borderColor: destructive ? `${T.red}55` : T.border, backgroundColor: destructive ? `${T.red}08` : T.white, flexDirection: "row", alignItems: "center", gap: 11, opacity: pressed ? 0.7 : 1 })}>
    <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${color}1c` }}><Ionicons name={icon} size={21} color={color} /></View>
    <View style={{ flex: 1, gap: 2 }}><Text style={{ color: destructive ? T.red : T.dark, fontFamily: "RubikBold", fontSize: 15 }}>{label}</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 16 }}>{detail}</Text></View>
    <Ionicons name="chevron-forward" size={19} color={destructive ? T.red : T.muted} />
  </Pressable>;
}

function PhotoSlot({ photo, onRemove }: { photo?: PostPhoto; onRemove?: () => void }) {
  if (!photo) return <View style={{ flex: 1, minWidth: 0, aspectRatio: 1, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: T.border, backgroundColor: T.bg }} />;
  return <View style={{ flex: 1, minWidth: 0, aspectRatio: 1, borderRadius: 14, overflow: "hidden", backgroundColor: T.border }}>
    <Image source={{ uri: photo.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
    <Pressable accessibilityRole="button" accessibilityLabel="Remove photo from post" onPress={onRemove} style={({ pressed }) => ({ position: "absolute", top: 5, right: 5, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.94)", opacity: pressed ? 0.7 : 1 })}><Ionicons name="close" size={18} color={T.dark} /></Pressable>
  </View>;
}

export function QuestPostManagementSheet({ post, visible, onClose, onUpdated, onDeleted }: { post: QuestFeedPost | null; visible: boolean; onClose: () => void; onUpdated: (post: QuestFeedPost) => void; onDeleted: (postId: string) => void }) {
  const { showFeedback } = useAppFeedback();
  const [mode, setMode] = useState<EditorMode>("actions");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<QuestFeedPost["visibility"]>("friends");
  const [photos, setPhotos] = useState<PostPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !post) return;
    setMode("actions");
    setTitle(post.postTitle ?? post.questTitle);
    setCaption(post.caption ?? "");
    setVisibility(post.visibility);
    setPhotos(post.photoUrls.slice(0, 4).map((uri) => ({ uri, uploaded: true })));
    setSaving(false);
    setError(null);
  }, [post?.id, visible]);

  if (!post) return null;
  const close = () => { if (!saving) onClose(); };
  const addPhoto = async () => {
    if (photos.length >= 4 || saving) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setPhotos((current) => [...current, { uri: result.assets[0].uri, uploaded: false }]);
  };
  const save = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setError("Give your post a title before saving."); return; }
    setSaving(true);
    setError(null);
    try {
      const photoUrls = await Promise.all(photos.map((photo) => photo.uploaded ? photo.uri : uploadQuestPhoto(photo.uri)));
      const postTitle = trimmedTitle === post.questTitle ? null : trimmedTitle;
      const nextPost = { ...post, postTitle, caption: caption.trim() || null, photoUrls, visibility };
      await updateQuestPost(post.id, { postTitle, caption: nextPost.caption, photoUrls, visibility });
      onUpdated(nextPost);
      onClose();
      showFeedback({ message: "Post updated.", icon: "create", color: T.blue });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "We couldn't update this post. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const deletePost = () => {
    Alert.alert("Delete post?", "This will remove the post and its comments. Your quest and Journal entry will stay safe.", [
      { text: "Keep post", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { void (async () => {
        setSaving(true);
        try {
          await deleteQuestPost(post.id);
          onDeleted(post.id);
          onClose();
          showFeedback({ message: "Post deleted.", icon: "trash", color: T.red });
        } catch (nextError) {
          setError(nextError instanceof Error ? nextError.message : "We couldn't delete this post. Please try again.");
          setMode("actions");
        } finally {
          setSaving(false);
        }
      })(); } },
    ]);
  };

  return <Sheet visible={visible} onClose={close} maxHeight={mode === "edit" ? "88%" : "62%"} fillHeight={mode === "edit"}>
    {mode === "actions" ? <View style={{ paddingHorizontal: 24, paddingBottom: 26, gap: 14 }}>
      <View style={{ gap: 4 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23 }}>Manage post</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 13 }} numberOfLines={1}>{post.postTitle ?? post.questTitle}</Text></View>
      {error ? <Text accessibilityRole="alert" style={{ color: T.red, fontFamily: "RubikBold", fontSize: 12 }}>{error}</Text> : null}
      <ActionRow icon="create-outline" color={T.blue} label="Edit post" detail="Update the title, description, audience, or photos." onPress={() => { setError(null); setMode("edit"); }} />
      <ActionRow icon="trash-outline" color={T.red} label="Delete post" detail="This removes the post and its comments permanently." destructive onPress={deletePost} />
      <SoftButton label="Cancel" inverse color={T.muted} disabled={saving} onPress={close} />
    </View> : <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 24, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to post actions" disabled={saving} onPress={() => setMode("actions")} hitSlop={8}><Ionicons name="chevron-back" size={25} color={saving ? T.border : T.dark} /></Pressable>
        <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 19 }}>Edit post</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Save post changes" disabled={saving} onPress={() => void save()} hitSlop={8}><Text style={{ color: saving ? T.border : T.blue, fontFamily: "RubikBold", fontSize: 15 }}>{saving ? "Saving…" : "Save"}</Text></Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 26, gap: 15 }}>
        <View style={{ gap: 6 }}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" }}>Title</Text><TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Post title" placeholderTextColor={T.muted} style={{ minHeight: 54, borderWidth: 2, borderColor: T.border, borderRadius: 16, paddingHorizontal: 13, color: T.dark, fontFamily: "RubikBold", fontSize: 16, backgroundColor: T.bg }} /></View>
        <View style={{ gap: 6 }}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" }}>Description</Text><TextInput value={caption} onChangeText={setCaption} maxLength={1_000} multiline textAlignVertical="top" placeholder="What do you want to share?" placeholderTextColor={T.muted} style={{ minHeight: 96, borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 13, color: T.dark, fontFamily: "Rubik", fontSize: 14, lineHeight: 20, backgroundColor: T.bg }} /></View>
        <View style={{ gap: 8 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" }}>Photos</Text><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 11 }}>{photos.length}/4</Text></View><View style={{ flexDirection: "row", gap: 8 }}>{[0, 1, 2, 3].map((index) => <PhotoSlot key={index} photo={photos[index]} onRemove={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} />)}</View>{photos.length < 4 ? <Pressable accessibilityRole="button" accessibilityLabel="Add photo to post" onPress={() => void addPhoto()} style={({ pressed }) => ({ minHeight: 44, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: `${T.blue}88`, backgroundColor: `${T.blue}0d`, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, opacity: pressed ? 0.7 : 1 })}><Ionicons name="image-outline" size={18} color={T.blue} /><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 13 }}>Add photo</Text></Pressable> : null}</View>
        <View style={{ gap: 8 }}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" }}>Who can see this?</Text><View style={{ flexDirection: "row", gap: 7 }}>{audienceOptions.map((option) => { const selected = visibility === option.id; return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={option.label} onPress={() => setVisibility(option.id)} style={({ pressed }) => ({ flex: 1, minHeight: 68, paddingHorizontal: 7, borderRadius: 15, borderWidth: 2, borderColor: selected ? option.color : T.border, backgroundColor: selected ? `${option.color}12` : T.white, alignItems: "center", justifyContent: "center", gap: 4, opacity: pressed ? 0.72 : 1 })}><Ionicons name={option.icon} size={19} color={selected ? option.color : T.muted} /><Text style={{ color: selected ? option.color : T.muted, fontFamily: "RubikBold", fontSize: 11 }} numberOfLines={1}>{option.label}</Text></Pressable>; })}</View></View>
        {error ? <Text accessibilityRole="alert" style={{ color: T.red, fontFamily: "RubikBold", fontSize: 12, lineHeight: 17 }}>{error}</Text> : null}
      </ScrollView>
    </View>}
  </Sheet>;
}
