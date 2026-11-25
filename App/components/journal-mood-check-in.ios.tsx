import { Pressable } from "@/components/raised-pressable";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Easing, Extrapolation, FadeIn, FadeInRight, FadeOut, interpolate, interpolateColor, useAnimatedProps, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

import { QuestStartCountdown } from "./quest-start-countdown.ios";
import { MoodMotionEyes } from "./mood-motion-eyes.ios";
import { categoryColor, T } from "@/components/theme";
import { IconButton, SoftButton } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useAppViewport, useResponsiveScreenLayout } from "@/lib/responsive";
import { MOOD_NOTE_LIMIT, readMoodNote, writeMoodNote } from "@/services/journal/mood-note-store";
import { toLocalDateKey } from "@/services/journal/journalService";
import { isHapticFeedbackEnabled } from "@/services/settings/settingsService";
import type { JournalMoodCheckInProps, MoodFormProps } from "./journal-mood-check-in.types";

const OPTIONS = [
  { mood: "sad", label: "Low", heading: "LOW", background: "#FF856F", ink: "#8F1D0E", message: "It's okay to have a low day. Take it one moment at a time." },
  { mood: "neutral", label: "Okay", heading: "OKAY", background: "#F7CA55", ink: "#79500C", message: "A moment to pause and notice how you feel. That counts, too." },
  { mood: "happy", label: "Good", heading: "GOOD", background: "#C9E47B", ink: "#30560D", message: "Keep a little of this feeling with you as you move through your day." },
] as const;
const BACKGROUNDS = OPTIONS.map(option => option.background);
const INKS = OPTIONS.map(option => option.ink);
const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const clampMood = (value: number) => Math.max(0, Math.min(2, Math.round(value)));

function selectionHaptic() {
  if (isHapticFeedbackEnabled()) void Haptics.selectionAsync().catch(() => undefined);
}

/** The reference face is geometry, not emoji: discs → sleepy pills → large discs. */
function MoodFace({ expression, palette, size, motionActive, reduced, readiness = false, readinessInk = T.dark }: { motionActive: boolean; reduced: boolean; readinessInk?: string; readiness?: boolean; expression: SharedValue<number>; palette: SharedValue<number>; size: number }) {
  const left = useAnimatedProps(() => {
    const p = expression.get();
    const width = interpolate(p, [0, 1, 2], [58, 102, 116]);
    const height = interpolate(p, [0, 1, 2], [62, 38, 128]);
    const center = interpolate(p, [0, 1, 2], [96, 86, 76]);
    return { x: center - width / 2, y: 90 - height / 2, width, height, rx: Math.min(width, height) / 2, fill: readiness ? readinessInk : interpolateColor(palette.get(), [0, 1, 2], INKS) };
  });
  const right = useAnimatedProps(() => {
    const p = expression.get();
    const width = interpolate(p, [0, 1, 2], [58, 102, 116]);
    const height = interpolate(p, [0, 1, 2], [62, 38, 128]);
    const center = interpolate(p, [0, 1, 2], [204, 214, 224]);
    return { x: center - width / 2, y: 90 - height / 2, width, height, rx: Math.min(width, height) / 2, fill: readiness ? readinessInk : interpolateColor(palette.get(), [0, 1, 2], INKS) };
  });
  const mouth = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(expression.get(), [0, 1, 2], [0, -2, 27]) }, { rotate: `${interpolate(expression.get(), [0, 1, 2], [0, 0, 180])}deg` }],
  }));
  const stroke = useAnimatedProps(() => ({ stroke: readiness ? readinessInk : interpolateColor(palette.get(), [0, 1, 2], INKS) }));
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size * 0.67 }}>
    <MoodMotionEyes size={size} active={motionActive} reduced={reduced}>
      <Svg width={size} height={size * 0.67} viewBox="0 0 300 201">
        <AnimatedRect animatedProps={left} />
        <AnimatedRect animatedProps={right} />
      </Svg>
    </MoodMotionEyes>
    <Animated.View style={[{ position: "absolute", top: size * 0.42 + 12, left: size * 0.41, width: size * 0.18, height: size * 0.12 }, mouth]}>
      <Svg width="100%" height="100%" viewBox="0 0 54 36"><AnimatedPath animatedProps={stroke} d="M 7 27 Q 27 3 47 27" strokeWidth={12} strokeLinecap="round" fill="none" /></Svg>
    </Animated.View>
  </View>;
}

function MoodWord({ index, position, reduced, width }: { index: number; position: SharedValue<number>; reduced: boolean; width: number }) {
  const style = useAnimatedStyle(() => ({
    color: interpolateColor(position.get(), [0, 1, 2], INKS),
    opacity: interpolate(Math.abs(position.get() - index), [0, 0.75, 1], [0.48, 0.15, 0], Extrapolation.CLAMP),
    transform: [{ translateX: reduced ? 0 : (index - position.get()) * width }],
  }));
  return <Animated.Text accessible={false} style={[styles.word, style]}>{OPTIONS[index].heading}</Animated.Text>;
}

export function MoodForm({ entryDate, mood, editable, onSave, onClose, ownerId, questTitle, onCountdownFinished, countdownSessionId, checkInOnly = false, successXp, questCategory, onConfirmStart }: MoodFormProps) {
  const isQuestStart = questTitle !== undefined && !checkInOnly;
  const [countingDown, setCountingDown] = useState(false);
  const [ready, setReady] = useState(isQuestStart);
  const [hasChosen, setHasChosen] = useState(false);
  const [saveDate, setSaveDate] = useState(entryDate);
  const [dateNotice, setDateNotice] = useState<string | null>(null);
  const reduced = useReducedMotionPreference();
  const { contentWidth, horizontalPadding, insets } = useResponsiveScreenLayout(480);
  const viewport = useAppViewport();
  const initial = Math.max(0, OPTIONS.findIndex(option => option.mood === (mood ?? "happy")));
  const [selected, setSelected] = useState(initial);
  const [note, setNote] = useState("");
  const [originalNote, setOriginalNote] = useState("");
  const [loadingNote, setLoadingNote] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const submitting = useRef(false);
  const chosenIndex = useRef(initial);
  const readyFace = useSharedValue(2);
  const position = useSharedValue(initial);
  const expression = useSharedValue(initial);
  const labelPosition = useSharedValue(initial);
  const trackWidth = useSharedValue(1);
  const dragging = useSharedValue(false);
  const size = Math.min(310, contentWidth - horizontalPadding * 2 - 18);
  // Leave room for the ring's 20pt padding and 1.5pt border on each side.
  const readyFaceSize = Math.max(0, Math.min(size, contentWidth - horizontalPadding * 2 - 43));
  const readinessPalette = categoryColor[questCategory ?? ""] ?? { text: T.blue, bg: T.bg };
  const readyInk = readinessPalette.text;
  const readyBackground = readinessPalette.bg;
  const ink = ready ? readyInk : OPTIONS[selected].ink;
  const background = ready ? readyBackground : OPTIONS[selected].background;

  const loadNote = useCallback(async () => {
    if (checkInOnly || isQuestStart) { setLoadingNote(false); return; }
    setLoadingNote(true);
    setLoadError(null);
    try {
      const value = await readMoodNote(ownerId, entryDate);
      setNote(value);
      setOriginalNote(value);
    } catch {
      setLoadError("Your note couldn't load. Try again before editing it.");
    } finally { setLoadingNote(false); }
  }, [entryDate, ownerId, checkInOnly, isQuestStart]);
  useEffect(() => { void loadNote(); }, [loadNote]);

  const commitSelection = useCallback((index: number) => { setSelected(index); selectionHaptic(); }, []);
  useAnimatedReaction(() => Math.round(position.get()), (next, previous) => {
    if (next === previous) return;
    expression.set(reduced ? next : withSpring(next, { damping: 20, stiffness: 180, mass: 1 }));
    labelPosition.set(reduced ? next : withTiming(next, { duration: 280, easing: EASE }));
    if (previous !== null) scheduleOnRN(commitSelection, next);
  }, [reduced, commitSelection]);

  const choose = (index: number) => {
    if (!editable || saving) return;
    chosenIndex.current = index;
    setHasChosen(true);
    setSelected(index);
    position.set(reduced ? index : withTiming(index, { duration: 220, easing: EASE }));
  };
  // A custom track is needed to match the reference's face thumb and morphing canvas.
  const finishSelection = useCallback((index: number) => { chosenIndex.current = index; setSelected(index); }, []);
  const markChosen = useCallback(() => setHasChosen(true), []);
  const pan = Gesture.Pan().enabled(editable && !saving).minDistance(0)
    .onBegin(event => { scheduleOnRN(markChosen); dragging.set(true); position.set(Math.max(0, Math.min(2, (event.x - 20) / trackWidth.get() * 2))); })
    .onUpdate(event => { position.set(Math.max(0, Math.min(2, (event.x - 20) / trackWidth.get() * 2))); })
    .onFinalize(() => { dragging.set(false); const next = Math.round(position.get()); scheduleOnRN(finishSelection, next); position.set(reduced ? next : withSpring(next, { damping: 20, stiffness: 180, mass: 1, overshootClamping: true })); });
  const canvas = useAnimatedStyle(() => ({ backgroundColor: ready ? readyBackground : interpolateColor(position.get(), [0, 1, 2], BACKGROUNDS) }));
  const foreground = useAnimatedStyle(() => ({ color: ready ? readyInk : interpolateColor(position.get(), [0, 1, 2], INKS) }));
  const solid = useAnimatedStyle(() => ({ backgroundColor: ready ? readyInk : interpolateColor(position.get(), [0, 1, 2], INKS) }));
  const thumb = useAnimatedStyle(() => ({
    backgroundColor: ready ? readyInk : interpolateColor(position.get(), [0, 1, 2], INKS),
    transform: [{ translateX: position.get() / 2 * trackWidth.get() }, { scale: reduced ? 1 : withTiming(dragging.get() ? 1.12 : 1, { duration: 120 }) }],
  }));
  const thumbMouth = useAnimatedStyle(() => ({ transform: [{ rotate: `${position.get() > 1.5 ? 180 : 0}deg` }] }));

  function back() {
    if (submitting.current || countingDown) return;
    if (editingNote) { Keyboard.dismiss(); setEditingNote(false); return; }
    if (isQuestStart && !ready) { setReady(true); return; }
    close();
  }

  function close() {
    if (submitting.current || countingDown) return;
    if (editingNote) { Keyboard.dismiss(); setEditingNote(false); return; }
    if (!saved && editable && (note !== originalNote || selected !== initial || (isQuestStart && hasChosen))) {
      Alert.alert("Leave this check-in?", "Your unsaved changes will be discarded.", [{ text: "Keep editing", style: "cancel" }, { text: "Discard", style: "destructive", onPress: onClose }]);
    } else onClose();
  }

  async function submit() {
    if (submitting.current || loadingNote || loadError || !editable || ((isQuestStart || checkInOnly) && (!hasChosen || ready))) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const date = isQuestStart ? toLocalDateKey(new Date()) : entryDate;
      if (date !== saveDate) {
        // Do not overwrite a new day's existing note with the previous day's note.
        const currentNote = await readMoodNote(ownerId, date);
        if (note === originalNote) setNote(currentNote);
        setOriginalNote(currentNote);
        setSaveDate(date);
        setDateNotice(`It's a new day. This check-in will save to ${new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Review your note, then tap Start quest.`);
        return;
      }
      // Keep the note recoverable on this device even if the network save fails.
      if (!checkInOnly) await writeMoodNote(ownerId, date, note.trim());
      const success = await onSave(OPTIONS[chosenIndex.current].mood, date);
      if (!success) throw new Error("Your mood didn't save. Your note is kept on this device; try again.");
      if (isQuestStart) { setEditingNote(false); setCountingDown(true); return; }
      if (checkInOnly) { onClose(); return; }
      setEditingNote(false);
      setSaved(true);
      if (isHapticFeedbackEnabled()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your check-in didn't save. Please try again.");
    } finally { submitting.current = false; setSaving(false); }
  }

  const submitDisabled = saving || (!saved && editable && (loadingNote || Boolean(loadError) || ((isQuestStart || checkInOnly) && !hasChosen)));
  async function confirmStart() {
    if (submitting.current || !onConfirmStart) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      if (!await onConfirmStart()) throw new Error("Your quest couldn't start. Please try again.");
      setCountingDown(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your quest couldn't start. Please try again.");
    } finally { submitting.current = false; setSaving(false); }
  }

  const button = (full = false) => <SoftButton
    label={saved || !editable ? "Back to journal" : saving ? "Saving…" : "Save check-in"}
    color={ink}
    disabled={submitDisabled}
    onPress={saved || !editable ? onClose : () => void submit()}
    style={full ? { alignSelf: "stretch" } : { alignSelf: "flex-end" }}
  />;

  return <Modal visible animationType="fade" presentationStyle="overFullScreen" transparent onRequestClose={back} statusBarTranslucent>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: countingDown ? "transparent" : T.bg }}>
      {!countingDown && <StatusBar style="dark" />}
      {!countingDown && <Animated.View style={[{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }, canvas]}>
        <View style={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, flex: 1 }}>
          <View style={styles.toolbar}>
            {ready ? <View style={styles.icon} pointerEvents={saving ? "none" : "auto"} accessibilityState={{ disabled: saving }}><IconButton icon="arrow-back" label="Back" backAccent={readyInk} onPress={back} /></View> : <Pressable accessibilityRole="button" accessibilityLabel={editingNote ? "Back to mood" : "Back"} disabled={saving} onPress={back} style={styles.icon}><Ionicons name="chevron-back" size={24} color={ink} /></Pressable>}
            {!saved && !ready && <Pressable accessibilityRole="button" accessibilityLabel="About mood check-ins" onPress={() => Alert.alert("A moment for you", checkInOnly ? "This check-in adds a point to this quest’s mood journey." : "Slide or tap to choose how you feel. Your mood is saved to this day's journal. Optional notes stay on this device and are removed when you sign out.")} style={styles.icon}><Ionicons name="information-circle-outline" size={23} color={ink} /></Pressable>}
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={{ flex: 1 }} onLayout={event => setBodyHeight(event.nativeEvent.layout.height)}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, minHeight: bodyHeight, paddingHorizontal: 18, paddingBottom: 16 }}>
                {!editingNote && !saved && <Animated.View key={ready ? "readiness" : "mood"} entering={reduced ? FadeIn.duration(120) : FadeInRight.duration(220)}>
                  <Animated.Text accessibilityRole="header" style={[styles.question, ready && styles.readinessHeading, foreground]}>{ready ? "Ready to begin?" : isQuestStart || checkInOnly ? "How are you feeling\nright now?" : editable ? "How are you feeling\ntoday?" : "How you felt\non " + new Date(`${entryDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Animated.Text>
                </Animated.View>}
                <View style={{ flex: editingNote ? 1 : 3, minHeight: editingNote ? Math.min(175, viewport.height * 0.23) : size * 0.67 + 50, marginHorizontal: ready ? -18 : 0, alignItems: "center", justifyContent: "center" }}>
                  <View style={ready ? { padding: 20, borderWidth: 1.5, borderColor: `${readyInk}30`, borderRadius: 180 } : undefined}><MoodFace motionActive={!editingNote && !saved && !countingDown} reduced={reduced} readinessInk={readyInk} readiness={ready} expression={ready ? readyFace : expression} palette={ready ? readyFace : position} size={ready ? readyFaceSize : editingNote ? size * 0.83 : size} /></View>
                </View>
                {saved ? <Animated.View entering={reduced ? undefined : FadeIn.duration(220)} style={{ flex: 2, gap: 14, alignItems: "center" }}>
                  <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.thanks, { color: ink }]}>Thank you for{`\n`}checking in!</Text>
                  {successXp ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: ink, fontFamily: "RubikBold" }]}>+{successXp} XP gained</Text> : null}
                  <Text style={[styles.message, { color: ink }]}>{OPTIONS[selected].message}</Text>
                </Animated.View> : !editingNote && !ready && <>
                  <View accessibilityRole="text" accessibilityLabel={`Mood: ${OPTIONS[selected].label}`} style={{ height: 92, justifyContent: "center", overflow: "hidden" }}>
                    {[0, 1, 2].map(index => <MoodWord key={index} index={index} position={labelPosition} reduced={reduced} width={contentWidth} />)}
                  </View>
                  <View style={{ flex: 1, minHeight: 96, justifyContent: "center" }}>
                    <GestureDetector gesture={pan}>
                      <View accessible accessibilityRole="adjustable" accessibilityLabel="Your mood" accessibilityValue={{ min: 0, max: 2, now: selected, text: OPTIONS[selected].label }} accessibilityState={{ disabled: !editable || saving }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={event => choose(clampMood(selected + (event.nativeEvent.actionName === "increment" ? 1 : -1)))} onLayout={event => trackWidth.set(Math.max(1, event.nativeEvent.layout.width - 40))} style={{ height: 48, justifyContent: "center" }}>
                        <Animated.View style={[{ height: 5, marginHorizontal: 20, borderRadius: 3, opacity: 0.14 }, solid]} />
                        <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" }}>{[0, 1, 2].map(index => <Animated.View key={index} style={[{ width: 8, height: 8, borderRadius: 4, opacity: 0.16 }, solid]} />)}</View>
                        <Animated.View pointerEvents="none" style={[styles.thumb, thumb]}><Animated.View style={thumbMouth}><Svg width={18} height={16} viewBox="0 0 22 18"><Path d="M 5 12 Q 11 5 17 12" stroke={background} strokeWidth={2} strokeLinecap="round" fill="none" /></Svg></Animated.View></Animated.View>
                      </View>
                    </GestureDetector>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginHorizontal: -4 }}>{OPTIONS.map((option, index) => <Pressable key={option.mood} accessibilityRole="radio" accessibilityState={{ checked: (!(isQuestStart || checkInOnly) || hasChosen) && selected === index, disabled: !editable || saving }} disabled={!editable || saving} onPress={() => choose(index)} style={{ minWidth: 48, minHeight: 44, alignItems: "center", paddingTop: 3 }}><Animated.Text style={[styles.tickLabel, foreground, { opacity: selected === index ? 1 : 0.55 }]}>{option.label}</Animated.Text></Pressable>)}</View>
                  </View>
                </>}
                {isQuestStart && !ready && !hasChosen && <Text style={[styles.message, { color: ink, fontSize: 13 }]}>Choose the mood that feels most like you.</Text>}
                {dateNotice && !ready && <Text accessibilityLiveRegion="polite" style={[styles.error, { color: ink }]}>{dateNotice}</Text>}
                {loadError && !ready && <View style={styles.error}><Text accessibilityRole="alert" style={{ color: ink }}>{loadError}</Text><Pressable accessibilityRole="button" onPress={() => void loadNote()} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: ink, fontWeight: "700" }}>Try again</Text></Pressable></View>}
                {error && <Text accessibilityRole="alert" style={[styles.error, { color: ink }]}>{error}</Text>}
                <View style={{ paddingTop: editingNote ? 8 : 24, marginTop: "auto" }}>
                  {ready ? <Animated.View entering={reduced ? FadeIn.duration(120) : FadeInRight.duration(220)} style={{ gap: 12 }}>
                    <SoftButton label={saving ? "Starting…" : "Yes, let's go"} icon="arrow-forward" color={readyInk} disabled={saving} onPress={() => void confirmStart()} />
                    <SoftButton label="Not now" inverse color={readyInk} disabled={saving} onPress={close} />
                  </Animated.View> : saved || !editable ? <>{!editable && note ? <Text selectable style={[styles.message, { color: ink, marginBottom: 20 }]}>{note}</Text> : null}{button(true)}</> : editingNote ? <Animated.View entering={reduced ? undefined : FadeIn.duration(180)} exiting={reduced ? undefined : FadeOut.duration(120)} style={[styles.noteEditor, { borderColor: `${ink}66` }]}>
                    <TextInput autoFocus accessibilityLabel="Mood note" placeholder="Add note" placeholderTextColor={`${ink}99`} value={note} onChangeText={setNote} multiline maxLength={MOOD_NOTE_LIMIT} editable={!saving && !loadingNote && !loadError} textAlignVertical="top" selectionColor={ink} style={[styles.noteInput, { color: ink }]} />
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: ink, opacity: 0.6, fontSize: 11 }}>{note.length}/{MOOD_NOTE_LIMIT}</Text>{button()}</View>
                  </Animated.View> : checkInOnly ? button(true) : <View style={styles.footer}>
                    <SoftButton label={loadingNote ? "Loading note…" : note ? "Edit note" : "Add note"} inverse color={ink} disabled={loadingNote || Boolean(loadError) || saving} onPress={() => setEditingNote(true)} />
                    {button(true)}
                  </View>}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Animated.View>}
      {countingDown && <QuestStartCountdown title={questTitle ?? "Your quest"} sessionId={countdownSessionId} onFinished={() => onCountdownFinished?.()} />}
    </GestureHandlerRootView>
  </Modal>;
}

export function MoodCheckInCard(props: Pick<JournalMoodCheckInProps, "mood" | "editable" | "saving"> & { onPress: () => void; subtitle?: string }) {
  const option = OPTIONS.find(item => item.mood === props.mood);
  return <Pressable accessibilityRole="button" accessibilityLabel={props.editable ? "Open mood check-in" : "View mood check-in"} disabled={props.saving} onPress={() => { selectionHaptic(); props.onPress(); }} style={({ pressed }) => ({ minHeight: 60, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, backgroundColor: option?.background ?? "#C9E47B", flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.8 : 1 })}>
      <Ionicons name={props.mood === "sad" ? "sad-outline" : "happy-outline"} size={28} color={option?.ink ?? "#30560D"} />
      <View style={{ flex: 1 }}><Text style={{ color: option?.ink ?? "#30560D", fontFamily: "RubikBold", fontSize: 15 }}>{props.editable ? "Mood check-in" : `Feeling ${option?.label.toLowerCase()}`}</Text><Text style={{ color: option?.ink ?? "#30560D", fontSize: 12, marginTop: 3 }}>{props.subtitle ?? (props.saving ? "Saving…" : option ? `${option.label} · ${props.editable ? "Tap to revisit" : "View check-in"}` : "How are you feeling today?")}</Text></View>
      <Ionicons name="arrow-forward" size={20} color={option?.ink ?? "#30560D"} />
    </Pressable>;
}

export function JournalMoodCheckIn(props: JournalMoodCheckInProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const option = OPTIONS.find(item => item.mood === props.mood);
  if (!props.editable && !option) return null;
  return <>
    <MoodCheckInCard mood={props.mood} editable={props.editable} saving={props.saving} onPress={() => setOpen(true)} />
    {open && user ? <MoodForm {...props} ownerId={user.id} onClose={() => setOpen(false)} /> : null}
    {open && !user ? <Text style={{ color: T.red }}>Sign in to save your mood check-in.</Text> : null}
  </>;
}

const styles = StyleSheet.create({
  toolbar: { minHeight: 52, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  icon: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  question: { fontFamily: "Rubik", fontSize: 24, lineHeight: 31, textAlign: "center", paddingTop: 24, paddingBottom: 8 },
  readinessHeading: { fontFamily: "RubikBold", fontSize: 30, lineHeight: 38 },
  word: { position: "absolute", width: "100%", textAlign: "center", fontFamily: "RubikBlack", fontSize: 60, letterSpacing: -3 },
  thumb: { position: "absolute", left: 0, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tickLabel: { fontFamily: "Rubik", fontSize: 16 },
  footer: { gap: 10 },
  noteEditor: { borderWidth: 1, borderRadius: 24, padding: 14, backgroundColor: "rgba(255,255,255,0.17)" },
  noteInput: { minHeight: 100, maxHeight: 160, fontFamily: "Rubik", fontSize: 15, lineHeight: 21, padding: 4, marginBottom: 12 },
  thanks: { fontFamily: "RubikBold", fontSize: 28, lineHeight: 32, textAlign: "center" },
  message: { fontFamily: "Rubik", fontSize: 15, lineHeight: 21, textAlign: "center" },
  error: { padding: 12, marginVertical: 8, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.25)", fontSize: 14 },
});
