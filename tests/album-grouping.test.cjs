const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
process.env.TZ = 'America/New_York';
const compiled = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../App/services/journal/album-model.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const loaded = { exports: {} };
new Function('exports', 'module', compiled)(loaded.exports, loaded);
const { groupAlbums, memoryAlbum } = loaded.exports;
const album = (id, dates, category = 'fitness') => ({ id, title: id, date: dates[0], category,
  items: dates.map((capturedAt, index) => ({ id: `legacy:${index}`, kind: 'photo', bucket: 'journal-media', path: `${id}/${index}`, capturedAt })) });

test('quest preserves navigation and separate same-ID legacy photos survive grouping', () => {
  const input = [album('a', ['2026-11-03T12:00:00Z']), album('b', ['2026-11-04T12:00:00Z'])];
  assert.equal(groupAlbums(input, 'quest'), input);
  const groups = groupAlbums(input, 'week');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].items.length, 2);
  assert.notEqual(groups[0].items[0].id, groups[0].items[1].id);
  assert.equal(groups[0].grouped, true);
  assert.equal(groups[0].completionId, undefined);
});
test('Sunday boundaries use local time and survive DST and year changes', () => {
  const groups = groupAlbums([album('a', ['2026-11-01T03:59:00Z', '2026-11-01T04:00:00Z', '2026-11-01T07:00:00Z'])], 'week');
  assert.deepEqual(groups.map(g => g.items.length), [2, 1]);
  assert.equal(groupAlbums([album('a', ['2026-12-31T12:00:00Z', '2027-01-01T12:00:00Z'])], 'week').length, 1);
  assert.equal(groupAlbums([album('a', ['2026-03-08T06:30:00Z', '2026-03-08T07:30:00Z'])], 'week').length, 1);
});
test('months distinguish years and local midnight', () => {
  const groups = groupAlbums([album('a', ['2027-01-01T04:59:00Z', '2027-01-01T05:00:00Z', '2026-01-01T12:00:00Z'])], 'month');
  assert.deepEqual(groups.map(g => g.title), ['January 2027', 'December 2026', 'January 2026']);
});
test('categories sort alphabetically, media chronologically, and duplicate paths only appear once', () => {
  const a = album('a', ['2026-11-04T12:00:00Z'], 'social');
  const b = album('b', ['2026-11-03T12:00:00Z'], 'social');
  const groups = groupAlbums([a, b, a, album('c', ['2026-11-03T12:00:00Z'])], 'category');
  assert.deepEqual(groups.map(g => g.title), ['Fitness', 'Social']);
  assert.deepEqual(groups[1].items.map(i => i.path), ['b/0', 'a/0']);
  assert.deepEqual(groupAlbums([], 'month'), []);
});
test('legacy media falls back to completion date and carries category', () => {
  const result = memoryAlbum({ completionId: 'old', title: 'Old', completedAt: '2026-05-03T12:00:00Z', category: 'creative', photoPaths: ['old/photo'] });
  assert.equal(groupAlbums([result], 'month')[0].title, 'May 2026');
  assert.equal(groupAlbums([result], 'category')[0].title, 'Creative');
});
