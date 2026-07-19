import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogLoreFlow } from "@/components/log-lore-flow";
import { categoryColor, T } from "@/components/theme";
import { EmptyState, haptic } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useActiveQuest } from "@/contexts/ActiveQuestContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { Quest } from "@/types/content";
import { ActiveQuestRoutePoint } from "@/types/active-quest";
import { ActiveQuestPhoto } from "@/types/active-quest";

type ActiveQuestTab = "map" | "album" | "entry";

function formatDuration(activeDurationMs: number, activeSince: string | null) {
  const elapsed = activeDurationMs + (activeSince ? Math.max(0, Date.now() - new Date(activeSince).getTime()) : 0);
  const hours = Math.floor(elapsed / 3_600_000);
  const minutes = Math.floor((elapsed % 3_600_000) / 60_000);
  const seconds = Math.floor((elapsed % 60_000) / 1_000);
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type MapCoordinate = { latitude: number; longitude: number };

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

function LiveMap({ accent, route, deviceLocation, trackingStatus, trackingMessage, onEnableTracking }: { accent: string; route: ActiveQuestRoutePoint[]; deviceLocation: MapCoordinate | null; trackingStatus: "idle" | "tracking" | "permission-needed" | "unavailable"; trackingMessage: string | null; onEnableTracking: () => void }) {
  const map = useRef<MapView>(null);
  const current = route.at(-1);
  const liveCoordinate = current ? { latitude: current.latitude, longitude: current.longitude } : deviceLocation;
  const region = liveCoordinate ? { ...liveCoordinate, latitudeDelta: route.length > 1 ? 0.012 : 0.018, longitudeDelta: route.length > 1 ? 0.012 : 0.018 } : null;

  useEffect(() => {
    if (region) map.current?.animateToRegion(region, 450);
  }, [region?.latitude, region?.longitude]);

  if (!region) return <View style={{ flex: 1, backgroundColor: "#edf0eb", alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: 210, gap: 12 }}>
    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: `${accent}1c`, alignItems: "center", justifyContent: "center" }}><Ionicons name="location-outline" size={27} color={accent} /></View>
    <Text style={{ color: T.dark, fontSize: 19, lineHeight: 25, fontWeight: "900", textAlign: "center" }}>Ready to map your quest</Text>
    <Text style={{ color: T.muted, maxWidth: 280, fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" }}>Enable location to centre the map on where you actually are and start recording your route.</Text>
    <Pressable accessibilityRole="button" onPress={onEnableTracking} style={({ pressed }) => ({ minHeight: 48, marginTop: 4, borderRadius: 24, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: accent, transform: [{ scale: pressed ? 0.97 : 1 }] })}><Text style={{ color: T.white, fontSize: 14, fontWeight: "900" }}>Enable route recording</Text></Pressable>
  </View>;

  return <View style={{ flex: 1, backgroundColor: "#e5e8e2" }}>
    <MapView ref={map} style={{ flex: 1 }} initialRegion={region} mapType="standard" showsPointsOfInterest={false} showsBuildings={false} showsUserLocation={false} showsMyLocationButton={false} toolbarEnabled={false} customMapStyle={[{ featureType: "poi", stylers: [{ visibility: "off" }] }]}>
      {route.length > 1 ? <Polyline coordinates={route.map((point) => ({ latitude: point.latitude, longitude: point.longitude }))} strokeColor={accent} strokeWidth={5} lineCap="round" lineJoin="round" /> : null}
      <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} anchor={{ x: 0.5, y: 0.5 }}><View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(77,168,255,0.24)", alignItems: "center", justifyContent: "center" }}><View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: T.blue, borderWidth: 2, borderColor: T.white }} /></View></Marker>
    </MapView>
    <View style={{ position: "absolute", left: 20, right: 20, bottom: 230, alignItems: "center", gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.96)", paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(232,223,213,0.78)" }}><Ionicons name={trackingStatus === "tracking" ? "location" : "location-outline"} size={15} color={accent} /><Text style={{ color: T.dark, fontSize: 13, fontWeight: "900" }}>{trackingStatus === "tracking" ? (current ? "Recording your route" : "Your location is ready") : "Location is ready"}</Text></View>
      {trackingMessage ? <Text style={{ color: "#5e615e", fontSize: 12, fontWeight: "700", textAlign: "center" }}>{trackingMessage}</Text> : null}
    </View>
  </View>;
}

function Album({ accent, photos }: { accent: string; photos: ActiveQuestPhoto[] }) {
  if (!photos.length) return <View style={{ flex: 1, paddingHorizontal: 22, paddingBottom: 220, backgroundColor: "#f8f7f3", alignItems: "center", justifyContent: "center", gap: 12 }}><View style={{ width: "100%", aspectRatio: 1.55, borderRadius: 20, borderWidth: 2, borderStyle: "dashed", borderColor: `${accent}88`, backgroundColor: `${accent}0e`, alignItems: "center", justifyContent: "center", gap: 9 }}><View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${accent}18`, alignItems: "center", justifyContent: "center" }}><Ionicons name="camera" size={23} color={accent} /></View><Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>Capture the little moments</Text><Text style={{ maxWidth: 250, color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" }}>Photos from this quest will appear here as a two-column memory stream.</Text></View></View>;
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 230, flexDirection: "row", flexWrap: "wrap", gap: 10, backgroundColor: "#f8f7f3" }}>
    {photos.map((photo) => <View key={photo.id} style={{ width: "48%", aspectRatio: 0.88, overflow: "hidden", borderRadius: 18, backgroundColor: T.border }}><Image source={{ uri: photo.uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /><View style={{ position: "absolute", top: 8, left: 8, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "rgba(48,39,43,0.72)" }}><Text style={{ color: T.white, fontSize: 11, fontWeight: "900" }}>{new Date(photo.capturedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text></View>{photo.syncStatus !== "synced" ? <View style={{ position: "absolute", right: 8, bottom: 8, borderRadius: 12, padding: 5, backgroundColor: "rgba(255,255,255,0.88)" }}><Ionicons name="cloud-upload-outline" size={15} color={accent} /></View> : null}</View>)}
  </ScrollView>;
}

function QuestCamera({ onClose, onCaptured }: { onClose: () => void; onCaptured: (uri: string) => void }) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  if (!permission?.granted) return <View style={{ position: "absolute", inset: 0, zIndex: 10, backgroundColor: T.dark, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}><Ionicons name="camera-outline" size={42} color={T.white} /><Text style={{ color: T.white, fontSize: 22, fontWeight: "900", textAlign: "center" }}>Camera access helps save this moment</Text><Pressable onPress={() => void requestPermission()} style={{ borderRadius: 18, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: T.blue }}><Text style={{ color: T.white, fontWeight: "900" }}>Allow camera</Text></Pressable><Pressable onPress={onClose}><Text style={{ color: "#d7d0d2", fontWeight: "800" }}>Not now</Text></Pressable></View>;
  const capture = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.78 });
      if (photo?.uri) onCaptured(photo.uri);
    } finally { setCapturing(false); }
  };
  return <View style={{ position: "absolute", inset: 0, zIndex: 10, backgroundColor: T.dark }}><CameraView ref={camera} style={{ flex: 1 }} facing="back" /><View style={{ position: "absolute", top: 56, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: T.white, fontSize: 18, fontWeight: "900" }}>Quest memory</Text><Pressable onPress={onClose} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={22} color={T.dark} /></Pressable></View><View style={{ position: "absolute", bottom: 48, left: 0, right: 0, alignItems: "center" }}><Pressable onPress={() => void capture()} style={({ pressed }) => ({ width: 76, height: 76, borderRadius: 38, borderWidth: 6, borderColor: T.white, backgroundColor: pressed ? "#dfefff" : T.blue })}>{capturing ? <Ionicons name="hourglass" size={29} color={T.white} style={{ margin: 17 }} /> : null}</Pressable></View></View>;
}

function EntryPlaceholder({ quest, title, body, onChangeTitle, onChangeBody }: { quest: Quest; title: string; body: string; onChangeTitle: (value: string) => void; onChangeBody: (value: string) => void }) {
  return <View style={{ flex: 1, padding: 22, paddingBottom: 218, backgroundColor: T.white, gap: 10 }}>
    <TextInput value={title} onChangeText={onChangeTitle} placeholder={`Day 1: ${quest.title}`} placeholderTextColor="#8a8186" style={{ color: T.dark, fontSize: 24, lineHeight: 30, fontWeight: "900", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: T.border }} />
    <TextInput value={body} onChangeText={onChangeBody} multiline textAlignVertical="top" placeholder="Start writing..." placeholderTextColor="#9a9293" style={{ flex: 1, color: T.dark, fontSize: 16, lineHeight: 24, fontWeight: "600", paddingVertical: 8 }} />
    <Text style={{ paddingBottom: 218, color: T.muted, fontSize: 12, fontWeight: "700" }}>Saved on this device as you write.</Text>
  </View>;
}

function RoundAction({ icon, label, color, inverse = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; inverse?: boolean; onPress: () => void }) {
  return <View style={{ alignItems: "center", gap: 6 }}><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { haptic(); onPress(); }} style={({ pressed }) => ({ width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", backgroundColor: inverse ? T.white : color, borderWidth: inverse ? 2 : 0, borderColor: inverse ? color : "transparent", transform: [{ scale: pressed ? 0.94 : 1 }] })}><Ionicons name={icon} size={27} color={inverse ? color : T.white} /></Pressable><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900" }}>{label}</Text></View>;
}

export function ActiveQuestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { engine, refresh } = useQuestEngine();
  const { snapshot, trackingMessage, pause, resume, saveEntry, enableTracking, addPhoto, finishLocalQuest } = useActiveQuest();
  const { getQuest } = useContent();
  const [tab, setTab] = useState<ActiveQuestTab>("map");
  const [now, setNow] = useState(Date.now());
  const [completeVisible, setCompleteVisible] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoConfirmation, setPhotoConfirmation] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState<MapCoordinate | null>(null);
  const session = engine?.activeSession;
  const quest = getQuest(session?.questId);
  const accent = quest ? (categoryColor[quest.category]?.text ?? quest.color) : T.blue;
  const [entryTitle, setEntryTitle] = useState("");
  const [entryBody, setEntryBody] = useState("");
  const paused = snapshot?.session.recordingState === "paused";

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

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

  const resolveDeviceLocation = async () => {
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
  };

  useEffect(() => {
    if (tab === "map") void resolveDeviceLocation();
  }, [tab]);

  const duration = useMemo(() => snapshot ? formatDuration(snapshot.session.activeDurationMs, snapshot.session.activeSince) : "0:00", [now, snapshot]);

  if (!session || !quest) return <View style={{ flex: 1, paddingTop: insets.top + 24, backgroundColor: T.bg }}><EmptyState emoji="🧭" title="No active quest" body="Start a solo quest from Explore to create its live home." /></View>;

  const togglePaused = () => { void (paused ? resume() : pause()); };
  const enableRouteRecording = async () => {
    await enableTracking();
    await resolveDeviceLocation();
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
      {tab === "map" ? <LiveMap accent={accent} route={snapshot?.route ?? []} deviceLocation={deviceLocation} trackingStatus={snapshot?.session.trackingStatus ?? "idle"} trackingMessage={trackingMessage} onEnableTracking={() => void enableRouteRecording()} /> : tab === "album" ? <Album accent={accent} photos={snapshot?.photos ?? []} /> : <EntryPlaceholder quest={quest} title={entryTitle} body={entryBody} onChangeTitle={setEntryTitle} onChangeBody={setEntryBody} />}
    </View>
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, minHeight: insets.bottom + 202, paddingTop: 15, paddingBottom: Math.max(insets.bottom, 16), paddingHorizontal: 22, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: T.white, borderTopWidth: 1, borderColor: T.border, boxShadow: "0px -3px 12px rgba(61,52,56,0.08)", gap: 16 }}>
      <View style={{ alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: T.border }} />
      <View style={{ flexDirection: "row" }}><View style={{ flex: 1, alignItems: "center", gap: 3 }}><Text style={{ color: T.dark, fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{duration}</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>Time</Text></View><View style={{ flex: 1, alignItems: "center", gap: 3, borderLeftWidth: 1, borderLeftColor: T.border }}><Text style={{ color: T.dark, fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{snapshot?.photoCount ?? 0}</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>Photos</Text></View><View style={{ flex: 1, alignItems: "center", gap: 3, borderLeftWidth: 1, borderLeftColor: T.border }}><Text style={{ color: T.dark, fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{((snapshot?.session.distanceMeters ?? 0) / 1_000).toFixed(2)} km</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>Distance</Text></View></View>
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap: paused ? 34 : 62 }}>
        {paused ? <RoundAction icon="stop" label="End quest" color={T.red} onPress={() => setCompleteVisible(true)} /> : null}
        <RoundAction icon={paused ? "play" : "pause"} label={paused ? "Resume" : "Pause"} color={accent} onPress={togglePaused} />
        <RoundAction icon={photoConfirmation ? "checkmark" : "camera"} label={photoConfirmation ? "Saved" : "Take photo"} color={accent} inverse onPress={() => setCameraOpen(true)} />
      </View>
    </View>
    {cameraOpen ? <QuestCamera onClose={() => setCameraOpen(false)} onCaptured={(uri) => { void addPhoto(uri).then(() => { setCameraOpen(false); setTab("album"); setPhotoConfirmation(true); setTimeout(() => setPhotoConfirmation(false), 2_000); }); }} /> : null}
    <LogLoreFlow visible={completeVisible} quest={quest} initialReflection={snapshot?.session.entryBody ?? ""} photoUrls={(snapshot?.photos ?? []).flatMap((photo) => photo.remotePath ? [photo.remotePath] : [])} onClose={() => setCompleteVisible(false)} onFinished={async () => { await finishLocalQuest(); await refresh(); setCompleteVisible(false); router.replace("/(tabs)/journal"); }} />
  </View>;
}
