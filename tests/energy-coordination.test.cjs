const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(name) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(`App/services/active-quest/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(() => ({ energyCount() {} }), module, module.exports);
  return module.exports;
}
test('a burst queues only one follow-up and shares completion', async () => {
  const run = load('sync-coordinator').createSyncCoordinator();
  let release, calls = 0;
  const gate = new Promise(resolve => release = resolve);
  const work = async () => { calls++; if (calls === 1) await gate; };
  const first = run('owner:session', work);
  await Promise.resolve();
  const rest = Array.from({ length: 100 }, () => run('owner:session', work));
  release();
  await Promise.all([first, ...rest]);
  assert.equal(calls, 2);
});
test('failed job can retry and different owners are independent', async () => {
  const run = load('sync-coordinator').createSyncCoordinator();
  await assert.rejects(run('a', async () => { throw Error('offline'); }));
  let calls = 0;
  await Promise.all(['a', 'b'].map(key => run(key, async () => { calls++; })));
  assert.equal(calls, 2);
});
test('acknowledgements skip unchanged payloads but preserve concurrent edits and failures', async () => {
  const { syncChanged } = load('sync-revisions');
  let calls = 0;
  const send = async () => { calls++; return { error: null }; };
  await syncChanged('a', { revision: 1 }, send);
  await syncChanged('a', { revision: 1 }, send);
  await syncChanged('a', { revision: 2 }, send);
  await assert.rejects(syncChanged('a', { revision: 3 }, async () => ({ error: Error('offline') })));
  await syncChanged('a', { revision: 3 }, send);
  assert.equal(calls, 3);
});
test('background ownership expires and never crosses recording windows', () => {
  const owner = load('recording-owner');
  owner.backgroundDelivered('first');
  assert.equal(owner.backgroundOwnsPersistence('first'), true);
  assert.equal(owner.backgroundOwnsPersistence('second'), false);
  assert.equal(owner.backgroundOwnsPersistence('first', Date.now() + 6000), false);
});
