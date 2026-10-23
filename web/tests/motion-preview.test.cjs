/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

test('motion examples use canonical reference lanes, never a second mapping', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/MotionPreview.tsx'), 'utf8');
  const data = fs.readFileSync(path.join(__dirname, '../lib/data.ts'), 'utf8');
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(data, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(() => ({ default: { points: [] } }), compiled, compiled.exports);
  const ids = JSON.parse(source.match(/const mixedIds = (\[[^;]+\])/)[1]);
  assert.deepEqual(ids.map(id => compiled.exports.CLUSTERS_META[id].lane), ['P2', 'P1', 'P3', 'P2', 'MR', 'P3', 'P1', 'P3']);
  assert.match(source, /CLUSTERS_META\[id\]\.lane/);
  const singleIds = JSON.parse(source.match(/single \? (\[[\d, ]+\]) : mixedIds/)[1]);
  assert(singleIds.includes(3));
  assert(singleIds.some(id => id !== 3));
  assert.match(source, /single && id !== 3/);
  assert.match(source, /outputCodes.forEach/);
  assert.match(source, /review \? "MR"/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /!document\.hidden/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /renderer\.forceContextLoss\(\)/);
});
