import { Pressable } from "@/components/raised-pressable";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type TextInputProps } from "react-native";
import Animated, { cancelAnimation, Easing, Extrapolation, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { T } from "@/components/theme";
import { getCompletionBannerPalette, getCompletionPalette } from "@/components/quest-completion-palette";
import { CardSheen, CompletionBanner, MedallionAura, MedallionSheen, RewardHeading } from "@/components/quest-completion-effects";
import { completionCues as CUE, completionProgress as progress } from "@/lib/completion-motion";
import { haptic, SoftButton } from "@/components/ui";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useAppViewport, useResponsiveScreenLayout } from "@/lib/responsive";
import { parseCompletionDuration } from "@/lib/completion-recap";
import type { QuestCategory } from "@/types/content";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const easeOut = Easing.bezierFn(0.23, 1, 0.32, 1);
const AnimatedInput = Animated.createAnimatedComponent(TextInput);

function Sparkle({ size = 18, color }: { size?: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path fill={color} d="M12 0 16 8 24 12 16 16 12 24 8 16 0 12 8 8Z" /></Svg>;
}

/** Code-native artwork stays sharp at phone, tablet and desktop sizes. */
export function CompletionMedallion({ color, size = 190, phase, reduced = false }: { color: string; size?: number; phase?: SharedValue<number>; reduced?: boolean }) {
  return <View accessible accessibilityLabel="Quest completed checkmark medallion" style={{ width: size, height: size }}>
    {phase ? <MedallionAura phase={phase} reduced={reduced} size={size} /> : null}
    <View style={[styles.coinBack, { backgroundColor: "#dba128", borderColor: "#e0a923", transform: [{ translateY: size * 0.055 }] }]} />
    <LinearGradient colors={["#fff4b0", "#ffd44b", "#f2af20"]} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={[styles.coinFace, { borderColor: "#ffe79a" }]}>
      <LinearGradient colors={["#fff9dc", "#ffe9a2"]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={[styles.coinInset, { borderColor: "#e9b54b" }]}>
        <Svg width="72%" height="72%" viewBox="0 0 120 120">
          <Path d="m29 62 21 21 43-47" fill="none" stroke="#dba52e" strokeWidth={19} strokeLinecap="round" strokeLinejoin="round" transform="translate(0 5)" />
          <Path d="m29 62 21 21 43-47" fill="none" stroke={color} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="m30 58 20 20 41-45" fill="none" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </LinearGradient>
      <View style={styles.coinHighlight} />
      {phase ? <MedallionSheen phase={phase} size={size} reduced={reduced} /> : null}
    </LinearGradient>
  </View>;
}

function HeroSpark({ index, clock, idle, color, reduced }: { index: number; clock: SharedValue<number>; idle: SharedValue<number>; color: string; reduced: boolean }) {
  const positions = [{ x: -112, y: -73, size: 15 }, { x: 90, y: -96, size: 22 }, { x: 117, y: 57, size: 14 }, { x: -91, y: 91, size: 21 }];
  const point = positions[index];
  const style = useAnimatedStyle(() => {
    const t = clock.get();
    const show = progress(t, CUE.bannerGone, 120);
    return { opacity: show * (reduced ? 0.8 : 0.78 + 0.22 * Math.sin(idle.get() + index * 1.8)), transform: [{ translateX: point.x + (reduced ? 0 : Math.sin(idle.get() + index * 0.9) * 5) }, { translateY: point.y + (reduced ? 0 : Math.cos(idle.get() + index) * 6) }, { rotate: `${reduced ? 0 : Math.sin(idle.get() + index) * 12}deg` }, { scale: reduced ? 1 : 0.86 + 0.14 * Math.sin(idle.get() + index * 1.8) }] };
  });
  return <Animated.View style={[styles.heroSpark, style]}><Sparkle size={point.size} color={color} /></Animated.View>;
}

function StatGlint({ index, count, start, clock, color, reduced }: { index: number; count: number; start: number; clock: SharedValue<number>; color: string; reduced: boolean }) {
  const style = useAnimatedStyle(() => {
    const p = progress(clock.get(), start - 400, 1550);
    const angle = index * Math.PI * 2 / count + p * Math.PI * 2;
    return { opacity: reduced || p === 0 || p === 1 ? 0 : Math.sin(p * Math.PI), transform: [{ translateX: Math.cos(angle) * 49 }, { translateY: Math.sin(angle) * 34 }, { scale: 0.8 + 0.25 * Math.sin(p * Math.PI) }] };
  });
  return <Animated.View style={[styles.statGlint, style]}><Sparkle size={index % 2 ? 10 : 15} color={color} /></Animated.View>;
}

function StatCard({ label, icon, value, fallback, start, clock, color, reduced, isTime = false }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; value: number | null; fallback?: string; start: number; clock: SharedValue<number>; color: string; reduced: boolean; isTime?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const palette = getCompletionPalette(T.isDark);
  const target = useSharedValue(0);
  useEffect(() => {
    target.set(withTiming(value ?? 0, { duration: reduced ? 0 : 300, easing: EASE_OUT }));
    return () => cancelAnimation(target);
  }, [reduced, target, value]);
  const bodyStyle = useAnimatedStyle(() => {
    const p = progress(clock.get(), start, 240);
    return { opacity: p, transform: [{ translateY: reduced ? 0 : 5 * (1 - p) }, { scale: reduced ? 1 : interpolate(p, [0, 0.7, 1], [0.94, 1.025, 1]) }] };
  });
  const headerStyle = useAnimatedStyle(() => {
    const p = progress(clock.get(), start + CUE.headerDelay, CUE.headerDuration);
    return { opacity: p, transform: [{ translateY: reduced ? 0 : 8 * (1 - p) }] };
  });
  // Only the empty, absolutely positioned outline grows. The value stays
  // anchored while its header unfolds, rather than stretching the text.
  const outlineStyle = useAnimatedStyle(() => ({ height: (44 + 34 * progress(clock.get(), start + CUE.headerDelay, CUE.headerDuration)) + Math.max(0, fontScale - 1) * 46 }));
  const glowStyle = useAnimatedStyle(() => {
    const p = progress(clock.get(), start + 190, 1120);
    return { opacity: reduced ? 0 : Math.sin(p * Math.PI) * 0.55, transform: [{ scale: 1 + Math.sin(p * Math.PI) * 0.025 }] };
  });
  const animatedProps = useAnimatedProps<TextInputProps & { text: string }>(() => {
    const p = progress(clock.get(), start + 30, CUE.countDuration);
    const n = Math.round(target.get() * (1 - Math.pow(1 - p, 2)));
    const text = value === null ? "…" : fallback ?? (isTime
      ? n >= 3600 ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`
      : String(n));
    // Native updates `text` on the UI runtime; web inputs use `value`.
    return { text, defaultValue: text, ...(Platform.OS === "web" ? { value: text } : {}) };
  });
  const finalValue = value === null ? "Saving" : fallback ?? (isTime ? `${Math.floor(value / 60)} minutes ${value % 60} seconds` : String(value));
  const cardHeight = 78 + Math.max(0, fontScale - 1) * 46;
  return <View accessible accessibilityLabel={`${label}: ${finalValue}`} style={[styles.statSlot, { height: cardHeight + 4 }]}>
    <Animated.View pointerEvents="none" style={[styles.statGlow, { borderColor: color, shadowColor: color }, glowStyle]} />
    <Animated.View style={[styles.statBody, { height: cardHeight }, bodyStyle]}>
      <Animated.View pointerEvents="none" style={[styles.statOutline, { borderColor: color, backgroundColor: palette.surface }, outlineStyle]} />
      <Animated.View style={[styles.statHeader, { backgroundColor: color }, headerStyle]}><Text numberOfLines={1} style={[styles.statLabel, { color: palette.statLabel }]}>{label}</Text></Animated.View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.statValueRow, { height: 50 * fontScale }]}>
        <Ionicons name={icon} size={19} color={color} />
        <AnimatedInput accessible={false} editable={false} caretHidden underlineColorAndroid="transparent" pointerEvents="none" animatedProps={animatedProps} defaultValue="0" style={[styles.statValue, { color, textShadowColor: `${color}66`, textShadowRadius: reduced ? 0 : 4, textShadowOffset: { width: 0, height: 0 }, height: 32 * fontScale, fontSize: isTime && (value ?? 0) >= 3600 ? 13 : 18 }]} />
      </View>
      <CardSheen clock={clock} start={start} reduced={reduced} />
      <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 12 }} />
    </Animated.View>
    {Array.from({ length: start === CUE.xp ? 7 : 5 }, (_, index) => <StatGlint key={index} count={start === CUE.xp ? 7 : 5} {...{ index, start, clock, color, reduced }} />)}
  </View>;
}

type Props = { active: boolean; questTitle: string; category?: QuestCategory; xp: number | null; photoCount: number; duration: string; busy: boolean; error: string | null; guestMode: boolean; onContinue: () => void; onShare: () => void; onRetry: () => void };

export function QuestCompletionScene({ active, questTitle, category, xp, photoCount, duration, busy, error, guestMode, onContinue, onShare, onRetry }: Props) {
  const reduced = useReducedMotionPreference();
  const palette = getCompletionPalette(T.isDark);
  const bannerPalette = getCompletionBannerPalette(T.isDark, Platform.OS === "ios" ? category : undefined);
  const { fontScale } = useWindowDimensions();
  const viewport = useAppViewport();
  const layout = useResponsiveScreenLayout(520);
  const [surfaceHeight, setSurfaceHeight] = useState(Math.max(500, viewport.height - 170));
  const [surfaceWidth, setSurfaceWidth] = useState(Math.min(520, layout.contentWidth));
  const [summaryHeight, setSummaryHeight] = useState(144 * fontScale);
  const [actionsReady, setActionsReady] = useState(false);
  const clock = useSharedValue(0);
  const idle = useSharedValue(0);
  const stageHeight = Math.max(470 * Math.max(1, fontScale), surfaceHeight);
  const heroSize = stageHeight < 580 ? 160 : 190;
  const headingY = stageHeight * 0.54;
  const statsY = Math.max(stageHeight * 0.80, headingY + summaryHeight + 28);
  const contentHeight = Math.max(stageHeight, statsY + 110 + Math.max(0, fontScale - 1) * 46);
  const heroY = stageHeight * 0.30;
  const initialHeroY = stageHeight * 0.39;
  const seconds = parseCompletionDuration(duration);
  useEffect(() => {
    clock.set(0);
    idle.set(0);
    setActionsReady(false);
    if (!active) return;
    clock.set(reduced ? CUE.end : withTiming(CUE.end, { duration: CUE.end, easing: Easing.linear }));
    if (!reduced) idle.set(withRepeat(withTiming(Math.PI * 2, { duration: 4400, easing: Easing.linear }), -1, false));
    const readyTimer = setTimeout(() => setActionsReady(true), reduced ? 0 : CUE.actions + 220);
    return () => { clearTimeout(readyTimer); cancelAnimation(clock); cancelAnimation(idle); };
  }, [active, clock, idle, reduced]);
  const heroStyle = useAnimatedStyle(() => {
    const t = clock.get();
    const entrance = easeOut(progress(t, 80, CUE.enter));
    const compact = easeOut(progress(t, CUE.compact, CUE.summary - CUE.compact));
    const phase = idle.get();
    return { opacity: progress(t, 80, 120), transform: [
      { translateX: reduced ? 0 : -surfaceWidth * 1.05 * (1 - entrance) + interpolate(t, [540, 700, 900], [16, -5, 0], Extrapolation.CLAMP) + Math.sin(phase + 0.6) * 4 },
      { translateY: reduced ? 0 : (initialHeroY - heroY) * (1 - compact) + Math.sin(phase) * 7 },
      { scale: reduced ? 1 : interpolate(t, [0, 450, 850, CUE.compact, CUE.bannerGone, 2320, CUE.summary], [1.2, 1.34, 1.3, 1.3, 0.96, 1.035, 1], Extrapolation.CLAMP) },
      { perspective: 700 },
      { rotateX: `${reduced ? 0 : Math.sin(phase + 0.8) * 4}deg` },
      { rotateY: `${reduced ? 0 : Math.sin(phase + 1.1) * 7}deg` },
      { rotate: `${reduced ? 0 : -15 * (1 - entrance) + Math.sin(phase) * 4}deg` },
    ] };
  });
  const introTitleStyle = useAnimatedStyle(() => ({ opacity: reduced ? 0 : progress(clock.get(), 180, 220) * (1 - progress(clock.get(), CUE.compact, 230)), transform: [{ translateY: -32 * progress(clock.get(), CUE.compact, 230) }, { scale: 1 - 0.28 * progress(clock.get(), CUE.compact, 230) }] }));
  const headingStyle = useAnimatedStyle(() => ({ opacity: progress(clock.get(), CUE.bannerGone, 100), transform: [{ translateY: reduced ? 0 : 13 * (1 - easeOut(progress(clock.get(), CUE.bannerGone, 220))) }] }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: progress(clock.get(), CUE.summary - 140, 280) }));
  const actionsStyle = useAnimatedStyle(() => ({ opacity: progress(clock.get(), CUE.actions, 220) }));
  return <View style={[styles.root, { backgroundColor: palette.surface }]}>
    <View style={styles.sceneViewport} onLayout={({ nativeEvent: { layout: bounds } }) => { setSurfaceHeight(bounds.height); setSurfaceWidth(bounds.width); }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ height: contentHeight, width: "100%", overflow: "hidden" }}>
          <CompletionBanner clock={clock} phase={idle} reduced={reduced} width={surfaceWidth} top={initialHeroY - heroSize * 0.65} height={heroSize * 1.3} palette={bannerPalette} />
          <View pointerEvents="none" style={[styles.heroAnchor, { top: heroY - heroSize / 2 }]}>
            <Animated.View style={heroStyle}><CompletionMedallion color={palette.medallion} size={heroSize} phase={idle} reduced={reduced} /></Animated.View>
            {[0, 1, 2, 3].map((index) => <HeroSpark key={index} {...{ index, clock, idle, reduced }} color={palette.stripStreak} />)}
          </View>
          <Animated.View pointerEvents="none" style={[styles.introTitle, { top: stageHeight * 0.68 }, introTitleStyle]}>
            <RewardHeading text={"Quest\ncomplete!"} color={palette.blue} clock={clock} start={650} reduced={reduced} intro />
            {[-1, 1].flatMap((side) => [0, 1].map((index) => <View key={`${side}-${index}`} style={{ position: "absolute", top: 4 + index * 23, left: surfaceWidth / 2 + side * (94 + index * 12), width: index ? 5 : 9, height: index ? 5 : 9, backgroundColor: palette.stripEdge, transform: [{ rotate: "20deg" }] }} />))}
          </Animated.View>
          <View onLayout={({ nativeEvent }) => { if (nativeEvent.layout.height > 0) setSummaryHeight(nativeEvent.layout.height); }} style={[styles.summary, { top: headingY, paddingHorizontal: layout.horizontalPadding }]}>
            <Animated.View style={[{ alignSelf: "stretch" }, headingStyle]}><RewardHeading text="Quest completed!" color={palette.blue} clock={clock} start={CUE.summary + 120} reduced={reduced} /></Animated.View>
            <Animated.View style={[{ alignItems: "center", gap: 7 }, subtitleStyle]}><Text style={[styles.subtitle, { color: palette.copy }]}>You showed up. You followed through.</Text><Text numberOfLines={1} style={{ fontFamily: "Rubik", fontSize: 12, lineHeight: 18, color: palette.copy, textAlign: "center" }}>{questTitle}</Text></Animated.View>
          </View>
          <View style={[styles.stats, { top: statsY, maxWidth: 440, paddingHorizontal: layout.horizontalPadding }]}>
            <StatCard label="TOTAL XP" icon="flash" value={xp} start={CUE.xp} clock={clock} reduced={reduced} color={palette.xp} />
            <StatCard label="TIME SPENT" icon="time-outline" value={seconds ?? 0} fallback={seconds === null ? duration : undefined} isTime start={CUE.time} clock={clock} reduced={reduced} color={palette.blue} />
            <StatCard label="PHOTOS" icon="images-outline" value={photoCount} start={CUE.photos} clock={clock} reduced={reduced} color={palette.photos} />
          </View>
        </View>
      </ScrollView>
    </View>
    <Animated.View pointerEvents={actionsReady ? "auto" : "none"} accessibilityElementsHidden={!actionsReady} importantForAccessibility={actionsReady ? "auto" : "no-hide-descendants"} style={[styles.footer, { maxWidth: 520, paddingHorizontal: layout.horizontalPadding }, actionsStyle]}>
      {error ? <View style={styles.saveStatus}><Text accessibilityRole="alert" style={[styles.error, { color: T.red }]}>{error}</Text><SoftButton label="Retry save" color={palette.blue} textColor={palette.buttonLabel} style={{ borderBottomColor: palette.buttonEdge }} onPress={onRetry} disabled={busy} /></View> : null}
      <View style={styles.actions}>
        {!guestMode ? <Pressable accessibilityRole="button" accessibilityLabel="Share your adventure" accessibilityState={{ disabled: !actionsReady || busy || Boolean(error) }} disabled={!actionsReady || busy || Boolean(error)} onPress={() => { haptic(); onShare(); }} style={({ pressed }) => [styles.shareButton, { backgroundColor: palette.surface, borderColor: palette.shareBorder, borderBottomColor: palette.shareEdge, borderBottomWidth: pressed ? 2 : 4, opacity: busy || error ? 0.5 : 1, transform: [{ translateY: pressed ? 2 : 0 }] }]}><Ionicons name="share-outline" size={25} color={palette.blue} /></Pressable> : null}
        <SoftButton label={busy ? "Saving…" : "Continue"} color={palette.blue} textColor={palette.buttonLabel} onPress={onContinue} disabled={!actionsReady || busy || Boolean(error)} style={{ flex: 1, borderRadius: 15, borderBottomColor: palette.buttonEdge }} />
      </View>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, width: "100%" },
  sceneViewport: { flex: 1, minHeight: 0 },
  heroAnchor: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  heroSpark: { position: "absolute", left: "50%", top: "50%", marginLeft: -9, marginTop: -9 },
  coinBack: { position: "absolute", inset: 4, borderRadius: 999, borderWidth: 5 },
  coinFace: { flex: 1, borderRadius: 999, borderWidth: 5, padding: 14, overflow: "hidden" },
  coinInset: { flex: 1, borderRadius: 999, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  coinHighlight: { position: "absolute", top: 10, left: 35, width: 55, height: 8, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.6)", transform: [{ rotate: "-28deg" }] },
  introTitle: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  summary: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 16 },
  subtitle: { fontFamily: "Rubik", fontSize: 17, lineHeight: 24, textAlign: "center", maxWidth: 400 },
  stats: { position: "absolute", alignSelf: "center", width: "100%", flexDirection: "row", gap: 12 },
  statSlot: { flex: 1, minWidth: 0, height: 82, justifyContent: "center", alignItems: "center" },
  statBody: { width: "100%", height: 78, borderRadius: 15, overflow: "hidden", justifyContent: "flex-end" },
  statOutline: { position: "absolute", bottom: 0, left: 0, right: 0, borderWidth: 2, borderBottomWidth: 3, borderRadius: 15 },
  statHeader: { position: "absolute", top: 0, left: 0, right: 0, minHeight: 21, borderTopLeftRadius: 15, borderTopRightRadius: 15, justifyContent: "center", alignItems: "center", paddingHorizontal: 2 },
  statLabel: { fontFamily: "RubikBold", fontSize: 9, lineHeight: 13, paddingVertical: 4, letterSpacing: 0.3 },
  statValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, height: 50, paddingHorizontal: 5 },
  statValue: { flex: 1, minWidth: 0, padding: 0, height: 32, fontFamily: "RubikBold", fontSize: 18, fontVariant: ["tabular-nums"], textAlign: "center", includeFontPadding: false },
  statGlow: { position: "absolute", inset: -3, borderWidth: 4, borderRadius: 20, shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  statGlint: { position: "absolute", top: "50%", left: "50%", marginLeft: -6, marginTop: -6 },
  footer: { width: "100%", alignSelf: "center", paddingTop: 12, paddingBottom: 16, gap: 12 },
  saveStatus: { gap: 10 },
  error: { fontFamily: "Rubik", fontSize: 13, lineHeight: 19, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10 },
  shareButton: { width: 58, minHeight: 58, paddingHorizontal: 0, borderRadius: 15, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
