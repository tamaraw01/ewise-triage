"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { scatter } from "@/lib/data";
import ClusterMap from "./ClusterMap";

// WebGL view of the shipped 2D projection. z is display-only lift for the
// selected cluster; positions carry no third data dimension.
const VERT = `
attribute float aCluster;
uniform float uSel, uPrev, uT, uPx;
varying float vHi;
void main() {
  float hi = (aCluster == uSel ? uT : 0.0) + (aCluster == uPrev ? 1.0 - uT : 0.0);
  vHi = hi;
  vec3 p = position + vec3(0.0, 0.0, hi * 0.12);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = mix(3.4, 8.0, hi) * uPx;
}`;
const FRAG = `
uniform vec3 uDim, uHot;
varying float vHi;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  if (max(abs(d.x), abs(d.y)) > 0.5) discard; // square chips, not glow dots
  gl_FragColor = vec4(mix(uDim, uHot, vHi), mix(0.45, 1.0, vHi));
}`;

const css = (name: string) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());

export default function ClusterField({ selected, onSelect }: { selected: number; onSelect: (id: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const api = useRef<{ select: (id: number) => void } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFailed(true); return; }

    const xs = scatter.map(p => p.x), ys = scatter.map(p => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const rx = Math.max(...xs) - minX || 1, ry = Math.max(...ys) - minY || 1;
    const pos = new Float32Array(scatter.length * 3), cl = new Float32Array(scatter.length);
    // Fit each axis to the visible frustum (fov 32°, z 3.2, aspect 1/0.64) with margin.
    // UMAP axes carry no shared unit, so independent scaling loses nothing.
    const sx = 1.25 / (rx / 2), sy = 0.78 / (ry / 2);
    scatter.forEach((p, i) => {
      pos[i * 3] = (p.x - minX - rx / 2) * sx;
      pos[i * 3 + 1] = -(p.y - minY - ry / 2) * sy;
      cl[i] = p.c;
    });
    const means = new Map<number, THREE.Vector3>();
    for (const id of new Set(scatter.map(p => p.c))) {
      const idx = scatter.flatMap((p, i) => (p.c === id ? [i] : []));
      // Label anchor: cluster x-mean, above its topmost point, so the chip never hides it.
      const x = idx.reduce((a, i) => a + pos[i * 3], 0) / idx.length;
      means.set(id, new THREE.Vector3(x, Math.max(...idx.map(i => pos[i * 3 + 1])), 0));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aCluster", new THREE.BufferAttribute(cl, 1));
    const u = { uSel: { value: selected }, uPrev: { value: -1 }, uT: { value: 1 }, uPx: { value: Math.min(devicePixelRatio, 2) }, uDim: { value: css("--bone-dim") }, uHot: { value: css("--green") } };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, depthWrite: false });
    const scene = new THREE.Scene();
    const field = new THREE.Group();
    field.add(new THREE.Points(geo, mat));
    scene.add(field);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 0, 3.2);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.prepend(renderer.domElement);

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tilt = { x: 0, y: 0 };
    let visible = true, raf = 0;
    const resize = () => {
      const w = el.clientWidth, h = Math.round(w * 0.64);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const project = (v: THREE.Vector3) => {
      const p = v.clone().applyMatrix4(field.matrixWorld).project(camera);
      return { x: (p.x + 1) / 2 * el.clientWidth, y: (1 - p.y) / 2 * el.clientWidth * 0.64 };
    };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      field.rotation.x += (tilt.y * 0.22 - field.rotation.x) * 0.08;
      field.rotation.y += (tilt.x * 0.3 - field.rotation.y) * 0.08;
      field.updateMatrixWorld();
      renderer.render(scene, camera);
      const m = means.get(u.uSel.value);
      if (m && label.current) {
        const { x, y } = project(m.clone().setZ(0.12));
        label.current.style.transform = `translate(${x}px, ${y - 34}px) translateX(-50%)`;
      }
    };
    resize();
    frame();

    const move = (e: PointerEvent) => {
      if (still) return;
      const r = el.getBoundingClientRect();
      tilt.x = (e.clientX - r.left) / r.width - 0.5;
      tilt.y = (e.clientY - r.top) / r.height - 0.5;
    };
    const leave = () => { tilt.x = 0; tilt.y = 0; };
    const pick = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      let best = -1, d = 18 * 18;
      for (let i = 0; i < scatter.length; i++) {
        const s = project(new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], 0));
        const dd = (s.x - (e.clientX - r.left)) ** 2 + (s.y - (e.clientY - r.top)) ** 2;
        if (dd < d) { d = dd; best = i; }
      }
      if (best >= 0) onSelect(scatter[best].c);
    };
    api.current = {
      select: id => {
        if (id === u.uSel.value) return;
        u.uPrev.value = u.uSel.value;
        u.uSel.value = id;
        gsap.fromTo(u.uT, { value: 0 }, { value: 1, duration: still ? 0 : 0.55, ease: "power3.out" });
      },
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; });
    io.observe(el);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("click", pick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("click", pick);
      gsap.killTweensOf(u.uT);
      geo.dispose(); mat.dispose(); renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
    // onSelect identity is stable (setState); scene builds once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { api.current?.select(selected); }, [selected]);

  if (failed) return <ClusterMap highlightedId={selected} onSelect={onSelect} />;
  return (
    <div ref={host} className="cluster-field" role="img" aria-label={`Sebaran klaster riset, C${selected} disorot. Pilihan tersedia di bawah peta.`}>
      <span ref={label} className="field-label num" aria-hidden="true">C{selected}</span>
    </div>
  );
}
