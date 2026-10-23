/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,f);
const {mutateStore,KEY}=require('../lib/demo-storage.ts');
const {createRecord}=require('../lib/demo-records.ts');
const p={status:'classified',margin:.1,threshold:.03,cluster:{id:4,label:'Battery',contested:false,route:'HAZARD',handling:'Check'}};
test('evidence failure never commits record metadata',async()=>{
 const values=new Map([[KEY,JSON.stringify({version:1,records:[]})]]);
 global.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 Object.defineProperty(global,'navigator',{configurable:true,value:{locks:{request:(_key,fn)=>fn()}}});
 global.indexedDB={open:()=>{throw Error('evidence unavailable');}};
 const record=createRecord(p,'photo.png'),before=values.get(KEY);
 await assert.rejects(mutateStore(rows=>[record,...rows],{id:record.id,file:new File(['source'],'photo.png',{type:'image/png'})}),/evidence unavailable/);
 assert.equal(values.get(KEY),before);
});
