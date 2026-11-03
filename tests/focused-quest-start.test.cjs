const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('App/services/engine/focused-quest-start.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('require', 'module', 'exports', code)(() => { throw new Error('Unexpected runtime dependency'); }, moduleUnderTest, moduleUnderTest.exports);
const { createFocusedStartAttempt, QuestStartCancelled, isQuestStartCancelled } = moduleUnderTest.exports;
const empty = { doingNowSession: null };
const active = (questId = 'quest') => ({ doingNowSession: { id: 'session', questId } });
const result = { sessionId: 'session', mode: 'focused' };

test('constructing the flow does not start a quest; submission preserves the source', async () => {
  let starts = 0;
  const input = { questId: 'quest', source: 'saved' };
  const attempt = createFocusedStartAttempt({ input, readState: async () => empty, create: async value => { assert.deepEqual(value, input); starts++; return result; } });
  assert.equal(starts, 0);
  assert.deepEqual(await attempt(), result);
  assert.equal(starts, 1);
});

test('rapid repeated submissions and retries after success create only one session', async () => {
  let starts = 0;
  const attempt = createFocusedStartAttempt({ input: { questId: 'quest' }, readState: async () => empty, create: async () => { starts++; return result; } });
  const values = await Promise.all([attempt(), attempt(), attempt()]);
  assert.deepEqual(values, [result, result, result]);
  await attempt();
  assert.equal(starts, 1);
});

test('a lost creation response reconciles the remote session instead of creating again', async () => {
  let created = false;
  let starts = 0;
  const attempt = createFocusedStartAttempt({ input: { questId: 'quest' }, readState: async () => created ? active() : empty, create: async () => { starts++; created = true; throw new Error('Lost response'); } });
  assert.deepEqual(await attempt(), result);
  assert.deepEqual(await attempt(), result);
  assert.equal(starts, 1);
});

test('a failed creation can be retried after successful reconciliation confirms no session', async () => {
  let starts = 0;
  const attempt = createFocusedStartAttempt({ input: { questId: 'quest' }, readState: async () => empty, create: async () => { if (++starts === 1) throw new Error('Offline'); return result; } });
  await assert.rejects(attempt(), /Offline/);
  assert.deepEqual(await attempt(), result);
  assert.equal(starts, 2);
});

test('another active quest blocks creation without abandoning it', async () => {
  const attempt = createFocusedStartAttempt({ input: { questId: 'quest' }, readState: async () => active('other'), create: async () => { assert.fail('Must not create'); } });
  await assert.rejects(attempt(), /already have an active quest/);
});

test('unavailable reconciliation prevents a blind retry', async () => {
  let reads = 0;
  let starts = 0;
  const attempt = createFocusedStartAttempt({ input: { questId: 'quest' }, readState: async () => { if (++reads > 1) throw new Error('Cannot reconcile'); return empty; }, create: async () => { starts++; throw new Error('Lost response'); } });
  await assert.rejects(attempt(), /Cannot reconcile/);
  await assert.rejects(attempt(), /Cannot reconcile/);
  assert.equal(starts, 1);
});

test('cancellation has a distinct outcome so callers do not show an error or navigate active', () => {
  assert.equal(isQuestStartCancelled(new QuestStartCancelled()), true);
  assert.equal(isQuestStartCancelled(new Error('Network failure')), false);
});

test('a later new focused quest gets a fresh start attempt rather than a remembered first-time result', async () => {
  let starts = 0;
  const deps = { input: { questId: 'quest' }, readState: async () => empty, create: async () => ({ sessionId: `session-${++starts}`, mode: 'focused' }) };
  assert.equal((await createFocusedStartAttempt(deps)()).sessionId, 'session-1');
  assert.equal((await createFocusedStartAttempt(deps)()).sessionId, 'session-2');
});
