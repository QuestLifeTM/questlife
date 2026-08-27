import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { memo, useEffect, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, StyleSheet, Text, View, type LayoutChangeEvent, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/components/theme";
import { SoftButton, haptic } from "@/components/ui";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { ActiveQuestScreen } from "@/screens/active-quest-screen";
import { ExploreScreen } from "@/screens/explore-screen";
import { JournalScreen, type JournalScreenPreview } from "@/screens/journal-screen";
import type { ActiveQuestRoutePoint } from "@/types/active-quest";
import type { Quest } from "@/types/content";

const stoneArchBackground = require("../assets/onboarding/stone-arch-background.png");
const iphoneMockup = require("../assets/onboarding/iphone-mockup.png");
type DemoPhase = "title" | "explore" | "active" | "journal";

// These records are intentionally shaped exactly like the data the app reads
// in production. They are the only fake part of this walkthrough; every
// surface below is the production screen component.
const DEMO_QUESTS: Quest[] = [
  { id: "demo-scenic-stroll", title: "Take a scenic stroll", category: "ADVENTURE", xp: 120, description: "Follow a fresh route and notice three things you have never seen before.", steps: ["Pick a route that feels a little new.", "Notice three details you would usually walk past.", "Add a note or photo before you head home."], timeMin: 20, timeLabel: "20 min", difficulty: "EASY", status: "published", featured: true, color: T.blue, saved: false, completed: false, createdByLabel: "QuestLifeTeam" },
  { id: "demo-local-treat", title: "Try a local treat", category: "FOOD AND DRINKS", xp: 160, description: "Pick a place you have been curious about and try one small thing.", steps: [], timeMin: 30, timeLabel: "30 min", difficulty: "EASY", status: "published", featured: false, color: T.orange, saved: false, completed: false },
  { id: "demo-tiny-masterpiece", title: "Make a tiny masterpiece", category: "CREATIVITY", xp: 140, description: "Use what is around you to create something worth remembering.", steps: [], timeMin: 25, timeLabel: "25 min", difficulty: "MEDIUM", status: "published", featured: false, color: T.purple, saved: false, completed: false },
  { id: "demo-call", title: "Call someone who matters", category: "SOCIAL", xp: 100, description: "Make a little time for someone who always lifts your mood.", steps: [], timeMin: 15, timeLabel: "15 min", difficulty: "EASY", status: "published", featured: false, color: T.teal, saved: false, completed: false },
  { id: "demo-favorite-view", title: "Find your favorite view", category: "ADVENTURE", xp: 180, description: "Head somewhere open and take in the view without rushing.", steps: [], timeMin: 35, timeLabel: "35 min", difficulty: "EASY", status: "published", featured: false, color: T.blue, saved: false, completed: false },
  { id: "demo-playlist", title: "Move to a new playlist", category: "FITNESS", xp: 130, description: "Take a walk, stretch, or dance to a song that changes your energy.", steps: [], timeMin: 20, timeLabel: "20 min", difficulty: "EASY", status: "published", featured: false, color: T.pink, saved: false, completed: false },
  { id: "demo-future-note", title: "Write a note to future you", category: "CREATIVITY", xp: 110, description: "Save a small thought about today for your future self.", steps: [], timeMin: 15, timeLabel: "15 min", difficulty: "EASY", status: "published", featured: false, color: T.purple, saved: false, completed: false },
  { id: "demo-hidden-corner", title: "Discover a hidden corner", category: "ADVENTURE", xp: 210, description: "Let a new street or path choose the next part of your day.", steps: [], timeMin: 40, timeLabel: "40 min", difficulty: "MEDIUM", status: "published", featured: false, color: T.blue, saved: false, completed: false },
  { id: "demo-spontaneous-plan", title: "Share a spontaneous plan", category: "SOCIAL", xp: 150, description: "Invite someone along for one simple, low-pressure adventure.", steps: [], timeMin: 25, timeLabel: "25 min", difficulty: "EASY", status: "published", featured: false, color: T.teal, saved: false, completed: false },
  { id: "demo-seasonal", title: "Find something delicious", category: "FOOD AND DRINKS", xp: 170, description: "Try a dish, drink, or snack that is new to you.", steps: [], timeMin: 30, timeLabel: "30 min", difficulty: "EASY", status: "published", featured: false, color: T.orange, saved: false, completed: false },
];

const DEMO_ACTIVE_QUEST: Quest = {
  id: "demo-sunset-walk",
  title: "Find a new city view",
  category: "ADVENTURE",
  xp: 180,
  description: "Take a different route and pause somewhere with a view.",
  steps: ["Take a new turn.", "Find a view worth remembering."],
  timeMin: 45,
  timeLabel: "45 min",
  difficulty: "EASY",
  status: "published",
  featured: false,
  color: T.blue,
  saved: false,
  completed: false,
};

const DEMO_ACTIVE_ROUTE: ActiveQuestRoutePoint[] = [
  { id: 1, sessionId: "preview-sf-route", capturedAt: "2026-08-15T16:00:00.000Z", latitude: 37.7745, longitude: -122.4194, accuracy: 8, speed: 1.2, altitude: null, heading: 45 },
  { id: 2, sessionId: "preview-sf-route", capturedAt: "2026-08-15T16:18:00.000Z", latitude: 37.7762, longitude: -122.417, accuracy: 7, speed: 1.1, altitude: null, heading: 38 },
  { id: 3, sessionId: "preview-sf-route", capturedAt: "2026-08-15T16:42:00.000Z", latitude: 37.7781, longitude: -122.4148, accuracy: 6, speed: 1.3, altitude: null, heading: 34 },
  { id: 4, sessionId: "preview-sf-route", capturedAt: "2026-08-15T17:10:00.000Z", latitude: 37.7798, longitude: -122.4128, accuracy: 7, speed: 1.1, altitude: null, heading: 32 },
];

function localDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function previewJournal(): JournalScreenPreview {
  const today = new Date();
  const key = localDateKey(today);
  return {
    todayKey: key,
    data: {
      joinedAt: today.toISOString(),
      entriesByDate: { [key]: { entryDate: key, title: "A day worth remembering", mood: "happy" } },
      memoriesByDate: { [key]: [{ completionId: "demo-city-view", questId: DEMO_ACTIVE_QUEST.id, title: DEMO_ACTIVE_QUEST.title, reflection: "I found a new corner of the city and stayed for the sunset.", completedAt: today.toISOString(), xp: DEMO_ACTIVE_QUEST.xp, category: DEMO_ACTIVE_QUEST.category, difficulty: DEMO_ACTIVE_QUEST.difficulty, color: DEMO_ACTIVE_QUEST.color, timeMin: DEMO_ACTIVE_QUEST.timeMin, photoPaths: [], participants: [] }] },
      activeQuest: null,
    },
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

const PhoneScreen = memo(function PhoneScreen({ phase, scale, width, height, journal, exploreAutoScrollEnabled = true }: { phase: Exclude<DemoPhase, "title">; scale: number; width: number; height: number; journal: JournalScreenPreview; exploreAutoScrollEnabled?: boolean }) {
  const content = phase === "explore" ? <ExploreScreen previewQuests={DEMO_QUESTS} previewAutoScroll previewAutoScrollEnabled={exploreAutoScrollEnabled} />
    : phase === "active" ? <ActiveQuestScreen preview previewQuest={DEMO_ACTIVE_QUEST} previewRoute={DEMO_ACTIVE_ROUTE} previewElapsedMs={4_200_000} />
      : <JournalScreen preview={journal} />;

  return <View pointerEvents="none" style={styles.previewClip}>
    <View style={[styles.previewCanvas, { width, height, transform: [{ scale }] }]}>{content}</View>
  </View>;
});

export function UnderstandingDemo({ firstName }: { firstName: string }) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const [phase, setPhase] = useState<DemoPhase>("title");
  const [showContinue, setShowContinue] = useState(false);
  const [exploreAutoScrollEnabled, setExploreAutoScrollEnabled] = useState(true);
  const [showExplorePhone, setShowExplorePhone] = useState(true);
  const [showActivePhone, setShowActivePhone] = useState(false);
  const [subtitleBottom, setSubtitleBottom] = useState<number | null>(null);
  const [continueTop, setContinueTop] = useState<number | null>(null);
  // The opening message commonly spans two lines; this keeps it centered from
  // the first frame, before its exact rendered height is measured.
  const [titleHeight, setTitleHeight] = useState(60);
  const titleLift = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const screenCopyOpacity = useRef(new Animated.Value(1)).current;
  const screenCopyTranslateY = useRef(new Animated.Value(0)).current;
  const phoneOpacity = useRef(new Animated.Value(0)).current;
  const phoneScale = useRef(new Animated.Value(0.8)).current;
  const phoneFrameScale = useRef(new Animated.Value(1)).current;
  const phonePositionY = useRef(new Animated.Value(0)).current;
  const continueOpacity = useRef(new Animated.Value(0)).current;
  const explorePhoneX = useRef(new Animated.Value(0)).current;
  const activePhoneX = useRef(new Animated.Value(0)).current;
  const journalPhoneX = useRef(new Animated.Value(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const journal = useRef(previewJournal()).current;
  const horizontalPadding = clamp(width * 0.045, 16, 24);
  const phoneWidth = Math.min(width - horizontalPadding * 2, 346, Math.max(220, (height - insets.top - insets.bottom - 92) * (1624 / 3407)));
  const phoneHeight = phoneWidth * (3407 / 1624);
  const compactPhoneScale = Math.min(1, 275 / phoneWidth);
  const titleFontSize = clamp(Math.round(width * 0.064), 22, 26);
  const initialPhoneCenterY = (insets.top + 178 + height - Math.max(insets.bottom + 8, 24)) / 2 - 14;
  // Align the visible display (rather than the phone's outer bezel) just
  // below the copy. This works across phone heights and pulls each preview
  // higher without changing type scale or animation geometry.
  const phoneScreenTopInset = phoneHeight * 0.044;
  const phoneCopyGap = clamp(height * 0.016, 10, 14);
  const phoneTravel = Math.max(width, phoneWidth) * 1.15;

  const schedule = (callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    timers.current.push(timer);
  };

  useEffect(() => {
    schedule(() => {
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        schedule(() => {
          Animated.timing(titleOpacity, {
            toValue: 0,
            duration: reduceMotion ? 0 : 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(({ finished: introHidden }) => {
            if (!introHidden) return;
            schedule(() => {
              setPhase("explore");
              schedule(() => {
                const duration = reduceMotion ? 0 : 850;
                Animated.parallel([
                  Animated.timing(titleLift, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                  Animated.timing(titleOpacity, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                  Animated.timing(phoneOpacity, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                  Animated.timing(phoneScale, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                ]).start();
                schedule(transitionToActive, reduceMotion ? 0 : 3_000);
              }, 0);
            }, reduceMotion ? 0 : 500);
          });
        }, reduceMotion ? 0 : 1_700);
      });
    }, reduceMotion ? 0 : 300);
    return () => timers.current.forEach(clearTimeout);
  // Animation values are stable refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  useEffect(() => {
    if (phase !== "title") return;
    explorePhoneX.setValue(0);
    activePhoneX.setValue(-phoneTravel);
    journalPhoneX.setValue(phoneTravel);
  }, [activePhoneX, explorePhoneX, journalPhoneX, phoneTravel, phase]);

  useEffect(() => {
    // Keep the phone in a fixed full-screen layer. Previously, changing the
    // layer's bottom edge caused React Native to re-layout it at the same time
    // as it was scaling, which made the mockup visibly jump and redraw.
    if (!showContinue || subtitleBottom === null || continueTop === null) return;

    const gapCenterY = (subtitleBottom + continueTop) / 2;
    const animationConfig = {
      duration: reduceMotion ? 0 : 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    } as const;
    // Wait for both measured bounds, then move and minimize as one motion.
    Animated.parallel([
      Animated.timing(phonePositionY, { ...animationConfig, toValue: gapCenterY - height / 2 }),
      Animated.timing(phoneFrameScale, { ...animationConfig, toValue: compactPhoneScale }),
      Animated.timing(continueOpacity, { ...animationConfig, toValue: 1 }),
    ]).start();
  }, [compactPhoneScale, continueOpacity, continueTop, height, phoneFrameScale, phonePositionY, reduceMotion, showContinue, subtitleBottom]);

  useEffect(() => {
    // Preserve the initial framing before Continue is shown and whenever the
    // device dimensions change.
    if (!showContinue) phonePositionY.setValue(initialPhoneCenterY - height / 2);
  }, [height, initialPhoneCenterY, phonePositionY, showContinue]);

  useEffect(() => {
    // Every preview shares the same text-anchored position. Using a transform
    // avoids re-layout while the content inside each phone is being animated.
    if (phase === "title" || showContinue || subtitleBottom === null) return;

    const phoneCenterY = subtitleBottom + phoneCopyGap - phoneScreenTopInset + phoneHeight / 2;
    Animated.timing(phonePositionY, {
      toValue: phoneCenterY - height / 2,
      duration: reduceMotion ? 0 : 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [height, phoneCopyGap, phoneHeight, phonePositionY, phoneScreenTopInset, phase, reduceMotion, showContinue, subtitleBottom]);

  function advance() {
    haptic();
    router.replace({ pathname: "/onboarding/questions-path", params: firstName ? { firstName } : {} });
  }

  function transitionToActive() {
    // Stop the JavaScript-driven list updates before the heavy map preview
    // mounts, leaving the transition frame budget for the phone movement.
    setExploreAutoScrollEnabled(false);
    hideScreenCopy();
    schedule(beginExploreExit, reduceMotion ? 0 : 320);
  }

  function hideScreenCopy() {
    Animated.parallel([
      Animated.timing(screenCopyOpacity, { toValue: 0, duration: reduceMotion ? 0 : 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(screenCopyTranslateY, { toValue: -16, duration: reduceMotion ? 0 : 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }

  function beginExploreExit() {
    setShowActivePhone(true);
    activePhoneX.setValue(phoneTravel);
    // Let the native map complete its first layout off-screen before it moves.
    schedule(() => {
      const transition = { duration: reduceMotion ? 0 : 700, easing: Easing.bezier(0.22, 0.61, 0.36, 1), useNativeDriver: true } as const;
      Animated.timing(explorePhoneX, { ...transition, toValue: phoneTravel }).start(({ finished }) => {
        if (finished) {
          setShowExplorePhone(false);
          setPhase("active");
          screenCopyOpacity.setValue(0);
          screenCopyTranslateY.setValue(16);
          schedule(() => {
            Animated.parallel([
              Animated.timing(activePhoneX, { ...transition, toValue: 0 }),
              Animated.timing(screenCopyOpacity, { toValue: 1, duration: reduceMotion ? 0 : 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(screenCopyTranslateY, { toValue: 0, duration: reduceMotion ? 0 : 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start(({ finished: activeEntered }) => {
              if (activeEntered) schedule(transitionToJournal, reduceMotion ? 0 : 2_000);
            });
          }, reduceMotion ? 0 : 100);
        }
      });
    }, reduceMotion ? 0 : 100);
  }

  function transitionToJournal() {
    const transition = { duration: reduceMotion ? 0 : 700, easing: Easing.bezier(0.22, 0.61, 0.36, 1), useNativeDriver: true } as const;
    hideScreenCopy();
    Animated.timing(activePhoneX, { ...transition, toValue: phoneTravel }).start(({ finished }) => {
      if (!finished) return;
      setShowActivePhone(false);
      setPhase("journal");
      journalPhoneX.setValue(phoneTravel);
      screenCopyOpacity.setValue(0);
      screenCopyTranslateY.setValue(16);
      schedule(() => {
        Animated.parallel([
          Animated.timing(journalPhoneX, { ...transition, toValue: 0 }),
          Animated.timing(screenCopyOpacity, { toValue: 1, duration: reduceMotion ? 0 : 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(screenCopyTranslateY, { toValue: 0, duration: reduceMotion ? 0 : 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start(({ finished: journalEntered }) => {
          if (journalEntered) schedule(() => setShowContinue(true), reduceMotion ? 0 : 2_000);
        });
      }, reduceMotion ? 0 : 100);
    });
  }

  const initialTitleTranslate = Math.max(0, height / 2 - (insets.top + 22) - titleHeight / 2);
  const titleTranslate = titleLift.interpolate({ inputRange: [0, 1], outputRange: [initialTitleTranslate, 0] });
  const title = phase === "title"
    ? <><Text style={styles.nameAccent}>{firstName}</Text>, here&apos;s how <Text style={styles.subtitleAccent}>QuestLife</Text> works.</>
    : phase === "explore"
      ? <>Pick a <Text style={styles.subtitleAccent}>Quest</Text></>
      : phase === "active"
        ? <>Go <Text style={styles.subtitleAccent}>experience</Text> it.</>
        : <>Make it part of your <Text style={styles.subtitleAccent}>story</Text>.</>;
  const subtitle = phase === "explore"
    ? "Find something worth doing."
    : phase === "active"
      ? "Turn your free time into an adventure."
      : phase === "journal"
        ? "Save the memories you make"
        : null;
  const measureSubtitle = (event: LayoutChangeEvent) => {
    const { y, height: subtitleHeight } = event.nativeEvent.layout;
    setSubtitleBottom(insets.top + 22 + y + subtitleHeight);
  };

  return <View style={styles.root}>
    <StatusBar style="light" />
    <ImageBackground source={stoneArchBackground} resizeMode="cover" style={StyleSheet.absoluteFill}><LinearGradient pointerEvents="none" colors={["rgba(5,10,7,0.5)", "rgba(5,10,7,0.76)"]} locations={[0, 1]} style={StyleSheet.absoluteFill} /></ImageBackground>
    <Animated.View style={[styles.titleLayer, { top: insets.top + 22, paddingHorizontal: horizontalPadding, opacity: titleOpacity, transform: [{ translateY: titleTranslate }] }]}>
      <Animated.View style={{ opacity: screenCopyOpacity, transform: [{ translateY: screenCopyTranslateY }] }}>
      <Text onLayout={(event) => setTitleHeight(event.nativeEvent.layout.height)} adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={3} maxFontSizeMultiplier={1.15} style={[styles.title, { fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.17) }]}>{title}</Text>
      {subtitle ? <Text onLayout={measureSubtitle} style={styles.subtitle}>{subtitle}</Text> : null}
      </Animated.View>
    </Animated.View>
    <Animated.View pointerEvents="none" style={[styles.phoneArea, { opacity: phoneOpacity, transform: [{ translateY: phonePositionY }, { scale: phoneScale }] }]}>
      <Animated.View style={{ position: "relative", width: phoneWidth, height: phoneHeight, transform: [{ scale: phoneFrameScale }] }}>
      {showExplorePhone ? <Animated.View style={[styles.phoneMockup, { width: phoneWidth, height: phoneHeight, transform: [{ translateX: explorePhoneX }] }]}><View style={[styles.phoneDisplay, { borderRadius: Math.round(phoneWidth * 0.085) }]}><PhoneScreen phase="explore" scale={(phoneWidth * 0.856) / width} width={width} height={height} journal={journal} exploreAutoScrollEnabled={exploreAutoScrollEnabled} /></View><Image source={iphoneMockup} contentFit="fill" style={StyleSheet.absoluteFill} /></Animated.View> : null}
      {showActivePhone ? <Animated.View style={[styles.phoneMockup, { width: phoneWidth, height: phoneHeight, transform: [{ translateX: activePhoneX }] }]}><View style={[styles.phoneDisplay, { borderRadius: Math.round(phoneWidth * 0.085) }]}><PhoneScreen phase="active" scale={(phoneWidth * 0.856) / width} width={width} height={height} journal={journal} /></View><Image source={iphoneMockup} contentFit="fill" style={StyleSheet.absoluteFill} /></Animated.View> : null}
      {phase === "journal" ? <Animated.View style={[styles.phoneMockup, { width: phoneWidth, height: phoneHeight, transform: [{ translateX: journalPhoneX }] }]}><View style={[styles.phoneDisplay, { borderRadius: Math.round(phoneWidth * 0.085) }]}><PhoneScreen phase="journal" scale={(phoneWidth * 0.856) / width} width={width} height={height} journal={journal} /></View><Image source={iphoneMockup} contentFit="fill" style={StyleSheet.absoluteFill} /></Animated.View> : null}
      </Animated.View>
    </Animated.View>
    {showContinue ? <Animated.View onLayout={(event) => setContinueTop(event.nativeEvent.layout.y)} style={[styles.continueArea, { paddingHorizontal: horizontalPadding, paddingBottom: Math.max(insets.bottom + 18, 30), opacity: continueOpacity }]}><SoftButton label="Let's build yours →" color={T.blue} onPress={advance} style={styles.continueButton} /></Animated.View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#101510" },
  titleLayer: { position: "absolute", left: 0, right: 0, zIndex: 3, alignItems: "center", gap: 7 },
  title: { maxWidth: 355, color: T.white, fontFamily: "RubikBlack", letterSpacing: -0.36, textAlign: "center" },
  nameAccent: { color: T.blue },
  subtitle: { maxWidth: 330, color: "rgba(255,255,255,0.92)", fontFamily: "RubikBold", fontSize: 19, lineHeight: 25, textAlign: "center" },
  subtitleAccent: { color: T.blue },
  phoneArea: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  phoneMockup: { position: "absolute" },
  phoneDisplay: { position: "absolute", left: "7.02%", top: "4.4%", width: "85.6%", height: "90.85%", overflow: "hidden", backgroundColor: T.bg },
  previewClip: { flex: 1, overflow: "hidden" },
  previewCanvas: { transformOrigin: "top left" },
  continueArea: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 5 },
  continueButton: { minHeight: 60, borderRadius: 20, borderBottomColor: "#258fd8" },
});
