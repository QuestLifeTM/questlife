import { Ionicons } from "@expo/vector-icons";
import type { AudioPlayer } from "expo-audio";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Accelerometer } from "expo-sensors";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, Vibration, View } from "react-native";
import Animated, { Easing, FadeInUp, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { categoryColor, difficultyColor, T } from "@/components/theme";
import { haptic, Sheet, Tag } from "@/components/ui";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { engineErrorMessage, rateQuestCompletion } from "@/services/engine/questEngineService";
import { uploadJournalMedia } from "@/services/journal/journalService";
import { isHapticFeedbackEnabled } from "@/services/settings/settingsService";
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
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === rating }} accessibilityLabel={`${rating} star${rating === 1 ? "" : "s"}`} onPress={() => { scale.value = withSequence(withTiming(1.15, { duration: 90 }), withSpring(1, { damping: 13, stiffness: 260 })); onPress(); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Animated.View style={[{ width: 31, height: 31, alignItems: "center", justifyContent: "center" }, starStyle]}><Ionicons name="star-outline" size={31} color={T.muted} style={{ position: "absolute" }} /><Animated.View pointerEvents="none" style={[{ position: "absolute", width: 31, height: 31 }, fillStyle]}><Ionicons name="star" size={31} color="#f6b90b" style={{ textShadowColor: "rgba(255, 191, 24, 0.9)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } }} /></Animated.View></Animated.View></Pressable>;
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
    {sparkle(9, "#ffe58a", { top: 1, right: 43 })}
    {sparkle(12, "#ffc13a", { top: 29, left: 0 })}
    {sparkle(10, "#ffe58a", { top: 55, right: 1 })}
    {sparkle(21, "#ffbf24", { right: 7, bottom: 13 })}
    {sparkle(11, "#ffc13a", { left: 29, bottom: 2 })}
    <View pointerEvents="none" style={{ position: "absolute", top: 73, left: 4, width: 20, height: 7, borderRadius: 99, backgroundColor: "#ffc64d", transform: [{ rotate: "20deg" }] }} />
    <View pointerEvents="none" style={{ position: "absolute", top: 40, right: 5, width: 20, height: 8, borderRadius: 99, backgroundColor: "#ffbd35", transform: [{ rotate: "-43deg" }] }} />
    <View pointerEvents="none" style={{ position: "absolute", top: 72, right: 8, width: 8, height: 8, borderRadius: 99, backgroundColor: "#ffe58a" }} />
    <View pointerEvents="none" style={{ position: "absolute", top: 23, right: 23, width: 6, height: 6, borderRadius: 99, backgroundColor: "#ffbf24" }} />
    <View pointerEvents="none" style={{ position: "absolute", bottom: 26, left: 13, width: 5, height: 5, borderRadius: 99, backgroundColor: "#ffc13a" }} />
    <Animated.View style={trophyStyle}><LinearGradient colors={["#fff9e7", "#fff0bc"]} start={{ x: 0.12, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ width: 100, height: 100, borderRadius: 38, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 4, borderColor: "#ffdc83", shadowColor: "#ffb517", shadowOpacity: 0.3, shadowRadius: 13, shadowOffset: { width: 0, height: 4 } }}>
      <Ionicons name="trophy" size={53} color="#ffa70f" />
      <Ionicons pointerEvents="none" name="star" size={19} color={T.white} style={{ position: "absolute", top: 33 }} />
      {!reducedMotion ? <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 142, height: 138, left: -19, top: -16 }, shineStyle]}><LinearGradient colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0.55)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0)"]} locations={[0, 0.32, 0.5, 0.68, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} /></Animated.View> : null}
    </LinearGradient></Animated.View>
  </View>;
}

type ConfettiSymbol = "streamer" | "star" | "party" | "cheer";
type ConfettiPieceConfig = {
  color: string;
  kind: "rain" | "cannon";
  cannonSide?: "left" | "right";
  startX: number;
  endX: number;
  peakY: number;
  endY: number;
  delay: number;
  rotation: number;
  symbol: ConfettiSymbol;
};

const confettiColors = [T.yellow, T.pink, T.blue, T.green, T.orange, T.purple, T.teal];
const confettiSymbols: ConfettiSymbol[] = ["streamer", "streamer", "star", "streamer", "party", "streamer", "star", "cheer"];

const CANNON_CONFETTI: ConfettiPieceConfig[] = (["right", "left"] as const).flatMap((cannonSide) => Array.from({ length: 18 }, (_, index) => {
  const fromRight = cannonSide === "right";
  return {
    color: confettiColors[index % confettiColors.length],
    kind: "cannon",
    cannonSide,
    startX: 0,
    // Each cannon covers the middle and both outer edges as its burst falls.
    endX: (fromRight ? -1 : 1) * (110 + (index % 6) * 50),
    peakY: -(255 + (index % 5) * 18),
    endY: 250 + (index % 6) * 62,
    // Both cannons fire as one coordinated burst.
    delay: 0,
    rotation: (fromRight ? -1 : 1) * (350 + (index % 6) * 34),
    symbol: confettiSymbols[index % confettiSymbols.length],
  };
}));

const CONFETTI = CANNON_CONFETTI;

function ConfettiPiece({ piece, active, reducedMotion, originPercent }: { piece: ConfettiPieceConfig; active: boolean; reducedMotion: boolean; originPercent: number }) {
  const x = useSharedValue<number>(0);
  const y = useSharedValue<number>(0);
  const rotation = useSharedValue<number>(0);
  const opacity = useSharedValue<number>(0);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rotation.value}deg` }] }));
  useEffect(() => {
    if (!active || reducedMotion) return;
    x.value = 0; y.value = 0; rotation.value = 0; opacity.value = 0;
    x.value = withDelay(piece.delay, withTiming(piece.endX, { duration: piece.kind === "cannon" ? 2000 : 2800, easing: Easing.out(Easing.quad) }));
    y.value = withDelay(piece.delay, piece.kind === "cannon"
      ? withSequence(withTiming(piece.peakY, { duration: 300, easing: Easing.out(Easing.quad) }), withTiming(piece.endY, { duration: 1700, easing: Easing.in(Easing.quad) }))
      : withTiming(piece.endY, { duration: 2800, easing: Easing.in(Easing.quad) }));
    rotation.value = withDelay(piece.delay, withTiming(piece.rotation, { duration: piece.kind === "cannon" ? 2000 : 2800, easing: Easing.linear }));
    opacity.value = withDelay(piece.delay, withSequence(withTiming(1, { duration: 100 }), withDelay(piece.kind === "cannon" ? 1550 : 2320, withTiming(0, { duration: 380 }))));
  }, [active, piece, reducedMotion, opacity, rotation, x, y]);
  const symbol = piece.symbol === "star" ? "★" : piece.symbol === "party" ? "🎉" : piece.symbol === "cheer" ? "🙌" : null;
  const cannonPosition = piece.cannonSide === "right" ? { right: -12 } : { left: -12 };
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", top: piece.kind === "cannon" ? 315 + (originPercent % 4) * 15 : -28, left: piece.kind === "rain" ? `${piece.startX}%` : undefined, width: symbol ? 30 : 8, height: symbol ? 30 : 21, borderRadius: 4, backgroundColor: symbol ? "transparent" : piece.color, alignItems: "center", justifyContent: "center" }, piece.kind === "cannon" ? cannonPosition : undefined, style]}>{symbol ? <Text style={{ color: piece.symbol === "star" ? piece.color : undefined, fontSize: piece.symbol === "star" ? 28 : 24, lineHeight: 30 }}>{symbol}</Text> : null}</Animated.View>;
}

function CompletionConfetti({ active }: { active: boolean }) {
  const reducedMotion = useReducedMotionPreference();
  if (reducedMotion) return null;
  return <View pointerEvents="none" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>{CONFETTI.map((piece, index) => <ConfettiPiece key={index} piece={piece} originPercent={(index / (CONFETTI.length - 1)) * 100} active={active} reducedMotion={reducedMotion} />)}</View>;
}

function QuestMoments({ photoUris, notes, questColor }: { photoUris: string[]; notes: string[]; questColor: string }) {
  if (!photoUris.length && !notes.length) return null;
  // Keep every moment equally weighted: a single photo should not grow into a
  // different layout, and up to three photos stay centered as one tidy row.
  const photoSize = 96;
  return <View style={{ padding: 15, gap: 13, borderRadius: 16, backgroundColor: T.white, borderWidth: 1.5, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#e6ddd2" }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="images-outline" size={20} color={T.blue} />
        <Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 16, lineHeight: 21 }}>Moments from your quest</Text>
      </View>
      {photoUris.length ? <Text style={{ color: T.muted, fontSize: 11, lineHeight: 15, fontWeight: "800" }}>{`${photoUris.length} photo${photoUris.length === 1 ? "" : "s"}`}</Text> : null}
    </View>
    {photoUris.length ? photoUris.length > 3 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
      {photoUris.map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} resizeMode="cover" style={{ width: photoSize, height: photoSize, borderRadius: 14, backgroundColor: T.border }} />)}
    </ScrollView> : <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
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

/** A completed quest is committed before this recap is shown, so this sheet is read-only. */
export function LogLoreFlow({ guestMode = false, visible, quest, onFinished, initialTitle, initialReflection = "", photoUris = [], duration, onSaveDraft }: { guestMode?: boolean; visible: boolean; quest: Quest | null; onFinished: (result: CompletionResult, destination: CompletionDestination, details: CompletionShareDetails) => void | Promise<void>; initialTitle?: string; initialReflection?: string; photoUris?: string[]; duration: string; onSaveDraft?: (draft: { title: string; body: string }) => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const { completeQuest } = useQuestEngine();
  const { refreshNotifications } = useNotifications();
  const { refresh: refreshStreaks } = useStreaks();
  const [rating, setRating] = useState(0);
  const [ratingError, setRatingError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrationStarted, setCelebrationStarted] = useState(false);
  const rewardPlayerRef = useRef<AudioPlayer | null>(null);
  const ratingPlayerRef = useRef<AudioPlayer | null>(null);
  const rewardFadeStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardFadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedForOpen = useRef(false);
  const completionRef = useRef<CompletionResult | null>(null);
  const savingRef = useRef(false);
  const ratingWobble = useSharedValue(0);
  const reducedMotion = useReducedMotionPreference();
  const ratingWobbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: ratingWobble.value }] }));
  useEffect(() => {
    if (!visible) { initializedForOpen.current = false; completionRef.current = null; savingRef.current = false; setCelebrationStarted(false); return; }
    if (initializedForOpen.current) return;
    initializedForOpen.current = true;
    setRating(0); setRatingError(false); setBusy(false); setError(null); setCelebrationStarted(false);
    // End quest immediately creates the durable Journal memory. The screen
    // remains locked until the owner chooses a rating and leaves intentionally.
    void persistCompletion();
  }, [visible]);
  useEffect(() => {
    if (!celebrationStarted || !isHapticFeedbackEnabled()) return;

    // The reward feedback starts only after the sheet has visibly landed.
    Vibration.vibrate(500);
    return () => {
      Vibration.cancel();
    };
  }, [celebrationStarted]);
  useEffect(() => () => {
    if (rewardFadeStartRef.current) clearTimeout(rewardFadeStartRef.current);
    if (rewardFadeIntervalRef.current) clearInterval(rewardFadeIntervalRef.current);
    rewardPlayerRef.current?.release();
    ratingPlayerRef.current?.release();
  }, []);
  const beginCelebration = useCallback(() => {
    setCelebrationStarted(true);
    try {
      // The import remains deferred so an older Expo client can still render
      // the screen; current Expo clients play the bundled reward fanfare.
      const { createAudioPlayer } = require("expo-audio") as typeof import("expo-audio");
      rewardPlayerRef.current?.release();
      const player = createAudioPlayer(require("@/assets/sounds/Quest-completition-sfx.mp3"));
      rewardPlayerRef.current = player;
      player.volume = 1;
      player.play();
      // End two seconds before the asset ends, fading instead of cutting off.
      const scheduleFade = (attempt = 0) => {
        if (rewardPlayerRef.current !== player) return;
        if (player.duration <= 0 && attempt < 12) {
          rewardFadeStartRef.current = setTimeout(() => scheduleFade(attempt + 1), 150);
          return;
        }
        if (player.duration <= 0) return;
        rewardFadeStartRef.current = setTimeout(() => {
          let step = 0;
          rewardFadeIntervalRef.current = setInterval(() => {
            step += 1;
            player.volume = Math.max(0, 1 - step / 8);
            if (step >= 8) {
              if (rewardFadeIntervalRef.current) clearInterval(rewardFadeIntervalRef.current);
              rewardFadeIntervalRef.current = null;
              player.pause();
            }
          }, 62);
        }, Math.max(0, (player.duration - 2.5) * 1000));
      };
      scheduleFade();
    } catch {
      // Leave the visual completion feedback intact if the running client is
      // older than the app's Expo audio runtime.
    }
  }, []);
  const playRatingFeedback = useCallback(() => {
    haptic();
    try {
      const { createAudioPlayer } = require("expo-audio") as typeof import("expo-audio");
      ratingPlayerRef.current?.release();
      const player = createAudioPlayer(require("@/assets/sounds/rating-sfx.mp3"));
      ratingPlayerRef.current = player;
      player.volume = 0.72;
      player.play();
    } catch {
      // Keep star selection functional even on a runtime without the optional clip.
    }
  }, []);
  if (!quest) return null;
  const persistCompletion = async () => {
    if (completionRef.current) return completionRef.current;
    if (savingRef.current) return null;
    savingRef.current = true;
    setBusy(true); setError(null);
    try {
      await onSaveDraft?.({ title: initialTitle?.trim() || quest.title, body: initialReflection });
      const safePhotoUris = Array.from(new Set(photoUris.filter((uri): uri is string => typeof uri === "string" && uri.trim().length > 0)));
      // One unavailable image must never discard the completed quest or the
      // other photos. The local capture remains available for a later retry.
      const uploadedPhotos = guestMode ? [] : await Promise.allSettled(safePhotoUris.map((uri) => uploadJournalMedia(uri)));
      const journalPhotoPaths = uploadedPhotos.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const completion = guestMode ? { completionId: `guest-${Date.now()}`, xpAwarded: 0, dailyUsed: 0, dailyLimit: 5 } : await completeQuest({ questId: quest.id, logged: false, reflection: initialReflection.trim() || null, rating: null, review: null, reviewPublic: false, photoUrls: journalPhotoPaths });
      completionRef.current = completion;
      if (!guestMode) await Promise.allSettled([refreshNotifications(), refreshStreaks()]);
      return completion;
    } catch (nextError) { setError(engineErrorMessage(nextError)); return null; } finally { savingRef.current = false; setBusy(false); }
  };
  const finish = async (destination: CompletionDestination) => {
    if (!rating) {
      setRatingError(true);
      if (!reducedMotion) ratingWobble.value = withSequence(withTiming(-9, { duration: 55 }), withTiming(9, { duration: 70 }), withTiming(-6, { duration: 60 }), withTiming(0, { duration: 55 }));
      return;
    }
    const completion = completionRef.current ?? await persistCompletion();
    if (!completion) return;
    setBusy(true); setError(null);
    try {
      if (!guestMode) await rateQuestCompletion(completion.completionId, rating);
      await onFinished(completion, destination, { rating, duration });
    } catch (nextError) { setError(engineErrorMessage(nextError)); setBusy(false); }
  };
  const notes = initialReflection.trim() ? [initialReflection.trim()] : [];
  const validPhotoUris = photoUris.filter((uri): uri is string => typeof uri === "string" && uri.trim().length > 0);
  const hasPhotos = validPhotoUris.length > 0;
  const category = categoryColor[quest.category] ?? { text: quest.color, bg: `${quest.color}18` };
  const difficulty = difficultyColor[quest.difficulty];
  return <Sheet visible={visible} onClose={() => undefined} fillHeight fullScreen dismissible={false} celebrationEntrance onCelebrationSettled={beginCelebration}>
    <View style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 3, paddingBottom: 196 + insets.bottom, gap: 16 }}>
        <Animated.View entering={FadeInUp.duration(260)} style={{ alignItems: "center", gap: 7 }}>
          <CompletionTrophy active={visible} />
          <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 26, lineHeight: 32, textAlign: "center" }}>Quest completed</Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(45).duration(260)} style={[{ alignItems: "center", gap: 3, marginTop: 4 }, ratingWobbleStyle]}>
          <Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12, lineHeight: 16 }}>Rate this quest</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 3 }}>{[1, 2, 3, 4, 5].map((value) => <RatingStar key={value} rating={value} value={rating} onPress={() => { if (busy) return; playRatingFeedback(); setRating(value); setRatingError(false); setError(null); }} />)}</View>
          {ratingError ? <Text accessibilityRole="alert" style={{ color: T.red, fontFamily: "RubikBold", fontSize: 12, lineHeight: 17 }}>Please rate this quest to continue.</Text> : null}
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(85).duration(260)} style={{ overflow: "hidden", borderRadius: 21, backgroundColor: T.white, borderWidth: 1.5, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#e6ddd2", marginTop: 8 }}>
          <View style={{ flexDirection: "row", flex: 1 }}>
          <View style={{ width: 5, backgroundColor: quest.color }} />
          <View style={{ flex: 1, padding: 15, gap: 12 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}><Tag label={quest.category} color={category.text} bg={category.bg} /><Tag label={quest.difficulty} color={difficulty.text} bg={difficulty.bg} /></View>
            <View style={{ gap: 5 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 19, lineHeight: 24 }}>{quest.title}</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 13, lineHeight: 19 }}>{quest.description}</Text></View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <RecapStat icon="time-outline" label="time" value={duration} color={quest.color} /><View style={{ width: 1, height: 37, backgroundColor: T.border }} />
              <RecapStat icon="images-outline" label="photos" value={`${photoUris.length}`} color={T.blue} /><View style={{ width: 1, height: 37, backgroundColor: T.border }} />
              <RecapStat icon="document-text-outline" label="notes" value={`${notes.length}`} color={T.orange} /><View style={{ width: 1, height: 37, backgroundColor: T.border }} />
              <RecapStat icon="flash-outline" label="XP" value={`${quest.xp}`} color={T.yellow} />
            </View>
          </View>
          </View>
        </Animated.View>
        {hasPhotos || notes.length ? <Animated.View entering={FadeInUp.delay(125).duration(260)}>
          <QuestMoments photoUris={validPhotoUris} notes={notes} questColor={quest.color} />
        </Animated.View> : null}
      </ScrollView>
      <Animated.View entering={FadeInUp.delay(165).duration(260)} style={{ position: "absolute", bottom: 0, left: 0, right: 0, overflow: "hidden", paddingHorizontal: 24, paddingTop: 20, paddingBottom: Math.max(insets.bottom, 16), gap: 10 }}>
        <BlurView pointerEvents="none" tint="light" intensity={16} style={{ position: "absolute", inset: 0 }} />
        <View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255,252,248,0.36)" }} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}><Ionicons name={busy ? "sync" : error ? "alert-circle" : completionRef.current ? "checkmark-circle" : "star-outline"} size={18} color={busy ? T.blue : error ? T.red : completionRef.current ? T.green : T.dark} /><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 13, lineHeight: 18 }}>{busy ? "Saving to your Journal…" : error ? "Your Journal entry needs to be saved" : completionRef.current ? "Already saved to your Journal" : "Rate your quest to save it"}</Text></View>
          {error ? <Text accessibilityRole="alert" style={{ color: T.red, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" }}>{error}</Text> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}><CompletionActionButton label={busy ? "Saving..." : error ? "Retry save" : "Done"} icon="checkmark" inverse disabled={busy} onPress={() => void finish("journal")} /></View>
            {!guestMode && !error ? <View style={{ flex: 2 }}><CompletionActionButton label={busy ? "Saving..." : "Share your adventure"} disabled={busy} onPress={() => void finish("share")} /></View> : null}
          </View>
      </Animated.View>
      <CompletionConfetti active={celebrationStarted} />
    </View>
  </Sheet>;
}
