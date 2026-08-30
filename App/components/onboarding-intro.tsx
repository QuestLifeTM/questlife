import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const INTRO_FONT = "GeistPixel";
const INTRO_MESSAGES = [
  "Life wasn't meant to be watched..",
  "It was meant to be lived.",
] as const;
const INTRO_START_DELAY_MS = 1_000;
const TYPE_DELAY_MS = 120;
const DOT_TYPE_DELAY_MS = 500;
const MESSAGE_FADE_OUT_DURATION_MS = 2_200;
const MESSAGE_FADE_IN_DURATION_MS = 1_000;
const MESSAGE_TRANSITION_PAUSE_MS = 80;
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

function animateOpacity(
  opacity: Animated.Value,
  toValue: number,
  duration: number,
  easing: (value: number) => number
) {
  return new Promise<void>((resolve) => {
    Animated.timing(opacity, {
      toValue,
      duration,
      easing,
      useNativeDriver: true
    }).start(() => resolve());
  });
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

      for (const [messageIndex, message] of INTRO_MESSAGES.entries()) {
        // The first line starts visible. Later lines begin at zero opacity and
        // type while the text layer naturally fades back in.
        if (messageIndex === 0) setGreetingText("");

        for (let index = 1; index <= message.length; index += 1) {
          if (!mounted.current) return;

          const char = message[index - 1];
          setGreetingText(message.slice(0, index));
          tapForCharacter(char);
          const isTrailingDot = messageIndex === 0 && char === "." && index > message.length - 2;
          await wait(isTrailingDot ? DOT_TYPE_DELAY_MS : TYPE_DELAY_MS);
        }

        await wait(GREETING_HOLD_MS);
        if (!mounted.current) return;

        if (messageIndex < INTRO_MESSAGES.length - 1) {
          await animateOpacity(
            contentOpacity,
            0,
            MESSAGE_FADE_OUT_DURATION_MS,
            Easing.in(Easing.cubic)
          );

          if (!mounted.current) return;
          await wait(MESSAGE_TRANSITION_PAUSE_MS);
          if (!mounted.current) return;
          setGreetingText("");
          void animateOpacity(
            contentOpacity,
            1,
            MESSAGE_FADE_IN_DURATION_MS,
            Easing.out(Easing.cubic)
          );
        }
      }

      await animateOpacity(contentOpacity, 0, FADE_DURATION_MS, Easing.in(Easing.cubic));

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
