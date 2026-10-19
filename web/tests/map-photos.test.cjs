/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const hash = value => createHash('sha256').update(value).digest('hex');
test('all map photos retain exact CSV row coordinates, assignments, filenames and verified derivative bytes', () => {
  const data = require('../data/map-photos.json');
  const flow = require('../data/analysis-flow.json');
  const csv = fs.readFileSync(path.join(root, 'research/artifacts/cluster_results_final.csv'), 'utf8');
  const [header, ...lines] = csv.trim().split(/\r?\n/).map(line => line.split(','));
  const rows = lines.map(cells => Object.fromEntries(header.map((name, i) => [name, cells[i]])));
  assert.equal(data.population, 2660);
  assert.equal(data.photos.length, rows.length);
  assert.equal(new Set(data.photos.map(p => p.filename)).size, 2660);
  assert.equal(data.sourceSha256, hash(csv));
  assert.equal(data.manifestSha256, hash(fs.readFileSync(path.join(root, 'research/image_manifest.csv'))));
  data.photos.forEach((photo, i) => {
    const row = rows[i];
    assert.equal(photo.filename, row.filename);
    assert.equal(photo.label, row.label_asli);
    assert.deepEqual([+row.umap_x, +row.umap_y, +row.cluster], [flow.points[i][0], flow.points[i][1], flow.points[i][5]]);
    assert.equal(photo.src, `/map-photos/${i}.webp`);
    assert.equal(photo.thumbnailSha256, hash(fs.readFileSync(path.join(root, 'web/public', photo.src))));
    assert.ok(photo.width > 0 && photo.height > 0 && photo.width <= 480 && photo.height <= 480);
  });
});
