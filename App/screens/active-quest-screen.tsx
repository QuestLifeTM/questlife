import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Image, InteractionManager, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogLoreFlow } from "@/components/log-lore-flow";
import { QuestlifeFlame } from "@/components/questlife-flame";
import { categoryColor, T } from "@/components/theme";
import { EmptyState, haptic, Sheet, SoftButton } from "@/components/ui";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { useContent } from "@/contexts/ContentContext";
import { useActiveQuest } from "@/contexts/ActiveQuestContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { formatElapsedFull, useElapsedDuration } from "@/hooks/useElapsedTime";
import { Quest } from "@/types/content";
import { ActiveQuestCheckpoint, ActiveQuestRoutePoint } from "@/types/active-quest";
import { ActiveQuestPhoto } from "@/types/active-quest";
import { CompletionResult } from "@/types/engine";

type ActiveQuestTab = "map" | "album" | "entry";
type QuestNotice = "active" | "paused" | "photo-saved" | "hold-to-finish" | "location-help";
type CountdownStep = 3 | 2 | 1 | "GO";

const BOTTOM_SHEET_CONTENT_HEIGHT = 248;
const MAP_NOTICE_BOTTOM_OFFSET = BOTTOM_SHEET_CONTENT_HEIGHT + 48;
const MAP_RECENTER_BOTTOM_OFFSET = BOTTOM_SHEET_CONTENT_HEIGHT + 94;
// Keep the visual fill aligned with the full confirmation gesture so the
// completion sheet appears the moment the pill reaches the end.
const END_QUEST_HOLD_DURATION = 2_000;
const STALE_ACTIVE_QUEST_AFTER_MS = 4 * 60 * 60 * 1_000;

type MapCoordinate = { latitude: number; longitude: number };

function QuestNoticePill({ notice, accent, holdProgress, message }: { notice: QuestNotice; accent: string; holdProgress?: Animated.Value; message?: string | null }) {
  const detail = notice === "active"
    ? { icon: "ellipse" as const, iconColor: T.green, label: "Quest in progress" }
    : notice === "paused"
      ? { icon: "pause" as const, iconColor: "#e7a52c", label: "Quest paused" }
      : notice === "photo-saved"
        ? { icon: "checkmark-circle" as const, iconColor: T.green, label: "Photo saved to your album" }
        : notice === "hold-to-finish"
          ? { icon: "hand-left" as const, iconColor: T.red, label: "Hold End quest to finish" }
          : { icon: "location-outline" as const, iconColor: accent, label: message ?? "Enable location to record your route" };
  const fillWidth = holdProgress?.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return <View pointerEvents="none" style={{ position: "absolute", left: 20, right: 20, bottom: MAP_NOTICE_BOTTOM_OFFSET, alignItems: "center" }}>
    <View style={{ minHeight: 38, overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.94)", paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(232,223,213,0.84)", boxShadow: "0px 3px 10px rgba(61,52,56,0.12)" }}>
      {fillWidth ? <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: fillWidth, backgroundColor: `${T.red}22` }} /> : null}
      <Ionicons name={detail.icon} size={notice === "active" ? 12 : 17} color={detail.iconColor} style={{ zIndex: 1 }} />
      <Text style={{ color: T.dark, fontSize: 13, lineHeight: 17, fontWeight: "900", zIndex: 1 }}>{detail.label}</Text>
    </View>
  </View>;
}

function CountdownOverlay({ step, accent }: { step: CountdownStep; accent: string }) {
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

function ActiveQuestTabs({ active, onChange, accent }: { active: ActiveQuestTab; onChange: (tab: ActiveQuestTab) => void; accent: string }) {
  const tabs: { id: ActiveQuestTab; label: string }[] = [{ id: "map", label: "Map" }, { id: "album", label: "Album" }, { id: "entry", label: "Entry" }];
  return <View style={{ marginHorizontal: 20, padding: 5, flexDirection: "row", alignSelf: "stretch", borderRadius: 18, backgroundColor: "#f7f3ee", borderWidth: 1, borderColor: T.border }}>
    {tabs.map((tab) => {
      const selected = tab.id === active;
      return <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => { haptic(); onChange(tab.id); }} style={({ pressed }) => ({ flex: 1, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: selected ? T.white : "transparent", borderWidth: selected ? 1 : 0, borderColor: selected ? `${accent}45` : "transparent", boxShadow: selected ? "0px 2px 0px rgba(61,52,56,0.08)" : "none", transform: [{ scale: pressed ? 0.97 : 1 }] })}>
        <Text style={{ color: selected ? accent : "#867a79", fontSize: 16, lineHeight: 21, fontWeight: "900" }}>{tab.label}</Text>
      </Pressable>;
    })}
  </View>;
}

const LiveMap = memo(function LiveMap({ accent, route, renderRoute, checkpoints = [], deviceLocation, liveLocation, trackingStatus, trackingMessage, notice, onEnableTracking }: { accent: string; route: ActiveQuestRoutePoint[]; renderRoute: ActiveQuestRoutePoint[]; checkpoints?: ActiveQuestCheckpoint[]; deviceLocation: MapCoordinate | null; liveLocation: MapCoordinate | null; trackingStatus: "idle" | "tracking" | "permission-needed" | "unavailable"; trackingMessage: string | null; notice: QuestNotice | null; onEnableTracking: () => void }) {
  const map = useRef<MapView>(null);
  const [followingUser, setFollowingUser] = useState(true);
  const current = route.at(-1);
  // The foreground location subscription drives the native map immediately;
  // accepted route points remain the source of truth for the saved polyline.
  const liveCoordinate = liveLocation ?? (current ? { latitude: current.latitude, longitude: current.longitude } : deviceLocation);
  const region = liveCoordinate ? { ...liveCoordinate, latitudeDelta: route.length > 1 ? 0.012 : 0.018, longitudeDelta: route.length > 1 ? 0.012 : 0.018 } : null;
  // The lower sheet covers a substantial part of the map. Centre the camera
  // slightly south of the user so the live dot stays in the visible area.
  const cameraRegion = region ? { ...region, latitude: region.latitude - region.latitudeDelta * 0.18 } : null;
  const polylineCoordinates = useMemo(() => renderRoute.map((point) => ({ latitude: point.latitude, longitude: point.longitude })), [renderRoute]);

  useEffect(() => {
    if (cameraRegion && followingUser) map.current?.animateToRegion(cameraRegion, 450);
  }, [cameraRegion?.latitude, cameraRegion?.longitude, followingUser]);

  if (!region) return <View style={{ flex: 1, backgroundColor: "#edf0eb", alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: BOTTOM_SHEET_CONTENT_HEIGHT, gap: 12 }}>
    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: `${accent}1c`, alignItems: "center", justifyContent: "center" }}><Ionicons name="location-outline" size={27} color={accent} /></View>
    <Text style={{ color: T.dark, fontSize: 19, lineHeight: 25, fontWeight: "900", textAlign: "center" }}>Ready to map your quest</Text>
    <Text style={{ color: T.muted, maxWidth: 280, fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" }}>Enable location to centre the map on where you actually are and start recording your route.</Text>
    <Pressable accessibilityRole="button" onPress={onEnableTracking} style={({ pressed }) => ({ minHeight: 48, marginTop: 4, borderRadius: 24, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: accent, transform: [{ scale: pressed ? 0.97 : 1 }] })}><Text style={{ color: T.white, fontSize: 14, fontWeight: "900" }}>Enable route recording</Text></Pressable>
    {notice ? <QuestNoticePill notice={notice} accent={accent} message={trackingMessage} /> : null}
  </View>;

  return <View style={{ flex: 1, backgroundColor: "#e5e8e2" }}>
    <MapView ref={map} style={{ flex: 1 }} initialRegion={cameraRegion ?? undefined} mapType="standard" showsPointsOfInterest={false} showsBuildings={false} showsUserLocation showsMyLocationButton={false} showsCompass toolbarEnabled={false} onPanDrag={() => setFollowingUser(false)}>
      {polylineCoordinates.length > 1 ? <Polyline coordinates={polylineCoordinates} strokeColor={accent} strokeWidth={5} lineCap="round" lineJoin="round" /> : null}
      {route[0] ? <Marker coordinate={{ latitude: route[0].latitude, longitude: route[0].longitude }} anchor={{ x: 0.5, y: 0.5 }} title="Quest started"><View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 4, borderColor: T.white, backgroundColor: accent }} /></Marker> : null}
      {current && route.length > 1 ? <Marker coordinate={{ latitude: current.latitude, longitude: current.longitude }} anchor={{ x: 0.5, y: 0.5 }} title="Current route end"><View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 4, borderColor: T.white, backgroundColor: T.dark }} /></Marker> : null}
      {checkpoints.map((checkpoint) => <Marker key={checkpoint.id} coordinate={{ latitude: checkpoint.latitude, longitude: checkpoint.longitude }} title={checkpoint.label} pinColor={accent} />)}
    </MapView>
    {!followingUser ? <Pressable accessibilityRole="button" accessibilityLabel="Recenter map on your route" onPress={() => setFollowingUser(true)} style={({ pressed }) => ({ position: "absolute", right: 18, bottom: MAP_RECENTER_BOTTOM_OFFSET, width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: T.white, borderWidth: 1, borderColor: T.border, boxShadow: "0px 2px 6px rgba(61,52,56,0.14)", transform: [{ scale: pressed ? 0.94 : 1 }] })}><Ionicons name="locate" size={21} color={accent} /></Pressable> : null}
    {notice ? <QuestNoticePill notice={notice} accent={accent} message={trackingStatus === "permission-needed" || trackingStatus === "unavailable" ? trackingMessage : null} /> : null}
  </View>;
});

function QuestStartupSurface({ accent, step }: { accent: string; step: CountdownStep | null }) {
  return <View style={{ flex: 1, backgroundColor: "#edf0eb", alignItems: "center", justifyContent: "center", paddingBottom: BOTTOM_SHEET_CONTENT_HEIGHT }}>
    <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: `${accent}16`, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="navigate" size={32} color={accent} />
    </View>
    <Text style={{ marginTop: 18, color: T.dark, fontSize: 18, fontWeight: "900" }}>Get ready to begin</Text>
    {step ? <CountdownOverlay step={step} accent={accent} /> : null}
  </View>;
}

function Album({ accent, photos }: { accent: string; photos: ActiveQuestPhoto[] }) {
  if (!photos.length) return <View style={{ flex: 1, paddingHorizontal: 22, paddingBottom: BOTTOM_SHEET_CONTENT_HEIGHT + 92, backgroundColor: "#f8f7f3", alignItems: "center", justifyContent: "center", gap: 12 }}><View style={{ width: "100%", aspectRatio: 1.55, borderRadius: 20, borderWidth: 2, borderStyle: "dashed", borderColor: `${accent}88`, backgroundColor: `${accent}0e`, alignItems: "center", justifyContent: "center", gap: 9 }}><View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${accent}18`, alignItems: "center", justifyContent: "center" }}><Ionicons name="camera" size={23} color={accent} /></View><Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>Capture the little moments</Text><Text style={{ maxWidth: 250, color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" }}>Photos from this quest will appear here as a two-column memory stream.</Text></View></View>;
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 230, flexDirection: "row", flexWrap: "wrap", gap: 10, backgroundColor: "#f8f7f3" }}>
    {photos.map((photo) => <View key={photo.id} style={{ width: "48%", aspectRatio: 0.88, overflow: "hidden", borderRadius: 18, backgroundColor: T.border }}><Image source={{ uri: photo.uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />{photo.syncStatus !== "synced" ? <View style={{ position: "absolute", right: 8, bottom: 8, borderRadius: 12, padding: 5, backgroundColor: "rgba(255,255,255,0.88)" }}><Ionicons name="cloud-upload-outline" size={15} color={accent} /></View> : null}</View>)}
  </ScrollView>;
}

function EntryPlaceholder({ quest, title, body, onChangeTitle, onChangeBody }: { quest: Quest; title: string; body: string; onChangeTitle: (value: string) => void; onChangeBody: (value: string) => void }) {
  return <View style={{ flex: 1, padding: 22, paddingBottom: 218, backgroundColor: T.white, gap: 10 }}>
    <TextInput value={title} onChangeText={onChangeTitle} placeholder={`Day 1: ${quest.title}`} placeholderTextColor="#8a8186" style={{ color: T.dark, fontSize: 24, lineHeight: 30, fontWeight: "900", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: T.border }} />
    <TextInput value={body} onChangeText={onChangeBody} multiline textAlignVertical="top" placeholder="Start writing..." placeholderTextColor="#9a9293" style={{ flex: 1, color: T.dark, fontSize: 16, lineHeight: 24, fontWeight: "600", paddingVertical: 8 }} />
  </View>;
}

function RoundAction({ icon, label, color, inverse = false, onPress, onPressIn, onPressOut, holdToConfirm = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; inverse?: boolean; onPress: () => void; onPressIn?: () => void; onPressOut?: () => void; holdToConfirm?: boolean }) {
  return <View style={{ alignItems: "center", gap: 6 }}><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={holdToConfirm ? "Press and hold to finish this quest" : undefined} onPressIn={onPressIn} onPressOut={onPressOut} onPress={() => { if (!holdToConfirm) { haptic(); onPress(); } }} style={({ pressed }) => ({ width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", backgroundColor: inverse ? T.white : color, borderWidth: inverse ? 2 : 0, borderColor: inverse ? color : "transparent", transform: [{ scale: pressed ? 0.94 : 1 }] })}><Ionicons name={icon} size={27} color={inverse ? color : T.white} /></Pressable><Text style={{ color: T.muted, fontSize: 12, lineHeight: 16, fontWeight: "900" }}>{label}</Text></View>;
}

function StaleQuestActionButton({ label, icon, onPress, disabled = false, inverse = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; inverse?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { if (!disabled) { haptic(); onPress(); } }} style={({ pressed }) => ({ minHeight: 56, borderRadius: 28, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: inverse ? T.white : T.blue, borderWidth: inverse ? 3 : 0, borderColor: inverse ? T.border : "transparent", borderBottomWidth: inverse ? 3 : 5, borderBottomColor: inverse ? T.border : "#258fd8", opacity: disabled ? 0.5 : 1, transform: [{ translateY: pressed && !disabled ? 3 : 0 }] })}>
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

function CompletionRewardMoment({
  completion,
  questTitle,
  onJournal,
  onExplore,
}: {
  completion: CompletionResult | null;
  questTitle: string;
  onJournal: () => void;
  onExplore: () => void;
}) {
  if (!completion) return null;
  const energyLeft = Math.max(0, completion.dailyLimit - completion.dailyUsed);
  return (
    <Sheet visible={Boolean(completion)} onClose={onJournal} maxHeight="76%">
      <View style={{ paddingHorizontal: 24, paddingBottom: 26, gap: 15 }}>
        <View style={{ alignItems: "center", gap: 7 }}>
          <View style={{ width: 70, height: 70, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: `${T.yellow}32`, borderWidth: 2, borderColor: `${T.orange}55`, borderBottomWidth: 5, borderBottomColor: `${T.orange}88` }}><Ionicons name="trophy" size={35} color={T.orange} /></View>
          <Text style={{ color: T.dark, fontSize: 26, lineHeight: 32, fontWeight: "900", textAlign: "center" }}>Quest complete!</Text>
          <Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" }}>{questTitle}</Text>
        </View>
        <View style={{ borderRadius: 19, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#e6ddd2", backgroundColor: T.white, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderBottomWidth: 1, borderBottomColor: T.border }}><View style={{ width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: `${T.blue}16` }}><Ionicons name="flash" size={21} color={T.blue} /></View><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 15, lineHeight: 20, fontWeight: "900" }}>+{completion.xpAwarded} XP earned</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>A little more progress toward your next level.</Text></View></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderBottomWidth: 1, borderBottomColor: T.border }}><View style={{ width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: `${T.orange}16` }}><QuestlifeFlame size={25} /></View><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 15, lineHeight: 20, fontWeight: "900" }}>Your streak is covered today</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>Today now counts as a completed day.</Text></View></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 13 }}><View style={{ width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: `${T.green}16` }}><Ionicons name="battery-half" size={21} color={T.green} /></View><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 15, lineHeight: 20, fontWeight: "900" }}>{energyLeft ? `${energyLeft} ${energyLeft === 1 ? "quest" : "quests"} of energy left` : "Today's energy is complete"}</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>{energyLeft ? "You can keep exploring whenever it feels right." : "Rest up. Your energy resets at midnight."}</Text></View></View>
        </View>
        <View style={{ gap: 9 }}><SoftButton label="View your Journal" icon="book" onPress={onJournal} />{energyLeft ? <SoftButton label="Find another quest" icon="compass" inverse color={T.blue} onPress={onExplore} /> : null}</View>
      </View>
    </Sheet>
  );
}

export function ActiveQuestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { engine, refresh, abandonActiveQuest, saveActiveForLater } = useQuestEngine();
  const { showFeedback } = useAppFeedback();
  const { snapshot, liveLocation, loading: activeQuestLoading, trackingMessage, pause, resume, saveEntry, enableTracking, addPhoto, finishLocalQuest } = useActiveQuest();
  const { getQuest } = useContent();
  const [tab, setTab] = useState<ActiveQuestTab>("map");
  const [completeVisible, setCompleteVisible] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [countdownStep, setCountdownStep] = useState<CountdownStep | null>(null);
  const [countdownLaunchAt, setCountdownLaunchAt] = useState<number | null>(null);
  const [startupCompleteForSession, setStartupCompleteForSession] = useState<string | null>(null);
  const [photoSavedVisible, setPhotoSavedVisible] = useState(false);
  const [finishHintVisible, setFinishHintVisible] = useState(false);
  const [staleQuestReminderVisible, setStaleQuestReminderVisible] = useState(false);
  const [staleQuestActionBusy, setStaleQuestActionBusy] = useState(false);
  const [completionReward, setCompletionReward] = useState<{ result: CompletionResult; questTitle: string } | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<MapCoordinate | null>(null);
  const finishHoldProgress = useRef(new Animated.Value(0)).current;
  const finishHoldAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const finishHoldTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishHoldCompleted = useRef(false);
  const countdownSessionRef = useRef<string | null>(null);
  const routeRecordingStartedSessionRef = useRef<string | null>(null);
  const staleQuestReminderShownForSessionRef = useRef<string | null>(null);
  const session = engine?.activeSession;
  const loadedQuest = getQuest(session?.questId);
  // An active session remains completable even if the live content list has
  // not loaded yet, or the quest was subsequently unpublished. The completion
  // RPC uses the stable session quest ID, so a lightweight local fallback
  // prevents the user being trapped on this screen.
  const quest: Quest | null = loadedQuest ?? (session ? {
    id: session.questId,
    title: "Your active quest",
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
  const [entryTitle, setEntryTitle] = useState("");
  const [entryBody, setEntryBody] = useState("");
  const paused = snapshot?.session.recordingState === "paused";
  const countdownStartedAt = snapshot?.session.startedAt ?? session?.startedAt;
  const elapsedDuration = useElapsedDuration(session?.startedAt);
  const isFreshSession = Boolean(session?.id && countdownStartedAt && Date.now() - new Date(countdownStartedAt).getTime() <= 15_000);
  const shouldPlayCountdown = isFreshSession && snapshot?.session.recordingState === "paused";
  const isCountdownPending = shouldPlayCountdown && countdownSessionRef.current !== session?.id && !countdownLaunchAt;
  const isStartingQuest = isCountdownPending || Boolean(countdownLaunchAt && startupCompleteForSession !== session?.id);
  const statusNotice: QuestNotice = photoSavedVisible ? "photo-saved" : finishHintVisible ? "hold-to-finish" : paused ? "paused" : "active";
  useEffect(() => {
    if (quest && snapshot) {
      setEntryTitle(snapshot.session.entryTitle || `Day 1: ${quest.title}`);
      setEntryBody(snapshot.session.entryBody);
    }
  }, [quest, snapshot?.session.entryBody, snapshot?.session.entryTitle]);

  useEffect(() => {
    if (!snapshot) return;
    const saveTimer = setTimeout(() => {
      if (entryTitle !== snapshot.session.entryTitle || entryBody !== snapshot.session.entryBody) void saveEntry({ title: entryTitle, body: entryBody });
    }, 750);
    return () => clearTimeout(saveTimer);
  }, [entryBody, entryTitle, saveEntry, snapshot]);

  useEffect(() => {
    if (!session?.id || elapsedDuration < STALE_ACTIVE_QUEST_AFTER_MS || staleQuestReminderShownForSessionRef.current === session.id) return;
    staleQuestReminderShownForSessionRef.current = session.id;
    setStaleQuestReminderVisible(true);
  }, [elapsedDuration, session?.id]);

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
    if (tab === "map" && !isStartingQuest) void resolveDeviceLocation();
  }, [isStartingQuest, resolveDeviceLocation, tab]);

  const beginQuestRoute = useCallback(async () => {
    if (snapshot?.session.recordingState === "paused") {
      await resume();
      return;
    }
    await enableTracking();
    await resolveDeviceLocation();
  }, [enableTracking, resolveDeviceLocation, resume, snapshot?.session.recordingState]);

  useEffect(() => {
    if (!session?.id || !countdownStartedAt || Date.now() - new Date(countdownStartedAt).getTime() > 15_000) {
      setCountdownLaunchAt(null);
      return;
    }
    if (!snapshot || activeQuestLoading) return;
    if (snapshot.session.recordingState !== "paused") return;
    if (countdownSessionRef.current === session.id) return;
    countdownSessionRef.current = session.id;
    setCountdownLaunchAt(Date.now());
  }, [activeQuestLoading, countdownStartedAt, session?.id, snapshot]);

  useEffect(() => {
    if (!session?.id || !countdownLaunchAt) return;
    const phases: { delay: number; step: CountdownStep }[] = [
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
  }, [beginQuestRoute, countdownLaunchAt, session?.id]);

  useEffect(() => {
    if (!photoSavedVisible) return;
    const timer = setTimeout(() => setPhotoSavedVisible(false), 2_800);
    return () => clearTimeout(timer);
  }, [photoSavedVisible]);

  useEffect(() => {
    if (!finishHintVisible) return;
    const timer = setTimeout(() => setFinishHintVisible(false), 2_800);
    return () => clearTimeout(timer);
  }, [finishHintVisible]);

  useEffect(() => () => {
    finishHoldAnimation.current?.stop();
    if (finishHoldTimeout.current) clearTimeout(finishHoldTimeout.current);
  }, []);

  const duration = formatElapsedFull(elapsedDuration);

  if (!session || !quest) return <View style={{ flex: 1, paddingTop: insets.top + 24, backgroundColor: T.bg }}><EmptyState emoji="🧭" title="No active quest" body="Start a solo quest from Explore to create its live home." /></View>;

  const togglePaused = () => { void (paused ? resume() : pause()); };
  const enableRouteRecording = beginQuestRoute;
  const handleEnableRouteRecording = () => { void enableRouteRecording(); };
  const beginFinishQuestHold = () => {
    if (finishHoldTimeout.current) clearTimeout(finishHoldTimeout.current);
    setFinishHintVisible(true);
    finishHoldAnimation.current?.stop();
    finishHoldProgress.setValue(0);
    finishHoldCompleted.current = false;
    finishHoldAnimation.current = Animated.timing(finishHoldProgress, { toValue: 1, duration: END_QUEST_HOLD_DURATION, useNativeDriver: false });
    finishHoldAnimation.current.start();
    // The visual and the confirmation start on the same press. Do not wait on
    // Animated's completion callback: it can be delivered late after the fill
    // has already reached the end, especially while the map is rendering.
    finishHoldTimeout.current = setTimeout(() => {
      if (finishHoldCompleted.current) return;
      finishHoldCompleted.current = true;
      finishHoldTimeout.current = null;
      haptic();
      setFinishHintVisible(false);
      setCompleteVisible(true);
    }, END_QUEST_HOLD_DURATION);
  };
  const cancelFinishQuestHold = () => {
    if (finishHoldCompleted.current) return;
    if (finishHoldTimeout.current) clearTimeout(finishHoldTimeout.current);
    finishHoldTimeout.current = null;
    finishHoldAnimation.current?.stop();
    finishHoldProgress.setValue(0);
  };
  const takePhoto = async () => {
    if (takingPhoto) return;
    setTakingPhoto(true);
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
        await addPhoto(result.assets[0].uri);
        setPhotoSavedVisible(true);
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
    }
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

  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <StatusBar style="dark" />
    <View style={{ backgroundColor: T.white, paddingTop: insets.top + 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.border }}>
      <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: T.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" }}>ACTIVE QUEST</Text>
          <Text numberOfLines={1} style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 25, lineHeight: 31, fontWeight: "900" }}>{quest.title}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Leave active quest" onPress={() => router.back()} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: "#f7f3ee", borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.94 : 1 }] })}><Ionicons name="close" size={22} color={T.dark} /></Pressable>
      </View>
      <View style={{ marginTop: 16 }}><ActiveQuestTabs active={tab} onChange={setTab} accent={accent} /></View>
    </View>
    <View style={{ flex: 1 }}>
      {tab === "map" ? isStartingQuest ? <QuestStartupSurface accent={accent} step={countdownStep} /> : <LiveMap accent={accent} route={snapshot?.route ?? []} renderRoute={snapshot?.renderRoute ?? []} deviceLocation={deviceLocation} liveLocation={liveLocation} trackingStatus={snapshot?.session.trackingStatus ?? "idle"} trackingMessage={trackingMessage} notice={null} onEnableTracking={handleEnableRouteRecording} /> : tab === "album" ? <Album accent={accent} photos={snapshot?.photos ?? []} /> : <EntryPlaceholder quest={quest} title={entryTitle} body={entryBody} onChangeTitle={setEntryTitle} onChangeBody={setEntryBody} />}
    </View>
    {!countdownStep ? <QuestNoticePill notice={statusNotice} accent={accent} holdProgress={finishHintVisible ? finishHoldProgress : undefined} message={trackingMessage} /> : null}
    <BlurView intensity={12} tint="light" style={{ position: "absolute", left: 0, right: 0, bottom: 0, minHeight: insets.bottom + BOTTOM_SHEET_CONTENT_HEIGHT, paddingTop: 12, paddingBottom: Math.max(insets.bottom + 8, 22), paddingHorizontal: 32, borderTopLeftRadius: 34, borderTopRightRadius: 34, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.48)", borderTopWidth: 1, borderColor: "rgba(232,223,213,0.58)", boxShadow: "0px -3px 16px rgba(61,52,56,0.10)", justifyContent: "space-between" }}>
      <View style={{ alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: "rgba(210,199,188,0.70)" }} />
      <View style={{ flexDirection: "row" }}>
        <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
          <Text style={{ color: T.dark, fontSize: 28, lineHeight: 34, fontWeight: "900", fontVariant: ["tabular-nums"], textAlign: "center" }}>{snapshot?.photoCount ?? 0}</Text>
          <Text style={{ color: T.muted, fontSize: 13, lineHeight: 17, fontWeight: "900", textTransform: "uppercase", textAlign: "center" }}>Photos</Text>
        </View>
        <View style={{ width: 1, marginVertical: 4, backgroundColor: T.border }} />
        <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={{ width: "100%", color: T.dark, fontSize: 28, lineHeight: 34, fontWeight: "900", fontVariant: ["tabular-nums"], textAlign: "center" }}>{((snapshot?.session.distanceMeters ?? 0) / 1_000).toFixed(2)} km</Text>
          <Text style={{ color: T.muted, fontSize: 13, lineHeight: 17, fontWeight: "900", textTransform: "uppercase", textAlign: "center" }}>Distance</Text>
        </View>
      </View>
      <View style={{ alignItems: "center", gap: 3, paddingVertical: 2 }}>
        <Text style={{ color: T.dark, fontSize: 34, lineHeight: 40, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{duration}</Text>
        <Text style={{ color: T.muted, fontSize: 13, lineHeight: 17, fontWeight: "900", textTransform: "uppercase" }}>Time</Text>
      </View>
      <View style={{ position: "relative", flexDirection: "row", alignItems: "flex-start", justifyContent: "center", marginHorizontal: -32, paddingTop: 12, paddingHorizontal: 32, borderTopWidth: 1, borderTopColor: "rgba(232,223,213,0.48)", backgroundColor: "rgba(255,255,255,0.16)" }}>
        {paused ? <View style={{ position: "absolute", left: 32, top: 12, alignItems: "center" }}><RoundAction icon="stop" label="End quest" color={T.red} holdToConfirm onPress={() => undefined} onPressIn={beginFinishQuestHold} onPressOut={cancelFinishQuestHold} /></View> : null}
        <View style={{ flex: 1, alignItems: "center" }}><RoundAction icon={paused ? "play" : "pause"} label={paused ? "Resume" : "Pause"} color={accent} onPress={togglePaused} /></View>
        <View style={{ position: "absolute", right: 32, top: 12, alignItems: "center" }}><RoundAction icon={takingPhoto ? "hourglass" : "camera"} label="Take photo" color={accent} inverse onPress={() => void takePhoto()} /></View>
      </View>
    </BlurView>
    <LogLoreFlow visible={completeVisible} quest={quest} initialTitle={snapshot?.session.entryTitle ?? ""} initialReflection={snapshot?.session.entryBody ?? ""} photoUris={(snapshot?.photos ?? []).map((photo) => photo.uri)} durationSeconds={Math.round((snapshot?.session.activeDurationMs ?? 0) / 1_000)} distanceMeters={snapshot?.session.distanceMeters ?? 0} onSaveDraft={(draft) => saveEntry(draft)} onClose={() => setCompleteVisible(false)} onFinished={async (result) => { await finishLocalQuest(); await refresh(); setCompleteVisible(false); setCompletionReward({ result, questTitle: quest.title }); }} />
    <StaleQuestReminder visible={staleQuestReminderVisible} elapsedLabel={formatElapsedFull(elapsedDuration)} busy={staleQuestActionBusy} onResume={() => setStaleQuestReminderVisible(false)} onSaveForLater={() => void saveStaleQuestForLater()} onAbandon={confirmAbandonStaleQuest} />
    <CompletionRewardMoment completion={completionReward?.result ?? null} questTitle={completionReward?.questTitle ?? ""} onJournal={() => { const completionId = completionReward?.result.completionId; setCompletionReward(null); router.replace(completionId ? `/memory/${completionId}` : "/(tabs)/journal"); }} onExplore={() => { setCompletionReward(null); router.replace("/(tabs)/explore"); }} />
  </View>;
}
