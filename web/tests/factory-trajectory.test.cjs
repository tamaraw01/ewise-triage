/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../components/MotionPreview.tsx'), 'utf8');
const helper = source.slice(source.indexOf('const ITEM_SECONDS'), source.indexOf('export function FactoryLoop'));
const { itemPose } = new Function('exports', ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText + '; return exports;')({});
test('28-second overlapping belt feed, supported routing, retained bins, concealed exchange', () => {
  let samples = 0;
  for (const z of [-3.9, -1.3, 1.3, 3.9]) for (let i = 0; i < 8; i++) {
    let previous = itemPose(0, i, z);
    for (let step = 1; step <= 2800; step++) {
      const t = step / 100, p = itemPose(t, i, z);
      const jump = Math.hypot(p.x - previous.x, p.y - previous.y, p.z - previous.z);
      assert(jump < 0.07 || t === 24, `exposed discontinuity: ${t}, ${i}, ${jump}`);
      if (p.age < 11.2) assert.equal(p.y, -0.05);
      if (p.age >= 7.7 && p.age < 11.2) assert.equal(p.z, z);
      if (p.age >= 12) { assert(p.x >= 9.3 && p.x <= 11.5); assert(Math.abs(p.z-z) < 0.9); assert(p.y < 0); }
      previous = p; samples++;
    }
    assert.deepEqual(itemPose(0, i, z), itemPose(28, i, z));
    const start = itemPose(0, i, z);
    assert(start.x >= -14.75 && start.x <= -8.8); assert.equal(start.z, 0);
  }
  assert.equal(samples, 89600);
  const flow = Array.from({length:8}, (_,i)=>itemPose(8,i,1.3));
  assert(flow.filter(p=>p.age>=0 && p.age<12).length >= 6);
  for(let i=1;i<flow.length;i++) assert(Math.hypot(flow[i].x-flow[i-1].x,flow[i].z-flow[i-1].z) >= 0.84);
  assert.doesNotMatch(source, /loaderHead|loaderCup|const sorter|scale\.setScalar\(Math|opacity\s*=/);
  assert.match(source, /slat\.position\.z/);
  assert.match(source, /time \+= last \? Math\.max\(0, \(now - last\) \/ 1000\)/); // slow GPU must not stretch cycle wall time
  assert.doesNotMatch(source, /Math\.min\(\(now - last\)/);
  assert.match(source, /const spread = close - reopen/); // reset t=24 under full closure t=24..25
  const received = Array.from({length:6}, (_,slot)=>itemPose(21,0,1.3,slot));
  assert.equal(new Set(received.map(p=>`${p.x},${p.z}`)).size, 6);
  assert(received.every(p=>p.x>9 && p.x<12 && p.z>0.2 && p.z<2.4));
  assert.match(source, /const slot = trays\.slice\(0, index\)\.filter\(item => item\.lane === lane\)\.length/);
});
