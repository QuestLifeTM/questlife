const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('App/lib/completion-recap.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('module', 'exports', source)(mod, mod.exports);
const { parseCompletionDuration } = mod.exports;

test('counts the real quest timer format, including sub-minute and long sessions', () => {
  assert.equal(parseCompletionDuration('0s'), 0);
  assert.equal(parseCompletionDuration('47s'), 47);
  assert.equal(parseCompletionDuration('3m 04s'), 184);
  assert.equal(parseCompletionDuration('2h 03m 04s'), 7384);
  assert.equal(parseCompletionDuration('1d 2h 03m 04s'), 93784);
});

test('supports colon-form recaps without losing seconds or hours', () => {
  assert.equal(parseCompletionDuration('1:51'), 111);
  assert.equal(parseCompletionDuration('1:02:03'), 3723);
  assert.equal(parseCompletionDuration(' 00:00 '), 0);
});

test('unknown or invalid durations remain displayable instead of becoming fake zeroes', () => {
  for (const input of ['', '—', 'about 5 minutes', '3:99', '1:99:00', '-4s', '1m garbage', '999999999999999999999d']) {
    assert.equal(parseCompletionDuration(input), null, input);
  }
});
