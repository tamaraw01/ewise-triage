"use client";

import { useEffect, useId, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import analytics from "../data/analytics.json";
import clusters from "../data/clusters.json";
import { CLUSTERS_META } from "../lib/data";
import flow from "../data/analysis-flow.json";
import "./analysis-flow.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);
const n = (value: number, digits = 0) => value.toLocaleString("id-ID", { maximumFractionDigits: digits });
const pct = (value: number) => `${n(value * 100, 2)}%`;
const methods = ["K-Means", "Ward", "GMM", "Konsensus"];
const chosen = analytics.selection.selected;
const selectedK = [chosen.kmeans, chosen.ward, chosen.gmm, chosen.consensus];
const points = flow.points;
const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
const bounds = { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) };
// One isotropic scale, reused for every partition; only point labels change.
const scale = Math.min(440 / (bounds.xmax - bounds.xmin), 300 / (bounds.ymax - bounds.ymin));
const stages = [
 ["Data", "2.660 citra. Satu populasi.", "Seleksi awalan nama berkas: 3.961 citra awal, 1.301 dikeluarkan. Sepuluh kelas acuan berasal dari nama berkas, belum diaudit independen.", "Ilustrasi citra skematis, bukan foto dataset"],
 ["CLIP", "Citra menjadi arah.", "OpenCLIP ViT-H-14 menghasilkan embedding 1024 dimensi.", "Helai fitur skematis, bukan embedding terukur"],
 ["L2", "Panjang setara. Arah tetap.", "Vektor dibagi norma L2. Ruang fitur tetap 1024 dimensi.", "Bola satuan skematis, bukan proyeksi data"],
 ["UMAP", "Satu sumber. Dua ruang.", "UMAP 2D langsung dari embedding L2 untuk visualisasi. UMAP 50D berjalan independen untuk pemilihan K dan clustering.", "Dua cabang independen dari L2 1024D"],
 ["Pilihan K", "Jumlah dipilih sebelum partisi.", "Silhouette maksimum untuk K-Means dan Ward. BIC minimum untuk GMM. Semua dihitung di UMAP 50D.", "2.660 koordinat UMAP 2D asli, skala X/Y sama"],
 ["Clustering", "Tiga pembacaan. Titik yang sama.", "Ganti partisi. Warna mengikuti label asli; posisi citra tetap.", "Label partisi asli, koordinat UMAP 2D tetap"],
 ["Konsensus", "Kesepakatan membentuk 14.", "Pilih K lewat silhouette pada D = 1 − co-association, lalu average linkage membentuk konsensus.", "Konsensus asli, bukan clustering pada peta 2D"],
 ["Bootstrap", "Uji kembali, 50 kali.", "Sampling dengan pengembalian, lalu indeks unik dipakai untuk refit clustering dan konsensus.", "Bootstrap bersyarat pada embedding dan K tetap"],
 ["Penamaan", "Klaster mendapat nama.", "Rata-rata cosine similarity citra–teks tertinggi dari 10 prompt menentukan nama. Kemiripan bukan probabilitas.", "Nama sistem, bukan label terverifikasi"],
 ["Evaluasi", "Hasil terukur. Batas tetap ada.", "Evaluasi deskriptif pada 2.660 citra yang sama, bukan validasi independen atau kinerja lapangan.", "Acuan dari awalan nama berkas"],
] as const;
function KCurves() {
  const fields = ["silhouette_kmeans", "silhouette_ward", "bic_gmm"] as const;
  return <div className="af-curves">{fields.map((field, i) => {
    const rows = analytics.selection.baseCurves, values = rows.map(r => r[field]);
    const lo = Math.min(...values), hi = Math.max(...values);
    const x = (k: number) => 35 + (k - rows[0].K) / (rows.at(-1)!.K - rows[0].K) * 235;
    const y = (v: number) => 160 - (v - lo) / (hi - lo) * 125;
    const pick = rows.find(r => r.K === selectedK[i])!;
    return <figure key={field}><figcaption>{methods[i]} <strong>K {selectedK[i]}</strong></figcaption><svg viewBox="0 0 300 205" role="img" aria-label={`${methods[i]}, K ${selectedK[i]}, ${i === 2 ? "BIC" : "silhouette"} ${n(pick[field], 4)}`}><path d="M35 25V170H275" /><polyline points={rows.map(r => `${x(r.K)},${y(r[field])}`).join(" ")} className="af-curve" /><line x1={x(pick.K)} x2={x(pick.K)} y1={25} y2={170} className="af-chosen" /><circle cx={x(pick.K)} cy={y(pick[field])} r={4} className="af-accent-fill" /><text x={35} y={193} className="af-small">K {rows[0].K}</text><text x={270} y={193} textAnchor="end" className="af-small">K {rows.at(-1)!.K}</text></svg><p>{i === 2 ? "BIC minimum" : "Silhouette maksimum"}<br /><strong>{n(pick[field], 4)}</strong></p></figure>;
  })}</div>;
}

export default function AnalysisFlow() {
 const root = useRef<HTMLElement>(null), canvasRef = useRef<HTMLCanvasElement>(null), sphereRef = useRef<HTMLDivElement>(null);
 const id = useId();
 const [stage, setStage] = useState(0), [partition, setPartition] = useState(0), [focus, setFocus] = useState<number | null>(null);
 const [systemReduce, setSystemReduce] = useState(false), [manualReduce, setManualReduce] = useState<boolean | null>(null);
 const reduce = manualReduce ?? systemReduce;
 useEffect(() => {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const update = () => { setSystemReduce(media.matches); setManualReduce(null); };
  update(); media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
 }, []);
 useGSAP(() => {
  const rootNode=root.current, canvas=canvasRef.current, host=sphereRef.current;
  if(!rootNode || !canvas || !host) return;
  const context=canvas.getContext('2d'); if(!context) return;
  const ctx: CanvasRenderingContext2D = context;
  let renderer: THREE.WebGLRenderer | null = null;
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(40,1,.1,100);
  camera.position.z=4;
  const globe=new THREE.Group(); scene.add(globe);
  const geometry=new THREE.SphereGeometry(1,24,16), material=new THREE.MeshBasicMaterial({color:0xa7ba83,wireframe:true,transparent:true,opacity:.25});
  globe.add(new THREE.Mesh(geometry,material));
  const arrows: THREE.ArrowHelper[]=[];
  for(let i=0;i<38;i++){
   const y=1-2*(i+.5)/38, a=i*2.39996, r=Math.sqrt(1-y*y);
   const arrow=new THREE.ArrowHelper(new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r),new THREE.Vector3(),1,i%7?0xa7ba83:0xebad4a,.07,.035);
   globe.add(arrow);arrows.push(arrow);
  }
  try { renderer=new THREE.WebGLRenderer({alpha:true,antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.appendChild(renderer.domElement); }
  catch { /* ponytail: Canvas sphere keeps the schematic readable without WebGL. */ }
  let W=0,H=0,phase=0,queued=false,frame=0,stage=0;
  const manual=reduce;
  const clamp=(x:number)=>Math.max(0,Math.min(1,x)), mix=(a:number,b:number,t:number)=>a+(b-a)*t;
  const {xmin,xmax,ymin,ymax}=bounds;
function line(a: [number,number],b: [number,number],color='#a7ba83',width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke()}
function dot(x: number,y: number,r: number,col: string){ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function project(x: number,y: number,z: number,rot=0): [number,number]{const xx=x*Math.cos(rot)+z*Math.sin(rot),zz=-x*Math.sin(rot)+z*Math.cos(rot),f=4/(4+zz);return [cx+xx*R*f,cy+y*R*f]}
let cx = 0, cy = 0, R = 0;
function draw(){queued=false;if(!ctx)return;ctx.clearRect(0,0,W,H);const mobile=W<760;cx=mobile?W*.5:W*.69;cy=mobile?H*.69:H*.49;R=Math.min(mobile?W*.34:W*.22,H*.32);const t=manual?1:phase;

 if(stage===0){for(let i=0;i<80;i++){const col=i%10,row=Math.floor(i/10),x=cx+(col-4.5)*R*.185,y=cy+(row-3.5)*R*.19;ctx.save();ctx.translate(x,y);ctx.rotate((col-4.5)*.025);ctx.fillStyle=i%6?'#a4b398':'#c8cebb';ctx.fillRect(-R*.075,-R*.07,R*.15,R*.14);ctx.strokeStyle='#a7ba83';ctx.lineWidth=1;ctx.strokeRect(-R*.045,-R*.04,R*.09,R*.06);line([-R*.02,R*.025],[R*.025,R*.025]);ctx.restore()}}
 if(stage===1){for(let i=0;i<92;i++){const a=i/92*Math.PI*2;ctx.strokeStyle=i%11?'#7d907066':'#a7ba83';ctx.beginPath();ctx.moveTo(cx-R*1.05,cy+Math.sin(a)*R*.65);ctx.bezierCurveTo(cx-R*.3,cy+Math.sin(a*2+t)*R,cx+R*.2,cy+Math.cos(a)*R,cx+R*1.1,cy+(i/92-.5)*R*1.7);ctx.stroke();dot(cx+R*1.1,cy+(i/92-.5)*R*1.7,1.5,'#a7ba83')} }
 if(stage===2 && !renderer){const rot=-.4+t*.5;for(let q=0;q<9;q++){ctx.beginPath();for(let j=0;j<=100;j++){const a=j/100*Math.PI*2,lat=(q/8-.5)*Math.PI,p=project(Math.cos(a)*Math.cos(lat),Math.sin(lat),Math.sin(a)*Math.cos(lat),rot);if(j) ctx.lineTo(...p); else ctx.moveTo(...p)}ctx.strokeStyle='#a7ba8366';ctx.stroke()}for(let q=0;q<10;q++){ctx.beginPath();for(let j=0;j<=100;j++){const a=j/100*Math.PI*2,b=q/10*Math.PI,p=project(Math.cos(a)*Math.cos(b),Math.sin(a),Math.cos(a)*Math.sin(b),rot);if(j) ctx.lineTo(...p); else ctx.moveTo(...p)}ctx.strokeStyle='#a7ba8355';ctx.stroke()}for(let i=0;i<38;i++){const y=1-2*(i+.5)/38,a=i*2.39996,s=Math.sqrt(1-y*y),len=mix(.4+(i%8)*.19,1,t),end=project(Math.cos(a)*s*len,y*len,Math.sin(a)*s*len,rot);line([cx,cy],end,i%7?'#a7ba8388':'#a86423',i%7?1:2);const angle=Math.atan2(end[1]-cy,end[0]-cx);line(end,[end[0]-6*Math.cos(angle-.4),end[1]-6*Math.sin(angle-.4)],'#a7ba83');line(end,[end[0]-6*Math.cos(angle+.4),end[1]-6*Math.sin(angle+.4)],'#a7ba83')}}
 if(stage===3){ctx.font=`${mobile?16:24}px 'IBM Plex Sans'`;ctx.fillStyle='#a7ba83';ctx.textAlign='center';ctx.fillText('L2 · 1024D',cx,cy-R*1.1);ctx.fillText('50D · clustering',cx-R*.68,cy+R*.95);ctx.fillText('2D · peta',cx+R*.68,cy+R*.95);for(let i=0;i<65;i++){const a=i/65*Math.PI*2;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*R*.13,cy-R*.9);ctx.bezierCurveTo(cx+Math.cos(a)*R*.3,cy-R*.2,cx+side*R*.7+Math.sin(a)*R*.35,cy-R*.1,cx+side*R*.7+Math.sin(a)*R*.35,cy+R*.65+(i%9)*R*.012);ctx.strokeStyle=side<0?'#6e805b66':'#9c764555';ctx.stroke()}}}
 if([4,5,6,8].includes(stage)){const sc=scale*Math.min(R*2.2/440,R*1.7/300),part=stage===5?partition+2:5;
 for(let i=0;i<points.length;i++){const p=points[i],x=cx+(p[0]-(xmin+xmax)/2)*sc,y=cy-(p[1]-(ymin+ymax)/2)*sc;const label=p[part];dot(x,y,mobile?1.35:2.1,stage===8&&focus!==null?(p[5]===focus?'#ebad4a':'#495244'):stage===4?'#a7ba83':`hsl(${70+label*3} ${19+label%4*7}% ${28+label%6*7}%)`)}
 if(stage===6){ctx.font=`${mobile?10:12}px 'IBM Plex Sans'`;ctx.textAlign='center';for(let k=0;k<14;k++){const subset=points.filter(p=>p[5]===k),x=subset.reduce((a,p)=>a+p[0],0)/subset.length,y=subset.reduce((a,p)=>a+p[1],0)/subset.length;const px=cx+(x-(xmin+xmax)/2)*sc,py=cy-(y-(ymin+ymax)/2)*sc;ctx.fillStyle='#1a1f18';ctx.fillRect(px-13,py-9,26,16);ctx.fillStyle='#eeeade';ctx.fillText('C'+k,px,py+3)}}
 }

 if(renderer){
  host!.style.visibility=stage===2?'visible':'hidden';
  if(stage===2){globe.rotation.y=-.4+t*.5;arrows.forEach((a,i)=>a.setLength(mix(.4+(i%8)*.19,1,t),.07,.035));renderer.render(scene,camera);}
 }
}
 function requestDraw(){if(!queued){queued=true;frame=requestAnimationFrame(draw);}}
 const sections=Array.from(rootNode.querySelectorAll<HTMLElement>('[data-stage]'));
 function position(){
  let best=0;sections.forEach((s,i)=>{if(s.getBoundingClientRect().top<innerHeight*.48)best=i;});
  stage=best;setStage(best);
  const r=sections[best].getBoundingClientRect();phase=clamp((innerHeight*.48-r.top)/(r.height*.6));requestDraw();
 }
 function resize(){
  W=canvas!.clientWidth;H=canvas!.clientHeight;const d=Math.min(devicePixelRatio,2);
  canvas!.width=W*d;canvas!.height=H*d;ctx!.setTransform(d,0,0,d,0,0);
  if(renderer){const w=host!.clientWidth,h=host!.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  position();
 }
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 ScrollTrigger.create({trigger:rootNode,start:'top bottom',end:'bottom top',onUpdate:position});
 window.addEventListener('scroll',position,{passive:true});window.addEventListener('resize',resize);resize();
 return ()=>{
  observer.disconnect();window.removeEventListener('scroll',position);window.removeEventListener('resize',resize);cancelAnimationFrame(frame);
  geometry.dispose();material.dispose();arrows.forEach(a=>{a.line.geometry.dispose();a.cone.geometry.dispose();[a.line.material,a.cone.material].flat().forEach(m=>m.dispose());});
  renderer?.dispose();renderer?.domElement.remove();
 };
 },{scope:root,dependencies:[partition,reduce,focus],revertOnUpdate:true});
 const named=focus===null?null:clusters.find(c=>c.id===focus);
 return <section ref={root} className="analysis-flow" aria-labelledby={`${id}-title`} data-reduced-motion={reduce}>
  <header className="af-intro"><h2 id={`${id}-title`}>Dari citra, menjadi konsensus.</h2><button type="button" aria-pressed={reduce} onClick={()=>setManualReduce(!reduce)}>Kurangi gerak: {reduce?'aktif':'nonaktif'}</button></header>
  <nav className="af-index" aria-label="Tahap analisis">{stages.map((s,i)=><a key={s[0]} href={`#${id}-${i}`} onClick={e=>{e.preventDefault();const target=document.getElementById(`${id}-${i}`);target?.focus({preventScroll:true});target?.scrollIntoView({behavior:reduce?'instant':'smooth',block:'start'});}} aria-current={stage===i?'step':undefined}>{s[0]}</a>)}</nav>
  <div className="af-journey">
   <div className="af-field" aria-hidden="true"><canvas ref={canvasRef}/><div ref={sphereRef} className="af-sphere"/><div className="af-dimension">{['2.660 citra','1024D','‖x̂‖₂ = 1','50D ∥ 2D','K: 9 / 9 / 14',`${methods[partition]} · ${selectedK[partition]}`,'14 klaster','50 refit','10 prompt','2.660 acuan'][stage]}</div><p className="af-field-caption">{stages[stage][3]}</p></div>
   {stages.map((s,i)=><section key={s[0]} id={`${id}-${i}`} data-stage={i} tabIndex={-1} className={`af-scene ${[4,7,9].includes(i)?'af-evidence':''}`} aria-labelledby={`${id}-heading-${i}`}>
    <div className="af-copy"><p className="af-eyebrow">{String(i+1).padStart(2,'0')} / {s[0]}</p><h3 id={`${id}-heading-${i}`}>{s[1]}</h3><p>{s[2]}</p>
     {i===1&&<p className="af-formula">citra ⟶ x ∈ ℝ¹⁰²⁴</p>}
     {i===2&&<p className="af-formula">x̂ = x / ‖x‖₂</p>}
     {i===3&&<p className="af-caption">50D tidak direduksi lagi menjadi 2D.</p>}
     {i===5&&<><div className="af-methods" role="group" aria-label="Partisi dasar">{methods.slice(0,3).map((m,j)=><button key={m} type="button" aria-pressed={partition===j} onClick={()=>setPartition(j)}>{m} · K {selectedK[j]}</button>)}</div><p className="af-caption" role="status">Partisi {methods[partition]} aktif · {n(points.length)} citra</p></>}
     {i===6&&<><ConsensusCurve/><p className="af-formula">Aᵢⱼ = ⅓ ∑ 𝟙(ℓᵢ = ℓⱼ)</p><p className="af-caption">Silhouette pada D, bukan UMAP 50D. Posisi 2D tetap.</p></>}
     {i===8&&<><label htmlFor={`${id}-cluster`}>Sorot klaster</label><select id={`${id}-cluster`} value={focus??'all'} onChange={e=>setFocus(e.target.value==='all'?null:Number(e.target.value))}><option value="all">Semua klaster</option>{clusters.map(c=><option key={c.id} value={c.id}>C{c.id} · {CLUSTERS_META[c.id].sub} · {n(c.n_images)} citra</option>)}</select>{named&&<p>C{named.id} · {CLUSTERS_META[named.id].sub}<br/>Label sistem: {named.label}<br/>Kemiripan {n(named.sim_top1,4)}<br/>Kedua: {named.label_top2}, {n(named.sim_top2,4)}<br/>Margin {n(named.margin,4)}</p>}<p className="af-warning">C9 campuran. C11 dinamai Mobile meski didominasi Player. Perlu tinjauan.</p></>}
    </div>
    {i===4&&<KCurves/>}
    {i===7&&<div className="af-bootstrap"><p className="af-metric">{n(analytics.bootstrap.summary.ensemble.mean,4)}<span>Rata-rata ARI konsensus</span></p><svg viewBox="0 0 800 220" role="img" aria-label="50 replikasi bootstrap asli, sumbu ARI 0 sampai 1"><text x={0} y={20}>1</text><text x={0} y={190}>0</text>{analytics.bootstrap.rows.map((row,j)=><rect key={row.bootstrap} x={30+j*15} y={190-row.ARI_ensemble*170} width={9} height={row.ARI_ensemble*170} className="af-accent-fill"><title>Bootstrap {row.bootstrap}: ARI {n(row.ARI_ensemble,4)}</title></rect>)}</svg><p className="af-caption">CLIP, UMAP, dan pemilihan K tidak diulang. SD {n(analytics.bootstrap.summary.ensemble.stdSample,4)}. Bukan interval keyakinan akurasi.</p></div>}
    {i===9&&<div className="af-evaluation"><dl>{[['Akurasi penamaan',pct(analytics.evaluation.accuracy)],['Macro-F1',n(analytics.evaluation.macroF1,4)],['ARI klaster vs acuan',n(analytics.evaluation.ariClusters,4)]].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><p className="af-caption">Kestabilan bukan ketepatan nama. Rincian statistik tetap tersedia di bawah.</p></div>}
   </section>)}
  </div>
 </section>;
}
function ConsensusCurve(){
 const rows=analytics.selection.consensusCurves,lo=Math.min(...rows.map(r=>r.silhouetteCoassociation)),hi=Math.max(...rows.map(r=>r.silhouetteCoassociation));
 const x=(k:number)=>30+(k-9)/5*270,y=(v:number)=>140-(v-lo)/(hi-lo)*110;
 return <figure className="af-consensus-curve"><figcaption>Pemilihan K konsensus · D</figcaption><svg viewBox="0 0 330 180" role="img" aria-label="Silhouette co-association K 9 sampai 14, maksimum K 14"><path d="M30 20V150H310"/><polyline className="af-curve" points={rows.map(r=>`${x(r.k)},${y(r.silhouetteCoassociation)}`).join(' ')}/>{rows.map(r=><circle key={r.k} cx={x(r.k)} cy={y(r.silhouetteCoassociation)} r={3} className="af-accent-fill"><title>K {r.k}: {n(r.silhouetteCoassociation,4)}</title></circle>)}<text x={30} y={175}>K 9</text><text x={280} y={175}>K 14</text></svg></figure>;
}
