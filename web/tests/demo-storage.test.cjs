/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(require('node:fs').readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,f);
const {mutateStore,KEY}=require('../lib/demo-storage.ts');
const {createRecord,deleteRecord,appendReview,parseStore}=require('../lib/demo-records.ts');
const p={status:'classified',margin:.1,threshold:.03,cluster:{id:4,label:'Battery',contested:false,route:'HAZARD',handling:'Check'}};
const values=new Map();
global.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
let tail=Promise.resolve();
Object.defineProperty(global,'navigator',{configurable:true,value:{locks:{request:(_n,fn)=>{const next=tail.then(fn);tail=next.catch(()=>{});return next;}}}});
test('simultaneous writes retain both records; stale mutation never overwrites',async()=>{
 values.clear(); const a=createRecord(p,'a.jpg'),b=createRecord(p,'b.jpg');
 await Promise.all([mutateStore(rows=>[a,...rows]),mutateStore(rows=>[b,...rows])]);
 assert.equal(JSON.parse(values.get(KEY)).records.length,2);
 const before=values.get(KEY);
 await assert.rejects(mutateStore(()=>{throw Error('conflict');}),/conflict/);
 assert.equal(values.get(KEY),before);
});
test('locked deletion preserves unrelated writes and rejects stale or absent target',async()=>{
 values.clear();
 const a=createRecord(p,'delete.jpg'),b=createRecord(p,'keep.jpg'),c=createRecord(p,'concurrent.jpg');
 await mutateStore(()=>[a,b]);
 await Promise.all([mutateStore(rows=>[c,...rows]),mutateStore(rows=>deleteRecord(rows,a))]);
 assert.deepEqual(parseStore(values.get(KEY)).records,[c,b]);
 const before=values.get(KEY);
 await assert.rejects(mutateStore(rows=>deleteRecord(rows,a)),/berubah/);
 assert.equal(values.get(KEY),before);
 await mutateStore(rows=>rows.map(r=>r.id===b.id?appendReview(r,{category:'Baterai (ponsel/laptop)',lane:'P1',status:'done',note:'Checked'}):r));
 const reviewed=values.get(KEY);
 await assert.rejects(mutateStore(rows=>deleteRecord(rows,b)),/berubah/);
 assert.equal(values.get(KEY),reviewed);
});
test('300 records persist; 301st write is rejected without data loss',async()=>{
 values.clear(); const rows=Array.from({length:300},(_,i)=>createRecord(p,`fixture-${i}.jpg`));
 await mutateStore(()=>rows); const before=values.get(KEY);
 assert.equal(parseStore(before).records.length,300);
 await assert.rejects(mutateStore(old=>[createRecord(p,'fixture-301.jpg'),...old]),/tidak valid/);
 assert.equal(values.get(KEY),before);
});
test('unsupported locking and quota errors preserve original data',async()=>{
 const before=values.get(KEY),locks=navigator.locks;
 navigator.locks=undefined;await assert.rejects(mutateStore(rows=>rows),/browser/i);navigator.locks=locks;
 const set=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota');};
 await assert.rejects(mutateStore(rows=>rows),/quota/);localStorage.setItem=set;
 assert.equal(values.get(KEY),before);
});
