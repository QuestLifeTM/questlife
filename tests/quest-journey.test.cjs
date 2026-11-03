const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, module, module.exports);
  return module.exports;
}
const model = load('App/services/active-quest/journey-model.ts');
test('staggered prompts respect exact boundaries and replace missed intervals', () => {
  const due = minutes => model.availablePrompts(minutes * 60000, model.emptyJourney()).map(p => p.id);
  assert.deepEqual(due(4.99), []);
  assert.deepEqual(due(5), ['capture:0']);
  assert.deepEqual(due(10), ['mood:1', 'capture:0']);
  assert.deepEqual(due(15), ['mood:1', 'note:1']);
  assert.deepEqual(due(25), ['mood:2', 'capture:2']);
  assert.deepEqual(due(100), ['mood:10', 'note:9']);
});
test('pauses exclude wall time, active background time continues, dismissed/responded prompts stay gone', () => {
  const session = { recordingState: 'paused', activeDurationMs: 299000, activeSince: null };
  assert.equal(model.activeElapsedMs(session, 999999999), 299000);
  assert.equal(model.activeElapsedMs({ ...session, recordingState: 'recording', activeSince: new Date(0).toISOString() }, 1000), 300000);
  assert.deepEqual(model.availablePrompts(600000, { dismissed: ['capture:0'], events: [{ prompt: { id: 'mood:1' } }] }), []);
});
test('invalid and expired reward responses are rejected while valid unsponsored moments remain savable', () => {
  const event = { id: 'one', kind: 'video', uri: '/video.mp4', durationSeconds: 31, activeElapsedMs: 300000 };
  assert.throws(() => model.validateJourneyEvent(event), /30 seconds/);
  assert.doesNotThrow(() => model.validateJourneyEvent({ ...event, durationSeconds: 30 }));
  const oldPrompt = model.availablePrompts(300000, model.emptyJourney())[0];
  assert.throws(() => model.validateJourneyEvent({ ...event, durationSeconds: 30, activeElapsedMs: 1000000, prompt: oldPrompt }), /expired/);
  assert.throws(() => model.validateJourneyEvent({ id: 'note', kind: 'note', body: '  ', activeElapsedMs: 0 }), /Write a note/);
});

function launch() { return load('App/services/engine/quest-launch-state.ios.ts'); }
test('GO cannot hand off before the matching destination is ready; retry does not create or repeat a countdown', () => {
  const flow = launch();
  flow.prepareQuestLaunch('quest'); flow.startQuestLaunchCountdown('quest', 'session');
  assert.equal(flow.completeQuestLaunch('session'), false);
  flow.markQuestDestinationReady('old-session');
  assert.equal(flow.completeQuestLaunch('session'), false);
  flow.failQuestPreparation('session', 'disk'); flow.retryQuestPreparation('session');
  assert.equal(flow.getQuestLaunchState().phase, 'countdown');
  assert.equal(flow.getQuestLaunchState().retryVersion, 1);
  flow.markQuestDestinationReady('session');
  assert.equal(flow.completeQuestLaunch('session'), true);
  assert.equal(flow.claimQuestLaunch('session'), true);
  assert.equal(flow.claimQuestLaunch('session'), false);
});
test('a stale destination cannot claim a replacement quest or replay the old launch', () => {
  const flow = launch();
  flow.prepareQuestLaunch('old'); flow.startQuestLaunchCountdown('old', 'old-session');
  flow.prepareQuestLaunch('new'); flow.startQuestLaunchCountdown('new', 'new-session');
  flow.markQuestDestinationReady('old-session');
  assert.equal(flow.getQuestLaunchState().destinationReady, undefined);
  assert.equal(flow.completeQuestLaunch('old-session'), false);
});

function storeHarness() {
  let persisted = null, fail = false, owner = 'alice';
  const store = load('App/services/active-quest/local-store.ios.ts', {
    './journey-model': model,
    '@/lib/device-files': { documentDirectory: '/local/', readAsStringAsync: async () => { throw new Error('Missing'); } },
    '@/services/active-quest/route-filter': { simplifyRouteForRendering: route => route },
    '@/services/active-quest/measurement': {},
    '@/services/active-quest/route-segments': { buildRenderableSegments: () => [] },
    '@/services/active-quest/tracking-session': {},
    '@/services/local-data/owner': { requireLocalDataOwner: () => owner, getLocalDataOwner: () => owner },
    '@/lib/device-quest-store': {
      readQuestStore: async () => persisted,
      commitQuestStore: async (_root, commit) => { if (fail) throw new Error('Disk full'); persisted = { metadata: commit.metadata, points: [] }; },
    },
  });
  return { store, fail: value => fail = value, owner: value => owner = value };
}
test('rapid duplicate prompt saves create one durable note and one response; failed commits preserve prior work', async () => {
  const { store, fail } = storeHarness();
  await store.ensureActiveQuestSession({ sessionId: 'session', questId: 'quest', startedAt: new Date().toISOString(), entryTitle: 'Chapter' });
  const prompt = model.availablePrompts(900000, model.emptyJourney()).find(p => p.kind === 'note');
  const event = { id: prompt.id, kind: 'note', body: 'A lovely view', capturedAt: new Date().toISOString(), activeElapsedMs: 900000, prompt, syncState: 'pending', xp: 0 };
  await Promise.all([store.putJourneyEvent('session', event), store.putJourneyEvent('session', event)]);
  let snapshot = await store.getActiveQuestSnapshot('session');
  assert.equal(snapshot.activity.length, 1);
  assert.equal(snapshot.session.journey.events.length, 1);
  assert.equal(snapshot.session.entryTitle, 'Chapter');
  fail(true);
  await assert.rejects(store.putJourneyEvent('session', { ...event, id: 'manual', prompt: undefined }), /Disk full/);
  snapshot = await store.getActiveQuestSnapshot('session');
  assert.equal(snapshot.activity.length, 1);
  fail(false);
  await store.putJourneyEvent('session', { ...event, id: 'manual', prompt: undefined });
  assert.equal((await store.getActiveQuestSnapshot('session')).activity.length, 2);
});
test('deleting a rewarded timeline item cannot recreate its prompt or reward response', async () => {
  const { store } = storeHarness();
  await store.ensureActiveQuestSession({ sessionId: 'session', questId: 'quest', startedAt: new Date().toISOString(), entryTitle: '' });
  const prompt = model.availablePrompts(900000, model.emptyJourney()).find(p => p.kind === 'note');
  await store.putJourneyEvent('session', { id: prompt.id, kind: 'note', body: 'Note', activeElapsedMs: 900000, capturedAt: new Date().toISOString(), prompt, syncState: 'synced', xp: 10 });
  await store.deleteActiveQuestActivity((await store.getActiveQuestSnapshot('session')).activity[0].id);
  const snapshot = await store.getActiveQuestSnapshot('session');
  assert.equal(snapshot.activity.length, 0);
  assert.ok(!model.availablePrompts(900000, snapshot.session.journey).some(p => p.id === prompt.id));
});
