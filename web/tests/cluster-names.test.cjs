/* eslint-disable @typescript-eslint/no-require-imports -- plain node:test runner */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

test('all 14 approved cluster display names remain exact', () => {
  const source = fs.readFileSync('lib/data.ts', 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  const clusters = Object.values(exports.CLUSTERS_META);
  assert.deepEqual(Array.from(clusters, c => c.sub), [
    'Keyboard', 'Mobile (Ponsel & tablet)', 'Washing Machine (Front Loader)',
    'PCB (Papan sirkuit)', 'Battery (Li-ion ponsel/laptop)', 'Washing Machine (Top Loader)',
    'Microwave', 'Mouse', 'Television (layar datar)', 'Mobile (Perangkat campuran)',
    'Battery (silinder dan aki)', 'Mobile (Music Player)', 'Television (TV tabung/CRT)', 'Printer',
  ]);
  assert.equal(exports.CLUSTERS_META[9].lane, 'MR');
  assert.equal(exports.CLUSTERS_META[11].lane, 'MR');
});
