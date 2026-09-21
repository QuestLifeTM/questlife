import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Accelerometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { Easing, FadeInUp, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { T } from "@/components/theme";
import { haptic, Sheet } from "@/components/ui";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { engineErrorMessage } from "@/services/engine/questEngineService";
import { uploadJournalMedia } from "@/services/journal/journalService";
import { Quest } from "@/types/content";
import { CompletionResult } from "@/types/engine";

export type CompletionDestination = "journal" | "share";
export type CompletionShareDetails = { rating: number; duration: string };

function RatingStar({ rating, value, onPress }: { rating: number; value: number; onPress: () => void }) {
  const scale = useSharedValue(1);
  const fill = useSharedValue(value >= rating ? 1 : 0);
  const selected = value >= rating;
  useEffect(() => { fill.value = withDelay(selected ? (rating - 1) * 48 : 0, withTiming(selected ? 1 : 0, { duration: 160 })); }, [fill, rating, selected]);
  const starStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ translateX: -15.5 * (1 - fill.value) }, { scaleX: fill.value }] }));
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === rating }} accessibilityLabel={`${rating} star${rating === 1 ? "" : "s"}`} onPress={() => { haptic(); scale.value = withSequence(withTiming(1.15, { duration: 90 }), withSpring(1, { damping: 13, stiffness: 260 })); onPress(); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Animated.View style={[{ width: 31, height: 31, alignItems: "center", justifyContent: "center" }, starStyle]}><Ionicons name="star-outline" size={31} color={T.muted} style={{ position: "absolute" }} /><Animated.View pointerEvents="none" style={[{ position: "absolute", width: 31, height: 31 }, fillStyle]}><Ionicons name="star" size={31} color="#f6b90b" style={{ textShadowColor: "rgba(255, 191, 24, 0.9)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } }} /></Animated.View></Animated.View></Pressable>;
}

function RecapStat({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }) {
  return <View style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 4 }}><Ionicons name={icon} size={19} color={color} /><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] }} numberOfLines={1}>{value}</Text><Text style={{ color: T.muted, fontSize: 10, lineHeight: 13, fontWeight: "800" }} numberOfLines={1}>{label}</Text></View>;
}

function CompletionTrophy({ active }: { active: boolean }) {
  const reducedMotion = useReducedMotionPreference();
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const floatY = useSharedValue(0);
  const trophyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value + tiltY.value * 2 }, { rotate: `${tiltX.value * 2}deg` }] }));
  const shineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tiltX.value * 27 }, { translateY: tiltY.value * -19 }, { rotate: "-25deg" }], opacity: 0.5 + Math.abs(tiltX.value) * 0.3 }));

  useEffect(() => {
    if (!active || reducedMotion) {
      cancelAnimation(floatY);
      floatY.value = 0;
      tiltX.value = 0;
      tiltY.value = 0;
      return;
    }
    // A long, shallow drift feels celebratory without the springy "bouncing" motion.
    floatY.value = withRepeat(withSequence(withTiming(-4, { duration: 2100, easing: Easing.bezier(0.22, 1, 0.36, 1) }), withTiming(2, { duration: 2100, easing: Easing.bezier(0.64, 0, 0.78, 0) })), -1, true);
    let listening = true;
    let subscription: { remove: () => void } | undefined;
    let restingTilt: { x: number; y: number } | undefined;
    const beginTracking = async () => {
      try {
        if (!(await Accelerometer.isAvailableAsync()) || !listening) return;
        Accelerometer.setUpdateInterval(120);
        subscription = Accelerometer.addListener(({ x, y }) => {
          if (!restingTilt) restingTilt = { x, y };
          const clamp = (value: number) => Math.max(-1, Math.min(1, value));
          tiltX.value = withTiming(clamp((x - restingTilt.x) / 0.22), { duration: 240, easing: Easing.bezier(0.22, 1, 0.36, 1) });
          tiltY.value = withTiming(clamp((y - restingTilt.y) / 0.22), { duration: 240, easing: Easing.bezier(0.22, 1, 0.36, 1) });
        });
      } catch {
        // The badge keeps its floating state on simulators and devices without motion sensors.
      }
    };
    void beginTracking();
    return () => { listening = false; subscription?.remove(); };
  }, [active, floatY, reducedMotion, tiltX, tiltY]);

  const sparkle = (size: number, color: string, style: object) => <Ionicons pointerEvents="none" name="star" size={size} color={color} style={[{ position: "absolute" }, style]} />;
  return <View accessible accessibilityLabel="Quest completion trophy" style={{ width: 176, height: 140, alignItems: "center", justifyContent: "center" }}>
    <View pointerEvents="none" style={{ position: "absolute", width: 132, height: 108, borderRadius: 54, backgroundColor: "rgba(255, 181, 23, 0.13)", shadowColor: "#ffb317", shadowOpacity: 0.32, shadowRadius: 22, shadowOffset: { width: 0, height: 4 } }} />
    <View pointerEvents="none" style={{ position: "absolute", width: 114, height: 94, borderRadius: 47, backgroundColor: "rgba(255, 215, 103, 0.2)", shadowColor: "#ffbf26", shadowOpacity: 0.34, shadowRadius: 15, shadowOffset: { width: 0, height: 2 } }} />
    {sparkle(16, "#ffc13a", { top: 12, left: 9 })}
    {sparkle(21, "#ffbf24", { right: 7, bottom: 13 })}
    <View pointerEvents="none" style={{ position: "absolute", top: 73, left: 4, width: 20, height: 7, borderRadius: 99, backgroundColor: "#ffc64d", transform: [{ rotate: "20deg" }] }} />
    <View pointerEvents="none" style={{ position: "absolute", top: 40, right: 5, width: 20, height: 8, borderRadius: 99, backgroundColor: "#ffbd35", transform: [{ rotate: "-43deg" }] }} />
    <View pointerEvents="none" style={{ position: "absolute", top: 72, right: 8, width: 8, height: 8, borderRadius: 99, backgroundColor: "#77b98a" }} />
    <Animated.View style={trophyStyle}><LinearGradient colors={["#fff9e7", "#fff0bc"]} start={{ x: 0.12, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ width: 100, height: 100, borderRadius: 38, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 4, borderColor: "#ffdc83", shadowColor: "#ffb517", shadowOpacity: 0.3, shadowRadius: 13, shadowOffset: { width: 0, height: 4 } }}>
      <Ionicons name="trophy" size={53} color="#ffa70f" />
      <Ionicons pointerEvents="none" name="star" size={19} color={T.white} style={{ position: "absolute", top: 33 }} />
      {!reducedMotion ? <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 142, height: 138, left: -19, top: -16 }, shineStyle]}><LinearGradient colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0.55)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0)"]} locations={[0, 0.32, 0.5, 0.68, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} /></Animated.View> : null}
    </LinearGradient></Animated.View>
  </View>;
}

const CONFETTI = [
  { color: T.yellow, startX: -52, endX: -128, endY: 360, delay: 0, rotation: 310 },
  { color: T.pink, startX: -34, endX: -78, endY: 410, delay: 95, rotation: -250 },
  { color: T.blue, startX: -16, endX: -20, endY: 385, delay: 190, rotation: 340 },
  { color: T.green, startX: 8, endX: 36, endY: 430, delay: 55, rotation: -330 },
  { color: T.orange, startX: 26, endX: 88, endY: 350, delay: 140, rotation: 290 },
  { color: T.purple, startX: 48, endX: 136, endY: 410, delay: 235, rotation: -300 },
  { color: T.teal, startX: -68, endX: -166, endY: 326, delay: 285, rotation: 250 },
  { color: T.yellow, startX: 66, endX: 165, endY: 332, delay: 330, rotation: -275 },
] as const;

function ConfettiPiece({ piece, active, reducedMotion }: { piece: typeof CONFETTI[number]; active: boolean; reducedMotion: boolean }) {
  const x = useSharedValue<number>(piece.startX);
  const y = useSharedValue<number>(-34);
  const rotation = useSharedValue<number>(0);
  const opacity = useSharedValue<number>(0);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rotation.value}deg` }] }));
  useEffect(() => {
    if (!active || reducedMotion) return;
    x.value = piece.startX; y.value = -34; rotation.value = 0; opacity.value = 0;
    x.value = withDelay(piece.delay, withTiming(piece.endX, { duration: 1850, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
    y.value = withDelay(piece.delay, withTiming(piece.endY, { duration: 2100, easing: Easing.bezier(0.16, 0.84, 0.28, 1) }));
    rotation.value = withDelay(piece.delay, withTiming(piece.rotation, { duration: 1980, easing: Easing.linear }));
    opacity.value = withDelay(piece.delay, withSequence(withTiming(1, { duration: 170 }), withDelay(1500, withTiming(0, { duration: 360 }))));
  }, [active, piece, reducedMotion, opacity, rotation, x, y]);
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 2, left: "50%", width: 9, height: 16, borderRadius: 3, backgroundColor: piece.color }, style]} />;
}

function CompletionConfetti({ active }: { active: boolean }) {
  const reducedMotion = useReducedMotionPreference();
  if (reducedMotion) return null;
  return <View pointerEvents="none" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>{CONFETTI.map((piece, index) => <ConfettiPiece key={index} piece={piece} active={active} reducedMotion={reducedMotion} />)}</View>;
}

function QuestMoments({ photoUris, notes, questColor }: { photoUris: string[]; notes: string[]; questColor: string }) {
  if (!photoUris.length && !notes.length) return null;
  const photoSize = photoUris.length === 1 ? 240 : photoUris.length === 2 ? 136 : 86;
  return <View style={{ padding: 15, gap: 13, borderRadius: 16, backgroundColor: T.white, borderWidth: 1.5, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#e6ddd2" }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="images-outline" size={20} color={T.blue} />
        <Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16, lineHeight: 21 }}>Moments from your quest</Text>
      </View>
      {photoUris.length ? <Text style={{ color: T.muted, fontSize: 11, lineHeight: 15, fontWeight: "800" }}>{`${photoUris.length} photo${photoUris.length === 1 ? "" : "s"}`}</Text> : null}
    </View>
    {photoUris.length ? photoUris.length > 3 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 2 }}>
      {photoUris.map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} resizeMode="cover" style={{ width: photoSize, height: photoSize, borderRadius: 14, backgroundColor: T.border }} />)}
    </ScrollView> : <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      {photoUris.map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} resizeMode="cover" style={{ width: photoSize, height: photoSize, borderRadius: 14, backgroundColor: T.border }} />)}
    </View> : null}
    {notes.map((note, index) => <View key={`${note}-${index}`} style={{ padding: 13, borderRadius: 14, flexDirection: "row", gap: 9, backgroundColor: `${questColor}0d`, borderWidth: 1, borderColor: `${questColor}2b` }}>
      <Ionicons name="create-outline" size={18} color={questColor} />
      <Text style={{ flex: 1, color: T.dark, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>{note}</Text>
    </View>)}
  </View>;
}

function CompletionActionButton({ label, icon, inverse = false, onPress, disabled }: { label: string; icon?: keyof typeof Ionicons.glyphMap; inverse?: boolean; onPress: () => void; disabled: boolean }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={() => { haptic(); onPress(); }}
    style={({ pressed }) => ({
      minHeight: 58,
      paddingHorizontal: 18,
      borderRadius: 20,
      backgroundColor: inverse ? T.white : T.blue,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: icon ? 8 : 0,
      borderWidth: inverse ? 2 : 0,
      borderColor: inverse ? T.blue : "transparent",
      borderBottomWidth: pressed && !disabled ? (inverse ? 2 : 3) : (inverse ? 4 : 6),
      borderBottomColor: inverse ? "#258fd888" : "#258fd8",
      opacity: disabled ? 0.5 : 1,
      transform: [{ scale: pressed && !disabled ? 0.985 : 1 }]
    })}
  >
    {icon ? <Ionicons name={icon} size={18} color={inverse ? T.blue : T.white} /> : null}
    <Text style={{ color: inverse ? T.blue : T.white, fontFamily: "RubikBold", fontSize: 16, lineHeight: 22 }}>{label}</Text>
  </Pressable>;
}

/** The post-quest recap is intentionally a single decision point: save, or save then share. */
export function LogLoreFlow({ guestMode = false, visible, quest, onClose, onFinished, initialTitle, initialReflection = "", photoUris = [], duration, onSaveDraft }: { guestMode?: boolean; visible: boolean; quest: Quest | null; onClose: () => void; onFinished: (result: CompletionResult, destination: CompletionDestination, details: CompletionShareDetails) => void | Promise<void>; initialTitle?: string; initialReflection?: string; photoUris?: string[]; duration: string; onSaveDraft?: (draft: { title: string; body: string }) => Promise<void> }) {
  const { completeQuest } = useQuestEngine();
  const { refreshNotifications } = useNotifications();
  const { refresh: refreshStreaks } = useStreaks();
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedForOpen = useRef(false);
  const completionRef = useRef<CompletionResult | null>(null);
  const savingRef = useRef(false);
  useEffect(() => { if (!visible) { initializedForOpen.current = false; completionRef.current = null; savingRef.current = false; return; } if (initializedForOpen.current) return; initializedForOpen.current = true; setRating(0); setBusy(false); setError(null); }, [visible]);
  if (!quest) return null;
  const returnToQuest = () => { if (busy) return; Alert.alert("Keep doing this quest?", "Your timer, photos, and notes are still here whenever you are ready to finish.", [{ text: "Keep saving", style: "cancel" }, { text: "Return to quest", onPress: onClose }]); };
  const persistCompletion = async (selectedRating: number) => {
    if (completionRef.current) return completionRef.current;
    if (savingRef.current || !selectedRating) return null;
    savingRef.current = true;
    setBusy(true); setError(null);
    try {
      await onSaveDraft?.({ title: initialTitle?.trim() || quest.title, body: initialReflection });
      const safePhotoUris = Array.from(new Set(photoUris.filter((uri): uri is string => typeof uri === "string" && uri.trim().length > 0)));
      const journalPhotoPaths = guestMode ? [] : await Promise.all(safePhotoUris.map((uri) => uploadJournalMedia(uri)));
      const completion = guestMode ? { completionId: `guest-${Date.now()}`, xpAwarded: 0, dailyUsed: 0, dailyLimit: 5 } : await completeQuest({ questId: quest.id, logged: true, reflection: initialReflection.trim() || null, rating: selectedRating, review: null, reviewPublic: false, photoUrls: journalPhotoPaths });
      completionRef.current = completion;
      if (!guestMode) await Promise.allSettled([refreshNotifications(), refreshStreaks()]);
      return completion;
    } catch (nextError) { setError(engineErrorMessage(nextError)); return null; } finally { savingRef.current = false; setBusy(false); }
  };
  const finish = async (destination: CompletionDestination) => {
    const completion = completionRef.current ?? await persistCompletion(rating);
    if (!completion) { if (!rating) setError("Choose a star rating before continuing."); return; }
    setBusy(true); setError(null);
    try { await onFinished(completion, destination, { rating, duration }); } catch (nextError) { setError(engineErrorMessage(nextError)); setBusy(false); }
  };
  const notes = initialReflection.trim() ? [initialReflection.trim()] : [];
  return <Sheet visible={visible} onClose={returnToQuest} maxHeight="94%" fillHeight>
    <View style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 3, paddingBottom: 16, gap: 16 }}>
        <Animated.View entering={FadeInUp.duration(260)} style={{ alignItems: "center", gap: 7 }}>
          <CompletionTrophy active={visible} />
          <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 26, lineHeight: 32, textAlign: "center" }}>Quest completed</Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(45).duration(260)} style={{ alignItems: "center", gap: 3 }}>
          <Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12, lineHeight: 16 }}>Rate this quest</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 3 }}>{[1, 2, 3, 4, 5].map((value) => <RatingStar key={value} rating={value} value={rating} onPress={() => { if (busy) return; setRating(value); setError(null); }} />)}</View>
          {rating ? <Text style={{ color: T.orange, fontSize: 11, lineHeight: 15, fontWeight: "800" }}>{`${rating} of 5 stars`}</Text> : null}
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(85).duration(260)} style={{ overflow: "hidden", borderRadius: 21, backgroundColor: T.white, borderWidth: 1.5, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#e6ddd2" }}>
          <View style={{ padding: 15, gap: 14 }}>
            <Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 17, lineHeight: 22, textAlign: "center" }}>{quest.title}</Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <RecapStat icon="time-outline" label="time" value={duration} color={quest.color} /><View style={{ width: 1, height: 37, backgroundColor: T.border }} />
              <RecapStat icon="images-outline" label="photos" value={`${photoUris.length}`} color={T.blue} /><View style={{ width: 1, height: 37, backgroundColor: T.border }} />
              <RecapStat icon="document-text-outline" label="notes" value={`${notes.length}`} color={T.orange} /><View style={{ width: 1, height: 37, backgroundColor: T.border }} />
              <RecapStat icon="flash-outline" label="XP" value={`${quest.xp}`} color={T.yellow} />
            </View>
          </View>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(125).duration(260)}>
          <QuestMoments photoUris={photoUris.filter((uri): uri is string => typeof uri === "string" && uri.trim().length > 0)} notes={notes} questColor={quest.color} />
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(165).duration(260)} style={{ marginTop: "auto", paddingTop: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}><Ionicons name="checkmark-circle" size={18} color={T.green} /><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 13, lineHeight: 18 }}>{busy ? "Saving to your Journal…" : "Ready to save to your Journal"}</Text></View>
          {error ? <Text accessibilityRole="alert" style={{ color: T.red, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" }}>{error}</Text> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1.18 }}><CompletionActionButton label={busy ? "Saving..." : "Done"} icon="checkmark" inverse disabled={busy} onPress={() => void finish("journal")} /></View>
            {!guestMode ? <View style={{ flex: 1.82 }}><CompletionActionButton label={busy ? "Saving..." : "Share your adventure"} disabled={busy} onPress={() => void finish("share")} /></View> : null}
          </View>
          {!guestMode ? <Text style={{ color: T.muted, fontSize: 11, lineHeight: 15, fontWeight: "700", textAlign: "center" }}>You choose who sees it next.</Text> : null}
        </Animated.View>
      </ScrollView>
      <CompletionConfetti active={visible} />
    </View>
  </Sheet>;
}
