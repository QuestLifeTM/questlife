import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { ImageBackground, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/components/theme";
import { haptic } from "@/components/ui";

const stoneArchBackground = require("../../assets/onboarding/stone-arch-background.png");

export default function QuestionsPathScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  function continueOnboarding() {
    haptic();
    router.replace({ pathname: "/onboarding/understanding", params: firstName ? { firstName, stage: "quest" } : { stage: "quest" } });
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ImageBackground source={stoneArchBackground} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <LinearGradient pointerEvents="none" colors={["rgba(5,10,7,0.5)", "rgba(5,10,7,0.76)"]} locations={[0, 1]} style={StyleSheet.absoluteFill} />
      </ImageBackground>
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 190, height * 0.35), paddingBottom: Math.max(insets.bottom + 24, 34) }]}>
        <View style={styles.copy}>
          <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={2} maxFontSizeMultiplier={1.15} style={styles.title}>We <Text style={styles.needAccent}>need</Text> you to answer these questions honestly</Text>
          <Text style={styles.body}>Your answers help us recommend adventures and quests that are perfect for your journey.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue" onPress={continueOnboarding} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#101510" },
  content: { flex: 1, paddingHorizontal: 20, justifyContent: "space-between", gap: 32 },
  copy: { gap: 20 },
  title: { maxWidth: 400, color: T.white, fontFamily: "RubikBlack", fontSize: 32, lineHeight: 39, letterSpacing: -0.5 },
  needAccent: { color: T.blue },
  body: { maxWidth: 350, color: "rgba(255,255,255,0.92)", fontFamily: "Rubik", fontSize: 17, lineHeight: 26 },
  primaryButton: { minHeight: 66, paddingHorizontal: 18, borderRadius: 20, backgroundColor: T.blue, borderBottomWidth: 6, borderBottomColor: "#258fd8", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: T.white, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, letterSpacing: 0.15, textAlign: "center" },
  buttonPressed: { opacity: 0.82, transform: [{ translateY: 2 }] },
});
