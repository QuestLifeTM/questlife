import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IntroPhase = "blank" | "prelude" | "time" | "passed" | "cta" | "vision" | "prompt";

const INTRO_FONT = "GeistPixel";
const WORDS_PER_MINUTE = 200;
const AVERAGE_CHARS_PER_WORD = 5;
const TYPE_DELAY_MS = 60_000 / (WORDS_PER_MINUTE * AVERAGE_CHARS_PER_WORD);
const FADE_DURATION_MS = 700;
const TIME_PHRASES = ["A day ago...", "A week ago...", "A month ago...?"];
const VISION_LINES = [
  "With the people you love.",
  "In places you've never been.",
  "Doing things you'll never forget."
];
const PRELUDE_SCREENS = [
  {
    text: "Hi there!",
    holdMs: 800,
    pauseAfterMs: 0
  },
  {
    text: "Be honest with yourself",
    holdMs: 800,
    pauseAfterMs: 0
  },
  {
    text: "When was the last time you create a memory...",
    holdMs: 1000,
    pauseAfterMs: 0
  },
  {
    text: "you will never forget?",
    holdMs: 800,
    pauseAfterMs: 0
  }
];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function characterDelay(char: string) {
  if (!char) return 0;
  return TYPE_DELAY_MS;
}

function tapForCharacter(char: string) {
  if (process.env.EXPO_OS === "ios" && char.trim()) {
    Haptics.selectionAsync().catch(() => {});
  }
}

function animateOpacity(value: Animated.Value, toValue: number) {
  return new Promise<void>((resolve) => {
    Animated.timing(value, {
      toValue,
      duration: FADE_DURATION_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true
    }).start(() => resolve());
  });
}

export function OnboardingIntro({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const mounted = useRef(true);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const preludeOpacity = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<IntroPhase>("blank");
  const [preludeText, setPreludeText] = useState("");
  const [timeTexts, setTimeTexts] = useState(["", "", ""]);
  const [passedText, setPassedText] = useState("");
  const [ctaFirst, setCtaFirst] = useState("");
  const [ctaSecond, setCtaSecond] = useState("");
  const [visionTexts, setVisionTexts] = useState(["", "", ""]);
  const [visionFading, setVisionFading] = useState(false);
  const [promptText, setPromptText] = useState("");

  useEffect(() => {
    mounted.current = true;

    async function typeInto(text: string, update: (value: string) => void) {
      for (let index = 1; index <= text.length; index += 1) {
        if (!mounted.current) return;

        const char = text[index - 1];
        update(text.slice(0, index));
        tapForCharacter(char);
        await wait(characterDelay(char));
      }
    }

    async function typeTimeLine(lineIndex: number, text: string) {
      await typeInto(text, (value) => {
        setTimeTexts((current) => {
          const next = [...current];
          next[lineIndex] = value;
          return next;
        });
      });
    }

    function setTimeLine(lineIndex: number, text: string) {
      setTimeTexts((current) => {
        const next = [...current];
        next[lineIndex] = text;
        return next;
      });
    }

    async function typeVisionLine(lineIndex: number, text: string) {
      await typeInto(text, (value) => {
        setVisionTexts((current) => {
          const next = [...current];
          next[lineIndex] = value;
          return next;
        });
      });
    }

    async function fadeOutIntro() {
      await new Promise<void>((resolve) => {
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }).start(() => resolve());
      });
    }

    async function fadeCurrentScreenToBlank(gapMs = 0) {
      await animateOpacity(contentOpacity, 0);
      setPhase("blank");
      await wait(gapMs);
      contentOpacity.setValue(1);
    }

    async function showPreludeScreen(screen: (typeof PRELUDE_SCREENS)[number]) {
      if (!mounted.current) return;

      setPhase("prelude");
      setPreludeText("");
      preludeOpacity.setValue(1);
      await typeInto(screen.text, setPreludeText);
      await wait(screen.holdMs);

      if (!mounted.current) return;
      await animateOpacity(preludeOpacity, 0);
      setPreludeText("");
      setPhase("blank");
      await wait(screen.pauseAfterMs);
    }

    async function moveTo(nextPhase: IntroPhase, gapMs = 950) {
      if (!mounted.current) return;
      setPhase("blank");
      await wait(gapMs);
      if (!mounted.current) return;
      setPhase(nextPhase);
      await wait(360);
    }

    async function runIntro() {
      for (const screen of PRELUDE_SCREENS) {
        await showPreludeScreen(screen);
      }

      if (!mounted.current) return;
      await moveTo("time", 200);
      await typeTimeLine(0, TIME_PHRASES[0]);
      await wait(500);
      await typeTimeLine(1, TIME_PHRASES[1]);
      await wait(500);
      await typeTimeLine(2, "A month ago...");
      await wait(100);
      setTimeLine(2, TIME_PHRASES[2]);
      tapForCharacter("?");
      await wait(800);
      if (!mounted.current) return;
      await fadeCurrentScreenToBlank();

      if (!mounted.current) return;
      await moveTo("passed", 0);
      await typeInto("And before you know it...\nthat moment has passed.", setPassedText);
      await wait(800);
      if (!mounted.current) return;
      await fadeCurrentScreenToBlank();

      if (!mounted.current) return;
      await moveTo("cta", 800);
      await typeInto("You can't get those moments back.", setCtaFirst);
      await wait(800);
      await typeInto("But you can create new ones.", setCtaSecond);
      await wait(1500);

      if (!mounted.current) return;
      await moveTo("vision", 800);
      await typeVisionLine(0, VISION_LINES[0]);
      await wait(800);
      await typeVisionLine(1, VISION_LINES[1]);
      await wait(800);
      await typeVisionLine(2, VISION_LINES[2]);
      await wait(2200);
      if (!mounted.current) return;
      setVisionFading(true);
      await wait(820);

      if (!mounted.current) return;
      await moveTo("prompt", 800);
      await typeInto("But where do you start?", setPromptText);
      await wait(1000);
      await fadeOutIntro();
      await wait(600);

      if (mounted.current) {
        onDone();
      }
    }

    runIntro();

    return () => {
      mounted.current = false;
    };
  }, [contentOpacity, onDone, preludeOpacity]);

  return (
    <View
      accessible
      accessibilityLabel="QuestLife memory intro"
      style={styles.root}
    >
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
        <Stage phaseKey={phase}>
          {phase === "prelude" ? (
            <Animated.View style={[styles.stage, { opacity: preludeOpacity }]}>
              <IntroText text={preludeText} />
            </Animated.View>
          ) : null}

          {phase === "time" ? (
            <View style={styles.timeStack}>
              {TIME_PHRASES.map((phrase, index) => (
                <TimePhrase
                  key={phrase}
                  emphasized={index === 2 && timeTexts[index] === phrase}
                  text={timeTexts[index]}
                />
              ))}
            </View>
          ) : null}

          {phase === "passed" ? <IntroText text={passedText} /> : null}

          {phase === "cta" ? (
            <View style={styles.stack}>
              <IntroText text={ctaFirst} weight="bold" />
              <IntroText text={ctaSecond} size="regular" />
            </View>
          ) : null}

          {phase === "vision" ? (
            <VisionStack fading={visionFading} lines={visionTexts} />
          ) : null}

          {phase === "prompt" ? <IntroText text={promptText} /> : null}
        </Stage>
      </Animated.View>
    </View>
  );
}

function Stage({ children, phaseKey }: { children: React.ReactNode; phaseKey: IntroPhase }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    opacity.setValue(0);
    y.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();
  }, [opacity, phaseKey, y]);

  return (
    <Animated.View style={[styles.stage, { opacity, transform: [{ translateY: y }] }]}>
      {children}
    </Animated.View>
  );
}

function IntroText({
  text,
  size = "large",
  weight = "regular"
}: {
  text: string;
  size?: "large" | "regular";
  weight?: "bold" | "regular";
}) {
  return (
    <Text
      allowFontScaling
      style={[
        styles.introText,
        size === "regular" && styles.regularText,
        weight === "bold" && styles.boldText
      ]}
    >
      {text}
    </Text>
  );
}

function TimePhrase({ emphasized, text }: { emphasized: boolean; text: string }) {
  return (
    <View style={styles.timePhrase}>
      <Text style={[styles.timeText, emphasized && styles.emphasizedTimeText]}>
        {text}
      </Text>
    </View>
  );
}

function VisionStack({ fading, lines }: { fading: boolean; lines: string[] }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!fading) return;

    Animated.timing(opacity, {
      toValue: 0,
      duration: 620,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true
    }).start();
  }, [fading, opacity]);

  return (
    <Animated.View style={[styles.stack, { opacity }]}>
      {lines.map((line, index) => (
        <IntroText key={VISION_LINES[index]} text={line} size="regular" />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 28
  },
  contentLayer: {
    flex: 1
  },
  stage: {
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
  },
  regularText: {
    fontSize: 21,
    lineHeight: 31
  },
  boldText: {
    fontSize: 21,
    lineHeight: 31
  },
  stack: {
    width: "100%",
    alignItems: "center",
    gap: 14
  },
  timeStack: {
    width: "100%",
    alignItems: "center",
    gap: 14
  },
  timePhrase: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center"
  },
  timeText: {
    color: "#ffffff",
    fontFamily: INTRO_FONT,
    fontSize: 21,
    lineHeight: 31,
    textAlign: "center",
    letterSpacing: 0
  },
  emphasizedTimeText: {
    fontSize: 21,
    lineHeight: 31
  }
});
