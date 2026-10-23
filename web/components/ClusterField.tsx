"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { scatter } from "@/lib/scatter";
import photos from "@/data/map-photos.json";
import styles from "./ClusterField.module.css";
import { viewportPhotos, filenameLabels } from "@/lib/map-layout";

type View = { x: number; y: number; zoom: number };
const points = scatter;
const bounds = (items: typeof points) => {
  const xs = items.map(p => p.x), ys = items.map(p => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2,
    width: Math.max(...xs) - Math.min(...xs) || 1, height: Math.max(...ys) - Math.min(...ys) || 1 };
};
const whole = bounds(points);
const clusterIds = [...new Set(points.map(p => p.c))].sort((a, b) => a - b);
const clusterColors = ["#b8cc8e", "#76b7a5", "#d5bb79", "#cc9380", "#88accc", "#b09ec4", "#d0aa91", "#80c1bd", "#b8bf73", "#c994a5", "#93b98c", "#b4b9d3", "#d3a76b", "#98c7b3"];
const clusterBounds = Object.fromEntries(clusterIds.map(id => [id, bounds(points.filter(p => p.c === id))]));
// ponytail: 1000x separates nearly all overlapping filenames (~9 pairs remain). Raise the cap if dense pairs still need separating.
const clamp = (zoom: number) => Math.min(1000, Math.max(1, zoom));

function Photo({ index, large = false }: { index: number; large?: boolean }) {
  const [state, setState] = useState("loading");
  const photo = photos.photos[index];
  if (!photo || state === "error") return <span className={styles.missing}>Foto tidak tersedia</span>;
  return <span className={large ? styles.largePhoto : styles.photo} aria-busy={state === "loading"}>
    {/* Local, verified derivatives; preserve source aspect ratio without optimization requests. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={photo.src} alt={large ? photo.filename : ""} width={photo.width} height={photo.height} loading="lazy" decoding="async" onLoad={() => setState("ready")} onError={() => setState("error")} />
    {state === "loading" && <span className={styles.missing}>Memuat…</span>}
  </span>;
}

export default function ClusterField({ selected, onSelect }: { selected: number; onSelect: (id: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLElement>(null);
  const api = useRef<{ select: (id: number) => void; zoom: (factor: number) => void; reset: () => void; locate: (i: number) => void } | null>(null);
  const selection = useRef(selected);
  const previousSelection = useRef(selected);
  const callback = useRef(onSelect);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [query, setQuery] = useState("");


  const open = (index: number) => {
    setActive(index);
    callback.current(points[index].c);

  };
  const openRef = useRef(open);
  useEffect(() => {
    selection.current = selected;
    callback.current = onSelect;
    openRef.current = open;
  });

  useEffect(() => {
    const el = host.current, surface = canvas.current;
    if (!el || !surface) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: THREE.WebGLRenderer | undefined;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { /* Native canvas below also paints points on first frame. */ }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, .001, 10000);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap(p => [p.x, p.y, 0]), 3));
    geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(points.flatMap(p => { const c = new THREE.Color(clusterColors[p.c]); return [c.r, c.g, c.b]; }), 3));
    geometry.setAttribute("aCluster", new THREE.Float32BufferAttribute(points.map(p => p.c), 1));
    const uniforms = { selected: { value: selection.current }, pixel: { value: Math.min(devicePixelRatio, 2) } };
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms,
      vertexShader: `attribute float aCluster; attribute vec3 aColor; uniform float selected, pixel; varying float hi; varying vec3 tint;
        void main(){tint=aColor;hi=aCluster==selected?1.:0.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=mix(3.,6.,hi)*pixel;}`,
      fragmentShader: `varying float hi;varying vec3 tint;void main(){gl_FragColor=vec4(tint,mix(.85,1.,hi));}` });
    scene.add(new THREE.Points(geometry, material));
    if (renderer) { renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); surface.prepend(renderer.domElement); }
    const view: View = { x: whole.x, y: whole.y, zoom: 1 };
    let width = 1, height = 1, spanX = 1, spanY = 1, raf = 0, visible = true;
    let target: View = { ...view };
    const project = (p: { x: number; y: number }) => ({ x: width / 2 + (p.x - view.x) / spanX * width * view.zoom, y: height / 2 - (p.y - view.y) / spanY * height * view.zoom });
    const layer = surface.querySelector<HTMLCanvasElement>("[data-photo-layer]");
    const ctx = layer?.getContext("2d");
    const frame = () => {
      raf = 0;
      if (!visible || document.hidden) return;

      camera.aspect = width / height;
      camera.position.set(view.x, view.y, spanY / (2 * Math.tan(THREE.MathUtils.degToRad(16))) / view.zoom);
      camera.updateProjectionMatrix();
      uniforms.selected.value = selection.current;
      renderer?.render(scene, camera);
      setZoom(view.zoom);
      const projected = points.map((point, index) => ({ index, ...project(point) }));
      const visiblePoints = viewportPhotos(projected, width, height);
      if (ctx) ctx.font = "11px sans-serif";
      const shown = ctx && view.zoom >= 24 ? filenameLabels(visiblePoints, width, height, i => ctx.measureText(photos.photos[i].filename).width) : [];
      if (layer && ctx) {
        ctx.clearRect(0, 0, width, height);
        for (const p of visiblePoints) {
          ctx.fillStyle = clusterColors[points[p.index].c];
          const size = points[p.index].c === selection.current ? 6 : 4;
          ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
        }
        // Filenames only; the photo loads after a point is clicked.
        ctx.font = "11px sans-serif"; ctx.textBaseline = "middle";
        for (const p of shown) {
          ctx.fillStyle = clusterColors[points[p.index].c];
          ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
          ctx.fillStyle = "#eeeade"; ctx.fillText(photos.photos[p.index].filename, p.x + 8, p.y);
        }
        layer.dataset.points = JSON.stringify(visiblePoints.map(p => [p.index, Math.round(p.x), Math.round(p.y)]));
        layer.dataset.named = JSON.stringify(shown.map(p => [p.index, Math.round(p.x), Math.round(p.y)]));
        layer.dataset.camera = JSON.stringify({ x: view.x, y: view.y, zoom: view.zoom, spanX, spanY, width, height });
      }
    };
    const invalidate = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
    const stop = () => { gsap.killTweensOf(view); };
    const moveTo = (next: View, animate = true) => {
      stop(); target = { ...next, zoom: clamp(next.zoom) };
      if (motion.matches || !visible || document.hidden || !animate) { Object.assign(view, target); invalidate(); }
      else gsap.to(view, { ...target, duration: .65, ease: "power3.inOut", onUpdate: invalidate });
    };
    const focus = (id: number) => {
      const b = clusterBounds[id];
      if (!b) return;
      uniforms.selected.value = id;
      moveTo({ x: b.x, y: b.y, zoom: Math.min(spanX / (b.width * 1.3), spanY / (b.height * 1.3)) });
    };
    const zoomAt = (factor: number, x = width / 2, y = height / 2) => {
      const next = clamp(view.zoom * factor);
      moveTo({ zoom: next, x: view.x + (x / width - .5) * spanX * (1 / view.zoom - 1 / next), y: view.y - (y / height - .5) * spanY * (1 / view.zoom - 1 / next) }, false);
    };
    const resize = () => {
      width = el.clientWidth || 1; height = el.clientHeight || Math.round(width * .64);
      spanY = Math.max(whole.height * 1.18, whole.width * 1.18 * height / width); spanX = spanY * width / height;
      renderer?.setSize(width, height);
      if (layer) { const ratio = Math.min(devicePixelRatio, 2); layer.width = width * ratio; layer.height = height * ratio; layer.style.width = `${width}px`; layer.style.height = `${height}px`; ctx?.setTransform(ratio, 0, 0, ratio, 0, 0); }
      invalidate();
    };
    api.current = { select: focus, zoom: factor => zoomAt(factor), reset: () => moveTo({ x: whole.x, y: whole.y, zoom: 1 }), locate: index => { const p = points[index]; moveTo({ x: p.x, y: p.y, zoom: 40 }); } };
    const pointers = new Map<number, { x: number; y: number }>();
    let startX = 0, startY = 0, dragged = false;
    const local = (e: PointerEvent | WheelEvent) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      if (e.button !== 0) return;
      stop(); const p = local(e); pointers.set(e.pointerId, p); startX = p.x; startY = p.y; dragged = pointers.size > 1; el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const old = pointers.get(e.pointerId);
      if (!old) return;
      const p = local(e), before = [...pointers.values()];
      pointers.set(e.pointerId, p);
      if (Math.hypot(p.x - startX, p.y - startY) > 5) dragged = true;
      if (pointers.size === 2) {
        dragged = true; const after = [...pointers.values()];
        const d0 = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
        const d1 = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
        if (d0 > 0) zoomAt(d1 / d0, (after[0].x + after[1].x) / 2, (after[0].y + after[1].y) / 2);
        view.x -= (p.x - old.x) / 2 / width * spanX / view.zoom; view.y += (p.y - old.y) / 2 / height * spanY / view.zoom;
      } else { view.x -= (p.x - old.x) / width * spanX / view.zoom; view.y += (p.y - old.y) / height * spanY / view.zoom; }
      target = { ...view }; invalidate();
    };
    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (e.type === "pointercancel" || dragged || pointers.size) return;
      const p = local(e);
      let best = -1, distance = 22 ** 2;
      points.forEach((point, index) => { const s = project(point), d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2; if (d < distance) { distance = d; best = index; } });
      if (best >= 0) {
        if (view.zoom < 3) { setActive(null); callback.current(points[best].c); focus(points[best].c); }
        else openRef.current(best);
      }
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); const p = local(e); const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? height : 1); zoomAt(Math.exp(-Math.max(-200, Math.min(200, delta)) * .003), p.x, p.y); };
    const key = (e: KeyboardEvent) => {
      if (e.target !== el) return;
      if (["+", "=", "-", "Home", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
      if (e.key === "+" || e.key === "=") zoomAt(1.5);
      else if (e.key === "-") zoomAt(1 / 1.5);
      else if (e.key === "Home") api.current?.reset();
      else if (e.key.startsWith("Arrow")) { stop(); view.x += (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0) * spanX / view.zoom * .12; view.y += (e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0) * spanY / view.zoom * .12; target = { ...view }; invalidate(); }
    };
    const resume = () => { if (!visible || document.hidden) { cancelAnimationFrame(raf); raf = 0; stop(); Object.assign(view, target); } else invalidate(); };
    const reduce = () => { if (motion.matches) { stop(); Object.assign(view, target); invalidate(); } };
    const lost = (e: Event) => { e.preventDefault(); renderer?.dispose(); renderer?.domElement.remove(); renderer = undefined; invalidate(); };
    const ro = new ResizeObserver(resize); ro.observe(el);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume(); }); io.observe(el);
    document.addEventListener("visibilitychange", resume); motion.addEventListener("change", reduce);
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false }); el.addEventListener("keydown", key); renderer?.domElement.addEventListener("webglcontextlost", lost);
    resize();
    return () => {
      stop(); cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", resume); motion.removeEventListener("change", reduce);
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); el.removeEventListener("wheel", wheel); el.removeEventListener("keydown", key);
      renderer?.domElement.removeEventListener("webglcontextlost", lost); renderer?.domElement.remove(); renderer?.dispose(); geometry.dispose(); material.dispose(); api.current = null;
    };
  }, []);

  useEffect(() => {
    if (previousSelection.current !== selected && (active === null || points[active].c !== selected)) api.current?.select(selected);
    previousSelection.current = selected;
  }, [selected, active]);
  useEffect(() => { if (active !== null) detail.current?.focus({ preventScroll: true }); }, [active]);
  const results = query.trim() ? photos.photos.map((photo, index) => ({ photo, index })).filter(({ photo }) => photo.filename.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const pages = Math.ceil(results.length / 12);
  return <section className={styles.explorer} aria-label="Peta foto perangkat">
    <div className={styles.toolbar}>
      <button type="button" onClick={() => api.current?.zoom(1.5)} aria-label="Perbesar peta">+</button>
      <button type="button" onClick={() => api.current?.zoom(1 / 1.5)} aria-label="Perkecil peta">−</button>
      <button type="button" onClick={() => api.current?.select(selected)}>Fokus C{selected}</button>
      <button type="button" onClick={() => api.current?.reset()}>Seluruh peta</button>
      <output aria-label="Tingkat zoom">{zoom.toFixed(1)}×</output>
    </div>
    <div className={`${styles.mapArea} ${active !== null ? styles.withDetail : ""}`}>
    <div ref={host} className={styles.map} tabIndex={0} role="region" aria-label="Peta interaktif" data-zoom={zoom.toFixed(2)}>
      <div ref={canvas} className={styles.surface} aria-hidden="true"><canvas data-photo-layer="true" /></div>
    </div>
    {active !== null && <aside ref={detail} tabIndex={-1} aria-labelledby="map-photo-title" className={styles.detail} onKeyDown={e => { if (e.key === "Escape") { setActive(null); host.current?.focus(); } }}>
      <button type="button" className={styles.close} onClick={() => { setActive(null); host.current?.focus(); }}>Tutup foto</button>
      <Photo key={active} index={active} large /><h3 id="map-photo-title">{photos.photos[active]?.filename}</h3><p>C{points[active].c} · {photos.photos[active]?.label}</p>
    </aside>}
    </div>
    <div className={styles.search}>
      <label>Cari nama file <input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Keyboard_0.jpg" /></label>
      {query.trim() && <div className={styles.results} aria-live="polite">{results.length ? results.slice(page * 12, (page + 1) * 12).map(({ photo, index }) => <button type="button" key={index} onClick={() => { api.current?.locate(index); open(index); }}>{photo.filename} · C{points[index].c}</button>) : <span>File tidak ditemukan.</span>}</div>}
    </div>
    {results.length > 0 && <div className={styles.pagination}><span>{results.length} file · {page + 1}/{pages}</span><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Sebelumnya</button><button type="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Berikutnya</button></div>}

  </section>;
}
