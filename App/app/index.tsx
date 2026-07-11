import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingIntro } from "@/components/onboarding-intro";
import { haptic } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";

const welcomeArtwork = require("../assets/onboarding/screen-one.png");
const chooseYourselfArtwork = require("../assets/onboarding/choose-yourself-girl-cropped.png");
const QUEST_BLUE = "#4DA8FF";
const QUEST_BLUE_SHADOW = "#2588D8";

export default function OnboardingWelcomeScreen() {
  const { isEmailVerified, session, user } = useAuth();
  const [introComplete, setIntroComplete] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState<"welcome" | "choose">("welcome");
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const chooseOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!introComplete || welcomeStep !== "welcome") return;

    welcomeOpacity.setValue(0);
    Animated.timing(welcomeOpacity, {
      toValue: 1,
      duration: 1100,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [introComplete, welcomeOpacity, welcomeStep]);

  useEffect(() => {
    if (welcomeStep !== "choose") return;

    chooseOpacity.setValue(0);
    Animated.timing(chooseOpacity, {
      toValue: 1,
      duration: 780,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [chooseOpacity, welcomeStep]);

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

  function openChooseScreen() {
    haptic();
    setWelcomeStep("choose");
  }

  if (!introComplete) {
    return <OnboardingIntro onDone={() => setIntroComplete(true)} />;
  }

  if (welcomeStep === "choose") {
    return (
      <QuestLifeChoiceScreen
        onContinue={continueToApp}
        opacity={chooseOpacity}
      />
    );
  }

  return (
    <Pressable
      accessibilityHint="Continues to the first QuestLife onboarding screen."
      accessibilityLabel="Welcome to QuestLife. Thousands of Memories Awaiting to be Made. Tap to Continue."
      accessibilityRole="button"
      onPress={openChooseScreen}
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

function QuestLifeChoiceScreen({
  onContinue,
  opacity
}: {
  onContinue: () => void;
  opacity: Animated.Value;
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const activeIndicatorFillWidth = Math.max(24, width * 0.066);
  const activeIndicatorFillHeight = Math.max(5, width * 0.015);
  const indicatorBorderWidth = Math.max(3, width * 0.008);
  const dotSize = Math.max(9, width * 0.026);
  const buttonSize = Math.max(48, width * 0.128);
  const buttonBaseOffsetX = buttonSize * 0.07;
  const buttonBaseOffsetY = buttonSize * 0.11;
  const headlineSize = Math.max(25, width * 0.072);

  return (
    <View style={styles.choiceRoot}>
      <StatusBar style="dark" />
      <Animated.View style={[styles.choiceScreen, { opacity }]}>
        <View
          accessibilityLabel="Onboarding screen 1 of 4"
          style={[
            styles.progressRow,
            {
              gap: width * 0.022,
              top: Math.max(insets.top + 24, height * 0.102)
            }
          ]}
        >
          <View
            style={[
              styles.activeIndicatorShell,
              {
                borderRadius: (activeIndicatorFillHeight + indicatorBorderWidth * 2) / 2,
                height: activeIndicatorFillHeight + indicatorBorderWidth * 2,
                width: activeIndicatorFillWidth + indicatorBorderWidth * 2
              }
            ]}
          >
            <View
              style={[
                styles.activeIndicatorFill,
                {
                  borderRadius: activeIndicatorFillHeight / 2,
                  height: activeIndicatorFillHeight,
                  width: activeIndicatorFillWidth
                }
              ]}
            />
          </View>
          <View style={[styles.inactiveIndicator, { borderRadius: dotSize / 2, height: dotSize, width: dotSize }]} />
          <View style={[styles.inactiveIndicator, { borderRadius: dotSize / 2, height: dotSize, width: dotSize }]} />
          <View style={[styles.inactiveIndicator, { borderRadius: dotSize / 2, height: dotSize, width: dotSize }]} />
        </View>

        <Text
          style={[
            styles.choiceHeadline,
            {
              fontSize: headlineSize,
              left: width * 0.073,
              lineHeight: headlineSize * 1.12,
              right: width * 0.06,
              top: height * 0.184
            }
          ]}
        >
          <Text style={styles.choiceBrand}>QuestLife</Text>
          {" helps you\nchoose yourself first daily"}
        </Text>

        <Image
          accessibilityIgnoresInvertColors
          source={chooseYourselfArtwork}
          resizeMode="contain"
          style={[
            styles.choiceArtwork,
            {
              height: height * 0.52,
              left: width * 0.055,
              top: height * 0.305,
              width: width * 0.89
            }
          ]}
        />

        <Pressable
          accessibilityHint="Continues to sign in or the app home screen."
          accessibilityLabel="Continue"
          accessibilityRole="button"
          onPress={onContinue}
          style={({ pressed }) => [
            styles.nextButton,
            {
              bottom: Math.max(insets.bottom + 28, height * 0.045),
              height: buttonSize + buttonBaseOffsetY,
              right: width * 0.075,
              width: buttonSize + buttonBaseOffsetX
            }
          ]}
        >
          {({ pressed }) => (
            <>
              <View
                style={[
                  styles.nextButtonBase,
                  {
                    borderRadius: buttonSize / 2,
                    height: buttonSize,
                    left: buttonBaseOffsetX,
                    top: buttonBaseOffsetY,
                    width: buttonSize
                  }
                ]}
              />
              <View
                style={[
                  styles.nextButtonFace,
                  {
                    borderRadius: buttonSize / 2,
                    height: buttonSize,
                    transform: [
                      { translateX: pressed ? buttonBaseOffsetX * 0.35 : 0 },
                      { translateY: pressed ? buttonBaseOffsetY * 0.55 : 0 }
                    ],
                    width: buttonSize
                  }
                ]}
              >
                <Ionicons color="#ffffff" name="arrow-forward" size={buttonSize * 0.36} />
              </View>
            </>
          )}
        </Pressable>
      </Animated.View>
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
  choiceRoot: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  choiceScreen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  progressRow: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  activeIndicatorShell: {
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  activeIndicatorFill: {
    backgroundColor: QUEST_BLUE,
  },
  inactiveIndicator: {
    backgroundColor: "#dddddd",
  },
  choiceHeadline: {
    position: "absolute",
    zIndex: 2,
    color: "#050505",
    fontFamily: "RubikBlack",
    letterSpacing: 0,
  },
  choiceBrand: {
    color: QUEST_BLUE,
  },
  choiceArtwork: {
    position: "absolute",
    zIndex: 1,
  },
  nextButton: {
    position: "absolute",
    zIndex: 3,
  },
  nextButtonBase: {
    position: "absolute",
    backgroundColor: QUEST_BLUE_SHADOW,
  },
  nextButtonFace: {
    position: "absolute",
    left: 0,
    top: 0,
    backgroundColor: QUEST_BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
});
