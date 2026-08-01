import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Mask, Rect } from "react-native-svg";

import { ActiveQuestScreen } from "@/screens/active-quest-screen";
import { T } from "@/components/theme";
import { haptic } from "@/components/ui";
import { useActiveQuest } from "@/contexts/ActiveQuestContext";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { playHaptic } from "@/motion/haptics";

type PhotoGuideStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const guideContent = [
  {
    title: "Keep your story honest",
    body: "Pause whenever you need to, then resume when you’re back in the moment. Keeping the timer accurate makes your quest easier to relive later.",
  },
  {
    title: "Your quest tools",
    body: "Tap the blue + to open the quick ways to add to your story.",
  },
  {
    title: "Everything within reach",
    body: "End your quest, jot a quick note, capture a photo, or close the menu when you’re done.",
  },
  {
    title: "Capture the moment",
    body: "Take a photo when something feels worth remembering. It gives your future self a vivid way back to this experience.",
  },
  {
    title: "Your moments live here",
    body: "Quest photos are saved in Memories during your quest and stay available after it ends. QuestLife keeps a compressed quest copy for your account, so deleting the camera-roll original won’t remove it. Your photos stay private to you.",
  },
  {
    title: "Part of your quest story",
    body: "Every photo also appears in Activity with the time you captured it, so you can relive your quest in order.",
  },
  {
    title: "Keep the details close",
    body: "Quick notes capture the feelings, people, and small details that a photo can’t always hold.",
  },
  {
    title: "Write it while it’s fresh",
    body: "Add a thought now, or we’ll use a friendly example so you can see how notes work.",
  },
  {
    title: "Your story, in order",
    body: "Quick notes appear here with the time you saved them, alongside every other moment from your quest.",
  },
] as const;

const tutorialSampleNote = "I went to the park, and the sunset was beautiful. I felt really happy.";

const tutorialMockPhoto = Asset.fromModule(require("../../assets/onboarding/tutorial-mock-photo.jpg"));

function spotlightFor(step: PhotoGuideStep, width: number, height: number, topInset: number, bottomInset: number) {
  const controlsBottom = Math.max(bottomInset + 10, 18);
  if (step === 0) return { x: 14, y: height - controlsBottom - 82, width: width - 28, height: 88 };
  if (step === 1) return { x: width - 98, y: height - controlsBottom - 78, width: 84, height: 84 };
  if (step === 2) return { x: width - 248, y: height - controlsBottom - 356, width: 234, height: 356 };
  if (step === 3) return { x: width - 88, y: height - controlsBottom - 148, width: 74, height: 74 };
  // Keep the header and tabs dimmed, then reveal the whole Memories canvas
  // below them so the saved photo and its surrounding context are visible.
  if (step === 4) {
    const contentTop = topInset + 152;
    return { x: 0, y: contentTop, width, height: height - contentTop };
  }
  // On the Activity photo lesson, keep the app chrome dimmed and reveal the
  // complete timeline canvas below the tabs—not only the photo post.
  if (step === 5) {
    const contentTop = topInset + 152;
    return { x: 0, y: contentTop, width, height: height - contentTop };
  }
  // Reveal the complete Quick note action—its label and round icon—so the
  // lesson points at the actual control the person will tap.
  if (step === 6) return { x: width - 200, y: height - controlsBottom - 214, width: 185, height: 70 };
  // On the final Quick Note lesson, dim the app chrome and reveal the entire
  // Activity canvas so the new note can be read in its timeline context.
  if (step === 8) {
    const contentTop = topInset + 152;
    return { x: 0, y: contentTop, width, height: height - contentTop };
  }
  return { x: width - 86, y: height - controlsBottom - 217, width: 74, height: 74 };
}

function PhotoQuestGuideOverlay({ step, onNext, onMockPhoto, onDeferredNote, width, height, topInset, bottomInset, hidden }: { step: PhotoGuideStep; onNext: () => void; onMockPhoto: () => void; onDeferredNote: () => void; width: number; height: number; topInset: number; bottomInset: number; hidden: boolean }) {
  const reduceMotion = useReducedMotionPreference();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const target = spotlightFor(step, width, height, topInset, bottomInset);
  const content = guideContent[step];
  const photoStep = step === 3;
  const noteStep = step === 7;
  const menuStep = step === 2 || photoStep || step === 6 || noteStep;
  const cardTop = menuStep ? topInset + 92 : undefined;
  const cardBottom = menuStep ? undefined : step >= 4 ? Math.max(bottomInset + 96, 112) : Math.max(bottomInset + 122, 134);

  useEffect(() => {
    if (hidden) return;
    opacity.setValue(reduceMotion ? 1 : 0);
    translateY.setValue(reduceMotion ? 0 : 18);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: reduceMotion ? 0 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: reduceMotion ? 0 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [hidden, opacity, reduceMotion, step, translateY]);

  if (hidden) return null;
  const maskId = `photo-quest-guide-${step}`;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs><Mask id={maskId} x="0" y="0" width={width} height={height} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"><Rect x="0" y="0" width={width} height={height} fill="#fff" /><Rect x={target.x} y={target.y} width={target.width} height={target.height} rx={22} ry={22} fill="#000" /></Mask></Defs>
        <Rect x="0" y="0" width={width} height={height} fill="rgba(0,0,0,0.76)" mask={`url(#${maskId})`} />
      </Svg>
    </View>
    <Pressable accessibilityLabel="Tutorial overlay" onPress={() => undefined} style={[styles.overlayBlocker, { left: 0, right: 0, top: 0, height: target.y }]} />
    <Pressable accessibilityLabel="Tutorial overlay" onPress={() => undefined} style={[styles.overlayBlocker, { left: 0, right: 0, top: target.y + target.height, bottom: 0 }]} />
    <Pressable accessibilityLabel="Tutorial overlay" onPress={() => undefined} style={[styles.overlayBlocker, { left: 0, width: target.x, top: target.y, height: target.height }]} />
    <Pressable accessibilityLabel="Tutorial overlay" onPress={() => undefined} style={[styles.overlayBlocker, { left: target.x + target.width, right: 0, top: target.y, height: target.height }]} />
    <View pointerEvents="none" style={[styles.spotlight, { left: target.x, top: target.y, width: target.width, height: target.height }]} />
    <Animated.View style={[styles.guideCard, { top: cardTop, bottom: cardBottom, opacity, transform: [{ translateY }] }]} accessibilityViewIsModal>
      <View style={styles.progress}><Text style={styles.progressText}>{step + 1} of {guideContent.length}</Text><View style={styles.dots}>{guideContent.map((_, index) => <View key={index} style={[styles.dot, index <= step && styles.dotActive]} />)}</View></View>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.body}>{content.body}</Text>
      {step === 1 ? <View style={styles.tapHint}><Ionicons name="hand-left-outline" size={17} color={T.blue} /><Text style={styles.tapHintText}>Tap the blue + button</Text></View> : photoStep ? <View style={styles.photoActions}><View style={styles.tapHint}><Ionicons name="camera" size={17} color={T.blue} /><Text style={styles.tapHintText}>Tap Take photo</Text></View><Pressable accessibilityRole="button" accessibilityLabel="I can't take a photo right now" onPress={onMockPhoto} style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}><Text style={styles.skipText}>I can’t take a photo right now</Text></Pressable></View> : noteStep ? <View style={styles.photoActions}><View style={styles.tapHint}><Ionicons name="create-outline" size={17} color={T.orange} /><Text style={styles.tapHintText}>Tap Quick note</Text></View><Pressable accessibilityRole="button" accessibilityLabel="I can't write a note right now" onPress={onDeferredNote} style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}><Text style={styles.skipText}>I can’t write a note right now</Text></Pressable></View> : <Pressable accessibilityRole="button" accessibilityLabel={step === 8 ? "Continue to questions" : "Next tutorial step"} onPress={onNext} style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}><Text style={styles.nextText}>{step === 8 ? "Next" : "Continue"}</Text><Ionicons name="arrow-forward" size={18} color={T.white} /></Pressable>}
    </Animated.View>
  </View>;
}

export default function PhotoQuestTutorialScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const { snapshot, pause, resume, addActivityNote } = useActiveQuest();
  const [step, setStep] = useState<PhotoGuideStep>(0);
  const [photoFlowOpen, setPhotoFlowOpen] = useState(false);
  const [mockPhotoUri, setMockPhotoUri] = useState<string | null>(null);
  const [handoffPromptVisible, setHandoffPromptVisible] = useState(false);
  const [handoffInProgress, setHandoffInProgress] = useState(false);
  const handoffScale = useRef(new Animated.Value(1)).current;
  const handoffX = useRef(new Animated.Value(0)).current;
  const handoffOpacity = useRef(new Animated.Value(1)).current;
  const handoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handoffFinished = useRef(false);
  const reduceMotion = useReducedMotionPreference();

  useEffect(() => {
    if (!handoffInProgress && snapshot?.session.recordingState && snapshot.session.recordingState !== "paused") void pause();
  }, [handoffInProgress, pause, snapshot?.session.recordingState]);

  useEffect(() => () => {
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
  }, []);

  const advance = () => {
    playHaptic("selection");
    if (step === 8) {
      setHandoffPromptVisible(true);
      return;
    }
    setStep((current) => Math.min(8, current + 1) as PhotoGuideStep);
  };

  const continueToQuestions = () => {
    if (handoffInProgress) return;
    haptic();
    setHandoffPromptVisible(false);
    setHandoffInProgress(true);
    void resume();
    const finish = () => {
      if (handoffFinished.current) return;
      handoffFinished.current = true;
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
      router.replace({ pathname: "/onboarding/follow-up-questions", params: { ...(firstName ? { firstName } : {}), startAt: "life-obstacles", interactiveQuest: "true" } });
    };
    if (reduceMotion) {
      finish();
      return;
    }
    Animated.parallel([
      Animated.timing(handoffScale, { toValue: 0.58, duration: 460, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(handoffX, { toValue: -width * 0.36, duration: 460, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(handoffOpacity, { toValue: 0, duration: 460, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) finish(); });
    handoffTimer.current = setTimeout(finish, 720);
  };

  const openMockPhoto = async () => {
    haptic();
    setPhotoFlowOpen(true);
    try {
      const asset = await tutorialMockPhoto.downloadAsync();
      if (!asset.localUri) throw new Error("Tutorial photo could not be downloaded.");
      setMockPhotoUri(asset.localUri);
    } catch {
      setPhotoFlowOpen(false);
    }
  };

  const deferQuickNote = () => {
    haptic();
    void addActivityNote(tutorialSampleNote, { tutorialOnly: true }).then(() => setStep(8));
  };

  return <View style={styles.root}>
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: handoffOpacity, transform: [{ translateX: handoffX }, { scale: handoffScale }] }]}>
      <ActiveQuestScreen onboarding={{
      locked: true,
      hideExit: true,
      holdCountdown: true,
      allowQuickActions: step === 1,
      allowPhotoCapture: step === 3,
      allowQuickNote: step === 7,
      showQuickActionsWhenPaused: true,
      forceQuickActionsOpen: step === 6 || step === 7,
      forcedTab: step === 4 ? "album" : step === 5 || step === 8 ? "entry" : "map",
      focusLatestActivity: step === 8,
      tutorialMockPhotoUri: mockPhotoUri,
      onQuickActionsOpened: () => { if (step === 1) { playHaptic("selection"); setStep(2); } },
      onQuickNoteOpened: () => { if (step === 7) setPhotoFlowOpen(true); },
      onQuickNoteSaved: () => { setPhotoFlowOpen(false); setStep(8); },
      onQuickNoteDiscarded: () => setPhotoFlowOpen(false),
      onPhotoCaptureStarted: () => setPhotoFlowOpen(true),
      onPhotoCaptureFinished: (captured) => { if (!captured) setPhotoFlowOpen(false); },
      onPhotoSaved: () => { setMockPhotoUri(null); setPhotoFlowOpen(false); setStep(4); },
      onPhotoDiscarded: () => { setMockPhotoUri(null); setPhotoFlowOpen(false); },
      }} />
      <PhotoQuestGuideOverlay step={step} onNext={advance} onMockPhoto={openMockPhoto} onDeferredNote={deferQuickNote} width={width} height={height} topInset={insets.top} bottomInset={insets.bottom} hidden={photoFlowOpen || handoffPromptVisible || handoffInProgress} />
    </Animated.View>
    <Modal visible={handoffPromptVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={styles.handoffBackdrop}>
        <View accessibilityViewIsModal style={styles.handoffCard}>
          <View style={styles.handoffIcon}><Ionicons name="compass" size={27} color={T.blue} /></View>
          <Text style={styles.handoffTitle}>Let’s continue with the quest</Text>
          <Text style={styles.handoffBody}>Your quest will keep running while you finish these questions. Open it anytime from the side to pause it, add a note or photo, and view your progress.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Continue with the quest" onPress={continueToQuestions} style={({ pressed }) => [styles.handoffButton, pressed && styles.handoffButtonPressed]}><Text style={styles.handoffButtonText}>Continue</Text><Ionicons name="arrow-forward" size={18} color={T.white} /></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  overlayBlocker: { position: "absolute", zIndex: 4, backgroundColor: "transparent" },
  spotlight: { position: "absolute", zIndex: 5, borderRadius: 22, borderWidth: 2, borderColor: "rgba(255,255,255,0.94)", boxShadow: "0px 0px 0px 2px rgba(77,168,255,0.85)" },
  guideCard: { position: "absolute", zIndex: 8, left: 20, right: 20, gap: 9, borderRadius: 22, borderWidth: 3, borderColor: T.border, borderBottomWidth: 6, borderBottomColor: "#d7cec2", backgroundColor: T.white, padding: 18 },
  progress: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressText: { color: T.muted, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.border },
  dotActive: { backgroundColor: T.blue },
  title: { color: T.dark, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 27, fontWeight: "900" },
  body: { color: T.muted, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  nextButton: { minHeight: 48, marginTop: 3, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: T.blue, borderBottomWidth: 5, borderBottomColor: "#258fd8" },
  nextButtonPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 2 },
  nextText: { color: T.white, fontSize: 15, fontWeight: "900" },
  tapHint: { alignSelf: "center", minHeight: 36, marginTop: 4, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 99, borderWidth: 2, borderColor: T.blue, backgroundColor: `${T.blue}12` },
  tapHintText: { color: T.blue, fontSize: 14, fontWeight: "900" },
  photoActions: { alignItems: "center", gap: 7 },
  skipButton: { minHeight: 30, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  skipButtonPressed: { opacity: 0.68 },
  skipText: { color: T.muted, fontSize: 13, lineHeight: 18, fontWeight: "800", textDecorationLine: "underline" },
  waitingText: { color: T.muted, fontSize: 13, lineHeight: 18, fontWeight: "800", textAlign: "center" },
  handoffBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(35,40,37,0.66)", padding: 24 },
  handoffCard: { width: "100%", maxWidth: 360, alignItems: "center", gap: 10, borderRadius: 24, borderWidth: 3, borderColor: T.border, borderBottomWidth: 6, borderBottomColor: "#d7cec2", backgroundColor: T.white, padding: 22 },
  handoffIcon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: `${T.blue}16` },
  handoffTitle: { color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28, textAlign: "center" },
  handoffBody: { maxWidth: 290, color: T.muted, fontSize: 15, lineHeight: 21, fontWeight: "700", textAlign: "center" },
  handoffButton: { alignSelf: "stretch", minHeight: 54, marginTop: 4, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: T.blue, borderBottomWidth: 5, borderBottomColor: "#258fd8" },
  handoffButtonPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 2 },
  handoffButtonText: { color: T.white, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, fontWeight: "900" },
});
