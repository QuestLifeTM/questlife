import { Pressable } from "@/components/raised-pressable";
import { T } from "./theme";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Image, KeyboardAvoidingView, Linking, Modal, FlatList, Text, View } from "react-native";
import { scheduleOnRN } from "react-native-worklets";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeOut, Easing, useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useResponsiveScreenLayout } from "@/lib/responsive";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { QuestVideo } from "./quest-video.ios";
import { SoftButton } from "./ui";

export type QuestCapture = { captureGroupId?: string; id: string; uri: string; kind: "photo" | "video"; durationSeconds?: number; mimeType: string };
export function QuestCamera({ accent, onClose, onSave, responseKind }: { responseKind?: "photo" | "video"; accent: string; onClose: () => void; onSave: (capture: QuestCapture, caption: string) => Promise<void> }) {
  const captureGroupId = useRef(Crypto.randomUUID()).current;
  const reduced = useReducedMotionPreference();
  const { contentWidth, height, insets } = useResponsiveScreenLayout(560);
  const camera = useRef<CameraView>(null);
  const dismissal = useSharedValue(0);
  const previewOpacity = useSharedValue(0);
  const dismissalStyle = useAnimatedStyle(() => ({ opacity: 1 - dismissal.get(), transform: [{ translateY: reduced ? 0 : dismissal.get() * 30 }] }));
  const previewStyle = useAnimatedStyle(() => ({ opacity: previewOpacity.get() }));
  const dismiss = () => { dismissal.set(withTiming(1, { duration: reduced ? 120 : 220 }, done => { if (done) scheduleOnRN(onClose); })); };
  const [permission, requestPermission] = useCameraPermissions();
  const [microphone, requestMicrophone] = useMicrophonePermissions();
  const [mode, setMode] = useState<"picture" | "video">(responseKind === "video" ? "video" : "picture");
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [capture, setCapture] = useState<QuestCapture | null>(null);
  const [captures, setCaptures] = useState<QuestCapture[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const savedIds = useRef(new Set<string>());
  const tileSize = (contentWidth - 44) / 2;
  useEffect(() => { if (capture) { setCaptures(items => [...items, capture]); setCapture(null); } }, [capture]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const recordingRef = useRef(false);
  const recordStarted = useRef(0);
  const mounted = useRef(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    void requestPermission().catch(() => setError("Camera access could not be requested. Try again."));
    const sub = AppState.addEventListener("change", state => {
      if (state !== "active" && recordingRef.current) camera.current?.stopRecording();
      setActive(state === "active");
      if (state !== "active") setSelectedVideo(null);
      if (state !== "active") setReady(false);
    });
    return () => { mounted.current = false; sub.remove(); camera.current?.stopRecording(); };
  }, []);
  useEffect(() => { previewOpacity.set(withTiming(ready ? 1 : 0, { duration: 160 })); }, [ready, previewOpacity]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds(Math.min(30, Math.floor((Date.now() - recordStarted.current) / 1000))), 250);
    return () => clearInterval(timer);
  }, [recording]);
  async function chooseMode(next: "picture" | "video") {
    if (lock.current || recording || next === mode) return;
    if (next === "video" && !microphone?.granted) {
      const result = await requestMicrophone();
      if (!result.granted) {
        Alert.alert("Video sound is off", "Allow microphone access in Settings, or record a silent video.", [
          { text: "Cancel", style: "cancel" },
          { text: "Settings", onPress: () => void Linking.openSettings() },
          { text: "Silent video", onPress: () => { setMuted(true); setReady(false); setMode("video"); } },
        ]);
        return;
      }
    }
    setMuted(false); setReady(false); setMode(next);
  }
  async function shutter() {
    if (recordingRef.current) { camera.current?.stopRecording(); return; }
    if (!ready || lock.current || !camera.current) return;
    if (mode === "video" && !microphone?.granted && !muted) {
      const result = await requestMicrophone();
      if (!result.granted) { Alert.alert("Video sound is off", "You can record a silent video.", [{ text: "Cancel", style: "cancel" }, { text: "Use silent video", onPress: () => setMuted(true) }]); return; }
    }
    lock.current = true; setBusy(true); setError(null);
    try {
      if (mode === "picture") {
        const photo = await camera.current.takePictureAsync({ quality: 0.8 });
        if (mounted.current && photo) setCapture({ id: Crypto.randomUUID(), kind: "photo", uri: photo.uri, mimeType: "image/jpeg" });
      } else {
        recordingRef.current = true; setRecording(true); recordStarted.current = Date.now(); setSeconds(0);
        const video = await camera.current.recordAsync({ maxDuration: 30, maxFileSize: 30 * 1024 * 1024 });
        if (mounted.current && video) setCapture({ id: Crypto.randomUUID(), kind: "video", uri: video.uri, mimeType: video.uri.endsWith(".mov") ? "video/quicktime" : "video/mp4", durationSeconds: Math.min(30, Math.max(0.1, (Date.now() - recordStarted.current) / 1000)) });
      }
    } catch { if (mounted.current) setError("Couldn’t capture this moment. Your quest is still running; try again."); }
    finally { lock.current = false; recordingRef.current = false; if (mounted.current) { setRecording(false); setBusy(false); } }
  }
  function close() {
    if (lock.current) return;
    if (captures.some(item => !savedIds.current.has(item.id))) Alert.alert("Discard unsaved moments?", "Your unsaved photos and videos will be discarded.", [{ text: "Keep capturing", style: "cancel" }, { text: "Discard", style: "destructive", onPress: dismiss }]);
    else dismiss();
  }
  async function save() {
    if (!captures.length || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { for (const item of captures) { if (savedIds.current.has(item.id)) continue; await onSave({ ...item, captureGroupId }, ""); savedIds.current.add(item.id); } dismiss(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your moment couldn’t save. Try again."); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  function removeCapture(item: QuestCapture) {
    if (lock.current || savedIds.current.has(item.id)) return;
    const media = item.kind === "photo" ? "photo" : "video";
    Alert.alert(`Remove ${media}?`, `This ${media} will be removed from this batch.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
        if (lock.current || savedIds.current.has(item.id)) return;
        setSelectedVideo(current => current === item.id ? null : current);
        setCaptures(items => items.filter(value => value.id !== item.id));
      } },
    ]);
  }
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={action} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: `${accent}14`, opacity: disabled ? 0.4 : 1 }}><Ionicons name={name} size={24} color={accent} /></Pressable>;
  return <Modal transparent animationType="none" presentationStyle="overFullScreen" onRequestClose={close}>
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[{ flex: 1, backgroundColor: "#12132466", justifyContent: "flex-end" }, dismissalStyle]}>
      <KeyboardAvoidingView behavior="padding" style={{ width: contentWidth, alignSelf: "center", maxHeight: height - insets.top - 12 }}>
        <Animated.View entering={reduced ? FadeIn.duration(120) : FadeInDown.duration(300).easing(Easing.bezier(0.23, 1, 0.32, 1))} style={{ borderTopLeftRadius: 34, borderTopRightRadius: 34, overflow: "hidden", backgroundColor: T.bg, paddingBottom: reviewing ? 0 : Math.max(insets.bottom, 18), ...(reviewing ? { height: height - insets.top - 12 } : {}) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
            {reviewing ? <Pressable accessibilityRole="button" accessibilityLabel="Close photo review" disabled={busy} onPress={close} style={{ minWidth: 48, minHeight: 48, justifyContent: "center" }}><Text style={{ color: accent, fontFamily: "RubikBold" }}>Close</Text></Pressable> : icon("chevron-down", "Close camera", close, busy)}
            <Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16 }}>{capture ? "Your quest moment" : recording ? `●  ${seconds}s / 30s` : "Capture a moment"}</Text>
            {reviewing ? <View style={{ width: 48 }} /> : icon("camera-reverse-outline", "Switch camera", () => { setReady(false); setFacing(f => f === "back" ? "front" : "back"); }, busy || Boolean(capture))}
          </View>
          {reviewing ? <>
            <FlatList
              key="capture-review"
              data={captures}
              numColumns={2}
              keyExtractor={item => item.id}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12, flexGrow: 1 }}
              columnWrapperStyle={{ gap: 12 }}
              initialNumToRender={8}
              windowSize={5}
              renderItem={({ item, index }) => <View style={{ width: tileSize, height: tileSize, borderRadius: 20, overflow: "hidden", backgroundColor: T.raised }}>
                {item.kind === "photo" ? <Image accessibilityLabel={`Captured photo ${index + 1}`} source={{ uri: item.uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> :
                  <Pressable accessibilityRole="button" accessibilityLabel={`Preview video ${index + 1}`} onPress={() => setSelectedVideo(item.id)} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="play-circle" size={48} color={accent} />
                    <Text style={{ color: T.muted, fontFamily: "Rubik", marginTop: 8 }}>{Math.ceil(item.durationSeconds ?? 0)}s</Text>
                  </Pressable>}
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.kind} ${index + 1}`} disabled={busy || savedIds.current.has(item.id)} onPress={() => removeCapture(item)} style={{ position: "absolute", top: 8, right: 8, width: 44, height: 44, borderRadius: 12, backgroundColor: T.white, borderWidth: 2, borderColor: accent, borderBottomWidth: 4, alignItems: "center", justifyContent: "center", opacity: busy || savedIds.current.has(item.id) ? 0.5 : 1 }}>
                  <Ionicons name="close" size={24} color={accent} />
                </Pressable>
              </View>}
              ListEmptyComponent={<View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}><Text style={{ color: T.muted, fontFamily: "Rubik", textAlign: "center" }}>No captures yet. Add more to capture a moment.</Text></View>}
            />
            <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 18), gap: 12, borderTopWidth: 1, borderTopColor: T.borderSubtle, backgroundColor: T.bg }}>
              {error ? <Text accessibilityRole="alert" style={{ color: T.red, fontFamily: "Rubik" }}>{error}</Text> : null}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <SoftButton label="Add more" color={accent} inverse disabled={busy} onPress={() => { setSelectedVideo(null); setReviewing(false); setReady(false); setError(null); }} style={{ flex: 1, paddingHorizontal: 8 }} />
                <SoftButton label={busy ? "Saving…" : "Save moment"} color={accent} disabled={busy || captures.length === 0} onPress={() => void save()} style={{ flex: 1.35, paddingHorizontal: 8 }} />
              </View>
            </View>
          </> : <FlatList key="capture-camera" data={[]} renderItem={() => null} ListHeaderComponent={<View style={{ gap: 14 }}>
            <View style={{ height: Math.min(height * 0.57, 580), borderRadius: 28, overflow: "hidden", backgroundColor: T.raised }}>
              {permission?.granted && active ? <Animated.View style={[{ flex: 1 }, previewStyle]}><CameraView key={`${mode}:${facing}`} ref={camera} mode={mode} facing={facing} mute={muted} videoQuality="720p" videoBitrate={4_000_000} onCameraReady={() => setReady(true)} onMountError={() => { setReady(false); setError("The camera couldn’t start. Close and try again."); }} style={{ flex: 1 }} /></Animated.View> : null}
              {!ready && <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
                {permission?.granted ? <ActivityIndicator color={accent} /> : <><Text style={{ color: T.dark, textAlign: "center", fontFamily: "Rubik" }}>Allow camera access to capture your quest.</Text><Pressable accessibilityRole="button" onPress={() => { if (permission?.canAskAgain) void requestPermission(); else void Linking.openSettings(); }} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: accent, fontFamily: "RubikBold" }}>Allow camera</Text></Pressable></>}
              </View>}
              <View style={{ position: "absolute", bottom: 16, left: 16, right: 16, gap: 16, alignItems: "center" }}>
                <View style={{ flexDirection: "row", borderRadius: 14, backgroundColor: T.white, borderWidth: 1, borderColor: T.border, paddingHorizontal: 12 }}>
                  {(["picture", "video"] as const).filter(value => !responseKind || value === (responseKind === "photo" ? "picture" : "video")).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value, disabled: busy }} disabled={busy} onPress={() => void chooseMode(value)} style={{ minHeight: 44, paddingHorizontal: 18, justifyContent: "center" }}><Text style={{ color: mode === value ? accent : T.muted, fontFamily: "RubikBold" }}>{value === "picture" ? "Photo" : "Video"}</Text></Pressable>)}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={recording ? "Stop recording" : mode === "picture" ? "Take photo" : "Record video"} disabled={!recording && (!ready || busy)} onPress={() => void shutter()} style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: accent, backgroundColor: T.white, padding: 5, opacity: !ready ? 0.4 : 1, alignItems: "center", justifyContent: "center" }}><View style={{ width: recording ? 30 : 60, height: recording ? 30 : 60, borderRadius: recording ? 8 : 30, backgroundColor: mode === "video" ? T.red : accent }} /></Pressable>
                {muted && mode === "video" ? <Text style={{ color: "white" }}>Silent video</Text> : null}
              </View>
            </View>
            {!reviewing && captures.length > 0 ? <Animated.View entering={reduced ? undefined : FadeIn.duration(180)}><Pressable accessibilityRole="button" disabled={busy} onPress={() => setReviewing(true)} style={{ minHeight: 52, borderRadius: 16, backgroundColor: accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: T.onAccent, fontFamily: "RubikBold" }}>Done · {captures.length} captured</Text></Pressable></Animated.View> : null}
            {error ? <Text accessibilityRole="alert" style={{ color: T.red, paddingHorizontal: 12 }}>{error}</Text> : null}
          </View>} contentContainerStyle={{ paddingHorizontal: 12, gap: 14, paddingBottom: 12 }} />}
        </Animated.View>
      </KeyboardAvoidingView>
      {reviewing && selectedVideo && active ? <Modal animationType="fade" onRequestClose={() => setSelectedVideo(null)}>
        <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: insets.top, paddingBottom: insets.bottom, justifyContent: "center" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close video preview" onPress={() => setSelectedVideo(null)} style={{ minHeight: 48, paddingHorizontal: 20, justifyContent: "center", alignSelf: "flex-end" }}><Text style={{ color: accent, fontFamily: "RubikBold" }}>Done</Text></Pressable>
          <View style={{ flex: 1, justifyContent: "center" }}>{captures.filter(item => item.id === selectedVideo).map(item => <QuestVideo key={item.id} uri={item.uri} />)}</View>
        </View>
      </Modal> : null}
    </Animated.View>
  </Modal>;
}
