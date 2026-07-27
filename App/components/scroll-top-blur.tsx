import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * A scroll-linked veil for full-page content. The blur is intentionally light
 * and uses a mask so it dissolves into the page instead of ending in a line.
 */
export function useTopScrollBlur() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = Math.max(0, event.contentOffset.y);
    },
  });

  return { onScroll, scrollY };
}

export function ScrollTopBlur({ scrollY }: { scrollY: SharedValue<number> }) {
  const insets = useSafeAreaInsets();
  const animatedStyle = useAnimatedStyle(() => ({
    // The effect begins as soon as content moves and reaches its calm resting
    // strength within a short scroll, rather than popping into view.
    opacity: interpolate(scrollY.value, [0, 6, 30], [0, 0.52, 1], Extrapolation.CLAMP),
  }));
  const height = insets.top + 58;

  return (
    <Animated.View pointerEvents="none" style={[styles.container, { height }, animatedStyle]}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <LinearGradient
            colors={["rgba(0,0,0,1)", "rgba(0,0,0,0.72)", "rgba(0,0,0,0)"]}
            locations={[0, 0.38, 1]}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        <BlurView tint="light" intensity={18} style={StyleSheet.absoluteFill} />
      </MaskedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
});
