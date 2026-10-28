const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)((id) => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency ${id}`);
  }, module, module.exports);
  return module.exports;
}
function service(tables = {}, signed = []) {
  const calls = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    from(table) {
      let from = 0, to = Infinity, single = false;
      const query = {
        select() { return this; }, eq() { return this; }, in() { return this; }, not() { return this; }, order() { return this; },
        range(a, b) { from = a; to = b; calls.push({ table, from, to }); return this; },
        maybeSingle() { single = true; return this; }, returns() { return this; },
        then(resolve) { if (tables[table] instanceof Error) return Promise.resolve({ data: null, error: tables[table] }).then(resolve); const rows = tables[table] ?? []; return Promise.resolve({ data: single ? rows[0] ?? null : rows.slice(from, to + 1), error: null }).then(resolve); },
      };
      return query;
    },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: signed, error: null }) }) },
  };
  return { calls, api: load('App/services/journal/journalService.ts', {
    '@/lib/env': {}, '@/lib/supabase': { isSupabaseConfigured: true, supabase },
    '@/services/media/feed-image': {}, '@/types/content': { normalizeQuestCategory: (value) => value },
    '@/types/journal': { journalMoods: ['sad', 'neutral', 'happy'] },
  }) };
}
test('missing photo does not change the identity of later photos', async () => {
  const { api } = service({}, [{ path: 'missing', error: 'Not found' }, { path: 'second', signedUrl: 'https://signed/second' }]);
  assert.deepEqual(await api.resolveJournalMediaItems(['missing', 'second']), [{ path: 'second', uri: 'https://signed/second' }]);
});
test('repeat memories use earned XP and their own recorded route, duration and title', async () => {
  const times = ['2026-10-28T12:00:00Z', '2026-10-28T13:00:00Z'];
  const { api } = service({
    quest_completions: times.map((created_at, i) => ({ id: `c${i}`, quest_id: 'q', created_at, xp_awarded: i ? 0 : 30, photo_urls: [], quests: { title: 'Quest', experience_points: 500, estimated_minutes: 90, category: 'ADVENTURE' } })),
    quest_sessions: times.map((ended_at, i) => ({ id: `s${i}`, quest_id: 'q', ended_at, quest_session_snapshots: { entry_title: `Run ${i}`, active_duration_ms: (i + 1) * 60000, distance_meters: i * 100, render_route: [{ latitude: i, longitude: 10 }, { latitude: 999, longitude: 0 }] } })),
  });
  const memories = Object.values((await api.fetchJournalData()).memoriesByDate).flat();
  assert.deepEqual(memories.map(m => [m.title, m.xp, m.timeMin, m.routePoints[0].latitude, m.routePoints.length]), [['Run 1', 0, 2, 1, 1], ['Run 0', 30, 1, 0, 1]]);
  assert.equal((await api.fetchJournalMemory('c1')).timeMin, 2);
});
test('journal reads past API page limits and does not invent recorded duration', async () => {
  const { api, calls } = service({ quest_completions: Array.from({ length: 1001 }, (_, i) => ({ id: String(i), quest_id: 'q', created_at: '2026-10-28T12:00:00Z', xp_awarded: 0, quests: null })) });
  const memories = Object.values((await api.fetchJournalData()).memoriesByDate).flat();
  assert.equal(memories.length, 1001);
  assert.equal(memories[0].durationRecorded, false);
  assert.ok(calls.some(c => c.table === 'quest_completions' && c.from === 1000));
});
test('route bounds reject corrupt locations and frame a date-line crossing', () => {
  const { getJournalRouteRegion } = load('App/services/journal/route-region.ts');
  assert.equal(getJournalRouteRegion([{ latitude: NaN, longitude: 0 }]), null);
  const region = getJournalRouteRegion([{ latitude: 0, longitude: 179.99 }, { latitude: 0.01, longitude: -179.99 }]);
  assert.ok(region.longitudeDelta < 0.04);
  assert.ok(Math.abs(region.longitude) > 179);
});

test('route permission failures cannot hide existing journal history', async () => {
  const { api } = service({
    quest_completions: [{ id: 'saved', quest_id: 'q', created_at: '2026-10-28T12:00:00Z', xp_awarded: 20, quests: null }],
    quest_sessions: new Error('permission denied for table quest_session_snapshots'),
  });
  const journal = await api.fetchJournalData();
  assert.equal(Object.values(journal.memoriesByDate).flat()[0].completionId, 'saved');
  assert.match(journal.warning, /routes and times/);
});
