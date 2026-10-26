/* eslint-disable @typescript-eslint/no-require-imports -- Node regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const motion = fs.readFileSync('components/MotionPreview.tsx', 'utf8');
const flow = fs.readFileSync('components/AnalysisFlow.tsx', 'utf8');

test('visited tabs stay mounted, while cold tabs do not mount scenes', () => {
  assert.match(page, /useState<Section\[\]>\(\["Konsol"\]\)/);
  for (const name of ['Cluster Explorer', 'Statistik', 'Proses', 'Implementasi']) {
    assert.ok(page.includes(`opened.includes("${name}")`));
  }
  assert.match(page, /onPointerEnter=.*warmTab/);
  assert.match(page, /onFocus=.*warmTab/);
  assert.match(page, /<Implementation active=\{section === "Implementasi"\}/);
  assert.match(page, /<AnalysisFlow active=\{section === "Proses"\}/);
});

test('equal primitive dimensions share geometry without changing vertices or UVs', () => {
  const ts = require('typescript');
  const THREE = require('three');
  const source = motion.slice(motion.indexOf('const geometries ='), motion.indexOf('const textures:'));
  const helpers = new Function('THREE', ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ';return {box,cylinder};')(THREE);
  const group = new THREE.Group(), material = new THREE.MeshBasicMaterial();
  const a = helpers.box(group, 1, 2, 3, material), b = helpers.box(group, 1, 2, 3, material);
  assert.equal(a.geometry, b.geometry);
  assert.notEqual(a.geometry, helpers.box(group, 1, 2, 4, material).geometry);
  const c = helpers.cylinder(group, .2, 1, material, 0, 0, 0);
  assert.equal(c.geometry, helpers.cylinder(group, .2, 1, material, 2, 3, 4, true).geometry);
  for (const [geometry, expected] of [[a.geometry, new THREE.BoxGeometry(1,2,3)], [c.geometry, new THREE.CylinderGeometry(.2,.2,1,16)]]) {
    for (const attribute of ['position','normal','uv']) assert.deepEqual(geometry.attributes[attribute].array, expected.attributes[attribute].array);
    assert.deepEqual(geometry.index.array, expected.index.array);
  }
});

test('retained scenes gate rendering and avoid hidden zero-size camera updates', () => {
  assert.match(motion, /if \(!w \|\| !h\) return/);
  assert.match(motion, /enabled\.current && visible && !document.hidden && !lost/);
  assert.match(motion, /if \(!enabled\.current \|\| document.hidden \|\| !el.clientWidth \|\| !el.clientHeight \|\| lost\) return/);
  assert.match(flow, /if\(!enabled.current\|\|document.hidden\)return/);
  assert.match(flow, /if\(!W\|\|!H\)return/);
});
