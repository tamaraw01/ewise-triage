"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LANES } from "@/lib/data";
import "./implementation.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Steps follow the factory scenario drawn in the BDC implementation slide.
const steps = [
  ["Truk", "Bongkar muatan di area penerimaan."],
  ["Konveyor", "Papan masuk ke nampan."],
  ["Sensor", "Nampan lewat, foto dipicu."],
  ["Kamera", "Foto ditautkan ke NP-007."],
  ["Edge PC", "Komputer lokal mencocokkan klaster."],
  ["Operator", "Petugas memeriksa hasil dan bahaya."],
] as const;

const outcomes = [
  { cluster: "C3", name: "PCB", lane: "P2", margin: "0,088 dan 0,081", note: "Pemulihan komponen.", tone: "ok" },
  { cluster: "C4", name: "Baterai Li-ion", lane: "P1", margin: "0,064", note: "Penanganan khusus · periksa kimia baterai.", tone: "hazard" },
  { cluster: "C9", name: "Tidak yakin", lane: "MR", margin: "0,008", note: "Wajib diperiksa petugas.", tone: "manual" },
] as const;

// Belt geometry (world units). Tray i sits at TRAY_X0 + i*GAP + shift.
const GAP = 1.4, TRAY_X0 = -7, SPECIAL = 2, SENSOR_X = -1.5, CAM_X = 1.2, EDGE = new THREE.Vector3(4.6, 0.55, -2.3);
const focusX = [-10.2, -3.2, -1.5, 1.2, 3.4, 4.8];
const shiftAt = [0, 1.4, 2.7, 5.4, 5.4, 8];

function mat(color: number, rough = 0.85) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 }); }
function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
}

function monitorTexture() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 320;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1a1f18"; g.fillRect(0, 0, 512, 320);
  g.font = "600 22px 'IBM Plex Sans', sans-serif"; g.fillStyle = "#b9c2b5"; g.fillText("NP-007 · hasil nampan", 24, 40);
  const rows: [string, string, string][] = [["C3 PCB", "P2", "#a7ba83"], ["C4 Li-ion", "P1", "#ebad4a"], ["C9 ?", "MR", "#ebad4a"]];
  rows.forEach(([a, b, col], i) => {
    const y = 70 + i * 76;
    g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(24, y, 464, 60);
    g.fillStyle = col; g.fillRect(24, y, 84, 60);
    g.fillStyle = "#1a1f18"; g.font = "700 26px 'IBM Plex Sans', sans-serif"; g.fillText(b, 44, y + 40);
    g.fillStyle = "#eeeade"; g.font = "600 26px 'IBM Plex Sans', sans-serif"; g.fillText(a, 130, y + 40);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function Implementation() {
  const root = useRef<HTMLElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [outcome, setOutcome] = useState(0);
  const selectedStep = useRef(0);
  const chooseDevice = useRef<(i: number) => void>(() => {});
  const [failed, setFailed] = useState(false);
  const [systemReduce, setSystemReduce] = useState(false);
  const [manualReduce, setManualReduce] = useState<boolean | null>(null);
  const reduce = manualReduce ?? systemReduce;
  const jump = useRef<(i: number) => void>(() => {});

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setSystemReduce(media.matches); setManualReduce(null); };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useGSAP(() => {
    const hostEl = host.current, wrapEl = wrap.current;
    if (!hostEl || !wrapEl) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch {
      setFailed(true);
      jump.current = i => { selectedStep.current = i; setStep(i); };
      return () => { jump.current = () => {}; };
    }
    setFailed(false);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    hostEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
    scene.add(new THREE.HemisphereLight(0xeeeade, 0x718174, 2.1));
    const sun = new THREE.DirectionalLight(0xfff3dc, 2.2); sun.position.set(-4, 8, 6); scene.add(sun);

    const sage = mat(0xa7ba83), amber = mat(0xebad4a, 0.5), bone = mat(0xeeeade), iron = mat(0x2d3930), dark = mat(0x232a23), steel = mat(0xa3afa4, 0.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), mat(0x20271f)); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.55; scene.add(floor);

    // conveyor: bed, side rails, legs
    scene.add(box(15, 0.14, 1.7, iron, 0, -0.07, 0));
    [-0.9, 0.9].forEach(z => scene.add(box(15, 0.22, 0.08, steel, 0, 0.02, z)));
    for (let i = -7; i <= 7; i += 2.5) scene.add(box(0.12, 0.5, 0.12, steel, i, -0.32, 0.75), box(0.12, 0.5, 0.12, steel, i, -0.32, -0.75));

    for (let x = -7; x <= 7; x += 0.5) scene.add(box(0.025, 0.015, 1.65, steel, x, 0.01, 0));

    // Delivery bay stays clear of the belt: truck bounds end at x=-10.2, belt starts at -7.5.
    const truck = new THREE.Group();
    const paint = mat(0xa7ba83, 0.35), glass = mat(0x273f40, 0.18), rubber = mat(0x151b18);
    const rounded = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, radius = 0.08) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), m);
      mesh.position.set(x, y, z); truck.add(mesh); return mesh;
    };
    rounded(4.7, 0.22, 1.65, dark, 0, 0.04, 0);
    rounded(2.9, 1.65, 1.85, bone, 0.72, 1.02, 0, 0.12);
    rounded(1.55, 1.32, 1.72, paint, -1.65, 0.89, 0, 0.18);
    rounded(0.62, 0.53, 1.72, paint, -2.05, 0.51, 0, 0.13);
    const windshield = rounded(0.07, 0.58, 1.45, glass, -2.43, 1.12, 0, 0.025);
    windshield.rotation.z = -0.12;
    [-1, 1].forEach(side => {
      rounded(0.94, 0.56, 0.04, glass, -1.56, 1.13, side * 0.875, 0.05);
      rounded(0.23, 0.06, 0.05, steel, -1.15, 0.72, side * 0.885, 0.02);
      rounded(0.12, 0.28, 0.16, dark, -2.15, 1.1, side * 1.02, 0.035);
      rounded(2.5, 0.13, 0.03, sage, 0.72, 0.61, side * 0.935, 0.02);
      [-1.8, 1.35].forEach(x => {
        const fender = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.065, 8, 24, Math.PI), paint);
        fender.position.set(x, -0.02, side * 0.88); truck.add(fender);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 24), rubber);
        wheel.rotation.x = Math.PI / 2; wheel.position.set(x, -0.18, side * 0.89); truck.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.025, 20), steel);
        hub.rotation.x = Math.PI / 2; hub.position.set(x, -0.18, side * 1.025); truck.add(hub);
      });
      rounded(0.04, 0.18, 0.28, bone, -2.48, 0.48, side * 0.56, 0.025);
    });
    rounded(0.12, 0.18, 1.8, steel, -2.5, 0.18, 0, 0.04);
    rounded(0.04, 0.2, 0.68, dark, -2.49, 0.48, 0, 0.02);
    truck.position.set(-12.4, 0, 4.2); scene.add(truck);
    // Painted bay and unloaded cargo make the hand-off explicit without joining machines.
    scene.add(box(6.0, 0.025, 3.1, iron, -12.4, -0.53, 4.2));
    [-1, 1].forEach(side => scene.add(box(5.8, 0.012, 0.055, sage, -12.4, -0.51, 4.2 + side * 1.45)));
    const cargo = new THREE.Group();
    cargo.add(box(0.85, 0.12, 0.85, steel, 0, -0.41, 0), box(0.7, 0.55, 0.7, bone, 0, -0.08, 0), box(0.12, 0.56, 0.71, sage, 0, -0.08, 0));
    cargo.position.set(-8.65, 0, 1.5); scene.add(cargo);

    // trays carry boards; special tray is the one the camera reads
    const trays: THREE.Group[] = [];
    const devices: THREE.Group[] = [];
    for (let i = 0; i < 12; i++) {
      const t = new THREE.Group();
      t.add(box(1.0, 0.07, 1.2, i === SPECIAL ? amber : bone, 0, 0.04, 0));
      const device = new THREE.Group(); t.add(device); devices.push(device);
      const pcb = box(0.62, 0.05, 0.78, mat(0x4f7a4a), (i % 3 - 1) * 0.04, 0.1, 0.0); pcb.rotation.y = (i % 4) * 0.12 - 0.15; device.add(pcb);
      device.add(box(0.24, 0.09, 0.25, dark, 0, 0.17, 0), box(0.48, 0.06, 0.07, bone, 0, 0.15, 0.3));
      for (let k = 0; k < 5; k++) {
        const x = -0.22 + k * 0.11;
        device.add(box(0.025, 0.015, 0.5, sage, x, 0.132, 0), box(0.055, 0.025, 0.09, amber, x, 0.145, -0.31));
      }
      [-0.57, 0.57].forEach(z => t.add(box(1, 0.09, 0.04, i === SPECIAL ? sage : steel, 0, 0.1, z)));
      scene.add(t); trays.push(t);
    }

    // sensor gate and overhead camera mast
    const gate = new THREE.Group();
    gate.add(box(0.1, 0.9, 0.1, steel, 0, 0.45, 1.0), box(0.1, 0.9, 0.1, steel, 0, 0.45, -1.0), box(0.1, 0.1, 2.1, steel, 0, 0.9, 0));
    gate.add(box(0.24, 0.3, 0.2, bone, 0, 0.52, 0.9), box(0.16, 0.15, 0.035, dark, 0, 0.52, 0.78), box(0.07, 0.07, 0.04, sage, 0, 0.56, 1.02));
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xebad4a, transparent: true, opacity: 0 });
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 2.0), ringMat); ring.position.y = 0.55; gate.add(ring);
    gate.position.x = SENSOR_X; scene.add(gate);

    const mast = new THREE.Group();
    mast.add(box(0.12, 2.5, 0.12, steel, 0, 1.2, -1.1), box(0.12, 0.12, 1.2, steel, 0, 2.45, -0.5), box(0.65, 0.38, 0.52, bone, 0, 2.4, 0.05), box(0.46, 0.08, 0.42, steel, 0, 2.63, 0.05), box(0.08, 0.08, 0.02, sage, 0.2, 2.42, 0.32));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.25, 24), dark); barrel.position.set(0, 2.12, 0.05); mast.add(barrel);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0xeeeade, emissive: 0xa7ba83, emissiveIntensity: 0 })); lens.position.set(0, 1.98, 0.05); mast.add(lens);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xa7ba83, transparent: true, opacity: 0, depthWrite: false });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.2, 4, 1, true), coneMat); cone.position.set(0, 1.12, 0.05); cone.rotation.y = Math.PI / 4; mast.add(cone);
    mast.position.x = CAM_X; scene.add(mast);

    // edge PC with cable from the camera
    const edge = new THREE.Group();
    edge.add(box(1.5, 1.0, 0.9, steel, 0, 0, 0), box(1.34, 0.84, 0.025, dark, 0, 0, 0.46));
    for (let i = 0; i < 7; i++) edge.add(box(0.05, 0.07, 0.75, bone, -0.6 + i * 0.2, 0.53, 0));
    edge.add(box(0.12, 0.08, 0.035, sage, 0.52, -0.3, 0.49));
    const bars = [0, 1, 2].map(i => { const b = box(1, 0.08, 0.02, sage, 0, 0.25 - i * 0.22, 0.46); b.scale.x = 0.001; edge.add(b); return b; });
    edge.position.copy(EDGE); scene.add(edge);
    const camTop = new THREE.Vector3(CAM_X, 2.4, -0.4);
    const path = new THREE.CatmullRomCurve3([camTop, new THREE.Vector3(CAM_X + 0.4, 2.7, -1.4), new THREE.Vector3(3.4, 1.4, -2.2), EDGE.clone().add(new THREE.Vector3(-0.8, 0.2, 0))]);
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(40)), new THREE.LineBasicMaterial({ color: 0xa7ba83 })));
    const packet = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), amber); packet.visible = false; scene.add(packet);

    // operator desk, monitor, simple figure
    const desk = new THREE.Group();
    const tex = monitorTexture();
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: tex }));
    screen.position.set(0, 1.0, 0.06);
    desk.add(box(2.0, 0.1, 1.0, iron, 0, 0.55, 0.3), box(0.1, 0.55, 0.1, steel, -0.9, 0.25, 0.3), box(0.1, 0.55, 0.1, steel, 0.9, 0.25, 0.3), box(1.8, 1.15, 0.08, dark, 0, 1.05, 0), screen);
    const person = new THREE.Group();
    person.add(box(0.5, 0.8, 0.3, sage, 0, 0.4, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), bone); head.position.y = 1.0; person.add(head);
    person.position.set(0.1, -0.05, 1.5); desk.add(person);
    desk.position.set(6.4, -0.4, -1.8); desk.rotation.y = -0.45; scene.add(desk);

    // labels follow world points; keyed to the step where they matter
    const labelEls = Array.from(root.current!.querySelectorAll<HTMLElement>("[data-label]"));
    const anchors: Record<string, () => THREE.Vector3> = {
      truk: () => new THREE.Vector3(-12.4, 2.0, 4.2), konveyor: () => new THREE.Vector3(-4.2, 0.55, 0.9), sensor: () => new THREE.Vector3(SENSOR_X, 1.2, 1.0),
      kamera: () => new THREE.Vector3(CAM_X, 2.9, 0.1), edge: () => new THREE.Vector3(EDGE.x, 1.3, EDGE.z), operator: () => new THREE.Vector3(6.5, 2.2, -1.8),
      nampan: () => trays[SPECIAL].position.clone().setY(0.55),
    };

    const state = { shift: 0, camFocus: focusX[0], scan: 0, flash: 0, ping: 0, packet: 0, build: 0, screen: 0 };
    const tmp = new THREE.Vector3();
    let W = 1, H = 1;
    const render = () => {
      const aspect = W / H, wide = aspect < 1 ? 1.35 : 1;
      const receiving = 1 - THREE.MathUtils.smoothstep(state.shift, 0, 1.4);
      const dist = 11.5 * wide * (aspect < 1 ? 1.2 : 1) * (1 + receiving * (aspect < 1 ? 1.1 : 0.4));
      camera.position.set(state.camFocus - 3.2 * wide, 3.6 * wide + 1 + receiving * 1.4, dist * 0.78);
      camera.lookAt(state.camFocus + 0.6 - (aspect < 1 ? receiving * 3 : 0), 0.8 - receiving * 1.8, -0.2 + receiving * 1.8);
      // Delivery wheels stay inside the receiving frame; later stages retain their tighter aim.
      truck.position.x = -12.4 - state.shift * 1.4;
      trays.forEach((t, i) => {
        const x = TRAY_X0 + i * GAP + state.shift; t.position.set(x, 0, 0);
        const edgeFade = Math.min(1, Math.max(0, (x + 6.6) * 1.5), Math.max(0, (7.2 - x) * 1.5)); t.scale.setScalar(Math.max(0.001, edgeFade));
      });
      ringMat.opacity = state.ping * 0.9;
      coneMat.opacity = state.scan * 0.28; (lens.material as THREE.MeshStandardMaterial).emissiveIntensity = state.flash * 2;
      packet.visible = state.packet > 0 && state.packet < 1; if (packet.visible) { packet.position.copy(path.getPoint(state.packet)); packet.rotation.y = state.packet * 8; }
      bars.forEach((b, i) => { const v = Math.min(1, Math.max(0, state.build * 3 - i)); b.scale.x = Math.max(0.001, v); b.position.x = (v - 1) * 0.5; });
      (screen.material as THREE.MeshBasicMaterial).opacity = 1; screen.visible = state.screen > 0.01; screen.scale.setScalar(0.6 + 0.4 * state.screen);
      labelEls.forEach(el => {
        const key = el.dataset.label!; const active = Number(el.dataset.step) === currentStep;
        tmp.copy(anchors[key]()).project(camera);
        el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * W}px, ${(-tmp.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
        el.dataset.active = String(active);
        el.hidden = !active;
      });
      renderer.render(scene, camera);
    };

    chooseDevice.current = i => {
      devices.forEach(device => {
        device.children.forEach(child => { child.visible = i !== 1; });
        let battery = device.getObjectByName("battery");
        if (!battery) {
          battery = box(0.45, 0.22, 0.7, amber, 0, 0.2, 0);
          battery.name = "battery"; device.add(battery);
        }
        battery.visible = i === 1;
      });
      render();
    };
    const contextLost = (event: Event) => { event.preventDefault(); setFailed(true); };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    let currentStep = selectedStep.current;
    const size = () => { W = hostEl.clientWidth; H = hostEl.clientHeight; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); render(); };
    const ro = new ResizeObserver(size); ro.observe(hostEl);

    // one scrubbed timeline, six equal beats
    const tl = gsap.timeline({ paused: true, defaults: { ease: "none", duration: 1 }, onUpdate: render });
    steps.forEach((_, i) => {
      const at = i;
      tl.to(state, { shift: shiftAt[i], camFocus: focusX[i], duration: 0.7, ease: "power2.inOut" }, at);
    });
    tl.to(state, { ping: 1, duration: 0.15 }, 2.65).to(state, { ping: 0, duration: 0.2 }, 2.85);
    tl.to(state, { scan: 1, duration: 0.15 }, 3.15).to(state, { flash: 1, duration: 0.05 }, 3.3).to(state, { flash: 0, duration: 0.15 }, 3.35).to(state, { scan: 0, duration: 0.15 }, 3.85);
    tl.to(state, { packet: 1, duration: 0.55 }, 4.05).to(state, { build: 1, duration: 0.5 }, 4.45);
    tl.to(state, { screen: 1, duration: 0.5 }, 5.15);
    tl.set({}, {}, 6);

    const apply = (p: number) => {
      const i = Math.min(steps.length - 1, Math.floor(p * steps.length));
      currentStep = i; selectedStep.current = i; setStep(i); tl.progress(p);
    };
    const mm = gsap.matchMedia();
    mm.add({ motion: "(prefers-reduced-motion: no-preference)", still: "(prefers-reduced-motion: reduce)" }, ctx => {
      const still = ctx.conditions?.still || reduce;
      if (still) {
        apply((selectedStep.current + 0.9) / steps.length);
        jump.current = i => apply((i + 0.9) / steps.length);
        return;
      }
      const st = ScrollTrigger.create({ trigger: wrapEl, start: "top top", end: "bottom bottom", onUpdate: self => apply(self.progress * 0.999) });
      jump.current = i => {
        const y = st.start + (st.end - st.start) * ((i + 0.5) / steps.length);
        scrollTo({ top: y, behavior: "smooth" });
      };
      apply(st.progress * 0.999);
    });
    size();
    ScrollTrigger.refresh();
    return () => {
      mm.revert(); ro.disconnect(); tl.kill();
      jump.current = () => {}; chooseDevice.current = () => {};
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose(); [m.material].flat().forEach(x => { if (x) { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); } }); });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, { scope: root, dependencies: [reduce], revertOnUpdate: true });

  useEffect(() => { chooseDevice.current(outcome); }, [outcome, reduce]);

  const labels: [string, number, string][] = [["truk", 0, "Truk"], ["konveyor", 1, "Konveyor"], ["sensor", 2, "Sensor nampan"], ["nampan", 3, "NP-007"], ["kamera", 3, "Kamera atas"], ["edge", 4, "Edge PC"], ["operator", 5, "Operator"]];
  return (
    <section ref={root} className="impl" aria-labelledby="impl-title" data-reduced={reduce}>
      <header className="impl-head">
        <h2 id="impl-title" className="sr-only">Alur implementasi</h2>
        <p>Skema · belum terhubung ke perangkat</p>
        <button type="button" className="btn" aria-pressed={reduce} onClick={() => setManualReduce(!reduce)}>Kurangi gerak: {reduce ? "aktif" : "nonaktif"}</button>
      </header>
      <div className="impl-scenarios" role="group" aria-label="Contoh muatan">
        {outcomes.map((o, i) => <button className="btn" key={o.cluster} type="button" aria-pressed={outcome === i} onClick={() => setOutcome(i)}>{o.cluster} · {o.name}</button>)}
      </div>
      <div ref={wrap} className="impl-track" data-failed={failed}>
        <div className="impl-stage">
          <div ref={host} className="impl-canvas" role="img" aria-label={`Adegan pabrik tiga dimensi, langkah ${step + 1}: ${steps[step][0]}`} />
          {failed && <p className="impl-fail" role="alert">Tampilan 3D tidak tersedia. Pilih tahap untuk membaca alur.</p>}
          <div className="impl-labels" aria-hidden="true">{labels.map(([k, s, text]) => <span key={k} data-label={k} data-step={s}>{text}</span>)}</div>
          <div className="impl-copy" aria-live="polite">
            <span className="num impl-no">{step + 1}/{steps.length}</span>
            <p>{steps[step][1]}</p>
          </div>
          <ol className="impl-rail" aria-label="Langkah implementasi">
            {steps.map(([name], i) => <li key={name}><button type="button" aria-current={step === i ? "step" : undefined} onClick={() => jump.current(i)}><span className="num">{i + 1}</span><span>{name}</span></button></li>)}
          </ol>
        </div>
      </div>
      <div className="impl-result">
        <ul aria-label="Jalur penanganan" aria-live="polite">
          {outcomes.filter(o => outcomes[outcome] === o).map(o => <li key={o.cluster} data-tone={o.tone} data-selected="true">
            <span className="num impl-cl">{o.cluster}</span>
            <div><b>{o.name}</b><span>{o.note}</span></div>
            <div className="impl-lane"><span className="num">{o.lane}</span><small>{LANES[o.lane].name}</small></div>

          </li>)}
        </ul>
        <details className="impl-limits"><summary>Detail teknis & batas skema</summary>
          <p>CLIP + centroid mencocokkan foto pada Edge PC. Margin contoh: {outcomes.map(o => `${o.cluster}: ${o.margin}`).join("; ")}.</p>
          <p>Nota 100 PCB, nomor NP-007, dan margin per nampan adalah contoh dari rancangan, bukan hasil uji pabrik. Bentuk 3D bersifat skematis; objek campuran tidak mengidentifikasi jenis perangkat. Integrasi sensor, kamera, Edge PC, serta pencatatan nampan masih rancangan, bukan koneksi perangkat yang aktif. Margin adalah selisih skor dua klaster teratas, bukan probabilitas. C9 dan C11 tetap diperiksa manual. Penanganan oleh petugas terlatih sesuai SOP fasilitas.</p>
        </details>
      </div>
    </section>
  );
}
