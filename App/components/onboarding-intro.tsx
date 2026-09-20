import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { playHaptic } from "@/motion/haptics";

const INTRO_FONT = "GeistPixel";
const INTRO_MESSAGES = [
  "Life wasn't meant to be watched...",
  "It was meant to be lived",
] as const;
const INTRO_START_DELAY_MS = 800;
const TYPE_DELAY_MS = 74;
const WORD_GAP_DELAY_MS = 135;
const WORD_BREAK_PATTERN = [true, false, true, false, false, true, false, true] as const;
const MESSAGE_FADE_OUT_DURATION_MS = 680;
const MESSAGE_FADE_IN_DURATION_MS = 280;
const MESSAGE_TRANSITION_PAUSE_MS = 160;
const FINAL_MESSAGE_FADE_OUT_DURATION_MS = 680;
const GREETING_HOLD_MS = 760;
const FINAL_GREETING_HOLD_MS = 1_000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function OnboardingIntro({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotionPreference();
  const mounted = useRef(true);
  const contentOpacity = useSharedValue(1);
  const [greetingText, setGreetingText] = useState("");
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.get() }));

  useEffect(() => {
    mounted.current = true;

    const fade = async (toValue: number, duration: number) => {
      if (reducedMotion) {
        contentOpacity.set(toValue);
        return;
      }
      contentOpacity.set(withTiming(toValue, { duration, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
      await wait(duration);
    };

    async function runIntro() {
      await wait(reducedMotion ? 0 : INTRO_START_DELAY_MS);

      let typedText = "";
      setGreetingText(typedText);

      for (const [messageIndex, message] of INTRO_MESSAGES.entries()) {
        // Each phrase gets its own moment: the prior message fully exits
        // before the next typewriter sequence begins.
        if (messageIndex > 0) {
          typedText = "";
          setGreetingText(typedText);
          await wait(reducedMotion ? 0 : MESSAGE_TRANSITION_PAUSE_MS);
          await fade(1, MESSAGE_FADE_IN_DURATION_MS);
          if (!mounted.current) return;
        }

        let wordBreakIndex = 0;
        for (let index = 1; index <= message.length; index += 1) {
          if (!mounted.current) return;

          const character = message[index - 1];
          typedText += character;
          setGreetingText(typedText);
          // Wait for React Native to paint the glyph before playing its tick.
          // Spaces have no visible glyph, so they simply create a short beat.
          if (!reducedMotion) {
            await waitForNextFrame();
            if (!mounted.current) return;
            if (character !== " ") playHaptic("selection");
          }
          const takesWordBreak = character === " " && WORD_BREAK_PATTERN[wordBreakIndex % WORD_BREAK_PATTERN.length];
          if (character === " ") wordBreakIndex += 1;
          await wait(reducedMotion ? 0 : takesWordBreak ? WORD_GAP_DELAY_MS : TYPE_DELAY_MS);
        }

        const isFinalMessage = messageIndex === INTRO_MESSAGES.length - 1;
        await wait(reducedMotion ? 0 : isFinalMessage ? FINAL_GREETING_HOLD_MS : GREETING_HOLD_MS);
        if (!mounted.current) return;

        if (!isFinalMessage) {
          await fade(0, MESSAGE_FADE_OUT_DURATION_MS);
          if (!mounted.current) return;
        }
      }

      await fade(0, FINAL_MESSAGE_FADE_OUT_DURATION_MS);

      await wait(reducedMotion ? 0 : 420);
      if (mounted.current) onDone();
    }

    runIntro();

    return () => {
      mounted.current = false;
    };
  }, [contentOpacity, onDone, reducedMotion]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.contentLayer,
          contentStyle,
          {
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
