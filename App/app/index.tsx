import { Asset } from "expo-asset";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingIntro } from "@/components/onboarding-intro";
import { T, themedStyles } from "@/components/theme";
import { haptic, Sheet, useResponsiveScreenLayout } from "@/components/ui";
import { getIntroEnabled } from "@/services/announcements/announcementService";
import { useThemeKey } from "@/contexts/SettingsContext";

const welcomeArtwork = require("../assets/onboarding/screen-one.png");

export default function OnboardingWelcomeScreen() {
  useThemeKey();
  const { skipIntro } = useLocalSearchParams<{ skipIntro?: string }>();
  const insets = useSafeAreaInsets();
  const { horizontalPadding, width } = useResponsiveScreenLayout();
  const split = Platform.OS === "web" && width >= 900;
  const [introComplete, setIntroComplete] = useState(skipIntro === "1");
  const [introEnabled, setIntroEnabled] = useState<boolean | null>(null);
  const [firstName, setFirstName] = useState("");
  const [nameSheetVisible, setNameSheetVisible] = useState(false);
  const welcomeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Cache the welcome artwork while the text-only intro is playing so its
    // background is ready before the intro hands control to this screen.
    void Asset.loadAsync(welcomeArtwork).catch(() => {
      // The ImageBackground can still load the bundled image normally.
    });
  }, []);

  useEffect(() => {
    if (!introComplete) return;

    welcomeOpacity.setValue(0);
    Animated.timing(welcomeOpacity, {
      toValue: 1,
      duration: 1100,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [introComplete, welcomeOpacity]);

  useEffect(() => {
    let active = true;

    getIntroEnabled()
      .then((enabled) => {
        if (!active) return;
        setIntroEnabled(enabled);
        if (!enabled) setIntroComplete(true);
      })
      .catch(() => {
        // Preserve the existing intro if settings cannot be reached.
        if (active) setIntroEnabled(true);
      });

    return () => {
      active = false;
    };
  }, []);

  function signIn() {
    haptic();
    router.push("/(auth)/login");
  }

  function getStarted() {
    haptic();
    setNameSheetVisible(true);
  }

  function continueWithFirstName() {
    const normalizedFirstName = firstName.trim();
    if (!normalizedFirstName) return;

    haptic();
    setNameSheetVisible(false);
    // Replace the welcome route with the next onboarding step so a previous
    // instance of the intro screen can never be resumed from the stack.
    router.replace({ pathname: "/onboarding/about-you", params: { firstName: normalizedFirstName } });
  }

  if (!introComplete && introEnabled === null) {
    return <View style={styles.root} />;
  }

  if (!introComplete && introEnabled) {
    return <OnboardingIntro onDone={() => setIntroComplete(true)} />;
  }

  return (
    <View style={[styles.root, { overflow: "hidden" }]}>
      {split ? <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "45%", backgroundColor: T.bg, padding: 48, justifyContent: "center", gap: 20 }}><Text accessibilityRole="header" style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 40, lineHeight: 48 }}>Your next story starts here.</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 17, lineHeight: 27, maxWidth: 400 }}>Find a quest for today. Make a plan with friends. Keep the memories along the way.</Text></View> : null}
      <StatusBar style="light" />
      <Animated.View style={[styles.artworkFade, { opacity: welcomeOpacity, left: split ? "45%" : 0, overflow: "hidden" }]}>
        <ImageBackground
          source={welcomeArtwork}
          resizeMode="cover"
          style={styles.artwork}
        />
      </Animated.View>
      <Animated.View style={[styles.actions, { opacity: welcomeOpacity, left: split ? "45%" : 0, paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding, paddingBottom: Math.max(insets.bottom + 2, 10) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Start my adventure" onPress={getStarted} style={({ pressed }) => [styles.getStartedAction, pressed && styles.actionPressed]}>
          <LinearGradient
            colors={["rgba(255,255,255,0.25)", "rgba(255,255,255,0.07)", "rgba(255,255,255,0)"]}
            locations={[0, 0.42, 0.72]}
            pointerEvents="none"
            style={styles.getStartedActionGloss}
          />
          <Text style={styles.getStartedActionText}>Start my Adventure</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={signIn} style={({ pressed }) => ({ alignSelf: "center", minHeight: 34, justifyContent: "center", opacity: pressed ? 0.65 : 1 })}><Text style={styles.authPrompt}>Already have an account? <Text style={styles.signInText}>Sign In</Text></Text></Pressable>
      </Animated.View>
      <Sheet
        visible={nameSheetVisible}
        onClose={() => setNameSheetVisible(false)}
        maxHeight="64%"
        expandOnKeyboard
      >
        <View style={styles.nameSheetContent}>
          <View>
            <Text style={styles.nameSheetTitle}>What should we call you?</Text>
          </View>
          <TextInput
            autoCapitalize="words"
            autoComplete="given-name"
            autoFocus
            onChangeText={setFirstName}
            onSubmitEditing={continueWithFirstName}
            placeholder="Your First name"
            placeholderTextColor={T.muted}
            returnKeyType="done"
            style={styles.nameInput}
            textContentType="givenName"
            value={firstName}
          />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !firstName.trim() }} disabled={!firstName.trim()} onPress={continueWithFirstName} style={({ pressed }) => [styles.nameContinueButton, !firstName.trim() && styles.nameContinueButtonDisabled, pressed && firstName.trim() ? styles.nameContinueButtonPressed : null]}><Text style={styles.nameContinueButtonText}>Continue</Text></Pressable>
        </View>
      </Sheet>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  artworkFade: {
    ...StyleSheet.absoluteFill,
  },
  artwork: {
    flex: 1,
  },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 12,
  },
  getStartedAction: {
    minHeight: 57,
    borderRadius: 19,
    backgroundColor: T.primaryButton,
    borderWidth: 1.25,
    borderColor: "rgba(255,255,255,0.4)",
    borderBottomWidth: 4,
    borderBottomColor: "#277dcc",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
    overflow: "hidden",
  },
  getStartedActionGloss: {
    ...StyleSheet.absoluteFill,
    borderRadius: 17,
  },
  getStartedActionText: {
    color: T.onAccent,
    fontFamily: "Rubik",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    marginTop: 7,
    backgroundColor: T.isDark ? "rgba(36,30,38,0.56)" : "rgba(255,255,255,0.42)",
  },
  authPrompt: {
    color: T.onAccent,
    fontFamily: "Rubik",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  signInText: {
    fontFamily: "RubikBold",
    fontWeight: "900",
  },
  nameSheetContent: {
    gap: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  nameSheetTitle: {
    color: T.dark,
    fontFamily: "RubikBlack",
    fontSize: 25,
    lineHeight: 31,
    textAlign: "center",
  },
  nameInput: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#4D9CFF",
    backgroundColor: "#EAF4FF",
    color: T.dark,
    fontFamily: "Rubik",
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 16,
  },
  nameContinueButton: {
    marginTop: 2,
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: T.primaryButton,
    borderBottomWidth: 6,
    borderBottomColor: T.primaryButtonEdge,
    alignItems: "center",
    justifyContent: "center",
  },
  nameContinueButtonDisabled: {
    backgroundColor: T.border,
    borderBottomColor: T.border,
  },
  nameContinueButtonPressed: {
    transform: [{ translateY: 3 }],
  },
  nameContinueButtonText: {
    color: T.onAccent,
    fontFamily: "RubikBold",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.55,
    textTransform: "uppercase",
  },
  actionPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
}));
