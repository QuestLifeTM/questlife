import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Mask, Rect } from "react-native-svg";

import { ActiveQuestScreen, QuestCountdownOverlay, type QuestCountdownStep } from "@/screens/active-quest-screen";
import { T } from "@/components/theme";
import { haptic } from "@/components/ui";
import { useGuestQuest } from "@/contexts/GuestQuestContext";
import { useActiveQuest } from "@/contexts/ActiveQuestContext";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { playHaptic } from "@/motion/haptics";
import { OnboardingActiveQuestDrawer } from "@/components/onboarding-active-quest-drawer";

const iphoneMockup = require("../../assets/onboarding/iphone-mockup.png");
const REFERENCE_WIDTH = 390;
const REFERENCE_HEIGHT = 844;
const GUIDE_EXIT_DURATION_MS = 220;
const GUIDE_ENTER_DURATION_MS = 520;
const GUIDE_TRANSITION_TIMEOUT_MS = GUIDE_EXIT_DURATION_MS + GUIDE_ENTER_DURATION_MS + 260;

type GuideStep = 0 | 1 | 2 | 3 | 4;
type Stage = "guide" | "countdown" | "started" | "handoff" | "parked";

function traceGuide(event: string, details: Record<string, unknown>) {
  if (__DEV__) console.info(`[QuestLife onboarding] ${event}`, details);
}

const guideContent: Array<{ title: string; body: string; action?: string }> = [
  { title: "Your active quest", body: "Every quest you start lives here." },
  { title: "Map your moments", body: "Turn on route recording to map the places you explore.", action: "Enable route recording" },
  { title: "See the whole story", body: "Map leads the way. Memories and Activity fill as you go." },
  { title: "Everything within reach", body: "Time stays here. Pause anytime. + holds notes, photos, and your finish line." },
  { title: "Ready when you are", body: "Let’s start your quest." },
];

function spotlightFor(step: GuideStep, width: number, height: number, topInset: number, bottomInset: number) {
  if (step === 0) return { x: 14, y: topInset + 4, width: width - 28, height: 112 };
  // The map is an edge-to-edge surface. Keep it bright from its top edge down
  // to the floating timer rather than drawing an unrelated rounded card over it.
  if (step === 1) return { x: 0, y: topInset + 250, width, height: Math.max(164, height - topInset - bottomInset - 386) };
  // Mirrors ActiveQuestTabs: 20px side gutters, 5px inner padding, and a
  // 60px control height. Keeping this tight prevents map content leaking in.
  if (step === 2) return { x: 12, y: topInset + 66, width: width - 24, height: 80 };
  if (step === 3) return { x: 14, y: height - bottomInset - 92, width: width - 28, height: 96 };
  return { x: 14, y: topInset + 104, width: width - 28, height: 120 };
}

function GuideOverlay({ step, onNext, onStart, onRouteHintPress, width, height, topInset, bottomInset, cardOpacity, cardTranslateY, overlayOpacity, spotlightScale, spotlightTranslateX, spotlightTranslateY, transitioning }: { step: GuideStep; onNext: () => void; onStart: () => void; onRouteHintPress: () => void; width: number; height: number; topInset: number; bottomInset: number; cardOpacity: Animated.Value; cardTranslateY: Animated.Value; overlayOpacity: Animated.Value; spotlightScale: Animated.Value; spotlightTranslateX: Animated.Value; spotlightTranslateY: Animated.Value; transitioning: boolean }) {
  const target = spotlightFor(step, width, height, topInset, bottomInset);
  const showActionHint = step === 1;
  const isIntroduction = step === 0;
  const isFinalStep = step === 4;
  const isRouteStep = step === 1;
  const spotlightRadius = step === 1 ? 0 : 22;
  const maskId = `guest-guide-spotlight-${step}`;
  // Keep the permission CTA in the lower half of the map completely clear.
  const cardTop = step === 1 ? Math.max(topInset + 12, 24) : step === 3 ? Math.max(topInset + 212, height - bottomInset - 340) : undefined;
  const cardBottom = step === 1 || step === 3 ? undefined : isIntroduction ? Math.max(bottomInset, 8) : Math.max(bottomInset + 118, 132);
  const finalCardTop = Math.round(height / 2 - 104);
  const content = guideContent[step];

  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {!isIntroduction && !isFinalStep ? <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs><Mask id={maskId} x="0" y="0" width={width} height={height} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"><Rect x="0" y="0" width={width} height={height} fill="#fff" /><Rect x={target.x} y={target.y} width={target.width} height={target.height} rx={spotlightRadius} ry={spotlightRadius} fill="#000" /></Mask></Defs>
          <Rect x="0" y="0" width={width} height={height} fill="rgba(0,0,0,0.76)" mask={`url(#${maskId})`} />
        </Svg>
      </Animated.View>
      {!isRouteStep ? <>
        <Pressable accessibilityLabel="Tutorial overlay" onPress={() => undefined} style={[styles.overlayBlocker, { left: 0, right: 0, top: 0, height: target.y }]} />
        <Pressable accessibilityLabel="Tutorial overlay" onPress={() => undefined} style={[styles.overlayBlocker, { left: 0, right: 0, top: target.y + target.height, bottom: 0 }]} />
        <Pressable accessibilityLabel="Tutorial overlay" onPress={() => undefined} style={[styles.overlayBlocker, { left: 0, width: target.x, top: target.y, height: target.height }]} />
        <Pressable accessibilityLabel="Tutorial overlay" onPress={() => undefined} style={[styles.overlayBlocker, { left: target.x + target.width, right: 0, top: target.y, height: target.height }]} />
      </> : null}
      <Animated.View pointerEvents="none" style={[styles.spotlight, { left: target.x, top: target.y, width: target.width, height: target.height, borderRadius: spotlightRadius, transform: [{ translateX: spotlightTranslateX }, { translateY: spotlightTranslateY }, { scale: spotlightScale }] }]} />
    </> : null}
    {isFinalStep ? <Animated.View pointerEvents="auto" style={[styles.fullOverlay, { opacity: overlayOpacity }]}><Pressable accessibilityLabel="Tutorial overlay" onPress={() => undefined} style={StyleSheet.absoluteFill} /></Animated.View> : null}
    <Animated.View pointerEvents={isRouteStep ? "box-none" : "auto"} style={[styles.guideCard, { top: isFinalStep ? finalCardTop : cardTop, bottom: isFinalStep ? undefined : cardBottom, opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] }]} accessibilityViewIsModal>
      <View style={styles.guideProgress}><Text style={styles.guideProgressText}>{step + 1} of {guideContent.length}</Text><View style={styles.guideProgressDots}>{guideContent.map((_, index) => <View key={index} style={[styles.guideDot, index <= step && styles.guideDotActive]} />)}</View></View>
      <Text style={styles.guideTitle}>{content.title}</Text>
      <Text style={styles.guideBody}>{content.body}</Text>
      {showActionHint ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: transitioning }} disabled={transitioning} accessibilityLabel="Show the route recording button" onPress={() => { haptic(); onRouteHintPress(); }} style={({ pressed }) => [styles.guideActionHint, transitioning && styles.guideActionDisabled, pressed && styles.guideActionHintPressed]}><Ionicons name="arrow-down" size={16} color={T.blue} /><Text style={styles.guideActionHintText}>Tap Enable route recording</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityState={{ disabled: transitioning }} disabled={transitioning} accessibilityLabel={step === 4 ? "Start quest" : "Next tutorial step"} onPress={() => step === 4 ? onStart() : onNext()} style={({ pressed }) => [styles.guideNextButton, transitioning && styles.guideActionDisabled, pressed && !transitioning && styles.guideNextButtonPressed]}><Text style={styles.guideNextText}>{step === 4 ? "Start quest" : "Next"}</Text><Ionicons name={step === 4 ? "play" : "arrow-forward"} size={18} color={T.white} /></Pressable>}
    </Animated.View>
  </View>;
}

function QuestPhonePreview({ width, height, onPress }: { width: number; height: number; onPress: () => void }) {
  const screenWidth = width * 0.856;
  const screenHeight = height * 0.9085;
  const scale = Math.min(screenWidth / REFERENCE_WIDTH, screenHeight / REFERENCE_HEIGHT);
  return <View style={{ width, height }}>
    <View pointerEvents="none" style={{ position: "absolute", left: "7.02%", top: "4.4%", width: "85.6%", height: "90.85%", overflow: "hidden", borderRadius: Math.round(width * 0.085), backgroundColor: T.bg }}>
      <View style={{ position: "absolute", width: REFERENCE_WIDTH, height: REFERENCE_HEIGHT, left: (screenWidth - REFERENCE_WIDTH) / 2, top: (screenHeight - REFERENCE_HEIGHT) / 2, transform: [{ scale }] }}>
        <ActiveQuestScreen preview onboarding={{ locked: true, hideExit: true, holdCountdown: true }} />
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Quest preview. Features unlock as you continue." onPress={onPress} style={{ position: "absolute", left: "7.02%", top: "4.4%", width: "85.6%", height: "90.85%", zIndex: 2 }} />
    <Image pointerEvents="none" source={iphoneMockup} contentFit="fill" style={StyleSheet.absoluteFill} />
  </View>;
}

export default function GuestActiveQuestOnboarding() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const { guestTutorialComplete, completeGuestTutorial } = useGuestQuest();
  const { resume } = useActiveQuest();
  // `resume` changes identity as the session snapshot updates. Keeping the
  // current callback here prevents that update from replaying the countdown.
  const resumeRef = useRef(resume);
  const hasStartedQuest = useRef(false);
  resumeRef.current = resume;
  // Always begin in guide mode. A completed tutorial redirects below rather
  // than rendering the old parked preview when this route is restored.
  const [stage, setStage] = useState<Stage>("guide");
  const [guideStep, setGuideStep] = useState<GuideStep>(0);
  const [guideTransitioning, setGuideTransitioning] = useState(false);
  const [countdownStep, setCountdownStep] = useState<QuestCountdownStep>(3);
  const [routeHintNudge, setRouteHintNudge] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewHintVisible, setPreviewHintVisible] = useState(false);
  const screenScale = useRef(new Animated.Value(1)).current;
  const screenX = useRef(new Animated.Value(0)).current;
  const screenY = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const drawerProgress = useRef(new Animated.Value(-1)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const guideCardOpacity = useRef(new Animated.Value(1)).current;
  const guideCardTranslateY = useRef(new Animated.Value(0)).current;
  const guideOverlayOpacity = useRef(new Animated.Value(1)).current;
  const spotlightScale = useRef(new Animated.Value(1)).current;
  const spotlightTranslateX = useRef(new Animated.Value(0)).current;
  const spotlightTranslateY = useRef(new Animated.Value(0)).current;
  const startedOpacity = useRef(new Animated.Value(0)).current;
  const startedScale = useRef(new Animated.Value(0.94)).current;
  const parkedControlOpacity = useRef(new Animated.Value(0)).current;
  const parkedControlTranslateY = useRef(new Animated.Value(-8)).current;
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const handoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guideAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guideSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guideTransitionId = useRef(0);
  const guideHasEntered = useRef(false);
  const startRequested = useRef(false);

  const phoneWidth = Math.min(width * 0.74, 310, Math.max(210, (height - insets.top - insets.bottom - 128) * (1624 / 3407)));
  const phoneHeight = phoneWidth * (3407 / 1624);

  useEffect(() => {
    if (!guestTutorialComplete || stage !== "guide") return;
    router.replace({ pathname: "/onboarding/questions-intro", params: firstName ? { firstName } : {} });
  }, [firstName, guestTutorialComplete, stage]);

  useEffect(() => {
    if (stage !== "guide" || guideHasEntered.current) return;
    guideHasEntered.current = true;
    if (reduceMotion) return;
    guideCardOpacity.setValue(0);
    guideCardTranslateY.setValue(18);
    Animated.parallel([
      Animated.timing(guideCardOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(guideCardTranslateY, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
    ]).start();
  }, [guideCardOpacity, guideCardTranslateY, reduceMotion, stage]);

  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    countdownTimers.current.forEach(clearTimeout);
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
    if (guideAdvanceTimer.current) clearTimeout(guideAdvanceTimer.current);
    if (guideSettleTimer.current) clearTimeout(guideSettleTimer.current);
  }, []);

  useEffect(() => {
    traceGuide("state", { stage, step: guideStep + 1, transitioning: guideTransitioning });
  }, [guideStep, guideTransitioning, stage]);

  useEffect(() => {
    if (stage !== "parked") return;
    Animated.timing(drawerProgress, { toValue: drawerOpen ? 0 : -1, duration: reduceMotion ? 0 : 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [drawerOpen, drawerProgress, reduceMotion, stage]);

  useEffect(() => {
    if (stage !== "countdown") return;
    const clearCountdownTimers = () => {
      countdownTimers.current.forEach(clearTimeout);
      countdownTimers.current = [];
    };
    clearCountdownTimers();
    setCountdownStep(3);
    if (reduceMotion) {
      countdownTimers.current = [setTimeout(() => setStage("started"), 300)];
      return clearCountdownTimers;
    }
    const phases: Array<{ delay: number; step: QuestCountdownStep }> = [
      { delay: 1_250, step: 2 },
      { delay: 2_500, step: 1 },
      { delay: 3_750, step: "GO" },
    ];
    countdownTimers.current = [
      ...phases.map(({ delay, step }) => setTimeout(() => {
        setCountdownStep(step);
        playHaptic(step === "GO" ? "success" : "selection");
        if (step === "GO" && !hasStartedQuest.current) {
          // The tutorial owns its countdown, but the local quest must become
          // real at GO so the drawer can show a running timer and live route.
          hasStartedQuest.current = true;
          void resumeRef.current().catch(() => traceGuide("quest-start-failed", { reason: "resume" }));
        }
      }, delay)),
      setTimeout(() => setStage("started"), 5_000),
    ];
    return clearCountdownTimers;
  }, [reduceMotion, stage]);

  useEffect(() => {
    if (stage !== "started") return;
    startedOpacity.setValue(0);
    startedScale.setValue(0.94);
    Animated.parallel([
      Animated.timing(startedOpacity, { toValue: 1, duration: reduceMotion ? 0 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(startedScale, { toValue: 1, friction: 8, tension: 110, useNativeDriver: true }),
    ]).start();
    handoffTimer.current = setTimeout(() => setStage("handoff"), reduceMotion ? 260 : 1_050);
    return () => {
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
    };
  }, [reduceMotion, stage, startedOpacity, startedScale]);

  useEffect(() => {
    if (stage !== "parked") return;
    parkedControlOpacity.setValue(0);
    parkedControlTranslateY.setValue(-8);
    Animated.parallel([
      Animated.timing(parkedControlOpacity, { toValue: 1, duration: reduceMotion ? 0 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(parkedControlTranslateY, { toValue: 0, duration: reduceMotion ? 0 : 300, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
    ]).start();
  }, [parkedControlOpacity, parkedControlTranslateY, reduceMotion, stage]);

  const transitionGuide = useCallback((nextStep: GuideStep) => {
    if (guideTransitioning || nextStep === guideStep) return;
    setGuideTransitioning(true);
    playHaptic("selection");
    const transitionId = guideTransitionId.current + 1;
    guideTransitionId.current = transitionId;
    traceGuide("guide-transition-start", { from: guideStep + 1, to: nextStep + 1, transitionId });
    if (reduceMotion) {
      setGuideStep(nextStep);
      setGuideTransitioning(false);
      traceGuide("guide-transition-complete", { step: nextStep + 1, transitionId, reducedMotion: true });
      return;
    }

    const currentSpotlight = spotlightFor(guideStep, width, height, insets.top, insets.bottom);
    const nextSpotlight = spotlightFor(nextStep, width, height, insets.top, insets.bottom);
    const settle = (reason: "animation" | "fallback") => {
      if (guideTransitionId.current !== transitionId) return;
      if (guideAdvanceTimer.current) clearTimeout(guideAdvanceTimer.current);
      if (guideSettleTimer.current) clearTimeout(guideSettleTimer.current);
      guideCardOpacity.stopAnimation();
      guideCardTranslateY.stopAnimation();
      guideOverlayOpacity.stopAnimation();
      spotlightScale.stopAnimation();
      spotlightTranslateX.stopAnimation();
      spotlightTranslateY.stopAnimation();
      guideCardOpacity.setValue(1);
      guideCardTranslateY.setValue(0);
      guideOverlayOpacity.setValue(1);
      spotlightScale.setValue(1);
      spotlightTranslateX.setValue(0);
      spotlightTranslateY.setValue(0);
      setGuideTransitioning(false);
      traceGuide("guide-transition-complete", { step: nextStep + 1, transitionId, reason });
    };
    const enterNextStep = () => {
      if (guideTransitionId.current !== transitionId) return;
      if (guideAdvanceTimer.current) clearTimeout(guideAdvanceTimer.current);
      setGuideStep(nextStep);
      guideCardOpacity.setValue(0.16);
      guideCardTranslateY.setValue(30);
      guideOverlayOpacity.setValue(0.68);
      spotlightScale.setValue(0.88);
      spotlightTranslateX.setValue(currentSpotlight.x - nextSpotlight.x);
      spotlightTranslateY.setValue(currentSpotlight.y - nextSpotlight.y);
      Animated.parallel([
        Animated.timing(guideCardOpacity, { toValue: 1, duration: GUIDE_ENTER_DURATION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(guideCardTranslateY, { toValue: 0, duration: GUIDE_ENTER_DURATION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(guideOverlayOpacity, { toValue: 1, duration: 440, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(spotlightScale, { toValue: 1, friction: 9, tension: 90, useNativeDriver: true }),
        Animated.timing(spotlightTranslateX, { toValue: 0, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(spotlightTranslateY, { toValue: 0, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) settle("animation");
      });
    };

    Animated.parallel([
      Animated.timing(guideCardOpacity, { toValue: 0.34, duration: GUIDE_EXIT_DURATION_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(guideCardTranslateY, { toValue: -18, duration: GUIDE_EXIT_DURATION_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(guideOverlayOpacity, { toValue: 0.68, duration: GUIDE_EXIT_DURATION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) enterNextStep();
    });
    // Animation callbacks are not guaranteed when the app is interrupted.
    // Advance and settle independently so the guide cannot remain translucent
    // or leave its primary action disabled.
    guideAdvanceTimer.current = setTimeout(enterNextStep, GUIDE_EXIT_DURATION_MS + 40);
    guideSettleTimer.current = setTimeout(() => settle("fallback"), GUIDE_TRANSITION_TIMEOUT_MS);
  }, [guideCardOpacity, guideCardTranslateY, guideOverlayOpacity, guideStep, guideTransitioning, height, insets.bottom, insets.top, reduceMotion, spotlightScale, spotlightTranslateX, spotlightTranslateY, width]);

  const finishHandoff = useCallback(() => {
    // The active-quest walkthrough has done its job; move directly into the
    // real preference question instead of leaving the user at a parked preview.
    // Storage must never hold the user on this transition.
    void completeGuestTutorial().catch(() => undefined);
    router.replace({ pathname: "/onboarding/questions-intro", params: firstName ? { firstName } : {} });
  }, [completeGuestTutorial, firstName]);

  const startQuest = useCallback(() => {
    if (startRequested.current) return;
    startRequested.current = true;
    setGuideTransitioning(true);
    playHaptic("commit");
    setStage("countdown");
  }, []);

  useEffect(() => {
    if (stage !== "handoff") return;
    let handedOff = false;
    const handoff = () => {
      if (handedOff) return;
      handedOff = true;
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
      finishHandoff();
    };
    screenScale.setValue(1);
    screenX.setValue(0);
    screenY.setValue(0);
    screenOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(screenScale, { toValue: 0.94, duration: reduceMotion ? 0 : 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(screenOpacity, { toValue: 0, duration: reduceMotion ? 0 : 360, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) handoff();
    });
    // Native animations may be interrupted by a lifecycle change. The next
    // onboarding question must never depend on their completion callback.
    handoffTimer.current = setTimeout(handoff, reduceMotion ? 120 : 1_000);
    return () => {
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
    };
  }, [finishHandoff, reduceMotion, screenOpacity, screenScale, screenX, screenY, stage]);

  const showPreviewHint = useCallback(() => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setPreviewHintVisible(true);
    Animated.timing(hintOpacity, { toValue: 1, duration: 170, useNativeDriver: true }).start();
    hintTimer.current = setTimeout(() => {
      Animated.timing(hintOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setPreviewHintVisible(false));
    }, 2_400);
  }, [hintOpacity]);

  const screenGuideStep = stage === "guide" ? (["overview", "route", "tabs", "controls", "final"] as const)[guideStep] : undefined;
  const isGuiding = stage === "guide";

  return <View style={styles.root}>
    {stage === "parked" ? <View style={styles.blankStage}>
      <Animated.View style={[styles.questDrawerEntrance, { top: Math.round(height * 0.62 - 32), opacity: parkedControlOpacity, transform: [{ translateY: parkedControlTranslateY }] }]}><Pressable accessibilityRole="button" accessibilityLabel={drawerOpen ? "Close quest preview" : "Open quest preview"} accessibilityHint="Shows your active quest in a side drawer" accessibilityState={{ expanded: drawerOpen }} onPress={() => { haptic(); setDrawerOpen((open) => !open); }} style={({ pressed }) => [styles.questDrawerButton, pressed && styles.questDrawerButtonPressed]}>
        <Ionicons name={drawerOpen ? "chevron-back" : "chevron-forward"} size={24} color={T.blue} />
      </Pressable></Animated.View>
      <Animated.View style={[styles.phoneDrawer, { top: insets.top + 86, width: phoneWidth, height: phoneHeight, transform: [{ translateX: drawerProgress.interpolate({ inputRange: [-1, 0], outputRange: [-phoneWidth - 72, 0] }) }] }]}>
        <QuestPhonePreview width={phoneWidth} height={phoneHeight} onPress={showPreviewHint} />
      </Animated.View>
      {previewHintVisible ? <Animated.View pointerEvents="none" style={[styles.previewHint, { opacity: hintOpacity }]}><Ionicons name="sparkles" size={16} color={T.blue} /><Text style={styles.previewHintText}>Don’t worry—we’ll explore each feature as you go.</Text></Animated.View> : null}
    </View> : <Animated.View style={[StyleSheet.absoluteFill, { opacity: screenOpacity, transform: [{ translateX: screenX }, { translateY: screenY }, { scale: screenScale }] }]}>
      <ActiveQuestScreen onboarding={{ locked: true, hideExit: true, holdCountdown: true, guideStep: screenGuideStep, routePromptNudge: routeHintNudge, onRouteRecordingRequested: () => transitionGuide(2) }} />
      {isGuiding ? <GuideOverlay step={guideStep} onNext={() => transitionGuide(Math.min(4, guideStep + 1) as GuideStep)} onStart={startQuest} onRouteHintPress={() => setRouteHintNudge((current) => current + 1)} width={width} height={height} topInset={insets.top} bottomInset={insets.bottom} cardOpacity={guideCardOpacity} cardTranslateY={guideCardTranslateY} overlayOpacity={guideOverlayOpacity} spotlightScale={spotlightScale} spotlightTranslateX={spotlightTranslateX} spotlightTranslateY={spotlightTranslateY} transitioning={guideTransitioning} /> : null}
      {stage === "countdown" ? <QuestCountdownOverlay step={countdownStep} accent={T.blue} /> : null}
      {stage === "started" ? <Animated.View pointerEvents="none" style={[styles.startedMessage, { opacity: startedOpacity, transform: [{ scale: startedScale }] }]}><View style={styles.startedIcon}><Ionicons name="checkmark" size={22} color={T.white} /></View><Text style={styles.startedTitle}>Quest started</Text><Text style={styles.startedBody}>Let’s keep your phone aside for now.</Text></Animated.View> : null}
    </Animated.View>}
    {stage === "handoff" ? <OnboardingActiveQuestDrawer initiallyOpen autoPark /> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  overlayBlocker: { position: "absolute", zIndex: 4, backgroundColor: "transparent" },
  fullOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 4, backgroundColor: "rgba(0,0,0,0.76)" },
  spotlight: { position: "absolute", zIndex: 5, borderRadius: 22, borderWidth: 2, borderColor: "rgba(255,255,255,0.94)", boxShadow: "0px 0px 0px 2px rgba(77,168,255,0.85)" },
  guideCard: { position: "absolute", zIndex: 8, left: 20, right: 20, gap: 9, borderRadius: 22, borderWidth: 3, borderColor: T.border, borderBottomWidth: 6, borderBottomColor: "#d7cec2", backgroundColor: T.white, padding: 18 },
  guideProgress: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  guideProgressText: { color: T.muted, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  guideProgressDots: { flexDirection: "row", gap: 5 },
  guideDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.border },
  guideDotActive: { backgroundColor: T.blue },
  guideTitle: { color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28, fontWeight: "900" },
  guideBody: { color: T.muted, fontSize: 15, lineHeight: 21, fontWeight: "700" },
  guideNextButton: { minHeight: 48, marginTop: 3, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: T.blue, borderBottomWidth: 5, borderBottomColor: "#258fd8" },
  guideNextButtonPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 2 },
  guideNextText: { color: T.white, fontSize: 15, fontWeight: "900" },
  guideActionHint: { alignSelf: "center", minHeight: 36, marginTop: 5, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 99, borderWidth: 2, borderColor: T.blue, backgroundColor: `${T.blue}12` },
  guideActionDisabled: { opacity: 0.58 },
  guideActionHintPressed: { opacity: 0.72, transform: [{ translateY: 1 }] },
  guideActionHintText: { color: T.blue, fontSize: 14, fontWeight: "900" },
  startedMessage: { position: "absolute", zIndex: 9, left: 26, right: 26, top: "42%", alignItems: "center", gap: 8, borderRadius: 24, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#d7cec2", padding: 22 },
  startedIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: T.green },
  startedTitle: { color: T.dark, fontFamily: "RubikBlack", fontSize: 23, lineHeight: 28 },
  startedBody: { color: T.muted, fontSize: 15, fontWeight: "700" },
  blankStage: { flex: 1, backgroundColor: T.bg },
  questDrawerEntrance: { position: "absolute", zIndex: 3, left: 0 },
  questDrawerButton: { width: 44, minHeight: 64, alignItems: "center", justifyContent: "center", borderTopRightRadius: 16, borderBottomRightRadius: 16, borderWidth: 2, borderLeftWidth: 0, borderColor: T.blue, backgroundColor: `${T.blue}12` },
  questDrawerButtonPressed: { transform: [{ translateX: -2 }], opacity: 0.78 },
  phoneDrawer: { position: "absolute", zIndex: 2, left: 62, top: 86 },
  previewHint: { position: "absolute", zIndex: 5, left: 22, right: 22, bottom: 42, minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, borderBottomWidth: 4, borderBottomColor: "#d7cec2", paddingHorizontal: 15 },
  previewHintText: { flex: 1, color: T.dark, fontSize: 13, lineHeight: 18, fontWeight: "800" },
});
