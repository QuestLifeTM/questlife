const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const path = 'App/screens/journal-screen.tsx';
const file = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'JournalScreen');
const all = [];
function visit(node) { all.push(node); ts.forEachChild(node, visit); }
visit(screen);
const list = all.find(node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === 'FlatList'
  && node.attributes.properties.some(prop => prop.name?.text === 'ref' && prop.initializer?.expression?.getText(file) === 'journalListRef'));
const prop = name => list.attributes.properties.find(node => node.name?.text === name).initializer.expression;

// Evaluate the screen's actual wiring rather than reproducing its selection logic.
function evaluate(node, scope) {
  const module = { exports: {} };
  const code = ts.transpileModule(`module.exports = (${node.getText(file)});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('module', ...Object.keys(scope), code)(module, ...Object.values(scope));
  return module.exports;
}
const archive = ['2026-11-23', '2026-11-22', '2026-11-21'];

test('iOS shows only the calendar-selected date, including days without memories', () => {
  for (const activeKey of archive) {
    assert.deepEqual(evaluate(prop('data'), {
      Platform: { OS: 'ios' }, data: { memoriesByDate: {} }, loading: false, activeKey, dayKeys: archive,
    }), [activeKey]);
  }
  assert.deepEqual(evaluate(prop('data'), {
    Platform: { OS: 'web' }, data: {}, loading: false, activeKey: archive[1], dayKeys: archive,
  }), archive);
});

test('loading and failed initial loads leave the iOS list empty for its loading/error view', () => {
  for (const loading of [true, false]) assert.deepEqual(evaluate(prop('data'), {
    Platform: { OS: 'ios' }, data: null, loading, activeKey: archive[0], dayKeys: archive,
  }), []);
});

test('scrolling cannot select another date and changing dates starts a fresh day list', () => {
  assert.equal(evaluate(prop('onViewableItemsChanged'), { Platform: { OS: 'ios' } }), undefined);
  assert.equal(evaluate(prop('onScrollToIndexFailed'), { Platform: { OS: 'ios' } }), undefined);
  const first = evaluate(prop('key'), { Platform: { OS: 'ios' }, activeKey: archive[0] });
  const second = evaluate(prop('key'), { Platform: { OS: 'ios' }, activeKey: archive[1] });
  assert.notEqual(first, second);
});

test('calendar taps select the day without trying to scroll into the old archive', () => {
  const handler = all.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleSelectDate');
  const activeKeyRef = { current: archive[0] };
  const target = { current: archive[0] };
  const retries = { current: 2 };
  let selected, reveals = 0, archiveJumps = 0;
  const select = evaluate(handler, {
    Platform: { OS: 'ios' }, activeKeyRef, setActiveKey: key => { selected = key; },
    pendingCalendarTargetRef: target, calendarScrollRetryCountRef: retries,
    collapsibleHeader: { reveal: () => { reveals++; } }, scrollToDay: () => { archiveJumps++; },
  });
  select(archive[2]);
  assert.equal(selected, archive[2]);
  assert.equal(activeKeyRef.current, archive[2]);
  assert.equal(target.current, null);
  assert.equal(retries.current, 0);
  assert.equal(reveals, 1);
  assert.equal(archiveJumps, 0);
});

test('completion links select their own date once without overriding later calendar taps', () => {
  const effect = all.find(node => ts.isCallExpression(node) && node.expression.getText(file) === 'useEffect'
    && node.arguments[0]?.getText(file).includes('selectedCompletionIdRef.current'))?.arguments[0];
  const selectedCompletionIdRef = { current: null }, didFocusCompletionRef = { current: true }, activeKeyRef = { current: archive[0] };
  const selections = [];
  const focus = evaluate(effect, {
    Platform: { OS: 'ios' }, completionId: 'past-completion', selectedCompletionIdRef, didFocusCompletionRef, activeKeyRef,
    data: { memoriesByDate: { [archive[0]]: [{ completionId: 'today-completion' }], [archive[2]]: [{ completionId: 'past-completion' }] } },
    setActiveKey: key => selections.push(key),
  });
  focus();
  assert.deepEqual(selections, [archive[2]]);
  assert.equal(didFocusCompletionRef.current, false);
  activeKeyRef.current = archive[1];
  focus();
  assert.deepEqual(selections, [archive[2]]);
  assert.equal(activeKeyRef.current, archive[1]);
});
