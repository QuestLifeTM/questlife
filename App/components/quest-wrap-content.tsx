import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, useWindowDimensions, View, type TextInputProps } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

import { T } from "@/components/theme";
import { completionCues, completionProgress as progress } from "@/lib/completion-motion";
import { parseCompletionDuration } from "@/lib/completion-recap";

const AnimatedInput = Animated.createAnimatedComponent(TextInput);
const START = completionCues.summary;
const easeOut = Easing.bezierFn(0.23, 1, 0.32, 1);

function WrapHeading() {
  return <View>
    {/* Static offset glyphs make the reference's solid sticker edge without blur. */}
    {[-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => x || y ? <Text key={`${x}:${y}`} accessible={false} accessibilityElementsHidden style={[styles.heading, styles.headingEdge, { transform: [{ translateX: x * 3 }, { translateY: y * 3 }] }]}>Your Quest{"\n"}Wrap</Text> : null))}
    <Text accessibilityRole="header" style={[styles.heading, { color: "#151515" }]}>Your Quest{"\n"}Wrap</Text>
  </View>;
}

function WrapStat({ label, value, fallback, time = false, start, clock, reduced }: {
  label: string; value: number | null; fallback?: string; time?: boolean; start: number; clock: SharedValue<number>; reduced: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const target = useSharedValue(value ?? 0);
  useEffect(() => {
    // Late server rewards still count up, without restarting the scene.
    target.set(withTiming(value ?? 0, { duration: reduced ? 0 : 650, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(target);
  }, [reduced, target, value]);
  const style = useAnimatedStyle(() => {
    const p = easeOut(progress(clock.get(), start, 420));
    return { opacity: p, transform: [{ translateY: reduced ? 0 : 18 * (1 - p) }] };
  });
  const animatedProps = useAnimatedProps<TextInputProps & { text: string }>(() => {
    const p = reduced ? 1 : easeOut(progress(clock.get(), start + 80, 850));
    const n = Math.round(target.get() * p);
    const text = fallback ?? (value === null ? "…" : time
      ? n >= 3600 ? `${Math.floor(n / 3600)}h ${String(Math.floor(n / 60) % 60).padStart(2, "0")}m` : n >= 60 ? `${Math.floor(n / 60)}m ${String(n % 60).padStart(2, "0")}s` : `${n}s`
      : `+${n.toLocaleString("en-US")}`);
    return { text, defaultValue: text };
  });
  return <Animated.View accessible accessibilityLabel={`${label}: ${fallback ?? (value === null ? "Saving" : time ? `${value} seconds` : `${value} XP`)}`} style={[styles.stat, style]}>
    <Text style={[styles.label, { color: T.muted }]}>{label}</Text>
    <AnimatedInput accessible={false} editable={false} caretHidden pointerEvents="none" underlineColorAndroid="transparent" animatedProps={animatedProps} defaultValue="0" style={[styles.value, { color: T.dark, height: 44 * fontScale, fontSize: time && (value ?? 0) >= 3600 ? 27 : 30 }]} />
  </Animated.View>;
}

/** iOS wrap: portrait memory, quiet labels and large count-up values. */
export function QuestWrapContent({ clock, reduced, width, height, photoUri, duration, xp, questTitle }: {
  clock: SharedValue<number>; reduced: boolean; width: number; height: number; photoUri?: string; duration: string; xp: number | null; questTitle: string;
}) {
  const { fontScale } = useWindowDimensions();
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const seconds = parseCompletionDuration(duration);
  const photoWidth = Math.min(width * 0.57, 290, Math.max(170, (height - 240 * fontScale) * 0.82));
  const heading = useAnimatedStyle(() => {
    const p = easeOut(progress(clock.get(), START, 420));
    return { opacity: p, transform: [{ translateY: reduced ? 0 : 24 * (1 - p) }, { scale: reduced ? 1 : 0.94 + 0.06 * p }] };
  });
  const photo = useAnimatedStyle(() => {
    const p = easeOut(progress(clock.get(), START + 150, 580));
    return { opacity: p, transform: [{ translateY: reduced ? 0 : 42 * (1 - p) }, { scale: reduced ? 1 : 0.86 + 0.14 * p }, { rotate: `${reduced ? 0 : -5 * (1 - p)}deg` }] };
  });
  return <View style={[styles.content, { minHeight: height, paddingTop: Math.max(24, height * 0.07), paddingHorizontal: 24 }]}>
    <Animated.View style={heading}><WrapHeading /></Animated.View>
    <Animated.View style={[styles.photo, { width: photoWidth, aspectRatio: 0.82, borderRadius: photoWidth * 0.085, backgroundColor: T.isDark ? "#242b32" : "#f3f3f1" }, photo]}>
      {photoUri && failedPhoto !== photoUri ? <Image source={{ uri: photoUri }} contentFit="cover" transition={0} accessibilityLabel={`A moment from ${questTitle}`} style={StyleSheet.absoluteFill} onError={() => setFailedPhoto(photoUri)} /> : <View style={styles.empty}><Text style={[styles.emptyTitle, { color: T.dark }]}>{questTitle}</Text><Text style={[styles.emptyCopy, { color: T.muted }]}>{photoUri ? "Photo unavailable" : "A memory worth keeping"}</Text></View>}
    </Animated.View>
    <View style={[styles.stats, { flexDirection: fontScale > 1.5 ? "column" : "row" }]}>
      <WrapStat label="Time spent" value={seconds ?? 0} fallback={seconds === null ? duration : undefined} time start={START + 380} {...{ clock, reduced }} />
      <WrapStat label="XP earned" value={xp} start={START + 510} {...{ clock, reduced }} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  content: { alignItems: "center", paddingBottom: 24, gap: 28 },
  heading: { fontFamily: "RubikBold", fontSize: 32, lineHeight: 35, textAlign: "center", letterSpacing: -0.9 },
  headingEdge: { position: "absolute", left: 0, right: 0, top: 0, color: "#fec100" },
  photo: { overflow: "hidden" },
  stats: { width: "100%", maxWidth: 420, justifyContent: "center", gap: 20, marginTop: 2 },
  stat: { flex: 1, minWidth: 0, alignItems: "center", gap: 8 },
  label: { fontFamily: "Rubik", fontSize: 14, lineHeight: 20, textAlign: "center" },
  value: { width: "100%", padding: 0, fontFamily: "RubikBold", fontVariant: ["tabular-nums"], textAlign: "center", includeFontPadding: false },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  emptyTitle: { fontFamily: "RubikBold", fontSize: 22, textAlign: "center" },
  emptyCopy: { fontFamily: "Rubik", fontSize: 13, textAlign: "center" },
});
