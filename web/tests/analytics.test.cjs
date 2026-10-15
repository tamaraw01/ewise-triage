/* eslint-disable @typescript-eslint/no-require-imports -- plain node:test runner, no test deps */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'web/data/analytics.json'), 'utf8'));
const sum = xs => xs.reduce((a, b) => a + b, 0);
const close = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('typed schema, finite values, complete Electronic population', () => {
  assert.equal(data.schemaVersion, 1);
  const walk = x => {
    if (typeof x === 'number') assert.ok(Number.isFinite(x));
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  walk(data);
  assert.deepEqual([data.population.total, data.population.kept, data.population.excluded], [3961, 2660, 1301]);
  assert.equal(data.classDistribution.length, 10);
  assert.deepEqual(data.classDistribution.map(r => r.count), [220, 258, 259, 291, 265, 230, 258, 279, 300, 300]);
  assert.equal(sum(data.classDistribution.map(r => r.count)), 2660);
  for (const status of ['kept', 'excluded']) {
    const group = data.imageAudit[status];
    assert.equal(sum(group.longSideBins.map(r => r.count)), group.count);
    assert.equal(sum(Object.values(group.formats)), group.count);
  }
  assert.equal(data.imageAudit.readErrors.length, 0);
});

test('confusion, full cross-tab, precision and weighted metrics reconcile', () => {
  const cm = data.evaluation.confusion.values;
  const cross = data.clusterAudit.crossTab.values;
  assert.equal(cm.length, 10);
  assert.equal(cross.length, 14);
  assert.equal(sum(cm.flat()), 2660);
  assert.equal(sum(cross.flat()), 2660);
  const diagonal = sum(cm.map((row, i) => row[i]));
  close(data.evaluation.accuracy, diagonal / 2660);
  close(data.evaluation.purity, sum(cross.map(row => Math.max(...row))) / 2660);
  cm.forEach((row, i) => {
    assert.equal(row.length, 10);
    assert.equal(sum(row), data.classDistribution[i].count);
    assert.equal(sum(cross.map(row => row[i])), sum(row));
  });
  data.clusterAudit.clusters.forEach((cluster, i) => {
    assert.equal(sum(cross[i]), cluster.count);
    close(cluster.purity, Math.max(...cross[i]) / cluster.count);
    const scores = Object.values(cluster.promptSimilarities).sort((a, b) => b - a);
    close(cluster.namingMargin, scores[0] - scores[1]);
  });
  const triage = data.evaluation.triageIllustration;
  assert.deepEqual(triage.reviewClusterIds, [9, 11]);
  assert.equal(triage.acceptedCount + triage.reviewCount, 2660);
  assert.equal(triage.reviewCount, 274);
  assert.match(triage.marginType, /NOT image-centroid/);
});

test('saved bootstrap 50 replicates; sample SD recomputed, no synthetic values', () => {
  assert.equal(data.bootstrap.source, 'saved-bootstrap-artifact');
  assert.equal(data.bootstrap.rows.length, 50);
  for (const method of ['ensemble', 'kmeans', 'ward', 'gmm']) {
    const values = data.bootstrap.rows.map(row => row[`ARI_${method}`]);
    const mean = sum(values) / values.length;
    close(data.bootstrap.summary[method].mean, mean);
    close(data.bootstrap.summary[method].stdSample, Math.sqrt(sum(values.map(x => (x - mean) ** 2)) / 49));
    assert.ok(values.every(x => x >= -1 && x <= 1));
  }
  close(data.bootstrap.summary.ensemble.mean, 0.9417276819219624);
  assert.notEqual(data.bootstrap.summary.gmm.mean, data.paperReported.standaloneComparison[3].bootstrapMean);
});

test('selection extrema, sources and evidence hashes intact', () => {
  const rows = data.selection.baseCurves;
  assert.equal(rows.length, 24);
  assert.equal(rows.reduce((a, b) => a.silhouette_kmeans > b.silhouette_kmeans ? a : b).K, 9);
  assert.equal(rows.reduce((a, b) => a.silhouette_ward > b.silhouette_ward ? a : b).K, 9);
  assert.equal(rows.reduce((a, b) => a.bic_gmm < b.bic_gmm ? a : b).K, 14);
  assert.equal(data.selection.consensusCurves.reduce((a, b) => a.silhouetteCoassociation > b.silhouetteCoassociation ? a : b).k, 14);
  for (const [file, hash] of Object.entries(data.provenance.artifactHashes)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'research/artifacts', file))).digest('hex');
    assert.equal(actual, hash, file);
  }
  assert.equal(data.paperReported.source, 'paper-reported');
  assert.equal(data.evaluation.source, 'artifact-computed');
});
