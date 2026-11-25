import { Pressable } from "@/components/raised-pressable";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { AudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { T } from "@/components/theme";
import { getCompletionPalette } from "@/components/quest-completion-palette";
import { CompletionMedallion, QuestCompletionScene } from "@/components/quest-completion-scene";
import { haptic, Sheet, SoftButton } from "@/components/ui";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { engineErrorMessage, rateQuestCompletion } from "@/services/engine/questEngineService";
import { syncActiveQuestRecord } from "@/services/active-quest/sync";
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

/** A completed quest is committed before this recap is shown, so this sheet is read-only. */
export function LogLoreFlow({ guestMode = false, visible, quest, onFinished, initialTitle, initialReflection = "", photoUris = [], duration, sessionId, onSaveDraft }: { guestMode?: boolean; visible: boolean; quest: Quest | null; onFinished: (result: CompletionResult, destination: CompletionDestination, details: CompletionShareDetails) => void | Promise<void>; initialTitle?: string; initialReflection?: string; photoUris?: string[]; duration: string; sessionId?: string; onSaveDraft?: (draft: { title: string; body: string }) => Promise<void> }) {
  const { completeQuest } = useQuestEngine();
  const palette = getCompletionPalette(T.isDark);
  const { refreshNotifications } = useNotifications();
  const { refresh: refreshStreaks } = useStreaks();
  const [rating, setRating] = useState(0);
  const [pendingDestination, setPendingDestination] = useState<CompletionDestination | null>(null);
  const [ratingError, setRatingError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrationStarted, setCelebrationStarted] = useState(false);
  const rewardPlayerRef = useRef<AudioPlayer | null>(null);
  const rewardFadeStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardFadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedForOpen = useRef(false);
  const celebrationBeganRef = useRef(false);
  const completionRef = useRef<CompletionResult | null>(null);
  const savingRef = useRef(false);
  const finishingRef = useRef(false);
  const uploadedPhotosRef = useRef(new Map<string, string>());
  const ratingWobble = useSharedValue(0);
  const reducedMotion = useReducedMotionPreference();
  const ratingWobbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: ratingWobble.value }] }));
  useEffect(() => {
    if (!visible) { initializedForOpen.current = false; celebrationBeganRef.current = false; completionRef.current = null; savingRef.current = false; finishingRef.current = false; uploadedPhotosRef.current.clear(); setCelebrationStarted(false); return; }
    if (initializedForOpen.current) return;
    initializedForOpen.current = true;
    setRating(0); setPendingDestination(null); setRatingError(false); setBusy(false); setError(null);
    // End quest immediately creates the durable Journal memory. The screen
    // remains locked until the owner chooses a rating and leaves intentionally.
    void persistCompletion();
  }, [visible]);
  useEffect(() => {
    if (!celebrationStarted || !isHapticFeedbackEnabled()) return;

    // Reward feedback accompanies the illustration's entrance.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [celebrationStarted]);
  useEffect(() => () => {
    if (rewardFadeStartRef.current) clearTimeout(rewardFadeStartRef.current);
    if (rewardFadeIntervalRef.current) clearInterval(rewardFadeIntervalRef.current);
    rewardPlayerRef.current?.release();
  }, []);
  const beginCelebration = useCallback(() => {
    if (celebrationBeganRef.current) return;
    celebrationBeganRef.current = true;
    setCelebrationStarted(true);
    try {
      // The import remains deferred so an older Expo client can still render
      // the screen; current Expo clients play the bundled reward fanfare.
      const { createAudioPlayer } = require("expo-audio") as typeof import("expo-audio");
      rewardPlayerRef.current?.release();
      const player = createAudioPlayer(require("@/assets/sounds/quest-completion-sfx.mp3"));
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
  }, []);
  if (!quest) return null;
  const persistCompletion = async () => {
    if (completionRef.current) return completionRef.current;
    if (savingRef.current) return null;
    savingRef.current = true;
    setBusy(true); setError(null);
    try {
      await onSaveDraft?.({ title: initialTitle?.trim() || quest.title, body: initialReflection });
      // On native, complete_quest_v2 closes the server session. Checkpoint the
      // local route and reflection first so the completed Journal memory can
      // always recover the map, even when the user leaves immediately after
      // the celebration screen appears.
      if (!guestMode && sessionId) {
        await syncActiveQuestRecord(sessionId);
      }
      const safePhotoUris = Array.from(new Set(photoUris.filter((uri): uri is string => typeof uri === "string" && uri.trim().length > 0)));
      const uploadedPhotos = guestMode ? [] : await Promise.allSettled(safePhotoUris.map(async (uri) => {
        const existing = uploadedPhotosRef.current.get(uri);
        if (existing) return existing;
        const path = await uploadJournalMedia(uri);
        uploadedPhotosRef.current.set(uri, path);
        return path;
      }));
      // A native capture is still available locally while this sheet remains
      // open. Do not commit a completion that permanently omits a failed
      // upload; keep the draft intact and let the owner retry instead.
      if (uploadedPhotos.some((result) => result.status === "rejected")) {
        throw new Error("We couldn't save all of your quest photos. Check your connection and retry — your reflection and photos are still here.");
      }
      const journalPhotoPaths = uploadedPhotos.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const completion = guestMode ? { completionId: `guest-${Date.now()}`, xpAwarded: 0, dailyUsed: 0, dailyLimit: 5 } : await completeQuest({ questId: quest.id, sessionId, logged: false, reflection: initialReflection.trim() || null, rating: null, review: null, reviewPublic: false, photoUrls: journalPhotoPaths });
      completionRef.current = completion;
      if (!guestMode) await Promise.allSettled([refreshNotifications(), refreshStreaks()]);
      return completion;
    } catch (nextError) { setError(engineErrorMessage(nextError)); return null; } finally { savingRef.current = false; setBusy(false); }
  };
  const finish = async (destination: CompletionDestination) => {
    if (savingRef.current || finishingRef.current) return;
    if (!rating) {
      setRatingError(true);
      if (!reducedMotion) ratingWobble.value = withSequence(withTiming(-9, { duration: 55 }), withTiming(9, { duration: 70 }), withTiming(-6, { duration: 60 }), withTiming(0, { duration: 55 }));
      return;
    }
    const completion = completionRef.current ?? await persistCompletion();
    if (!completion) return;
    finishingRef.current = true;
    setBusy(true); setError(null);
    try {
      if (!guestMode) await rateQuestCompletion(completion.completionId, rating);
      await onFinished(completion, destination, { rating, duration });
    } catch (nextError) { setError(engineErrorMessage(nextError)); setBusy(false); } finally { finishingRef.current = false; }
  };
  const validPhotoUris = Array.from(new Set(photoUris.filter((uri): uri is string => typeof uri === "string" && uri.trim().length > 0)));
  const requestFinish = (destination: CompletionDestination) => {
    if (busy) return;
    if (!rating) { setPendingDestination(destination); setRatingError(false); return; }
    void finish(destination);
  };
  return <Sheet visible={visible} onClose={() => undefined} fillHeight fullScreen dismissible={false} surfaceColor={palette.surface} onShown={beginCelebration}>
    <View style={{ flex: 1, minHeight: 0, display: pendingDestination ? "none" : "flex" }}>
      <QuestCompletionScene
        active={celebrationStarted}
        questTitle={quest.title}
        category={quest.category}
        xp={completionRef.current?.xpAwarded ?? null}
        photoCount={validPhotoUris.length}
        duration={duration}
        busy={busy}
        error={error}
        guestMode={guestMode}
        onContinue={() => requestFinish("journal")}
        onShare={() => requestFinish("share")}
        onRetry={() => void persistCompletion()}
      />
    </View>
    {pendingDestination ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
      <View style={{ width: "100%", maxWidth: 460, alignSelf: "center", gap: 24 }}>
        <View style={{ alignItems: "center", gap: 20 }}>
          <CompletionMedallion color={palette.medallion} size={116} />
          <Text accessibilityRole="header" style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 26, lineHeight: 34, textAlign: "center" }}>How was your quest?</Text>
          <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 16, lineHeight: 23, textAlign: "center" }}>{quest.title}</Text>
        </View>
        <Animated.View style={[{ alignItems: "center", gap: 12 }, ratingWobbleStyle]}>
          <Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 13 }}>Rate this quest</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8 }}>{[1, 2, 3, 4, 5].map((value) => <RatingStar key={value} rating={value} value={rating} onPress={() => { if (busy) return; playRatingFeedback(); setRating(value); setRatingError(false); setError(null); }} />)}</View>
          {ratingError ? <Text accessibilityRole="alert" style={{ color: T.red, fontFamily: "RubikBold", fontSize: 13 }}>Please rate this quest to continue.</Text> : null}
        </Animated.View>
        {error ? <Text accessibilityRole="alert" style={{ color: T.red, fontFamily: "Rubik", fontSize: 13, lineHeight: 19, textAlign: "center" }}>{error}</Text> : null}
        <SoftButton label={busy ? "Saving…" : pendingDestination === "share" ? "Share your adventure" : "Continue"} color={palette.blue} textColor={palette.buttonLabel} style={{ borderBottomColor: palette.buttonEdge }} disabled={busy} onPress={() => void finish(pendingDestination)} />
        <Pressable accessibilityRole="button" accessibilityLabel="Back to quest summary" disabled={busy} onPress={() => setPendingDestination(null)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 14 }}>Back to summary</Text></Pressable>
      </View>
    </ScrollView> : null}
  </Sheet>;
}
