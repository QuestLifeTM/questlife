import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const INTRO_FONT = "GeistPixel";
const GREETING = "Hi There!!!";
const INTRO_START_DELAY_MS = 1_000;
const TYPE_DELAY_MS = 120;
const FADE_DURATION_MS = 2_200;
const GREETING_HOLD_MS = 800;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tapForCharacter(char: string) {
  if (process.env.EXPO_OS === "ios" && char.trim()) {
    Haptics.selectionAsync().catch(() => {});
  }
}

export function OnboardingIntro({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const mounted = useRef(true);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const [greetingText, setGreetingText] = useState("");

  useEffect(() => {
    mounted.current = true;

    async function runIntro() {
      await wait(INTRO_START_DELAY_MS);

      for (let index = 1; index <= GREETING.length; index += 1) {
        if (!mounted.current) return;

        const char = GREETING[index - 1];
        setGreetingText(GREETING.slice(0, index));
        tapForCharacter(char);
        await wait(TYPE_DELAY_MS);
      }

      await wait(GREETING_HOLD_MS);
      if (!mounted.current) return;

      await new Promise<void>((resolve) => {
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: FADE_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }).start(() => resolve());
      });

      await wait(600);
      if (mounted.current) onDone();
    }

    runIntro();

    return () => {
      mounted.current = false;
      contentOpacity.stopAnimation();
    };
  }, [contentOpacity, onDone]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.contentLayer,
          {
            opacity: contentOpacity,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24
          }
        ]}
      >
        <Text allowFontScaling style={styles.introText}>
          {greetingText}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 28
  },
  contentLayer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  introText: {
    width: "100%",
    maxWidth: 324,
    color: "#ffffff",
    fontFamily: INTRO_FONT,
    fontSize: 21,
    lineHeight: 31,
    textAlign: "center",
    letterSpacing: 0
  }
});
