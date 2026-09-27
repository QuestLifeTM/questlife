import {
  motionDistance,
  motionDurations,
  motionEasing,
  motionScale,
  motionSprings,
  motionStagger,
  springConfig,
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

export { springConfig };
