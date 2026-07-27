import {
  motionDistance,
  motionDurations,
  motionEasing,
  motionScale,
  motionSprings,
  motionStagger,
  springConfig,
  timingConfig,
} from "@/motion/tokens";

/**
 * Compatibility surface for existing callers. New code imports the modular
 * tokens and primitives from `@/motion/*`.
 */
export const motion = {
  durations: motionDurations,
  easing: motionEasing,
  springs: motionSprings,
  scale: motionScale,
  distance: motionDistance,
  stagger: motionStagger,
  fadeDuration: motionDurations.control,
  enterDuration: motionDurations.state,
  pressScale: motionScale.buttonPressed,
  pressSpring: motionSprings.press,
  settleSpring: motionSprings.control,
} as const;

export function easeOutTiming(reducedMotion: boolean, duration: number = motionDurations.control) {
  return timingConfig(reducedMotion, duration, motionEasing.enter);
}

export { springConfig };
