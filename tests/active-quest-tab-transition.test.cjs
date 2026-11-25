const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function harness(reduced = false, initialTab = 'entry') {
  const slots = [], pendingEffects = [], queued = [], animations = [];
  let cursor = 0, dirty = false, mounted = true, result;
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) {
        slots[i] = { value: initial };
        slots[i].set = value => {
          assert.ok(mounted, 'No state updates after unmount');
          const next = typeof value === 'function' ? value(slots[i].value) : value;
          if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; }
        };
      }
      return [slots[i].value, slots[i].set];
    },
    useRef(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { current: initial };
      return slots[i];
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !equal(slots[i].deps, deps)) {
        const cleanup = slots[i]?.cleanup;
        slots[i] = { deps };
        pendingEffects.push(() => { cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  function cancel(shared) {
    const previous = shared.animation;
    shared.animation = null;
    previous?.done?.(false);
  }
  const reanimated = {
    Easing: { bezier: (...points) => points },
    cancelAnimation: cancel,
    useAnimatedStyle: fn => fn(),
    useSharedValue(initial) {
      const ref = react.useRef(null);
      if (!ref.current) ref.current = {
        value: initial, animation: null,
        get() { return this.value; },
        set(next) {
          cancel(this);
          if (typeof next === 'object') { this.animation = next; animations.push(next); }
          else this.value = next;
        },
      };
      return ref.current;
    },
    withTiming: (to, config, done) => ({ to, config, done }),
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('App/hooks/useActiveQuestTabTransition.ios.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'react') return react;
    if (id === 'react-native-reanimated') return reanimated;
    if (id === 'react-native-worklets') return { scheduleOnRN: (fn, ...args) => queued.push(() => fn(...args)) };
    if (id === './useReducedMotionPreference') return { useReducedMotionPreference: () => reduced };
    throw new Error(`Unexpected dependency: ${id}`);
  }, module, module.exports);
  const api = {
    animations,
    get result() { return result; },
    value(tab) { return result.progress[tab]; },
    flush() {
      let renders = 0;
      do {
        assert.ok(++renders < 20, 'Transition must not cause a render loop');
        cursor = 0; dirty = false;
        result = module.exports.useActiveQuestTabTransition(initialTab);
        while (pendingEffects.length) pendingEffects.shift()();
      } while (dirty);
    },
    ready(tab = result.tab, request = result.request) { result.onSceneReady(tab, request); },
    finishAll() {
      for (const name of ['map', 'entry', 'album']) {
        const shared = result.progress[name];
        const animation = shared.animation;
        if (!animation) continue;
        shared.animation = null;
        shared.value = animation.to;
        animation.done?.(true);
      }
    },
    flushRN() { while (queued.length) queued.shift()(); },
    setReduced(value) { reduced = value; api.flush(); },
    unmount() { mounted = false; slots.forEach(slot => slot.cleanup?.()); },
  };
  api.flush();
  return api;
}

function arrive(h) {
  h.ready(); h.finishAll(); h.flushRN(); h.flush();
}

test('initial opening is static for every active quest tab', () => {
  for (const tab of ['map', 'entry', 'album']) {
    const h = harness(false, tab);
    assert.equal(h.result.tab, tab);
    assert.deepEqual(h.result.mountedTabs, [tab]);
    for (const name of ['map', 'entry', 'album']) assert.equal(h.value(name).value, name === tab ? 1 : 0);
    assert.equal(h.animations.length, 0);
    h.unmount();
  }
});

test('incoming content mounts while outgoing content stays visible; animation waits for readiness', () => {
  const h = harness(); h.result.selectTab('album'); h.flush();
  assert.equal(h.result.tab, 'album'); assert.deepEqual(h.result.mountedTabs, ['entry', 'album']);
  assert.equal(h.value('entry').value, 1); assert.equal(h.value('album').value, 0);
  assert.equal(h.animations.length, 0);
  h.ready();
  assert.equal(h.value('entry').animation.to, 0); assert.equal(h.value('album').animation.to, 1);
  assert.equal(h.value('entry').animation.config.duration, 240);
  assert.deepEqual(h.value('entry').animation.config, h.value('album').animation.config);
  h.value('entry').value = 0.5; h.value('album').value = 0.5;
  assert.ok(h.value('entry').value > 0 && h.value('album').value > 0, 'Pages overlap instead of swapping at a blank frame');
  h.finishAll(); h.flushRN(); h.flush();
  assert.deepEqual(h.result.mountedTabs, ['album']); assert.equal(h.value('album').value, 1);
});

test('stale, duplicate, and outgoing layout events cannot start a transition', () => {
  const h = harness(); h.result.selectTab('map'); h.flush();
  h.ready('entry'); h.ready('map', h.result.request - 1);
  assert.equal(h.animations.length, 0);
  h.ready(); const count = h.animations.length; h.ready();
  assert.equal(h.animations.length, count);
});

test('same-tab taps never replay the transition', () => {
  const h = harness(); h.result.selectTab('entry'); h.flush(); assert.equal(h.animations.length, 0);
  h.result.selectTab('map'); h.flush(); arrive(h);
  const count = h.animations.length, request = h.result.request;
  h.result.selectTab('map'); h.flush();
  assert.equal(h.animations.length, count); assert.equal(h.result.request, request);
});

test('rapid taps retain partially visible scenes without resetting their opacity', () => {
  const h = harness(); h.result.selectTab('map'); h.flush(); h.ready();
  h.value('entry').value = 0.6; h.value('map').value = 0.4;
  h.result.selectTab('album'); h.flush();
  assert.deepEqual(h.result.mountedTabs, ['entry', 'map', 'album']);
  assert.equal(h.value('entry').value, 0.6); assert.equal(h.value('map').value, 0.4);
  assert.equal(h.value('album').value, 0);
  arrive(h);
  assert.equal(h.result.tab, 'album'); assert.deepEqual(h.result.mountedTabs, ['album']);
});

test('reversing direction reuses the outgoing page and its current opacity', () => {
  const h = harness(); h.result.selectTab('album'); h.flush(); h.ready();
  h.value('entry').value = 0.35; h.value('album').value = 0.65;
  h.result.selectTab('entry'); h.flush();
  assert.equal(h.value('entry').value, 0.35); assert.equal(h.value('album').value, 0.65);
  assert.deepEqual(h.result.mountedTabs, ['entry', 'album']);
  arrive(h); assert.deepEqual(h.result.mountedTabs, ['entry']);
});

test('queued completion from an earlier tap cannot remove the newest page', () => {
  const h = harness(); h.result.selectTab('map'); h.flush(); h.ready(); h.finishAll();
  h.result.selectTab('album'); h.flush(); h.flushRN(); h.flush();
  assert.equal(h.result.tab, 'album'); assert.ok(h.result.mountedTabs.includes('album'));
  arrive(h); assert.deepEqual(h.result.mountedTabs, ['album']);
});

test('programmatic focus/onboarding changes remain instant and cancel pending fades', () => {
  const h = harness(); h.result.selectTab('album'); h.flush(); h.ready(); h.finishAll();
  h.result.setTab('map'); h.flush(); h.flushRN(); h.flush();
  assert.equal(h.result.tab, 'map'); assert.deepEqual(h.result.mountedTabs, ['map']);
  for (const name of ['map', 'entry', 'album']) {
    assert.equal(h.value(name).value, name === 'map' ? 1 : 0); assert.equal(h.value(name).animation, null);
  }
});

test('Reduced Motion switches immediately and can interrupt a fade', () => {
  const reduced = harness(true); reduced.result.selectTab('album'); reduced.flush();
  assert.equal(reduced.result.tab, 'album'); assert.equal(reduced.animations.length, 0);
  const h = harness(); h.result.selectTab('album'); h.flush(); h.ready();
  h.value('entry').value = 0.6; h.value('album').value = 0.4;
  h.setReduced(true); h.flushRN(); h.flush();
  assert.deepEqual(h.result.mountedTabs, ['album']); assert.equal(h.value('album').value, 1);
  assert.equal(h.value('entry').value, 0); assert.equal(h.value('album').animation, null);
});

test('all six Map/Overview/Moments switch directions reach the correct final state', () => {
  for (const from of ['map', 'entry', 'album']) for (const to of ['map', 'entry', 'album']) {
    if (from === to) continue;
    const h = harness(false, from); h.result.selectTab(to); h.flush(); arrive(h);
    assert.equal(h.result.tab, to); assert.deepEqual(h.result.mountedTabs, [to]);
    for (const name of ['map', 'entry', 'album']) assert.equal(h.value(name).value, name === to ? 1 : 0);
    h.unmount();
  }
});

test('unmount cancels all animations and ignores completion already queued on RN', () => {
  const h = harness(); h.result.selectTab('album'); h.flush(); h.ready(); h.finishAll();
  h.unmount(); h.flushRN();
  for (const name of ['map', 'entry', 'album']) assert.equal(h.value(name).animation, null);
});

test('scene opacity, layout readiness, and hit testing match the actual rendered pages', () => {
  const code = ts.transpileModule(fs.readFileSync('App/components/active-quest-tab-scene.ios.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const layout = { current: false }, effects = [], ready = [];
  let lastDeps;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'react') return {
      useRef: () => layout,
      useEffect(fn, deps) {
        if (!lastDeps || deps.some((v, i) => !Object.is(v, lastDeps[i]))) effects.push(fn);
        lastDeps = deps;
      },
    };
    if (id === 'react-native-reanimated') return { __esModule: true, default: { View: 'Animated.View' }, useAnimatedStyle: fn => fn() };
    if (id === 'react-native') return { View: 'View' };
    if (id === './theme') return { T: { bg: '#fff' } };
    if (id === 'react/jsx-runtime') return require(id);
    throw new Error(`Unexpected dependency: ${id}`);
  }, module, module.exports);
  const progress = { value: 0, get() { return this.value; } };
  const props = { name: 'album', active: false, present: false, progress, request: 1, reduced: false, onReady: (...args) => ready.push(args), children: 'album-content' };
  const render = changes => {
    Object.assign(props, changes);
    const tree = module.exports.ActiveQuestTabScene(props);
    while (effects.length) effects.shift()();
    return tree;
  };
  const hidden = render({});
  assert.equal(hidden.props.children, null); assert.equal(hidden.props.pointerEvents, 'none');
  assert.equal(ready.length, 0, 'An absent scene cannot start the fade');
  const incoming = render({ active: true, present: true });
  assert.equal(incoming.props.children.props.children, 'album-content');
  assert.deepEqual(ready, [['album', 1]], 'Committed Moments must start even if native onLayout never arrives');
  incoming.props.children.props.onLayout({ nativeEvent: { layout: { width: 390, height: 0 } } });
  assert.equal(ready.length, 1);
  incoming.props.children.props.onLayout({ nativeEvent: { layout: { width: 390, height: 650 } } });
  assert.deepEqual(ready, [['album', 1], ['album', 1]]);
  assert.equal(incoming.props.style[1].opacity, 0, 'Newly mounted content starts transparent');
  assert.equal(incoming.props.style[1].transform[0].translateY, 8);
  progress.value = 0.5;
  const midway = render({}); assert.equal(midway.props.style[1].opacity, 0.5);
  assert.equal(midway.props.style[1].transform[0].translateY, 4);
  const outgoing = render({ active: false }); assert.equal(outgoing.props.pointerEvents, 'none');
  assert.equal(outgoing.props.accessibilityElementsHidden, true);
  const accessible = render({ reduced: true }); assert.equal(accessible.props.style[1].transform[0].translateY, 0);
});
