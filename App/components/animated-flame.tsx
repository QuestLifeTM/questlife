import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { T } from "@/components/theme";

/**
 * The QuestLife streak flame: a yellow rotated-square ember behind a gradient
 * flame with a white core. `animated` adds a gentle bob + flicker loop so the
 * flame feels alive without being distracting. `dimmed` renders the grey
 * "streak at zero" variant.
 */
export function AnimatedFlame({
  size = 86,
  animated = true,
  dimmed = false,
}: {
  size?: number;
  animated?: boolean;
  dimmed?: boolean;
}) {
  const bob = useRef(new Animated.Value(0)).current;
  const flicker = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;

    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const flickerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.35, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.8, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0, duration: 340, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );

    bobLoop.start();
    flickerLoop.start();
    return () => {
      bobLoop.stop();
      flickerLoop.stop();
    };
  }, [animated, bob, flicker]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.045] });
  const flameScale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const emberRotate = flicker.interpolate({ inputRange: [0, 1], outputRange: ["45deg", "50deg"] });
  const coreScale = flicker.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.1] });

  const emberColor = dimmed ? "#e8e2da" : T.yellow;
  const gradientColors: readonly [string, string, string] = dimmed
    ? ["#c9c2bd", "#bdb5b0", "#b1a9a4"]
    : ["#ff4e74", "#ff7448", "#ff9d00"];

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: size * 0.22,
          backgroundColor: emberColor,
          bottom: size * 0.08,
          transform: [{ rotate: animated ? emberRotate : "45deg" }],
        }}
      />
      <Animated.View style={{ transform: [{ translateY: animated ? translateY : 0 }, { scale: animated ? flameScale : 1 }] }}>
        <LinearGradient
          colors={gradientColors}
          style={{
            width: size * 0.56,
            height: size * 0.64,
            borderRadius: size * 0.28,
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: size * 0.14,
            boxShadow: dimmed ? "none" : "0px 10px 0px rgba(254,228,64,0.3)",
          }}
        >
          <Animated.View
            style={{
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              backgroundColor: T.white,
              transform: [{ scale: animated ? coreScale : 1 }],
            }}
          />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}
