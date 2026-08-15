import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingIntro } from "@/components/onboarding-intro";
import { T } from "@/components/theme";
import { haptic, Sheet } from "@/components/ui";
import { getIntroEnabled } from "@/services/announcements/announcementService";

const welcomeArtwork = require("../assets/onboarding/screen-one.png");

export default function OnboardingWelcomeScreen() {
  const insets = useSafeAreaInsets();
  const [introComplete, setIntroComplete] = useState(false);
  const [introEnabled, setIntroEnabled] = useState<boolean | null>(null);
  const [firstName, setFirstName] = useState("");
  const [nameSheetVisible, setNameSheetVisible] = useState(false);
  const welcomeOpacity = useRef(new Animated.Value(0)).current;

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
    router.replace({ pathname: "/onboarding/understanding", params: { firstName: normalizedFirstName } });
  }

  if (!introComplete && introEnabled === null) {
    return <View style={styles.root} />;
  }

  if (!introComplete && introEnabled) {
    return <OnboardingIntro onDone={() => setIntroComplete(true)} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View style={[styles.artworkFade, { opacity: welcomeOpacity }]}>
        <ImageBackground
          source={welcomeArtwork}
          resizeMode="cover"
          style={styles.artwork}
        />
      </Animated.View>
      <Animated.View style={[styles.actions, { opacity: welcomeOpacity, paddingBottom: Math.max(insets.bottom + 2, 10) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Start my adventure" onPress={getStarted} style={({ pressed }) => [styles.getStartedAction, pressed && styles.actionPressed]}><Text style={styles.getStartedActionText}>Start my Adventure</Text></Pressable>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  artworkFade: {
    ...StyleSheet.absoluteFillObject,
  },
  artwork: {
    flex: 1,
  },
  actions: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 0,
    gap: 12,
  },
  getStartedAction: {
    minHeight: 57,
    borderRadius: 19,
    backgroundColor: T.blue,
    borderWidth: 1.25,
    borderColor: "rgba(255,255,255,0.4)",
    borderBottomWidth: 4,
    borderBottomColor: "#277dcc",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
  },
  getStartedActionText: {
    color: T.white,
    fontFamily: "Rubik",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    marginTop: 7,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  authPrompt: {
    color: T.white,
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
    backgroundColor: T.blue,
    borderBottomWidth: 6,
    borderBottomColor: "#258fd8",
    alignItems: "center",
    justifyContent: "center",
  },
  nameContinueButtonDisabled: {
    backgroundColor: T.border,
    borderBottomColor: "#d7cec2",
  },
  nameContinueButtonPressed: {
    transform: [{ translateY: 3 }],
  },
  nameContinueButtonText: {
    color: T.white,
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
});
