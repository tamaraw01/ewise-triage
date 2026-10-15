/* eslint-disable @typescript-eslint/no-require-imports -- plain node:test runner, no test deps */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../components/ResearchDashboard.tsx');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
const dashboard = new Module(filename, module);
dashboard.filename = filename;
dashboard.paths = Module._nodeModulePaths(path.dirname(filename));
dashboard._compile(compiled, filename);
const { descriptive, dominant, orderedClusters, clusterCSV, exactPurity, metricValue } = dashboard.exports;
const clusters = require('../data/clusters.json');
const analytics = require('../data/analytics.json');

test('descriptive cluster counts use exact dominant counts, not rounded purity', () => {
  const stats = descriptive(clusters);
  assert.equal(stats.total, 2660);
  assert.equal(stats.dominantCount, 2578);
  assert.equal(stats.min, 31);
  assert.equal(stats.max, 286);
  assert.ok(Math.abs(stats.mean - 190) < 1e-10);
  const sorted = clusters.map(c => c.n_images).sort((a, b) => a - b);
  assert.equal(stats.median, (sorted[6] + sorted[7]) / 2);
  assert.match(source, /"Median", number\(stats\.median, 1\)/);
  assert.equal(dominant(clusters.find(c => c.id === 11))[1], 242);
  assert.ok(dominant(clusters.find(c => c.id === 9))[1] / clusters.find(c => c.id === 9).n_images < 0.5);
});

test('purity bar value equals table value from full cross-tab for C9 and C11', () => {
  const audit = Object.fromEntries(analytics.clusterAudit.clusters.map(c => [c.id, c]));
  for (const id of [9, 11]) {
    const c = clusters.find(x => x.id === id);
    assert.equal(metricValue(c, 'purity'), exactPurity(c));
    assert.ok(Math.abs(exactPurity(c) - audit[id].purity) < 1e-12);
  }
  assert.equal(dominant(clusters.find(c => c.id === 11))[0], 'Player');
});

test('metric sorting and CSV retain every cluster without changing input', () => {
  const original = clusters.map(c => c.id);
  for (const metric of ['n_images', 'purity', 'margin']) {
    for (const ascending of [true, false]) {
      const rows = orderedClusters(metric, ascending);
      assert.equal(rows.length, 14);
      const value = row => metricValue(row, metric);
      assert.ok(rows.every((row, i) => i === 0 || (value(row) - value(rows[i - 1])) * (ascending ? 1 : -1) >= 0));
      const csv = clusterCSV(rows).split('\r\n');
      assert.equal(csv.length, 15);
      assert.match(csv[0], /dominant_count,purity_exact,naming_margin/);
    }
  }
  assert.deepEqual(clusters.map(c => c.id), original);
});

test('bootstrap card and plot both show mean ARI', () => {
  assert.match(source, /Rata-rata ARI Ensemble/);
  assert.match(source, /number\(s\.mean, 4\)/);
  assert.doesNotMatch(source, /\bs\.median/);
  const mean = analytics.bootstrap.rows.reduce((sum, row) => sum + row.ARI_ensemble, 0) / analytics.bootstrap.rows.length;
  assert.ok(Math.abs(mean - analytics.bootstrap.summary.ensemble.mean) < 1e-12);
  assert.equal(mean.toFixed(4), '0.9417');
});

test('complete analytics denominators reconcile independently of truncated truth_mix', () => {
  assert.equal(analytics.classDistribution.reduce((s, c) => s + c.count, 0), 2660);
  assert.equal(analytics.evaluation.confusion.values.flat().reduce((s, n) => s + n, 0), 2660);
  assert.equal(analytics.imageAudit.kept.longSideBins.reduce((s, b) => s + b.count, 0), 2660);
  assert.equal(analytics.imageAudit.excluded.longSideBins.reduce((s, b) => s + b.count, 0), 1301);
  assert.equal(analytics.bootstrap.replicates, 50);
  assert.match(source, /<details/);
  assert.match(source, /bukan probabilitas/);
  assert.equal(analytics.evaluation.triageIllustration.reviewCount + analytics.evaluation.triageIllustration.acceptedCount, 2660);
  assert.equal(analytics.clusterAudit.crossTab.values.length, 14);
  assert.ok(analytics.clusterAudit.crossTab.values.every(r => r.length === 10));
  assert.equal(analytics.clusterAudit.crossTab.values.flat().reduce((s, n) => s + n, 0), 2660);
  assert.equal(analytics.classDistribution.find(c => c.label === 'Player').f1, 0);
  assert.doesNotMatch(source, /file:\/\/|\/home\/|CMRE/);
});
