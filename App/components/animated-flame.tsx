import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { QuestlifeFlame } from "@/components/questlife-flame";

/**
 * The QuestLife streak flame. The artwork stays unchanged; animation only
 * moves the complete mark as one piece.
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

  useEffect(() => {
    if (!animated) return;

    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    bobLoop.start();
    return () => {
      bobLoop.stop();
    };
  }, [animated, bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.045] });
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ opacity: dimmed ? 0.45 : 1, transform: [{ translateY: animated ? translateY : 0 }] }}>
        <QuestlifeFlame size={size} />
      </Animated.View>
    </View>
  );
}
