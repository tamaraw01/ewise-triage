"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Link from "next/link";
import { CLUSTERS_META, type LaneCode } from "@/lib/data";
import "./motion-preview.css";

const laneCodes: LaneCode[] = ["P1", "P2", "P3", "MR"];
const mixedIds = [3, 4, 0, 1, 11, 6, 10, 13];
const laneZ = (lane: LaneCode) => (laneCodes.indexOf(lane) - 1.5) * 2.6;
const ITEM_SECONDS = 1.2;
const BATCH_SECONDS = 22;
const CYCLE_SECONDS = 28;
const smooth = (p: number) => { const t = Math.max(0, Math.min(1, p)); return t * t * (3 - 2 * t); };

// ponytail: eight spaced carriers on a supported feed; closed shutters conceal batch exchange, not simulated logistics.
export function itemPose(time: number, index: number, z: number, slot = index % 6) {
  const cycle = ((time % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  const age = (cycle >= 24 ? 0 : cycle) - index * ITEM_SECONDS;
  const slotX = 9.5 + (slot % 3) * 0.9, slotZ = z + (Math.floor(slot / 3) - 0.5) * 0.9;
  let x = -8.8 + age * (0.85 / ITEM_SECONDS), y = -0.05, rz = 0;
  if (age >= 0 && age < 4.7) x = -8.8 + age / 4.7 * 7.3;
  else if (age >= 4.7 && age < 7.7) { const p = (age - 4.7) / 3; x = -1.5 + p * 4.8; rz = z * smooth(p); }
  else if (age >= 7.7 && age < 11.2) { x = 3.3 + (age - 7.7) / 3.5 * 5.55; rz = z; }
  else if (age >= 11.2 && age < 12) { const p = (age - 11.2) / 0.8; x = 8.85 + (slotX - 8.85) * p; rz = z + (slotZ - z) * p; y -= 0.78 * p * p; }
  else if (age >= 12) { x = slotX; rz = slotZ; y = -0.83; }
  return { x, y, z: rz, age, cycle };
}

export function FactoryLoop({ single, paused }: { single: boolean; paused: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const playing = useRef(false);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [allowMotion, setAllowMotion] = useState(false);
  const sync = useRef<() => void>(() => {});
  useEffect(() => {
    playing.current = !paused && (!reduced || allowMotion);
    sync.current();
  }, [paused, reduced, allowMotion]);

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
    camera.position.set(-10, 17, 21); camera.lookAt(-1.5, 0, 0);
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
    function box(parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    }
    function cylinder(parent: THREE.Object3D, r: number, h: number, mat: THREE.Material, x: number, y: number, z: number, sideways = false) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat);
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
    box(scene, 29, 0.18, 14, material(0xbfc5b5), -1.5, -1.18, 0);
    function conveyor(x: number, z: number, length: number, width = 1.65) {
      box(scene, length, 0.25, width, iron, x, -0.15, z);
      box(scene, length - 0.1, 0.06, width - 0.16, belt, x, 0.01, z);
      [-1, 1].forEach(side => {
        box(scene, length, 0.14, 0.07, steel, x, 0.12, z + side * width / 2);
        [-1, 1].forEach(end => box(scene, 0.13, 0.76, 0.13, steel, x + end * (length / 2 - 0.3), -0.58, z + side * (width / 2 - 0.16)));
      });
      for (let dx = -length / 2 + 0.2; dx < length / 2; dx += 0.45) cylinder(scene, 0.075, width - 0.17, steel, x + dx, 0.02, z, true);
    }
    conveyor(-5.15, 0, 7.5);
    // Broad transfer table supports the full fan-out; objects never cross unsupported gaps.
    box(scene, 5, 0.25, single ? 4.5 : 9.65, iron, 0.9, -0.15, 0);
    box(scene, 4.9, 0.045, single ? 4.35 : 9.5, belt, 0.9, 0.01, 0);
    const outputCodes: LaneCode[] = single ? [CLUSTERS_META[3].lane, "MR"] : laneCodes;
    const outputZ = (lane: LaneCode) => single ? (outputCodes.indexOf(lane) - 0.5) * 2.6 : laneZ(lane);
    const covers: THREE.Group[] = [];
    function cover(x: number, z: number, w: number, d: number, y: number) {
      const pivot = new THREE.Group(); pivot.position.set(x, y, z - d / 2); scene.add(pivot);
      // Telescoping shutter stacks outside the opening, keeping accumulated contents visible.
      for (let i = 0; i < 12; i++) box(pivot, w, 0.025, d / 12 + 0.1, bone, 0, i * 0.027, (i + 0.5) * d / 12);
      pivot.userData.depth = d; covers.push(pivot);
    }
    outputCodes.forEach(code => {
      const z = outputZ(code);
      conveyor(6, z, 5.7);
      box(scene, 5.5, 0.025, 0.08, code === "P1" || code === "MR" ? amber : sage, 6, 0.12, z - 0.68);
      sign(scene, single ? (code === "MR" ? "Selain PCB" : "C3 · PCB") : code, 8.2, 0.85, z, single ? 2.7 : 1.15, code === "P1" || code === "MR" ? "#ebad4a" : "#a7ba83");
      // Open receiver: front/back/outer walls, no wall across discharge mouth.
      box(scene, 3.7, 0.12, 2.45, iron, 10.5, -0.79, z);
      [-1, 1].forEach(side => box(scene, 3.7, 0.9, 0.09, steel, 10.5, -0.28, z + side * 1.225));
      box(scene, 0.1, 0.9, 2.45, steel, 12.35, -0.28, z);
      box(scene, 0.1, 0.55, 2.45, steel, 8.65, -0.53, z);
      cover(10.5, z, 3.8, 2.55, 0.22);
      // Short discharge bridge keeps device supported until release.
      box(scene, 0.25, 0.045, 1.5, steel, 8.9, 0.01, z);
    });
    // Camera housing and physical scan portal, without decorative beams or glow.
    [-1.06, 1.06].forEach(z => box(scene, 0.2, 2.6, 0.2, steel, -2.4, 1.22, z));
    box(scene, 0.65, 0.42, 2.4, bone, -2.4, 2.6, 0);
    box(scene, 0.5, 0.3, 0.65, iron, -2.4, 2.24, 0);
    cylinder(scene, 0.17, 0.16, black, -2.4, 2.03, 0);
    cylinder(scene, 0.11, 0.03, sage, -2.4, 1.94, 0);
    sign(scene, "E-WISE · kamera", -2.4, 3.15, 0, 3.25);
    const scan = box(scene, 0.06, 0.025, 1.55, sage, -2.4, 0.075, 0);
    sign(scene, "MASUK", -7.6, 0.8, -1.5, 1.8);
    box(scene, 1.2, 1.4, 0.7, bone, -3.6, -0.12, -2.2);
    box(scene, 0.92, 0.7, 0.05, black, -3.6, 0.14, -1.82);
    sign(scene, "E-WISE", -3.6, 0.2, -1.75, 1);

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
    // Docked wheeled belt magazine: loaded carriers advance together through an open discharge mouth.
    conveyor(-12, 0, 6.8, 1.8);
    [-14.9, -9.1].forEach(x => [-0.7, 0.7].forEach(z => {
      cylinder(scene, 0.26, 0.2, black, x, -0.82, z, true);
      box(scene, 0.12, 0.6, 0.12, steel, x, -0.45, z);
    }));
    [-0.98, 0.98].forEach(z => box(scene, 6.8, 0.65, 0.08, steel, -12, 0.37, z));
    box(scene, 0.08, 0.9, 2, steel, -15.4, 0.43, 0);
    [-0.85, 0.85].forEach(z => box(scene, 0.12, 1.6, 0.12, steel, -15.6, 0.1, z));
    box(scene, 0.12, 0.12, 1.8, iron, -15.6, 0.9, 0);
    cover(-12, 0, 6.95, 2.1, 1.05);
    const trays = ids.map(id => {
      const review = single && id !== 3;
      const group = device(id);
      box(group, 1.18, 0.045, 1.2, steel, 0, 0.09);
      group.scale.setScalar(0.7);
      scene.add(group); return { group, lane: review ? "MR" as LaneCode : CLUSTERS_META[id].lane };
    });

    el.dataset.cycleSeconds = String(CYCLE_SECONDS); el.dataset.outputs = String(outputCodes.length); el.dataset.items = JSON.stringify(ids);
    el.dataset.receivers = JSON.stringify(outputCodes);
    const markers = Array.from({ length: 17 }, (_, i) => box(scene, 0.035, 0.02, 1.42, iron, -8 + i * 0.4, 0.11));
    let time = 0, last = 0, frame = 0, visible = false, lost = false;
    const render = () => {
      const cycle = time % CYCLE_SECONDS;
      const close = smooth((cycle - BATCH_SECONDS) / 2);
      const reopen = smooth((cycle - BATCH_SECONDS - 3) / 2);
      covers.forEach(cover => {
        const spread = close - reopen, depth = cover.userData.depth as number;
        cover.children.forEach((slat, i) => { slat.position.z = -0.15 + spread * ((i + 0.5) * depth / 12 + 0.15); });
      });
      const poses = trays.map(({ group, lane }, index) => {
        const slot = trays.slice(0, index).filter(item => item.lane === lane).length;
        const pose = itemPose(time, index, outputZ(lane), slot);
        group.position.set(pose.x, pose.y, pose.z);
        return { id: ids[index], lane, ...pose };
      });
      el.dataset.trajectory = JSON.stringify(poses);
      markers.forEach((m, i) => { m.position.x = -8.4 + ((i * 0.4 + time * 0.8) % 6.8); });
      scan.position.x = -2.4 + Math.sin(time * 2.4) * 0.24;
      el.dataset.elapsed = time.toFixed(3);
      renderer.render(scene, camera);
    };
    const tick = (now: number) => {
      time += last ? Math.max(0, (now - last) / 1000) : 0; last = now;
      render(); frame = requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      const active = playing.current && visible && !document.hidden && !lost;
      el.dataset.running = String(active);
      if (active) frame = requestAnimationFrame(tick);
      else if (!lost) render();
    };
    sync.current = update;
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      const aspect = w / Math.max(h, 1), halfWidth = Math.max(17, 7.1 * aspect);
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
      scene.traverse(object => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); if (mesh.material) [mesh.material].flat().forEach(m => m.dispose()); });
      textures.forEach(texture => texture.dispose()); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [single]);

  return <>
    <div ref={host} className="motion-scene" role="img" aria-label={single ? "Ilustrasi 3D: troli beroda memasok beberapa perangkat bersamaan melalui sabuk ke kamera. PCB C3 masuk wadah PCB; baterai, keyboard dan ponsel masuk wadah selain PCB. Wadah ditutup saat pengulangan." : "Ilustrasi 3D: sabuk troli beroda memasok delapan perangkat dengan jarak teratur ke kamera, lalu pembawa mengarahkannya ke wadah P1, P2, P3 atau MR sesuai data referensi. Wadah ditutup saat pengulangan."} />
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
