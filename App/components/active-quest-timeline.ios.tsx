import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, ScrollView, Text, View, type ListRenderItem, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { JourneyEvent } from "@/services/active-quest/journey-model";
import type { ActiveQuestActivity, ActiveQuestPhoto } from "@/types/active-quest";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { QuestVideo } from "./quest-video.ios";
import { QuestTimelineXpPill } from "./quest-journey.ios";
import { QuestSectionPlaceholder } from "./quest-activity-ui.ios";
import { CachedImage } from "./cached-image";
import { Pressable } from "./raised-pressable";
import { SoftButton, useResponsiveScreenLayout } from "./ui";
import { T } from "./theme";

const palette = { blue: "#4B96F3", ink: "#202031", muted: "#686575", lavender: "#EEE8FA", green: "#D8F3CE", gold: "#FFF0C4", white: "#FFFFFF", border: "#EDE7E4" };
const CARD_GAP = 14;
const textStyle = { color: palette.ink, fontFamily: "RubikBold", fontSize: 15 } as const;
const rotations = ["-8deg", "2deg", "9deg"];
type Row = { id: string; at: string; kind: ActiveQuestActivity["kind"] | "mood" | "video"; activities: ActiveQuestActivity[]; event?: JourneyEvent };
type Viewer = { photos?: ActiveQuestPhoto[]; index: number; event?: JourneyEvent; text?: string };
export type TimelinePosition = { x: number; y: number; seen: string[]; images: Set<string> };

export function ActivityTimeline({ activity, photos, accent, onManage, position, focusLatest = false, overview, events = [], loading = false }: { position: TimelinePosition; events?: JourneyEvent[]; loading?: boolean; activity: ActiveQuestActivity[]; photos: ActiveQuestPhoto[]; accent: string; onManage: (activity: ActiveQuestActivity) => void; focusLatest?: boolean; overview?: React.ReactElement }) {
  const list = useRef<FlatList<Row>>(null);
  const reduced = useReducedMotionPreference();
  const { width, insets } = useResponsiveScreenLayout();
  const [availableWidth, setAvailableWidth] = useState(width);
  const cardWidth = Math.min(340, Math.max(220, availableWidth - 64));
  // Equal edge space centers every snap position, including the first and last.
  const cardInset = Math.max(0, (availableWidth - cardWidth) / 2);
  const mediaHeight = Math.round((cardWidth - 24) * 0.62);
  const stride = cardWidth + CARD_GAP;
  // Restore vertical position without controlling native scrolling on each render.
  const initialVerticalOffset = useRef({ x: 0, y: position.y }).current;
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const photoById = useMemo(() => new Map(photos.map(photo => [photo.id, photo])), [photos]);
  const rows = useMemo(() => {
    const all: Row[] = activity.map(item => ({ id: `activity:${item.id}`, at: item.createdAt, kind: item.kind, activities: [item], event: events.find(event => event.kind === item.kind && event.capturedAt === item.createdAt) }));
    for (const event of events) if (event.kind === "mood" || event.kind === "video") all.push({ id: `event:${event.id}`, at: event.capturedAt, kind: event.kind, activities: [], event });
    const result: Row[] = [];
    const batches = new Map<string, Row>();
    for (const row of all.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))) {
      const batch = row.event?.captureGroupId;
      const prior = result.at(-1);
      const legacy = !batch && row.kind === "photo" && prior?.kind === "photo" && !prior.event?.captureGroupId && Date.parse(row.at) - Date.parse(prior.at) <= 60_000 ? prior : undefined;
      const group = row.kind === "photo" ? batch ? batches.get(batch) : legacy : undefined;
      if (group) group.activities.push(...row.activities);
      else { result.push(row); if (batch && row.kind === "photo") batches.set(batch, row); }
    }
    // Keep older moments to the left; open the carousel at its newest moment.
    // A photo collection takes the time of its newest photo.
    return result.map(row => ({ ...row, at: row.activities.at(-1)?.createdAt ?? row.at }))
      .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  }, [activity, events]);
  const initialIndex = useRef(Math.max(0, rows.length - 1)).current;
  const [selected, setSelected] = useState(initialIndex);
  const followLatest = useRef(true);
  const activeIndex = Math.min(selected, Math.max(0, rows.length - 1));
  // Commit bookkeeping at gesture boundaries. Native scrolling stays independent
  // of React renders, image decoding, the quest clock and the overview map.
  const rememberPosition = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = Math.max(0, Math.min(event.nativeEvent.contentOffset.x, Math.max(0, rows.length - 1) * stride));
    position.x = x;
    setSelected(Math.round(x / stride));
  }, [position, rows.length, stride]);
  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: cardWidth, offset: stride * index, index }), [cardWidth, stride]);
  const renderItem = useCallback<ListRenderItem<Row>>(({ item: row, index }) => (
    <TimelineCard row={row} active={index === activeIndex} last={index === rows.length - 1} cardWidth={cardWidth} mediaHeight={mediaHeight} photoById={photoById} onManage={onManage} setViewer={setViewer} />
  ), [activeIndex, rows.length, cardWidth, mediaHeight, photoById, onManage]);
  const previousStride = useRef(stride);
  const newestRow = rows.at(-1);
  const newestMoment = newestRow ? `${newestRow.id}:${newestRow.at}:${newestRow.activities.length}` : undefined;
  const previousNewestMoment = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!rows.length) return;
    const newestChanged = previousNewestMoment.current !== newestMoment;
    previousNewestMoment.current = newestMoment;
    const oldStride = previousStride.current;
    const resized = oldStride !== stride;
    previousStride.current = stride;
    const previousIndex = Math.max(0, Math.round(position.x / oldStride));
    followLatest.current = focusLatest || newestChanged;
    const index = followLatest.current ? rows.length - 1 : Math.min(previousIndex, rows.length - 1);
    if (!focusLatest && !newestChanged && !resized && index === previousIndex) return;
    position.x = index * stride;
    setSelected(index);
    list.current?.scrollToOffset({ offset: position.x, animated: false });
  }, [focusLatest, newestMoment, rows.length, stride, position]);
  const dotStart = Math.max(0, Math.min(activeIndex - 4, rows.length - 9));
  const shownPhoto = viewer?.photos?.[viewer.index];
  return <>
    <ScrollView style={{ flex: 1 }} contentOffset={initialVerticalOffset} directionalLockEnabled onScroll={event => { position.y = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={32} contentContainerStyle={{ paddingTop: 16, paddingBottom: Math.max(150, insets.bottom + 124), gap: 20 }}>
      {overview ? <View style={{ paddingHorizontal: 16, gap: 14 }}>{overview}</View> : null}
      <View style={{ paddingHorizontal: 20, gap: 5 }}><Text style={{ color: palette.ink, fontFamily: "RubikBlack", fontSize: 24 }}>Quest timeline</Text><Text style={{ color: palette.muted, fontFamily: "Rubik", fontSize: 14 }}>Little moments. One adventure.</Text></View>
      {!rows.length ? <View style={{ paddingHorizontal: 16 }}><QuestSectionPlaceholder accent={accent} icon="time-outline" title="Your story starts here" detail="Photos, videos, notes and mood check-ins will appear here as your quest unfolds." loading={loading} /></View> : <>
      <FlatList ref={list} data={rows} horizontal
        onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)}
        showsHorizontalScrollIndicator={false} directionalLockEnabled
        style={{ flexGrow: 0 }} keyExtractor={rowKey}
        snapToInterval={stride} snapToAlignment="start" decelerationRate="fast"
        initialNumToRender={3} maxToRenderPerBatch={3} windowSize={5}
        removeClippedSubviews={false} initialScrollIndex={initialIndex}
        getItemLayout={getItemLayout} ItemSeparatorComponent={CardSeparator}
        onScrollBeginDrag={() => { followLatest.current = false; }}
        onContentSizeChange={() => {
          // Newly inserted cards must be laid out before the newest offset exists.
          if (followLatest.current) list.current?.scrollToOffset({ offset: Math.max(0, rows.length - 1) * stride, animated: false });
        }}
        onScrollEndDrag={rememberPosition} onMomentumScrollEnd={rememberPosition}
        contentContainerStyle={{ paddingHorizontal: cardInset, paddingTop: 4, paddingBottom: 12 }}
        renderItem={renderItem} extraData={activeIndex} />
      <View accessibilityLabel={`Moment ${activeIndex + 1} of ${rows.length}`} style={{ flexDirection: "row", justifyContent: "center", gap: 7, minHeight: 12 }}>{rows.slice(dotStart, dotStart + 9).map(row => <View key={row.id} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: row.id === rows[activeIndex]?.id ? palette.blue : "#D2CDCE" }} />)}</View>
      </>}
    </ScrollView>
    <Modal visible={Boolean(viewer)} animationType={reduced ? "none" : "fade"} onRequestClose={() => setViewer(null)}><View style={{ flex: 1, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, paddingHorizontal: 20, backgroundColor: T.bg, gap: 16 }}><SoftButton label="Done" color={palette.blue} inverse onPress={() => setViewer(null)} />{shownPhoto ? <CachedImage uri={shownPhoto.uri} contentFit="contain" style={{ flex: 1 }} /> : viewer?.event?.uri ? <View style={{ flex: 1, justifyContent: "center" }}><QuestVideo uri={viewer.event.uri} /></View> : <ScrollView contentContainerStyle={{ paddingVertical: 24 }}><Text style={{ color: T.dark, fontFamily: "Rubik", fontSize: 20, lineHeight: 30 }}>{viewer?.text ?? "Video unavailable"}</Text></ScrollView>}{viewer?.photos ? <><Text style={{ color: T.dark, textAlign: "center", fontFamily: "Rubik" }}>Photo {viewer.index + 1} of {viewer.photos.length}</Text><View style={{ flexDirection: "row", justifyContent: "space-between" }}><SoftButton label="Previous" color={palette.blue} inverse disabled={viewer.index === 0} onPress={() => setViewer(current => current ? { ...current, index: current.index - 1 } : null)} /><SoftButton label="Next" color={palette.blue} inverse disabled={viewer.index === viewer.photos.length - 1} onPress={() => setViewer(current => current ? { ...current, index: current.index + 1 } : null)} /></View><SoftButton label="Manage photo" color={palette.blue} onPress={() => { const activity = rows.flatMap(row => row.activities).find(item => item.photoId === shownPhoto?.id); setViewer(null); if (activity) onManage(activity); }} /></> : null}</View></Modal>
  </>;
}

/** Scroll selection changes only the marker; photo surfaces never flash or re-theme. */
const TimelineCard = memo(function TimelineCard({ row, active, last, cardWidth, mediaHeight, photoById, onManage, setViewer }: {
  row: Row; active: boolean; last: boolean; cardWidth: number; mediaHeight: number;
  photoById: Map<ActiveQuestPhoto["id"], ActiveQuestPhoto>; onManage: (activity: ActiveQuestActivity) => void;
  setViewer: (viewer: Viewer) => void;
}) {
  const item = row.activities[0];
  const group = useMemo(() => row.activities.flatMap(activity => { const photo = activity.photoId ? photoById.get(activity.photoId) : undefined; return photo ? [photo] : []; }), [row, photoById]);
  const grouped = group.length > 1;
  const label = row.kind === "photo" ? grouped ? "Photo collection" : "Single photo" : row.kind === "note" ? "Quick note" : row.kind === "mood" ? "Mood" : row.kind === "video" ? "Video" : "Badge";
  const icon = row.kind === "photo" ? grouped ? "images-outline" : "camera-outline" : row.kind === "note" ? "create-outline" : row.kind === "mood" ? "happy-outline" : row.kind === "video" ? "play-circle-outline" : "medal-outline";
  const foreground = palette.ink;
  const body = item?.caption || item?.body || row.event?.body;
  const open = () => setViewer(row.kind === "photo" ? { photos: group, index: 0 } : row.kind === "video" ? { event: row.event, index: 0 } : { text: row.kind === "badge" ? item?.badgeLabel ?? "Badge earned" : row.kind === "mood" ? `Feeling ${row.event?.mood === "happy" ? "good" : row.event?.mood === "sad" ? "low" : "okay"}${body ? `\n\n${body}` : ""}` : body ?? "", index: 0 });
  const stackWidth = Math.min(132, (cardWidth - 56) / 2.4);
  return <View style={{ width: cardWidth }}>
    <Text style={{ color: palette.muted, fontFamily: "Rubik", fontSize: 12, height: 22 }}>{new Date(row.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
    <View style={{ height: 26, justifyContent: "center", marginBottom: 10 }}>
      {!last ? <View style={{ position: "absolute", left: 9, right: -14, height: 2, backgroundColor: "#9FC4FB" }} /> : null}
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: active ? palette.blue : palette.white, borderWidth: 2, borderColor: palette.blue, boxShadow: active ? "0px 0px 0px 3px #DCEAFF" : undefined }} />
    </View>
    <View style={{ minHeight: mediaHeight + 114, borderRadius: 24, padding: 12, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.border, boxShadow: "0px 5px 14px rgba(61,52,56,0.10)" }}>
      <View style={{ minHeight: 36, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}><View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: row.kind === "mood" ? palette.green : row.kind === "badge" ? palette.gold : palette.lavender, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={19} color={row.kind === "mood" ? "#398739" : row.kind === "badge" ? "#D88C14" : palette.blue} /></View><Text numberOfLines={1} style={{ ...textStyle, color: foreground, flex: 1, fontSize: 14 }}>{label}</Text><QuestTimelineXpPill event={row.event} accent={palette.blue} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label.toLowerCase()}`} onPress={open} style={{ height: mediaHeight, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: row.kind === "note" ? palette.lavender : palette.white }}>
        {row.kind === "photo" ? grouped ? <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>{group.slice(0, 3).map((photo, photoIndex) => <View key={photo.id} style={{ position: "absolute", width: stackWidth, height: stackWidth * 0.85, left: (cardWidth - 24 - stackWidth) / 2 + (photoIndex - (Math.min(group.length, 3) - 1) / 2) * stackWidth * 0.62, transform: [{ rotate: rotations[photoIndex] }], borderRadius: 10, borderWidth: 4, borderColor: palette.white, overflow: "hidden", backgroundColor: palette.white, boxShadow: "0px 3px 5px #0002" }}><CachedImage uri={photo.uri} transition={0} style={{ width: "100%", height: "100%" }} />{photoIndex === 2 && group.length > 3 ? <View style={{ position: "absolute", bottom: 3, right: 3, borderRadius: 15, backgroundColor: palette.blue, padding: 5 }}><Text style={{ color: palette.white, fontFamily: "RubikBold", fontSize: 12 }}>+{group.length - 3}</Text></View> : null}</View>)}</View> : group[0] ? <CachedImage uri={group[0].uri} transition={0} style={{ width: "100%", height: "100%" }} /> : <Ionicons name="image-outline" size={32} color={palette.blue} />
        : row.kind === "video" ? <>{row.event?.thumbnailUri ? <CachedImage uri={row.event.thumbnailUri} transition={0} style={{ position: "absolute", width: "100%", height: "100%" }} /> : null}<View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#0007", alignItems: "center", justifyContent: "center" }}><Ionicons name="play" size={27} color={palette.white} /></View><Text style={{ position: "absolute", bottom: 9, right: 9, color: palette.white, backgroundColor: "#0009", borderRadius: 6, padding: 4, fontFamily: "RubikBold", fontSize: 11 }}>{Math.ceil(row.event?.durationSeconds ?? 0)}s</Text></>
        : row.kind === "note" ? <View style={{ padding: 18, gap: 4 }}><Text style={{ color: "#ADA0D1", fontSize: 32, lineHeight: 30 }}>“</Text><Text numberOfLines={Math.max(2, Math.floor((mediaHeight - 66) / 25))} style={{ color: palette.ink, fontFamily: "Rubik", fontSize: 17, lineHeight: 25, textAlign: "center", fontStyle: "italic" }}>{body}</Text></View>
        : <View style={{ alignItems: "center", gap: 10, paddingHorizontal: 10 }}><View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: row.kind === "badge" ? palette.gold : palette.green, alignItems: "center", justifyContent: "center" }}><Ionicons name={row.kind === "badge" ? "medal" : row.event?.mood === "sad" ? "sad-outline" : row.event?.mood === "neutral" ? "remove-outline" : "happy-outline"} size={46} color={row.kind === "badge" ? "#E4A221" : "#397B35"} /></View><Text numberOfLines={2} style={{ ...textStyle, textAlign: "center", fontSize: 17 }}>{row.kind === "badge" ? item?.badgeLabel ?? "Badge earned" : `Feeling ${row.event?.mood === "sad" ? "low" : row.event?.mood === "neutral" ? "okay" : "good"}`}</Text></View>}
      </Pressable>
      <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 }}><Ionicons name={grouped ? "images-outline" : row.kind === "badge" ? "checkmark-circle-outline" : "time-outline"} color={palette.muted} size={15} /><Text numberOfLines={1} style={{ color: palette.muted, fontFamily: "Rubik", fontSize: 12, flex: 1 }}>{grouped ? `${group.length} photos${body ? ` · ${body}` : ""}` : row.kind === "badge" ? "Earned" : body || new Date(row.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>{item ? <Pressable accessibilityRole="button" accessibilityLabel={`Manage ${label.toLowerCase()}`} onPress={() => onManage(item)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="ellipsis-horizontal" color={foreground} size={20} /></Pressable> : null}</View>
    </View>
  </View>;
});

const rowKey = (row: Row) => row.id;
function CardSeparator() { return <View style={{ width: CARD_GAP }} />; }
