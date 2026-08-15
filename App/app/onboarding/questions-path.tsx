import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/components/theme";
import { haptic } from "@/components/ui";

const stoneArchBackground = require("../../assets/onboarding/stone-arch-background.png");

export default function QuestionsPathScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const insets = useSafeAreaInsets();

  function chooseQuestPreview() {
    haptic();
    router.replace({ pathname: "/onboarding/age", params: firstName ? { firstName } : {} });
  }

  function skipQuestPreview() {
    haptic();
    router.replace({ pathname: "/onboarding/age", params: { ...(firstName ? { firstName } : {}), skipQuestPreview: "true" } });
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ImageBackground source={stoneArchBackground} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <LinearGradient pointerEvents="none" colors={["rgba(5,10,7,0.5)", "rgba(5,10,7,0.76)"]} locations={[0, 1]} style={StyleSheet.absoluteFill} />
      </ImageBackground>
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 36, 64), paddingBottom: Math.max(insets.bottom + 24, 34) }]}>
        <View style={styles.copy}>
          <Text style={styles.title}>Please answer these next questions honestly.</Text>
          <Text style={styles.body}>These questions help us personalize your recommendations.</Text>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Answer these questions like an actual quest" onPress={chooseQuestPreview} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
            <Text style={styles.primaryButtonText}>Answer these questions like an actual quest</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Skip the quest preview and just answer the questions" onPress={skipQuestPreview} style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
            <Text style={styles.secondaryButtonText}>Skip the quest preview and just answer the questions</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#101510" },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between", gap: 32 },
  copy: { gap: 14 },
  title: { color: T.white, fontFamily: "RubikBlack", fontSize: 29, lineHeight: 35, letterSpacing: -0.45 },
  body: { maxWidth: 330, color: "rgba(255,255,255,0.92)", fontFamily: "Rubik", fontSize: 17, lineHeight: 24 },
  actions: { gap: 12 },
  primaryButton: { minHeight: 66, paddingHorizontal: 18, borderRadius: 20, backgroundColor: T.blue, borderBottomWidth: 6, borderBottomColor: "#258fd8", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: T.white, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, letterSpacing: 0.15, textAlign: "center" },
  secondaryButton: { minHeight: 66, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.62)", backgroundColor: "rgba(255,255,255,0.11)", alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: T.white, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, letterSpacing: 0.15, textAlign: "center" },
  buttonPressed: { opacity: 0.82, transform: [{ translateY: 2 }] },
});
