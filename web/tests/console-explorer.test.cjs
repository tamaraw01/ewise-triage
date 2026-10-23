/* eslint-disable @typescript-eslint/no-require-imports -- Node regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function harness(file, expose = '', overrides = {}) {
  const values = [];
  let cursor = 0;
  const frames = [];
  const callbacks = [];
  let focused = '';
  const clusters = [{ id: 0 }, { id: 4 }, { id: 9 }, { id: 11 }];
  const metadata = { 4: { name: 'Battery', sub: 'Baterai', lane: 'P1', hazard: 'Jangan tusuk baterai.', action: 'Pisahkan baterai.' } };
  const node = (type, props) => ({ type, props: props || {} });
  const react = {
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], value => { values[index] = value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in values)) values[index] = { current: initial }; return values[index]; }, useEffect() {}, useCallback: fn => { callbacks.push(fn); return fn; },
  };
  const modules = {
    react,
    'react/jsx-runtime': { jsx: node, jsxs: node, Fragment: 'fragment' },
    gsap: { registerPlugin() {}, config() {} }, '@gsap/react': { useGSAP() {} },
    'next/dynamic': () => 'ClusterField', 'next/image': 'Image',
    '@/components/ExplorationTools': { default: 'ExplorationTools', researchClusters: clusters },
    '@/lib/data': { CLUSTERS_META: metadata, HANDLING_SOURCES: [{ name: 'EPA', url: 'https://www.epa.gov/recycle/used-lithium-ion-batteries' }], fixed4: n => n.toFixed(4), LANES: { P1: { code: 'P1', name: 'Bahaya', desc: 'Pisahkan' }, MR: { code: 'MR', name: 'Manual', desc: 'Periksa' } }, scatter: [] },
    '@/lib/session': {
      automaticLane: data => data.status === 'classified' ? 'P1' : 'MR',
      candidateLabel: data => data.cluster.label,
      manualExplanation: () => null,
      manualReason: data => [9, 11].includes(data.cluster.id) ? 'Jenis perangkat belum dapat dipastikan.' : '',
    },
    '@/lib/demo-records': { MAX_RECORDS: 300 },
    '@/data/meta.json': { dataset_images_used: 2660 },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + expose, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, AbortController, require: id => overrides[id] || modules[id] || { default: id }, requestAnimationFrame: fn => frames.push(fn), document: { getElementById: id => ({ focus: () => { focused = id; } }) } });
  return { render: (props = {}) => { cursor = 0; return exports.default(props); }, result: props => { cursor = 0; return exports.ResultCard(props); }, record: props => { cursor = 0; return exports.RecordDetail(props); }, frames, values, callbacks, focused: () => focused };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (typeof tree !== 'object') return String(tree);
  return text(tree.props?.text) + text(tree.props?.children);
}

test('all successful predictions record automatically once', async () => {
  for (const status of ['review', 'classified']) {
    const data = { status, cluster: { id: 4, label: 'Battery' } };
    const app = harness('components/TriagePanel.tsx', '', {
      '@/lib/api': { submitToBackend: async () => data },
      '@/lib/session': { parsePrediction: value => value, automaticLane: value => value.status === 'review' ? 'MR' : 'P1' },
    });
    const calls = [];
    const onSave = async (...args) => { calls.push(args); return ''; };
    app.render({ onSave });
    app.values[5] = { name: 'battery.jpg' };
    app.callbacks.length = 0;
    app.render({ onSave });
    await app.callbacks.at(-1)();
    assert.equal(calls.length, 1);
    const tree = app.render({ onSave });
    const button = nodes(tree).find(n => n.type === 'button' && /Catat barang ini|Barang sudah dicatat/.test(text(n)));
    assert.equal(button.props.disabled, true);
    if (status === 'review') {
      assert.equal(calls[0][1], app.values[5]);
      await button.props.onClick();
      assert.equal(calls.length, 1);
    } else {
      await button.props.onClick();
      assert.equal(calls.length, 1);
    }
  }
});

test('reset allows file B save while file A is pending; old completion keeps B locked', async () => {
  const data = { status: 'review', cluster: { id: 4, label: 'Battery' } };
  const app = harness('components/TriagePanel.tsx', '', {
    '@/lib/api': { submitToBackend: async () => data },
    '@/lib/session': { parsePrediction: value => value, automaticLane: () => 'MR' },
  });
  const calls = [];
  const pending = [];
  const onSave = (_prediction, name) => {
    calls.push(name.name);
    return new Promise(resolve => pending.push(resolve));
  };
  app.render({ onSave });
  app.values[5] = { name: 'fixture-A.jpg' };
  app.callbacks.length = 0;
  app.render({ onSave });
  const first = app.callbacks.at(-1)();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['fixture-A.jpg']);
  app.callbacks[2](); // reset invalidates A, even with its save pending.
  app.values[5] = { name: 'fixture-B.jpg' };
  app.callbacks.length = 0;
  app.render({ onSave });
  const saveB = app.callbacks.at(-2);
  const second = app.callbacks.at(-1)();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['fixture-A.jpg', 'fixture-B.jpg']);
  pending[0]('stale fixture error');
  await first;
  assert.equal(app.values[0], false);
  assert.equal(app.values[3], '');
  await saveB(data, 'fixture-B.jpg');
  assert.deepEqual(calls, ['fixture-A.jpg', 'fixture-B.jpg']);
  pending[1]('');
  await second;
  assert.equal(app.values[0], true);
});

test('MR save failure keeps result available and allows retry', async () => {
  const data = { status: 'review', cluster: { id: 4, label: 'Battery' } };
  const app = harness('components/TriagePanel.tsx', '', {
    '@/lib/api': { submitToBackend: async () => data },
    '@/lib/session': { parsePrediction: value => value, automaticLane: () => 'MR' },
  });
  let calls = 0;
  const onSave = async () => ++calls === 1 ? 'Penyimpanan penuh.' : '';
  app.render({ onSave });
  app.values[5] = { name: 'battery.jpg' };
  app.callbacks.length = 0;
  app.render({ onSave });
  await app.callbacks.at(-1)();
  let tree = app.render({ onSave });
  assert.match(text(tree), /Penyimpanan penuh/);
  const button = nodes(tree).find(n => n.type === 'button' && text(n).includes('Catat barang ini'));
  assert.equal(button.props.disabled, false);
  await button.props.onClick();
  tree = app.render({ onSave });
  assert.match(text(tree), /Barang sudah dicatat/);
  assert.equal(calls, 2);
});

test('retry keeps completed source A after auto frame B is interrupted', async () => {
  const data = { status: 'review', cluster: { id: 4, label: 'Battery' } };
  const app = harness('components/TriagePanel.tsx', '', {
    '@/lib/api': { submitToBackend: async () => data },
    '@/lib/session': { parsePrediction: value => value, automaticLane: () => 'MR' },
  });
  const sources = [];
  const onSave = async (_prediction, source) => { sources.push(source); return 'Disk full'; };
  app.render({ onSave });
  const sourceA = { name: 'frame-A.jpg' };
  app.values[5] = sourceA;
  app.callbacks.length = 0;
  app.render({ onSave });
  await app.callbacks.at(-1)();
  app.values[5] = { name: 'frame-B.jpg' }; // Interrupted next frame, completed result still A.
  const tree = app.render({ onSave });
  await nodes(tree).find(n => n.type === 'button' && text(n).includes('Catat barang ini')).props.onClick();
  assert.equal(sources.length, 2);
  assert.equal(sources[1], sourceA);
});

test('Console navigates exact group, opens persistent Explorer, focuses tab without URL change', () => {
  const app = harness('app/page.tsx');
  let tree = app.render();
  const consoleNode = nodes(tree).find(n => n.props.onExplore);
  const navigate = consoleNode.props.onExplore;
  assert.equal(navigate(4), '');
  assert.equal(app.focused(), '');
  tree = app.render();
  const panels = nodes(tree).filter(n => n.props.role === 'tabpanel');
  assert.equal(panels[0].props.hidden, true);
  assert.equal(panels[0].props.children.type, consoleNode.type);
  assert.equal(panels[1].props.hidden, false);
  assert.equal(panels[1].props.children.props.selected, 4);
  app.frames.shift()();
  assert.equal(app.focused(), 'tab-1');
  nodes(tree).find(n => n.props.id === 'tab-0').props.onClick();
  tree = app.render();
  assert.equal(nodes(tree).find(n => n.props.id === 'panel-1').props.children.props.selected, 4);
  const before = [...app.values];
  for (const invalid of [-1, 99, undefined, NaN, '4']) {
    assert.match(navigate(invalid), /tidak ada di referensi/);
    assert.deepEqual(app.values, before);
  }
});

test('Result leads with route; hazards visible and technical margin collapsed', () => {
  const app = harness('components/TriagePanel.tsx', '\nexport { ResultCard };');
  const calls = [];
  const data = { status: 'classified', margin: 0.2, threshold: 0.1, cluster: { id: 4, label: 'Battery' }, ranking: [], zero_shot: [] };
  let tree = app.result({ data, onReset() {}, onExplore: id => { calls.push(id); return 'Kelompok tidak tersedia.'; } });
  const output = text(tree);
  const labels = ['P1', 'Kelompok barang', 'Penanganan awal', 'Hasil pencocokan', 'Potensi material'];
  labels.slice(1).forEach((label, i) => assert.ok(output.indexOf(labels[i]) < output.indexOf(label)));
  const technical = nodes(tree).find(n => n.type === 'details' && text(n).includes('Detail teknis'));
  assert.equal(technical.props.open, undefined);
  assert.match(text(technical), /Selisih dua skor teratas/);
  assert.match(output, /Konfirmasi fisik dan SOP fasilitas tetap wajib/);
  assert.match(output, /Jangan tusuk baterai/);
  assert.doesNotMatch(output, /Jalur otomatis/);
  nodes(tree).find(n => n.type === 'button' && text(n).includes('Lihat kelompok pembanding')).props.onClick();
  assert.deepEqual(calls, [4]);
  tree = app.result({ data, onReset() {} });
  assert.match(text(nodes(tree).find(n => n.props.role === 'alert')), /Kelompok tidak tersedia/);
  for (const id of [9, 11, 99]) {
    const manual = app.result({ data: { ...data, status: 'review', cluster: { id, label: null, handling: 'Periksa kondisi barang.' } }, onReset() {} });
    assert.match(text(manual), /MR/);
    assert.match(text(manual), /Jangan bongkar, pecahkan, atau cacah/);
    assert.match(text(manual), id === 99 ? /Jenis barang belum pasti/ : /Jenis perangkat belum dapat dipastikan/);
  }
});

test('C9/C11 explanations render in result and saved inference; other MR stays generic', () => {
  require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  const session = require('../lib/session.ts');
  const canonical = require('../lib/data.ts');
  const priorSource = require('node:child_process').execFileSync('git', ['show', 'ae28b7a:web/lib/data.ts'], { encoding: 'utf8' });
  const prior = {};
  vm.runInNewContext(ts.transpileModule(priorSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: prior, require: () => ({ default: { points: [] } }) });
  assert.equal(JSON.stringify(canonical.CLUSTERS_META), JSON.stringify(prior.CLUSTERS_META));
  for (const id of [9, 11, 4]) {
    const data = { status: 'review', margin: .001, threshold: .0297, cluster: { id, label: null, contested: false, route: 'MANUAL_REVIEW', handling: '' } };
    const explanation = session.manualExplanation(id);
    const expected = id === 9 ? 'Foto perlu diperiksa ulang' : id === 11 ? 'Kategori pemutar musik perlu dikonfirmasi' : session.NAMING_FAILURE_REASON;
    const result = harness('components/TriagePanel.tsx', '\nexport { ResultCard };', { '@/lib/session': session, '@/lib/data': canonical }).result({ data, onReset() {} });
    assert.equal(text(nodes(result).find(n => n.props.id === 'result-device')), canonical.CLUSTERS_META[id].sub);
    assert.ok(nodes(result).some(n => n.type === 'h4' && text(n) === 'Penanganan awal'));
    const record = { id: 'old-record', fileName: 'old.jpg', createdAt: '2026-10-01T00:00:00.000Z', inference: data, reviews: [], provenance: 'backend version not supplied' };
    const before = JSON.stringify(record);
    const saved = harness('components/DemoWorkspace.tsx', '\nexport { RecordDetail };', { '@/lib/session': session, '@/lib/demo-records': require('../lib/demo-records.ts') }).record({ record });
    for (const tree of [result, saved]) {
      assert.ok(text(tree).includes(id === 4 && tree === result ? 'Jenis barang belum pasti. Petugas perlu memeriksa sebelum memilih jalur.' : expected));
      if (explanation) {
        assert.ok(nodes(tree).some(n => n.type === 'p' && text(n) === `${explanation.title}. ${explanation.body}`));
        assert.ok(!nodes(tree).some(n => /^h[1-6]$/.test(n.type) && text(n).includes(explanation.title)));
        assert.equal(text(tree).split(explanation.title).length - 1, 1);
      }
      assert.match(text(tree), /MR/);
    }
    assert.equal(JSON.stringify(record), before);
    const categories = require('../lib/demo-records.ts').categoriesForLane('MR');
    assert.ok(categories.includes('Perangkat campuran (perlu pemeriksaan)'));
    assert.ok(!categories.includes('Foto referensi perlu ditinjau'));
  }
});

test('Storage notice stays below workspace with optional details and brief loading copy', () => {
  const tree = harness('components/DemoWorkspace.tsx').render({ active: true });
  const all = nodes(tree);
  const footer = all.find(n => n.type === 'footer');
  assert.equal(footer.props.className, 'record-storage');
  assert.match(text(footer), /Tersimpan di browser ini/);
  const disclosure = nodes(footer).find(n => n.type === 'details');
  assert.equal(disclosure.props.open, undefined);
  assert.equal(text(nodes(disclosure).find(n => n.type === 'summary')), 'Tentang penyimpanan');
  for (const copy of ['300 barang', '900 MB', 'hanya berisi metadata', 'Ekspor catatan', 'identitas pengisi tidak diverifikasi', 'Bukan audit resmi', 'jam perangkat mundur']) assert.ok(text(disclosure).replace(/\s+/g, ' ').includes(copy));
  assert.equal(text(all.find(n => n.props.role === 'status')), 'Memuat…');
  assert.equal(all.some(n => n.props.className === 'demo-notice'), false);
  const section = all.find(n => n.props.className === 'demo-records');
  assert.equal(section.props.children.at(-1), footer);
});

test('Reference copy and gallery precede handling; console stays mounted', () => {
  const page = fs.readFileSync(path.join(__dirname, '../app/page.tsx'), 'utf8');
  assert.match(page, /Jumlah citra referensi/);
  assert.match(page, /<p>\{c\.action\}<\/p>/);
  assert.match(page, /<strong>Material: <\/strong>\{c\.material\}/);
  assert.doesNotMatch(page, /Ikuti SOP fasilitas setelah|Bukan komposisi yang terdeteksi|\{c\.(hazard|material)\}\./);
  assert.match(page, /Pilih kelompok untuk melihat contoh dan acuan pemeriksaan\./);
  assert.match(page, /bukan akurasi untuk foto baru/);
  assert.ok(page.indexOf('<ClusterGallery selected={selected}') < page.indexOf('className="dossier-action"'));
  assert.match(page, /hidden=\{section !== "Konsol"\}><DemoWorkspace/);
  assert.doesNotMatch(page, /location\.|href="#/);
});
