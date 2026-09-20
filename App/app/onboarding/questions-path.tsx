import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { ImageBackground, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/components/theme";
import { haptic, useResponsiveScreenLayout } from "@/components/ui";

const stoneArchBackground = require("../../assets/onboarding/stone-arch-background.png");

export default function QuestionsPathScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { horizontalPadding, isShort } = useResponsiveScreenLayout();

  function continueOnboarding() {
    haptic();
    router.replace({ pathname: "/onboarding/claim-username", params: firstName ? { firstName } : {} });
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ImageBackground source={stoneArchBackground} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <LinearGradient pointerEvents="none" colors={["rgba(5,10,7,0.5)", "rgba(5,10,7,0.76)"]} locations={[0, 1]} style={StyleSheet.absoluteFill} />
      </ImageBackground>
      <View style={[styles.content, {
        paddingTop: Math.max(insets.top + (isShort ? 150 : 190), height * (isShort ? 0.31 : 0.35)),
        paddingBottom: Math.max(insets.bottom + 24, 34),
        paddingLeft: insets.left + horizontalPadding,
        paddingRight: insets.right + horizontalPadding,
      }]}>
        <View style={styles.copy}>
          <Text maxFontSizeMultiplier={1.35} style={styles.title}>Let&apos;s make <Text style={styles.questLifeAccent}>QuestLife</Text> feel like you.</Text>
          <Text style={styles.body}>Choose what feels like you, and we&apos;ll do the rest for you.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Let's do it" onPress={continueOnboarding} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
          <Text style={styles.primaryButtonText}>Let&apos;s do it</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#101510" },
  content: { flex: 1, justifyContent: "space-between", gap: 32 },
  copy: { gap: 20 },
  title: { maxWidth: 400, color: T.white, fontFamily: "RubikBlack", fontSize: 32, lineHeight: 39, letterSpacing: -0.5 },
  questLifeAccent: { color: T.blue },
  body: { maxWidth: 350, color: "rgba(255,255,255,0.92)", fontFamily: "Rubik", fontSize: 17, lineHeight: 26 },
  primaryButton: { minHeight: 66, paddingHorizontal: 18, borderRadius: 20, backgroundColor: T.blue, borderBottomWidth: 6, borderBottomColor: "#258fd8", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: T.white, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, letterSpacing: 0.15, textAlign: "center" },
  buttonPressed: { opacity: 0.82, transform: [{ translateY: 2 }] },
});
