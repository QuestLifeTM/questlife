import { useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { CachedImage } from "./cached-image";
import { QuestVideo } from "./quest-video.ios";
import { SoftButton } from "./ui";
import { T } from "./theme";
import type { JourneyEvent } from "@/services/active-quest/journey-model";

type Icon = keyof typeof Ionicons.glyphMap;

/** A stable, compact surface for both empty and genuinely loading sections. */
export function QuestSectionPlaceholder({ accent, icon, title, detail, loading = false }: {
  accent: string; icon: Icon; title: string; detail: string; loading?: boolean;
}) {
  return <View accessibilityLabel={loading ? `Loading ${title.toLowerCase()}` : undefined} accessibilityState={{ busy: loading }} style={{ minHeight: 98, padding: 16, gap: 14, flexDirection: "row", alignItems: "center", borderRadius: 20, borderWidth: 1, borderColor: T.border, backgroundColor: T.raised }}>
    <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: `${accent}14`, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={22} color={accent} /></View>
    {loading ? <View accessible={false} style={{ flex: 1, gap: 10 }}><View style={{ width: "60%", height: 14, borderRadius: 7, backgroundColor: T.border }} /><View style={{ width: "95%", height: 10, borderRadius: 5, backgroundColor: T.border, opacity: 0.55 }} /><View style={{ width: "76%", height: 10, borderRadius: 5, backgroundColor: T.border, opacity: 0.55 }} /></View> : <View style={{ flex: 1, gap: 5 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15 }}>{title}</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 13, lineHeight: 19 }}>{detail}</Text></View>}
  </View>;
}

/** Drag reveals intent immediately; releasing past the threshold commits once. */
export function QuestNotification({ title, detail, icon, accent, onOpen, onDismiss, countdown }: {
  title: string; detail: string; countdown?: string; icon: Icon; accent: string; onOpen: () => void; onDismiss: () => Promise<void>;
}) {
  const reduced = useReducedMotionPreference();
  const x = useSharedValue(0);
  const width = useSharedValue(320);
  const origin = useSharedValue(0);
  const busy = useSharedValue(false);
  const actionPending = useRef(false);
  const [pending, setPending] = useState(false);
  const settle = () => { x.set(withTiming(0, { duration: reduced ? 0 : 160, easing: Easing.bezier(0.23, 1, 0.32, 1) })); };
  async function commit(dismiss: boolean) {
    if (actionPending.current) return;
    actionPending.current = true;
    setPending(true);
    try { if (dismiss) await onDismiss(); else onOpen(); }
    finally { settle(); busy.set(false); actionPending.current = false; setPending(false); }
  }
  const pan = Gesture.Pan().activeOffsetX([-12, 12]).failOffsetY([-12, 12])
    .onStart(() => { origin.set(x.get()); })
    .onUpdate(event => { if (!busy.get()) x.set(Math.max(-width.get(), Math.min(width.get(), origin.get() + event.translationX))); })
    .onEnd(event => {
      if (busy.get()) return;
      const threshold = Math.min(110, Math.max(72, width.get() * 0.28));
      const distance = x.get();
      const projected = distance + event.velocityX * 0.08;
      if (Math.abs(distance) >= 36 && Math.abs(projected) >= threshold && Math.sign(projected) === Math.sign(distance)) {
        busy.set(true);
        scheduleOnRN(commit, distance < 0);
      } else x.set(withTiming(0, { duration: reduced ? 0 : 160, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    })
    .onFinalize(() => { if (!busy.get()) x.set(withTiming(0, { duration: reduced ? 0 : 160 })); });
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const openReveal = useAnimatedStyle(() => ({ opacity: x.get() > 0 ? 1 : 0 }));
  const dismissReveal = useAnimatedStyle(() => ({ opacity: x.get() < 0 ? 1 : 0 }));
  return <View onLayout={event => width.set(event.nativeEvent.layout.width)} style={{ borderRadius: 20, overflow: "hidden" }}>
    <Animated.View accessible={false} style={[{ position: "absolute", inset: 0, backgroundColor: accent, justifyContent: "center", paddingHorizontal: 20 }, openReveal]}><Ionicons name={icon} color={T.onAccent} size={25} /><Text style={{ color: T.onAccent, fontFamily: "RubikBold", fontSize: 11, marginTop: 4 }}>Open</Text></Animated.View>
    <Animated.View accessible={false} style={[{ position: "absolute", inset: 0, backgroundColor: T.red, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 20 }, dismissReveal]}><Ionicons name="trash-outline" color={T.onAccent} size={25} /><Text style={{ color: T.onAccent, fontFamily: "RubikBold", fontSize: 11, marginTop: 4 }}>Dismiss</Text></Animated.View>
    <GestureDetector gesture={pan}><Animated.View style={slide}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} accessibilityHint="Swipe right to open or left to dismiss this suggestion." accessibilityState={{ disabled: pending }} accessibilityActions={[{ name: "activate", label: "Open" }, { name: "dismiss", label: "Dismiss notification" }]} onAccessibilityAction={event => { void commit(event.nativeEvent.actionName === "dismiss"); }} disabled={pending} onPress={() => void commit(false)} style={({ pressed }) => ({ minHeight: 72, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.raised, borderWidth: 1.5, borderColor: `${accent}40`, borderRadius: 20, opacity: pressed ? 0.85 : 1 })}>
        <Ionicons name={icon} size={25} color={accent} /><View style={{ flex: 1, gap: 4 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15 }}>{title}</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 13, lineHeight: 18 }}>{detail}</Text>{countdown ? <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, backgroundColor: `${accent}14`, paddingHorizontal: 8, paddingVertical: 4 }}><Ionicons name="time-outline" size={12} color={accent} /><Text accessibilityLabel={`Expires in ${countdown}`} style={{ color: accent, fontFamily: "RubikBold", fontSize: 11, fontVariant: ["tabular-nums"] }}>{countdown} left</Text></View> : null}</View><Ionicons name="arrow-forward" size={19} color={accent} />
      </Pressable>
    </Animated.View></GestureDetector>
  </View>;
}

export function QuestVideoMoment({ event, accent, tile = false }: { event: JourneyEvent; accent: string; tile?: boolean }) {
  const [playing, setPlaying] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Play video, ${Math.ceil(event.durationSeconds ?? 0)} seconds`} disabled={!event.uri} onPress={() => setPlaying(true)} style={{ width: tile ? 124 : "100%", height: tile ? 124 : undefined, aspectRatio: tile ? undefined : 1.4, borderRadius: 17, overflow: "hidden", backgroundColor: `${accent}14`, alignItems: "center", justifyContent: "center" }}>
      {event.thumbnailUri ? <CachedImage uri={event.thumbnailUri} style={{ position: "absolute", width: "100%", height: "100%" }} /> : <Ionicons name="videocam-outline" size={32} color={accent} />}
      <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.08)" }}><View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}><Ionicons name="play" size={19} color="#ffffff" /></View></View>
      <Text style={{ position: "absolute", right: 7, bottom: 7, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.65)", color: "#ffffff", fontFamily: "RubikBold", fontSize: 11 }}>{event.uri ? `${Math.ceil(event.durationSeconds ?? 0)}s` : "Unavailable"}</Text>
    </Pressable>
    {playing && event.uri ? <Modal presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setPlaying(false)}><View style={{ flex: 1, padding: 24, paddingTop: 48, justifyContent: "center", backgroundColor: T.bg, gap: 20 }}><QuestVideo uri={event.uri} /><SoftButton label="Done" color={accent} onPress={() => setPlaying(false)} /></View></Modal> : null}
  </>;
}
