import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { FlatList, Modal, ScrollView, View } from "react-native";
import Reanimated, { cancelAnimation, scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "./raised-pressable";
import { CachedImage } from "./cached-image";
import { QuestVideo } from "./quest-video.ios";
import { SoftButton } from "./ui";
import { T } from "./theme";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import type { ActiveQuestPhoto } from "@/types/active-quest";
import type { JourneyEvent } from "@/services/active-quest/journey-model";

// Carousel motion is independent of the fixed photo grid below it.
const MOMENT_SETTLE_MS = 500;
const MOMENT_SPRING = { duration: MOMENT_SETTLE_MS, dampingRatio: 1, overshootClamping: true };

function MomentMotionCard({ position, offset, step, reduced, width, children }: {
  position: SharedValue<number>; offset: number; step: number; reduced: boolean; width: number; children: React.ReactNode;
}) {
  const motion = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(position.get() - offset) / step);
    // Smootherstep keeps both velocity and acceleration continuous at center/side scale.
    const blend = distance * distance * distance * (distance * (distance * 6 - 15) + 10);
    return { transform: [{ scale: reduced ? 1 : 1 - 0.16 * blend }] };
  });
  return <Reanimated.View style={[{ width, height: width / 0.74, borderRadius: 20, backgroundColor: "#ffffff", padding: 4, boxShadow: "0px 12px 22px rgba(0,0,0,0.22)" }, motion]}>{children}</Reanimated.View>;
}

type Moment = { id: string; at: string; uri?: string; photo?: ActiveQuestPhoto; video?: JourneyEvent };

// Keep decoded media stable while navigating the carousel.
const MomentMedia = memo(function MomentMedia({ moment, accent }: { moment: Moment; accent: string }) {
  return <>
    {moment.uri ? <CachedImage uri={moment.uri} style={{ width: "100%", height: "100%" }} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: `${accent}18` }}><Ionicons name="videocam-outline" size={32} color={accent} /></View>}
    {moment.video ? <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}><View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#0008", alignItems: "center", justifyContent: "center" }}><Ionicons name="play" size={24} color="#ffffff" /></View></View> : null}
  </>;
});

const MomentGridPhoto = memo(function MomentGridPhoto({ moment, number, size, accent, onSelect }: {
  moment: Moment; number: number; size: number; accent: string; onSelect: (moment: Moment) => void;
}) {
  return <View style={{ width: size, aspectRatio: 1 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Show ${moment.video ? "video" : "photo"} ${number} in carousel`}
      onPress={() => onSelect(moment)} style={{ flex: 1, borderRadius: 14, borderWidth: 3, borderColor: T.white, overflow: "hidden", backgroundColor: T.border }}>
      <MomentMedia moment={moment} accent={accent} />
    </Pressable>
  </View>;
});

/** The carousel stays first; every moment keeps its place in the grid below. */
export function ActiveQuestMoments({ photos, events, accent, empty, onManage }: {
  photos: ActiveQuestPhoto[]; events: JourneyEvent[]; accent: string;
  empty: React.ReactNode; onManage: (photo: ActiveQuestPhoto) => void;
}) {
  const moments = useMemo<Moment[]>(() => [
    ...photos.map(photo => ({ id: `photo:${photo.id}`, at: photo.capturedAt, uri: photo.uri, photo })),
    ...events.filter(event => event.kind === "video").map(video => ({ id: `video:${video.id}`, at: video.capturedAt, uri: video.thumbnailUri, video })),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)), [photos, events]);
  const momentIndexes = useMemo(() => new Map(moments.map((moment, index) => [moment.id, index])), [moments]);
  const reduced = useReducedMotionPreference();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Moment | null>(null);
  const [width, setWidth] = useState(0);
  const position = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const dragging = useSharedValue(false);
  const page = useAnimatedRef<ComponentRef<typeof ScrollView>>();
  const carousel = useAnimatedRef<FlatList<Moment>>();
  const index = momentIndexes.get(selectedId ?? "") ?? 0;
  const cardWidth = width * 0.64;
  const step = cardWidth + width * 0.07;
  const side = (width - step) / 2;
  const thumbnailSize = Math.max(0, (width - 60) / 3);
  const selectedIndex = useRef(index);
  selectedIndex.current = index;
  const orderKey = useMemo(() => moments.map(moment => moment.id).join("|"), [moments]);
  useEffect(() => {
    // Reconcile rotation/addition/deletion only; a completed swipe must never restart its spring.
    cancelAnimation(position);
    position.set(selectedIndex.current * step);
    dragging.set(false);
  }, [step, orderKey, position, dragging]);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(position);
      position.set(selectedIndex.current * step);
    }
  }, [reduced, position, step]);
  useEffect(() => () => {
    cancelAnimation(position);
  }, [position]);
  useAnimatedReaction(() => position.get(), offset => {
    if (step > 0) scrollTo(carousel, Math.max(0, Math.min((moments.length - 1) * step, offset)), 0, false);
  }, [step, moments.length]);
  const commitIndex = useCallback((next: number) => {
    const moment = moments[next];
    if (moment) {
      setSelectedId(moment.id);
    }
  }, [moments]);
  const pan = Gesture.Pan().enabled(moments.length > 1 && step > 0)
    .activeOffsetX([-10, 10]).failOffsetY([-12, 12])
    .onStart(() => {
      cancelAnimation(position);
      dragging.set(true);
      dragStart.set(position.get());
    })
    .onUpdate(event => {
      const offset = dragStart.get() - event.translationX;
      position.set(Math.max(0, Math.min((moments.length - 1) * step, offset)));
    })
    .onEnd(event => {
      const start = Math.round(dragStart.get() / step);
      const projected = (position.get() - event.velocityX * 0.16) / step;
      const next = Math.max(0, Math.min(moments.length - 1, Math.max(start - 1, Math.min(start + 1, Math.round(projected)))));
      position.set(reduced ? next * step : withSpring(next * step, { ...MOMENT_SPRING, velocity: -event.velocityX }));
      scheduleOnRN(commitIndex, next);
    })
    .onFinalize((_event, success) => {
      // A vertical touch never activated this pan and must not interrupt a settle.
      if (!success && dragging.get() && step > 0) {
        const next = Math.max(0, Math.min(moments.length - 1, Math.round(position.get() / step)));
        position.set(reduced ? next * step : withSpring(next * step, MOMENT_SPRING));
        scheduleOnRN(commitIndex, next);
      }
      dragging.set(false);
    });
  useEffect(() => {
    if (viewing && !moments.some(moment => moment.id === viewing.id)) setViewing(null);
  }, [moments, viewing]);
  const select = useCallback((moment: Moment) => {
    const next = momentIndexes.get(moment.id) ?? -1;
    if (next < 0 || step <= 0) return;
    cancelAnimation(position);
    setSelectedId(moment.id);
    position.set(reduced ? next * step : withSpring(next * step, MOMENT_SPRING));
    page.current?.scrollTo({ y: 0, animated: !reduced });
  }, [momentIndexes, step, position, reduced, page]);
  function grid() {
    return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20 }}>
      {moments.map((moment, itemIndex) => <MomentGridPhoto key={moment.id} moment={moment} number={itemIndex + 1}
        size={thumbnailSize} accent={accent} onSelect={select} />)}
    </View>;
  }
  return <View onLayout={event => {
    setWidth(event.nativeEvent.layout.width);
  }} style={{ flex: 1, overflow: "hidden" }}>
    <Reanimated.ScrollView ref={page} contentContainerStyle={{ paddingTop: 24, paddingBottom: 160, gap: 22 }}>
      {!moments.length ? <View style={{ paddingHorizontal: 16 }}>{empty}</View> : width > 0 ? <>
        <View>
          <GestureDetector gesture={pan}><Reanimated.FlatList ref={carousel} data={moments} horizontal showsHorizontalScrollIndicator={false} keyExtractor={moment => moment.id}
            scrollEnabled={false} bounces={false}
            contentContainerStyle={{ paddingHorizontal: side, paddingTop: 8, paddingBottom: 30 }}
            getItemLayout={(_, itemIndex) => ({ length: step, offset: itemIndex * step, index: itemIndex })}
            initialNumToRender={3} windowSize={7} maxToRenderPerBatch={6} updateCellsBatchingPeriod={16} removeClippedSubviews={false}
            renderItem={({ item, index: itemIndex }) => {
              return <View style={{ width: step, alignItems: "center", justifyContent: "center" }}><MomentMotionCard position={position} offset={itemIndex * step} step={step} reduced={reduced} width={cardWidth}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.video ? "video" : "photo"} ${itemIndex + 1} of ${moments.length}`} onPress={() => itemIndex === index ? setViewing(item) : select(item)} style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}><MomentMedia moment={item} accent={accent} /></Pressable>
              </MomentMotionCard></View>;
            }} /></GestureDetector>
          <View accessibilityLabel={`Moment ${index + 1} of ${moments.length}`} style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, minHeight: 18 }}>
            {moments.slice(Math.max(0, Math.min(index - 4, moments.length - 9)), Math.max(0, Math.min(index - 4, moments.length - 9)) + 9).map(moment => <View key={moment.id} style={{ width: moment.id === moments[index].id ? 7 : 5, height: moment.id === moments[index].id ? 7 : 5, borderRadius: 4, backgroundColor: moment.id === moments[index].id ? T.dark : T.border }} />)}
          </View>
        </View>
        {grid()}
      </> : null}
    </Reanimated.ScrollView>
    <Modal visible={Boolean(viewing)} animationType="fade" onRequestClose={() => setViewing(null)}>
      <View style={{ flex: 1, backgroundColor: T.bg, padding: 24, paddingTop: 60, paddingBottom: 40, gap: 16, justifyContent: "center" }}>
        {viewing?.video?.uri ? <QuestVideo uri={viewing.video.uri} /> : viewing?.uri ? <CachedImage uri={viewing.uri} contentFit="contain" style={{ flex: 1 }} /> : null}
        {viewing?.photo ? <SoftButton label="Manage photo" color={accent} onPress={() => { const photo = viewing.photo; setViewing(null); if (photo) onManage(photo); }} /> : null}
        <SoftButton label="Done" color={accent} inverse onPress={() => setViewing(null)} />
      </View>
    </Modal>
  </View>;
}
