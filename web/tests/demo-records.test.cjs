/* eslint-disable @typescript-eslint/no-require-imports -- plain node:test runner, no test deps */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const domain = require('../lib/demo-records.ts');
const prediction = () => ({ status: 'classified', margin: .12, threshold: .0297, cluster: { id: 4, label: 'Battery', contested: false, route: 'HAZARD', handling: 'Physical check' }, ranking: [{ cluster: 4, label: 'Battery', similarity: -.2 }] });
const input = { category: 'Baterai (ponsel/laptop)', lane: 'P1', note: 'Diperiksa fisik', status: 'done' };
const clone = value => JSON.parse(JSON.stringify(value));
const store = record => ({ version: 1, records: [record] });

test('new records hold complete detached frozen inference and no assumed review', () => {
  const p = prediction();
  p.photo = 'do not persist'; p.cluster.extra = 'backend extra';
  const r = domain.createRecord(p, 'battery.jpg');
  assert.equal(r.status, 'pending'); assert.deepEqual(r.reviews, []);
  assert.equal(r.provenance, 'backend version not supplied');
  assert.deepEqual(r.inference, p);
  p.cluster.label = 'Changed'; p.ranking[0].similarity = .9;
  assert.equal(r.inference.cluster.label, 'Battery');
  assert.equal(r.inference.ranking[0].similarity, -.2);
  assert.ok(Object.isFrozen(r.inference.cluster));
  assert.ok(Object.isFrozen(r.inference.ranking[0]));
  assert.equal(r.photo, undefined);
});
test('supplied model version survives persistence without fabrication', () => {
 for (const key of ['model_version', 'backend_version', 'version']) {
  const p = {...prediction(), [key]:'release-7', extra:{nested:[null,true]}};
  const r = domain.createRecord(p, 'a.jpg');
  assert.equal(r.provenance, 'release-7');
  assert.deepEqual(domain.parseStore(JSON.stringify(store(r))).records[0].inference, p);
 }
 assert.equal(domain.createRecord(prediction(), 'a.jpg').provenance, domain.PROVENANCE);
 const numeric = domain.createRecord({...prediction(), model_version:7}, 'a.jpg');
 assert.equal(numeric.provenance, 7);
 assert.deepEqual(domain.parseStore(JSON.stringify(store(numeric))).records[0], numeric);
});
test('review appends history, preserves original inference and prior records', () => {
  const r = domain.createRecord(prediction(), 'a.jpg');
  const first = domain.appendReview(r, input);
  const second = domain.appendReview(first, { ...input, category: domain.UNRESOLVED_CATEGORY, lane: 'MR', status: 'review', note: 'Periksa ulang' });
  assert.equal(r.reviews.length, 0); assert.equal(first.reviews.length, 1);
  assert.equal(second.reviews.length, 2); assert.deepEqual(second.reviews[0], first.reviews[0]);
  assert.equal(second.inference, r.inference);
  assert.equal(second.status, 'review');
  assert.equal(second.reviews[1].actor, 'Sesi demo (tanpa akun)');
  assert.notEqual(second.reviews[0].id, second.reviews[1].id);
  assert.throws(() => domain.appendReview(r, { ...input, lane: 'MR' }));
});
test('clock rollback preserves real timestamps and append order across reload', t => {
 const RealDate = Date;
 let now = '2026-10-19T12:00:00.000Z';
 t.after(() => { globalThis.Date = RealDate; });
 globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [now])); }
 };
 const r = domain.createRecord(prediction(), 'a.jpg');
 now = '2026-10-18T11:00:00.000Z';
 const first = domain.appendReview(r, input);
 now = '2026-10-17T10:00:00.000Z';
 const second = domain.appendReview(first, {...input, category:domain.UNRESOLVED_CATEGORY, lane:'MR', status:'review'});
 assert.deepEqual(second.reviews.map(r => r.at), ['2026-10-18T11:00:00.000Z', now]);
 const loaded = domain.parseStore(JSON.stringify(store(second))).records[0];
 assert.equal(loaded.createdAt, '2026-10-19T12:00:00.000Z');
 assert.equal(loaded.status, 'review');
 assert.deepEqual(loaded.reviews, second.reviews);
});
test('store round trip validates and freezes without modifying caller', () => {
  const raw = store(domain.appendReview(domain.createRecord(prediction(), 'a.jpg'), input));
  const parsed = domain.parseStore(JSON.stringify(raw));
  assert.deepEqual(parsed, raw); assert.ok(Object.isFrozen(parsed.records[0].reviews));
  const caller = clone(raw); domain.parseStore(caller);
  assert.equal(Object.isFrozen(caller), false);
});
test('malformed and unknown data fail closed without changing original', () => {
  const valid = store(domain.createRecord(prediction(), 'a.jpg'));
  const mutations = [
    s => { s.version = 2; }, s => { s.photo = 'bad'; }, s => { s.records = {}; },
    s => { s.records[0].id = 'bad'; }, s => { s.records[0].createdAt = '2026-02-30T00:00:00.000Z'; },
    s => { s.records[0].photo = 'data:image'; }, s => { s.records[0].provenance = 'model-v1'; },
    s => { s.records[0].status = 'done'; }, s => { s.records[0].inference.margin = null; },
    s => { s.records[0].inference.ranking[0].similarity = 2; },
    s => { s.records[0].inference.ranking = Array(101).fill(prediction().ranking[0]); },
    s => { s.records.push(clone(s.records[0])); },
  ];
  for (const mutate of mutations) {
    const bad = clone(valid); mutate(bad); const before = clone(bad);
    assert.throws(() => domain.parseStore(bad)); assert.deepEqual(bad, before);
  }
  for (const raw of [null, [], {}, '', '{', 'null']) assert.throws(() => domain.parseStore(raw));
});
test('review validation rejects forged actor, time, status, ids and fields', () => {
  const valid = store(domain.appendReview(domain.createRecord(prediction(), 'a.jpg'), input));
  for (const patch of [{ actor: 'Admin' }, { at: 'yesterday' }, { id: 'x' }, { lane: 'MR' }, { category: '' }, { note: '' }, { status: 'pending' }, { extra: true }]) {
    const bad = clone(valid); Object.assign(bad.records[0].reviews[0], patch);
    assert.throws(() => domain.parseStore(bad));
  }
  const bad = clone(valid); bad.records[0].reviews.push(clone(bad.records[0].reviews[0]));
  assert.throws(() => domain.parseStore(bad));
  for (const patch of [{ lane: 'P4' }, { note: ' ' }, { category: ' ' }, { actor: 'Admin' }, { inference: prediction() }]) {
    assert.throws(() => domain.appendReview(valid.records[0], { ...input, ...patch }));
  }
});
test('record, review and string bounds accept ceiling and reject overflow', () => {
  assert.doesNotThrow(() => domain.createRecord(prediction(), 'x'.repeat(255)));
  for (const name of ['', ' ', 'x'.repeat(256)]) assert.throws(() => domain.createRecord(prediction(), name));
  let r = domain.createRecord(prediction(), 'a.jpg');
  assert.doesNotThrow(() => domain.appendReview(r, { ...input, note: 'x'.repeat(2000) }));
  for (const patch of [{ category: 'x'.repeat(201) }, { note: 'x'.repeat(2001) }]) assert.throws(() => domain.appendReview(r, { ...input, ...patch }));
  for (let i = 0; i < 100; i++) r = domain.appendReview(r, input);
  assert.equal(r.reviews.length, 100); assert.throws(() => domain.appendReview(r, input));
  const bad = clone(store(r)); bad.records[0].reviews.push(clone(r.reviews[0]));
  assert.throws(() => domain.parseStore(bad));
  const full = { version: 1, records: Array.from({ length: 100 }, () => domain.createRecord(prediction(), 'a.jpg')) };
  assert.equal(domain.parseStore(full).records.length, 100);
  full.records.push(domain.createRecord(prediction(), 'a.jpg'));
  assert.throws(() => domain.parseStore(full));
});


test('categories follow canonical lane taxonomy, with all choices and unresolved in MR', () => {
 const {CLUSTERS_META}=require('../lib/data.ts');
 for (const lane of ['P1','P2','P3']) {
  assert.deepEqual(domain.categoriesForLane(lane), [...new Set(Object.values(CLUSTERS_META).filter(c=>c.lane===lane).map(c=>c.sub))]);
 }
 assert.deepEqual(domain.categoriesForLane('MR'), [domain.UNRESOLVED_CATEGORY,...new Set(Object.values(CLUSTERS_META).filter(c=>c.lane==='MR').map(c=>c.sub))]);
});
test('new category/lane pairs validated, old free text retained and correction appendable', () => {
 const r=domain.createRecord(prediction(),'legacy.jpg');
 for (const patch of [{category:'magic com'}, {lane:'P2'}, {category:domain.UNRESOLVED_CATEGORY}]) {
  assert.throws(()=>domain.appendReview(r,{...input,...patch}),/kategori/);
 }
 assert.doesNotThrow(()=>domain.appendReview(r,{...input,lane:'MR',status:'review',category:domain.UNRESOLVED_CATEGORY}));
 const legacy=clone(domain.appendReview(r,input));
 legacy.reviews[0].category='magic com';
 const loaded=domain.parseStore(store(legacy)).records[0];
 assert.equal(loaded.reviews[0].category,'magic com');
 const corrected=domain.appendReview(loaded,input);
 assert.equal(corrected.reviews[0].category,'magic com');
 assert.deepEqual(corrected.inference,loaded.inference);
});
