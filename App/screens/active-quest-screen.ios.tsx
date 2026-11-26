import { ActivityTimeline, type TimelinePosition } from "@/components/active-quest-timeline.ios";
import { ActiveQuestMoments } from "@/components/active-quest-moments.ios";
import { Pressable } from "@/components/raised-pressable";
import { updateActiveQuestSession } from "@/services/active-quest/local-store.ios";
import { QuestSectionPlaceholder, QuestVideoMoment } from "@/components/quest-activity-ui.ios";
import { QuestCamera, type QuestCapture } from "@/components/quest-camera.ios";
import { QuestJourneyPanel } from "@/components/quest-journey.ios";
import { saveJourneyEvent } from "@/services/active-quest/journey.ios";
import { journeyElapsedMs, availablePrompts, emptyJourney, type QuestPrompt, type JourneyEvent } from "@/services/active-quest/journey-model";
import { useFocusEffect } from "expo-router";
import { getQuestLaunchState, subscribeQuestLaunch, claimQuestLaunch, markQuestDestinationReady } from "@/services/engine/quest-launch-state.ios";
import { isQuestStartCancelled } from "@/services/engine/focused-quest-start";
import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Reanimated, { Easing, FadeInDown, FadeOutUp, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { Alert, Animated, Image, Linking, Platform, ScrollView, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import MapView, { Circle, Marker, Polyline } from "@/components/route-map";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogLoreFlow } from "@/components/log-lore-flow";
import { CachedImage } from "@/components/cached-image";
import { categoryColor, T } from "@/components/theme";
import { EmptyState, haptic, Sheet, SoftButton, useResponsiveScreenLayout } from "@/components/ui";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { useContent } from "@/contexts/ContentContext";
import { useActiveQuest } from "@/contexts/ActiveQuestContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useGuestQuest } from "@/contexts/GuestQuestContext";
import { useThemeKey } from "@/contexts/SettingsContext";
import { useActiveQuestTabTransition, type ActiveQuestTab } from "@/hooks/useActiveQuestTabTransition.ios";
import { ActiveQuestTabScene } from "@/components/active-quest-tab-scene.ios";
import { formatElapsedFull, useActiveQuestElapsedDuration } from "@/hooks/useElapsedTime";
import { Quest } from "@/types/content";
import { ActiveQuestActivity, ActiveQuestCheckpoint, ActiveQuestPhoto, ActiveQuestRenderableSegment, ActiveQuestRoutePoint } from "@/types/active-quest";

import { locationPreview } from "@/services/active-quest/live-fix.ios";

import { FINISH_QUEST_PROMPTS, getFinishQuestPromptIndex } from "@/lib/finish-quest-prompt";

type QuestNotice = "active" | "paused" | "photo-saved" | "location-help";
function ActiveQuestViewport({ short, children }: { short: boolean; children: React.ReactNode }) {
  return short ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ minHeight: 720 }}>{children}</ScrollView> : <>{children}</>;
}
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
const MAP_CONTROL_GAP = 10;
const MAP_RECENTER_SIZE = 48;
const MAP_STYLE_SIZE = 48;
const MAP_VIEW_METERS = 80;
const QUEST_ACTION_SIZE = 70;
type QuestMapStyle = "standard" | "satellite";
const QUEST_MAP_STYLES: { value: QuestMapStyle; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "standard", label: "Standard", icon: "map-outline" },
  { value: "satellite", label: "Satellite", icon: "earth-outline" },
];
// Preview canvases sit inside a rendered iPhone bezel rather than a native
// safe-area provider. These reference insets keep the header clear of the
// Dynamic Island and preserve the physical lower bezel around the controls.
const PREVIEW_PHONE_INSETS = { top: 48, bottom: 24 };

type MapCoordinate = { latitude: number; longitude: number; accuracy?: number | null; capturedAt?: string };
function walkingRegion(point: MapCoordinate, width = 390, height = 600) {
  // Walking quests only need the nearby blocks. Keep this deterministic so
  // remounting the map after a tab change never falls back to a city-wide view.
  const meters = Math.min(420, Math.max(260, width * 0.72));
  return { ...point, longitudeDelta: meters / (111320 * Math.max(0.15, Math.cos(point.latitude * Math.PI / 180))), latitudeDelta: meters * height / Math.max(1, width) / 111320 };
}

function liveMapRegion(point: MapCoordinate) {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: MAP_VIEW_METERS / 111320,
    longitudeDelta: MAP_VIEW_METERS / (111320 * Math.max(0.15, Math.cos(point.latitude * Math.PI / 180))),
  };
}

function QuestNoticePill({ notice, accent, message, bottomOffset = MAP_NOTICE_BOTTOM_OFFSET }: { notice: QuestNotice; accent: string; message?: string | null; bottomOffset?: number }) {
  const detail = notice === "active"
    ? { icon: "ellipse" as const, iconColor: T.green, label: "Active now" }
    : notice === "paused"
      ? { icon: "pause" as const, iconColor: "#e7a52c", label: "Quest paused" }
      : notice === "photo-saved"
        ? { icon: "checkmark-circle" as const, iconColor: T.green, label: "Moment saved to your quest" }
        : { icon: "location-outline" as const, iconColor: accent, label: message ?? "Enable location to record your route" };
  return <View pointerEvents="none" style={{ position: "absolute", zIndex: 10, left: 20, right: 20, bottom: bottomOffset, alignItems: "center" }}>
    <View style={{ minHeight: 48, overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 18, backgroundColor: T.white, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 2, borderColor: T.border, boxShadow: `4px 4px 0px ${T.border}` }}>
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
      <Text style={{ color: T.onAccent, fontSize: isGo ? 36 : 68, lineHeight: isGo ? 42 : 74, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{step}</Text>
    </Animated.View>
  </View>;
}

function ActiveQuestTabs({ active, onChange, accent, disabled = false }: { active: ActiveQuestTab; onChange: (tab: ActiveQuestTab) => void; accent: string; disabled?: boolean }) {
  const tabs: { id: ActiveQuestTab; label: string }[] = [{ id: "map", label: "Map" }, { id: "entry", label: "Overview" }, { id: "album", label: "Moments" }];
  return <View style={{ marginHorizontal: 20, padding: 5, flexDirection: "row", alignSelf: "stretch", borderRadius: 18, backgroundColor: T.raised, borderWidth: 1, borderColor: `${accent}80` }}>
    {tabs.map((tab) => {
      const selected = tab.id === active;
      return <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => { haptic(); onChange(tab.id); }} style={({ pressed }) => ({ flex: 1, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: selected ? T.white : "transparent", borderWidth: selected ? 1 : 0, borderColor: selected ? `${accent}45` : "transparent", boxShadow: selected ? "0px 2px 0px rgba(61,52,56,0.08)" : "none", opacity: disabled ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
        <Text style={{ color: selected ? accent : "#867a79", fontSize: 16, lineHeight: 21, fontWeight: "900" }}>{tab.label}</Text>
      </Pressable>;
    })}
  </View>;
}

function textOnQuestColor(color: string) {
  const rgb = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!rgb) return "#ffffff";
  const channels = rgb.slice(1).map((value) => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? "#101820" : "#ffffff";
}

function QuestInstructions({ quest, accent, disabled }: { quest: Quest; accent: string; disabled: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
  const foreground = textOnQuestColor(accent);
  const lightQuestColor = T.isDark ? `${accent}25` : (categoryColor[quest.category]?.bg ?? `${accent}18`);
  const chevronProgress = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chevronProgress.get() * 180}deg` }] }));
  useEffect(() => {
    chevronProgress.set(withTiming(expanded ? 1 : 0, { duration: reduceMotion ? 0 : 240, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
  }, [chevronProgress, expanded, reduceMotion]);
  const steps = quest.steps.length ? quest.steps : ["Head out at your own pace — no timer starts until you choose.", "Complete the core challenge described above.", "Log your experience in the Journal after finishing."];
  return <Reanimated.View layout={reduceMotion ? undefined : LinearTransition.duration(280).easing(Easing.bezier(0.23, 1, 0.32, 1))} style={{ overflow: "hidden", borderBottomLeftRadius: 20, borderBottomRightRadius: 20, backgroundColor: lightQuestColor, borderWidth: 2, borderTopWidth: 0, borderColor: `${accent}80` }}>
    <Pressable accessibilityRole="button" accessibilityLabel="How to do this quest" accessibilityState={{ expanded, disabled }} disabled={disabled} hitSlop={{ top: 4, bottom: 4 }} onPress={() => setExpanded((current) => !current)} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.76 : 1 })}>
      <Ionicons name="bulb-outline" size={17} color={T.dark} />
      <Text style={{ flex: 1, color: T.dark, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18 }}>Need a hand?</Text>
      <Reanimated.View style={chevronStyle}><Ionicons name="chevron-down" size={15} color={T.dark} /></Reanimated.View>
    </Pressable>
    {expanded ? <Reanimated.View entering={reduceMotion ? undefined : FadeInDown.duration(220).easing(Easing.bezier(0.23, 1, 0.32, 1))} exiting={reduceMotion ? undefined : FadeOutUp.duration(130)} style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 17, gap: 12, borderTopWidth: 1, borderTopColor: `${accent}38` }}>
      <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 18, lineHeight: 23 }}>How it works</Text>
      {steps.map((step, index) => <View key={`${index}-${step}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}><View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: foreground, fontFamily: "RubikBold", fontSize: 12 }}>{index + 1}</Text></View><Text style={{ flex: 1, color: T.dark, fontFamily: "Rubik", fontSize: 13, lineHeight: 19 }}>{step}</Text></View>)}
    </Reanimated.View> : null}
  </Reanimated.View>;
}

function QuestRouteCard({ accent, route, renderSegments, liveLocation, deviceLocation, trackingStatus, trackingMessage, distanceMeters, showUserLocation, onEnableTracking }: { accent: string; route: ActiveQuestRoutePoint[]; renderSegments: ActiveQuestRenderableSegment[]; liveLocation: MapCoordinate | null; deviceLocation: MapCoordinate | null; trackingStatus: "idle" | "tracking" | "permission-needed" | "unavailable"; trackingMessage: string | null; distanceMeters: number; showUserLocation: boolean; onEnableTracking: () => void }) {
  const map = useRef<MapView>(null);
  const lastPoint = route.at(-1);
  const current = liveLocation ?? deviceLocation ?? (lastPoint ? { latitude: lastPoint.latitude, longitude: lastPoint.longitude } : null);
  const hasLiveFix = Boolean(liveLocation || deviceLocation);
  const region = current ? walkingRegion(current, 390, 184) : null;
  // Keep the live marker centered between the corner labels as the user moves.
  const cameraRegion = region;
  useEffect(() => {
    if (cameraRegion) map.current?.setCamera({ center: cameraRegion });
  }, [cameraRegion?.latitude, cameraRegion?.longitude]);
  const miles = Math.max(0, distanceMeters / 1609.344).toFixed(1);
  const needsTrackingHelp = trackingStatus === "permission-needed" || trackingStatus === "unavailable";
  return <View style={{ height: 184, overflow: "hidden", borderRadius: 24, backgroundColor: T.isDark ? "#142c35" : "#dce7df", borderWidth: 1, borderColor: T.border, boxShadow: "0px 5px 16px rgba(36,47,50,0.14)" }}>
    {region ? <MapView ref={map} pointerEvents="none" style={{ position: "absolute", inset: 0 }} initialRegion={cameraRegion ?? undefined} mapType="standard" showsUserLocation={false} showsMyLocationButton={false} showsCompass={false} toolbarEnabled={false} appleLogoInsets={{ top: 0, right: 0, left: 8, bottom: 8 }} legalLabelInsets={{ top: 0, right: 8, left: 0, bottom: 8 }}>
      {renderSegments.map((segment) => segment.points.length > 1 ? <Polyline key={segment.id} coordinates={segment.points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }))} strokeColor={segment.state === "paused" ? "#c9d1d5" : accent} strokeWidth={5} lineCap="round" lineJoin="round" /> : null)}
      <Marker coordinate={region} anchor={{ x: 0.5, y: 0.5 }}><View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: accent, borderWidth: 3, borderColor: "#ffffff", boxShadow: "0px 0px 8px rgba(0,0,0,0.45)" }} /></Marker>
    </MapView> : <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}><Ionicons name="map-outline" size={32} color={accent} /><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 13, marginTop: 8 }}>Waiting for your location</Text></View>}
    <View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.12)" }} />
    {!needsTrackingHelp ? <View pointerEvents="none" style={{ position: "absolute", right: 12, bottom: 12, maxWidth: "60%", flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 16, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: "rgba(5,19,30,0.64)" }}><Ionicons name="location" size={13} color="#ffffff" /><Text numberOfLines={2} style={{ color: "#ffffff", fontFamily: "RubikBold", fontSize: 10, lineHeight: 13, flexShrink: 1 }}>{hasLiveFix ? "Your current location" : lastPoint ? "Last recorded position" : "Location pending"}</Text></View> : null}
    <Text accessibilityLabel={`${miles} miles traveled`} style={{ position: "absolute", left: 16, top: 14, color: "#ffffff", fontFamily: "RubikBold", fontSize: 30, lineHeight: 38, fontVariant: ["tabular-nums"], textShadowColor: "rgba(0,0,0,0.65)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>{miles}<Text style={{ fontFamily: "Rubik", fontSize: 23 }}> mi</Text></Text>
    {trackingStatus === "permission-needed" || trackingStatus === "unavailable" ? <Pressable accessibilityRole="button" accessibilityLabel="Enable route recording" onPress={onEnableTracking} style={{ position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: 13, backgroundColor: "rgba(5,19,30,0.86)", paddingHorizontal: 12, paddingVertical: 10 }}><Text style={{ color: "#ffffff", fontFamily: "RubikBold", fontSize: 12 }} numberOfLines={2}>{trackingMessage ?? "Location is unavailable."} Tap to retry.</Text></Pressable> : null}
  </View>;
}

function QuestMoments({ photos, events, accent, onManage, onCapture, loading = false, captureDisabled = false, imageTransition = 120 }: {
  photos: ActiveQuestPhoto[]; events: JourneyEvent[]; accent: string;
  onManage: (photo: ActiveQuestPhoto) => void; onCapture: () => void; loading?: boolean; captureDisabled?: boolean; imageTransition?: number;
}) {
  const moments = useMemo(() => [
    ...photos.map(photo => ({ kind: "photo" as const, capturedAt: photo.capturedAt, photo })),
    ...events.filter(event => event.kind === "video").map(event => ({ kind: "video" as const, capturedAt: event.capturedAt, event })),
  ].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)), [photos, events]);
  const disabled = loading || captureDisabled;
  return <View accessibilityState={{ busy: loading }} style={{ gap: 22, paddingHorizontal: 4, paddingVertical: 8 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 22, lineHeight: 28 }}>Your moments</Text>
      <Text accessibilityLiveRegion="polite" style={{ color: T.muted, fontFamily: "Rubik", fontSize: 14, lineHeight: 20 }}>{loading ? "Loading…" : `${moments.length} saved`}</Text>
    </View>
    {moments.length === 0 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View accessible={false} style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: `${accent}24`, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="videocam-outline" size={27} color={accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 17, lineHeight: 23 }}>{loading ? "Loading your moments…" : "Save a little moment"}</Text>
        <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 14, lineHeight: 20 }}>Photos and videos, together.</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Capture a photo or video" accessibilityState={{ disabled }} disabled={disabled} onPress={() => { haptic(); onCapture(); }} style={({ pressed }) => ({ width: 44, height: 44, flexShrink: 0, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.45 : pressed ? 0.7 : 1 })}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: accent, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={25} color="#ffffff" /></View>
      </Pressable>
    </View> : null}
    {!loading && moments.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
      {moments.slice(0, 6).map(moment => moment.kind === "video"
        ? <QuestVideoMoment key={`video:${moment.event.id}`} event={moment.event} accent={accent} tile imageTransition={imageTransition} />
        : <Pressable key={`photo:${moment.photo.id}`} accessibilityRole="button" accessibilityLabel="Manage quest photo" onPress={() => onManage(moment.photo)} style={({ pressed }) => ({ width: 124, height: 124, borderRadius: 17, overflow: "hidden", backgroundColor: T.border, opacity: pressed ? 0.82 : 1 })}>
          <CachedImage uri={moment.photo.uri} transition={imageTransition} style={{ width: "100%", height: "100%" }} />
          {moment.photo.syncStatus !== "synced" ? <View style={{ position: "absolute", right: 7, bottom: 7, width: 25, height: 25, borderRadius: 13, backgroundColor: T.raised, alignItems: "center", justifyContent: "center" }}><Ionicons name="cloud-upload-outline" size={14} color={accent} /></View> : null}
        </Pressable>)}
    </ScrollView> : null}
  </View>;
}

const LiveMap = memo(function LiveMap({ accent, route, renderSegments, checkpoints = [], deviceLocation, liveLocation, trackingStatus, trackingMessage, notice, onEnableTracking, forceEnablePrompt = false, routePromptNudge = 0, showUserLocation = true, animateInitialCamera = true, quickActionsOpen = false, paused = false, bottomInset = 0, timerHeight = 74 }: { accent: string; route: ActiveQuestRoutePoint[]; renderSegments: ActiveQuestRenderableSegment[]; checkpoints?: ActiveQuestCheckpoint[]; deviceLocation: MapCoordinate | null; liveLocation: MapCoordinate | null; trackingStatus: "idle" | "tracking" | "permission-needed" | "unavailable"; trackingMessage: string | null; notice: QuestNotice | null; onEnableTracking: () => void; forceEnablePrompt?: boolean; routePromptNudge?: number; showUserLocation?: boolean; animateInitialCamera?: boolean; quickActionsOpen?: boolean; paused?: boolean; bottomInset?: number; timerHeight?: number }) {
  const map = useRef<MapView>(null);
  const [followingUser, setFollowingUser] = useState(true);
  const initialCameraSet = useRef(false);
  const lastFollowLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const [mapStyle, setMapStyle] = useState<QuestMapStyle>("standard");
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [mapHeading, setMapHeading] = useState(0);
  const reduceMotion = useReducedMotion();
  const controlsLift = useSharedValue(0);
  const controlsStyle = useAnimatedStyle(() => ({ transform: [{ translateY: controlsLift.get() }] }));
  useEffect(() => {
    const target = -(paused ? 82 : 0) - (quickActionsOpen ? (paused ? 160 : 240) : 0);
    controlsLift.set(withTiming(target, { duration: reduceMotion ? 0 : 240, easing: Easing.bezier(0.77, 0, 0.175, 1) }));
    if (quickActionsOpen) setStyleMenuOpen(false);
  }, [controlsLift, paused, quickActionsOpen, reduceMotion]);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [mapReady, setMapReady] = useState(false);
  const routeButtonNudge = useRef(new Animated.Value(0)).current;
  const current = route.at(-1);
  const liveCoordinate = liveLocation ?? (current ? { ...current } : deviceLocation);
  const region = liveCoordinate ? liveMapRegion(liveCoordinate) : null;
  const cameraRegion = region;
  // The timer shares this map's bottom edge. Anchor attribution to its measured
  // top edge so larger text and different safe areas preserve the same gap.
  const timerTopFromBottom = Math.max(bottomInset + 10, 18) + timerHeight;
  const legalBottom = timerTopFromBottom + 14;
  const appleLogoBottom = legalBottom + 30;
  // Map fallbacks are scene colors rather than generic card surfaces. They
  // retain their geographical character while following the selected mode.
  const mapFallbackCanvas = T.isDark ? "#17212b" : "#edf0eb";
  const mapFallbackSurface = T.isDark ? "#1c2934" : "#e5e8e2";

  useEffect(() => {
    if (!cameraRegion || !mapReady || mapSize.width <= 0 || mapSize.height <= 0) return;
    if (!initialCameraSet.current) {
      initialCameraSet.current = true;
      lastFollowLocation.current = { latitude: cameraRegion.latitude, longitude: cameraRegion.longitude };
      map.current?.animateToRegion(cameraRegion, 0);
      return;
    }
    if (!animateInitialCamera || !followingUser) return;
    if (lastFollowLocation.current?.latitude === cameraRegion.latitude && lastFollowLocation.current?.longitude === cameraRegion.longitude) return;
    lastFollowLocation.current = { latitude: cameraRegion.latitude, longitude: cameraRegion.longitude };
    map.current?.animateCamera({ center: lastFollowLocation.current }, { duration: 400 });
  }, [animateInitialCamera, cameraRegion?.latitude, cameraRegion?.longitude, followingUser, mapReady, mapSize.width, mapSize.height]);

  useEffect(() => {
    if (!routePromptNudge) return;
    Animated.sequence([
      Animated.timing(routeButtonNudge, { toValue: -6, duration: 120, useNativeDriver: true }),
      Animated.timing(routeButtonNudge, { toValue: 3, duration: 130, useNativeDriver: true }),
      Animated.timing(routeButtonNudge, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [routeButtonNudge, routePromptNudge]);

  const waitingForFix = trackingStatus === "tracking" && !region;
  const fallbackTitle = waitingForFix ? "Finding your location" : trackingStatus === "unavailable" ? "Location is unavailable" : "Ready to map your quest";
  if ((forceEnablePrompt && trackingStatus !== "tracking") || !region) return <View style={{ flex: 1, backgroundColor: mapFallbackCanvas, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: BOTTOM_SHEET_CONTENT_HEIGHT, gap: 12 }}>
    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: `${accent}1c`, alignItems: "center", justifyContent: "center" }}><Ionicons name="location-outline" size={27} color={accent} /></View>
    <Text style={{ color: T.dark, fontSize: 19, lineHeight: 25, fontWeight: "900", textAlign: "center" }}>{fallbackTitle}</Text>
    <Text style={{ color: T.muted, maxWidth: 280, fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" }}>{trackingMessage ?? (waitingForFix ? "Location access is enabled. Move outdoors for a clearer GPS signal; your map will appear as soon as a location arrives." : "Enable location to centre the map on where you actually are and start recording your route.")}</Text>
    <Animated.View style={{ transform: [{ translateY: routeButtonNudge }] }}><Pressable accessibilityRole="button" onPress={onEnableTracking} style={({ pressed }) => ({ minHeight: 58, marginTop: 4, borderRadius: 20, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: accent, borderBottomWidth: 6, borderBottomColor: T.buttonEdge, transform: [{ translateY: pressed ? 3 : 0 }] })}><Text style={{ color: T.onAccent, fontSize: 14, fontWeight: "900" }}>{waitingForFix ? "Retry location" : "Enable route recording"}</Text></Pressable></Animated.View>
    {notice ? <QuestNoticePill notice={notice} accent={accent} message={trackingMessage} /> : null}
  </View>;

  return <View onLayout={({ nativeEvent }) => setMapSize(nativeEvent.layout)} style={{ flex: 1, backgroundColor: mapFallbackSurface }}>
    <MapView ref={map} style={{ flex: 1 }} initialRegion={cameraRegion ?? undefined} mapType={mapStyle} userInterfaceStyle={T.isDark ? "dark" : "light"} showsPointsOfInterests={false} showsBuildings={false} showsUserLocation={false} showsMyLocationButton={false} showsCompass={false} toolbarEnabled={false} scrollEnabled zoomEnabled zoomTapEnabled rotateEnabled pitchEnabled mapPadding={{ top: 100, bottom: timerTopFromBottom + 20, left: 16, right: 16 }} appleLogoInsets={mapReady ? { top: 0, right: 0, left: 8, bottom: appleLogoBottom } : undefined} legalLabelInsets={mapReady ? { top: 0, right: 0, left: 8, bottom: legalBottom } : undefined} onMapReady={() => setMapReady(true)} onPanDrag={() => { setFollowingUser(false); setStyleMenuOpen(false); }} onRegionChangeComplete={(_region, details) => { if (details?.isGesture) setFollowingUser(false); void map.current?.getCamera().then(({ heading }) => setMapHeading(heading ?? 0)).catch(() => {}); }}>
      {liveCoordinate && liveCoordinate.accuracy != null && liveCoordinate.accuracy > 0 ? <Circle center={liveCoordinate} radius={liveCoordinate.accuracy} fillColor={`${accent}20`} strokeColor={`${accent}70`} strokeWidth={1} /> : null}
      {liveCoordinate ? <Marker coordinate={liveCoordinate} anchor={{ x: 0.5, y: 0.5 }} title="Your location"><View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: "#ffffff", backgroundColor: accent }} /></Marker> : null}
      {renderSegments.map((segment) => {
        const coordinates = segment.points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
        return coordinates.length > 1 ? <Polyline key={segment.id} coordinates={coordinates} strokeColor={segment.state === "paused" ? "#9D93A0" : accent} strokeWidth={5} lineCap="round" lineJoin="round" /> : null;
      })}
      {checkpoints.map((checkpoint) => <Marker key={checkpoint.id} coordinate={{ latitude: checkpoint.latitude, longitude: checkpoint.longitude }} title={checkpoint.label} pinColor={accent} />)}
    </MapView>
    <View pointerEvents="box-none" style={{ position: "absolute", top: 14, right: 18, flexDirection: "row", alignItems: "center", gap: MAP_CONTROL_GAP }}>
      {Math.abs(((mapHeading + 540) % 360) - 180) > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Reset map compass to north" onPress={() => map.current?.animateCamera({ heading: 0 }, { duration: 400 })} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, boxShadow: `0px 2px 8px ${T.shadow}`, transform: [{ scale: pressed ? 0.94 : 1 }] })}><Ionicons name="compass-outline" size={25} color={accent} style={{ transform: [{ rotate: `${-mapHeading}deg` }] }} /></Pressable> : null}
    </View>
    <Reanimated.View pointerEvents="box-none" style={[{ position: "absolute", right: 31, bottom: Math.max(bottomInset + 10, 18) + QUEST_ACTION_SIZE + MAP_CONTROL_GAP + 2, width: MAP_STYLE_SIZE + 10 + 154, alignItems: "flex-end", gap: MAP_CONTROL_GAP }, controlsStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Select map style" accessibilityState={{ expanded: styleMenuOpen }} onPress={() => setStyleMenuOpen((open) => !open)} style={({ pressed }) => ({ width: MAP_STYLE_SIZE, height: MAP_STYLE_SIZE, borderRadius: MAP_STYLE_SIZE / 2, alignItems: "center", justifyContent: "center", backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, boxShadow: `0px 2px 8px ${T.shadow}`, transform: [{ scale: pressed ? 0.94 : 1 }] })}><Ionicons name="layers-outline" size={22} color={accent} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Recenter map on your location and restore zoom" onPress={() => { if (cameraRegion) { lastFollowLocation.current = { latitude: cameraRegion.latitude, longitude: cameraRegion.longitude }; map.current?.animateToRegion(cameraRegion, 400); } setFollowingUser(true); setStyleMenuOpen(false); }} style={({ pressed }) => ({ width: MAP_RECENTER_SIZE, height: MAP_RECENTER_SIZE, borderRadius: MAP_RECENTER_SIZE / 2, alignItems: "center", justifyContent: "center", backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, boxShadow: `0px 2px 8px ${T.shadow}`, transform: [{ scale: pressed ? 0.94 : 1 }] })}><Ionicons name={followingUser ? "locate" : "locate-outline"} size={22} color={accent} /></Pressable>
      {styleMenuOpen ? <View style={{ position: "absolute", right: MAP_STYLE_SIZE + 10, bottom: MAP_RECENTER_SIZE + MAP_CONTROL_GAP, width: 154, padding: 6, gap: 2, borderRadius: 17, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, boxShadow: `0px 5px 16px ${T.shadow}` }}>
        {QUEST_MAP_STYLES.map((style) => <Pressable key={style.value} accessibilityRole="button" accessibilityLabel={`${style.label} map`} accessibilityState={{ selected: mapStyle === style.value }} onPress={() => { setMapStyle(style.value); setStyleMenuOpen(false); }} style={({ pressed }) => ({ minHeight: 44, borderRadius: 12, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: mapStyle === style.value ? `${accent}20` : pressed ? T.bg : "transparent" })}>
          <Ionicons name={style.icon} size={18} color={mapStyle === style.value ? accent : T.dark} /><Text style={{ flex: 1, color: T.dark, fontFamily: "RubikBold", fontSize: 13 }}>{style.label}</Text>{mapStyle === style.value ? <Ionicons name="checkmark" size={16} color={accent} /> : null}
        </Pressable>)}
      </View> : null}
    </Reanimated.View>
    {trackingStatus === "permission-needed" || trackingStatus === "unavailable" ? <Pressable accessibilityRole="button" accessibilityLabel="Retry route recording" onPress={onEnableTracking} style={{ position: "absolute", top: 12, left: 16, right: 16, minHeight: 48, padding: 10, borderRadius: 16, backgroundColor: T.white, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" }}><Text style={{ color: T.dark, textAlign: "center", fontSize: 13, fontWeight: "700" }}>{trackingMessage ?? "Route recording is unavailable."} Tap to retry.</Text></Pressable> : null}
    {notice ? <QuestNoticePill notice={notice} accent={accent} message={trackingStatus === "permission-needed" || trackingStatus === "unavailable" ? trackingMessage : null} /> : null}
  </View>;
});

function QuestStartupSurface({ accent, step }: { accent: string; step: QuestCountdownStep | null }) {
  return <View style={{ flex: 1, backgroundColor: T.isDark ? "#17212b" : "#edf0eb", alignItems: "center", justifyContent: "center", paddingBottom: BOTTOM_SHEET_CONTENT_HEIGHT }}>
    {!step ? <><View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: `${accent}16`, alignItems: "center", justifyContent: "center" }}><Ionicons name="navigate" size={32} color={accent} /></View><Text style={{ marginTop: 18, color: T.dark, fontSize: 18, lineHeight: 24, fontWeight: "900", textAlign: "center" }}>Get ready to begin</Text></> : <Text pointerEvents="none" style={{ position: "absolute", top: "62%", zIndex: 5, color: T.dark, fontSize: 18, lineHeight: 24, fontWeight: "900", textAlign: "center" }}>Get ready to begin</Text>}
    {step ? <QuestCountdownOverlay step={step} accent={accent} /> : null}
  </View>;
}


function FloatingQuestControls({ accent, duration, paused, takingPhoto, bottomInset, onTakePhoto, onQuickNote, onFinish, onTogglePaused, locked = false, forcedOpen = false, allowQuickActions = false, allowPhotoCapture = false, allowQuickNote = false, showQuickActionsWhenPaused = false, onQuickActionsOpened, onQuickNoteOpened, onOpenChange, onTimerHeightChange }: { accent: string; duration: string; paused: boolean; takingPhoto: boolean; bottomInset: number; onTakePhoto: () => void; onQuickNote: () => void; onFinish: () => void; onTogglePaused: () => void; locked?: boolean; forcedOpen?: boolean; allowQuickActions?: boolean; allowPhotoCapture?: boolean; allowQuickNote?: boolean; showQuickActionsWhenPaused?: boolean; onQuickActionsOpened?: () => void; onQuickNoteOpened?: () => void; onOpenChange?: (open: boolean) => void; onTimerHeightChange?: (height: number) => void }) {
  const [open, setOpen] = useState(forcedOpen);
  useEffect(() => { onOpenChange?.(open); }, [onOpenChange, open]);
  const { isWide: wideLayout, height } = useResponsiveScreenLayout();
  const isWide = wideLayout && height >= 600;
  const menuProgress = useRef(new Animated.Value(forcedOpen ? 1 : 0)).current;
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
  // of the + menu prevents a duplicate destructive action.
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
  if (isWide) return <View style={{ position: "absolute", right: 24, bottom: 24, width: 296, padding: 20, gap: 12, borderRadius: 20, backgroundColor: T.raised, borderWidth: 2, borderColor: T.border }}>
    <Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 13 }}>{paused ? "Quest paused" : "Quest time"}</Text>
    <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 30, fontVariant: ["tabular-nums"] }}>{duration}</Text>
    <SoftButton label={paused ? "Resume quest" : "Pause quest"} icon={paused ? "play" : "pause"} color={accent} disabled={locked} onPress={onTogglePaused} />
    <SoftButton label="Quick note" icon="create-outline" inverse disabled={locked} onPress={onQuickNote} />
    <SoftButton label={takingPhoto ? "Opening camera…" : "Take photo"} icon="camera" inverse disabled={locked || takingPhoto} onPress={onTakePhoto} />
    <SoftButton label="End quest" icon="flag" inverse color={T.red} disabled={locked} onPress={onFinish} />
  </View>;
  return <View pointerEvents="box-none" style={{ position: "absolute", left: 20, right: 20, bottom: controlBottom, flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
    <View pointerEvents="none" style={{ position: "absolute", left: -20, right: -20, bottom: -controlBottom, height: 150, overflow: "hidden" }}>
      <MaskedView style={{ position: "absolute", inset: 0 }} maskElement={<LinearGradient colors={["transparent", "rgba(0,0,0,0.52)", "#000000"]} locations={[0, 0.42, 0.72]} style={{ flex: 1 }} />}>
        <BlurView tint={T.isDark ? "dark" : "light"} intensity={16} style={{ position: "absolute", inset: 0 }} />
        <View style={{ position: "absolute", inset: 0, backgroundColor: T.isDark ? "rgba(36,30,38,0.52)" : "rgba(255,252,248,0.36)", borderTopWidth: 1, borderTopColor: T.border }} />
      </MaskedView>
    </View>
    <View onLayout={({ nativeEvent }) => onTimerHeightChange?.(nativeEvent.layout.height)} style={{ flex: 1, minHeight: 74, borderRadius: 26, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 12, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, boxShadow: `0px 8px 22px ${T.shadow}` }}>
      <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
        <Text style={{ color: T.dark, fontSize: 22, lineHeight: 27, fontWeight: "900", fontVariant: ["tabular-nums"], textAlign: "center", transform: [{ translateY: -4 }] }}>{duration}</Text>
        <Text style={{ color: T.muted, fontSize: 13, lineHeight: 15, fontWeight: "900", letterSpacing: 0.45, textTransform: "uppercase", textAlign: "center" }}>{paused ? "Quest paused" : "Quest time"}</Text>
      </View>
      <View style={{ width: 1, alignSelf: "stretch", marginVertical: 13, backgroundColor: T.border }} />
      <Pressable accessibilityRole="button" accessibilityLabel={paused ? "Resume quest" : "Pause quest"} accessibilityState={{ disabled: locked }} disabled={locked} onPress={() => { haptic(); onTogglePaused(); }} style={({ pressed }) => ({ width: 52, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: `${accent}16`, borderWidth: 2, borderColor: accent, borderBottomWidth: pressed ? 2 : 4, borderBottomColor: `${accent}88`, opacity: pressed ? 0.82 : 1, transform: [{ scale: pressed ? 0.96 : 1 }, { translateY: pressed ? 2 : 0 }] })}><Ionicons name={paused ? "play" : "pause"} size={21} color={accent} /></Pressable>
    </View>
    <View style={{ width: 70, height: 70, overflow: "visible" }}>
      <Animated.View pointerEvents={open ? "auto" : "none"} style={{ position: "absolute", right: 0, bottom: 0, width: 240, gap: 10, opacity: menuProgress, transform: [{ translateY: actionMenuLift }, { scale: menuProgress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>
        {actions.map((action, index) => <View key={action.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
          <View style={{ maxWidth: 150, minHeight: 38, borderRadius: 19, paddingHorizontal: 13, justifyContent: "center", backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, boxShadow: `0px 4px 13px ${T.shadow}` }}><Text numberOfLines={1} style={{ color: T.dark, fontSize: 13, lineHeight: 17, fontWeight: "900" }}>{action.label}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={action.label} disabled={(locked && !((action.label === "Take photo" && allowPhotoCapture) || (action.label === "Quick note" && allowQuickNote))) || (takingPhoto && action.label === "Take photo")} onPress={() => { haptic(); if (!forcedOpen) setOpen(false); if (action.label === "Quick note") onQuickNoteOpened?.(); action.onPress(); }} style={({ pressed }) => ({ width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", backgroundColor: action.color, borderWidth: 3, borderColor: T.white, boxShadow: "0px 5px 13px rgba(35,40,37,0.20)", opacity: pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] })}><Ionicons name={action.icon} size={27} color={T.onAccent} /></Pressable>
        </View>)}
      </Animated.View>
      <Animated.View pointerEvents={paused ? "auto" : "none"} style={{ position: "absolute", right: 0, bottom: 0, opacity: pauseProgress, transform: [{ scale: pauseProgress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel="End quest" disabled={locked} onPress={() => { haptic(); onFinish(); }} style={({ pressed }) => ({ width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", backgroundColor: T.red, borderWidth: 3, borderColor: T.white, boxShadow: "0px 8px 20px rgba(35,40,37,0.24)", transform: [{ scale: pressed ? 0.92 : 1 }] })}><Ionicons name="stop" size={27} color={T.onAccent} /></Pressable>
      </Animated.View>
      <Animated.View style={{ position: "absolute", right: 0, bottom: 0, zIndex: 2, transform: [{ translateY: quickActionLift }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={open ? "Close quest actions" : "Open quest actions"} accessibilityState={{ expanded: open, disabled: locked && !allowQuickActions }} disabled={locked && !allowQuickActions} onPress={() => { haptic(); setOpen((current) => { const next = !current; if (next) onQuickActionsOpened?.(); return next; }); }} style={({ pressed }) => ({ width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", backgroundColor: open ? T.dark : accent, borderWidth: 3, borderColor: T.white, boxShadow: "0px 8px 20px rgba(35,40,37,0.24)", transform: [{ scale: pressed ? 0.92 : 1 }] })}><Animated.View style={{ transform: [{ rotate: menuProgress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) }] }}><Ionicons name="add" size={38} color={T.onAccent} /></Animated.View></Pressable>
      </Animated.View>
    </View>
  </View>;
}

function StaleQuestActionButton({ label, icon, onPress, disabled = false, inverse = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; inverse?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { if (!disabled) { haptic(); onPress(); } }} style={({ pressed }) => ({ minHeight: 58, borderRadius: 20, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: inverse ? T.white : T.blue, borderWidth: inverse ? 3 : 0, borderColor: inverse ? T.border : "transparent", borderBottomWidth: inverse ? 3 : 6, borderBottomColor: inverse ? T.border : T.buttonEdge, opacity: disabled ? 0.5 : 1, transform: [{ translateY: pressed && !disabled ? 3 : 0 }] })}>
    <Ionicons name={icon} size={21} color={inverse ? T.blue : T.onAccent} />
    <Text style={{ color: inverse ? T.blue : T.onAccent, fontFamily: "RubikBold", fontSize: 17, lineHeight: 22, fontWeight: "900" }}>{label}</Text>
  </Pressable>;
}

function StaleQuestReminder({
  visible,
  elapsedLabel,
  busy,
  onResume,
  onAbandon,
}: {
  visible: boolean;
  elapsedLabel: string;
  busy: boolean;
  onResume: () => void;
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
          <Pressable accessibilityRole="button" accessibilityLabel="Abandon this quest" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onAbandon} style={({ pressed }) => ({ minHeight: 42, alignItems: "center", justifyContent: "center", opacity: busy || pressed ? 0.65 : 1 })}><Text style={{ color: T.red, fontFamily: "RubikBold", fontSize: 16, lineHeight: 21, fontWeight: "900" }}>Abandon this quest</Text></Pressable>
        </View>
      </View>
    </Sheet>
  );
}

function FinishQuestReviewSheet({ visible, accent, promptIndex, onContinue, onEndQuest }: { visible: boolean; accent: string; promptIndex: number; onContinue: () => void; onEndQuest: () => void }) {
  if (!visible) return null;
  const prompt = FINISH_QUEST_PROMPTS[promptIndex];
  return <Sheet visible onClose={onContinue} maxHeight="54%"><View style={{ paddingHorizontal: 24, paddingBottom: 20, gap: 16 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 25, lineHeight: 31, textAlign: "center" }}>{prompt.title}</Text><View style={{ gap: 11 }}><SoftButton label={prompt.endLabel} icon="checkmark" color={accent} onPress={onEndQuest} /><SoftButton label={prompt.continueLabel} inverse color={accent} onPress={onContinue} /></View></View></Sheet>;
}

function ActiveQuestLoadingSkeleton({ accent }: { accent: string }) {
  const { contentWidth, horizontalPadding, insets } = useResponsiveScreenLayout();
  return <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, gap: 22 }} accessibilityLabel="Loading active quest" accessibilityState={{ busy: true }}>
    <View accessible={false} style={{ gap: 10, paddingVertical: 8 }}><View style={{ width: 92, height: 10, borderRadius: 5, backgroundColor: T.border }} /><View style={{ width: "65%", height: 25, borderRadius: 8, backgroundColor: T.border }} /></View>
    <View accessible={false} style={{ height: 52, borderRadius: 18, borderWidth: 1, borderColor: T.border, flexDirection: "row", padding: 6, gap: 8 }}>{[0, 1, 2].map(index => <View key={index} style={{ flex: 1, borderRadius: 12, backgroundColor: `${accent}12` }} />)}</View>
    <View accessible={false} style={{ height: 184, borderRadius: 24, backgroundColor: `${accent}10`, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: T.border }}><Ionicons name="map-outline" size={32} color={accent} /></View>
    <QuestSectionPlaceholder accent={accent} icon="happy-outline" title="Mood check-in" detail="" loading />
    <QuestMoments photos={[]} events={[]} accent={accent} onManage={() => undefined} onCapture={() => undefined} loading />
    <View style={{ gap: 11 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20 }}>Quest timeline</Text><QuestSectionPlaceholder accent={accent} icon="time-outline" title="Quest timeline" detail="" loading /></View>
  </ScrollView>;
}

export function ActiveQuestScreen({ preview = false, onboarding, previewQuest, previewRoute, previewElapsedMs }: { preview?: boolean; onboarding?: ActiveQuestOnboardingOptions; previewQuest?: Quest; previewRoute?: ActiveQuestRoutePoint[]; previewElapsedMs?: number }) {
  useThemeKey();
  const timelinePositions = useRef(new Map<string, TimelinePosition>());
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const { saveToJournal, nextQuestId } = useLocalSearchParams<{ saveToJournal?: string; nextQuestId?: string }>();
  const insets = useSafeAreaInsets();
  const screenInsets = preview ? PREVIEW_PHONE_INSETS : insets;
  const { contentWidth: activeContentWidth, isWide, height: viewportHeight } = useResponsiveScreenLayout();
  const wideWorkspace = isWide && viewportHeight >= 600;
  const { engine, refresh, startQuest, abandonActiveQuest } = useQuestEngine();
  const { guestSession } = useGuestQuest();
  const { showFeedback } = useAppFeedback();
  const { snapshot, liveLocation, loading: activeQuestLoading, trackingMessage, pause, resume, saveEntry, enableTracking, stopTracking, addActivityNote, addPhoto, updateActivity, deleteActivity, deletePhoto, finishLocalQuest } = useActiveQuest();
  const timelineSessionId = snapshot?.session.sessionId ?? "preview";
  const timelinePosition = useMemo(() => {
    let saved = timelinePositions.current.get(timelineSessionId);
    if (!saved) {
      saved = { x: 0, y: 0, seen: [], images: new Set<string>() };
      timelinePositions.current.set(timelineSessionId, saved);
    }
    return saved;
  }, [timelineSessionId]);
  const { getQuest } = useContent();
  const { tab, mountedTabs, request: tabRequest, progress: tabProgress, reduced: reducedTabMotion, setTab, selectTab, onSceneReady } = useActiveQuestTabTransition("entry");
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [timerHeight, setTimerHeight] = useState(74);
  const [completeVisible, setCompleteVisible] = useState(false);
  const [destinationLayoutSession, setDestinationLayoutSession] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { if (!onboarding?.forcedTab) setTab("entry"); }, [onboarding?.forcedTab, setTab]));
  // The completion RPC clears the engine's active session immediately. Keep
  // this render snapshot so the recap remains on screen until the user leaves.
  const [completedQuest, setCompletedQuest] = useState<Quest | null>(null);
  const [completedRecap, setCompletedRecap] = useState<{ title: string; reflection: string; photoUris: string[]; duration: string; sessionId?: string; guestMode: boolean } | null>(null);
  const [finishReviewVisible, setFinishReviewVisible] = useState(false);
  const cameraSaved = useRef(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [capturePrompt, setCapturePrompt] = useState<QuestPrompt | undefined>();
  const [notePrompt, setNotePrompt] = useState<QuestPrompt | undefined>();
  const [savingMoment, setSavingMoment] = useState(false);
  const savingMomentRef = useRef(false);
  const changingPauseRef = useRef(false);
  const routeEnablePending = useRef(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingPhotoCaption, setPendingPhotoCaption] = useState("");
  const [pendingPhotoIsTutorialMock, setPendingPhotoIsTutorialMock] = useState(false);
  const [quickNoteVisible, setQuickNoteVisible] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [managedActivity, setManagedActivity] = useState<ActiveQuestActivity | null>(null);
  const [managedPhoto, setManagedPhoto] = useState<ActiveQuestPhoto | null>(null);
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
  const [activityDraft, setActivityDraft] = useState("");
  const [countdownStep, setCountdownStep] = useState<QuestCountdownStep | null>(null);
  const [countdownLaunchAt, setCountdownLaunchAt] = useState<number | null>(null);
  const [startupCompleteForSession, setStartupCompleteForSession] = useState<string | null>(null);
  const [photoSavedVisible, setPhotoSavedVisible] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState<MapCoordinate | null>(null);
  const countdownSessionRef = useRef<string | null>(null);
  const routeRecordingStartedSessionRef = useRef<string | null>(null);
  const shownTutorialMockRef = useRef<string | null>(null);
  const journalLaunchSessionRef = useRef<string | null>(null);
  const session = engine?.doingNowSession ?? guestSession;
  const launchState = useSyncExternalStore(subscribeQuestLaunch, getQuestLaunchState, getQuestLaunchState);
  const launch = launchState?.questId === session?.questId && (!launchState?.sessionId || launchState.sessionId === session?.id) ? launchState : null;
  useEffect(() => {
    if (launch?.phase !== "countdown") return;
    setCompleteVisible(false);
    if (!completeVisible && destinationLayoutSession === launch.sessionId && !activeQuestLoading && snapshot?.session.sessionId === launch.sessionId && launch.sessionId) markQuestDestinationReady(launch.sessionId);
  }, [launch, completeVisible, destinationLayoutSession, activeQuestLoading, snapshot?.session.sessionId]);
  const [finishPromptIndex, setFinishPromptIndex] = useState(0);
  useEffect(() => {
    if (!session?.id || preview) return;
    let active = true;
    void getFinishQuestPromptIndex(session.id).then((index) => {
      if (active) setFinishPromptIndex(index);
    });
    return () => { active = false; };
  }, [session?.id, preview]);
  const isGuestQuest = Boolean(guestSession && session?.id === guestSession.id);
  const loadedQuest = getQuest(session?.questId);
  // An active session remains completable even if the live content list has
  // not loaded yet, or the quest was subsequently unpublished. The completion
  // RPC uses the stable session quest ID, so a lightweight local fallback
  // prevents the user being trapped on this screen.
  let quest: Quest | null = previewQuest ?? loadedQuest ?? (session ? {
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
  if (completeVisible && completedQuest) quest = completedQuest;
  const accent = quest ? (categoryColor[quest.category]?.text ?? quest.color) : T.blue;
  const paused = snapshot?.session.recordingState === "paused";
  const countdownStartedAt = snapshot?.session.startedAt ?? session?.startedAt;
  const elapsedDuration = useActiveQuestElapsedDuration(snapshot?.session);
  const journalReflection = saveToJournal === "1"
    ? [snapshot?.session.entryBody, ...(snapshot?.activity.filter((item) => item.kind === "note").map((item) => item.body) ?? [])].filter((value): value is string => Boolean(value?.trim())).join("\n\n")
    : snapshot?.session.entryBody ?? "";
  const captureCompletionRecap = () => setCompletedRecap({
    title: snapshot?.session.entryTitle ?? "",
    reflection: journalReflection,
    photoUris: (snapshot?.photos ?? []).map((photo) => photo.uri),
    duration: formatElapsedFull(previewElapsedMs ?? elapsedDuration),
    sessionId: session?.id,
    guestMode: isGuestQuest,
  });
  const isFreshSession = Boolean(session?.id && countdownStartedAt && (onboarding?.forceCountdown || Date.now() - new Date(countdownStartedAt).getTime() <= 15_000));
  const shouldPlayCountdown = !onboarding?.holdCountdown && isFreshSession && snapshot?.session.recordingState === "paused";
  const isCountdownPending = shouldPlayCountdown && countdownSessionRef.current !== session?.id && !countdownLaunchAt;
  const isStartingQuest = preview ? false : launch ? launch.phase === "preparing" || launch.phase === "countdown" : isCountdownPending || Boolean(countdownLaunchAt && startupCompleteForSession !== session?.id);
  useEffect(() => {
    if (onboarding?.forcedTab) setTab(onboarding.forcedTab);
  }, [onboarding?.forcedTab, setTab]);

  useEffect(() => {
    if (preview || saveToJournal !== "1" || activeQuestLoading || !session?.id || !quest || journalLaunchSessionRef.current === session.id) return;
    journalLaunchSessionRef.current = session.id;
    setCompletedQuest(quest);
    captureCompletionRecap();
    setCompleteVisible(true);
  }, [activeQuestLoading, preview, quest, saveToJournal, session?.id]);

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
    // The lobby owns the full recovery choice, including the original start
    // time and confirmation before abandoning. Do not open a stale quest
    // normally once the 12-hour gate has been reached.
    if (!preview && session?.recoveryRequiredAt) router.replace("/(tabs)");
  }, [preview, router, session?.recoveryRequiredAt]);

  const resolveDeviceLocation = useCallback(async () => {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) return;
      const known = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 1000 });
      if (known) { const fix = locationPreview(known); if (fix) setDeviceLocation(fix); }
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>(resolve => { deadline = setTimeout(() => resolve(null), 12_000); }),
      ]);
      if (fresh) { const fix = locationPreview(fresh); if (fix) setDeviceLocation(fix); }
    } catch {
      // The foreground watcher remains active. Failure to obtain a one-shot fix
      // is not a permission denial and must not trap the enable button.
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  }, []);

  useEffect(() => {
    if (!preview && (tab === "map" || tab === "entry") && !isStartingQuest) void resolveDeviceLocation();
  }, [isStartingQuest, preview, resolveDeviceLocation, tab]);

  const beginQuestRoute = useCallback(async () => {
    if (snapshot?.session.recordingState === "paused") {
      await resume();
    }
    await enableTracking();
    await resolveDeviceLocation();
  }, [enableTracking, resolveDeviceLocation, resume, snapshot?.session.recordingState]);

  useEffect(() => {
    if (!preview && launch && session?.id) {
      // The full-screen start form owns this countdown. Never run a second one
      // on the map, including when a previous active screen remains mounted.
      setCountdownLaunchAt(null);
      setCountdownStep(null);
      if (launch.phase === "preparing" || launch.phase === "countdown" || completeVisible) return;
      if (activeQuestLoading || snapshot?.session.sessionId !== session.id) return;
      setStartupCompleteForSession(session.id);
      countdownSessionRef.current = session.id;
      if (claimQuestLaunch(session.id)) {
        routeRecordingStartedSessionRef.current = session.id;
        void beginQuestRoute().catch(() => showFeedback({ message: "Your quest is ready. Tap Resume or enable route recording to continue.", icon: "alert-circle", color: T.orange }));
      }
      return;
    }
    if (preview || onboarding?.holdCountdown || !session?.id || !countdownStartedAt || (!onboarding?.forceCountdown && Date.now() - new Date(countdownStartedAt).getTime() > 15_000)) {
      setCountdownLaunchAt(null);
      return;
    }
    if (!snapshot || activeQuestLoading) return;
    if (snapshot.session.recordingState !== "paused") return;
    if (countdownSessionRef.current === session.id) return;
    countdownSessionRef.current = session.id;
    setCountdownLaunchAt(Date.now());
  }, [activeQuestLoading, beginQuestRoute, completeVisible, countdownStartedAt, launch, onboarding?.forceCountdown, onboarding?.holdCountdown, preview, session?.id, showFeedback, snapshot]);

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
        requestIdleCallback(() => { void beginQuestRoute(); });
      }
    }, 3_400);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finishTimer);
    };
  }, [beginQuestRoute, countdownLaunchAt, onboarding, preview, session?.id]);

  useEffect(() => {
    if (!photoSavedVisible || takingPhoto || pendingPhotoUri) return;
    const timer = setTimeout(() => setPhotoSavedVisible(false), 2_800);
    return () => clearTimeout(timer);
  }, [photoSavedVisible, takingPhoto, pendingPhotoUri]);

  const duration = formatElapsedFull(previewElapsedMs ?? elapsedDuration);
  const renderedRoute = snapshot?.route ?? previewRoute ?? [];
  const renderedSegments = snapshot?.renderSegments ?? (previewRoute?.length ? [{ id: "preview-route", state: "active" as const, points: previewRoute }] : []);
  const previewLocation = previewRoute?.at(-1);

  const openActivityManager = useCallback((activity: ActiveQuestActivity) => {
    setManagedActivity(activity);
    setManagedPhoto(activity.photoId ? snapshot?.photos.find((photo) => photo.id === activity.photoId) ?? null : null);
    setActivityDraft(activity.kind === "photo" ? activity.caption ?? "" : activity.body ?? "");
  }, [snapshot?.photos]);

  if (completeVisible && completedQuest && completedRecap) return <LogLoreFlow
    guestMode={completedRecap.guestMode}
    visible
    quest={completedQuest}
    sessionId={completedRecap.sessionId}
    initialTitle={completedRecap.title}
    initialReflection={completedRecap.reflection}
    photoUris={completedRecap.photoUris}
    duration={completedRecap.duration}
    onSaveDraft={(draft) => saveEntry(draft)}
    onFinished={async (result, destination, details) => {
      if (completedRecap.sessionId && !completedRecap.guestMode) await updateActiveQuestSession(completedRecap.sessionId, { completionId: result.completionId }).catch(() => undefined);
      await finishLocalQuest(completedRecap.sessionId, completedRecap.guestMode);
      if (!completedRecap.guestMode) await refresh();
      if (completedRecap.guestMode) { router.replace("/(auth)/auth-options"); return; }
      if (destination === "share") {
        router.replace({ pathname: "/share-adventure", params: { completionId: result.completionId, questId: completedQuest.id, title: completedQuest.title, rating: String(details.rating), sharePhotos: JSON.stringify(completedRecap.photoUris.slice(0, 4)) } });
        return;
      }
      if (saveToJournal === "1" && nextQuestId) {
        try { const result = await startQuest({ questId: nextQuestId, source: "explore" }); if (result.navigationHandled) { void refresh().catch(() => undefined); return; } await refresh(); setCompleteVisible(false); setCompletedQuest(null); setCompletedRecap(null); router.replace("/active-quest"); }
        catch (error) { if (isQuestStartCancelled(error)) return; showFeedback({ message: "Your quest is saved in the Journal, but we couldn't start the next quest. Please try again.", icon: "alert-circle", color: T.red }); router.replace("/(tabs)/journal"); }
        return;
      }
      router.replace({ pathname: "/(tabs)/journal", params: { completionId: result.completionId } });
    }}
  />;

  // The guest guide needs the real shell immediately so it can teach the
  // controls while the device-local snapshot finishes hydrating.
  if (activeQuestLoading && session && !preview && !onboarding) return <ActiveQuestLoadingSkeleton accent={accent} />;

  // There is no standalone empty active-quest destination. Completion always
  // continues into the Journal, and a stale deep link simply renders nothing
  // while navigation resolves rather than flashing the old empty screen.
  if ((!session && !previewQuest && !completeVisible) || !quest) return null;

  const changePauseState = async (action: () => Promise<void>) => {
    if (changingPauseRef.current) return false;
    changingPauseRef.current = true;
    try {
      await action();
      return true;
    } catch {
      showFeedback({ message: "Couldn’t update the quest timer. Please try again.", icon: "alert-circle", color: T.red });
      return false;
    } finally {
      changingPauseRef.current = false;
    }
  };
  const togglePaused = () => { void changePauseState(paused ? resume : pause); };
  const openFinishReview = () => {
    void (async () => {
      if (await changePauseState(paused ? async () => undefined : pause)) setFinishReviewVisible(true);
    })();
  };
  const continueQuest = () => {
    void (async () => {
      if (await changePauseState(resume)) setFinishReviewVisible(false);
    })();
  };
  const enableRouteRecording = beginQuestRoute;
  const handleEnableRouteRecording = () => {
    if (routeEnablePending.current) return;
    routeEnablePending.current = true;
    // During guest onboarding the quest intentionally stays paused until the
    // guide's final countdown. Request route access without resuming time.
    const request = onboarding?.holdCountdown
      ? enableTracking().then(resolveDeviceLocation)
      : enableRouteRecording();
    void request.catch((error: unknown) => {
      showFeedback({ message: error instanceof Error ? error.message : "Could not enable location. Please try again.", icon: "alert-circle", color: T.red });
    }).finally(() => { routeEnablePending.current = false; onboarding?.onRouteRecordingRequested?.(); });
  };
  const takePhoto = async () => {
    if (takingPhoto) return;
    setCapturePrompt(undefined);
    cameraSaved.current = false;
    setTakingPhoto(true);
    onboarding?.onPhotoCaptureStarted?.();
  };
  const saveCapture = async (capture: QuestCapture, caption: string) => {
    if (!snapshot) throw new Error("Your quest is still loading. Try again.");
    if (isGuestQuest) {
      if (capture.kind !== "photo") throw new Error("Video moments are available after signing in. Try a photo for this tutorial.");
      await addPhoto(capture.uri, caption, { tutorialOnly: true });
    } else {
      const elapsed = journeyElapsedMs(snapshot.session);
      const eligible = availablePrompts(elapsed, snapshot.session.journey ?? emptyJourney()).find(p => p.id === capturePrompt?.id);
      await saveJourneyEvent(snapshot.session.sessionId, { ...capture, body: caption, activeElapsedMs: elapsed, prompt: eligible });
    }
    cameraSaved.current = true;
    setPhotoSavedVisible(true);
    onboarding?.onPhotoCaptureFinished?.(true);
    onboarding?.onPhotoSaved?.({ tutorialOnly: isGuestQuest });
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
    if (savingMomentRef.current) return;
    savingMomentRef.current = true; setSavingMoment(true);
    try {
      if (isGuestQuest || !snapshot) await addActivityNote(note);
      else {
        const elapsed = journeyElapsedMs(snapshot.session);
        const eligible = availablePrompts(elapsed, snapshot.session.journey ?? emptyJourney()).find(p => p.id === notePrompt?.id);
        await saveJourneyEvent(snapshot.session.sessionId, { kind: "note", body: note, activeElapsedMs: elapsed, prompt: eligible });
      }
    } catch { showFeedback({ message: "Couldn’t save your note. Please try again.", icon: "alert-circle", color: T.red }); return; } finally { savingMomentRef.current = false; setSavingMoment(false); }
    setQuickNote("");
    setQuickNoteVisible(false);
    showFeedback({ message: "Quick note saved to your quest.", icon: "create", color: T.orange });
    onboarding?.onQuickNoteSaved?.();
  };
  const savePendingPhoto = async () => {
    if (!pendingPhotoUri) return;
    if (savingMomentRef.current) return;
    savingMomentRef.current = true; setSavingMoment(true);
    const tutorialOnly = pendingPhotoIsTutorialMock;
    try { await addPhoto(pendingPhotoUri, pendingPhotoCaption, { tutorialOnly }); } catch { showFeedback({ message: "Couldn’t save your photo. Please try again.", icon: "alert-circle", color: T.red }); return; } finally { savingMomentRef.current = false; setSavingMoment(false); }
    setPendingPhotoUri(null);
    setPendingPhotoCaption("");
    setPendingPhotoIsTutorialMock(false);
    setPhotoSavedVisible(true);
    onboarding?.onPhotoSaved?.({ tutorialOnly });
  };
  const openPhotoManager = (photo: ActiveQuestPhoto) => {
    const activity = snapshot?.activity.find((item) => item.photoId === photo.id) ?? null;
    setManagedActivity(activity);
    setManagedPhoto(photo);
    setActivityDraft(activity?.caption ?? "");
  };
  const closeActivityManager = () => {
    if (savingMomentRef.current) return;
    setManagedActivity(null);
    setManagedPhoto(null);
    setActivityDraft("");
  };
  const saveActivityEdit = async () => {
    if (!managedActivity) return;
    if (savingMomentRef.current) return;
    savingMomentRef.current = true; setSavingMoment(true);
    try { await updateActivity(managedActivity.id, activityDraft); } catch { showFeedback({ message: "Couldn’t save your changes. Please try again.", icon: "alert-circle", color: T.red }); return; } finally { savingMomentRef.current = false; setSavingMoment(false); }
    closeActivityManager();
    showFeedback({ message: managedActivity.kind === "photo" ? "Photo caption updated." : "Quick note updated.", icon: "checkmark-circle", color: accent });
  };
  const deleteManagedItem = async () => {
    if (savingMomentRef.current) return;
    const isPhoto = Boolean(managedPhoto || managedActivity?.photoId);
    savingMomentRef.current = true; setSavingMoment(true);
    try {
      if (managedPhoto) await deletePhoto(managedPhoto.id);
      else if (managedActivity) await deleteActivity(managedActivity.id);
      setDeleteConfirmationVisible(false);
      setManagedActivity(null); setManagedPhoto(null); setActivityDraft("");
      showFeedback({ message: isPhoto ? "Photo deleted." : "Quick note deleted.", icon: "trash", color: T.red });
    } catch {
      showFeedback({ message: "Couldn’t delete this item. Please try again.", icon: "alert-circle", color: T.red });
    } finally { savingMomentRef.current = false; setSavingMoment(false); }
  };

  return <ActiveQuestViewport short={Platform.OS === "web" && viewportHeight < 600}><View style={{ flex: 1, backgroundColor: T.bg }}><View key={session?.id} onLayout={() => setDestinationLayoutSession(session?.id ?? null)} pointerEvents={preview ? "none" : "auto"} style={{ flex: 1, width: "100%", maxWidth: activeContentWidth, alignSelf: "center", backgroundColor: T.bg }}>
    {!preview ? <StatusBar style={T.isDark ? "light" : "dark"} /> : null}
    <View style={{ backgroundColor: T.bg, paddingTop: screenInsets.top + 8, paddingBottom: 12, borderBottomWidth: tab === "entry" ? 0 : 1, borderBottomColor: T.border }}>
      <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: T.muted, fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 0.8 }}>ACTIVE QUEST</Text>
          <Text accessibilityRole="header" numberOfLines={2} ellipsizeMode="tail" style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 27, fontWeight: "900" }}>{quest.title}</Text>
        </View>
        {!onboarding?.hideExit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to lobby"
            onPress={() => router.replace("/(tabs)")}
            style={({ pressed }) => ({ width: 44, height: 44, flexShrink: 0, borderRadius: 13, borderCurve: "continuous", backgroundColor: T.raised, borderWidth: 1.5, borderColor: T.border, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}
          >
            <Ionicons name="home" size={22} color={T.dark} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ marginTop: 12 }}><ActiveQuestTabs active={tab} onChange={selectTab} accent={accent} disabled={Boolean(onboarding?.locked)} /></View>
    </View>
    <View style={{ flex: 1, overflow: "hidden" }}>
      <ActiveQuestTabScene name="map" active={tab === "map"} present={true} progress={tabProgress.map} request={tabRequest} reduced={reducedTabMotion} onReady={onSceneReady}>
        {isStartingQuest ? <QuestStartupSurface accent={accent} step={countdownStep} /> : <LiveMap accent={accent} route={renderedRoute} renderSegments={renderedSegments} deviceLocation={deviceLocation ?? (previewLocation ? { latitude: previewLocation.latitude, longitude: previewLocation.longitude } : null)} liveLocation={liveLocation} trackingStatus={snapshot?.session.trackingStatus ?? "idle"} trackingMessage={trackingMessage} notice={null} onEnableTracking={handleEnableRouteRecording} forceEnablePrompt={onboarding?.guideStep === "route"} routePromptNudge={onboarding?.routePromptNudge} showUserLocation={!preview} animateInitialCamera={!preview} quickActionsOpen={quickActionsOpen} paused={paused} bottomInset={screenInsets.bottom} timerHeight={timerHeight} />}
      </ActiveQuestTabScene>
      <ActiveQuestTabScene name="entry" active={tab === "entry"} present={mountedTabs.includes("entry")} progress={tabProgress.entry} request={tabRequest} reduced={reducedTabMotion} onReady={onSceneReady}>
        <QuestInstructions quest={quest} accent={accent} disabled={Boolean(onboarding?.locked)} />
        <View style={{ flex: 1, paddingRight: wideWorkspace ? 344 : 0 }}>
          <ActivityTimeline
            key={timelineSessionId}
            position={timelinePosition}
            activity={snapshot?.activity ?? []}
            events={snapshot?.session.journey?.events ?? []}
            photos={snapshot?.photos ?? []}
            loading={activeQuestLoading && !snapshot}
            accent={accent}
            onManage={openActivityManager}
            focusLatest={Boolean(onboarding?.focusLatestActivity)}
            overview={<>
              <QuestRouteCard accent={accent} route={renderedRoute} renderSegments={renderedSegments} liveLocation={liveLocation} deviceLocation={deviceLocation ?? (previewLocation ? { latitude: previewLocation.latitude, longitude: previewLocation.longitude } : null)} trackingStatus={snapshot?.session.trackingStatus ?? "idle"} trackingMessage={trackingMessage} distanceMeters={snapshot?.session.distanceMeters ?? 0} showUserLocation={!preview} onEnableTracking={handleEnableRouteRecording} />
              {!isGuestQuest && !preview && !countdownStep && !photoSavedVisible ? <QuestJourneyPanel motionEnabled={false} placement="below-map" accent={accent} suppressed={takingPhoto || quickNoteVisible || quickActionsOpen || Boolean(managedActivity || managedPhoto) || finishReviewVisible || isStartingQuest} onCapture={prompt => { setCapturePrompt(prompt); setTakingPhoto(true); }} onNote={prompt => { setNotePrompt(prompt); setQuickNoteVisible(true); }} /> : null}
              <QuestMoments imageTransition={0} photos={snapshot?.photos ?? []} events={snapshot?.session.journey?.events ?? []} accent={accent} onManage={openPhotoManager} onCapture={() => void takePhoto()} loading={activeQuestLoading && !snapshot} captureDisabled={takingPhoto || isStartingQuest || !snapshot || Boolean(onboarding?.locked && !onboarding?.allowPhotoCapture)} />
            </>}
          />
        </View>
      </ActiveQuestTabScene>
      <ActiveQuestTabScene name="album" active={tab === "album"} present={mountedTabs.includes("album")} progress={tabProgress.album} request={tabRequest} reduced={reducedTabMotion} onReady={onSceneReady}>
        <View style={{ flex: 1, paddingRight: wideWorkspace ? 344 : 0 }}>
          <ActiveQuestMoments photos={snapshot?.photos ?? []} events={snapshot?.session.journey?.events ?? []} accent={accent} onManage={openPhotoManager} empty={<QuestMoments photos={snapshot?.photos ?? []} events={snapshot?.session.journey?.events ?? []} accent={accent} onManage={openPhotoManager} onCapture={() => void takePhoto()} loading={activeQuestLoading && !snapshot} captureDisabled={takingPhoto || isStartingQuest || !snapshot || Boolean(onboarding?.locked && !onboarding?.allowPhotoCapture)} />} />
        </View>
      </ActiveQuestTabScene>
    </View>
    {!isGuestQuest && !preview && !countdownStep && !photoSavedVisible ? <View pointerEvents="box-none" style={{ position: "absolute", zIndex: 10, left: 20, right: 20, bottom: Math.max(screenInsets.bottom + 10, 18) + timerHeight + 16, alignItems: "center" }}>
      <ScrollView style={{ maxHeight: viewportHeight * 0.36, width: "100%", maxWidth: 420 }} contentContainerStyle={{ padding: 4 }}>
        <QuestJourneyPanel motionEnabled={tab !== "entry"} placement="overlay" accent={accent} suppressed={takingPhoto || quickNoteVisible || quickActionsOpen || Boolean(managedActivity || managedPhoto) || finishReviewVisible || isStartingQuest} onCapture={prompt => { setCapturePrompt(prompt); setTakingPhoto(true); }} onNote={prompt => { setNotePrompt(prompt); setQuickNoteVisible(true); }} />
      </ScrollView>
    </View> : null}
    {!countdownStep && photoSavedVisible ? <QuestNoticePill notice="photo-saved" accent={accent} message={trackingMessage} bottomOffset={Math.max(screenInsets.bottom + 10, 18) + timerHeight + 16} /> : null}
    <FloatingQuestControls accent={accent} duration={duration} paused={paused} takingPhoto={takingPhoto} bottomInset={screenInsets.bottom} onTakePhoto={() => void takePhoto()} onQuickNote={() => { setNotePrompt(undefined); setQuickNoteVisible(true); }} onFinish={openFinishReview} onTogglePaused={togglePaused} locked={Boolean(onboarding?.locked)} forcedOpen={Boolean(onboarding?.forceQuickActionsOpen) || onboarding?.allowPhotoCapture || onboarding?.allowQuickNote} allowQuickActions={Boolean(onboarding?.allowQuickActions)} allowPhotoCapture={Boolean(onboarding?.allowPhotoCapture)} allowQuickNote={Boolean(onboarding?.allowQuickNote)} showQuickActionsWhenPaused={Boolean(onboarding?.showQuickActionsWhenPaused)} onQuickActionsOpened={onboarding?.onQuickActionsOpened} onQuickNoteOpened={onboarding?.onQuickNoteOpened} onOpenChange={setQuickActionsOpen} onTimerHeightChange={setTimerHeight} />
    <FinishQuestReviewSheet promptIndex={finishPromptIndex} visible={finishReviewVisible} accent={accent} onContinue={continueQuest} onEndQuest={() => { void stopTracking().catch(() => showFeedback({ message: "Couldn’t stop route recording. Please check location settings.", icon: "alert-circle", color: T.red })); setFinishReviewVisible(false); setCompletedQuest(quest); captureCompletionRecap(); setCompleteVisible(true); }} />
    <Sheet visible={quickNoteVisible} onClose={() => { if (savingMomentRef.current) return; setQuickNote(""); setQuickNoteVisible(false); onboarding?.onQuickNoteDiscarded?.(); }} maxHeight="58%">
      <View style={{ paddingHorizontal: 24, paddingBottom: 26, gap: 14 }}>
        <View style={{ gap: 3 }}><Text style={{ color: T.dark, fontSize: 24, lineHeight: 30, fontWeight: "900" }}>Quick note</Text><Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>Capture something before it slips away.</Text></View>
        <TextInput value={quickNote} onChangeText={setQuickNote} autoFocus multiline textAlignVertical="top" placeholder="Found a hidden café." placeholderTextColor={T.muted} style={{ minHeight: 148, borderWidth: 2, borderColor: T.border, borderRadius: 18, padding: 14, color: T.dark, fontSize: 16, lineHeight: 23, fontWeight: "700", backgroundColor: T.bg }} />
        <View style={{ flexDirection: "row", gap: 11 }}><Pressable accessibilityRole="button" accessibilityLabel="Delete note" onPress={() => { setQuickNote(""); setQuickNoteVisible(false); onboarding?.onQuickNoteDiscarded?.(); }} style={({ pressed }) => ({ flex: 1, minHeight: 54, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: `${T.red}12`, borderWidth: 1.5, borderColor: `${T.red}42`, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: T.red, fontSize: 16, fontWeight: "900" }}>Delete</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Save note" disabled={savingMoment} accessibilityState={{ disabled: savingMoment }} onPress={() => void saveQuickNote()} style={({ pressed }) => ({ flex: 1, minHeight: 54, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: T.primaryButton, borderBottomWidth: 5, borderBottomColor: T.primaryButtonEdge, opacity: pressed ? 0.78 : 1, transform: [{ translateY: pressed ? 3 : 0 }] })}><Text style={{ color: T.onBlueButton, fontSize: 16, fontWeight: "900" }}>Save</Text></Pressable></View>
      </View>
    </Sheet>
    <Sheet visible={Boolean(pendingPhotoUri)} onClose={() => { if (savingMomentRef.current) return; setPendingPhotoUri(null); setPendingPhotoCaption(""); setPendingPhotoIsTutorialMock(false); onboarding?.onPhotoDiscarded?.(); }} maxHeight="88%" fillHeight>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 26, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 3 }}><Text style={{ color: T.dark, fontSize: 24, lineHeight: 30, fontWeight: "900" }}>{pendingPhotoIsTutorialMock ? "A sample quest moment" : "Your quest moment"}</Text><Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>{pendingPhotoIsTutorialMock ? "This tutorial sample helps introduce the app’s features. It won’t be saved to your official journal." : "This is the photo you took. Add a note to remember it later."}</Text></View>
        {pendingPhotoUri ? <Image source={{ uri: pendingPhotoUri }} resizeMode="cover" style={{ width: "100%", aspectRatio: 1, borderRadius: 22, backgroundColor: T.border }} /> : null}
        <View style={{ gap: 6 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>Caption</Text><TextInput value={pendingPhotoCaption} onChangeText={setPendingPhotoCaption} multiline textAlignVertical="top" placeholder="What made this moment memorable?" placeholderTextColor={T.muted} style={{ minHeight: 96, borderWidth: 2, borderColor: T.border, borderRadius: 18, padding: 13, color: T.dark, fontSize: 15, lineHeight: 21, fontWeight: "700", backgroundColor: T.bg }} /></View>
        <View style={{ flexDirection: "row", gap: 11 }}><Pressable accessibilityRole="button" accessibilityLabel="Retake photo" onPress={() => { setPendingPhotoUri(null); setPendingPhotoCaption(""); setPendingPhotoIsTutorialMock(false); void takePhoto(); }} style={({ pressed }) => ({ flex: 1, minHeight: 51, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: `${accent}12`, borderWidth: 1.5, borderColor: `${accent}45`, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: accent, fontSize: 15, fontWeight: "900" }}>Retake photo</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Never mind" onPress={() => { setPendingPhotoUri(null); setPendingPhotoCaption(""); setPendingPhotoIsTutorialMock(false); onboarding?.onPhotoDiscarded?.(); }} style={({ pressed }) => ({ flex: 1, minHeight: 51, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: T.raised, borderWidth: 1.5, borderColor: T.border, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: T.muted, fontSize: 15, fontWeight: "900" }}>Never mind</Text></Pressable></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Save photo" disabled={savingMoment} accessibilityState={{ disabled: savingMoment }} onPress={() => void savePendingPhoto()} style={({ pressed }) => ({ minHeight: 58, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: T.primaryButton, borderBottomWidth: 6, borderBottomColor: T.primaryButtonEdge, opacity: pressed ? 0.78 : 1, transform: [{ translateY: pressed ? 3 : 0 }] })}><Text style={{ color: T.onBlueButton, fontSize: 17, fontWeight: "900" }}>Save photo</Text></Pressable>
      </ScrollView>
    </Sheet>
    <Sheet visible={Boolean(managedActivity || managedPhoto)} onClose={closeActivityManager} maxHeight="70%">
      <View style={{ paddingHorizontal: 24, paddingBottom: 26, gap: 14 }}>
        <View style={{ gap: 3 }}><Text style={{ color: T.dark, fontSize: 24, lineHeight: 30, fontWeight: "900" }}>{managedPhoto ? "Manage photo" : "Manage quick note"}</Text><Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>{managedPhoto ? "Update its caption or remove it from this quest." : "Make a change or remove this note."}</Text></View>
        {managedPhoto ? <Image source={{ uri: managedPhoto.uri }} resizeMode="cover" style={{ width: "100%", aspectRatio: 1.6, borderRadius: 18, backgroundColor: T.border }} /> : null}
        {managedActivity ? <TextInput value={activityDraft} onChangeText={setActivityDraft} multiline textAlignVertical="top" placeholder={managedPhoto ? "Add a caption" : "Write a quick note"} placeholderTextColor={T.muted} style={{ minHeight: 106, borderWidth: 2, borderColor: T.border, borderRadius: 18, padding: 13, color: T.dark, fontSize: 15, lineHeight: 22, fontWeight: "700", backgroundColor: T.bg }} /> : null}
        <View style={{ flexDirection: "row", gap: 10 }}><Pressable accessibilityRole="button" accessibilityLabel="Delete activity" disabled={savingMoment} accessibilityState={{ disabled: savingMoment }} onPress={() => setDeleteConfirmationVisible(true)} style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: `${T.red}12`, borderWidth: 1.5, borderColor: `${T.red}45`, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: T.red, fontSize: 15, fontWeight: "900" }}>Delete</Text></Pressable>{managedActivity ? <Pressable accessibilityRole="button" accessibilityLabel="Save activity changes" disabled={savingMoment} accessibilityState={{ disabled: savingMoment }} onPress={() => void saveActivityEdit()} style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: accent, borderBottomWidth: 5, borderBottomColor: `${accent}a8`, opacity: pressed ? 0.78 : 1, transform: [{ translateY: pressed ? 3 : 0 }] })}><Text style={{ color: T.onAccent, fontSize: 15, fontWeight: "900" }}>Save changes</Text></Pressable> : null}</View>
      </View>
    </Sheet>
    <Sheet visible={deleteConfirmationVisible} onClose={() => { if (!savingMoment) setDeleteConfirmationVisible(false); }} maxHeight="50%">
      <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 14 }}>
        <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>{managedPhoto || managedActivity?.photoId ? "Delete photo?" : "Delete quick note?"}</Text>
        <Text style={{ color: T.muted, fontSize: 14, lineHeight: 20 }}>This removes it from your active quest.</Text>
        <SoftButton label="Delete" icon="trash" color={T.red} disabled={savingMoment} onPress={() => void deleteManagedItem()} />
        <SoftButton label="Cancel" inverse color={accent} disabled={savingMoment} onPress={() => setDeleteConfirmationVisible(false)} />
      </View>
    </Sheet>

    {takingPhoto && <QuestCamera responseKind={capturePrompt?.responseKind === "note" ? undefined : capturePrompt?.responseKind} accent={accent} onClose={() => { setTakingPhoto(false); setCapturePrompt(undefined); if (!cameraSaved.current) onboarding?.onPhotoCaptureFinished?.(false); cameraSaved.current = false; }} onSave={saveCapture} />}
    </View>
  </View></ActiveQuestViewport>;
}
