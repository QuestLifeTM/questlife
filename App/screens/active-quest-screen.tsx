import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, FlatList, Image, InteractionManager, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CompletionDestination, LogLoreFlow } from "@/components/log-lore-flow";
import { CachedImage } from "@/components/cached-image";
import { QuestlifeFlame } from "@/components/questlife-flame";
import { categoryColor, T } from "@/components/theme";
import { EmptyState, haptic, Sheet, SoftButton } from "@/components/ui";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { useContent } from "@/contexts/ContentContext";
import { useActiveQuest } from "@/contexts/ActiveQuestContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useGuestQuest } from "@/contexts/GuestQuestContext";
import { formatElapsedFull, useElapsedDuration } from "@/hooks/useElapsedTime";
import { Quest } from "@/types/content";
import { ActiveQuestActivity, ActiveQuestCheckpoint, ActiveQuestPhoto, ActiveQuestRenderableSegment, ActiveQuestRoutePoint } from "@/types/active-quest";
import { CompletionResult } from "@/types/engine";

type ActiveQuestTab = "map" | "album" | "entry";
type QuestNotice = "active" | "paused" | "photo-saved" | "location-help";
export type QuestCountdownStep = 3 | 2 | 1 | "GO";

export type ActiveQuestOnboardingOptions = {
  /** Keeps the normal active-quest screen inert while the guest guide owns it. */
  locked: boolean;
  hideExit: boolean;
  holdCountdown: boolean;
  forceCountdown?: boolean;
  guideStep?: "overview" | "route" | "tabs" | "controls" | "final";
  routePromptNudge?: number;
  onRouteRecordingRequested?: () => void;
  onCountdownFinished?: () => void;
  /** Enables only the blue quick-actions button while the rest of the tutorial shell stays locked. */
  allowQuickActions?: boolean;
  /** Enables only the Take photo action in the expanded quick-actions menu. */
  allowPhotoCapture?: boolean;
  /** Enables only the Quick note action in the expanded quick-actions menu. */
  allowQuickNote?: boolean;
  /** Keeps the quick-actions affordance available while the tutorial pauses the quest timer. */
  showQuickActionsWhenPaused?: boolean;
  onQuickActionsOpened?: () => void;
  onQuickNoteOpened?: () => void;
  onQuickNoteSaved?: () => void;
  onQuickNoteDiscarded?: () => void;
  onPhotoCaptureStarted?: () => void;
  onPhotoCaptureFinished?: (captured: boolean) => void;
  onPhotoSaved?: (result: { tutorialOnly: boolean }) => void;
  onPhotoDiscarded?: () => void;
  /** Lets an onboarding guide reveal the real Memories or Activity surface. */
  forcedTab?: ActiveQuestTab;
  /** A bundled sample image used only by the onboarding tutorial. */
  tutorialMockPhotoUri?: string | null;
  focusLatestActivity?: boolean;
  forceQuickActionsOpen?: boolean;
};

const BOTTOM_SHEET_CONTENT_HEIGHT = 118;
const MAP_NOTICE_BOTTOM_OFFSET = BOTTOM_SHEET_CONTENT_HEIGHT + 48;
const MAP_RECENTER_BOTTOM_OFFSET = BOTTOM_SHEET_CONTENT_HEIGHT + 94;
const STALE_ACTIVE_QUEST_AFTER_MS = 4 * 60 * 60 * 1_000;
// Preview canvases sit inside a rendered iPhone bezel rather than a native
// safe-area provider. These reference insets keep the header clear of the
// Dynamic Island and preserve the physical lower bezel around the controls.
const PREVIEW_PHONE_INSETS = { top: 48, bottom: 24 };

type MapCoordinate = { latitude: number; longitude: number };

function QuestNoticePill({ notice, accent, message, bottomOffset = MAP_NOTICE_BOTTOM_OFFSET }: { notice: QuestNotice; accent: string; message?: string | null; bottomOffset?: number }) {
  const detail = notice === "active"
    ? { icon: "ellipse" as const, iconColor: T.green, label: "Quest in progress" }
    : notice === "paused"
      ? { icon: "pause" as const, iconColor: "#e7a52c", label: "Quest paused" }
      : notice === "photo-saved"
        ? { icon: "checkmark-circle" as const, iconColor: T.green, label: "Photo saved to your memories" }
        : { icon: "location-outline" as const, iconColor: accent, label: message ?? "Enable location to record your route" };
  return <View pointerEvents="none" style={{ position: "absolute", zIndex: 10, left: 20, right: 20, bottom: bottomOffset, alignItems: "center" }}>
    <View style={{ minHeight: 38, overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.94)", paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(232,223,213,0.84)", boxShadow: "0px 3px 10px rgba(61,52,56,0.12)" }}>
      <Ionicons name={detail.icon} size={notice === "active" ? 12 : 17} color={detail.iconColor} style={{ zIndex: 1 }} />
      <Text style={{ color: T.dark, fontSize: 13, lineHeight: 17, fontWeight: "900", zIndex: 1 }}>{detail.label}</Text>
    </View>
  </View>;
}

export function QuestCountdownOverlay({ step, accent }: { step: QuestCountdownStep; accent: string }) {
  const scale = useRef(new Animated.Value(0.74)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    scale.setValue(0.74);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: 13, stiffness: 230, mass: 0.7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, step]);
  const isGo = step === "GO";
  return <View pointerEvents="none" style={{ position: "absolute", inset: 0, zIndex: 4, alignItems: "center", justifyContent: "center", paddingBottom: BOTTOM_SHEET_CONTENT_HEIGHT }}>
    <Animated.View style={{ width: isGo ? 132 : 124, height: isGo ? 132 : 124, borderRadius: 62, alignItems: "center", justifyContent: "center", backgroundColor: isGo ? accent : `${accent}ed`, borderWidth: 5, borderColor: T.white, transform: [{ scale }], opacity, boxShadow: `0px 10px 24px ${accent}52` }}>
      <Text style={{ color: T.white, fontSize: isGo ? 36 : 68, lineHeight: isGo ? 42 : 74, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{step}</Text>
    </Animated.View>
  </View>;
}

function ActiveQuestTabs({ active, onChange, accent, disabled = false }: { active: ActiveQuestTab; onChange: (tab: ActiveQuestTab) => void; accent: string; disabled?: boolean }) {
  const tabs: { id: ActiveQuestTab; label: string }[] = [{ id: "map", label: "Map" }, { id: "album", label: "Memories" }, { id: "entry", label: "Activity" }];
  return <View style={{ marginHorizontal: 20, padding: 5, flexDirection: "row", alignSelf: "stretch", borderRadius: 18, backgroundColor: "#f7f3ee", borderWidth: 1, borderColor: T.border }}>
    {tabs.map((tab) => {
      const selected = tab.id === active;
      return <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => { haptic(); onChange(tab.id); }} style={({ pressed }) => ({ flex: 1, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: selected ? T.white : "transparent", borderWidth: selected ? 1 : 0, borderColor: selected ? `${accent}45` : "transparent", boxShadow: selected ? "0px 2px 0px rgba(61,52,56,0.08)" : "none", opacity: disabled ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
        <Text style={{ color: selected ? accent : "#867a79", fontSize: 16, lineHeight: 21, fontWeight: "900" }}>{tab.label}</Text>
      </Pressable>;
    })}
  </View>;
}

const LiveMap = memo(function LiveMap({ accent, route, renderSegments, checkpoints = [], deviceLocation, liveLocation, trackingStatus, trackingMessage, notice, onEnableTracking, forceEnablePrompt = false, routePromptNudge = 0, showUserLocation = true, animateInitialCamera = true }: { accent: string; route: ActiveQuestRoutePoint[]; renderSegments: ActiveQuestRenderableSegment[]; checkpoints?: ActiveQuestCheckpoint[]; deviceLocation: MapCoordinate | null; liveLocation: MapCoordinate | null; trackingStatus: "idle" | "tracking" | "permission-needed" | "unavailable"; trackingMessage: string | null; notice: QuestNotice | null; onEnableTracking: () => void; forceEnablePrompt?: boolean; routePromptNudge?: number; showUserLocation?: boolean; animateInitialCamera?: boolean }) {
  const map = useRef<MapView>(null);
  const [followingUser, setFollowingUser] = useState(true);
  const routeButtonNudge = useRef(new Animated.Value(0)).current;
  const current = route.at(-1);
  // The foreground location subscription drives the native map immediately;
  // accepted route points remain the source of truth for the saved polyline.
  const liveCoordinate = liveLocation ?? (current ? { latitude: current.latitude, longitude: current.longitude } : deviceLocation);
  const region = liveCoordinate ? { ...liveCoordinate, latitudeDelta: route.length > 1 ? 0.012 : 0.018, longitudeDelta: route.length > 1 ? 0.012 : 0.018 } : null;
  // The lower sheet covers a substantial part of the map. Centre the camera
  // slightly south of the user so the live dot stays in the visible area.
  const cameraRegion = region ? { ...region, latitude: region.latitude - region.latitudeDelta * 0.18 } : null;

  useEffect(() => {
    if (animateInitialCamera && cameraRegion && followingUser) map.current?.animateToRegion(cameraRegion, 450);
  }, [animateInitialCamera, cameraRegion?.latitude, cameraRegion?.longitude, followingUser]);

  useEffect(() => {
    if (!routePromptNudge) return;
    Animated.sequence([
      Animated.timing(routeButtonNudge, { toValue: -6, duration: 120, useNativeDriver: true }),
      Animated.timing(routeButtonNudge, { toValue: 3, duration: 130, useNativeDriver: true }),
      Animated.timing(routeButtonNudge, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [routeButtonNudge, routePromptNudge]);

  if (forceEnablePrompt || !region) return <View style={{ flex: 1, backgroundColor: "#edf0eb", alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: BOTTOM_SHEET_CONTENT_HEIGHT, gap: 12 }}>
    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: `${accent}1c`, alignItems: "center", justifyContent: "center" }}><Ionicons name="location-outline" size={27} color={accent} /></View>
    <Text style={{ color: T.dark, fontSize: 19, lineHeight: 25, fontWeight: "900", textAlign: "center" }}>Ready to map your quest</Text>
    <Text style={{ color: T.muted, maxWidth: 280, fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" }}>Enable location to centre the map on where you actually are and start recording your route.</Text>
    <Animated.View style={{ transform: [{ translateY: routeButtonNudge }] }}><Pressable accessibilityRole="button" onPress={onEnableTracking} style={({ pressed }) => ({ minHeight: 58, marginTop: 4, borderRadius: 20, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: accent, borderBottomWidth: 6, borderBottomColor: "#258fd8", transform: [{ translateY: pressed ? 3 : 0 }] })}><Text style={{ color: T.white, fontSize: 14, fontWeight: "900" }}>Enable route recording</Text></Pressable></Animated.View>
    {notice ? <QuestNoticePill notice={notice} accent={accent} message={trackingMessage} /> : null}
  </View>;

  return <View style={{ flex: 1, backgroundColor: "#e5e8e2" }}>
    <MapView ref={map} style={{ flex: 1 }} initialRegion={cameraRegion ?? undefined} mapType="standard" showsPointsOfInterest={false} showsBuildings={false} showsUserLocation={showUserLocation} showsMyLocationButton={false} showsCompass toolbarEnabled={false} onPanDrag={() => setFollowingUser(false)}>
      {renderSegments.map((segment) => {
        const coordinates = segment.points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
        return coordinates.length > 1 ? <Polyline key={segment.id} coordinates={coordinates} strokeColor={segment.state === "paused" ? "#9D93A0" : accent} strokeWidth={5} lineCap="round" lineJoin="round" /> : null;
      })}
      {route[0] ? <Marker coordinate={{ latitude: route[0].latitude, longitude: route[0].longitude }} anchor={{ x: 0.5, y: 0.5 }} title="Quest started"><View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 4, borderColor: T.white, backgroundColor: accent }} /></Marker> : null}
      {current && route.length > 1 ? <Marker coordinate={{ latitude: current.latitude, longitude: current.longitude }} anchor={{ x: 0.5, y: 0.5 }} title="Current route end"><View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 4, borderColor: T.white, backgroundColor: T.dark }} /></Marker> : null}
      {checkpoints.map((checkpoint) => <Marker key={checkpoint.id} coordinate={{ latitude: checkpoint.latitude, longitude: checkpoint.longitude }} title={checkpoint.label} pinColor={accent} />)}
    </MapView>
    {!followingUser ? <Pressable accessibilityRole="button" accessibilityLabel="Recenter map on your route" onPress={() => setFollowingUser(true)} style={({ pressed }) => ({ position: "absolute", left: 18, bottom: MAP_RECENTER_BOTTOM_OFFSET, width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: T.white, borderWidth: 1, borderColor: T.border, boxShadow: "0px 2px 6px rgba(61,52,56,0.14)", transform: [{ scale: pressed ? 0.94 : 1 }] })}><Ionicons name="locate" size={21} color={accent} /></Pressable> : null}
    {notice ? <QuestNoticePill notice={notice} accent={accent} message={trackingStatus === "permission-needed" || trackingStatus === "unavailable" ? trackingMessage : null} /> : null}
  </View>;
});

function QuestStartupSurface({ accent, step }: { accent: string; step: QuestCountdownStep | null }) {
  return <View style={{ flex: 1, backgroundColor: "#edf0eb", alignItems: "center", justifyContent: "center", paddingBottom: BOTTOM_SHEET_CONTENT_HEIGHT }}>
    <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: `${accent}16`, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="navigate" size={32} color={accent} />
    </View>
    <Text style={{ marginTop: 18, color: T.dark, fontSize: 18, fontWeight: "900" }}>Get ready to begin</Text>
    {step ? <QuestCountdownOverlay step={step} accent={accent} /> : null}
  </View>;
}

function Album({ accent, photos, onManage }: { accent: string; photos: ActiveQuestPhoto[]; onManage: (photo: ActiveQuestPhoto) => void }) {
  if (!photos.length) return <View style={{ flex: 1, paddingHorizontal: 22, paddingBottom: BOTTOM_SHEET_CONTENT_HEIGHT + 92, backgroundColor: "#f8f7f3", alignItems: "center", justifyContent: "center", gap: 12 }}><View style={{ width: "100%", aspectRatio: 1.55, borderRadius: 20, borderWidth: 2, borderStyle: "dashed", borderColor: `${accent}88`, backgroundColor: `${accent}0e`, alignItems: "center", justifyContent: "center", gap: 9 }}><View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${accent}18`, alignItems: "center", justifyContent: "center" }}><Ionicons name="camera" size={23} color={accent} /></View><Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>Capture the little moments</Text><Text style={{ maxWidth: 250, color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" }}>Photos from this quest will appear here as a two-column memory stream.</Text></View></View>;
  return <FlatList data={photos} keyExtractor={(photo) => String(photo.id)} numColumns={2} removeClippedSubviews windowSize={5} initialNumToRender={6} maxToRenderPerBatch={4} updateCellsBatchingPeriod={80} columnWrapperStyle={{ gap: 10 }} contentContainerStyle={{ padding: 16, paddingBottom: 230, gap: 10, backgroundColor: "#f8f7f3" }} renderItem={({ item: photo }) => <View style={{ flex: 1, aspectRatio: 0.88, overflow: "hidden", borderRadius: 18, backgroundColor: T.border }}><CachedImage uri={photo.uri} style={{ width: "100%", height: "100%" }} /><Pressable accessibilityRole="button" accessibilityLabel="Manage photo" onPress={() => onManage(photo)} hitSlop={7} style={({ pressed }) => ({ position: "absolute", top: 8, right: 8, width: 31, height: 31, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.94)", opacity: pressed ? 0.7 : 1 })}><Ionicons name="ellipsis-horizontal" size={18} color={T.dark} /></Pressable>{photo.syncStatus !== "synced" ? <View style={{ position: "absolute", right: 8, bottom: 8, borderRadius: 12, padding: 5, backgroundColor: "rgba(255,255,255,0.88)" }}><Ionicons name="cloud-upload-outline" size={15} color={accent} /></View> : null}</View>} />;
}

function activityTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ActivityTimeline({ activity, photos, accent, onManage, focusLatest = false }: { activity: ActiveQuestActivity[]; photos: ActiveQuestPhoto[]; accent: string; onManage: (activity: ActiveQuestActivity) => void; focusLatest?: boolean }) {
  const list = useRef<FlatList<ActiveQuestActivity>>(null);
  const [loadRange, setLoadRange] = useState({ start: 0, end: 3 });
  const photoById = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 1 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const indexes = viewableItems.map((item) => item.index).filter((index): index is number => index !== null);
    if (!indexes.length) return;
    const first = Math.min(...indexes);
    const last = Math.max(...indexes);
    setLoadRange((current) => current.start === Math.max(0, first - 3) && current.end === last + 3 ? current : { start: Math.max(0, first - 3), end: last + 3 });
  }).current;

  useEffect(() => {
    if (!focusLatest || !activity.length) return;
    const timer = setTimeout(() => list.current?.scrollToEnd({ animated: false }), 0);
    return () => clearTimeout(timer);
  }, [activity.length, focusLatest]);

  if (!activity.length) return <View style={{ flex: 1, paddingHorizontal: 28, paddingBottom: 150, backgroundColor: "#f8f7f3", alignItems: "center", justifyContent: "center", gap: 12 }}>
    <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: `${accent}16` }}><Ionicons name="pulse-outline" size={27} color={accent} /></View>
    <Text style={{ color: T.dark, fontSize: 19, lineHeight: 25, fontWeight: "900", textAlign: "center" }}>Your quest story starts here</Text>
    <Text style={{ maxWidth: 300, color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" }}>Add a quick note or photo and every moment will appear in this timeline.</Text>
  </View>;

  return <FlatList
    ref={list}
    data={activity}
    keyExtractor={(item) => String(item.id)}
    initialNumToRender={4}
    windowSize={7}
    removeClippedSubviews
    onViewableItemsChanged={onViewableItemsChanged}
    viewabilityConfig={viewabilityConfig}
    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 224, backgroundColor: "#f8f7f3", gap: 14 }}
    renderItem={({ item, index }) => {
      const photo = item.photoId ? photoById.get(item.photoId) : undefined;
      const shouldLoadImage = index >= loadRange.start && index <= loadRange.end;
      const icon = item.kind === "photo" ? "camera" : item.kind === "badge" ? "ribbon" : "create";
      const label = item.kind === "photo" ? "Quest photo" : item.kind === "badge" ? "Badge earned" : "Quick note";
      return <View style={{ flexDirection: "row", alignItems: "stretch", gap: 10 }}>
        <View style={{ width: 56, alignItems: "flex-end", paddingTop: 12 }}>
          <Text style={{ color: "#8c8487", fontSize: 11, lineHeight: 15, fontWeight: "900" }}>{activityTime(item.createdAt)}</Text>
        </View>
        <View style={{ width: 18, alignItems: "center" }}>
          <View style={{ position: "absolute", top: 25, bottom: -28, width: 2, backgroundColor: `${accent}26` }} />
          <View style={{ width: 18, height: 18, marginTop: 10, borderRadius: 9, backgroundColor: accent, borderWidth: 3, borderColor: "#f8f7f3" }} />
        </View>
        <View style={{ flex: 1, overflow: "hidden", borderRadius: 20, padding: 15, gap: 10, backgroundColor: T.white, borderWidth: 1, borderColor: T.border, boxShadow: "0px 3px 10px rgba(61,52,56,0.08)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><View style={{ width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: `${accent}16` }}><Ionicons name={icon} size={14} color={accent} /></View><Text style={{ flex: 1, color: T.muted, fontSize: 11, lineHeight: 15, fontWeight: "900", letterSpacing: 0.35, textTransform: "uppercase" }}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Manage ${label.toLowerCase()}`} onPress={() => onManage(item)} hitSlop={7} style={({ pressed }) => ({ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? T.bg : "transparent" })}><Ionicons name="ellipsis-horizontal" size={18} color={T.muted} /></Pressable></View>
          {item.kind === "photo" ? <>
            {item.caption ? <Text style={{ color: T.dark, fontSize: 16, lineHeight: 23, fontWeight: "800" }}>{item.caption}</Text> : null}
            {photo && shouldLoadImage ? <CachedImage uri={photo.uri} style={{ width: "100%", aspectRatio: 1.15, borderRadius: 14, backgroundColor: T.border }} /> : <View style={{ width: "100%", aspectRatio: 1.15, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${accent}10` }}><Ionicons name="image-outline" size={25} color={accent} /></View>}
          </> : <Text style={{ color: T.dark, fontSize: 16, lineHeight: 24, fontWeight: "700" }}>{item.kind === "badge" ? item.badgeLabel : item.body}</Text>}
        </View>
      </View>;
    }}
  />;
}

function FloatingQuestControls({ accent, duration, paused, takingPhoto, bottomInset, onTakePhoto, onQuickNote, onFinish, onTogglePaused, locked = false, forcedOpen = false, allowQuickActions = false, allowPhotoCapture = false, allowQuickNote = false, showQuickActionsWhenPaused = false, onQuickActionsOpened, onQuickNoteOpened }: { accent: string; duration: string; paused: boolean; takingPhoto: boolean; bottomInset: number; onTakePhoto: () => void; onQuickNote: () => void; onFinish: () => void; onTogglePaused: () => void; locked?: boolean; forcedOpen?: boolean; allowQuickActions?: boolean; allowPhotoCapture?: boolean; allowQuickNote?: boolean; showQuickActionsWhenPaused?: boolean; onQuickActionsOpened?: () => void; onQuickNoteOpened?: () => void }) {
  const [open, setOpen] = useState(false);
  const menuProgress = useRef(new Animated.Value(0)).current;
  const pauseProgress = useRef(new Animated.Value(paused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(menuProgress, { toValue: open ? 1 : 0, damping: 18, stiffness: 260, mass: 0.72, useNativeDriver: true }).start();
  }, [menuProgress, open]);

  useEffect(() => {
    Animated.spring(pauseProgress, { toValue: paused ? 1 : 0, damping: 17, stiffness: 230, mass: 0.76, useNativeDriver: true }).start();
    if (paused) setOpen(false);
  }, [pauseProgress, paused]);

  useEffect(() => {
    setOpen(forcedOpen);
  }, [forcedOpen]);

  // While paused, ending the quest has its own red control. Keeping it out
  // of the + menu prevents a duplicate destructive action and lets it move
  // above the expanded actions as a deliberate final choice.
  const actions: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void }> = [
    ...(!paused ? [{ label: "End quest", icon: "flag" as const, color: T.red, onPress: onFinish }] : []),
    { label: "Quick note", icon: "create-outline", color: T.orange, onPress: onQuickNote },
    { label: takingPhoto ? "Opening camera" : "Take photo", icon: takingPhoto ? "hourglass" : "camera", color: accent, onPress: onTakePhoto },
  ];

  const controlBottom = Math.max(bottomInset + 10, 18);
  const quickActionLift = pauseProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -82] });
  // `bottom` is a layout property and cannot be driven by the native animated
  // module. Keep the menu anchored and compose its pause offset into the
  // existing transform so the whole transition stays off the JS thread.
  const actionMenuPauseLift = pauseProgress.interpolate({ inputRange: [0, 1], outputRange: [-82, -164] });
  const actionMenuEnterLift = menuProgress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const actionMenuLift = Animated.add(actionMenuPauseLift, actionMenuEnterLift);
  const stopAboveMenuProgress = Animated.multiply(pauseProgress, menuProgress);
  const stopMenuLift = stopAboveMenuProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -220] });
  return <View pointerEvents="box-none" style={{ position: "absolute", left: 20, right: 20, bottom: controlBottom, flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
    <View pointerEvents="none" style={{ position: "absolute", left: -20, right: -20, bottom: -controlBottom, height: 150, overflow: "hidden" }}>
      <MaskedView style={{ position: "absolute", inset: 0 }} maskElement={<LinearGradient colors={["transparent", "rgba(0,0,0,0.52)", "#000000"]} locations={[0, 0.42, 0.72]} style={{ flex: 1 }} />}>
        <BlurView tint="light" intensity={16} style={{ position: "absolute", inset: 0 }} />
        <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255,252,248,0.36)", borderTopWidth: 1, borderTopColor: "rgba(232,223,213,0.42)" }} />
      </MaskedView>
    </View>
    <View style={{ flex: 1, minHeight: 74, borderRadius: 26, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 12, backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: "rgba(232,223,213,0.94)", boxShadow: "0px 8px 22px rgba(35,40,37,0.20)" }}>
      <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
        <Text style={{ color: T.dark, fontSize: 22, lineHeight: 27, fontWeight: "900", fontVariant: ["tabular-nums"], textAlign: "center" }}>{duration}</Text>
        <Text style={{ color: T.muted, fontSize: 11, lineHeight: 15, fontWeight: "900", letterSpacing: 0.45, textTransform: "uppercase", textAlign: "center" }}>{paused ? "Quest paused" : "Quest time"}</Text>
      </View>
      <View style={{ width: 1, alignSelf: "stretch", marginVertical: 13, backgroundColor: "rgba(232,223,213,0.92)" }} />
      <Pressable accessibilityRole="button" accessibilityLabel={paused ? "Resume quest" : "Pause quest"} accessibilityState={{ disabled: locked }} disabled={locked} onPress={() => { haptic(); onTogglePaused(); }} style={({ pressed }) => ({ width: 52, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: `${accent}16`, borderWidth: 2, borderColor: accent, borderBottomWidth: pressed ? 2 : 4, borderBottomColor: `${accent}88`, opacity: pressed ? 0.82 : 1, transform: [{ scale: pressed ? 0.96 : 1 }, { translateY: pressed ? 2 : 0 }] })}><Ionicons name={paused ? "play" : "pause"} size={21} color={accent} /></Pressable>
    </View>
    <View style={{ width: 70, height: 70, overflow: "visible" }}>
      <Animated.View pointerEvents={open ? "auto" : "none"} style={{ position: "absolute", right: 0, bottom: 0, width: 224, gap: 10, opacity: menuProgress, transform: [{ translateY: actionMenuLift }, { scale: menuProgress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>
        {actions.map((action, index) => <View key={action.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
          <View style={{ maxWidth: 150, minHeight: 38, borderRadius: 19, paddingHorizontal: 13, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: "rgba(232,223,213,0.94)", boxShadow: "0px 4px 13px rgba(35,40,37,0.16)" }}><Text numberOfLines={1} style={{ color: T.dark, fontSize: 13, lineHeight: 17, fontWeight: "900" }}>{action.label}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={action.label} disabled={(locked && !((action.label === "Take photo" && allowPhotoCapture) || (action.label === "Quick note" && allowQuickNote))) || (takingPhoto && action.label === "Take photo")} onPress={() => { haptic(); if (!forcedOpen) setOpen(false); if (action.label === "Quick note") onQuickNoteOpened?.(); action.onPress(); }} style={({ pressed }) => ({ width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: action.color, borderWidth: 3, borderColor: T.white, boxShadow: "0px 5px 13px rgba(35,40,37,0.20)", opacity: pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] })}><Ionicons name={action.icon} size={25} color={T.white} /></Pressable>
        </View>)}
      </Animated.View>
      <Animated.View pointerEvents={paused ? "auto" : "none"} style={{ position: "absolute", right: 0, bottom: 0, opacity: pauseProgress, transform: [{ translateY: stopMenuLift }, { scale: pauseProgress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel="End quest" disabled={locked} onPress={() => { haptic(); onFinish(); }} style={({ pressed }) => ({ width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", backgroundColor: T.red, borderWidth: 3, borderColor: T.white, boxShadow: "0px 8px 20px rgba(35,40,37,0.24)", transform: [{ scale: pressed ? 0.92 : 1 }] })}><Ionicons name="stop" size={27} color={T.white} /></Pressable>
      </Animated.View>
      <Animated.View style={{ position: "absolute", right: 0, bottom: 0, zIndex: 2, transform: [{ translateY: quickActionLift }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={open ? "Close quest actions" : "Open quest actions"} accessibilityState={{ expanded: open, disabled: locked && !allowQuickActions }} disabled={locked && !allowQuickActions} onPress={() => { haptic(); setOpen((current) => { const next = !current; if (next) onQuickActionsOpened?.(); return next; }); }} style={({ pressed }) => ({ width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", backgroundColor: open ? T.dark : accent, borderWidth: 3, borderColor: T.white, boxShadow: "0px 8px 20px rgba(35,40,37,0.24)", transform: [{ scale: pressed ? 0.92 : 1 }] })}><Animated.View style={{ transform: [{ rotate: menuProgress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) }] }}><Ionicons name="add" size={38} color={T.white} /></Animated.View></Pressable>
      </Animated.View>
    </View>
  </View>;
}

function StaleQuestActionButton({ label, icon, onPress, disabled = false, inverse = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; inverse?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { if (!disabled) { haptic(); onPress(); } }} style={({ pressed }) => ({ minHeight: 58, borderRadius: 20, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: inverse ? T.white : T.blue, borderWidth: inverse ? 3 : 0, borderColor: inverse ? T.border : "transparent", borderBottomWidth: inverse ? 3 : 6, borderBottomColor: inverse ? T.border : "#258fd8", opacity: disabled ? 0.5 : 1, transform: [{ translateY: pressed && !disabled ? 3 : 0 }] })}>
    <Ionicons name={icon} size={21} color={inverse ? T.blue : T.white} />
    <Text style={{ color: inverse ? T.blue : T.white, fontFamily: "RubikBold", fontSize: 17, lineHeight: 22, fontWeight: "900" }}>{label}</Text>
  </Pressable>;
}

function StaleQuestReminder({
  visible,
  elapsedLabel,
  busy,
  onResume,
  onSaveForLater,
  onAbandon,
}: {
  visible: boolean;
  elapsedLabel: string;
  busy: boolean;
  onResume: () => void;
  onSaveForLater: () => void;
  onAbandon: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onResume} maxHeight="70%">
      <View style={{ paddingHorizontal: 24, paddingBottom: 26, gap: 13 }}>
        <View style={{ alignItems: "center", gap: 8 }}>
          <View style={{ width: 58, height: 58, borderRadius: 21, backgroundColor: `${T.orange}16`, alignItems: "center", justifyContent: "center" }}><Ionicons name="time-outline" size={29} color={T.orange} /></View>
          <Text style={{ color: T.dark, fontSize: 23, lineHeight: 29, fontWeight: "900", textAlign: "center" }}>Still on this quest?</Text>
          <Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" }}>It has been active for {elapsedLabel}. Continue when you are ready, or clear it from your day.</Text>
        </View>
        <View style={{ gap: 9 }}>
          <StaleQuestActionButton label="Resume quest" icon="play" onPress={onResume} disabled={busy} />
          <StaleQuestActionButton label="Save for later" icon="bookmark-outline" inverse onPress={onSaveForLater} disabled={busy} />
          <Pressable accessibilityRole="button" accessibilityLabel="Abandon this quest" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onAbandon} style={({ pressed }) => ({ minHeight: 42, alignItems: "center", justifyContent: "center", opacity: busy || pressed ? 0.65 : 1 })}><Text style={{ color: T.red, fontFamily: "RubikBold", fontSize: 16, lineHeight: 21, fontWeight: "900" }}>Abandon this quest</Text></Pressable>
        </View>
      </View>
    </Sheet>
  );
}

function QuestCompletionScreen({
  completion,
  questTitle,
  destination,
  onClose,
}: {
  completion: CompletionResult;
  questTitle: string;
  destination: CompletionDestination;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const energyLeft = Math.max(0, completion.dailyLimit - completion.dailyUsed);
  return (
    <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: insets.top + 10 }}>
      <StatusBar style="dark" />
      <View style={{ alignItems: "flex-end", paddingHorizontal: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={destination === "feed" ? "Close and open your feed" : "Close and open your Journal"} onPress={onClose} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: T.white, borderWidth: 2, borderColor: T.border, boxShadow: "2px 3px 0px #e6ddd2", opacity: pressed ? 0.72 : 1, transform: [{ translateY: pressed ? 2 : 0 }] })}><Ionicons name="close" size={23} color={T.dark} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingBottom: 56, gap: 22 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: "center", gap: 10 }}>
          <View style={{ width: 104, height: 104, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: `${T.yellow}32`, borderWidth: 3, borderColor: `${T.orange}55`, borderBottomWidth: 7, borderBottomColor: `${T.orange}88`, boxShadow: `0px 12px 26px ${T.orange}2e` }}><Ionicons name="trophy" size={53} color={T.orange} /></View>
          <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 31, lineHeight: 37, textAlign: "center" }}>Quest complete!</Text>
          <Text style={{ color: T.muted, fontSize: 15, lineHeight: 22, fontWeight: "700", textAlign: "center" }} numberOfLines={2}>{questTitle}</Text>
        </View>
        <View style={{ borderRadius: 24, borderWidth: 2, borderColor: T.border, borderBottomWidth: 6, borderBottomColor: "#e6ddd2", backgroundColor: T.white, overflow: "hidden" }}>
          <View style={{ padding: 18, alignItems: "center", gap: 4, backgroundColor: `${T.blue}08` }}><Text style={{ color: T.blue, fontFamily: "RubikBlack", fontSize: 30, lineHeight: 36 }}>+{completion.xpAwarded} XP</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>earned for this quest</Text></View>
          <View style={{ height: 1, backgroundColor: T.border }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 15 }}><View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${T.orange}16` }}><QuestlifeFlame size={26} /></View><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 15, lineHeight: 20, fontWeight: "900" }}>Your streak is covered today</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>Today counts as a completed day.</Text></View></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingBottom: 16 }}><View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${T.green}16` }}><Ionicons name="battery-half" size={22} color={T.green} /></View><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 15, lineHeight: 20, fontWeight: "900" }}>{energyLeft ? `${energyLeft} ${energyLeft === 1 ? "quest" : "quests"} of energy left` : "Today's energy is complete"}</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>{energyLeft ? "You can keep exploring whenever it feels right." : "Rest up. Your energy resets at midnight."}</Text></View></View>
        </View>
        <Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" }}>Your {destination === "feed" ? "post is live in the feed" : "memory is saved in your Journal"}. Close this celebration when you’re ready.</Text>
      </ScrollView>
    </View>
  );
}

function ActiveQuestLoadingSkeleton() {
  return <View accessibilityRole="progressbar" accessibilityLabel="Loading active quest" style={{ flex: 1, backgroundColor: T.bg, paddingHorizontal: 20, paddingTop: 24, gap: 16 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: T.border }} /><View style={{ width: 112, height: 18, borderRadius: 9, backgroundColor: T.border }} /><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: T.border }} /></View><View style={{ height: 128, borderRadius: 26, backgroundColor: `${T.blue}10`, gap: 12, padding: 20 }}><View style={{ width: "42%", height: 14, borderRadius: 7, backgroundColor: T.border }} /><View style={{ width: "78%", height: 27, borderRadius: 9, backgroundColor: T.border }} /><View style={{ width: "58%", height: 13, borderRadius: 7, backgroundColor: T.border }} /></View><View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1, height: 94, borderRadius: 22, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }} /><View style={{ flex: 1, height: 94, borderRadius: 22, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }} /></View><View style={{ flex: 1, borderRadius: 24, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, padding: 16, gap: 12 }}><View style={{ width: "36%", height: 16, borderRadius: 8, backgroundColor: T.border }} /><View style={{ width: "100%", height: 12, borderRadius: 6, backgroundColor: T.border }} /><View style={{ width: "82%", height: 12, borderRadius: 6, backgroundColor: T.border }} /><View style={{ width: "67%", height: 12, borderRadius: 6, backgroundColor: T.border }} /></View><View style={{ height: 58, borderRadius: 20, backgroundColor: `${T.blue}26` }} /></View>;
}

export function ActiveQuestScreen({ preview = false, onboarding, previewQuest, previewRoute, previewElapsedMs }: { preview?: boolean; onboarding?: ActiveQuestOnboardingOptions; previewQuest?: Quest; previewRoute?: ActiveQuestRoutePoint[]; previewElapsedMs?: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const screenInsets = preview ? PREVIEW_PHONE_INSETS : insets;
  const { engine, refresh, abandonActiveQuest, saveActiveForLater } = useQuestEngine();
  const { guestSession } = useGuestQuest();
  const { showFeedback } = useAppFeedback();
  const { snapshot, liveLocation, loading: activeQuestLoading, trackingMessage, pause, resume, saveEntry, enableTracking, addActivityNote, addPhoto, updateActivity, deleteActivity, deletePhoto, finishLocalQuest } = useActiveQuest();
  const { getQuest } = useContent();
  const [tab, setTab] = useState<ActiveQuestTab>("map");
  const [completeVisible, setCompleteVisible] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingPhotoCaption, setPendingPhotoCaption] = useState("");
  const [pendingPhotoIsTutorialMock, setPendingPhotoIsTutorialMock] = useState(false);
  const [quickNoteVisible, setQuickNoteVisible] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [managedActivity, setManagedActivity] = useState<ActiveQuestActivity | null>(null);
  const [managedPhoto, setManagedPhoto] = useState<ActiveQuestPhoto | null>(null);
  const [activityDraft, setActivityDraft] = useState("");
  const [countdownStep, setCountdownStep] = useState<QuestCountdownStep | null>(null);
  const [countdownLaunchAt, setCountdownLaunchAt] = useState<number | null>(null);
  const [startupCompleteForSession, setStartupCompleteForSession] = useState<string | null>(null);
  const [photoSavedVisible, setPhotoSavedVisible] = useState(false);
  const [staleQuestReminderVisible, setStaleQuestReminderVisible] = useState(false);
  const [staleQuestActionBusy, setStaleQuestActionBusy] = useState(false);
  const [completionReward, setCompletionReward] = useState<{ result: CompletionResult; questTitle: string; destination: CompletionDestination } | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<MapCoordinate | null>(null);
  const countdownSessionRef = useRef<string | null>(null);
  const routeRecordingStartedSessionRef = useRef<string | null>(null);
  const staleQuestReminderShownForSessionRef = useRef<string | null>(null);
  const shownTutorialMockRef = useRef<string | null>(null);
  const session = engine?.activeSession ?? guestSession;
  const isGuestQuest = Boolean(guestSession && session?.id === guestSession.id);
  const loadedQuest = getQuest(session?.questId);
  // An active session remains completable even if the live content list has
  // not loaded yet, or the quest was subsequently unpublished. The completion
  // RPC uses the stable session quest ID, so a lightweight local fallback
  // prevents the user being trapped on this screen.
  const quest: Quest | null = previewQuest ?? loadedQuest ?? (session ? {
    id: session.questId,
    title: isGuestQuest ? "Personalize your Quest" : "Your active quest",
    category: "ADVENTURE",
    xp: 0,
    description: "",
    steps: [],
    timeMin: 0,
    timeLabel: "Flexible",
    difficulty: "EASY",
    status: "published",
    featured: false,
    color: T.blue,
    saved: false,
    completed: false,
  } : null);
  const accent = quest ? (categoryColor[quest.category]?.text ?? quest.color) : T.blue;
  const paused = snapshot?.session.recordingState === "paused";
  const countdownStartedAt = snapshot?.session.startedAt ?? session?.startedAt;
  // Keep the wall-clock duration for the stale-session safeguard, but render
  // the timer from the pause-aware local recording record.
  const wallElapsedDuration = useElapsedDuration(session?.startedAt);
  const currentRecordingSegmentDuration = useElapsedDuration(snapshot?.session.activeSince);
  const elapsedDuration = (snapshot?.session.activeDurationMs ?? 0) + (paused ? 0 : currentRecordingSegmentDuration);
  const isFreshSession = Boolean(session?.id && countdownStartedAt && (onboarding?.forceCountdown || Date.now() - new Date(countdownStartedAt).getTime() <= 15_000));
  const shouldPlayCountdown = !onboarding?.holdCountdown && isFreshSession && snapshot?.session.recordingState === "paused";
  const isCountdownPending = shouldPlayCountdown && countdownSessionRef.current !== session?.id && !countdownLaunchAt;
  const isStartingQuest = preview ? false : isCountdownPending || Boolean(countdownLaunchAt && startupCompleteForSession !== session?.id);
  useEffect(() => {
    if (onboarding?.forcedTab) setTab(onboarding.forcedTab);
  }, [onboarding?.forcedTab]);

  useEffect(() => {
    const mockUri = onboarding?.tutorialMockPhotoUri;
    if (!mockUri) {
      shownTutorialMockRef.current = null;
      return;
    }
    if (shownTutorialMockRef.current === mockUri) return;
    shownTutorialMockRef.current = mockUri;
    setPendingPhotoUri(mockUri);
    setPendingPhotoCaption("");
    setPendingPhotoIsTutorialMock(true);
  }, [onboarding?.tutorialMockPhotoUri]);
  useEffect(() => {
    if (preview || !session?.id || wallElapsedDuration < STALE_ACTIVE_QUEST_AFTER_MS || staleQuestReminderShownForSessionRef.current === session.id) return;
    staleQuestReminderShownForSessionRef.current = session.id;
    setStaleQuestReminderVisible(true);
  }, [preview, session?.id, wallElapsedDuration]);

  const resolveDeviceLocation = useCallback(async () => {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return;
    const known = await Location.getLastKnownPositionAsync({ requiredAccuracy: 100 });
    if (known) setDeviceLocation({ latitude: known.coords.latitude, longitude: known.coords.longitude });
    try {
      const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDeviceLocation({ latitude: fresh.coords.latitude, longitude: fresh.coords.longitude });
    } catch {
      // The last known location remains useful; the Map tab never falls back to
      // a fabricated city when the device is still resolving a fresh fix.
    }
  }, []);

  useEffect(() => {
    if (!preview && tab === "map" && !isStartingQuest) void resolveDeviceLocation();
  }, [isStartingQuest, preview, resolveDeviceLocation, tab]);

  const beginQuestRoute = useCallback(async () => {
    if (snapshot?.session.recordingState === "paused") {
      await resume();
      return;
    }
    await enableTracking();
    await resolveDeviceLocation();
  }, [enableTracking, resolveDeviceLocation, resume, snapshot?.session.recordingState]);

  useEffect(() => {
    if (preview || onboarding?.holdCountdown || !session?.id || !countdownStartedAt || (!onboarding?.forceCountdown && Date.now() - new Date(countdownStartedAt).getTime() > 15_000)) {
      setCountdownLaunchAt(null);
      return;
    }
    if (!snapshot || activeQuestLoading) return;
    if (snapshot.session.recordingState !== "paused") return;
    if (countdownSessionRef.current === session.id) return;
    countdownSessionRef.current = session.id;
    setCountdownLaunchAt(Date.now());
  }, [activeQuestLoading, countdownStartedAt, onboarding?.forceCountdown, onboarding?.holdCountdown, preview, session?.id, snapshot]);

  useEffect(() => {
    if (preview || !session?.id || !countdownLaunchAt) return;
    const phases: { delay: number; step: QuestCountdownStep }[] = [
      { delay: 0, step: 3 },
      { delay: 850, step: 2 },
      { delay: 1_700, step: 1 },
      { delay: 2_550, step: "GO" },
    ];
    const timers = phases.map(({ delay, step }) => setTimeout(() => {
      haptic();
      setCountdownStep(step);
    }, delay));
    const finishTimer = setTimeout(() => {
      setCountdownStep(null);
      setCountdownLaunchAt(null);
      setStartupCompleteForSession(session.id);
      onboarding?.onCountdownFinished?.();
      if (routeRecordingStartedSessionRef.current !== session.id) {
        routeRecordingStartedSessionRef.current = session.id;
        // Mounting the native map and requesting GPS can be expensive. Start
        // them after the countdown has yielded its final frame to the UI.
        InteractionManager.runAfterInteractions(() => { void beginQuestRoute(); });
      }
    }, 3_400);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finishTimer);
    };
  }, [beginQuestRoute, countdownLaunchAt, onboarding, preview, session?.id]);

  useEffect(() => {
    if (!photoSavedVisible) return;
    const timer = setTimeout(() => setPhotoSavedVisible(false), 2_800);
    return () => clearTimeout(timer);
  }, [photoSavedVisible]);

  const duration = formatElapsedFull(previewElapsedMs ?? elapsedDuration);
  const renderedRoute = snapshot?.route ?? previewRoute ?? [];
  const renderedSegments = snapshot?.renderSegments ?? (previewRoute?.length ? [{ id: "preview-route", state: "active" as const, points: previewRoute }] : []);
  const previewLocation = previewRoute?.at(-1);

  if (completionReward) {
    return <QuestCompletionScreen
      completion={completionReward.result}
      questTitle={completionReward.questTitle}
      destination={completionReward.destination}
      onClose={() => {
        const destination = completionReward.destination;
        setCompletionReward(null);
        if (isGuestQuest) {
          router.replace("/(auth)/auth-options");
          return;
        }
        router.replace(destination === "feed" ? "/(tabs)/social" : "/(tabs)/journal");
      }}
    />;
  }

  // The guest guide needs the real shell immediately so it can teach the
  // controls while the device-local snapshot finishes hydrating.
  if (activeQuestLoading && session && !preview && !onboarding) return <ActiveQuestLoadingSkeleton />;

  if ((!session && !previewQuest) || !quest) return <View style={{ flex: 1, paddingTop: screenInsets.top + 24, backgroundColor: T.bg }}><EmptyState emoji="🧭" title="No active quest" body="Start a solo quest from Explore to create its live home." /></View>;

  const togglePaused = () => { void (paused ? resume() : pause()); };
  const enableRouteRecording = beginQuestRoute;
  const handleEnableRouteRecording = () => {
    // During guest onboarding the quest intentionally stays paused until the
    // guide's final countdown. Request route access without resuming time.
    const request = onboarding?.holdCountdown
      ? enableTracking().then(resolveDeviceLocation)
      : enableRouteRecording();
    void request.finally(() => onboarding?.onRouteRecordingRequested?.());
  };
  const takePhoto = async () => {
    if (takingPhoto) return;
    setTakingPhoto(true);
    onboarding?.onPhotoCaptureStarted?.();
    let captured = false;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Camera access needed",
          permission.canAskAgain
            ? "Allow camera access to capture this quest memory."
            : "Camera access is turned off for QuestLife. Enable it in Settings to capture this quest memory.",
          permission.canAskAgain
            ? [{ text: "Not now", style: "cancel" }]
            : [
                { text: "Not now", style: "cancel" },
                { text: "Open Settings", onPress: () => void Linking.openSettings() },
              ],
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        cameraType: ImagePicker.CameraType.back,
        quality: 0.78,
      });
      if (!result.canceled && result.assets[0]) {
        captured = true;
        setPendingPhotoUri(result.assets[0].uri);
        setPendingPhotoCaption("");
        setPendingPhotoIsTutorialMock(false);
      }
    } catch (nextError) {
      Alert.alert(
        "Couldn’t open camera",
        nextError instanceof Error
          ? nextError.message
          : "Your quest is still active. Please try taking the photo again.",
      );
    } finally {
      setTakingPhoto(false);
      onboarding?.onPhotoCaptureFinished?.(captured);
    }
  };
  const saveQuickNote = async () => {
    const note = quickNote.trim();
    if (!note) {
      if (onboarding?.allowQuickNote) {
        showFeedback({ message: "Write a note before saving it.", icon: "create", color: T.orange });
        return;
      }
      setQuickNoteVisible(false);
      return;
    }
    await addActivityNote(note);
    setQuickNote("");
    setQuickNoteVisible(false);
    showFeedback({ message: "Quick note saved to your quest.", icon: "create", color: T.orange });
    onboarding?.onQuickNoteSaved?.();
  };
  const savePendingPhoto = async () => {
    if (!pendingPhotoUri) return;
    const tutorialOnly = pendingPhotoIsTutorialMock;
    await addPhoto(pendingPhotoUri, pendingPhotoCaption, { tutorialOnly });
    setPendingPhotoUri(null);
    setPendingPhotoCaption("");
    setPendingPhotoIsTutorialMock(false);
    setPhotoSavedVisible(true);
    onboarding?.onPhotoSaved?.({ tutorialOnly });
  };
  const openActivityManager = (activity: ActiveQuestActivity) => {
    setManagedActivity(activity);
    setManagedPhoto(activity.photoId ? snapshot?.photos.find((photo) => photo.id === activity.photoId) ?? null : null);
    setActivityDraft(activity.kind === "photo" ? activity.caption ?? "" : activity.body ?? "");
  };
  const openPhotoManager = (photo: ActiveQuestPhoto) => {
    const activity = snapshot?.activity.find((item) => item.photoId === photo.id) ?? null;
    setManagedActivity(activity);
    setManagedPhoto(photo);
    setActivityDraft(activity?.caption ?? "");
  };
  const closeActivityManager = () => {
    setManagedActivity(null);
    setManagedPhoto(null);
    setActivityDraft("");
  };
  const saveActivityEdit = async () => {
    if (!managedActivity) return;
    await updateActivity(managedActivity.id, activityDraft);
    closeActivityManager();
    showFeedback({ message: managedActivity.kind === "photo" ? "Photo caption updated." : "Quick note updated.", icon: "checkmark-circle", color: accent });
  };
  const confirmDeleteManagedItem = () => {
    const isPhoto = Boolean(managedPhoto || managedActivity?.photoId);
    Alert.alert(isPhoto ? "Delete photo?" : "Delete quick note?", isPhoto ? "This will remove the photo and its caption from this active quest." : "This will remove this quick note from your active quest.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void (async () => {
        if (managedPhoto) await deletePhoto(managedPhoto.id);
        else if (managedActivity) await deleteActivity(managedActivity.id);
        closeActivityManager();
        showFeedback({ message: isPhoto ? "Photo deleted." : "Quick note deleted.", icon: "trash", color: T.red });
      })() },
    ]);
  };
  const saveStaleQuestForLater = async () => {
    if (staleQuestActionBusy) return;
    setStaleQuestActionBusy(true);
    try {
      await saveActiveForLater();
      showFeedback({ message: "Your quest is saved to My Stuff for later.", icon: "bookmark", color: T.blue });
      setStaleQuestReminderVisible(false);
      router.replace("/(tabs)");
    } catch {
      showFeedback({ message: "We couldn't save this quest for later. Please try again.", icon: "alert-circle", color: T.red });
    } finally {
      setStaleQuestActionBusy(false);
    }
  };
  const confirmAbandonStaleQuest = () => {
    Alert.alert("Abandon this quest?", "Your active timer and in-progress notes will be cleared. This cannot be undone.", [
      { text: "Keep quest", style: "cancel" },
      {
        text: "Abandon",
        style: "destructive",
        onPress: () => void (async () => {
          setStaleQuestActionBusy(true);
          try {
            await abandonActiveQuest();
            showFeedback({ message: "Quest abandoned. You can choose another whenever you’re ready.", icon: "compass", color: T.muted });
            setStaleQuestReminderVisible(false);
            router.replace("/(tabs)");
          } catch {
            showFeedback({ message: "We couldn't abandon this quest. Please try again.", icon: "alert-circle", color: T.red });
          } finally {
            setStaleQuestActionBusy(false);
          }
        })(),
      },
    ]);
  };

  return <View pointerEvents={preview ? "none" : "auto"} style={{ flex: 1, backgroundColor: T.bg }}>
    {!preview ? <StatusBar style="dark" /> : null}
    <View style={{ backgroundColor: T.white, paddingTop: screenInsets.top + 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.border }}>
      <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: paused ? T.orange : T.green }} /><Text style={{ color: T.dark, fontSize: 13, lineHeight: 17, fontWeight: "900" }}>{paused ? "Quest paused" : "Quest in progress"}</Text></View>
          <Text style={{ flexShrink: 1, color: T.dark, fontFamily: "RubikBlack", fontSize: 25, lineHeight: 31, fontWeight: "900" }}>{quest.title}</Text>
        </View>
        {!onboarding?.hideExit ? <Pressable accessibilityRole="button" accessibilityLabel="Leave active quest" onPress={() => router.back()} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: "#f7f3ee", borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.94 : 1 }] })}><Ionicons name="close" size={22} color={T.dark} /></Pressable> : null}
      </View>
      <View style={{ marginTop: 16 }}><ActiveQuestTabs active={tab} onChange={setTab} accent={accent} disabled={Boolean(onboarding?.locked)} /></View>
    </View>
    <View style={{ flex: 1 }}>
      {tab === "map" ? isStartingQuest ? <QuestStartupSurface accent={accent} step={countdownStep} /> : <LiveMap accent={accent} route={renderedRoute} renderSegments={renderedSegments} deviceLocation={deviceLocation ?? (previewLocation ? { latitude: previewLocation.latitude, longitude: previewLocation.longitude } : null)} liveLocation={liveLocation} trackingStatus={snapshot?.session.trackingStatus ?? "idle"} trackingMessage={trackingMessage} notice={null} onEnableTracking={handleEnableRouteRecording} forceEnablePrompt={onboarding?.guideStep === "route"} routePromptNudge={onboarding?.routePromptNudge} showUserLocation={!preview} animateInitialCamera={!preview} /> : tab === "album" ? <Album accent={accent} photos={snapshot?.photos ?? []} onManage={openPhotoManager} /> : <ActivityTimeline activity={snapshot?.activity ?? []} photos={snapshot?.photos ?? []} accent={accent} onManage={openActivityManager} focusLatest={Boolean(onboarding?.focusLatestActivity)} />}
    </View>
    {!countdownStep && photoSavedVisible ? <QuestNoticePill notice="photo-saved" accent={accent} message={trackingMessage} bottomOffset={Math.max(screenInsets.bottom + 98, 126)} /> : null}
    <FloatingQuestControls accent={accent} duration={duration} paused={paused} takingPhoto={takingPhoto} bottomInset={screenInsets.bottom} onTakePhoto={() => void takePhoto()} onQuickNote={() => setQuickNoteVisible(true)} onFinish={() => setCompleteVisible(true)} onTogglePaused={togglePaused} locked={Boolean(onboarding?.locked)} forcedOpen={Boolean(onboarding?.forceQuickActionsOpen) || onboarding?.allowPhotoCapture || onboarding?.allowQuickNote} allowQuickActions={Boolean(onboarding?.allowQuickActions)} allowPhotoCapture={Boolean(onboarding?.allowPhotoCapture)} allowQuickNote={Boolean(onboarding?.allowQuickNote)} showQuickActionsWhenPaused={Boolean(onboarding?.showQuickActionsWhenPaused)} onQuickActionsOpened={onboarding?.onQuickActionsOpened} onQuickNoteOpened={onboarding?.onQuickNoteOpened} />
    <Sheet visible={quickNoteVisible} onClose={() => { setQuickNote(""); setQuickNoteVisible(false); onboarding?.onQuickNoteDiscarded?.(); }} maxHeight="58%">
      <View style={{ paddingHorizontal: 24, paddingBottom: 26, gap: 14 }}>
        <View style={{ gap: 3 }}><Text style={{ color: T.dark, fontSize: 24, lineHeight: 30, fontWeight: "900" }}>Quick note</Text><Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>Capture something before it slips away.</Text></View>
        <TextInput value={quickNote} onChangeText={setQuickNote} autoFocus multiline textAlignVertical="top" placeholder="Found a hidden café." placeholderTextColor={T.muted} style={{ minHeight: 148, borderWidth: 2, borderColor: T.border, borderRadius: 18, padding: 14, color: T.dark, fontSize: 16, lineHeight: 23, fontWeight: "700", backgroundColor: T.bg }} />
        <View style={{ flexDirection: "row", gap: 11 }}><Pressable accessibilityRole="button" accessibilityLabel="Delete note" onPress={() => { setQuickNote(""); setQuickNoteVisible(false); onboarding?.onQuickNoteDiscarded?.(); }} style={({ pressed }) => ({ flex: 1, minHeight: 54, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: `${T.red}12`, borderWidth: 1.5, borderColor: `${T.red}42`, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: T.red, fontSize: 16, fontWeight: "900" }}>Delete</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Save note" onPress={() => void saveQuickNote()} style={({ pressed }) => ({ flex: 1, minHeight: 54, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: T.blue, borderBottomWidth: 5, borderBottomColor: "#258fd8", opacity: pressed ? 0.78 : 1, transform: [{ translateY: pressed ? 3 : 0 }] })}><Text style={{ color: T.white, fontSize: 16, fontWeight: "900" }}>Save</Text></Pressable></View>
      </View>
    </Sheet>
    <Sheet visible={Boolean(pendingPhotoUri)} onClose={() => { setPendingPhotoUri(null); setPendingPhotoCaption(""); setPendingPhotoIsTutorialMock(false); onboarding?.onPhotoDiscarded?.(); }} maxHeight="88%" fillHeight>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 26, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 3 }}><Text style={{ color: T.dark, fontSize: 24, lineHeight: 30, fontWeight: "900" }}>{pendingPhotoIsTutorialMock ? "A sample quest moment" : "Your quest moment"}</Text><Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>{pendingPhotoIsTutorialMock ? "This tutorial sample helps introduce the app’s features. It won’t be saved to your official journal." : "This is the photo you took. Add a note to remember it later."}</Text></View>
        {pendingPhotoUri ? <Image source={{ uri: pendingPhotoUri }} resizeMode="cover" style={{ width: "100%", aspectRatio: 1, borderRadius: 22, backgroundColor: T.border }} /> : null}
        <View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>Caption</Text><TextInput value={pendingPhotoCaption} onChangeText={setPendingPhotoCaption} multiline textAlignVertical="top" placeholder="What made this moment memorable?" placeholderTextColor={T.muted} style={{ minHeight: 96, borderWidth: 2, borderColor: T.border, borderRadius: 18, padding: 13, color: T.dark, fontSize: 15, lineHeight: 21, fontWeight: "700", backgroundColor: T.bg }} /></View>
        <View style={{ flexDirection: "row", gap: 11 }}><Pressable accessibilityRole="button" accessibilityLabel="Retake photo" onPress={() => { setPendingPhotoUri(null); setPendingPhotoCaption(""); setPendingPhotoIsTutorialMock(false); void takePhoto(); }} style={({ pressed }) => ({ flex: 1, minHeight: 51, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: `${accent}12`, borderWidth: 1.5, borderColor: `${accent}45`, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: accent, fontSize: 15, fontWeight: "900" }}>Retake photo</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Never mind" onPress={() => { setPendingPhotoUri(null); setPendingPhotoCaption(""); setPendingPhotoIsTutorialMock(false); onboarding?.onPhotoDiscarded?.(); }} style={({ pressed }) => ({ flex: 1, minHeight: 51, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f3ee", borderWidth: 1.5, borderColor: T.border, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: T.muted, fontSize: 15, fontWeight: "900" }}>Never mind</Text></Pressable></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Save photo" onPress={() => void savePendingPhoto()} style={({ pressed }) => ({ minHeight: 58, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: T.blue, borderBottomWidth: 6, borderBottomColor: "#258fd8", opacity: pressed ? 0.78 : 1, transform: [{ translateY: pressed ? 3 : 0 }] })}><Text style={{ color: T.white, fontSize: 17, fontWeight: "900" }}>Save photo</Text></Pressable>
      </ScrollView>
    </Sheet>
    <Sheet visible={Boolean(managedActivity || managedPhoto)} onClose={closeActivityManager} maxHeight="70%">
      <View style={{ paddingHorizontal: 24, paddingBottom: 26, gap: 14 }}>
        <View style={{ gap: 3 }}><Text style={{ color: T.dark, fontSize: 24, lineHeight: 30, fontWeight: "900" }}>{managedPhoto ? "Manage photo" : "Manage quick note"}</Text><Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>{managedPhoto ? "Update its caption or remove it from this quest." : "Make a change or remove this note."}</Text></View>
        {managedPhoto ? <Image source={{ uri: managedPhoto.uri }} resizeMode="cover" style={{ width: "100%", aspectRatio: 1.6, borderRadius: 18, backgroundColor: T.border }} /> : null}
        {managedActivity ? <TextInput value={activityDraft} onChangeText={setActivityDraft} multiline textAlignVertical="top" placeholder={managedPhoto ? "Add a caption" : "Write a quick note"} placeholderTextColor={T.muted} style={{ minHeight: 106, borderWidth: 2, borderColor: T.border, borderRadius: 18, padding: 13, color: T.dark, fontSize: 15, lineHeight: 22, fontWeight: "700", backgroundColor: T.bg }} /> : null}
        <View style={{ flexDirection: "row", gap: 10 }}><Pressable accessibilityRole="button" accessibilityLabel="Delete activity" onPress={confirmDeleteManagedItem} style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: `${T.red}12`, borderWidth: 1.5, borderColor: `${T.red}45`, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: T.red, fontSize: 15, fontWeight: "900" }}>Delete</Text></Pressable>{managedActivity ? <Pressable accessibilityRole="button" accessibilityLabel="Save activity changes" onPress={() => void saveActivityEdit()} style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: accent, borderBottomWidth: 5, borderBottomColor: `${accent}a8`, opacity: pressed ? 0.78 : 1, transform: [{ translateY: pressed ? 3 : 0 }] })}><Text style={{ color: T.white, fontSize: 15, fontWeight: "900" }}>Save changes</Text></Pressable> : null}</View>
      </View>
    </Sheet>
    <LogLoreFlow guestMode={isGuestQuest} visible={completeVisible} quest={quest} initialTitle={snapshot?.session.entryTitle ?? ""} initialReflection={snapshot?.session.entryBody ?? ""} photoUris={(snapshot?.photos ?? []).map((photo) => photo.uri)} durationSeconds={Math.round((snapshot?.session.activeDurationMs ?? 0) / 1_000)} distanceMeters={snapshot?.session.distanceMeters ?? 0} onSaveDraft={(draft) => saveEntry(draft)} onClose={() => setCompleteVisible(false)} onFinished={async (result, destination) => { await finishLocalQuest(); if (!isGuestQuest) await refresh(); setCompleteVisible(false); setCompletionReward({ result, questTitle: quest.title, destination }); }} />
    <StaleQuestReminder visible={staleQuestReminderVisible} elapsedLabel={formatElapsedFull(elapsedDuration)} busy={staleQuestActionBusy} onResume={() => setStaleQuestReminderVisible(false)} onSaveForLater={() => void saveStaleQuestForLater()} onAbandon={confirmAbandonStaleQuest} />
  </View>;
}
