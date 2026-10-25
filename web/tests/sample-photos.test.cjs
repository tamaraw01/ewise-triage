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
