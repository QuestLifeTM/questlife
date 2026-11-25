const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const flatten = (style) => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};
const theme = { cyan: '#00bbf9', pink: '#fd79a8', teal: '#00cec9', blue: '#4da8ff', primaryButton: '#4da8ff', compactButton: '#4da8ff', red: '#e17055', orange: '#f39c12', purple: '#a29bfe', green: '#27ae60', white: '#ffffff', bg: '#fffcf5', surface: '#ffffff', raised: '#ffffff', input: '#fffcf5', border: '#e8dfd5', pressed: '#f0e8e2', selected: '#3d3438', dark: '#3d3438' };
const palette = { ADVENTURE: { text: '#4AA3FF' }, FITNESS: { text: '#FF5C5C' }, 'FOOD AND DRINKS': { text: '#FF9A4A' }, CREATIVITY: { text: '#A474FF' }, SOCIAL: { text: '#4ACF78' } };
function load(os = 'ios') {
  const module = { exports: {} };
  const react = { forwardRef: fn => fn, createElement: (type, props) => ({ type, props }) };
  const mocks = { react, 'react-native': { Platform: { OS: os }, Pressable: 'Pressable', StyleSheet: { flatten } }, '@/components/theme': { T: theme }, '@/types/content': { questCategoryColors: palette } };
  const code = ts.transpileModule(fs.readFileSync('App/components/raised-pressable.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => mocks[name], module, module.exports);
  return module.exports;
}
const button = { minHeight: 54, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.blue };
function resolve(props, pressed = false, os = 'ios') {
  const element = load(os).Pressable(props, null);
  return flatten(typeof element.props.style === 'function' ? element.props.style({ pressed }) : element.props.style);
}
test('all five legacy button hues use the category palette and opaque darker edges', () => {
  for (const [legacy, category] of [['blue', 'ADVENTURE'], ['red', 'FITNESS'], ['orange', 'FOOD AND DRINKS'], ['purple', 'CREATIVITY'], ['green', 'SOCIAL']]) {
    const style = resolve({ style: { ...button, backgroundColor: theme[legacy] } });
    assert.equal(style.backgroundColor, palette[category].text);
    assert.match(style.borderBottomColor, /^#[\da-f]{6}$/i);
    assert.notEqual(style.borderBottomColor, style.backgroundColor);
    assert.equal(style.borderBottomWidth, 5);
  }
});
test('pressed buttons compress; disabled buttons retain depth and handlers', () => {
  assert.equal(resolve({ style: button }, true).borderBottomWidth, 2);
  assert.deepEqual(resolve({ style: button }, true).transform, [{ translateY: 3 }]);
  assert.equal(resolve({ style: button, disabled: true }, true).borderBottomWidth, 5);
  const onPress = () => {};
  assert.equal(load().Pressable({ style: button, onPress, accessibilityLabel: 'Save', disabled: true }, null).props.onPress, onPress);
});
test('outlines, tinted choices, switches, large cards and other platforms retain styles', () => {
  for (const props of [
    { style: { ...button, backgroundColor: theme.white, borderColor: theme.blue } },
    { style: { ...button, backgroundColor: '#4AA3FF18' } },
    { style: button, accessibilityRole: 'switch' },
    { style: { ...button, height: 160 } },
  ]) assert.deepEqual(resolve(props), props.style);
  assert.deepEqual(resolve({ style: button }, false, 'android'), button);
  assert.deepEqual(resolve({ style: button }, false, 'web'), button);
});
test('callback arrays, custom transforms and fixed heights survive', () => {
  const style = resolve({ style: ({ pressed }) => [button, { height: 58, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }] }, true);
  assert.equal(style.height, 58);
  assert.equal(style.opacity, 0.8);
  assert.deepEqual(style.transform, [{ scale: 0.96 }]);
});
test('neutral Apple actions get depth and high-contrast fills stay intact', () => {
  assert.equal(resolve({ style: { ...button, backgroundColor: theme.dark } }).borderBottomWidth, 5);
  const previous = theme.primaryButton;
  try {
    theme.primaryButton = '#006dcc';
    assert.equal(resolve({ style: { ...button, backgroundColor: '#006dcc' } }).backgroundColor, '#006dcc');
  } finally {
    theme.primaryButton = previous;
  }
});
