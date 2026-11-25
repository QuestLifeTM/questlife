import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, interpolate, Extrapolation, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { getCompletionPalette } from "@/components/quest-completion-palette";
import { completionCues as CUE, completionProgress as progress } from "@/lib/completion-motion";

type Palette = ReturnType<typeof getCompletionPalette>;
type Motion = { clock: SharedValue<number>; phase: SharedValue<number>; reduced: boolean };
const easeOut = Easing.bezierFn(0.23, 1, 0.32, 1);

function MovingStreak({ index, width, clock, color }: { index: number; width: number; clock: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    // Different speeds/lengths provide depth while the whole strip holds.
    const distance = width + 300;
    const travel = (clock.get() * (0.15 + (index % 3) * 0.055) + index * 147) % distance;
    return { opacity: index % 3 === 0 ? 0.95 : 0.7, transform: [{ translateX: width - travel }, { skewX: "-36deg" }] };
  });
  return <Animated.View style={[styles.streak, { top: `${9 + index * 11}%`, width: 85 + (index % 4) * 38, height: index % 3 === 0 ? 9 : 5, backgroundColor: color }, style]} />;
}

export function CompletionBanner({ clock, phase, reduced, width, top, height, palette }: Motion & { width: number; top: number; height: number; palette: Palette }) {
  const style = useAnimatedStyle(() => {
    const t = clock.get();
    const enter = easeOut(progress(t, 90, 620));
    const exit = easeOut(progress(t, CUE.compact, CUE.bannerGone - CUE.compact));
    return {
      opacity: reduced || t >= CUE.bannerGone ? 0 : progress(t, 80, 140),
      transform: [
        { translateX: width * 1.35 * (1 - enter) - width * 1.5 * exit },
        { translateY: Math.sin(phase.get()) * 3 - exit * 12 },
        { scaleY: 1 - exit * 0.22 },
        { rotate: `${-11 + Math.sin(phase.get()) * 0.7}deg` },
      ],
    };
  });
  const glow = useAnimatedStyle(() => ({ opacity: reduced ? 0 : 0.14 + Math.sin(phase.get()) * 0.05 }));
  return <Animated.View pointerEvents="none" style={[styles.banner, { top, height }, style]}>
    <Animated.View style={[styles.bannerGlow, { backgroundColor: palette.stripCenter, shadowColor: palette.stripCenter }, glow]} />
    <View style={styles.stripClip}>
      <Svg width="100%" height="100%" viewBox="0 0 600 240" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Path fill={palette.stripEdge} d="M0 12H180V0H395V12H600V228H420V240H205V228H0Z" />
        <Path fill={palette.stripCenter} d="M0 28H600V212H0Z" />
        <Path fill={palette.stripStreak} d="M0 28H600V39H0Z M0 201H600V212H0Z" />
      </Svg>
      {Array.from({ length: 8 }, (_, index) => <MovingStreak key={index} index={index} width={width * 1.3} clock={clock} color={palette.stripStreak} />)}
      <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0)", "rgba(255,255,255,0.12)"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
    </View>
  </Animated.View>;
}

/** A clipped specular band travels across the actual face of the medal. */
export function MedallionSheen({ phase, size, reduced }: { phase: SharedValue<number>; size: number; reduced: boolean }) {
  const style = useAnimatedStyle(() => {
    const p = (phase.get() / (Math.PI * 2) + 0.18) % 1;
    return { opacity: reduced ? 0 : Math.sin(p * Math.PI) * 0.85, transform: [{ translateX: -size * 0.65 + p * size * 2 }, { rotate: "-24deg" }] };
  });
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 999, overflow: "hidden" }]}>
    <Animated.View style={[{ position: "absolute", top: -size * 0.35, left: 0, width: size * 0.38, height: size * 1.7 }, style]}>
      <LinearGradient colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.72)", "rgba(255,255,255,0)"]} locations={[0, 0.48, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
    </Animated.View>
  </View>;
}

export function MedallionAura({ phase, reduced, size }: { phase: SharedValue<number>; reduced: boolean; size: number }) {
  const style = useAnimatedStyle(() => ({ opacity: reduced ? 0.15 : 0.17 + 0.08 * Math.sin(phase.get()), transform: [{ scale: reduced ? 1 : 1 + Math.sin(phase.get()) * 0.025 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", width: size * 1.06, height: size * 1.06, borderRadius: 999, backgroundColor: "#ffe58a", shadowColor: "#ffc83d", shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, top: -size * 0.03, left: -size * 0.03 }, style]} />;
}

/** Masked highlight catches only the letters; web retains the crisp glow. */
export function RewardHeading({ text, color, clock, start, reduced, intro = false }: { text: string; color: string; clock: SharedValue<number>; start: number; reduced: boolean; intro?: boolean }) {
  const style = useAnimatedStyle(() => {
    const p = progress(clock.get(), start, 1050);
    return { opacity: reduced || p === 0 || p === 1 ? 0 : Math.sin(p * Math.PI) * 0.8, transform: [{ translateX: interpolate(p, [0, 1], [-220, 420], Extrapolation.CLAMP) }, { skewX: "-18deg" }] };
  });
  const typography = { fontFamily: "RubikBold", fontSize: intro ? 32 : 26, lineHeight: intro ? 39 : 34, textAlign: "center" as const };
  return <View style={{ alignSelf: "stretch" }}>
    <Text accessibilityRole={intro ? undefined : "header"} style={[typography, { color, textShadowColor: `${color}45`, textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } }]}>{text}</Text>
    {Platform.OS !== "web" && !reduced ? <MaskedView pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} maskElement={<Text style={[typography, { color: "#000000" }]}>{text}</Text>}>
      <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, width: 86 }, style]}><LinearGradient colors={["rgba(255,255,255,0)", "#ffffff", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} /></Animated.View>
    </MaskedView> : null}
  </View>;
}

export function CardSheen({ clock, start, reduced }: { clock: SharedValue<number>; start: number; reduced: boolean }) {
  const style = useAnimatedStyle(() => {
    const p = progress(clock.get(), start + CUE.headerDelay - 80, 780);
    return { opacity: reduced || p === 0 || p === 1 ? 0 : Math.sin(p * Math.PI) * 0.6, transform: [{ translateX: -65 + p * 245 }, { skewX: "-24deg" }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, bottom: 0, width: 35 }, style]}><LinearGradient colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.85)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} /></Animated.View>;
}

const styles = StyleSheet.create({
  banner: { position: "absolute", left: "-15%", width: "130%" },
  stripClip: { flex: 1, overflow: "hidden" },
  bannerGlow: { position: "absolute", inset: 12, shadowOpacity: 0.9, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  streak: { position: "absolute", left: 0, borderRadius: 2 },
});
