"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Link from "next/link";
import { CLUSTERS_META, type LaneCode } from "@/lib/data";
import "./motion-preview.css";

const laneCodes: LaneCode[] = ["P1", "P2", "P3", "MR"];
const mixedIds = [3, 4, 0, 1, 11, 6, 10, 13];
const laneZ = (lane: LaneCode) => (laneCodes.indexOf(lane) - 1.5) * 2.6;

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
    camera.position.set(-11, 14, 18); camera.lookAt(0, 0, 0);
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
    box(scene, 22, 0.18, 14, material(0xbfc5b5), 0, -1.02, 0);
    function conveyor(x: number, z: number, length: number, width = 1.65) {
      box(scene, length, 0.25, width, iron, x, -0.15, z);
      box(scene, length - 0.1, 0.06, width - 0.16, belt, x, 0.01, z);
      [-1, 1].forEach(side => {
        box(scene, length, 0.14, 0.07, steel, x, 0.12, z + side * width / 2);
        [-1, 1].forEach(end => box(scene, 0.13, 0.76, 0.13, steel, x + end * (length / 2 - 0.3), -0.58, z + side * (width / 2 - 0.16)));
      });
      for (let dx = -length / 2 + 0.2; dx < length / 2; dx += 0.45) cylinder(scene, 0.075, width - 0.17, steel, x + dx, 0.02, z, true);
    }
    conveyor(-5, 0, 7);
    // Broad transfer table supports the full fan-out; objects never cross unsupported gaps.
    box(scene, 5, 0.25, single ? 4.5 : 9.65, iron, 0.9, -0.15, 0);
    box(scene, 4.9, 0.045, single ? 4.35 : 9.5, belt, 0.9, 0.01, 0);
    const outputCodes: LaneCode[] = single ? [CLUSTERS_META[3].lane, "MR"] : laneCodes;
    const outputZ = (lane: LaneCode) => single ? (outputCodes.indexOf(lane) - 0.5) * 2.6 : laneZ(lane);
    outputCodes.forEach(code => {
      const z = outputZ(code), active = true;
      conveyor(6, z, 5.7);
      box(scene, 5.5, 0.025, 0.08, active ? (code === "P1" || code === "MR" ? amber : sage) : steel, 6, 0.12, z - 0.68);
      sign(scene, single ? (code === "MR" ? "Selain PCB" : "C3 · PCB") : code, 8.2, 0.85, z, single ? 2.7 : 1.15, code === "P1" || code === "MR" ? "#ebad4a" : "#a7ba83");
      const points = [new THREE.Vector3(-1.5, 0.065, 0), new THREE.Vector3(3.25, 0.065, z)];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: active ? 0xa7ba83 : 0x718174 })));
    });
    // Camera housing and physical scan portal, without decorative beams or glow.
    [-1.06, 1.06].forEach(z => box(scene, 0.2, 2.6, 0.2, steel, -2.4, 1.22, z));
    box(scene, 0.65, 0.42, 2.4, bone, -2.4, 2.6, 0);
    box(scene, 0.5, 0.3, 0.65, iron, -2.4, 2.24, 0);
    cylinder(scene, 0.17, 0.16, black, -2.4, 2.03, 0);
    cylinder(scene, 0.11, 0.03, sage, -2.4, 1.94, 0);
    sign(scene, "E-WISE · kamera", -2.4, 3.15, 0, 3.25);
    const scan = box(scene, 0.06, 0.025, 1.55, sage, -2.4, 0.18, 0);
    sign(scene, "MASUK", -7.6, 0.8, -1.5, 1.8);
    box(scene, 1.2, 1.4, 0.7, bone, -0.9, -0.12, -2.2);
    box(scene, 0.92, 0.7, 0.05, black, -0.9, 0.14, -1.82);
    sign(scene, "E-WISE", -0.9, 0.2, -1.75, 1);

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
      const group = new THREE.Group();
      box(group, 1.3, 0.08, 1.35, bone, 0, 0.08);
      group.add(device(id));
      sign(group, `C${id}`, 0, 1.2, 0, 0.85);
      scene.add(group); return { group, lane: review ? "MR" as LaneCode : CLUSTERS_META[id].lane };
    });
    const markers = Array.from({ length: 17 }, (_, i) => box(scene, 0.035, 0.02, 1.42, iron, -8 + i * 0.4, 0.11));
    let time = 5.5, last = 0, frame = 0, visible = false, lost = false;
    const render = () => {
      trays.forEach(({ group, lane }, index) => {
        const phase = (time / 22 + index / trays.length) % 1;
        let x: number, z = 0;
        if (phase < 0.38) x = -8.5 + phase / 0.38 * 7;
        else if (phase < 0.65) { const p = (phase - 0.38) / 0.27; x = -1.5 + p * 4.8; z = outputZ(lane) * p; }
        else { x = 3.3 + (phase - 0.65) / 0.35 * 6; z = outputZ(lane); }
        group.position.set(x, 0.07, z);
        // ponytail: recycle pooled trays behind short end fades; export a full 22-second cycle after approval.
        group.scale.setScalar(Math.max(0.001, Math.min(1, phase / 0.025, (1 - phase) / 0.025)));
      });
      markers.forEach((m, i) => { m.position.x = -8.4 + ((i * 0.4 + time * 0.8) % 6.8); });
      scan.position.x = -2.4 + Math.sin(time * 2.4) * 0.24;
      el.dataset.elapsed = time.toFixed(3);
      renderer.render(scene, camera);
    };
    const tick = (now: number) => {
      time += last ? Math.min((now - last) / 1000, 0.08) : 0; last = now;
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
      const aspect = w / Math.max(h, 1), halfWidth = Math.max(11.5, 7.1 * aspect);
      camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfWidth / aspect; camera.bottom = -halfWidth / aspect;
      camera.updateProjectionMatrix(); render();
    };
    const ro = new ResizeObserver(resize); ro.observe(el);
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; update(); }, { threshold: 0.05 }); observer.observe(el);
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; setFailed(true); update(); };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    document.addEventListener("visibilitychange", update);
    resize(); update();
    return () => {
      cancelAnimationFrame(frame); sync.current = () => {};
      ro.disconnect(); observer.disconnect(); media.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", update);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      scene.traverse(object => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); if (mesh.material) [mesh.material].flat().forEach(m => m.dispose()); });
      textures.forEach(texture => texture.dispose()); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [single]);

  return <>
    <div ref={host} className="motion-scene" role="img" aria-label={single ? "Ilustrasi 3D: PCB C3 masuk jalur PCB. Baterai, keyboard dan ponsel masuk jalur selain PCB." : "Ilustrasi 3D: delapan contoh perangkat melewati kamera E-WISE lalu dipisahkan ke P1, P2, P3 atau MR sesuai data referensi."} />
    {failed && <p role="alert">Tampilan WebGL tidak tersedia. Aktifkan akselerasi perangkat keras, lalu muat ulang halaman.</p>}
    {reduced && <p className="motion-preference">Gerak dikurangi sesuai pengaturan perangkat. <button className="btn" type="button" aria-pressed={allowMotion} onClick={() => setAllowMotion(!allowMotion)}>{allowMotion ? "Hentikan animasi" : "Putar animasi"}</button></p>}
  </>;
}

export default function MotionPreview() {
  const [paused, setPaused] = useState(false);
  return <main className="motion-preview dashboard">
    <header className="dashboard-header"><Link className="motion-brand" href="/">E<span>-</span>WISE</Link><Link href="/">Kembali ke konsol</Link></header>
    <div className="motion-heading"><div><p>Pratinjau implementasi</p><h1>Alur pemilahan</h1></div><button className="btn" type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Lanjutkan animasi" : "Jeda animasi"}</button></div>
    <p className="motion-note">Ilustrasi integrasi, bukan inferensi langsung.</p>
    <section aria-labelledby="mixed-title"><h2 id="mixed-title">Simulasi E-WISE</h2><FactoryLoop single={false} paused={paused} />

    </section>
    <section aria-labelledby="single-title"><h2 id="single-title">Rekomendasi</h2><FactoryLoop single paused={paused} /></section>

    <footer className="dashboard-footer">Pratinjau gerak</footer>
  </main>;
}
