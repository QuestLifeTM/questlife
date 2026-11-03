const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load() {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('App/services/engine/quest-launch-state.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('module', 'exports', code)(module, module.exports);
  return module.exports;
}

test('the timer cannot be claimed until the full-screen countdown finishes', () => {
  const api = load();
  api.prepareQuestLaunch('quest');
  assert.equal(api.isQuestLaunchWaiting('quest'), true);
  assert.equal(api.claimQuestLaunch('session'), false);
  api.startQuestLaunchCountdown('quest', 'session');
  assert.equal(api.claimQuestLaunch('session'), false);
  api.completeQuestLaunch('session');
  assert.equal(api.isQuestLaunchWaiting('quest'), false);
  assert.equal(api.claimQuestLaunch('session'), true);
});

test('overlapping screen mounts and reopening cannot start the timer twice', () => {
  const api = load();
  api.prepareQuestLaunch('quest');
  api.startQuestLaunchCountdown('quest', 'session');
  assert.equal(api.completeQuestLaunch('session'), true);
  assert.equal(api.completeQuestLaunch('session'), false);
  assert.equal(api.claimQuestLaunch('session'), true);
  assert.equal(api.claimQuestLaunch('session'), false);
  assert.equal(api.getQuestLaunchState().phase, 'handed-off');
});

test('a cancelled questionnaire has no handoff; every subsequent quest gets its own countdown', () => {
  const api = load();
  api.prepareQuestLaunch('quest');
  api.cancelQuestLaunch('quest');
  assert.equal(api.getQuestLaunchState(), null);
  api.prepareQuestLaunch('quest');
  api.startQuestLaunchCountdown('quest', 'session-2');
  assert.equal(api.completeQuestLaunch('session-1'), false);
  assert.equal(api.completeQuestLaunch('session-2'), true);
});

test('stale callbacks from an older quest cannot complete or cancel the current launch', () => {
  const api = load();
  api.prepareQuestLaunch('old');
  api.prepareQuestLaunch('new');
  api.startQuestLaunchCountdown('old', 'old-session');
  api.cancelQuestLaunch('old');
  assert.equal(api.getQuestLaunchState().questId, 'new');
  assert.equal(api.completeQuestLaunch('old-session'), false);
});

test('screen subscribers observe the handoff and unsubscribe cleanly', () => {
  const api = load();
  const phases = [];
  const unsubscribe = api.subscribeQuestLaunch(() => phases.push(api.getQuestLaunchState()?.phase));
  api.prepareQuestLaunch('quest');
  api.startQuestLaunchCountdown('quest', 'session');
  api.completeQuestLaunch('session');
  api.claimQuestLaunch('session');
  unsubscribe();
  api.prepareQuestLaunch('next');
  assert.deepEqual(phases, ['preparing', 'countdown', 'complete', 'handed-off']);
});
