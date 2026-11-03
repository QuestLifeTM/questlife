const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function store() {
  const files = new Map();
  let owner = 'alice';
  let blocked = false;
  let failWrite = false;
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('App/services/journal/mood-note-store.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const dependencies = {
    '@/lib/device-files': {
      getInfoAsync: async path => ({ exists: files.has(path) }),
      readAsStringAsync: async path => files.get(path),
      makeDirectoryAsync: async () => {},
      writeAsStringAsync: async (path, value) => { if (failWrite) throw new Error('Disk full'); files.set(path, value); },
      moveAsync: async ({ from, to }) => { files.set(to, files.get(from)); files.delete(from); },
      deleteAsync: async path => { for (const key of files.keys()) if (key.startsWith(path)) files.delete(key); },
    },
    '@/services/local-data/lifecycle': { localUserRoot: id => `/users/${id}` },
    '@/services/local-data/owner': { getLocalDataOwner: () => owner, areLocalDataWritesBlocked: () => blocked },
  };
  new Function('require', 'module', 'exports', code)(id => { assert.ok(id in dependencies); return dependencies[id]; }, module, module.exports);
  return { api: module.exports, files, switchOwner: id => owner = id, block: () => blocked = true, fail: value => failWrite = value };
}

test('mood notes survive reopening and remain separate from chapter titles and other days', async () => {
  const { api } = store();
  assert.equal(await api.readMoodNote('alice', '2026-11-02'), '');
  await api.writeMoodNote('alice', '2026-11-02', 'A quiet afternoon.');
  assert.equal(await api.readMoodNote('alice', '2026-11-02'), 'A quiet afternoon.');
  assert.equal(await api.readMoodNote('alice', '2026-11-01'), '');
  await api.writeMoodNote('alice', '2026-11-02', '');
  assert.equal(await api.readMoodNote('alice', '2026-11-02'), '');
});

test('a failed note write preserves the prior note and can be retried', async () => {
  const { api, fail } = store();
  await api.writeMoodNote('alice', '2026-11-02', 'Original');
  fail(true);
  await assert.rejects(api.writeMoodNote('alice', '2026-11-02', 'Revision'), /Disk full/);
  assert.equal(await api.readMoodNote('alice', '2026-11-02'), 'Original');
  fail(false);
  await api.writeMoodNote('alice', '2026-11-02', 'Revision');
  assert.equal(await api.readMoodNote('alice', '2026-11-02'), 'Revision');
});

test('account switches and logout cannot read or write another account mood notes', async () => {
  const { api, switchOwner, block } = store();
  await api.writeMoodNote('alice', '2026-11-02', 'Private');
  switchOwner('bob');
  await assert.rejects(api.readMoodNote('alice', '2026-11-02'), /session changed/);
  assert.equal(await api.readMoodNote('bob', '2026-11-02'), '');
  block();
  await assert.rejects(api.writeMoodNote('bob', '2026-11-02', 'New'), /session changed/);
});

test('notes reject unsafe paths, oversized input and corrupt saved data', async () => {
  const { api, files } = store();
  await assert.rejects(api.writeMoodNote('alice', '../other', 'test'), /Invalid journal date/);
  await assert.rejects(api.writeMoodNote('alice', '2026-11-02', 'x'.repeat(1001)), /1,000/);
  files.set('/users/alice/mood-notes/2026-11-02.json', '{}');
  await assert.rejects(api.readMoodNote('alice', '2026-11-02'), /could not be read/);
});
