/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(require('node:fs').readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,f);
const {mutateStore,KEY}=require('../lib/demo-storage.ts');
const {createRecord}=require('../lib/demo-records.ts');
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
test('unsupported locking and quota errors preserve original data',async()=>{
 const before=values.get(KEY),locks=navigator.locks;
 navigator.locks=undefined;await assert.rejects(mutateStore(rows=>rows),/browser/i);navigator.locks=locks;
 const set=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota');};
 await assert.rejects(mutateStore(rows=>rows),/quota/);localStorage.setItem=set;
 assert.equal(values.get(KEY),before);
});
