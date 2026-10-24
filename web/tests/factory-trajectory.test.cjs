/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../components/MotionPreview.tsx'),'utf8');
const code=source.slice(source.indexOf('const ITEM_SECONDS'),source.indexOf('export function FactoryLoop'));
const e={};new Function('exports',ts.transpileModule(code,{compilerOptions:{module:1}}).outputText)(e);
const {itemPose,transport,distance,branch,gateAngle,heapPose}=e;
const sets=[{single:false,routes:[1,0,2,1,3,2,0,2],counts:[2,2,3,1]},{single:true,routes:[0,0,1,0,1,0,1,0],counts:[5,3]}];
test('single capture occupancy, continuous spacing, support and tangent alignment',()=>{
 for(const {single,routes} of sets) for(let t=0;t<48;t+=.01){
  const poses=routes.map((o,i)=>itemPose(t,i,o,single));
  assert(poses.filter(p=>p.visible&&Math.abs(p.x+5.8)<.6).length<=1);
  for(const [i,p] of poses.entries()){
   if(!p.visible||p.d>p.length)continue;
   const path=transport(single,routes[i]);
   let min=Infinity;
   for(let k=1;k<path.length;k++){
    const a=path[k-1],b=path[k],dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;
    const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l));
    min=Math.min(min,Math.hypot(p.x-a.x-u*dx,p.z-a.z-u*dz));
   }
   assert(min<1e-8);
   // Conservative footprint encloses every device mesh at scale .55, plus clearance.
   for(const dx of [-.33,.33])for(const dz of [-.33,.33]){
    const x=p.x+dx*Math.cos(p.heading)-dz*Math.sin(p.heading),z=p.z+dx*Math.sin(p.heading)+dz*Math.cos(p.heading);
    let edge=Infinity;
    for(let k=1;k<path.length;k++){
     const a=path[k-1],b=path[k],vx=b.x-a.x,vz=b.z-a.z,l=vx*vx+vz*vz;
     const u=Math.max(0,Math.min(1,((x-a.x)*vx+(z-a.z)*vz)/l));
     edge=Math.min(edge,Math.hypot(x-a.x-u*vx,z-a.z-u*vz));
    }
    assert(edge<.675,`unsupported corner ${single} ${i} ${t} ${edge}`);
   }
   assert.equal(p.y,-.055);
   const next=itemPose(t+.001,i,routes[i],single);
   if(p.d>7&&next.d<p.length)assert(Math.abs(Math.atan2(next.z-p.z,next.x-p.x)-p.heading)<.04);
  }
 }
});
test('hinged guide aligned before nose contact, held through rear clearance, never conflicting',()=>{
 for(const {single,routes} of sets)for(let gate=0;gate<(single?1:3);gate++){
  const intervals=[];
  routes.forEach((o,i)=>{
   if(gate&&(o<2?1:2)!==gate)return;
   const travel=gate?7+distance(branch({x:-2,z:0},{x:2.5,z:o<2?-2.8:2.8})):7;
   const at=i*2+travel/1.6;
   const expected=(gate?(o%2===0?-1:1):(single?(o===0?-1:1):(o<2?-1:1)))*.46;
   for(let repeat=0;repeat<3;repeat++)for(let t=at-.3/1.6;t<=at+1.6/1.6;t+=.01)assert(Math.abs(gateAngle(t+repeat*16,gate,routes,single)-expected)<1e-8,`${single} ${gate} ${i} ${t}`);
   const tangent=Math.atan2(branch({x:0,z:0},{x:6,z:expected<0?-3:3})[1].z,branch({x:0,z:0},{x:6,z:expected<0?-3:3})[1].x);
   assert(Math.abs(tangent-expected)<1e-8);
   intervals.push([at-.1875,at+1]);
  });
  for(let i=1;i<intervals.length;i++)assert(intervals[i][0]>intervals[i-1][1]);
 }
});
test('continuous stream and bounded retained deposits across six pool cycles',()=>{
 for(const {single,routes,counts} of sets){
  assert.deepEqual(counts.map((_,o)=>routes.filter(r=>r===o).length),counts);
  for(let t=0;t<288;t+=.05){
   const poses=routes.map((o,i)=>itemPose(t,i,o,single));
   assert(poses.some(p=>p.visible&&p.d>1.2&&p.d<p.length),'stream cleared');
   assert(poses.filter(p=>p.visible&&Math.abs(p.x+5.8)<.6).length<=1);
   for(const [i,o] of routes.entries())for(let copy=0;copy<6;copy++){
    const p=heapPose(t,i,o,single,copy,0);
    assert(p.y<=-.22&&p.y>-2.1);
    if(p.age<12){assert(p.visible);assert.equal(p.y,-.22);}
    if(!p.visible)assert(p.y+.55<-.74,'recycle above opaque floor');
   }
  }
  routes.forEach((o,i)=>{
   const landing=(distance(transport(single,o))+.9)/1.6+i*2;
   for(let k=0;k<18;k++){
    const t=landing+k*16,copy=k%6;
    const arriving=itemPose(t-.0001,i,o,single),settled=heapPose(t+.0001,i,o,single,copy,0);
    assert(arriving.visible&&settled.visible);
    assert(Math.abs(arriving.x-settled.x)<.001&&Math.abs(arriving.y-settled.y)<.001);
    assert(heapPose(t+11.9,i,o,single,copy,0).visible);
   }
  });
  assert.deepEqual(itemPose(0,0,0,single),itemPose(16,0,0,single));
 }
 assert.doesNotMatch(source,/covers|closure|slat|PLC|scale\.setScalar\(Math|opacity\s*=/);
});
