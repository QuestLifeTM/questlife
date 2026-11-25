const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../App/services/content/contentService.ios.ts'), 'utf8');
function service(responses) {
  const calls = [];
  const supabase = { from(table) {
    const call = { table }; calls.push(call);
    const query = { select(columns) { call.columns = columns; return query; }, order() { return query; }, eq(k, v) { call.filter = [k, v]; return query; }, returns() { return Promise.resolve(responses.shift()); } };
    return query;
  } };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(name => {
    if (name === '@/lib/env') return { SUPABASE_CONFIG_ERROR: 'Missing config' };
    if (name === '@/lib/supabase') return { isSupabaseConfigured: true, supabase };
    if (name === '@/types/content') return { normalizeQuestCategory: () => 'ADVENTURE', questCategoryColors: { ADVENTURE: { text: '#123456' } } };
    throw Error(name);
  }, module, module.exports);
  return { load: module.exports.fetchPublishedQuestCatalog, calls };
}
const row = { id: 'quest', title: 'Walk', category: 'ADVENTURE', experience_points: 50, estimated_minutes: 20, status: 'published' };
const missing = column => ({ data: null, error: { code: '42703', message: `column quests.${column} does not exist` } });
test('missing personalization retries without removing existing quest mode', async () => {
  const { load, calls } = service([missing('personalization'), { data: [{ ...row, quest_mode: 'flexible' }], error: null }]);
  const result = await load();
  assert.equal(result.length, 1); assert.equal(result[0].mode, 'flexible'); assert.deepEqual(result[0].sideTasks, []);
  assert.equal(calls.length, 2); assert.ok(!calls[1].columns.includes('personalization')); assert.ok(calls[1].columns.includes('quest_mode'));
  calls.forEach(c => assert.deepEqual(c.filter, ['status', 'published']));
});
test('both optional columns absent still loads older catalogs', async () => {
  const { load, calls } = service([missing('quest_mode'), missing('personalization'), { data: [row], error: null }]);
  const [quest] = await load(); assert.equal(quest.mode, 'focused'); assert.deepEqual(quest.sideTasks, []); assert.equal(calls.length, 3);
});
test('modern catalog retains side tasks without retries', async () => {
  const tasks = [{ id: 'side-task', xp: 20 }];
  const { load, calls } = service([{ data: [{ ...row, personalization: tasks, quest_mode: 'flexible' }], error: null }]);
  assert.deepEqual((await load())[0].sideTasks, tasks); assert.equal(calls.length, 1);
});
test('schema cache errors are handled, permission errors are not hidden', async () => {
  const cached = service([{ error: { code: 'PGRST204', message: "Could not find the 'personalization' column" } }, { data: [row], error: null }]);
  assert.equal((await cached.load()).length, 1);
  const denied = { code: '42501', message: 'permission denied for quests' };
  const { load, calls } = service([{ error: denied }]);
  await assert.rejects(load, e => e === denied); assert.equal(calls.length, 1);
});
