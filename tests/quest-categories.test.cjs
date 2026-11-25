const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

function load(file) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('module', 'exports', code)(module, module.exports);
  return module.exports;
}
const expected = {
  ADVENTURE: '#4AA3FF', FITNESS: '#FF5C5C', 'FOOD AND DRINKS': '#FF9A4A',
  CREATIVITY: '#A474FF', SOCIAL: '#4ACF78',
};

test('mobile and admin offer only the five categories and use the exact palette', () => {
  const mobile = load('App/types/content.ts');
  const admin = load('Admin/types/content.ts');
  assert.deepEqual(mobile.questCategories, admin.questCategories);
  assert.deepEqual(mobile.questCategoryColors, admin.questCategoryColors);
  assert.deepEqual(mobile.questCategories.filter(c => c !== 'All').sort(), Object.keys(expected).sort());
  for (const [category, color] of Object.entries(expected)) {
    assert.equal(mobile.questCategoryColors[category].text, color);
    assert.equal(mobile.normalizeQuestCategory(category), category);
  }
  for (const old of ['EVENTS', 'WILD CARD', 'SKILLS', 'NATURE', 'UNKNOWN', '', 'All', null, undefined]) {
    assert.equal(mobile.normalizeQuestCategory(old), 'SOCIAL');
    assert.equal(admin.normalizeQuestCategory(old), 'SOCIAL');
  }
  assert.equal(mobile.normalizeQuestCategory('Food & Drinks'), 'FOOD AND DRINKS');
});

test('migration preserves quest links, converts removed categories, recolors every quest, and restores guards', async () => {
  const migration = fs.readdirSync('supabase/migrations').find(f => f.endsWith('_consolidate_quest_category_palette.sql'));
  const sql = fs.readFileSync(`supabase/migrations/${migration}`, 'utf8');
  assert.equal(sql, fs.readFileSync('Database/migrations/028_consolidate_quest_category_palette.sql', 'utf8'));
  const db = new PGlite();
  try {
    await db.exec(`
      create table public.quests(id integer primary key, category text not null, accent_color text, status text default 'published');
      create table public.quest_completions(quest_id integer references public.quests(id), xp_awarded integer);
      create function public.guard_quest_transition() returns trigger language plpgsql as $$
      begin raise exception 'Admin authentication required'; end; $$;
      create trigger quests_enforce_admin_transition before update on public.quests for each row execute function public.guard_quest_transition();
    `);
    const categories = [...Object.keys(expected), 'EVENTS', 'WILD CARD', 'SKILLS', 'NATURE', 'OLD CATEGORY', 'Food & Drinks'];
    for (const [i, category] of categories.entries()) {
      await db.query('insert into public.quests(id,category,accent_color) values($1,$2,$3)', [i, category, '#123456']);
      await db.query('insert into public.quest_completions values($1,30)', [i]);
    }
    await db.exec(sql);
    const rows = (await db.query('select * from public.quests order by id')).rows;
    assert.equal(rows.length, categories.length);
    for (const row of rows) {
      const category = load('App/types/content.ts').normalizeQuestCategory(categories[row.id]);
      assert.equal(row.category, category);
      assert.equal(row.accent_color, expected[category]);
      assert.equal(row.status, 'published');
    }
    assert.equal((await db.query('select sum(xp_awarded)::integer as xp from public.quest_completions')).rows[0].xp, categories.length * 30);
    await assert.rejects(db.query("insert into public.quests(id,category) values(100,'EVENTS')"), /quests_category_check/);
    await assert.rejects(db.query("update public.quests set status='archived' where id=0"), /Admin authentication required/);
    // A repeated migration leaves the converted records unchanged.
    await db.exec(sql);
    assert.deepEqual((await db.query('select * from public.quests order by id')).rows, rows);
  } finally { await db.close(); }
});
