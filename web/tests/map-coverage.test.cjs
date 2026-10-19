/* eslint-disable @typescript-eslint/no-require-imports -- Native Node regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const layout = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/map-layout.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, { exports: layout });

test('viewport keeps every overlapping identity, edges, and original coordinates without cap', () => {
  const marks = Array.from({ length: 2660 }, (_, index) => ({ index, x: 90, y: 90 }));
  assert.equal(layout.viewportPhotos(marks, 390, 360).length, 2660);
  assert.equal(layout.viewportPhotos(marks, 390, 360)[2659], marks[2659]);
  const edges = [-33, -32, 0, 390, 422, 423].map((x, index) => ({ index, x, y: 0 }));
  assert.deepEqual(Array.from(layout.viewportPhotos(edges, 390, 360), p => p.index), [1, 2, 3, 4]);
});

test('filenames appear only when separated, inside viewport, and clear of other points', () => {
  const marks = [{index:0,x:20,y:30},{index:1,x:25,y:30}];
  assert.equal(layout.filenameLabels(marks,400,200,()=>100).length,0);
  marks[1].x=220;
  assert.equal(layout.filenameLabels(marks,400,200,()=>100).length,2);
  assert.equal(layout.filenameLabels([{index:0,x:380,y:30}],400,200,()=>100).length,0);
  assert.equal(layout.filenameLabels([{index:0,x:20,y:30},{index:1,x:80,y:30}],400,200,()=>100).length,0);
});

test('all actual cluster IDs get non-overlapping on-screen overview labels on desktop and mobile', () => {
  const data = require('../data/analysis-flow.json');
  const ids = [...new Set(data.points.map(p => p[5]))].sort((a, b) => a - b);
  for (const width of [288, 358, 1200]) {
    const labels = layout.overviewLabels(ids.map(index => ({ index, x: width / 2, y: 180 })), width, 360);
    assert.deepEqual(Array.from(labels, p => p.index), ids);
    for (const p of labels) {
      assert.ok(p.x >= 22 && p.x <= width - 22 && p.y >= 22 && p.y <= 338);
      for (const q of labels) if (q.index !== p.index) assert.ok(Math.abs(p.x - q.x) >= 50 || Math.abs(p.y - q.y) >= 50);
    }
  }
});

test('atlas covers all exact manifest identities once, with 42 bounded pages and existing source files', () => {
  const atlas = require('../data/map-atlas.json');
  const photos = require('../data/map-photos.json').photos;
  assert.equal(atlas.entries.length, photos.length);
  assert.equal(photos.length, 2660);
  assert.equal(new Set(atlas.entries.map(p => p.join(':'))).size, 2660);
  assert.equal(atlas.pages.length, 42);
  atlas.entries.forEach(([page, x, y], i) => {
    assert.ok(page >= 0 && page < atlas.pages.length);
    assert.ok(x % 64 === 0 && y % 64 === 0 && x <= 448 && y <= 448);
    assert.ok(fs.existsSync(require('node:path').join(__dirname, '../public', photos[i].src)));
    assert.ok(fs.existsSync(require('node:path').join(__dirname, '../public', atlas.pages[page])));
  });
});
