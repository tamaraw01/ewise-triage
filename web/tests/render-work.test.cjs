/* eslint-disable @typescript-eslint/no-require-imports -- Node regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const flow = fs.readFileSync('components/AnalysisFlow.tsx', 'utf8');

test('inactive statistical and simulation tabs defer heavy modules', () => {
  const source = ts.createSourceFile('page.tsx', fs.readFileSync('app/page.tsx', 'utf8'), ts.ScriptTarget.Latest, true);
  const imports = source.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text);
  for (const name of ['ResearchDashboard', 'AnalysisFlow', 'Implementation']) {
    assert.ok(!imports.includes(`@/components/${name}`), `${name} must load only when selected`);
  }
});

test('Konsol static imports exclude Three and deferred populations', () => {
  const path = require('node:path');
  const seen = new Set();
  function visit(file) {
    if (seen.has(file) || !/\.tsx?$/.test(file)) return;
    seen.add(file);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) || node.importClause?.isTypeOnly) continue;
      const bindings = node.importClause?.namedBindings;
      if (!node.importClause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.every(e => e.isTypeOnly)) continue;
      const spec = node.moduleSpecifier.text;
      assert.ok(!spec.startsWith('three'), `${file}: ${spec}`);
      if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
      const base = spec.startsWith('@/') ? path.resolve(spec.slice(2)) : path.resolve(path.dirname(file), spec);
      assert.ok(!/data\/(analysis-flow|analytics|gallery|map-photos)\.json$/.test(base), `${file}: ${spec}`);
      const resolved = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p));
      assert.ok(resolved, spec);
      visit(resolved);
    }
  }
  visit(path.resolve('app/page.tsx'));
  assert.ok(!seen.has(path.resolve('components/Explorer.tsx')));
});

test('deferred scatter keeps all exact ordered coordinates and labels', () => {
  const points = require('../data/analysis-flow.json').points;
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/scatter.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, { exports, require: () => ({ points }) });
  assert.equal(exports.scatter.length, 2660);
  assert.equal(JSON.stringify(exports.scatter), JSON.stringify(points.map(p => ({ x: p[0], y: p[1], c: p[5] }))));
});

test('consensus redraw reuses exact ordered centroids for all 2660 points', () => {
  const points = require('../data/analysis-flow.json').points;
  const calculation = flow.slice(flow.indexOf('const centroids ='), flow.indexOf('const xs ='));
  const actual = vm.runInNewContext(calculation + '; centroids', { points });
  assert.equal(points.length, 2660);
  assert.equal(actual.length, 14);
  actual.forEach(([x, y], k) => {
    const subset = points.filter(p => p[5] === k);
    assert.equal(x, subset.reduce((a, p) => a + p[0], 0) / subset.length);
    assert.equal(y, subset.reduce((a, p) => a + p[1], 0) / subset.length);
  });
  assert.doesNotMatch(flow.slice(flow.indexOf('function draw()')), /points\.filter/);
});

test('partition and focus redraw without rebuilding WebGL scene', () => {
  assert.match(flow, /selection\.current = \{ partition, focus \}; redraw\.current\(\)/);
  assert.match(flow, /const \{ partition, focus \} = selection\.current/);
  assert.match(flow, /redraw\.current=requestDraw/);
  assert.match(flow, /dependencies:\[reduce\],revertOnUpdate:true/);
});
