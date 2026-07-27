import { Easing, ReduceMotion, type WithSpringConfig, type WithTimingConfig } from "react-native-reanimated";

export const motionDurations = {
  instant: 80,
  fast: 120,
  control: 180,
  state: 240,
  navigation: 300,
  expressive: 460,
  celebration: 700,
  celebrationMax: 900,
} as const;

export const motionDistance = {
  micro: 4,
  control: 8,
  state: 12,
  sheet: 16,
  navigation: 24,
  maximum: 32,
  reducedMaximum: 4,
} as const;

export const motionScale = {
  buttonPressed: 0.98,
  cardPressed: 0.985,
  iconPressed: 0.96,
  focalStart: 0.94,
  rewardMaximum: 1.02,
} as const;

export const motionStagger = {
  dense: 0,
  stats: 24,
  semantic: 40,
  celebration: 60,
  maximumTotal: 160,
} as const;

export const motionEasing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  enter: Easing.bezier(0.16, 1, 0.3, 1),
  exit: Easing.bezier(0.4, 0, 1, 1),
  linear: Easing.linear,
} as const;

export const motionSprings = {
  press: { stiffness: 500, damping: 40, mass: 0.7 },
  control: { stiffness: 360, damping: 32, mass: 0.85 },
  sheet: { stiffness: 280, damping: 30, mass: 1 },
  expressive: { stiffness: 250, damping: 24, mass: 0.9 },
} as const satisfies Record<string, WithSpringConfig>;

export function timingConfig(
  reducedMotion: boolean,
  duration: number = motionDurations.state,
  easing: WithTimingConfig["easing"] = motionEasing.standard,
): WithTimingConfig {
  return {
    duration: reducedMotion ? motionDurations.instant : duration,
    easing,
    reduceMotion: reducedMotion ? ReduceMotion.Always : ReduceMotion.System,
  };
}

export function springConfig(
  reducedMotion: boolean,
  config: WithSpringConfig = motionSprings.control,
): WithSpringConfig {
  return {
    ...config,
    overshootClamping: reducedMotion || config.overshootClamping,
    reduceMotion: reducedMotion ? ReduceMotion.Always : ReduceMotion.System,
  };
}
