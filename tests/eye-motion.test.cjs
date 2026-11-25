const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('App/lib/eye-motion.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
new Function('module', 'exports', code)(mod, mod.exports);
const { advanceEyeMotion, initialEyeMotion } = mod.exports;
const gravity = (x = 0, y = -0.7, orientation = 0) => ({ x, y, z: -Math.sqrt(Math.max(0, 1 - x * x - y * y)), interfaceOrientation: orientation });
const step = (state, sample, frames = 1, dt = 1000 / 60) => {
  for (let i = 0; i < frames; i++) state = advanceEyeMotion(state, sample, dt);
  return state;
};
const centered = () => step(initialEyeMotion, gravity());

test('calibrates to the holding angle and remains still at rest, including hand tremor', () => {
  for (const sample of [gravity(), gravity(0.4, -0.5), gravity(0, -1), gravity(0, 0)]) {
    const rest = step(initialEyeMotion, sample, 120);
    assert.equal(rest.x, 0);
    assert.equal(rest.y, 0);
  }
  const jitter = step(centered(), gravity(0.005, -0.695), 120);
  assert.equal(jitter.x, 0);
  assert.equal(jitter.y, 0);
});

test('follows tilt in both axes, reverses smoothly, and returns to center without overshoot', () => {
  const sample = gravity(0.3, -0.4);
  const first = step(centered(), sample);
  const held = step(first, sample, 120);
  assert.ok(first.x > 0 && first.x < held.x);
  assert.ok(first.y < 0 && first.y > held.y);
  const reversed = step(held, gravity(-0.3, -0.9));
  assert.ok(reversed.x > 0 && reversed.x < held.x);
  const otherSide = step(reversed, gravity(-0.3, -0.9), 120);
  assert.ok(otherSide.x < 0 && otherSide.y > 0);
  let returned = held;
  for (let i = 0; i < 180; i++) {
    const next = step(returned, gravity());
    assert.ok(next.x >= 0 && next.x <= returned.x);
    assert.ok(next.y <= 0 && next.y >= returned.y);
    returned = next;
  }
  assert.ok(Math.abs(returned.x) < 0.00001 && Math.abs(returned.y) < 0.00001);
});

test('has the same response over elapsed time at 30, 60, and 120Hz', () => {
  const sample = gravity(0.35, -0.3);
  const sixty = step(centered(), sample, 30);
  const oneTwenty = step(centered(), sample, 60, 1000 / 120);
  assert.ok(Math.abs(sixty.x - oneTwenty.x) < 1e-10);
  assert.ok(Math.abs(sixty.y - oneTwenty.y) < 1e-10);
  const thirty = step(centered(), sample, 15, 1000 / 30);
  assert.ok(Math.abs(sixty.x - thirty.x) < 0.01);
});

test('normalizes sensor units and keeps extreme tilts inside the artwork bounds', () => {
  const sample = gravity(0.5, -0.3);
  const scaled = { ...sample, x: sample.x * 9.81, y: sample.y * 9.81, z: sample.z * 9.81 };
  const normal = step(centered(), sample, 60);
  const inMeters = step(centered(), scaled, 60);
  assert.ok(Math.abs(normal.x - inMeters.x) < 1e-10);
  assert.ok(Math.abs(normal.y - inMeters.y) < 1e-10);
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
    const result = step(centered(), gravity(x, y), 120);
    assert.ok(Math.abs(result.x) <= 8 && Math.abs(result.y) <= 5);
  }
});

test('missing, unavailable, and malformed sensor data never corrupts the gaze', () => {
  const moving = step(centered(), gravity(0.4, -0.4), 20);
  for (const sample of [
    { x: 0, y: 0, z: 0, interfaceOrientation: 0 },
    { x: NaN, y: 0, z: 1, interfaceOrientation: 0 },
    { x: Infinity, y: 0, z: 1, interfaceOrientation: 0 },
    { x: 1e10, y: 1e10, z: 1e10, interfaceOrientation: 0 },
    { ...gravity(), interfaceOrientation: NaN },
  ]) {
    assert.deepEqual(step(initialEyeMotion, sample), initialEyeMotion);
    const rest = step(moving, sample, 180);
    assert.ok(Number.isFinite(rest.x) && Number.isFinite(rest.y));
    assert.ok(Math.abs(rest.x) < 0.00001 && Math.abs(rest.y) < 0.00001);
  }
});

test('rotation and long interruptions recalibrate without snapping or using a stale holding angle', () => {
  const moving = step(centered(), gravity(0.4, -0.4), 30);
  for (const [sample, dt] of [[gravity(-0.5, 0, 90), 16], [gravity(-0.5, 0), 2000]]) {
    const resumed = step(moving, sample, 1, dt);
    assert.ok(resumed.x > 0 && resumed.x < moving.x);
    assert.ok(resumed.neutralX < 0);
    const rest = step(resumed, sample, 180);
    assert.ok(Math.abs(rest.x) < 0.00001 && Math.abs(rest.y) < 0.00001);
  }
});

test('invalid frame times hold position rather than jumping or producing NaN', () => {
  const moving = step(centered(), gravity(0.4, -0.4), 20);
  for (const elapsed of [0, -20, NaN, Infinity]) {
    const next = step(moving, gravity(-0.4, -0.4), 1, elapsed);
    assert.equal(next.x, moving.x);
    assert.equal(next.y, moving.y);
  }
});

test('a five-degree tilt produces visible but bounded movement, including from an upright hold', () => {
  const angle = 5 * Math.PI / 180;
  const upright = step(initialEyeMotion, { x: 0, y: -1, z: 0, interfaceOrientation: 0 });
  const pitched = step(upright, { x: 0, y: -Math.cos(angle), z: -Math.sin(angle), interfaceOrientation: 0 }, 60);
  assert.ok(pitched.y < -3.5 && pitched.y >= -5);
  const rolled = step(upright, { x: Math.sin(angle), y: -Math.cos(angle), z: 0, interfaceOrientation: 0 }, 60);
  assert.ok(rolled.x > 5.5 && rolled.x <= 8);
});

test('pitch crossing the angle seam does not send the eyes to the opposite limit', () => {
  const rest = step(initialEyeMotion, { x: 0, y: 0.001, z: 1, interfaceOrientation: 0 });
  const crossed = step(rest, { x: 0, y: -0.001, z: 1, interfaceOrientation: 0 }, 60);
  assert.equal(crossed.y, 0);
  const sideways = step(centered(), { x: 1, y: 0, z: 0, interfaceOrientation: 0 }, 60);
  assert.ok(Number.isFinite(sideways.x) && Number.isFinite(sideways.y));
  assert.equal(sideways.y, 0);
});
