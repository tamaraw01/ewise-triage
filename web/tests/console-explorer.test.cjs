/* eslint-disable @typescript-eslint/no-require-imports -- Node regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function harness(file, expose = '') {
  const values = [];
  let cursor = 0;
  const frames = [];
  let focused = '';
  const clusters = [{ id: 0 }, { id: 4 }, { id: 9 }, { id: 11 }];
  const metadata = { 4: { name: 'Battery', sub: 'Baterai', lane: 'P1', hazard: 'Jangan tusuk baterai.', action: 'Pisahkan baterai.' } };
  const node = (type, props) => ({ type, props: props || {} });
  const react = {
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], value => { values[index] = value; }]; },
    useRef: () => ({ current: null }), useEffect() {}, useCallback: fn => fn,
  };
  const modules = {
    react,
    'react/jsx-runtime': { jsx: node, jsxs: node, Fragment: 'fragment' },
    gsap: { registerPlugin() {}, config() {} }, '@gsap/react': { useGSAP() {} },
    'next/dynamic': () => 'ClusterField', 'next/image': 'Image',
    '@/components/ExplorationTools': { default: 'ExplorationTools', researchClusters: clusters },
    '@/lib/data': { CLUSTERS_META: metadata, fixed4: n => n.toFixed(4), LANES: { P1: { code: 'P1', name: 'Bahaya', desc: 'Pisahkan' }, MR: { code: 'MR', name: 'Manual', desc: 'Periksa' } }, scatter: [] },
    '@/lib/session': {
      automaticLane: data => data.status === 'classified' ? 'P1' : 'MR',
      candidateLabel: data => data.cluster.label,
      manualReason: data => [9, 11].includes(data.cluster.id) ? 'Jenis perangkat belum dapat dipastikan.' : '',
    },
    '@/data/meta.json': { dataset_images_used: 2660 },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + expose, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: id => modules[id] || { default: id }, requestAnimationFrame: fn => frames.push(fn), document: { getElementById: id => ({ focus: () => { focused = id; } }) } });
  return { render: (props = {}) => { cursor = 0; return exports.default(props); }, result: props => { cursor = 0; return exports.ResultCard(props); }, frames, values, focused: () => focused };
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

test('Result order: group, evidence/action, inspection, handling reference; hazards retained', () => {
  const app = harness('components/TriagePanel.tsx', '\nexport { ResultCard };');
  const calls = [];
  const data = { status: 'classified', margin: 0.2, threshold: 0.1, cluster: { id: 4, label: 'Battery' }, ranking: [], zero_shot: [] };
  let tree = app.result({ data, onReset() {}, onExplore: id => { calls.push(id); return 'Kelompok tidak tersedia.'; } });
  const output = text(tree);
  const labels = ['Kelompok', 'Bukti', 'Status pemeriksaan', 'Acuan penanganan'];
  labels.slice(1).forEach((label, i) => assert.ok(output.indexOf(labels[i]) < output.indexOf(label)));
  assert.match(output, /Saran kelompok tersedia\. Konfirmasi kondisi fisik\./);
  assert.match(output, /Jangan tusuk baterai/);
  assert.doesNotMatch(output, /Jalur otomatis/);
  nodes(tree).find(n => n.type === 'button' && text(n).includes('Lihat kelompok pembanding')).props.onClick();
  assert.deepEqual(calls, [4]);
  tree = app.result({ data, onReset() {} });
  assert.match(text(nodes(tree).find(n => n.props.role === 'alert')), /Kelompok tidak tersedia/);
  for (const id of [9, 11, 99]) {
    const manual = app.result({ data: { ...data, status: 'review', cluster: { id, label: null, handling: 'Periksa kondisi barang.' } }, onReset() {} });
    assert.match(text(manual), /Periksa barang secara manual\./);
    assert.match(text(manual), id === 99 ? /Periksa kondisi barang/ : /Jenis perangkat belum dapat dipastikan/);
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
  for (const copy of ['100 barang', 'tanpa foto', 'Ekspor catatan', 'identitas pengisi tidak diverifikasi', 'Bukan audit resmi', 'jam perangkat mundur']) assert.ok(text(disclosure).includes(copy));
  assert.equal(text(all.find(n => n.props.role === 'status')), 'Memuat…');
  assert.equal(all.some(n => n.props.className === 'demo-notice'), false);
  const section = all.find(n => n.props.className === 'demo-records');
  assert.equal(section.props.children.at(-1), footer);
});

test('Reference copy and gallery precede handling; console stays mounted', () => {
  const page = fs.readFileSync(path.join(__dirname, '../app/page.tsx'), 'utf8');
  assert.match(page, /Jumlah citra referensi/);
  assert.match(page, /Pilih kelompok untuk melihat contoh dan acuan pemeriksaan\./);
  assert.match(page, /bukan akurasi untuk foto baru/);
  assert.ok(page.indexOf('<ClusterGallery selected={selected}') < page.indexOf('className="dossier-action"'));
  assert.match(page, /hidden=\{section !== "Konsol"\}><DemoWorkspace/);
  assert.doesNotMatch(page, /location\.|href="#/);
});
