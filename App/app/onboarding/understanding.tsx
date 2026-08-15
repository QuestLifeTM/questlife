import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PartyCategoryIcon } from "@/components/party-category-icon";
import { ActiveQuestScreen } from "@/screens/active-quest-screen";
import { T } from "@/components/theme";
import { SoftButton, haptic } from "@/components/ui";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useGuestQuest } from "@/contexts/GuestQuestContext";
import { UnderstandingDemo } from "@/components/onboarding-understanding-demo";

const stoneArchBackground = require("../../assets/onboarding/stone-arch-background.png");
const iphoneMockup = require("../../assets/onboarding/iphone-mockup.png");

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function PreviewPill({ label, color, icon, scale }: { label: string; color: string; icon: keyof typeof Ionicons.glyphMap | "adventure"; scale: number }) {
  return (
    <View style={[styles.previewPill, { minHeight: 20 * scale, paddingHorizontal: 6 * scale, gap: 3 * scale, borderColor: color, backgroundColor: `${color}12` }]}>
      {icon === "adventure" ? <PartyCategoryIcon category="ADVENTURE" size={Math.round(12 * scale)} color={color} strokeWidth={2.2} /> : <Ionicons name={icon} size={Math.round(13 * scale)} color={color} />}
      <Text numberOfLines={1} style={[styles.previewPillText, { color, fontSize: 7.5 * scale }]}>{label}</Text>
    </View>
  );
}

function PreviewStat({ label, value, icon, color, bordered, scale }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; color: string; bordered?: boolean; scale: number }) {
  return (
    <View style={[styles.previewStat, bordered && styles.previewStatBorder]}>
      <View style={[styles.previewStatValue, { gap: 2 * scale }]}><Ionicons name={icon} size={Math.round(12 * scale)} color={color} /><Text style={[styles.previewStatNumber, { fontSize: 13 * scale }]}>{value}</Text></View>
      <Text numberOfLines={1} style={[styles.previewStatLabel, { fontSize: 5.8 * scale }]}>{label}</Text>
    </View>
  );
}

const ACTIVE_QUEST_REFERENCE_WIDTH = 390;
const ACTIVE_QUEST_REFERENCE_HEIGHT = 844;

/** Renders the real active-quest surface at the mock phone's physical scale. */
function ActiveQuestMockup({ width, height }: { width: number; height: number }) {
  const scale = Math.min(width / ACTIVE_QUEST_REFERENCE_WIDTH, height / ACTIVE_QUEST_REFERENCE_HEIGHT);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={{ position: "absolute", width: ACTIVE_QUEST_REFERENCE_WIDTH, height: ACTIVE_QUEST_REFERENCE_HEIGHT, left: (width - ACTIVE_QUEST_REFERENCE_WIDTH) / 2, top: (height - ACTIVE_QUEST_REFERENCE_HEIGHT) / 2, transform: [{ scale }] }}>
      <ActiveQuestScreen preview />
    </View>
  </View>;
}

function QuestTransitionLoader({ opacity }: { opacity: Animated.Value }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  return <Animated.View pointerEvents="auto" accessibilityRole="progressbar" accessibilityLabel="Opening your first quest" style={[styles.transitionLoader, { opacity }]}>
    <Animated.View style={[styles.transitionLoaderRing, { transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]} />
    <Text style={styles.transitionLoaderTitle}>Preparing your quest</Text>
    <Text style={styles.transitionLoaderBody}>Your adventure is ready to begin.</Text>
  </Animated.View>;
}

export default function UnderstandingOnboardingScreen() {
  const { firstName, stage: requestedStage } = useLocalSearchParams<{ firstName?: string; stage?: "intro" | "quest" }>();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const { startGuestQuest } = useGuestQuest();
  const displayName = firstName?.trim() || "Friend";
  const horizontalPadding = clamp(width * 0.045, 16, 24);
  const contentWidth = Math.max(0, width - insets.left - insets.right - horizontalPadding * 2);
  const titleLineCount = displayName.length > 16 ? 3 : 2;
  const titleFontSize = Math.round(32 * clamp(contentWidth / 360, 0.82, 1) * (displayName.length > 24 ? 0.76 : displayName.length > 16 ? 0.88 : 1));
  // These values match the transparent display opening of the supplied
  // 1624 × 3407 iPhone bezel image, so the preview stays aligned at any size.
  // Give the quest preview a more confident footprint while retaining enough
  // room for the headline and safe areas on compact phones.
  const maximumPhoneHeight = Math.max(420, height - insets.top - insets.bottom - 116);
  const phoneWidth = Math.min(contentWidth, 460, maximumPhoneHeight * (1624 / 3407));
  const phoneHeight = phoneWidth * (3407 / 1624);
  // Keep the established vertical footprint, then give the framed preview a
  // subtle horizontal lift so it reads more confidently on the onboarding stage.
  const mockupWidth = Math.min(contentWidth, phoneWidth * 1.055);
  const displayWidth = mockupWidth * 0.856;
  const displayHeight = phoneHeight * 0.9085;
  const phoneScale = displayWidth / 286;
  const previewExpansion = Math.max(1, phoneScale);
  // The preview must remain readable at its smallest supported size. Keep the
  // header compact, then give the quest details and actions a modest lift.
  const previewContentScale = clamp(phoneScale * 1.16, 1.1, 1.2);
  const previewDetailsScale = clamp(phoneScale * 1.1, 1.03, 1.12);
  const previewActionScale = clamp(phoneScale * 1.15, 1.1, 1.18);
  const startsAtQuest = requestedStage === "quest";
  const [unlockVisible, setUnlockVisible] = useState(false);
  const stage = startsAtQuest ? "quest" : "intro";
  const [transitioning, setTransitioning] = useState(false);
  const [previewMode, setPreviewMode] = useState<"quest" | "active">("quest");
  const introOpacity = useRef(new Animated.Value(startsAtQuest ? 0 : 1)).current;
  const questOpacity = useRef(new Animated.Value(startsAtQuest ? 1 : 0)).current;
  const questCopyOpacity = useRef(new Animated.Value(1)).current;
  const questPreviewOpacity = useRef(new Animated.Value(1)).current;
  const activePreviewOpacity = useRef(new Animated.Value(0)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const loaderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (loaderTimer.current) clearTimeout(loaderTimer.current);
  }, []);

  async function startDemoQuest() {
    if (transitioning) return;
    setTransitioning(true);
    haptic();

    try {
      await startGuestQuest();
    } catch {
      setTransitioning(false);
      return;
    }

    // This is an intentional new tutorial run, even if an old guest session
    // still has a completion marker from a previous attempt.
    const openDemo = () => router.replace({ pathname: "/onboarding/demo-active-quest", params: { ...(firstName ? { firstName } : {}), runTutorial: "true" } });
    const showLoaderThenTutorial = (delay = 0) => {
      Animated.timing(loaderOpacity, { toValue: 1, duration: reduceMotion ? 0 : 360, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        // The loader is deliberately a fixed four-second bridge after it is
        // fully visible, independent of the guest quest's readiness.
        loaderTimer.current = setTimeout(openDemo, 4_000);
      });
    };
    if (reduceMotion) {
      setPreviewMode("active");
      activePreviewOpacity.setValue(1);
      showLoaderThenTutorial();
      return;
    }

    Animated.parallel([
      Animated.timing(questCopyOpacity, { toValue: 0, duration: 430, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(questPreviewOpacity, { toValue: 0, duration: 390, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setPreviewMode("active");
      Animated.timing(activePreviewOpacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished: activePreviewFinished }) => {
        if (!activePreviewFinished) return;
        // Keep the active quest inside the physical phone preview. The blue
        // loading bridge begins only after the user has seen that state.
        showLoaderThenTutorial(600);
      });
    });
  }

  function continueToAge() {
    if (transitioning) return;
    setTransitioning(true);
    haptic();
    router.replace({ pathname: "/onboarding/age", params: firstName ? { firstName } : {} });
  }

  // The named welcome state is a presentation-only walkthrough. Keep the
  // established post-age `quest` state below intact, because it is the real
  // onboarding tutorial that follows the age question.
  if (!startsAtQuest) return <UnderstandingDemo firstName={displayName} />;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ImageBackground source={stoneArchBackground} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <LinearGradient pointerEvents="none" colors={["rgba(5,10,7,0.5)", "rgba(5,10,7,0.76)"]} locations={[0, 1]} style={StyleSheet.absoluteFill} />
      </ImageBackground>
      {stage === "intro" ? <Animated.View style={[styles.introStage, { paddingHorizontal: horizontalPadding, paddingTop: Math.max(insets.top + 112, height * 0.34), paddingBottom: Math.max(insets.bottom + 18, 30), opacity: introOpacity, transform: [{ translateY: introOpacity.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
        <View style={styles.introCopyBlock}>
          <Text selectable adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={titleLineCount} maxFontSizeMultiplier={1.15} accessibilityLabel={`Let’s get to know you, ${displayName}!`} style={[styles.title, styles.introTitle, { fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.17) }]}>
            Let’s get to know you, <Text style={styles.nameAccent}>{displayName}!</Text>
          </Text>
          <Text selectable adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={3} maxFontSizeMultiplier={1.15} style={styles.introBody}>A few quick questions will help us recommend quests you’ll love.</Text>
        </View>
        <SoftButton label="Continue" color={T.blue} disabled={transitioning} onPress={continueToAge} style={styles.continueButton} />
      </Animated.View> : <Animated.View style={[styles.questStage, { paddingTop: insets.top + 26, paddingBottom: Math.max(insets.bottom + 8, 16), paddingHorizontal: horizontalPadding, opacity: questOpacity, transform: [{ translateY: questOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        <Animated.View style={[styles.questCopyBlock, { opacity: questCopyOpacity }]}>
          <Text selectable adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={2} maxFontSizeMultiplier={1.15} style={[styles.questStageTitle, { fontSize: clamp(contentWidth * 0.067, 22, 25), lineHeight: clamp(contentWidth * 0.076, 26, 30) }]}>Let’s treat this as your <Text style={styles.questStageTitleAccent}>FIRST</Text> quest</Text>
          <Text selectable style={styles.questStageBody}>Tap <Text style={styles.questStageBodyAccent}>Start Quest</Text> below to begin.</Text>
        </Animated.View>
        <View style={styles.previewArea}>
          <Animated.View accessibilityLabel="Preview of your first QuestLife quest" pointerEvents={transitioning ? "none" : "auto"} style={[styles.phoneMockup, { width: mockupWidth, height: phoneHeight, zIndex: transitioning ? 2 : 0 }]}>
            <View style={[styles.phoneScreen, { left: "7.02%", top: "4.4%", width: "85.6%", height: "90.85%", borderRadius: Math.round(mockupWidth * 0.085) }]}>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: questPreviewOpacity }]}>
              <View style={[styles.previewHeader, { gap: 7 * previewExpansion, paddingHorizontal: Math.max(12, Math.round(mockupWidth * 0.05)), paddingTop: Math.max(18, Math.round(phoneHeight * 0.064)), paddingBottom: 9 * previewExpansion }]}>
                <View style={[styles.previewPillRow, { gap: 5 * previewExpansion }]}>
                  <PreviewPill label="Adventure" color={T.blue} icon="adventure" scale={previewExpansion} />
                  <PreviewPill label="Easy" color={T.green} icon="leaf-outline" scale={previewExpansion} />
                </View>
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.previewTitle, { fontSize: Math.round(21 * phoneScale), lineHeight: Math.round(24 * phoneScale) }]}>Personalize your{"\n"}experience</Text>
                <View style={styles.previewByline}><Text numberOfLines={1} style={[styles.previewBylineText, { fontSize: Math.round(10 * phoneScale) }]}>by @QuestLifeTeam</Text><Ionicons name="checkmark-circle" size={Math.round(13 * phoneScale)} color={T.blue} /></View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.previewContent, { gap: 11 * previewContentScale, paddingTop: 10 * previewContentScale, paddingHorizontal: Math.max(12, Math.round(mockupWidth * 0.05)), paddingBottom: 10 * previewContentScale }]}>
                <View style={[styles.previewStats, { minHeight: 48 * previewContentScale, borderRadius: 13 * previewContentScale, paddingVertical: 6 * previewContentScale }]}><PreviewStat label="Users completed" value="30K" icon="checkmark-circle" color={T.blue} scale={previewContentScale} /><PreviewStat label="Saved" value="–" icon="bookmark" color={T.blue} bordered scale={previewContentScale} /><PreviewStat label="Rating" value="5.0" icon="star" color={T.orange} bordered scale={previewContentScale} /></View>
                <View style={[styles.previewSection, { gap: 5 * previewDetailsScale }]}><Text style={[styles.previewSectionTitle, { fontSize: Math.round(16 * previewDetailsScale) }]}>About this quest</Text><Text style={[styles.previewDescription, { fontSize: Math.round(10.5 * previewDetailsScale), lineHeight: Math.round(15 * previewDetailsScale) }]}>This quick quest will help personalize your experience so we can recommend adventures you'll love.</Text></View>
                <View style={[styles.howItWorks, { gap: 7 * previewDetailsScale, borderRadius: 12 * previewDetailsScale, padding: 9 * previewDetailsScale }]}><Text style={[styles.previewSectionTitle, { fontSize: Math.round(16 * previewDetailsScale) }]}>How it works</Text>{["Answer a few quick questions", "We personalize your experience", "Unlock the rest of QuestLife"].map((step, index) => <View key={step} style={[styles.stepRow, { gap: 6 * previewDetailsScale }]}><View style={[styles.stepNumber, { width: Math.round(20 * previewDetailsScale), height: Math.round(20 * previewDetailsScale), borderRadius: Math.round(10 * previewDetailsScale) }]}><Text style={[styles.stepNumberText, { fontSize: Math.round(10 * previewDetailsScale) }]}>{index + 1}</Text></View><Text style={[styles.stepText, { fontSize: Math.round(9.5 * previewDetailsScale), lineHeight: Math.round(13 * previewDetailsScale) }]}>{step}</Text></View>)}</View>
              </ScrollView>

              <View style={[styles.previewActions, { gap: 5 * previewExpansion, paddingTop: 7 * previewExpansion, paddingBottom: Math.max(8 * previewExpansion, Math.round(phoneHeight * 0.047)), paddingHorizontal: Math.max(12, Math.round(mockupWidth * 0.05)) }]}>
                <View style={[styles.previewSecondaryActions, { gap: 5 * previewExpansion }]}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Save Quest — unlock after your first quest" onPress={() => setUnlockVisible(true)} style={({ pressed }) => [styles.previewSecondaryButton, { minHeight: 31 * previewActionScale, borderRadius: 11 * previewActionScale, gap: 4 * previewActionScale }, pressed && styles.previewPressed]}><Ionicons name="bookmark-outline" size={Math.round(14 * previewActionScale)} color={T.blue} /><Text style={[styles.previewSecondaryText, { fontSize: Math.round(9.5 * previewActionScale) }]}>Save Quest</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Challenge friends — unlock after your first quest" onPress={() => setUnlockVisible(true)} style={({ pressed }) => [styles.previewSecondaryButton, { minHeight: 31 * previewActionScale, borderRadius: 11 * previewActionScale, gap: 4 * previewActionScale }, pressed && styles.previewPressed]}><Ionicons name="share-social-outline" size={Math.round(14 * previewActionScale)} color={T.blue} /><Text style={[styles.previewSecondaryText, { fontSize: Math.round(9.5 * previewActionScale) }]}>Challenge</Text></Pressable>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Start Quest" accessibilityState={{ disabled: transitioning }} disabled={transitioning} onPress={() => void startDemoQuest()} style={({ pressed }) => [styles.previewStartButton, { minHeight: 34 * previewActionScale, borderRadius: 11 * previewActionScale, gap: 4 * previewActionScale }, pressed && styles.previewPressed]}><Ionicons name="play" size={Math.round(13 * previewActionScale)} color={T.white} /><Text style={[styles.previewStartText, { fontSize: Math.round(11 * previewActionScale) }]}>Start Quest</Text></Pressable>
              </View>
              </Animated.View>
              {previewMode === "active" ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: activePreviewOpacity }]}><ActiveQuestMockup width={displayWidth} height={displayHeight} /></Animated.View> : null}
            </View>
            <Image pointerEvents="none" source={iphoneMockup} contentFit="fill" style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </Animated.View>}

      <Modal transparent animationType="fade" visible={unlockVisible} onRequestClose={() => setUnlockVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.unlockCard}>
            <Text style={styles.unlockTitle}>🏇 Hold your horses!</Text>
            <Text selectable style={styles.unlockBody}>Finish your first quest to unlock Saved Quests, Challenges, and the rest of QuestLife.</Text>
            <SoftButton label="Continue with quest" icon="arrow-forward" color={T.blue} onPress={() => setUnlockVisible(false)} />
          </View>
        </View>
      </Modal>
      {transitioning ? <QuestTransitionLoader opacity={loaderOpacity} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#101510" },
  introStage: { flex: 1, justifyContent: "space-between" },
  introCopyBlock: { alignItems: "flex-start", gap: 16 },
  title: { color: T.white, fontFamily: "RubikBlack", letterSpacing: -0.45 },
  introTitle: { textAlign: "left" },
  nameAccent: { color: T.blue },
  introBody: { color: "rgba(255,255,255,0.92)", fontFamily: "Rubik", fontSize: 16, lineHeight: 24, textAlign: "left" },
  continueButton: { minHeight: 60, borderRadius: 20, borderBottomColor: "#258fd8" },
  questStage: { flex: 1, alignItems: "center", gap: 10 },
  questCopyBlock: { alignItems: "center", gap: 5, marginTop: -4, marginBottom: 10 },
  questStageTitle: { maxWidth: 350, color: T.white, fontFamily: "RubikBlack", letterSpacing: -0.35, textAlign: "center" },
  questStageTitleAccent: { color: T.blue },
  questStageBody: { color: "rgba(255,255,255,0.9)", fontFamily: "Rubik", fontSize: 15, lineHeight: 21, textAlign: "center" },
  questStageBodyAccent: { color: T.blue, fontFamily: "RubikBold" },
  previewArea: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 0 },
  phoneMockup: { position: "relative" },
  phoneScreen: { position: "absolute", overflow: "hidden", backgroundColor: T.bg },
  previewHeader: { gap: 7, paddingBottom: 9, backgroundColor: "#f3f9ff", borderBottomWidth: 1, borderBottomColor: "#d7e9fb" },
  previewPillRow: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  previewPill: { minHeight: 20, paddingHorizontal: 6, borderRadius: 99, borderWidth: 1.5, flexDirection: "row", alignItems: "center", gap: 3 },
  previewPillText: { fontFamily: "RubikBlack", fontSize: 7.5, letterSpacing: 0.25, textTransform: "uppercase" },
  previewTitle: { color: T.dark, fontFamily: "RubikBlack", letterSpacing: -0.2 },
  previewByline: { flexDirection: "row", alignItems: "center", gap: 4 },
  previewBylineText: { color: T.muted, fontFamily: "RubikBold" },
  previewContent: { gap: 11, paddingTop: 9 },
  previewStats: { minHeight: 48, flexDirection: "row", alignItems: "center", borderRadius: 13, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.white, paddingVertical: 6 },
  previewStat: { flex: 1, minWidth: 0, alignItems: "center", gap: 2, paddingHorizontal: 3 },
  previewStatBorder: { borderLeftWidth: 1, borderLeftColor: T.border },
  previewStatValue: { flexDirection: "row", alignItems: "center", gap: 2 },
  previewStatNumber: { color: T.dark, fontFamily: "RubikBlack", fontSize: 13 },
  previewStatLabel: { color: T.muted, fontFamily: "RubikBold", fontSize: 5.8, letterSpacing: 0.2, textTransform: "uppercase" },
  previewSection: { gap: 4 },
  previewSectionTitle: { color: T.dark, fontFamily: "RubikBlack" },
  previewDescription: { color: T.dark, fontFamily: "Rubik" },
  howItWorks: { gap: 7, borderRadius: 12, borderWidth: 1.5, borderColor: "#9dceff", backgroundColor: "#f5faff", padding: 9 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  stepNumber: { backgroundColor: T.blue, alignItems: "center", justifyContent: "center" },
  stepNumberText: { color: T.white, fontFamily: "RubikBlack" },
  stepText: { flex: 1, color: T.dark, fontFamily: "Rubik" },
  previewActions: { gap: 5, paddingTop: 7, paddingBottom: 8, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.bg },
  previewSecondaryActions: { flexDirection: "row", gap: 5 },
  previewSecondaryButton: { flex: 1, minHeight: 27, borderRadius: 10, borderWidth: 1.5, borderColor: T.blue, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: T.white },
  previewSecondaryText: { color: T.blue, fontFamily: "RubikBold" },
  previewStartButton: { minHeight: 29, borderRadius: 10, backgroundColor: T.blue, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderBottomWidth: 3, borderBottomColor: "#258fd8" },
  previewStartText: { color: T.white, fontFamily: "RubikBlack" },
  previewPressed: { opacity: 0.82, transform: [{ translateY: 1 }] },
  transitionLoader: { position: "absolute", inset: 0, zIndex: 5, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: T.blue },
  transitionLoaderRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 4, borderColor: "rgba(255,255,255,0.32)", borderTopColor: T.white },
  transitionLoaderTitle: { color: T.white, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 28 },
  transitionLoaderBody: { color: "rgba(255,255,255,0.86)", fontFamily: "Rubik", fontSize: 14, lineHeight: 20 },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(18,21,23,0.64)" },
  unlockCard: { width: "100%", maxWidth: 360, gap: 13, borderRadius: 24, borderWidth: 2, borderColor: T.border, backgroundColor: T.bg, padding: 22, boxShadow: "0 5px 0 rgba(0,0,0,0.18)" },
  unlockTitle: { color: T.dark, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 28, textAlign: "center" },
  unlockBody: { color: T.muted, fontFamily: "Rubik", fontSize: 15, lineHeight: 22, textAlign: "center" },
});
