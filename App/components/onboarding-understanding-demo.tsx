import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/components/theme";
import { SoftButton, haptic } from "@/components/ui";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { ExploreScreen } from "@/screens/explore-screen";
import { QuestDetailScreen } from "@/screens/quest-detail-screen";
import { ActiveQuestScreen } from "@/screens/active-quest-screen";
import { JournalScreen, type JournalScreenPreview } from "@/screens/journal-screen";
import type { Quest } from "@/types/content";

const stoneArchBackground = require("../assets/onboarding/stone-arch-background.png");
const iphoneMockup = require("../assets/onboarding/iphone-mockup.png");
type DemoPhase = "title" | "explore" | "detail" | "active" | "journal";

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

const FEATURED_QUEST = DEMO_QUESTS[0];

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
      entriesByDate: { [key]: { entryDate: key, title: "A fresh start", mood: "happy" } },
      memoriesByDate: { [key]: [{ completionId: "demo-completion", questId: FEATURED_QUEST.id, title: FEATURED_QUEST.title, reflection: "A small adventure is a good way to start.", completedAt: today.toISOString(), xp: FEATURED_QUEST.xp, category: FEATURED_QUEST.category, difficulty: FEATURED_QUEST.difficulty, color: FEATURED_QUEST.color, timeMin: FEATURED_QUEST.timeMin, partyId: null, photoPaths: [], participants: [] }] },
      partyHistory: [],
      activeQuest: null,
    },
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function PhoneScreen({ phase, scale, width, height }: { phase: Exclude<DemoPhase, "title">; scale: number; width: number; height: number }) {
  const journal = useRef(previewJournal()).current;
  const content = phase === "explore" ? <ExploreScreen previewQuests={DEMO_QUESTS} previewAutoScroll />
    : phase === "detail" ? <QuestDetailScreen previewQuest={FEATURED_QUEST} onBack={() => {}} />
      : phase === "active" ? <ActiveQuestScreen preview previewQuest={FEATURED_QUEST} />
        : <JournalScreen preview={journal} />;

  return <View pointerEvents="none" style={styles.previewClip}>
    <View style={[styles.previewCanvas, { width, height, transform: [{ scale }] }]}>{content}</View>
  </View>;
}

export function UnderstandingDemo({ firstName }: { firstName: string }) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const [phase, setPhase] = useState<DemoPhase>("title");
  const [showContinue, setShowContinue] = useState(false);
  const titleLift = useRef(new Animated.Value(0)).current;
  const phoneOpacity = useRef(new Animated.Value(0)).current;
  const phoneScale = useRef(new Animated.Value(0.96)).current;
  const phoneFrameScale = useRef(new Animated.Value(1)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const horizontalPadding = clamp(width * 0.045, 16, 24);
  const phoneWidth = Math.min(width - horizontalPadding * 2, 326, Math.max(220, (height - insets.top - insets.bottom - 116) * (1624 / 3407)));
  const phoneHeight = phoneWidth * (3407 / 1624);
  const compactPhoneScale = Math.min(1, 275 / phoneWidth);
  // Keep the preview visually tied to its caption while it is first revealed.
  // Once Continue is present, the compact preview uses the reserved space
  // above that action rather than lifting into the subtitle.
  const phoneLift = clamp(Math.round(height * 0.03), 22, 30);
  const titleFontSize = clamp(Math.round(width * 0.064), 22, 26);

  const schedule = (callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    timers.current.push(timer);
  };

  useEffect(() => {
    schedule(() => {
      setPhase("explore");
      const duration = reduceMotion ? 0 : 620;
      Animated.parallel([
        Animated.timing(titleLift, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(phoneOpacity, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(phoneScale, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      schedule(() => setShowContinue(true), reduceMotion ? 0 : 3_000);
    }, 2_000);
    return () => timers.current.forEach(clearTimeout);
  // Animation values are stable refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  useEffect(() => {
    if (phase === "title") return;
    screenOpacity.setValue(reduceMotion ? 1 : 0.72);
    Animated.timing(screenOpacity, { toValue: 1, duration: reduceMotion ? 0 : 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [phase, reduceMotion, screenOpacity]);

  useEffect(() => {
    const shouldCompact = phase === "explore" && showContinue;
    Animated.timing(phoneFrameScale, { toValue: shouldCompact ? compactPhoneScale : 1, duration: reduceMotion ? 0 : 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [compactPhoneScale, phase, phoneFrameScale, reduceMotion, showContinue]);

  function advance() {
    haptic();
    setShowContinue(false);
    if (phase === "explore") {
      setPhase("detail");
      schedule(() => setPhase("active"), reduceMotion ? 0 : 1_550);
      schedule(() => { setPhase("journal"); setShowContinue(true); }, reduceMotion ? 0 : 5_150);
    } else if (phase === "journal") {
      router.replace({ pathname: "/onboarding/age", params: firstName ? { firstName } : {} });
    }
  }

  const titleTranslate = titleLift.interpolate({ inputRange: [0, 1], outputRange: [Math.max(108, height * 0.29), 0] });
  const subtitle = phase === "explore" ? "Browse through various quests" : phase === "detail" ? "Start the quest that you want to do" : phase === "active" ? "Experience the quest" : phase === "journal" ? "Your quests are saved in your journal, where you can reflect back on them." : null;
  const phoneTranslateY = showContinue && phase === "explore" ? 0 : -phoneLift;

  return <View style={styles.root}>
    <StatusBar style="light" />
    <ImageBackground source={stoneArchBackground} resizeMode="cover" style={StyleSheet.absoluteFill}><LinearGradient pointerEvents="none" colors={["rgba(5,10,7,0.5)", "rgba(5,10,7,0.76)"]} locations={[0, 1]} style={StyleSheet.absoluteFill} /></ImageBackground>
    <Animated.View style={[styles.titleLayer, { top: insets.top + 22, paddingHorizontal: horizontalPadding, transform: [{ translateY: titleTranslate }] }]}>
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={3} maxFontSizeMultiplier={1.15} style={[styles.title, { fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.17) }]}><Text style={styles.nameAccent}>{firstName}</Text><Text>, QuestLife is really easy to use</Text></Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </Animated.View>
    <Animated.View pointerEvents="none" style={[styles.phoneArea, { top: insets.top + 178, bottom: showContinue && phase === "explore" ? Math.max(insets.bottom + 122, 142) : Math.max(insets.bottom + 8, 24), opacity: phoneOpacity, transform: [{ translateY: phoneTranslateY }, { scale: phoneScale }] }]}>
      <Animated.View style={{ transform: [{ scale: phoneFrameScale }] }}>
      <View style={{ width: phoneWidth, height: phoneHeight }}>
        <Animated.View style={[styles.phoneDisplay, { borderRadius: Math.round(phoneWidth * 0.085), opacity: screenOpacity }]}>{phase !== "title" ? <PhoneScreen phase={phase} scale={(phoneWidth * 0.856) / width} width={width} height={height} /> : null}</Animated.View>
        <Image source={iphoneMockup} contentFit="fill" style={StyleSheet.absoluteFill} />
      </View>
      </Animated.View>
    </Animated.View>
    {showContinue ? <Animated.View style={[styles.continueArea, { paddingHorizontal: horizontalPadding, paddingBottom: Math.max(insets.bottom + 18, 30) }]}><SoftButton label="Continue" color={T.blue} onPress={advance} style={styles.continueButton} /></Animated.View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#101510" },
  titleLayer: { position: "absolute", left: 0, right: 0, zIndex: 3, alignItems: "center", gap: 7 },
  title: { maxWidth: 355, color: T.white, fontFamily: "RubikBlack", letterSpacing: -0.36, textAlign: "center" },
  nameAccent: { color: T.blue },
  subtitle: { maxWidth: 306, color: "rgba(255,255,255,0.92)", fontFamily: "Rubik", fontSize: 15, lineHeight: 21, textAlign: "center" },
  phoneArea: { position: "absolute", left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  phoneDisplay: { position: "absolute", left: "7.02%", top: "4.4%", width: "85.6%", height: "90.85%", overflow: "hidden", backgroundColor: T.bg },
  previewClip: { flex: 1, overflow: "hidden" },
  previewCanvas: { transformOrigin: "top left" },
  continueArea: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 5 },
  continueButton: { minHeight: 60, borderRadius: 20, borderBottomColor: "#258fd8" },
});
