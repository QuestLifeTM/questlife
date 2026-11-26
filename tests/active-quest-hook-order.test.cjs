const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

test('active quest calls all hooks before completion, loading, or empty returns', () => {
  const path = 'App/screens/active-quest-screen.ios.tsx';
  const source = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const screen = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ActiveQuestScreen');
  assert.ok(screen?.body);
  const hooks = [];
  const returns = [];
  function visit(node) {
    // Event handlers, effects, and render callbacks have their own return paths.
    if (ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node)) returns.push(node.getStart(source));
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression) ? node.expression.text : '';
      if (/^use[A-Z]/.test(name)) hooks.push({ name, position: node.getStart(source) });
    }
    ts.forEachChild(node, visit);
  }
  screen.body.statements.forEach(visit);
  assert.ok(returns.length > 1, 'covers the early-return branches');
  assert.ok(hooks.length > 0);
  const firstReturn = Math.min(...returns);
  for (const hook of hooks) assert.ok(hook.position < firstReturn, `${hook.name} must run before every screen return`);
});
