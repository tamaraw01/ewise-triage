/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../components/MotionPreview.tsx'), 'utf8');

test('single loop uses exactly two outputs with non-PCB meshes', () => {
  const codes = new Function('single', 'CLUSTERS_META', 'laneCodes', 'return ' + source.match(/const outputCodes: LaneCode\[\] = ([^;]+);/)[1])(true, { 3: { lane: 'P2' } }, []);
  assert.deepEqual(codes, ['P2', 'MR']);
  const ids = JSON.parse(source.match(/single \? (\[[\d, ]+\]) : mixedIds/)[1]);
  assert.deepEqual(ids, [3, 3, 4, 3, 0, 3, 1, 3]);
  const route = new Function('single', 'id', 'CLUSTERS_META', 'const review = ' + source.match(/const review = ([^;]+);/)[1] + '; return ' + source.match(/lane: (review[^}]+)/)[1].replace(' as LaneCode', '') + ';');
  assert.deepEqual(ids.map(id => route(true, id, { 3: { lane: 'P2' } })), ['P2', 'P2', 'MR', 'P2', 'MR', 'P2', 'MR', 'P2']);
  assert.match(source, /"Selain PCB" : "C3 · PCB"/);
  const code = ts.transpileModule(source.slice(source.indexOf('function device(id:'), source.indexOf('    const ids =')), {}).outputText;
  class Group { constructor() { this.children = []; } }
  const add = (parent, ...args) => parent.children.push(args);
  const device = new Function('THREE', 'box', 'cylinder', 'green', 'black', 'sage', 'amber', 'steel', 'bone', 'iron', code + '; return device;')({ Group }, add, add, 'green', 'black', 'sage', 'amber', 'steel', 'bone', 'iron');
  assert(device(3).children.some(mesh => mesh.includes('green')));
  for (const id of [0, 1, 4]) {
    assert(device(id).children.length > 1);
    assert(!device(id).children.some(mesh => mesh.includes('green')), `C${id} must not reuse PCB mesh`);
  }
});

test('main Implementation renders approved loops and shared pause control', () => {
  const implementation = fs.readFileSync(path.join(__dirname, '../components/Implementation.tsx'), 'utf8');
  let paused = false;
  const exports = {};
  const node = (type, props) => ({ type, props });
  const code = ts.transpileModule(implementation, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'exports', code)(id => id === 'react' ? { useState: () => [paused, value => { paused = value; }] } : id === 'react/jsx-runtime' ? { jsx: node, jsxs: node } : { FactoryLoop: 'FactoryLoop' }, exports);
  const flatten = n => n && typeof n === 'object' ? [n, ...[n.props?.children].flat(Infinity).flatMap(flatten)] : [];
  let nodes = flatten(exports.default());
  assert.deepEqual(nodes.filter(n => n.type === 'FactoryLoop').map(n => n.props), [{ single: false, paused: false }, { single: true, paused: false }]);
  assert(nodes.some(n => n.props?.id === 'impl-title'));
  assert(!nodes.some(n => ['main', 'footer'].includes(n.type)));
  nodes.find(n => n.type === 'button').props.onClick();
  nodes = flatten(exports.default());
  assert(nodes.filter(n => n.type === 'FactoryLoop').every(n => n.props.paused));
  const page = fs.readFileSync(path.join(__dirname, '../app/page.tsx'), 'utf8');
  assert.match(page, /id="panel-4"[^\n]+<Implementation \/>/);
});
