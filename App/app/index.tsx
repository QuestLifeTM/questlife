import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ImageBackground,
  Pressable,
  StyleSheet,
  View
} from "react-native";

import { OnboardingIntro } from "@/components/onboarding-intro";
import { haptic } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getIntroEnabled } from "@/services/announcements/announcementService";

const welcomeArtwork = require("../assets/onboarding/screen-one.png");

export default function OnboardingWelcomeScreen() {
  const { isEmailVerified, session, user } = useAuth();
  const [introComplete, setIntroComplete] = useState(false);
  const [introEnabled, setIntroEnabled] = useState<boolean | null>(null);
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

  function continueToApp() {
    haptic();

    if (!session) {
      router.replace("/(auth)/auth-options");
      return;
    }

    if (!isEmailVerified) {
      router.replace({
        pathname: "/(auth)/verify-email",
        params: { email: user?.email ?? "" },
      });
      return;
    }

    router.replace("/(tabs)");
  }

  if (!introComplete && introEnabled === null) {
    return <View style={styles.root} />;
  }

  if (!introComplete && introEnabled) {
    return <OnboardingIntro onDone={() => setIntroComplete(true)} />;
  }

  return (
    <Pressable
      accessibilityHint="Continues to sign in or the app home screen."
      accessibilityLabel="Welcome to QuestLife. Thousands of Memories Awaiting to be Made. Tap to Continue."
      accessibilityRole="button"
      onPress={continueToApp}
      style={styles.root}
    >
      <StatusBar style="light" />
      <Animated.View style={[styles.artworkFade, { opacity: welcomeOpacity }]}>
        <ImageBackground
          source={welcomeArtwork}
          resizeMode="cover"
          style={styles.artwork}
        />
      </Animated.View>
    </Pressable>
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
});
