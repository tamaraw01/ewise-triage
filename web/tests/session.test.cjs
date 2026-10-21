/* eslint-disable @typescript-eslint/no-require-imports -- plain node:test runner, no test deps */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const session = require('../lib/session.ts');
test('manual decisions require a note, preserve model evidence, and can be reverted', () => {
 const original = {status:'done',result:prediction(11)};
 assert.throws(() => session.reviewItem(original,'P2',' '));
 assert.throws(() => session.reviewItem(original,'BAD','checked'));
 const reviewed = session.reviewItem(original,'P2','Perangkat diperiksa');
 assert.equal(reviewed.result,original.result);
 assert.equal(session.summarize([reviewed]).lanes.P2,1);
 assert.equal(session.summarize([reviewed]).reviewed,1);
 assert.equal(original.review,undefined);
 assert.equal(session.summarize([{...reviewed,review:undefined}]).unresolved,1);
});
test('prediction keeps complete detached immutable JSON evidence', () => {
 const source = {...prediction(), model_version:'model-7', top_similarity:.8, runner_up:{id:2,label:null}, zero_shot:[{label:'Battery',similarity:.4}], disclaimer:'Research', extra:{flags:[true,null,3]}};
 source.cluster.purity = .9;
 const parsed = session.parsePrediction(source);
 assert.deepEqual(parsed, source);
 assert.notEqual(parsed, source);
 source.extra.flags[0] = false;
 assert.equal(parsed.extra.flags[0], true);
 assert.ok(Object.isFrozen(parsed.extra.flags));
});
test('prediction rejects unsafe or unbounded JSON evidence', () => {
 const cycle = {}; cycle.self = cycle;
 let deep = null; for (let i=0;i<18;i++) deep = {child:deep};
 const accessor = {}; Object.defineProperty(accessor, 'secret', {enumerable:true,get(){throw Error('getter must not run');}});
 for (const extra of [undefined, NaN, Infinity, 1n, ()=>{}, new Date(), cycle, deep, accessor, JSON.parse('{"__proto__":{"polluted":true}}'), Array(1001).fill(0), 'x'.repeat(session.MAX_PREDICTION_BYTES)]) {
  assert.throws(() => session.parsePrediction({...prediction(), extra}), /Respons backend tidak valid/);
 }
 assert.equal({}.polluted, undefined);
});
test('API proxy, client parser, record and reload retain complete backend evidence', async t => {
 const fs = require('node:fs');
 const filename = require('node:path').resolve(__dirname, '../app/api/predict/route.ts');
 const output = ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const loaded = {exports:{}};
 new Function('require','module','exports', output)(name => name === 'next/server' ? {NextResponse:{json: (body, init) => Response.json(body,init)}} : session, loaded, loaded.exports);
 const source = {...prediction(), model_version:'release-8', top_similarity:.81, runner_up:{id:2,label:null}, zero_shot:[{label:'Battery',similarity:.3}], disclaimer:'Research', cluster:{...prediction().cluster,n_images:42,purity:.98}, nested:{new_evidence:[false,null]}};
 const originalFetch = globalThis.fetch;
 t.after(() => { globalThis.fetch = originalFetch; });
 globalThis.fetch = async url => url.endsWith('/predict') ? Response.json({event_id:'test-event'}) : new Response('event: complete\ndata: '+JSON.stringify([source])+'\n\n');
 const request = new Request('http://localhost/api/predict', {method:'POST',body:JSON.stringify({data:[{url:'data:image/jpeg;base64,/9j/'}]})});
 const response = await loaded.exports.POST(request);
 assert.equal(response.status,200);
 const client = session.parsePrediction(await response.json());
 assert.deepEqual(client,source);
 const domain = require('../lib/demo-records.ts');
 const record = domain.createRecord(client,'a.jpg');
 assert.deepEqual(domain.parseStore(JSON.stringify({version:1,records:[record]})).records[0].inference,source);
});
test('upload validation rejects empty, oversized and unsupported files', () => {
 assert.equal(session.validateFile({size:1,type:'image/png'}),'');
 for(const file of [{size:0,type:'image/png'},{size:session.MAX_FILE_BYTES+1,type:'image/jpeg'},{size:5,type:'image/svg+xml'}]) assert.ok(session.validateFile(file));
});
test('prediction parser rejects malformed responses, keeps null review labels', () => {
 assert.deepEqual(session.parsePrediction(prediction(9,'review')),prediction(9,'review'));
 for(const data of [null,{},[],{...prediction(),margin:NaN},{...prediction(),cluster:null}]) assert.throws(()=>session.parsePrediction(data));
});
test('ranking accepts signed cosine scores and rejects malformed candidates', () => {
 const valid = {cluster:4,label:null,similarity:-.3};
 assert.equal(session.parsePrediction({...prediction(),ranking:[valid]}).ranking[0].similarity,-.3);
 for(const ranking of [null,{},[null],[{...valid,similarity:NaN}],[{...valid,similarity:1.1}],[{...valid,cluster:2.5}],[{...valid,label:5}]]) {
  assert.throws(()=>session.parsePrediction({...prediction(),ranking}));
 }
});
const prediction = (id = 4, status = 'classified') => ({ status, margin: .12, threshold: .0297, cluster: { id, label: 'Battery', contested: false, route: 'HAZARD', handling: 'Review physical item' } });
test('queue runs sequentially, isolates errors and stops before next upload', async () => {
 let active=0, peak=0; const states=[]; let stop=false;
 const rows=[0,1,2].map(id=>({id:String(id),file:{size:1,type:'image/png'},status:'queued'}));
 await session.runQueue(rows, async ()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--; if(states.filter(s=>s.status==='done').length===1) throw Error('backend down'); return prediction();},(id,patch)=>states.push({id,...patch}),()=>stop);
 assert.equal(peak,1); assert.equal(states.filter(s=>s.status==='done').length,1); assert.equal(states.filter(s=>s.status==='error').length,2);
 const cancelled=[];
 await session.runQueue(rows,async()=>{stop=true;return prediction();},(id,patch)=>cancelled.push({id,...patch}),()=>stop);
 assert.equal(cancelled.filter(s=>s.status==='done').length,1);
 assert.equal(cancelled.filter(s=>s.status==='cancelled').length,2);
});
test('C9 and C11 are forced to manual review regardless of margin', () => {
 for (const id of [9,11]) {
  for (const status of ['classified', 'review']) for (const margin of [0, .001, .5]) {
  const result = {...prediction(id, status), margin};
  assert.equal(session.automaticLane(result),'MR');
  assert.equal(session.manualReason(result), session.manualExplanation(id).body);
  }
 }
 assert.equal(session.manualReason(prediction(4)),'');
});
test('research subset figures derive from cluster metadata', () => {
 const r = session.researchSubset();
 assert.equal(r.total,2660); assert.equal(r.kept,2386);
 assert.equal(r.coverage.toFixed(3),'0.897'); assert.equal(r.accuracy.toFixed(3),'0.976'); assert.equal(r.purity.toFixed(3),'0.969');
});
test('live production review payload parses with null label and lands in MR', () => {
 const live = {"status":"review","margin":0.0172,"threshold":0.0297,"top_similarity":0.432,"cluster":{"id":12,"label":null,"route":"MANUAL_REVIEW","handling":"...","n_images":174,"purity":0.9368,"contested":false},"runner_up":{"id":13,"label":"Printer"},"ranking":[{"cluster":12,"label":"Television","similarity":0.432}],"zero_shot":[{"label":"Player","similarity":0.2}],"disclaimer":"..."};
 const parsed = session.parsePrediction(live);
 assert.equal(session.automaticLane(parsed),'MR');
 assert.equal(session.candidateLabel(parsed),'Television');
 assert.equal(session.automaticLane({...parsed,status:'classified'}),'MR');
 assert.deepEqual(session.summarize([{status:'done',result:parsed}]).lanes,{P1:0,P2:0,P3:0,MR:1});
});
test('composition counts only successful results and keeps review candidates out of automatic lanes', () => {
 const rows = [{status:'done', result:prediction()}, {status:'done', result:prediction(9)}, {status:'done', result:prediction(11)}, {status:'done',result:prediction(2,'review')}, {status:'error'}, {status:'queued'}];
 assert.deepEqual(session.summarize(rows), {success:4, failed:1, pending:1, reviewed:0, unresolved:3, lanes:{P1:1,P2:0,P3:0,MR:3}});
});
