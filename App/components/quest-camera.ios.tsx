import { T } from "./theme";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Image, KeyboardAvoidingView, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { scheduleOnRN } from "react-native-worklets";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeOut, Easing, useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useResponsiveScreenLayout } from "@/lib/responsive";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { QuestVideo } from "./quest-video.ios";

export type QuestCapture = { id: string; uri: string; kind: "photo" | "video"; durationSeconds?: number; mimeType: string };
export function QuestCamera({ accent, onClose, onSave }: { accent: string; onClose: () => void; onSave: (capture: QuestCapture, caption: string) => Promise<void> }) {
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
  const [mode, setMode] = useState<"picture" | "video">("picture");
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [capture, setCapture] = useState<QuestCapture | null>(null);
  const [caption, setCaption] = useState("");
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
    if (capture || caption) Alert.alert("Discard this moment?", "This capture has not been saved to your quest.", [{ text: "Keep editing", style: "cancel" }, { text: "Discard", style: "destructive", onPress: dismiss }]);
    else dismiss();
  }
  async function save() {
    if (!capture || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await onSave(capture, caption.trim()); dismiss(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your moment couldn’t save. Try again."); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={action} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: `${accent}14`, opacity: disabled ? 0.4 : 1 }}><Ionicons name={name} size={24} color={accent} /></Pressable>;
  return <Modal transparent animationType="none" presentationStyle="overFullScreen" onRequestClose={close}>
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[{ flex: 1, backgroundColor: "#12132466", justifyContent: "flex-end" }, dismissalStyle]}>
      <KeyboardAvoidingView behavior="padding" style={{ width: contentWidth, alignSelf: "center", maxHeight: height - insets.top - 12 }}>
        <Animated.View entering={reduced ? FadeIn.duration(120) : FadeInDown.duration(300).easing(Easing.bezier(0.23, 1, 0.32, 1))} style={{ borderTopLeftRadius: 34, borderTopRightRadius: 34, overflow: "hidden", backgroundColor: T.bg, paddingBottom: Math.max(insets.bottom, 18) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
            {icon("chevron-down", "Close camera", close, busy)}
            <Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16 }}>{capture ? "Your quest moment" : recording ? `●  ${seconds}s / 30s` : "Capture a moment"}</Text>
            {icon("camera-reverse-outline", "Switch camera", () => { setReady(false); setFacing(f => f === "back" ? "front" : "back"); }, busy || Boolean(capture))}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12, gap: 14, paddingBottom: 12 }}>
            {capture ? <>
              {capture.kind === "video" ? <QuestVideo uri={capture.uri} /> : <Image source={{ uri: capture.uri }} style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: 24 }} />}
              <TextInput accessibilityLabel="Moment caption" value={caption} onChangeText={setCaption} editable={!busy} maxLength={4000} multiline placeholder="What made this moment memorable?" placeholderTextColor={T.muted} style={{ color: T.dark, minHeight: 64, padding: 16, borderRadius: 18, backgroundColor: T.white, borderWidth: 1.5, borderColor: T.border, fontFamily: "Rubik" }} />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setCapture(null); setReady(false); setError(null); }} style={{ flex: 1, minHeight: 52, justifyContent: "center", alignItems: "center" }}><Text style={{ color: accent, fontFamily: "RubikBold" }}>Retake</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={{ flex: 2, minHeight: 52, borderRadius: 26, backgroundColor: accent, justifyContent: "center", alignItems: "center" }}><Text style={{ color: T.onAccent, fontFamily: "RubikBold" }}>{busy ? "Saving…" : "Save moment"}</Text></Pressable>
              </View>
            </> : <View style={{ height: Math.min(height * 0.57, 580), borderRadius: 28, overflow: "hidden", backgroundColor: T.raised }}>
              {permission?.granted && active ? <Animated.View style={[{ flex: 1 }, previewStyle]}><CameraView key={`${mode}:${facing}`} ref={camera} mode={mode} facing={facing} mute={muted} videoQuality="720p" videoBitrate={4_000_000} onCameraReady={() => setReady(true)} onMountError={() => { setReady(false); setError("The camera couldn’t start. Close and try again."); }} style={{ flex: 1 }} /></Animated.View> : null}
              {!ready && <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
                {permission?.granted ? <ActivityIndicator color={accent} /> : <><Text style={{ color: T.dark, textAlign: "center", fontFamily: "Rubik" }}>Allow camera access to capture your quest.</Text><Pressable accessibilityRole="button" onPress={() => { if (permission?.canAskAgain) void requestPermission(); else void Linking.openSettings(); }} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: accent, fontFamily: "RubikBold" }}>Allow camera</Text></Pressable></>}
              </View>}
              <View style={{ position: "absolute", bottom: 16, left: 16, right: 16, gap: 16, alignItems: "center" }}>
                <View style={{ flexDirection: "row", borderRadius: 24, backgroundColor: T.white, borderWidth: 1, borderColor: T.border, paddingHorizontal: 12 }}>
                  {(["picture", "video"] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value, disabled: busy }} disabled={busy} onPress={() => void chooseMode(value)} style={{ minHeight: 44, paddingHorizontal: 18, justifyContent: "center" }}><Text style={{ color: mode === value ? accent : T.muted, fontFamily: "RubikBold" }}>{value === "picture" ? "Photo" : "Video"}</Text></Pressable>)}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={recording ? "Stop recording" : mode === "picture" ? "Take photo" : "Record video"} disabled={!recording && (!ready || busy)} onPress={() => void shutter()} style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: accent, backgroundColor: T.white, padding: 5, opacity: !ready ? 0.4 : 1, alignItems: "center", justifyContent: "center" }}><View style={{ width: recording ? 30 : 60, height: recording ? 30 : 60, borderRadius: recording ? 8 : 30, backgroundColor: mode === "video" ? T.red : accent }} /></Pressable>
                {muted && mode === "video" ? <Text style={{ color: "white" }}>Silent video</Text> : null}
              </View>
            </View>}
            {error ? <Text accessibilityRole="alert" style={{ color: T.red, paddingHorizontal: 12 }}>{error}</Text> : null}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  </Modal>;
}
