export type EyeGravity = { x: number; y: number; z: number; interfaceOrientation: number };
export type EyeMotionState = {
  x: number;
  y: number;
  neutralX: number;
  neutralY: number;
  neutralZ: number;
  orientation: number;
  calibrated: boolean;
};

export const initialEyeMotion: EyeMotionState = {
  x: 0, y: 0, neutralX: 0, neutralY: 0, neutralZ: 0, orientation: 0, calibrated: false,
};

function tiltResponse(delta: number) {
  "worklet";
  // Ignore hand tremor, then ease continuously into the travel limit.
  const outsideRest = Math.max(0, Math.abs(delta) - 0.01);
  return Math.sign(delta) * Math.tanh(outsideRest * 12);
}

function angleDifference(angle: number, neutral: number) {
  "worklet";
  // Use the shortest turn when pitch crosses -π/π.
  return Math.atan2(Math.sin(angle - neutral), Math.cos(angle - neutral));
}

/** Offsets are in the face's 300-unit viewBox, independent of rendered size. */
export function advanceEyeMotion(previous: EyeMotionState, gravity: EyeGravity, elapsedMs: number): EyeMotionState {
  "worklet";
  const magnitude = Math.sqrt(gravity.x ** 2 + gravity.y ** 2 + gravity.z ** 2);
  const valid = Number.isFinite(magnitude) && magnitude > 0.5 && magnitude < 20
    && Number.isFinite(gravity.interfaceOrientation);
  const dt = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  let next = previous;
  let targetX = 0;
  let targetY = 0;
  if (valid) {
    const x = gravity.x / magnitude;
    const y = gravity.y / magnitude;
    const z = gravity.z / magnitude;
    // Recenter after activation, an interface rotation, or a suspended frame loop.
    // Gravity gives an absolute reference without accumulating gyro drift.
    if (!previous.calibrated || !Number.isFinite(previous.neutralZ) || previous.orientation !== gravity.interfaceOrientation || dt > 250) {
      next = { ...previous, neutralX: x, neutralY: y, neutralZ: z, orientation: gravity.interfaceOrientation, calibrated: true };
    } else {
      const roll = Math.atan2(x, Math.sqrt(y * y + z * z));
      const neutralRoll = Math.atan2(previous.neutralX, Math.sqrt(previous.neutralY ** 2 + previous.neutralZ ** 2));
      targetX = 8 * tiltResponse(angleDifference(roll, neutralRoll));
      // Pitch must include z: gravity.y barely changes for a small tilt from upright.
      // Near a completely sideways hold, pitch is undefined; gently return y to rest.
      if (y * y + z * z > 0.01 && previous.neutralY ** 2 + previous.neutralZ ** 2 > 0.01) {
        targetY = -5 * tiltResponse(angleDifference(Math.atan2(y, -z), Math.atan2(previous.neutralY, -previous.neutralZ)));
      }
    }
  }
  // A 90ms exponential response stays consistent at 60/120Hz and never overshoots.
  // Cap stalled frames so a delayed frame cannot produce a large visual jump.
  const blend = 1 - Math.exp(-Math.min(dt, 32) / 90);
  return { ...next, x: previous.x + (targetX - previous.x) * blend, y: previous.y + (targetY - previous.y) * blend };
}
