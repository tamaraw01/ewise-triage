/* eslint-disable @typescript-eslint/no-require-imports -- node:test, no test deps */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const gallery = require('../data/gallery.json');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readCSV = file => {
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  return lines.map(line => Object.fromEntries(line.split(',').map((value, i) => [head.split(',')[i], value])));
};
const source = path.join(root, 'research/artifacts/cluster_results_final.csv');
const manifestPath = path.join(root, 'research/image_manifest.csv');
const rows = readCSV(source);
const manifest = Object.fromEntries(readCSV(manifestPath).map(row => [row.filename, row]));

test('gallery reconciles all 2,660 final assignments and complete cross-tabs', () => {
  assert.equal(rows.length, 2660);
  assert.equal(gallery.population, rows.length);
  assert.equal(gallery.sourceSha256, sha(fs.readFileSync(source)));
  assert.equal(gallery.manifestSha256, sha(fs.readFileSync(manifestPath)));
  assert.equal(gallery.license, 'CC0: Public Domain');
  assert.equal(gallery.clusters.length, 14);
  for (const row of rows) {
    assert.equal(manifest[row.filename].status, 'kept');
    assert.equal(manifest[row.filename].label, row.label_asli);
  }
  for (const cluster of gallery.clusters) {
    const members = rows.filter(row => +row.cluster === cluster.id);
    const mix = {};
    for (const row of members) mix[row.label_asli] = (mix[row.label_asli] || 0) + 1;
    assert.equal(cluster.count, members.length);
    assert.deepEqual(cluster.mix, mix);
    assert.equal(cluster.systemLabel, members[0].label_zeroshot);
  }
  assert.equal(Object.keys(gallery.clusters[9].mix).length, 9);
  assert.deepEqual(gallery.clusters[11].mix, { Microwave: 1, Player: 242 });
  assert.equal(gallery.clusters[11].systemLabel, 'Mobile');
});

test('all 168 sampled members match manifests and original cluster, cover every label', () => {
  let count = 0;
  for (const cluster of gallery.clusters) {
    const chunk = JSON.parse(fs.readFileSync(path.join(root, `web/public/gallery/C${cluster.id}.json`)));
    assert.equal(chunk.id, cluster.id);
    assert.equal(chunk.examples.length, 12);
    assert.equal(new Set(chunk.examples.map(item => item.filename)).size, 12);
    assert.deepEqual([...new Set(chunk.examples.map(item => item.label))].sort(), Object.keys(cluster.mix).sort());
    for (const item of chunk.examples) {
      const row = rows.find(row => row.filename === item.filename);
      assert.equal(+row.cluster, cluster.id);
      assert.equal(row.label_asli, item.label);
      assert.equal(item.sourceSha256, manifest[item.filename].sha256);
      assert.ok(item.width > 0 && item.width <= 150 && item.height > 0 && item.height <= 150);
      const original = manifest[item.filename];
      assert.ok(Math.abs(item.width / item.height - +original.width / +original.height) < 0.02);
      assert.match(item.src, /^\/gallery\/[A-Za-z0-9_-]+\.webp$/);
      const bytes = fs.readFileSync(path.join(root, 'web/public', item.src));
      assert.equal(sha(bytes), item.thumbnailSha256);
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      count++;
    }
  }
  assert.equal(count, 168);
});

test('component retains selected-cluster-only fetch and honest states', () => {
  const source = fs.readFileSync(path.join(root, 'web/components/ClusterGallery.tsx'), 'utf8');
  assert.match(source, /fetch\(`\/gallery\/C\$\{selected\}\.json`/);
  assert.match(source, /<Members key=\{selected\}/);
  assert.match(source, /loading="lazy"/);
  assert.match(source, /object-fit:contain/);
  assert.match(source, /onError=/);
  assert.match(source, /Contoh anggota kelompok/);
  assert.match(source, /Belum ada contoh foto/);
  assert.match(source, /AbortController/);
});
