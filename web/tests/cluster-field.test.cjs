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
  const el = { ...events(), clientWidth: 500, prepend() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 320 }) };
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
    fromTo(target, from, to) { target.value = from.value; tween = { target, to }; },
  };
  const code = ts.transpileModule(fs.readFileSync(require.resolve("../components/ClusterField.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
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
        useRef: value => { const ref = { current: refs.length === 0 ? el : value }; refs.push(ref); return ref; },
        useState: () => [false, () => {}],
      };
      if (name === "three") return { ...THREE, WebGLRenderer: Renderer };
      if (name === "gsap") return gsap;
      if (name === "@/lib/data") return { scatter: [{ x: 0, y: 0, c: 0 }, { x: 1, y: 1, c: 1 }] };
      if (name === "./ClusterMap") return () => null;
      return require(name);
    },
  };
  vm.runInNewContext(code, context);
  context.exports.default({ selected: 0, onSelect() {} });
  const cleanup = effects[0]();
  const select = id => refs[1].current.select(id);
  const flush = () => {
    for (let i = 0; frames.size && i < 200; i++) {
      const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn());
    }
    assert.equal(frames.size, 0, "idle view must stop requesting frames");
  };
  flush();
  select(1);
  assert.ok(tween);
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
  listeners.get("pointermove")({ clientX: 500, clientY: 320 });
  select(5);
  motion.matches = true;
  listeners.get("change")();
  assert.equal(tween, null);
  const beforeReduced = renders;
  flush();
  assert.equal(renders, beforeReduced + 1, "reduced motion must reset without easing frames");
  listeners.get("pointermove")({ clientX: 500, clientY: 320 });
  listeners.get("pointerleave")();
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
