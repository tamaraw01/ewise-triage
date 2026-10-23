/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS regression harness. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const THREE = require("three");

// Exercise component lifecycle without requiring GPU or browser dependencies.
test("ClusterField stops hidden work and responds to live reduced motion", () => {
  const listeners = new Map();
  const events = () => ({
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); },
  });
  const el = { ...events(), clientWidth: 500, clientHeight: 320, prepend() {}, querySelector: () => null, querySelectorAll: () => [], setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 320 }) };
  const motion = { ...events(), matches: false };
  const document = { ...events(), hidden: false, documentElement: {} };
  const frames = new Map(), effects = [], refs = [];
  let nextFrame = 0, renders = 0, tween = null, intersection;
  class Renderer {
    domElement = { ...events(), remove() {} };
    setPixelRatio() {} setSize() {} dispose() {}
    render() { renders++; }
  }
  const gsap = {
    killTweensOf() { tween = null; },
    to(target, to) { tween = { target, to }; },
  };
  const code = ts.transpileModule(fs.readFileSync(require.resolve("../components/ClusterField.tsx"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const context = {
    exports: {}, document, devicePixelRatio: 1,
    getComputedStyle: () => ({ getPropertyValue: () => "#ffffff" }),
    matchMedia: () => motion,
    requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} disconnect() {} },
    require: name => {
      if (name === "react") return {
        useEffect: fn => effects.push(fn),
        useRef: value => { const ref = { current: refs.length < 2 ? el : value }; refs.push(ref); return ref; },
        useState: value => [value, () => {}],
      };
      if (name === "three") return { ...THREE, WebGLRenderer: Renderer };
      if (name === "gsap") return gsap;
      if (name === "@/lib/scatter") return { CLUSTERS_META: Object.fromEntries(Array.from({length: 8}, (_, i) => [i, {}])), scatter: Array.from({length: 8}, (_, c) => ({x: c, y: c, c})) };
      if (name === "@/data/map-photos.json") return { photos: [] };
      if (name === "@/data/map-atlas.json") return { entries: [], pages: [] };
      if (name === "@/lib/map-layout") { const m = { exports: {} }; vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve("../lib/map-layout.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: m.exports }); return m.exports; }
      if (name.endsWith(".module.css")) return {};
      if (name === "./ClusterMap") return () => null;
      return require(name);
    },
  };
  vm.runInNewContext(code, context);
  context.exports.default({ selected: 0, onSelect() {} });
  effects[0]();
  const cleanup = effects[1]();
  const select = id => refs[3].current.select(id);
  const flush = () => {
    for (let i = 0; frames.size && i < 200; i++) {
      const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn());
    }
    assert.equal(frames.size, 0, "idle view must stop requesting frames");
  };
  flush();
  const click = { button: 0, pointerId: 1, clientX: 250 + .5 / (7 * 1.18) * 320, clientY: 160 - .5 / (7 * 1.18) * 320, target: { closest: () => null } };
  listeners.get("pointerdown")(click);
  listeners.get("pointerup")(click);
  assert.ok(tween, "overview point click must focus cluster, not open photo");
  assert.equal(tween.to.x, 4);
  assert.equal(tween.to.y, 4, "positive notebook Y must stay positive in Explorer");
  assert.ok(tween.to.zoom > 1);
  gsap.killTweensOf();
  const idleRenders = renders;
  for (let i = 0; i < 40; i++) listeners.get("wheel")({ preventDefault() {}, clientX: 250, clientY: 160, deltaY: -2, deltaMode: 0 });
  assert.equal(frames.size, 1, "gesture burst must coalesce into one scheduled frame");
  flush();
  assert.equal(renders, idleRenders + 1);
  select(1);
  assert.ok(tween);
  select(2);
  assert.equal(tween.to.x, 2, "latest selection owns camera target");
  refs[3].current.reset();
  assert.equal(tween.to.zoom, 1);
  select(2);
  assert.equal(tween.to.x, 2, "same selected cluster refocuses after overview reset");
  document.hidden = true;
  listeners.get("visibilitychange")();
  assert.equal(frames.size, 0);
  assert.equal(tween, null);
  const hiddenRenders = renders;
  select(2);
  assert.equal(tween, null);
  assert.equal(renders, hiddenRenders);
  document.hidden = false;
  listeners.get("visibilitychange")();
  assert.equal(frames.size, 1);
  flush();
  select(3);
  assert.ok(tween);
  intersection([{ isIntersecting: false }]);
  assert.equal(frames.size, 0);
  assert.equal(tween, null);
  select(4);
  assert.equal(tween, null);
  intersection([{ isIntersecting: true }]);
  flush();
  listeners.get("pointermove")({ pointerId: 1, clientX: 500, clientY: 320 });
  select(5);
  motion.matches = true;
  listeners.get("change")();
  assert.equal(tween, null);
  const beforeReduced = renders;
  flush();
  assert.equal(renders, beforeReduced + 1, "reduced motion must reset without easing frames");
  listeners.get("pointermove")({ pointerId: 1, clientX: 500, clientY: 320 });
  assert.equal(frames.size, 0);
  select(6);
  assert.equal(tween, null);
  flush();
  motion.matches = false;
  listeners.get("change")();
  select(7);
  assert.ok(tween, "animations recover when reduced motion is disabled");
  cleanup();
  assert.equal(frames.size, 0);
  assert.equal(tween, null);
  assert.equal(listeners.size, 0);
});
