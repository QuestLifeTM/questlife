import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, Platform } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

const DIRECTION_THRESHOLD = 18;
const TOP_REVEAL_OFFSET = 8;
const HEADER_DURATION = 180;

export function useCollapsibleScrollHeader() {
  const progress = useSharedValue(0);
  const lastOffset = useRef(0);
  const directionDistance = useRef(0);
  const direction = useRef<-1 | 0 | 1>(0);
  const hiddenRef = useRef(false);
  const reduceMotion = useReducedMotionPreference();

  const setHidden = useCallback((hidden: boolean) => {
    if (Platform.OS === "web") return;
    if (hidden === hiddenRef.current) return;
    hiddenRef.current = hidden;
    progress.set(withTiming(hidden ? 1 : 0, {
      duration: reduceMotion ? 0 : HEADER_DURATION,
      easing: Easing.bezier(0.23, 1, 0.32, 1)
    }));
  }, [progress, reduceMotion]);

  const onScroll = useCallback((offsetY: number) => {
    if (Platform.OS === "web") return;

    const nextOffset = Math.max(0, offsetY);
    const delta = nextOffset - lastOffset.current;
    lastOffset.current = nextOffset;

    if (nextOffset <= TOP_REVEAL_OFFSET) {
      direction.current = 0;
      directionDistance.current = 0;
      setHidden(false);
      return;
    }

    if (Math.abs(delta) < 1) return;
    const nextDirection: -1 | 1 = delta > 0 ? 1 : -1;
    if (direction.current !== nextDirection) {
      direction.current = nextDirection;
      directionDistance.current = 0;
    }
    directionDistance.current += Math.abs(delta);

    if (directionDistance.current < DIRECTION_THRESHOLD) return;
    directionDistance.current = 0;
    setHidden(nextDirection > 0);
  }, [setHidden]);

  const reveal = useCallback(() => {
    lastOffset.current = 0;
    direction.current = 0;
    directionDistance.current = 0;
    setHidden(false);
  }, [setHidden]);

  return { onScroll, progress, reveal };
}

export function CollapsibleScrollHeader({
  children,
  progress
}: PropsWithChildren<{ progress: ReturnType<typeof useSharedValue<number>> }>) {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === "web") progress.set(0);
  }, [progress]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight > 0) setHeight((current) => Math.abs(current - nextHeight) >= 1 ? nextHeight : current);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    if (Platform.OS === "web" || height === 0) return {};
    const value = progress.get();
    return {
      height: interpolate(value, [0, 1], [height, 0]),
      opacity: interpolate(value, [0, 0.72, 1], [1, 0.35, 0]),
      transform: [{ translateY: interpolate(value, [0, 1], [0, -12]) }]
    };
  }, [height]);

  return (
    <Animated.View style={[{ overflow: "hidden" }, animatedStyle]}>
      <Animated.View onLayout={onLayout}>{children}</Animated.View>
    </Animated.View>
  );
}
