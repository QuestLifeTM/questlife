import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import type { ComponentProps } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, type SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GoogleIcon, OutlineButton } from "@/components/auth/AuthControls";
import { radius, shadow, T } from "@/components/theme";
import { haptic, useResponsiveScreenLayout } from "@/components/ui";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

type IconName = ComponentProps<typeof Ionicons>["name"];

// The phone needs a generous clearance on every axis, so this is deliberately
// a circle rather than a perspective ellipse.
const ORBIT_RADIUS = 174;
const QUEST_TILE_SIZE = 40;

function OrbitingQuestTile({ angle, background, color, icon, orbitRotation, scale }: { angle: number; background: string; color: string; icon: IconName; orbitRotation: SharedValue<number>; scale: number }) {
  const orbitStyle = useAnimatedStyle(() => {
    const angleInRadians = ((orbitRotation.get() + angle) * Math.PI) / 180;
    return {
      transform: [
        { translateX: ORBIT_RADIUS * scale * Math.cos(angleInRadians) },
        { translateY: ORBIT_RADIUS * scale * Math.sin(angleInRadians) },
      ],
    };
  });

  return <Animated.View style={[styles.questTile, styles.orbitTile, { backgroundColor: background }, orbitStyle]}><Ionicons color={color} name={icon} size={24} /></Animated.View>;
}

function QuestPhonePreview() {
  const reducedMotion = useReducedMotionPreference();
  const { contentWidth } = useResponsiveScreenLayout();
  const orbitRotation = useSharedValue(0);
  const phoneFloatX = useSharedValue(0);
  const phoneFloatY = useSharedValue(0);
  const phoneTilt = useSharedValue(0);
  // Leave room for the account and legal actions without shrinking the phone
  // itself; only the decorative orbit tightens on compact screens.
  const orbitScale = Math.min(0.82, contentWidth / 430);
  const phoneFloatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: phoneFloatX.get() },
      { translateY: phoneFloatY.get() },
      { rotate: `${phoneTilt.get()}deg` },
    ],
  }));
  const phoneShadowStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + (phoneFloatY.get() + 5) * 0.025,
    transform: [{ scaleX: 1 + phoneFloatY.get() * 0.018 }],
  }));

  useEffect(() => {
    if (reducedMotion) {
      orbitRotation.set(0);
      phoneFloatX.set(0);
      phoneFloatY.set(0);
      phoneTilt.set(0);
      return;
    }

    orbitRotation.set(0);
    phoneFloatX.set(0);
    phoneFloatY.set(0);
    phoneTilt.set(0);
    orbitRotation.set(withRepeat(withTiming(360, { duration: 20_000, easing: Easing.linear }), -1, false));
    // A small, slow drift reads as a held object in space. It intentionally
    // resolves back to the origin, so each loop joins without a visible snap.
    const driftEase = Easing.inOut(Easing.sin);
    phoneFloatX.set(withRepeat(withSequence(
      withTiming(2.5, { duration: 1_900, easing: driftEase }),
      withTiming(-1.5, { duration: 2_300, easing: driftEase }),
      withTiming(0, { duration: 1_800, easing: driftEase }),
    ), -1, false));
    phoneFloatY.set(withRepeat(withSequence(
      withTiming(-5, { duration: 1_900, easing: driftEase }),
      withTiming(2.5, { duration: 2_300, easing: driftEase }),
      withTiming(0, { duration: 1_800, easing: driftEase }),
    ), -1, false));
    phoneTilt.set(withRepeat(withSequence(
      withTiming(0.65, { duration: 1_900, easing: driftEase }),
      withTiming(-0.45, { duration: 2_300, easing: driftEase }),
      withTiming(0, { duration: 1_800, easing: driftEase }),
    ), -1, false));

    return () => {
      cancelAnimation(orbitRotation);
      cancelAnimation(phoneFloatX);
      cancelAnimation(phoneFloatY);
      cancelAnimation(phoneTilt);
    };
  }, [orbitRotation, phoneFloatX, phoneFloatY, phoneTilt, reducedMotion]);

  return (
    <View accessibilityElementsHidden pointerEvents="none" style={styles.preview}>
      <View style={[styles.illustrationStage, { height: (ORBIT_RADIUS * 2 + QUEST_TILE_SIZE) * orbitScale }]}>
        <View style={styles.orbitLayer}>
          <View style={[styles.orbit, { width: ORBIT_RADIUS * 2 * orbitScale, height: ORBIT_RADIUS * 2 * orbitScale }]} />
          <OrbitingQuestTile angle={-90} background="#eeeaff" color={T.purple} icon="book" orbitRotation={orbitRotation} scale={orbitScale} />
          <OrbitingQuestTile angle={-45} background="#fff4cd" color={T.orange} icon="restaurant" orbitRotation={orbitRotation} scale={orbitScale} />
          <OrbitingQuestTile angle={0} background="#fff0f5" color={T.pink} icon="people" orbitRotation={orbitRotation} scale={orbitScale} />
          <OrbitingQuestTile angle={45} background="#e1f8ef" color={T.green} icon="leaf" orbitRotation={orbitRotation} scale={orbitScale} />
          <OrbitingQuestTile angle={90} background="#f0ecff" color={T.purple} icon="camera" orbitRotation={orbitRotation} scale={orbitScale} />
          <OrbitingQuestTile angle={135} background="#fff4cd" color={T.orange} icon="flash" orbitRotation={orbitRotation} scale={orbitScale} />
          <OrbitingQuestTile angle={180} background="#e9f5ff" color={T.blue} icon="walk" orbitRotation={orbitRotation} scale={orbitScale} />
          <OrbitingQuestTile angle={225} background="#e1f8ef" color={T.green} icon="sparkles" orbitRotation={orbitRotation} scale={orbitScale} />
        </View>
        <View style={styles.phoneGlow} />
        <Animated.View style={[styles.phoneShadow, phoneShadowStyle]} />
        <Animated.View style={[styles.phoneFloat, phoneFloatStyle]}>
          <View style={styles.phoneFrame}>
            <View style={styles.phone}>
              <View style={styles.phoneNotch} />
              <View style={styles.phoneHero}>
                <Text style={styles.phoneGreeting}>Today in QuestLife</Text>
                <Text style={styles.phoneTitle}>Your next{`\n`}quest</Text>
              </View>
              <View style={styles.phoneBody}>
                <View style={styles.phoneQuest}>
                  <View style={styles.phoneQuestIcon}><Ionicons color={T.white} name="compass" size={13} /></View>
                  <View style={styles.phoneQuestCopy}><View style={styles.phoneLineLong} /><View style={styles.phoneLineShort} /></View>
                </View>
                <View style={styles.phoneQuest}>
                  <View style={[styles.phoneQuestIcon, styles.phoneQuestIconGreen]}><Ionicons color={T.white} name="leaf" size={13} /></View>
                  <View style={styles.phoneQuestCopy}><View style={styles.phoneLineLong} /><View style={styles.phoneLineShort} /></View>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

export default function AuthOptionsScreen() {
  const { firstName, guestQuest } = useLocalSearchParams<{ firstName?: string; guestQuest?: string }>();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsiveScreenLayout();
  const hasGuestQuest = guestQuest === "completed";

  function continueWithEmail() {
    router.push({ pathname: "/(auth)/register", params: { ...(firstName ? { firstName } : {}), ...(hasGuestQuest ? { guestQuest } : {}) } });
  }

  function showOAuthSetup() {
    Alert.alert("Provider setup required", "Google and Apple sign in require provider credentials in Supabase before they can be enabled safely.");
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, {
          paddingTop: Math.max(insets.top + 18, 30),
          paddingBottom: Math.max(insets.bottom + 16, 24),
          paddingLeft: insets.left + horizontalPadding,
          paddingRight: insets.right + horizontalPadding,
        }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.brand}>QuestLife</Text>
        <Text style={styles.title}>Ready to start questing?</Text>
        <Text style={styles.subtitle}>Create an account and start building your adventure.</Text>
      </View>
      <QuestPhonePreview />
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => { haptic(); showOAuthSetup(); }} style={({ pressed }) => [styles.appleButton, pressed && styles.pressed]}>
          <Ionicons color={T.white} name="logo-apple" size={21} />
          <Text style={styles.appleLabel}>Continue with Apple</Text>
        </Pressable>
        <OutlineButton title="Continue with Google" onPress={showOAuthSetup}><GoogleIcon /></OutlineButton>
        <OutlineButton title="Use email instead" onPress={continueWithEmail}><Ionicons color={T.blue} name="mail-outline" size={21} /></OutlineButton>
        <Text style={styles.legal}>By continuing, you agree to our <Text style={styles.legalLink}>Terms of Service</Text> and <Text style={styles.legalLink}>Privacy Policy</Text>.</Text>
      </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scrollContent: { flexGrow: 1 },
  content: { flexGrow: 1 },
  header: { gap: 8 },
  brand: { color: T.blue, fontSize: 13, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { color: T.dark, fontFamily: "RubikBlack", fontSize: 39, lineHeight: 43, letterSpacing: -0.7 },
  subtitle: { maxWidth: 290, color: T.muted, fontFamily: "Rubik", fontSize: 16, lineHeight: 22, fontWeight: "700" },
  preview: { flex: 1, minHeight: 286, alignItems: "center", justifyContent: "center" },
  illustrationStage: { width: "100%", maxWidth: 360, alignItems: "center", justifyContent: "center", position: "relative" },
  orbitLayer: { position: "absolute", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  orbit: { borderRadius: 999, borderWidth: 2, borderColor: `${T.blue}20`, borderStyle: "dashed" },
  questTile: { position: "absolute", zIndex: 3, width: QUEST_TILE_SIZE, height: QUEST_TILE_SIZE, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: T.white, ...shadow },
  orbitTile: { left: "50%", top: "50%", marginLeft: -(QUEST_TILE_SIZE / 2), marginTop: -(QUEST_TILE_SIZE / 2) },
  phoneGlow: { position: "absolute", zIndex: 1, top: "50%", width: 176, height: 176, marginTop: -88, borderRadius: 88, backgroundColor: "rgba(77,168,255,0.13)", boxShadow: "0px 0px 28px rgba(77,168,255,0.18)" },
  phoneFloat: { position: "absolute", zIndex: 2, top: "50%", width: 128, height: 198, marginTop: -99 },
  phoneShadow: { position: "absolute", zIndex: 1, top: "50%", width: 102, height: 11, marginTop: 104, borderRadius: 99, backgroundColor: `${T.blue}18` },
  phone: { width: 128, height: 198, borderRadius: 24, overflow: "hidden", backgroundColor: T.white, borderWidth: 5, borderColor: T.dark, transform: [{ rotate: "-8deg" }] },
  phoneFrame: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", transform: [{ scale: 0.92 }] },
  phoneNotch: { position: "absolute", zIndex: 2, width: 48, height: 9, top: 5, left: 35, borderRadius: 999, backgroundColor: T.dark },
  phoneHero: { height: 78, paddingHorizontal: 13, paddingTop: 24, backgroundColor: T.blue },
  phoneGreeting: { color: "#dff1ff", fontFamily: "Rubik", fontSize: 7, fontWeight: "800" },
  phoneTitle: { marginTop: 3, color: T.white, fontFamily: "RubikBlack", fontSize: 16, lineHeight: 18, letterSpacing: -0.2 },
  phoneBody: { flex: 1, gap: 7, padding: 9, backgroundColor: T.white },
  phoneQuest: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: T.border, borderRadius: 8, padding: 6 },
  phoneQuestIcon: { width: 20, height: 20, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: T.blue },
  phoneQuestIconGreen: { backgroundColor: T.green },
  phoneQuestCopy: { gap: 4, flex: 1 },
  phoneLineLong: { width: "82%", height: 4, borderRadius: 999, backgroundColor: T.dark },
  phoneLineShort: { width: "56%", height: 3, borderRadius: 999, backgroundColor: T.border },
  actions: { gap: 10 },
  appleButton: { minHeight: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, backgroundColor: T.dark },
  appleLabel: { color: T.white, fontSize: 16, fontWeight: "900" },
  legal: { color: T.muted, fontFamily: "Rubik", fontSize: 11, lineHeight: 15, fontWeight: "500", textAlign: "center" },
  legalLink: { color: T.muted, fontFamily: "RubikBold", textDecorationLine: "underline" },
  pressed: { transform: [{ scale: 0.97 }] },
});
