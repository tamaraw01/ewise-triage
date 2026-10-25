/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { File } = require('node:buffer');
const source = fs.readFileSync('components/TriagePanel.tsx', 'utf8');

function selection(fetch) {
  const state = { phase: 'idle', selected: [], error: '' };
  const context = {
    active: true, phase: 'idle', cameraActive: false,
    sampleRequest: { current: null }, request: { current: null }, cameraStarting: { current: false },
    AbortController, File, fetch,
    reset() { context.request.current?.abort(); context.sampleRequest.current = null; state.phase = 'idle'; },
    setPhase(value) { state.phase = value; },
    setError(value) { state.error = value; },
    selectFile(file) { context.reset(); state.selected.push(file); },
  };
  const handler = source.slice(source.indexOf('  const selectSample ='), source.indexOf('  const handleFileChange ='))
    .replace('const selectSample =', 'globalThis.selectSample =').replace('filename: string', 'filename');
  vm.runInNewContext(handler, context);
  return { state, context };
}

test('four original WebP samples use existing selection and backend auto-submit', async () => {
  const samples = [...source.matchAll(/label: "([^"]+)", filename: "([^"]+\.webp)"/g)];
  assert.deepEqual(samples.map(s => s[1]), ['Kipas angin', 'PCB', 'Pengisi daya', 'Mesin cuci']);
  for (const [, , name] of samples) {
    const bytes = fs.readFileSync(`public/samples/${name}`);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    const { state, context } = selection(async (url, options) => {
      assert.equal(url, `/samples/${name}`);
      assert.ok(options.signal instanceof AbortSignal);
      return { ok: true, blob: async () => new Blob([bytes]) };
    });
    await context.selectSample(name);
    assert.equal(state.selected.length, 1);
    assert.equal(state.selected[0].name, name);
    assert.equal(state.selected[0].type, 'image/webp');
    assert.deepEqual(Buffer.from(await state.selected[0].arrayBuffer()), bytes);
  }
  assert.match(source, /selectFile\(new File\(\[blob\], filename, \{ type: "image\/webp" \}\)\)/);
  assert.match(source, /if \(file && phase === "idle"\)/);
  assert.match(source, /await submitToBackend\(file, controller.signal\)/);
  assert.match(source, /disabled=\{busy \|\| cameraPending \|\| cameraActive \|\| !active\}/);
});

test('native sample dialog opens only on click, hides names and defers images', () => {
  const css = fs.readFileSync('app/globals.css', 'utf8');
  const dialog = source.slice(source.indexOf('          <dialog ref={samplesDialogRef}'), source.indexOf('          </dialog>'));
  assert.match(source, /const \[samplesOpen, setSamplesOpen\] = useState\(false\)/);
  assert.equal((source.match(/\.showModal\(\)/g) || []).length, 1);
  assert.match(source, /aria-haspopup="dialog" onClick=\{\(\) => \{\s*samplesDialogRef.current\?\.showModal\(\);\s*setSamplesOpen\(true\);/);
  assert.match(dialog, /aria-labelledby="samples-title" onClose=\{\(\) => setSamplesOpen\(false\)\}/);
  assert.match(dialog, /\{samplesOpen && <div className="sample-grid">/);
  assert.match(dialog, /aria-label=\{sample.label\}/);
  assert.match(dialog, /alt=""/);
  assert.doesNotMatch(dialog, /<span>|>\{sample.label\}|onCancel|onKeyDown/);
  assert.match(dialog, /onClick=\{closeSamples\}>Tutup/);
  assert.match(css, /\.sample-grid \{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);

  const events = [];
  const context = {
    samplesDialogRef: { current: { close() { events.push('close'); } } },
    setSamplesOpen(value) { events.push(value); },
    useCallback: fn => fn,
    selectSample(filename) { events.push(filename); },
    sample: { filename: 'ppcb_sampelz.webp' },
  };
  vm.runInNewContext(source.slice(source.indexOf('  const closeSamples ='), source.indexOf('  useEffect(() => {\n    if (!active)'))
    .replace('const closeSamples =', 'globalThis.closeSamples ='), context);
  const click = dialog.match(/onClick=\{\(\) => \{([\s\S]*?)\}\}/)[1];
  vm.runInNewContext(click, context);
  assert.deepEqual(events, ['close', 'ppcb_sampelz.webp']);
  vm.runInNewContext(dialog.match(/onClose=\{\(\) => ([^}]+)\}/)[1], context);
  assert.equal(events.at(-1), false);
});

test('inactive panel and hidden browser tab close dialog without dropping camera or cancellation guards', () => {
  const inactiveEffect = source.slice(source.indexOf('  useEffect(() => {\n    if (!active)'), source.indexOf('  useEffect(() => releaseCamera'));
  const visibilityEffect = source.slice(source.indexOf('  useEffect(() => {\n    const hide ='), source.indexOf('  useEffect(() => () => request.current?.abort()'));
  const calls = [];
  const context = {
    active: false,
    sampleRequest: { current: { abort() { calls.push('abort'); } } },
    closeSamples() { calls.push('close'); },
    stopCamera() { calls.push('camera'); },
    setPhase(value) { calls.push(value); },
    useEffect(fn) { context.cleanup = fn(); },
    document: {
      hidden: false,
      addEventListener(event, fn) { assert.equal(event, 'visibilitychange'); context.hide = fn; },
      removeEventListener(event, fn) { assert.equal(event, 'visibilitychange'); assert.equal(fn, context.hide); },
    },
  };
  vm.runInNewContext(inactiveEffect, context);
  assert.deepEqual(calls, ['close', 'camera', 'abort', 'idle']);
  assert.equal(context.sampleRequest.current, null);
  calls.length = 0;
  vm.runInNewContext(visibilityEffect, context);
  context.hide();
  assert.deepEqual(calls, []);
  context.document.hidden = true;
  context.hide();
  assert.deepEqual(calls, ['close', 'camera']);
  context.cleanup();
});

test('sample selection blocks overlap, ignores cancelled blobs, recovers from fetch failure', async () => {
  let release;
  const { state, context } = selection(async () => ({ ok: true, blob: () => new Promise(resolve => { release = resolve; }) }));
  const pending = context.selectSample('kipasangin_sampel.webp');
  await Promise.resolve();
  assert.equal(state.phase, 'loading');
  await context.selectSample('ppcb_sampelz.webp');
  context.reset();
  release(new Blob(['stale']));
  await pending;
  assert.equal(state.selected.length, 0);
  assert.equal(state.phase, 'idle');
  assert.equal(context.sampleRequest.current, null);

  context.fetch = async () => ({ ok: false });
  await context.selectSample('ppcb_sampelz.webp');
  assert.equal(state.phase, 'error');
  assert.match(state.error, /Foto contoh gagal dimuat/);
  assert.equal(context.sampleRequest.current, null);
  context.fetch = async () => ({ ok: true, blob: async () => new Blob(['new']) });
  await context.selectSample('ppcb_sampelz.webp');
  assert.equal(state.selected.length, 1);
  context.cameraStarting.current = true;
  await context.selectSample('ppcb_sampelz.webp');
  assert.equal(state.selected.length, 1);
});
