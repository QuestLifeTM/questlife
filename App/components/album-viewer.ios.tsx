import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, FlatList, Modal, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Extrapolation, FadeIn, interpolate, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useThemeKey } from "@/contexts/SettingsContext";
import { useAppViewport } from "@/lib/responsive";
import type { AlbumMedia, QuestAlbum } from "@/services/journal/album-model";
import { resolveAlbumMedia } from "@/services/journal/album-media.ios";
import { T } from "./theme";

/** Resolve only mounted thumbnails and the current full-size asset. */
function useMedia(item: AlbumMedia, full = false) {
  const [uri, setUri] = useState<string>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setUri(undefined);
    setError(undefined);
    void resolveAlbumMedia([item], attempt > 0, full).then(([result]) => {
      if (!live) return;
      setUri(result.previewUri);
      if (!result.previewUri) setError(result.error ?? "This media is not available yet.");
    }).catch(() => { if (live) setError("Couldn’t load this memory."); });
    return () => { live = false; };
  }, [item, full, attempt]);
  const fail = useCallback(() => setError("Couldn’t load this memory."), []);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { uri, error, fail, retry };
}

function Playback({ uri, onError }: { uri: string; onError: () => void }) {
  const player = useVideoPlayer(uri, instance => { instance.loop = false; });
  useEffect(() => {
    const state = AppState.addEventListener("change", value => { if (value !== "active") player.pause(); });
    const status = player.addListener("statusChange", event => { if (event.status === "error") onError(); });
    return () => { state.remove(); status.remove(); player.pause(); };
  }, [player, onError]);
  return <VideoView player={player} nativeControls contentFit="contain" style={{ flex: 1 }} />;
}

function MainMedia({ item, reduced }: { item: AlbumMedia; reduced: boolean }) {
  const { uri, error, fail, retry } = useMedia(item, true);
  return <Animated.View entering={FadeIn.duration(reduced ? 0 : 120)} style={{ flex: 1 }}>
    {error ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 12 }}>
      <Text style={{ color: T.muted, textAlign: "center" }}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={retry} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 20 }}><Text style={{ color: T.blue, fontFamily: "RubikBold" }}>Try again</Text></Pressable>
    </View> : !uri ? <ActivityIndicator accessibilityLabel="Loading memory" color={T.muted} style={{ flex: 1 }} />
      : item.kind === "video" ? <Playback uri={uri} onError={fail} />
      : <Image source={{ uri }} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" onError={fail} transition={reduced ? 0 : 120} style={{ flex: 1, borderRadius: 24 }} accessibilityLabel="Selected album photo" />}
  </Animated.View>;
}

function Thumbnail({ item, index, step, size, position, selected, reduced, onSelect }: {
  item: AlbumMedia; index: number; step: number; size: number; position: SharedValue<number>; selected: boolean; reduced: boolean; onSelect: (index: number) => void;
}) {
  const media = useMedia(item);
  const style = useAnimatedStyle(() => {
    const distance = Math.max(-3, Math.min(3, index - position.get()));
    return {
      opacity: interpolate(Math.abs(distance), [0, 1, 2, 3], [1, 0.95, 0.65, 0.2], Extrapolation.CLAMP),
      transform: reduced ? [] : [{ perspective: 550 }, { rotateY: `${distance * -26}deg` }, { scale: interpolate(Math.abs(distance), [0, 3], [1, 0.78], Extrapolation.CLAMP) }],
    };
  });
  return <Pressable accessibilityRole="button" accessibilityLabel={`${item.kind === "video" ? "Video" : "Photo"} ${index + 1}`} accessibilityState={{ selected }} onPress={() => onSelect(index)} style={{ width: step, height: size + 12, alignItems: "center", justifyContent: "center" }}>
    <Animated.View style={[{ width: size, height: size, borderRadius: 10, overflow: "hidden", backgroundColor: T.border }, style]}>
      {media.uri && !media.error ? <Image source={{ uri: media.uri }} contentFit="cover" cachePolicy="memory-disk" onError={media.fail} style={{ flex: 1 }} />
        : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Ionicons name={item.kind === "video" ? "videocam-outline" : "image-outline"} size={22} color={T.muted} /></View>}
      {item.kind === "video" ? <View style={{ position: "absolute", bottom: 5, right: 5, backgroundColor: "#0008", borderRadius: 12, padding: 4 }}><Ionicons name="play" size={12} color="#fff" /></View> : null}
    </Animated.View>
  </Pressable>;
}

export function AlbumViewer({ album, onClose }: { album: QuestAlbum; onClose: () => void }) {
  useThemeKey();
  const reduced = useReducedMotionPreference();
  const insets = useSafeAreaInsets();
  const viewport = useAppViewport();
  const [layout, setLayout] = useState({ width: viewport.width, height: viewport.height });
  const [selected, setSelected] = useState(0);
  const [visible, setVisible] = useState(true);
  const close = useCallback(() => setVisible(false), []);
  const list = useRef<FlatList<AlbumMedia>>(null);
  const position = useSharedValue(0);
  const width = Math.min(layout.width, 600);
  const available = Math.max(120, layout.height - insets.top - insets.bottom - 64);
  const size = Math.max(44, Math.min(82, width * 0.19, available * 0.18));
  const step = size + 10;
  const heroHeight = Math.max(44, Math.min(available * 0.65, (width - 64) * 1.44));
  const heroWidth = Math.min(width - 48, heroHeight / 1.44);
  const item = album.items[selected] ?? album.items[0];
  const select = useCallback((index: number) => {
    const next = Math.max(0, Math.min(album.items.length - 1, index));
    list.current?.scrollToOffset({ offset: next * step, animated: !reduced });
    if (reduced) { position.set(next); setSelected(next); }
  }, [album.items.length, step, reduced, position]);
  useEffect(() => {
    if (selected >= album.items.length && album.items.length) select(album.items.length - 1);
  }, [selected, album.items.length, select]);
  useEffect(() => {
    list.current?.scrollToOffset({ offset: selected * step, animated: false });
    // Recenter the same memory when rotating or resizing the window.
  }, [step, width]);
  useAnimatedReaction(() => Math.max(0, Math.min(album.items.length - 1, Math.round(position.get()))), (next, previous) => {
    if (next !== previous) scheduleOnRN(setSelected, next);
  }, [album.items.length]);
  const onScroll = useAnimatedScrollHandler(event => { position.set(event.contentOffset.x / step); });
  const date = new Date(item?.capturedAt || album.date);
  return <Modal visible={visible} presentationStyle="fullScreen" animationType={reduced ? "none" : "fade"} onRequestClose={close} onDismiss={onClose} supportedOrientations={["portrait", "landscape"]}>
    <View accessibilityViewIsModal onAccessibilityEscape={close} onLayout={event => setLayout(event.nativeEvent.layout)} style={{ flex: 1, backgroundColor: T.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ width, alignSelf: "center", height: 56, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close album" onPress={close} style={({ pressed }) => ({ width: 44, height: 44, justifyContent: "center", alignItems: "center", opacity: pressed ? 0.5 : 1 })}><Ionicons name="close" color={T.dark} size={27} /></Pressable>
        <Text accessibilityRole="header" numberOfLines={2} style={{ flex: 1, color: T.dark, textAlign: "center", fontFamily: "RubikBold", fontSize: 16 }}>{album.title}</Text>
        <View style={{ width: 44 }} />
      </View>
      {item ? <View style={{ flex: 1, alignItems: "center", justifyContent: "space-evenly" }}>
        <View style={{ alignItems: "center", gap: 16 }}>
          <View accessibilityRole="adjustable" accessibilityLabel={`Memory ${selected + 1} of ${album.items.length}`} accessibilityActions={[{ name: "increment", label: "Next memory" }, { name: "decrement", label: "Previous memory" }]} onAccessibilityAction={event => select(selected + (event.nativeEvent.actionName === "increment" ? 1 : -1))} style={{ width: heroWidth, height: heroHeight, borderRadius: 24, overflow: "hidden", backgroundColor: T.raised }}>
            <MainMedia key={item.id} item={item} reduced={reduced} />
          </View>
          <Text style={{ color: T.dark, fontFamily: "Rubik", fontSize: 15 }}>{Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Text>
        </View>
        <View style={{ width, height: size + 24 }}>
          <Animated.FlatList ref={list} horizontal data={album.items} extraData={selected} keyExtractor={value => value.id} onScroll={onScroll} scrollEventThrottle={16} showsHorizontalScrollIndicator={false}
            snapToInterval={step} decelerationRate="fast" bounces={false} contentContainerStyle={{ paddingHorizontal: (width - step) / 2 }}
            getItemLayout={(_, index) => ({ length: step, offset: step * index, index })} initialNumToRender={9} maxToRenderPerBatch={6} windowSize={5} removeClippedSubviews={false}
            renderItem={({ item: value, index }) => <Thumbnail item={value} index={index} step={step} size={size} position={position} selected={index === selected} reduced={reduced} onSelect={select} />} />
        </View>
      </View> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: T.muted }}>This album has no photos yet.</Text></View>}
    </View>
  </Modal>;
}
