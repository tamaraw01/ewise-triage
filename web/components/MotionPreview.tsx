"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Link from "next/link";
import { CLUSTERS_META, type LaneCode } from "@/lib/data";
import "./motion-preview.css";

const laneCodes: LaneCode[] = ["P1", "P2", "P3", "MR"];
const mixedIds = [3, 4, 0, 1, 11, 6, 10, 13];
const ITEM_SECONDS = 2;
const CYCLE_SECONDS = 16;
const HEAP_COPIES = 6;
const mod = (n: number, d: number) => ((n % d) + d) % d;
const smooth = (p: number) => { const t = Math.max(0, Math.min(1, p)); return t * t * (3 - 2 * t); };
const SPEED = 1.6;
const WIDTH = 1.45;
type Point = { x: number; z: number };
export function branch(start: Point, end: Point) {
  const sign = Math.sign(end.z - start.z);
  const angle = sign * 0.46;
  const neck = { x: start.x + 1.2 * Math.cos(angle), z: start.z + 1.2 * Math.sin(angle) };
  const points: Point[] = [start, neck];
  for (let i = 1; i <= 40; i++) {
    const t = i / 40, u = 1 - t;
    points.push({ x: u*u*u*neck.x + 3*u*u*t*(neck.x+1) + 3*u*t*t*(end.x-1) + t*t*t*end.x,
      z: u*u*u*neck.z + 3*u*u*t*(neck.z+Math.tan(angle)) + 3*u*t*t*end.z + t*t*t*end.z });
  }
  return points;
}
export function transport(single: boolean, output: number) {
  const root = { x: -2, z: 0 };
  const second = { x: 2.5, z: output < 2 ? -2.8 : 2.8 };
  const end = { x: 8, z: single ? (output ? 2.8 : -2.8) : (output - 1.5) * 2.8 };
  return [{ x: -9, z: 0 }, root, ...(single ? branch(root, end).slice(1) : [...branch(root, second).slice(1), ...branch(second, end).slice(1)])];
}
export function distance(points: Point[]) { return points.slice(1).reduce((sum,p,i) => sum + Math.hypot(p.x-points[i].x,p.z-points[i].z),0); }
export function along(points: Point[], d: number) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i-1], b = points[i], length = Math.hypot(b.x-a.x,b.z-a.z);
    if (d <= length || i === points.length-1) { const t = Math.min(1,Math.max(0,d/length)); return { x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,heading:Math.atan2(b.z-a.z,b.x-a.x) }; }
    d -= length;
  }
  return { ...points[0], heading:0 };
}
export function itemPose(time: number, index: number, output: number, single = false, slot = 0) {
  const cycle = mod(time, CYCLE_SECONDS);
  const age = mod(time - index * ITEM_SECONDS, CYCLE_SECONDS);
  const path = transport(single,output), length = distance(path), d = age*SPEED;
  const p = along(path,d), fall = Math.max(0,Math.min(1,(d-length)/0.9));
  return { ...p, x:p.x+fall*(0.55+(slot%3)*0.62), z:p.z+fall*(Math.floor(slot%6/3)-0.5)*0.65,
    y:-0.055-fall*fall*0.165, age, cycle, d, length, visible:fall<1, settled:fall===1 };
}
export function heapPose(time: number, index: number, output: number, single: boolean, copy: number, slot: number) {
  const landing = (distance(transport(single,output))+0.9)/SPEED;
  const age = mod(time-index*ITEM_SECONDS-landing-copy*CYCLE_SECONDS, CYCLE_SECONDS*HEAP_COPIES);
  const p = along(transport(single,output),Infinity);
  // ponytail: bounded steady-state compaction, not infinite storage; recycle beneath opaque floor only.
  return { x:p.x+0.55+(slot%3)*0.62, z:p.z+(Math.floor(slot%6/3)-0.5)*0.65,
    y:-0.22-Math.max(0,age-12)*0.022, age, visible:age<84, heading:p.heading };
}
// ponytail: kinematic illustration, not rigid-body simulation; shared path samples drive belt, devices and numeric checks.
export function gateAngle(time: number, gate: number, routes: number[], single: boolean) {
  const cycle = ((time % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  const events = routes.flatMap((output,index) => {
    if (gate && (single || (output<2 ? 1 : 2)!==gate)) return [];
    const travel=gate ? 7+distance(branch({x:-2,z:0},{x:2.5,z:output<2?-2.8:2.8})) : 7;
    const at=index*ITEM_SECONDS+travel/SPEED;
    const direction=gate ? (output%2===0?-1:1) : (single ? (output===0?-1:1) : (output<2?-1:1));
    return [{ at, angle: direction * 0.46 }];
  });
  const wrapped=events.map(e=>({...e,at:mod(e.at,CYCLE_SECONDS)})).sort((a,b)=>a.at-b.at);
  if (!wrapped.length) return 0;
  let selected=0, elapsed=Infinity;
  wrapped.forEach((e,i)=>{const dt=mod(cycle-e.at+0.72,CYCLE_SECONDS);if(dt<elapsed){elapsed=dt;selected=i;}});
  const previous=wrapped[mod(selected-1,wrapped.length)].angle;
  return previous+(wrapped[selected].angle-previous)*smooth(elapsed/0.26);
}

export function FactoryLoop({ single, paused, active = true }: { single: boolean; paused: boolean; active?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const playing = useRef(false);
  const enabled = useRef(active);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [allowMotion, setAllowMotion] = useState(false);
  const sync = useRef<() => void>(() => {});
  useEffect(() => {
    enabled.current = active;
    playing.current = !paused && (!reduced || allowMotion);
    sync.current();
  }, [paused, reduced, allowMotion, active]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const preference = () => { setReduced(media.matches); setAllowMotion(false); };
    queueMicrotask(preference); media.addEventListener("change", preference);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { queueMicrotask(() => setFailed(true)); return () => media.removeEventListener("change", preference); }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd4d7ca);
    const camera = new THREE.OrthographicCamera(-12, 12, 7, -7, 0.1, 80);
    camera.position.set(-7, 19, 22); camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xfffaed, 0x667260, 2.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.8);
    sun.position.set(-5, 14, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 11, bottom: -11, near: 1, far: 45 });
    sun.shadow.normalBias = 0.04; scene.add(sun);
    const material = (color: number, metalness = 0.05) => new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness });
    const iron = material(0x29352e), belt = material(0x424e44), steel = material(0x98a49a, 0.55);
    const bone = material(0xeeeade), sage = material(0xa7ba83), amber = material(0xebad4a);
    const black = material(0x19241e), green = material(0x3e7451);
    const geometries = new Map<string, THREE.BufferGeometry>();
    function box(parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
      const key = `box:${w}:${h}:${d}`;
      if (!geometries.has(key)) geometries.set(key, new THREE.BoxGeometry(w, h, d));
      const mesh = new THREE.Mesh(geometries.get(key), mat);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    }
    function cylinder(parent: THREE.Object3D, r: number, h: number, mat: THREE.Material, x: number, y: number, z: number, sideways = false) {
      const key = `cylinder:${r}:${h}`;
      if (!geometries.has(key)) geometries.set(key, new THREE.CylinderGeometry(r, r, h, 16));
      const mesh = new THREE.Mesh(geometries.get(key), mat);
      if (sideways) mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
    }
    const textures: THREE.Texture[] = [];
    function sign(parent: THREE.Object3D, text: string, x: number, y: number, z: number, width = 2.4, color = "#eeeade") {
      const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#1a1f18"; ctx.fillRect(0, 0, 768, 128);
      ctx.font = "600 58px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = color; ctx.fillText(text, 384, 67, 730);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
      sprite.position.set(x, y, z); sprite.scale.set(width, width / 6, 1); parent.add(sprite); return sprite;
    }
    box(scene, 26, 0.12, 13.5, material(0xcbd0c1), 0, -1.18, 0);
    const outputCodes: LaneCode[] = single ? [CLUSTERS_META[3].lane, "MR"] : laneCodes;
    function conveyor(points: Point[]) {
      // Flat ribbon follows the same centerline as each object; overlap seals every sample seam.
      points.slice(1).forEach((b,i) => {
        const a=points[i], length=Math.hypot(b.x-a.x,b.z-a.z), g=new THREE.Group();
        g.position.set((a.x+b.x)/2,0,(a.z+b.z)/2); g.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x); scene.add(g);
        box(g,length+0.035,0.22,WIDTH,iron,0,-0.12);
        box(g,length+0.035,0.045,WIDTH-0.1,belt,0,0.015);
      });
      [points[0],points[points.length-1]].forEach(p=>[-0.55,0.55].forEach(z=>box(scene,0.12,0.8,0.12,steel,p.x,-0.6,p.z+z)));
    }
    conveyor([{x:-9,z:0},{x:-2,z:0}]);
    const junctions=single ? [{x:-2,z:0}] : [{x:-2,z:0},{x:2.5,z:-2.8},{x:2.5,z:2.8}];
    if(single) [0,1].forEach(o=>conveyor(branch(junctions[0],{x:8,z:o?2.8:-2.8})));
    else {
      junctions.slice(1).forEach(p=>conveyor(branch(junctions[0],p)));
      outputCodes.forEach((_,o)=>conveyor(branch(junctions[o<2?1:2],{x:8,z:(o-1.5)*2.8})));
    }
    const gates=junctions.map(p=>{
      cylinder(scene,0.83,0.09,belt,p.x,-0.005,p.z);
      const g=new THREE.Group(); g.position.set(p.x,0,p.z); scene.add(g);
      [-1,1].forEach(side=>{
        box(g,1.3,0.19,0.065,side===1?amber:steel,0.6,0.19,side*0.51);
      });
      cylinder(g,0.15,0.18,steel,0,-0.09,0);
      cylinder(scene,0.22,0.22,steel,p.x,-0.35,p.z+0.97);
      return g;
    });
    outputCodes.forEach((code,o)=>{
      const z=single?(o?2.8:-2.8):(o-1.5)*2.8;
      box(scene,2.5,0.12,2.1,iron,9.25,-0.8,z);
      [-1,1].forEach(side=>box(scene,2.5,0.85,0.08,steel,9.25,-0.4,z+side*1.05));
      box(scene,0.08,0.85,2.1,steel,10.5,-0.4,z);
      box(scene,0.08,0.3,2.1,steel,8,-0.65,z);
      sign(scene,single?(code==="MR"?"Selain PCB" : "C3 · PCB"):code,9.5,0.5,z,single?2.35:1.15);
    });
    // Separate upstream trolley. Opaque loading hood hides emergence, never scales/fades devices.
    box(scene,2.1,0.13,1.9,steel,-10.7,-0.55,-2);
    [-11.4,-10].forEach(x=>[-2.65,-1.35].forEach(z=>cylinder(scene,0.2,0.15,black,x,-0.9,z,true)));
    [-2.9,-1.1].forEach(z=>box(scene,2.1,0.55,0.06,steel,-10.7,-0.2,z));
    const trolley=device;
    [-0.5,0.25].forEach(dx=>{const g=trolley(dx<0?3:0);g.scale.setScalar(0.55);g.position.set(-10.7+dx,-0.5,-2);scene.add(g);});
    box(scene,1.8,1.4,1.9,bone,-8.8,0.7,0);
    [3,0,4,1].forEach((id,i)=>{const g=device(id);g.scale.setScalar(0.45);g.position.set(-9.25+(i%2)*0.65,1.42,(Math.floor(i/2)-0.5)*0.7);scene.add(g);});
    [-1,1].forEach(z=>box(scene,1.8,0.6,0.08,iron,-8.8,0.3,z));
    [-1.02,1.02].forEach(z=>box(scene,0.12,2.3,0.12,steel,-5.8,1.1,z));
    box(scene,0.5,0.25,2.15,bone,-5.8,2.25,0);
    box(scene,0.44,0.25,0.55,iron,-5.8,2,0);
    cylinder(scene,0.15,0.14,black,-5.8,1.8,0);
    const scan=box(scene,0.045,0.025,1.3,sage,-5.8,0.065,0);
    const flash=new THREE.PointLight(0xd9f3bc,0,3);flash.position.set(-5.8,1.2,0);scene.add(flash);

    function device(id: number) {
      const group = new THREE.Group();
      if (id === 3) {
        box(group, 0.9, 0.07, 1.05, green, 0, 0.17);
        box(group, 0.3, 0.12, 0.32, black, -0.1, 0.26);
        for (let i = 0; i < 5; i++) {
          box(group, 0.035, 0.012, 0.64, sage, -0.34 + i * 0.16, 0.215);
          box(group, 0.07, 0.07, 0.14, amber, -0.34 + i * 0.16, 0.25, 0.38);
        }
        cylinder(group, 0.07, 0.2, steel, 0.28, 0.3, -0.3);
      } else if (id === 4 || id === 10) {
        if (id === 4) {
          box(group, 0.72, 0.22, 0.93, black, 0, 0.25);
          box(group, 0.57, 0.015, 0.62, bone, 0, 0.37);
          [-0.2, 0.2].forEach(x => box(group, 0.1, 0.07, 0.12, amber, x, 0.28, -0.5));
        } else {
          [-0.23, 0.23].forEach(x => { cylinder(group, 0.18, 0.75, sage, x, 0.32, 0, true); cylinder(group, 0.13, 0.035, steel, x, 0.32, 0.39, true); });
        }
      } else if (id === 0) {
        box(group, 1.05, 0.1, 0.64, iron, 0, 0.18);
        for (let row = 0; row < 3; row++) for (let col = 0; col < 8; col++) box(group, 0.09, 0.04, 0.12, bone, -0.43 + col * 0.12, 0.25, -0.2 + row * 0.17);
      } else if (id === 1 || id === 11) {
        box(group, 0.58, 0.12, 0.95, steel, 0, 0.2);
        box(group, 0.48, 0.025, id === 11 ? 0.42 : 0.77, black, 0, 0.28, -0.05);
        cylinder(group, id === 11 ? 0.13 : 0.04, 0.025, bone, 0, 0.3, 0.31);
      } else {
        box(group, 1.05, 0.65, 0.8, bone, 0, 0.46);
        if (id === 6) {
          box(group, 0.72, 0.43, 0.035, black, -0.1, 0.46, 0.42);
          box(group, 0.045, 0.3, 0.055, steel, 0.24, 0.46, 0.46);
          cylinder(group, 0.055, 0.03, iron, 0.43, 0.51, 0.44, true);
        } else {
          box(group, 0.76, 0.045, 0.42, black, 0, 0.81, 0);
          box(group, 0.65, 0.035, 0.55, bone, 0, 0.83, -0.23);
          box(group, 0.73, 0.12, 0.05, black, 0, 0.4, 0.43);
        }
      }
      return group;
    }
    const ids = single ? [3, 3, 4, 3, 0, 3, 1, 3] : mixedIds;
    const trays = ids.map(id => {
      const review = single && id !== 3;
      const group = device(id); group.scale.setScalar(0.55);
      scene.add(group); return { group, lane: review ? "MR" as LaneCode : CLUSTERS_META[id].lane };
    });
    const routes=trays.map(item=>outputCodes.indexOf(item.lane));
    el.dataset.cycleSeconds=String(CYCLE_SECONDS);el.dataset.outputs=String(outputCodes.length);el.dataset.items=JSON.stringify(ids);el.dataset.receivers=JSON.stringify(outputCodes);
    const heaps=trays.flatMap(({lane},index)=>Array.from({length:HEAP_COPIES},(_,copy)=>{
      const group=device(ids[index]);group.scale.setScalar(0.55);scene.add(group);
      return {group,index,copy,slot:trays.slice(0,index).filter(t=>t.lane===lane).length};
    }));
    outputCodes.forEach((code,o)=>{
      const choices=ids.filter((_,i)=>routes[i]===o);
      for(let j=0;j<12;j++){
        const g=device(choices[j%choices.length]);g.scale.setScalar(0.42+(j%3)*0.035);
        g.position.set(8.45+(j%4)*0.48,-0.58+Math.floor(j/4)*0.11,(single?(o?2.8:-2.8):(o-1.5)*2.8)+(Math.floor(j/4)-1)*0.55);
        g.rotation.set((j%3-1)*0.12,j*1.7,(j%2-0.5)*0.15);scene.add(g);
      }
    });
    el.dataset.poolSize=String(trays.length+heaps.length+outputCodes.length*12);
    const markers=Array.from({length:15},(_,i)=>box(scene,0.025,0.012,1.2,steel,-8+i*0.4,0.046));
    let time = 0, last = 0, frame = 0, visible = false, lost = false;
    const render = () => {
      if (!enabled.current || document.hidden || !el.clientWidth || !el.clientHeight || lost) return;
      const deposits=heaps.map(({group,index,copy,slot})=>{
        const p=heapPose(time,index,routes[index],single,copy,slot);
        group.position.set(p.x,p.y,p.z);group.rotation.y=-p.heading;group.visible=p.visible;
        return {index,copy,lane:trays[index].lane,...p};
      });
      el.dataset.deposits=JSON.stringify(deposits);

      const poses = trays.map(({group,lane},index)=>{
        const slot=trays.slice(0,index).filter(item=>item.lane===lane).length;
        const pose=itemPose(time,index,routes[index],single,slot);
        group.visible=pose.visible;group.position.set(pose.x,pose.y,pose.z);group.rotation.y=-pose.heading;
        return {id:ids[index],lane,...pose};
      });
      gates.forEach((g,i)=>{g.rotation.y=-gateAngle(time,i,routes,single);});
      el.dataset.gates=JSON.stringify(gates.map(g=>-g.rotation.y));
      el.dataset.trajectory=JSON.stringify(poses);
      markers.forEach((m,i)=>{m.position.x=-8.7+((i*0.4+time*SPEED)%6.5);});
      const scanning=poses.some(p=>p.visible&&Math.abs(p.x+5.8)<0.2);
      scan.visible=scanning;flash.intensity=scanning?2:0;
      el.dataset.elapsed = time.toFixed(3);
      renderer.render(scene, camera);
    };
    const tick = (now: number) => {
      time += last ? Math.max(0, (now - last) / 1000) : 0; last = now;
      render(); frame = requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      const active = playing.current && enabled.current && visible && !document.hidden && !lost;
      el.dataset.running = String(active);
      if (active) frame = requestAnimationFrame(tick);
      else if (!lost) render();
    };
    sync.current = update;
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      const aspect = w / Math.max(h, 1), halfWidth = Math.max(13.4, 6.8 * aspect);
      camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfWidth / aspect; camera.bottom = -halfWidth / aspect;
      camera.updateProjectionMatrix(); render();
    };
    const ro = new ResizeObserver(resize); ro.observe(el);
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; update(); }, { threshold: 0.05 }); observer.observe(el);
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; setFailed(true); update(); };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    document.addEventListener("visibilitychange", update);
    const seek = (event: Event) => {
      const value = (event as CustomEvent<number>).detail;
      if (Number.isFinite(value) && value >= 0) { time = value; last = 0; render(); }
    };
    el.addEventListener("factory-seek", seek);
    resize(); update();
    return () => {
      cancelAnimationFrame(frame); sync.current = () => {}; el.removeEventListener("factory-seek", seek);
      ro.disconnect(); observer.disconnect(); media.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", update);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      const resources = new Set<THREE.BufferGeometry | THREE.Material>();
      scene.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.geometry) resources.add(mesh.geometry); if (mesh.material) [mesh.material].flat().forEach(m => resources.add(m)); });
      resources.forEach(resource => resource.dispose());
      textures.forEach(texture => texture.dispose()); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [single]);

  return <>
    <div ref={host} className="motion-scene" role="img" aria-label={single ? "Ilustrasi 3D: kamera memindai perangkat satu per satu. Rel berengsel mengarahkan PCB ke box PCB dan perangkat lain ke box selain PCB." : "Ilustrasi 3D: kamera memindai perangkat berjarak. Tiga rel berengsel memilih cabang konveyor menuju box P1, P2, P3 atau MR sesuai data referensi."} />
    {failed && <p role="alert">Tampilan WebGL tidak tersedia. Aktifkan akselerasi perangkat keras, lalu muat ulang halaman.</p>}
    {reduced && <p className="motion-preference">Gerak dikurangi sesuai pengaturan perangkat. <button className="btn" type="button" aria-pressed={allowMotion} onClick={() => setAllowMotion(!allowMotion)}>{allowMotion ? "Hentikan animasi" : "Putar animasi"}</button></p>}
  </>;
}

export default function MotionPreview() {
  const [paused, setPaused] = useState(false);
  return <main className="motion-preview dashboard">
    <header className="dashboard-header"><Link className="motion-brand" href="/">E<span>-</span>WISE</Link><Link href="/">Kembali ke konsol</Link></header>
    <div className="motion-heading"><div><p>Pratinjau implementasi</p><h1>Alur pemilahan</h1></div><button className="btn" type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Lanjutkan animasi" : "Jeda animasi"}</button></div>
    <p className="motion-note">Ilustrasi alur</p>
    <section aria-labelledby="mixed-title"><h2 id="mixed-title">Simulasi E-WISE</h2><FactoryLoop single={false} paused={paused} />

    </section>
    <section aria-labelledby="single-title"><h2 id="single-title">Rekomendasi</h2><FactoryLoop single paused={paused} /></section>

    <footer className="dashboard-footer">Pratinjau gerak</footer>
  </main>;
}
