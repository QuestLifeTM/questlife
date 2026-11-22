import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { T } from "./theme";
import { EmptyState, SoftButton } from "./ui";
import { albumGeometry, groupAlbums, journeyMedia, mergeAlbumMedia, type QuestAlbum } from "@/services/journal/album-model";
import { getCachedAlbumMedia, getCachedCompletedAlbums, loadCompletedAlbums, resolveAlbumMedia, type ResolvedAlbumMedia } from "@/services/journal/album-media.ios";
import type { JournalAlbumProps } from "./journal-album.types";
import { AlbumViewer } from "./album-viewer.ios";

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const rotations = ["1deg", "-5deg", "3deg", "-4deg"];
const AlbumStrip = memo(function AlbumStrip({ album, width, refreshToken, onOpen, reduced }: { album: QuestAlbum; width: number; refreshToken: number; onOpen: (id: string) => void; reduced: boolean }) {
  const press = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));
  const geometry = albumGeometry(width, album.items.length);
  const [resolved, setResolved] = useState<ResolvedAlbumMedia[]>(() => getCachedAlbumMedia(album.items.slice(0, 4)));
  const [retry, setRetry] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const autoRetried = useRef(new Set<string>());
  const items = useMemo(() => album.items.slice(0, 4), [album.items]);
  useEffect(() => { autoRetried.current.clear(); }, [refreshToken, items]);
  useEffect(() => {
    let current = true;
    setFailedImages(new Set());
    void resolveAlbumMedia(items, retry > 0).then(result => { if (current) setResolved(result); }).catch(() => {
      if (current) setResolved(items.map(item => ({ ...item, error: "Couldn’t access media. Tap to retry." })));
    });
    return () => { current = false; };
  }, [items, refreshToken, retry]);
  const failed = resolved.some(item => item.error) || failedImages.size > 0;
  return <Animated.View entering={reduced ? FadeIn.duration(100) : FadeInUp.duration(220).easing(EASE).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })} style={{ alignItems: "center", paddingTop: 8, paddingBottom: 4 }}>
    <View style={{ width: geometry.width, flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
      <Text style={{ flex: 1, minWidth: 0, color: T.dark, fontFamily: "RubikBlack", fontSize: 18, lineHeight: 22, letterSpacing: 0 }} numberOfLines={2}>{album.title}</Text>
      {!album.grouped ? <Text style={{ flexShrink: 0, maxWidth: "42%", color: T.muted, fontFamily: "Rubik", fontSize: 11, lineHeight: 16, paddingTop: 3, letterSpacing: 0, textAlign: "right" }} numberOfLines={1}>{new Date(album.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text> : null}
    </View>
    <Animated.View style={pressStyle}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${album.title}, ${album.items.length} photos and videos. Open album.`} onPress={() => onOpen(album.id)}
      onPressIn={() => { press.set(withTiming(reduced ? 1 : 0.985, { duration: 120, easing: EASE })); }}
      onPressOut={() => { press.set(withTiming(1, { duration: 120, easing: EASE })); }}
      style={({ pressed }) => ({ width: geometry.width, height: geometry.height, opacity: pressed ? 0.85 : 1 })}>
      {items.map((item, index) => {
        const media = resolved.find(value => value.id === item.id && value.path === item.path && value.localUri === item.localUri);
        const overflow = index === 3 && geometry.extra > 0;
        return <View key={item.id} pointerEvents="none" style={{ position: "absolute", left: geometry.left + index * geometry.step,
          top: index % 2 ? 5 : 11, width: geometry.cardWidth, height: geometry.cardHeight,
          zIndex: index === 0 ? 2 : index === 1 ? 1 : index + 1,
          transform: [{ rotate: rotations[index] }], borderRadius: 15, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.95)", overflow: "hidden", backgroundColor: T.border }}>
          {media?.previewUri && !failedImages.has(item.id) ? <Image source={{ uri: media.previewUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" blurRadius={overflow ? 8 : 0} cachePolicy="memory-disk" transition={reduced ? 0 : 160} allowDownscaling recyclingKey={`${album.id}:${item.id}`}
            onError={() => {
              if (!autoRetried.current.has(item.id)) { autoRetried.current.add(item.id); setRetry(value => value + 1); }
              else setFailedImages(value => new Set(value).add(item.id));
            }} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Ionicons name={item.kind === "video" ? "videocam-outline" : media?.error ? "cloud-offline-outline" : "image-outline"} size={25} color={T.muted} /></View>}
          {item.kind === "video" && !overflow ? <View style={{ position: "absolute", bottom: 8, left: 8, borderRadius: 12, padding: 5, backgroundColor: "rgba(0,0,0,0.4)" }}><Ionicons name="play" size={12} color="#fff" /></View> : null}
          {overflow ? <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.10)" }}><Text style={{ fontFamily: "Rubik", fontSize: 22, color: "#fff", fontVariant: ["tabular-nums"] }}>+{geometry.extra}</Text></View> : null}
        </View>;
      })}
    </Pressable>
    </Animated.View>
    {failed ? <Pressable accessibilityRole="button" accessibilityLabel={`Retry unavailable media from ${album.title}`} onPress={() => { autoRetried.current.clear(); setRetry(value => value + 1); }} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12 }}><Text style={{ color: T.muted, fontSize: 12 }}>Some media couldn’t load · Retry</Text></Pressable> : null}
  </Animated.View>;
});

export function IOSJournalAlbum(props: JournalAlbumProps) {
  const { user } = useAuth();
  const reduced = useReducedMotionPreference();
  const [openedAlbum, setOpenedAlbum] = useState<string | null>(null);
  useEffect(() => { setOpenedAlbum(null); }, [user?.id]);
  const [result, setResult] = useState<{ owner?: string; albums: QuestAlbum[]; warning?: string }>(() => getCachedCompletedAlbums() ?? { albums: [] });
  const [fetching, setFetching] = useState(true);
  const [foreground, setForeground] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") { setForeground(value => value + 1); props.onRefresh(); }
    });
    // Refresh signed URLs before their 30-minute expiry while this tab stays visible.
    const timer = setInterval(() => { if (AppState.currentState === "active") setForeground(value => value + 1); }, 25 * 60_000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [props.onRefresh]);
  useEffect(() => {
    let current = true;
    if (!props.data || !user) { setResult({ albums: [] }); setFetching(false); return; }
    setFetching(true);
    void loadCompletedAlbums(props.data).then(value => { if (current) setResult({ ...value, owner: user.id }); }).catch(() => {
      if (current) setResult(value => ({ albums: value.owner === user.id ? value.albums : [], owner: user.id, warning: "Couldn’t load quest media. Try again." }));
    }).finally(() => { if (current) setFetching(false); });
    return () => { current = false; };
  }, [props.data, props.refreshToken, foreground, user?.id]);
  const albums = useMemo(() => {
    const completed = result.owner === user?.id ? result.albums : [];
    const snapshot = props.snapshot;
    const active = props.data?.activeQuest;
    let current: QuestAlbum[] = [];
    if (snapshot && active?.sessionId === snapshot.session.sessionId) {
      const items = mergeAlbumMedia(snapshot.photos.filter(p => !p.isTutorialMock).map(photo => ({ id: `active:${photo.id}`, kind: "photo" as const, bucket: "journal-media" as const, path: photo.remotePath ?? undefined, localUri: photo.uri, capturedAt: photo.capturedAt })), journeyMedia(snapshot.session.journey?.events ?? []));
      current = [{ id: active.sessionId, sessionId: active.sessionId, title: active.title, date: active.startedAt, category: active.category, items }];
    }
    return groupAlbums([...current, ...completed].filter(album => album.items.length).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)), props.grouping ?? "quest");
  }, [result, props.snapshot, props.data?.activeQuest, props.grouping, user?.id]);
  const albumsRef = useRef(albums);
  albumsRef.current = albums;
  const prefetch = useCallback((start: number) => {
    const items = albumsRef.current.slice(Math.max(0, start), start + 6).flatMap(album => album.items.slice(0, 4));
    void resolveAlbumMedia(items).then(media => {
      const urls = media.flatMap(item => item.previewUri?.startsWith("https:") ? [item.previewUri] : []);
      if (urls.length) void Image.prefetch(urls, "memory-disk").catch(() => undefined);
    }).catch(() => undefined);
  }, []);
  useEffect(() => { prefetch(0); }, [albums, prefetch]);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10, minimumViewTime: 80 }).current;
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const last = viewableItems.reduce((max, item) => Math.max(max, item.index ?? 0), 0);
    prefetch(last + 1);
  }, [prefetch]);
  const warning = props.error ?? (result.owner === user?.id ? result.warning : undefined);
  const width = Math.min(props.contentWidth - props.horizontalPadding * 2, 440);
  const pending = props.loading || fetching;
  const selectedAlbum = albums.find(album => album.id === openedAlbum);
  return <><FlatList data={albums} keyExtractor={album => album.id} style={{ flex: 1 }} showsVerticalScrollIndicator={false}
    initialNumToRender={6} windowSize={7} maxToRenderPerBatch={3} updateCellsBatchingPeriod={24}
    viewabilityConfig={viewabilityConfig} onViewableItemsChanged={onViewableItemsChanged} removeClippedSubviews={false}
    onScroll={event => props.onScroll(event.nativeEvent.contentOffset.y)} scrollEventThrottle={16}
    refreshing={pending && albums.length > 0} onRefresh={props.onRefresh}
    contentContainerStyle={{ paddingTop: 22, paddingBottom: props.bottomInset + 112, gap: 24 }}
    ListHeaderComponent={warning ? <View style={{ width, alignSelf: "center", gap: 8 }}><Text style={{ color: T.muted, textAlign: "center" }}>{warning}</Text><SoftButton label="Try again" onPress={() => { setForeground(value => value + 1); props.onRefresh(); }} /></View> : undefined}
    ListEmptyComponent={<View style={{ width, alignSelf: "center" }}>{pending ? <View accessibilityRole="progressbar" accessibilityLabel="Loading your albums" style={{ height: 220, justifyContent: "center", alignItems: "center" }}><Text style={{ color: T.muted }}>Loading your albums…</Text></View> : warning ? null : <EmptyState emoji="📷" title="Your album is waiting" body="Photos and videos from your quests will appear here." action={<SoftButton label="Explore quests" onPress={props.onExplore} />} />}</View>}
    renderItem={({ item }) => <View style={{ width, alignSelf: "center" }}><AlbumStrip key={`${user?.id}:${item.id}`} album={item} width={width} refreshToken={props.refreshToken + foreground} onOpen={setOpenedAlbum} reduced={reduced} /></View>} />
    {selectedAlbum ? <AlbumViewer key={`${user?.id}:${selectedAlbum.id}`} album={selectedAlbum} onClose={() => setOpenedAlbum(null)} /> : null}</>;
}
