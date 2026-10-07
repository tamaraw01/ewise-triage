"use client";

import { useEffect, useRef, useState } from 'react';
import TriagePanel from '@/components/TriagePanel';
import ClusterMap from '@/components/ClusterMap';
import meta from '@/data/meta.json';
import { CLUSTERS_META, LANES, fixed4, type LaneCode } from '@/lib/data';
import { submitToBackend } from '@/lib/api';
import { automaticLane, candidateLabel, manualReason, researchSubset, MAX_FILES, reviewItem, runQueue, summarize, validateFile, type SessionItem } from '@/lib/session';

const sections = ['Overview', 'Triase', 'Cluster Explorer', 'Batch & review'] as const;
const laneCodes: LaneCode[] = ['P1', 'P2', 'P3', 'MR'];
const pct = (value: number) => `${(value * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
const research = researchSubset();

export default function Page() {
  const [section, setSection] = useState<string>('Overview');
  return <main className="dashboard">
    <header className="dashboard-header"><div><h1>E-WISE</h1><p>Konsol triase limbah elektronik</p></div><span className="num">CLIP ViT-H/14</span></header>
    <nav className="dashboard-nav" aria-label="Bagian dashboard">{sections.map(name => <button key={name} aria-current={section === name ? 'page' : undefined} onClick={() => setSection(name)}>{name}</button>)}</nav>
    <div id="konten" tabIndex={-1}>
      {section === 'Overview' && <section aria-labelledby="overview-title"><h2 id="overview-title">Overview riset</h2><p className="intro">Hasil eksperimen notebook pada dataset riset, bukan kinerja operasional atau citra baru di lapangan. Unggahan sesi tidak mengubah angka ini.</p>
        <dl className="research-metrics">
          <div><dt>Citra digunakan</dt><dd>{meta.dataset_images_used.toLocaleString('id-ID')}</dd><small>Dari {meta.dataset_images_total.toLocaleString('id-ID')} citra sumber</small></div>
          <div><dt>Akurasi zero-shot riset</dt><dd>{pct(meta.metrics_notebook.accuracy)}</dd><small>Label nama klaster terhadap kelas dataset, seluruh 2.660 citra</small></div>
          <div><dt>Kemurnian tertimbang ukuran</dt><dd>{pct(research.purity)}</dd><small>Kelas dominan per klaster; tidak menilai benar-salah nama</small></div>
          <div><dt>Stabilitas bootstrap ARI</dt><dd>{fixed4(meta.metrics_notebook.bootstrap_ari_mean)} ± {fixed4(meta.metrics_notebook.bootstrap_ari_std)}</dd><small>Konsistensi pengelompokan antar 50 resampling, bukan kesesuaian dengan label</small></div>
          <div><dt>Subset riset tanpa C9 dan C11</dt><dd>{pct(research.coverage)}</dd><small>{research.kept.toLocaleString('id-ID')} / {research.total.toLocaleString('id-ID')} citra; akurasi subset {pct(research.accuracy)}. Bukan kinerja citra masuk.</small></div>
        </dl>
        <div className="overview-notes"><section><h3>14 klaster, tidak semuanya dapat diberi nama</h3><p>C9 campuran: label Mobile tidak mewakili kelas dominan Keyboard (25,8%). C11 didominasi Player (99,6%), bukan Mobile. Keduanya diarahkan ke peninjauan manual.</p><button className="action" onClick={() => setSection('Cluster Explorer')}>Periksa 14 klaster</button></section>
          <section><h3>Ambang inferensi bukan ambang penamaan</h3><p>Backend online menilai margin citra terhadap dua centroid terdekat, lalu membandingkannya dengan {fixed4(meta.review_margin_threshold)} (persentil 5 margin leave-one-out). Skor ini berbeda dari margin penamaan zero-shot dan tidak terkait dengan angka subset riset di atas. C9 dan C11 selalu diarahkan ke MR walaupun margin tinggi.</p><p>Label adalah dugaan taksonomis dari kedekatan visual, bukan pemeriksaan isi fisik barang.</p></section></div>
        <p className="source">Sumber: web/data/meta.json dan lib/data.ts · {meta.source_experiment}</p>
      </section>}
      {section === 'Triase' && <section><h2>Triase satu citra</h2><p className="intro">Analisis cepat. Hasil triase tunggal tidak masuk komposisi Batch.</p><TriagePanel /></section>}
      {section === 'Cluster Explorer' && <Explorer />}
      <div hidden={section !== 'Batch & review'}><Batch /></div>
    </div>
    <footer className="dashboard-footer">Keputusan penanganan harus dikonfirmasi petugas sesuai SOP fasilitas. Prediksi citra tidak memverifikasi bahan atau kondisi perangkat.</footer>
  </main>;
}

function Explorer() {
  const [selected, setSelected] = useState(0);
  const cluster = CLUSTERS_META[selected];
  return <section aria-labelledby="cluster-title"><h2 id="cluster-title">Cluster Explorer</h2><p className="intro">14 klaster dari eksperimen riset. Ukuran dan kemurnian mengacu pada dataset, bukan unggahan sesi.</p>
    <div className="cluster-buttons" aria-label="Pilih klaster">{Object.values(CLUSTERS_META).map(c => <button key={c.id} aria-pressed={selected === c.id} onClick={() => setSelected(c.id)}>C{c.id}{c.lane === 'MR' ? ' · MR' : ''}</button>)}</div>
    <div className="explorer-layout"><figure><ClusterMap highlightedId={selected} /><figcaption>Proyeksi 2D, {meta.scatter_points.toLocaleString('id-ID')} titik sampel. Bukan ruang inferensi atau peta hasil unggahan.</figcaption></figure>
      <div className="cluster-detail" aria-live="polite"><h3>C{cluster.id} · {cluster.sub}</h3>
        {cluster.lane === 'MR' && <p className="caveat"><strong>Kegagalan penamaan · n={cluster.n}. </strong>{cluster.id === 9 ? 'C9 campuran. Label zero-shot Mobile tidak dapat dipercaya; kelas dominan Keyboard hanya 25,8%.' : 'C11 salah nama. Label zero-shot Mobile bertentangan dengan kelas dominan Player (99,6%).'} Wajib peninjauan manual.</p>}
        <dl className="facts"><div><dt>Nama prediksi zero-shot</dt><dd>{cluster.name}</dd></div><div><dt>Jumlah citra riset</dt><dd>{cluster.n}</dd></div><div><dt>Kelas dominan hasil audit / kemurnian</dt><dd>{cluster.dom} / {cluster.pur.toLocaleString('id-ID')}%</dd></div><div><dt>Similaritas zero-shot</dt><dd>{fixed4(cluster.sim)}</dd></div><div><dt>Margin penamaan zero-shot</dt><dd>{fixed4(cluster.zs)}</dd></div><div><dt>Jalur</dt><dd>{cluster.lane} · {LANES[cluster.lane].desc}</dd></div></dl>
        <p><strong>Material: </strong>{cluster.material}</p><p>{cluster.action}</p>{cluster.hazard && <p className="caveat">Perhatian: {cluster.hazard}. Ikuti SOP dan gunakan petugas terlatih.</p>}
      </div></div>
    <p className="source">Sumber: lib/data.ts · Margin penamaan zero-shot berbeda dari margin inferensi citra. Kemurnian bukan probabilitas prediksi.</p>
  </section>;
}

function Batch() {
  const [rows, setRows] = useState<SessionItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const stop = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const running = useRef(false);
  useEffect(() => () => { stop.current = true; abort.current?.abort(); }, []);
  const totals = summarize(rows);
  const settled = rows.filter(r => !['queued', 'loading'].includes(r.status)).length;
  const update = (id: string, patch: Partial<SessionItem>) => setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  async function run(queue: SessionItem[]) {
    if (running.current || !queue.length) return;
    running.current = true; stop.current = false; setBusy(true); setStopping(false);
    setRows(current => current.map(row => queue.some(q => q.id === row.id) ? {...row, status:'queued', error:undefined} : row));
    abort.current = new AbortController();
    try { await runQueue(queue, submitToBackend, update, () => stop.current, abort.current.signal); }
    finally { abort.current = null; running.current = false; setBusy(false); setStopping(false); }
  }
  function add(files: FileList | null) {
    if (!files || busy) return;
    if (rows.length + files.length > MAX_FILES) { setMessage(`Maksimal ${MAX_FILES} berkas per sesi. Tidak ada berkas baru ditambahkan.`); return; }
    const additions: SessionItem[] = Array.from(files).map(file => { const error = validateFile(file); return {id:crypto.randomUUID(), file, status:error ? 'error' : 'queued', error}; });
    setRows(current => [...current, ...additions]); setMessage(`${additions.length} berkas ditambahkan. Periksa daftar sebelum mengirim.`);
  }
  return <section aria-labelledby="batch-title"><h2 id="batch-title">Batch & peninjauan manual</h2><p className="intro">Maksimal 20 citra, 3 MB per berkas. JPG, PNG, WebP. Dikirim satu per satu ke backend Hugging Face melalui proxy aplikasi. Pilih hanya citra yang boleh dibagikan.</p>
    <div className="batch-input"><label htmlFor="batch-files">Tambahkan citra ke sesi</label><input id="batch-files" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={e => {add(e.target.files); e.target.value='';}} />
      <div className="actions"><button className="action" disabled={busy || !rows.some(r=>r.status==='queued')} onClick={()=>run(rows.filter(r=>r.status==='queued'))}>Jalankan batch</button>
        {busy && <><button className="action" disabled={stopping} onClick={()=>{stop.current=true;setStopping(true);}}>Hentikan setelah berkas ini</button><button className="action" onClick={()=>{stop.current=true;abort.current?.abort();}}>Batalkan sekarang</button></>}
        {!busy && rows.some(r=>['error','cancelled'].includes(r.status) && !validateFile(r.file)) && <button className="action" onClick={()=>run(rows.filter(r=>['error','cancelled'].includes(r.status) && !validateFile(r.file)))}>Ulangi gagal / dibatalkan</button>}
        {confirmClear ? <><button className="action" onClick={()=>{setRows([]);setConfirmClear(false);setMessage('Sesi dikosongkan.');}}>Ya, hapus semua hasil dan catatan</button><button className="action" onClick={()=>setConfirmClear(false)}>Batal</button></> : <button className="action" disabled={busy || !rows.length} onClick={()=>setConfirmClear(true)}>Kosongkan sesi</button>}</div>
      <p role="status">{busy ? (stopping ? 'Menunggu berkas aktif selesai; sisanya akan dibatalkan.' : 'Menunggu respons backend. Tidak ada perkiraan waktu.') : message}</p>
      {rows.length > 0 && <><label htmlFor="batch-progress">{settled} / {rows.length} berkas selesai ditangani (termasuk gagal dan dibatalkan)</label><progress id="batch-progress" value={settled} max={rows.length} /></>}
    </div>
    <section className="session-summary"><h3>Komposisi prediksi sesi ini</h3><p>{totals.success} hasil berhasil · {totals.failed} gagal · {totals.pending} antre / aktif · {rows.filter(r=>r.status==='cancelled').length} dibatalkan</p><p>{totals.reviewed} keputusan petugas · {totals.unresolved} masih di MR</p>
      <dl className="lane-counts">{laneCodes.map(lane=><div key={lane}><dt>{lane} · {LANES[lane].desc}</dt><dd>{totals.lanes[lane]}</dd></div>)}</dl>
      <p className="source">Penyebut: hanya hasil prediksi berhasil di sesi ini. Ini prediksi, bukan inventaris yang diaudit. Jalur mencerminkan keputusan petugas jika tersedia, selain itu prediksi aman. Citra bukan jumlah perangkat, massa material, atau ukuran akurasi. Sesi tersimpan di memori tab; muat ulang menghapus hasil.</p>
    </section>
    {!rows.length && <p className="empty-state">Belum ada citra di sesi. Tambahkan berkas, lalu jalankan batch untuk mengisi komposisi dan daftar review.</p>}
    <ol className="batch-list">{rows.map(row=><li key={row.id}><div className="row-heading"><h3>{row.file.name}</h3><span>{({queued:'Antre',loading:'Mengirim / menunggu',done:'Hasil diterima',error:'Gagal',cancelled:'Dibatalkan'})[row.status]}</span></div>
      {row.error && <p role="alert">{row.error}</p>}
      {row.result && row.status === 'done' && <><p>Kandidat C{row.result.cluster.id} · Label kandidat: {candidateLabel(row.result) ?? 'tidak tersedia'}{row.result.cluster.label === null ? ' (ditahan backend)' : ''} · Jalur model aman: {automaticLane(row.result)}</p><p className="num">Margin {fixed4(row.result.margin)} / ambang {fixed4(row.result.threshold)}</p>
        {(automaticLane(row.result)==='MR') && <p className="caveat">Perlu pemeriksaan: {manualReason(row.result) || row.result.cluster.handling}</p>}
        <Review row={row} onChange={patch=>update(row.id,patch)} />
      </>}
      {!busy && row.status !== 'done' && <button className="action" onClick={()=>setRows(current=>current.filter(r=>r.id!==row.id))}>Hapus berkas</button>}
    </li>)}</ol>
  </section>;
}

function Review({row,onChange}:{row:SessionItem;onChange:(patch:Partial<SessionItem>)=>void}) {
  const [lane,setLane] = useState<LaneCode>('MR');
  const [note,setNote] = useState('');
  const [error,setError] = useState('');
  return <details><summary>Catat keputusan petugas{row.review ? ` · ${row.review.lane}` : ''}</summary>
    {row.review && <p>Keputusan tersimpan: {row.review.lane}. {row.review.note} <button className="action" onClick={()=>onChange({review:undefined})}>Batalkan keputusan</button></p>}
    <form className="review-form" onSubmit={e=>{e.preventDefault();try {onChange({review:reviewItem(row,lane,note).review});setError('');} catch(err) {setError(err instanceof Error ? err.message : 'Gagal menyimpan.');}}}>
      <label htmlFor={`lane-${row.id}`}>Jalur setelah pemeriksaan</label><select id={`lane-${row.id}`} value={lane} onChange={e=>setLane(e.target.value as LaneCode)}>{laneCodes.map(code=><option key={code} value={code}>{code} · {LANES[code].desc}</option>)}</select>
      <label htmlFor={`note-${row.id}`}>Catatan pemeriksaan (wajib)</label><textarea id={`note-${row.id}`} required maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Jenis perangkat dan alasan keputusan" />
      <button className="action" type="submit">Simpan keputusan sesi</button>{error && <p role="alert">{error}</p>}<p className="source">Tidak mengubah keluaran model atau metrik riset. MR dapat dipertahankan jika pemeriksaan belum cukup.</p>
    </form>
  </details>;
}
