import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Image, LayoutChangeEvent, Pressable, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";

import { PartyCategoryIcon } from "@/components/party-category-icon";
import { T } from "@/components/theme";
import { QuestCategory } from "@/types/content";
import { QuestFeedPost } from "@/types/profile";
import { QuestCommentsSheet } from "@/components/quest-comments-sheet";
import { QuestPostManagementSheet } from "@/components/quest-post-management-sheet";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { togglePostLike } from "@/services/profile/profileService";

function relativePostTime(value: string) { const timestamp = new Date(value); const elapsed = Date.now() - timestamp.getTime(); const hours = Math.floor(elapsed / 3_600_000); const time = timestamp.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); if (hours < 24) return `${hours < 1 ? "Just now" : `${hours}h ago`} · ${time}`; if (hours < 48) return `Yesterday · ${time}`; if (hours < 24 * 7) return `${Math.floor(hours / 24)}d ago · ${time}`; return `${timestamp.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} · ${time}`; }
function formatPostDurationLabel(seconds: number) { const totalMinutes = Math.max(1, Math.round(seconds / 60)); const hours = Math.floor(totalMinutes / 60); const minutes = totalMinutes % 60; return hours ? `${hours}h${minutes ? ` ${minutes}min` : ""}` : `${minutes}min`; }

function CompletionStatus({ rating, durationSeconds, durationVisible }: { rating: number | null; durationSeconds: number | null; durationVisible: boolean }) {
  const [showRating, setShowRating] = useState(true);
  useEffect(() => { setShowRating(true); if (!rating || !durationVisible || durationSeconds === null) return; const timer = setInterval(() => setShowRating((current) => !current), 2_000); return () => clearInterval(timer); }, [durationSeconds, durationVisible, rating]);
  if (!rating && (!durationVisible || durationSeconds === null)) return null;
  const showStars = Boolean(rating) && showRating;
  return <View style={{ minHeight: 17, justifyContent: "center" }}>{showStars ? <Animated.View key="rating" entering={FadeInUp.duration(180).withInitialValues({ opacity: 0, transform: [{ translateY: 5 }] })} exiting={FadeOutUp.duration(180)} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><Text style={{ color: T.muted, fontSize: 11, lineHeight: 15, fontWeight: "700" }}>Gave a rating of</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>{[1, 2, 3, 4, 5].map((star) => <Ionicons key={star} name={star <= rating! ? "star" : "star-outline"} size={12} color={star <= rating! ? T.orange : T.muted} />)}</View></Animated.View> : <Animated.View key="completion" entering={FadeInUp.duration(180).withInitialValues({ opacity: 0, transform: [{ translateY: 5 }] })} exiting={FadeOutUp.duration(180)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Text style={{ color: T.muted, fontSize: 11, lineHeight: 15, fontWeight: "700" }}>Finished in</Text><Text style={{ color: T.dark, fontSize: 11, lineHeight: 15, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{formatPostDurationLabel(durationSeconds!)}</Text></Animated.View>}</View>;
}

function FeedEngagement({ post, onToggle }: { post: QuestFeedPost; onToggle: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const inspired = post.likedByMe;
  return <Pressable accessibilityRole="button" accessibilityLabel={inspired ? "Remove inspiration" : "This quest inspired me"} accessibilityState={{ selected: inspired, busy: pending }} disabled={pending} onPress={() => { setPending(true); onToggle().finally(() => setPending(false)); }} style={({ pressed }) => ({ minHeight: 38, minWidth: 76, borderRadius: 19, paddingHorizontal: 11, backgroundColor: inspired ? "#ffe5bd" : "#fff0da", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, opacity: pending ? 0.62 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
    <Ionicons name={inspired ? "flame" : "flame-outline"} size={17} color={T.orange} />
    <Text style={{ color: T.dark, fontSize: 13, lineHeight: 16, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{post.likeCount}</Text>
  </Pressable>;
}

function PostActionBar({ post, commentCount, onComments, onToggleReaction }: { post: QuestFeedPost; commentCount: number; onComments: () => void; onToggleReaction: () => Promise<void> }) {
  return <View style={{ minHeight: 58, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: T.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
    <FeedEngagement post={post} onToggle={onToggleReaction} />
    <Pressable accessibilityRole="button" accessibilityLabel="View comments" onPress={onComments} style={({ pressed }) => ({ minHeight: 38, borderRadius: 19, paddingHorizontal: 11, backgroundColor: "#fffdfa", borderWidth: 2, borderColor: T.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: pressed ? 0.72 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <Ionicons name="chatbubble-outline" size={17} color={T.muted} />
      <Text style={{ color: T.dark, fontSize: 13, lineHeight: 16, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{commentCount}</Text>
    </Pressable>
  </View>;
}

function PhotoCarousel({ urls, enabled }: { urls: string[]; enabled: boolean }) { const [width, setWidth] = useState(0); const [page, setPage] = useState(0); const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width); return <View onLayout={onLayout} accessibilityLabel={`${urls.length} quest photos`} style={{ height: 232, borderRadius: 16, overflow: "hidden", backgroundColor: T.border }}>{enabled && width ? <FlatList horizontal pagingEnabled data={urls} keyExtractor={(uri, index) => `${uri}-${index}`} showsHorizontalScrollIndicator={false} getItemLayout={(_, index) => ({ length: width, offset: width * index, index })} onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))} renderItem={({ item: uri, index }) => <Image accessibilityLabel={`Quest photo ${index + 1} of ${urls.length}`} source={{ uri, cache: "force-cache" }} resizeMethod="resize" resizeMode="cover" fadeDuration={120} style={{ width, height: 232, backgroundColor: T.border }} />} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Ionicons name="image-outline" size={26} color={T.muted} /></View>}{urls.length > 1 ? <View pointerEvents="none" style={{ position: "absolute", right: 10, top: 10, minHeight: 26, borderRadius: 13, paddingHorizontal: 8, backgroundColor: "rgba(28,24,27,0.68)", alignItems: "center", justifyContent: "center" }}><Text style={{ color: T.white, fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{page + 1}/{urls.length}</Text></View> : null}</View>; }

function FeedMedia({ post, loadMedia, actionBar }: { post: QuestFeedPost; loadMedia: boolean; actionBar: React.ReactNode }) {
  const images = post.photoUrls.slice(0, 4);
  const rating = post.rating ?? post.stats?.rating ?? null;
  const duration = post.stats?.durationSeconds ?? post.durationSeconds;
  const fallbackDescription = rating ? `${post.displayName} gave this quest a ${rating}-star rating${typeof duration === "number" ? ` and completed it in ${formatPostDurationLabel(duration)}.` : "."}` : null;
  const description = post.caption?.trim() || fallbackDescription;
  if (!images.length) return <View style={{ borderRadius: 30, overflow: "hidden", backgroundColor: T.white, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#e6ddd2" }}><View style={{ minHeight: description ? 122 : 112, padding: 18, paddingBottom: 16, gap: description ? 9 : 0 }}><Text style={{ color: T.dark, fontSize: 21, lineHeight: 26, fontWeight: "900" }}>{post.postTitle?.trim() || post.questTitle}</Text>{description ? <Text style={{ color: T.dark, fontSize: 14, lineHeight: 20, fontWeight: "600" }}>{description}</Text> : null}</View>{actionBar}</View>;
  return <View style={{ borderRadius: 30, borderWidth: 2, borderColor: T.border, borderBottomWidth: 4, borderBottomColor: "#e6ddd2", backgroundColor: T.white, overflow: "hidden" }}><View style={{ padding: 18, gap: 13 }}><View style={{ gap: 5 }}><Text style={{ color: T.dark, fontSize: 20, lineHeight: 25, fontWeight: "900" }}>{post.postTitle?.trim() || post.questTitle}</Text>{description ? <Text style={{ color: T.dark, fontSize: 14, lineHeight: 21, fontWeight: "600" }}>{description}</Text> : null}</View><PhotoCarousel urls={images} enabled={loadMedia} /></View>{actionBar}</View>;
}

export function QuestFeedCard({ post, loadMedia = true, onPostUpdated, onPostDeleted }: { post: QuestFeedPost; loadMedia?: boolean; onPostUpdated?: (post: QuestFeedPost) => void; onPostDeleted?: (postId: string) => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const { showFeedback } = useAppFeedback();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [managedPost, setManagedPost] = useState(post);
  const [managementOpen, setManagementOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  useEffect(() => { setManagedPost(post); setCommentCount(post.commentCount); setDeleted(false); }, [post]);
  const storedDuration = managedPost.stats?.durationSeconds ?? managedPost.durationSeconds;
  const durationSeconds = typeof storedDuration === "number" ? storedDuration : Number(storedDuration);
  const storedRating = managedPost.rating ?? managedPost.stats?.rating ?? null;
  const rating = typeof storedRating === "number" ? storedRating : Number(storedRating);
  const hasDuration = Number.isFinite(durationSeconds);
  const hasRating = Number.isFinite(rating) && rating >= 1 && rating <= 5;
  const toggleReaction = async () => {
    try {
      const likedByMe = await togglePostLike(managedPost.id, managedPost.likedByMe);
      const nextPost = { ...managedPost, likedByMe, likeCount: Math.max(0, managedPost.likeCount + (likedByMe ? 1 : -1)) };
      setManagedPost(nextPost);
      onPostUpdated?.(nextPost);
    } catch {
      showFeedback({ message: "Couldn’t update your reaction. Please try again.", icon: "alert-circle", color: T.red });
    }
  };
  const actionBar = <PostActionBar post={managedPost} commentCount={commentCount} onComments={() => setCommentsOpen(true)} onToggleReaction={toggleReaction} />;
  const isOwner = user?.id === managedPost.userId;
  if (deleted) return null;
  return <><View style={{ gap: 8 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 3 }}><Pressable accessibilityRole="button" accessibilityLabel={`View ${managedPost.displayName}'s profile`} onPress={() => router.push(`/add-friend/${managedPost.userId}`)} style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9, opacity: pressed ? 0.68 : 1 })}><ProfileAvatar uri={managedPost.avatarUrl} color={managedPost.avatarColor} size={36} label={`${managedPost.displayName}'s profile photo`} /><View style={{ flex: 1, minWidth: 0, gap: 1 }}><Text style={{ color: T.dark, fontSize: 13, fontWeight: "900" }} numberOfLines={1}>@{managedPost.username ?? managedPost.displayName.replace(/\s+/g, "").toLowerCase()}</Text><CompletionStatus rating={hasRating ? rating : null} durationSeconds={hasDuration ? durationSeconds : null} durationVisible={hasDuration} /></View></Pressable><Text style={{ color: T.muted, fontSize: 11, fontWeight: "700" }}>{relativePostTime(managedPost.createdAt)}</Text>{isOwner ? <Pressable accessibilityRole="button" accessibilityLabel="Manage post" onPress={() => setManagementOpen(true)} hitSlop={7} style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? T.bg : "transparent" })}><Ionicons name="ellipsis-horizontal" size={20} color={T.muted} /></Pressable> : null}</View><FeedMedia post={managedPost} loadMedia={loadMedia} actionBar={actionBar} /><QuestCommentsSheet postId={managedPost.id} visible={commentsOpen} onClose={() => setCommentsOpen(false)} onCountChange={setCommentCount} /></View><QuestPostManagementSheet post={managedPost} visible={managementOpen} onClose={() => setManagementOpen(false)} onUpdated={(nextPost) => { setManagedPost(nextPost); onPostUpdated?.(nextPost); }} onDeleted={(postId) => { setDeleted(true); onPostDeleted?.(postId); }} /></>;
}

export function QuestFeedThumbnail({ post, size, onManage }: { post: QuestFeedPost; size: number; onManage?: () => void }) { const firstPhoto = post.photoUrls[0]; return <View accessibilityLabel={post.postTitle?.trim() || post.questTitle} style={{ width: size, height: size, borderRadius: 14, overflow: "hidden", backgroundColor: post.questColor }}>{firstPhoto ? <Image source={{ uri: firstPhoto, cache: "force-cache" }} resizeMethod="resize" resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : null}<LinearGradient pointerEvents="none" colors={["rgba(20,17,20,0.06)", "rgba(20,17,20,0.78)"]} style={{ position: "absolute", inset: 0 }} /><View pointerEvents="none" style={{ position: "absolute", top: 8, left: 8 }}><PartyCategoryIcon category={post.questCategory as QuestCategory} size={20} strokeWidth={2.4} color={T.white} /></View>{onManage ? <Pressable accessibilityRole="button" accessibilityLabel={`Manage ${post.postTitle?.trim() || post.questTitle}`} onPress={onManage} hitSlop={5} style={({ pressed }) => ({ position: "absolute", top: 5, right: 5, width: 27, height: 27, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? "rgba(28,24,27,0.82)" : "rgba(28,24,27,0.64)" })}><Ionicons name="ellipsis-horizontal" size={18} color={T.white} /></Pressable> : null}<Text numberOfLines={2} style={{ position: "absolute", left: 8, right: 8, bottom: 8, color: T.white, fontSize: 11, lineHeight: 13, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.34)", textShadowRadius: 3 }}>{post.postTitle?.trim() || post.questTitle}</Text></View>; }
