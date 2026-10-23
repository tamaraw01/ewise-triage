"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import TriagePanel, { type ExploreHandler } from "./TriagePanel";
import { createRecord, appendReview, parseStore, categoriesForLane, deleteRecord, workflowStatus, MAX_RECORDS, type DemoRecord } from "@/lib/demo-records";
import { automaticLane, manualExplanation, NAMING_FAILURE_REASON } from "@/lib/session";
import { LANES, fixed4, type LaneCode } from "@/lib/data";

import RecordPhoto from "./RecordPhoto";
import { KEY, mutateStore } from "@/lib/demo-storage";
const date = (value: string) => new Date(value).toLocaleString("id-ID");
gsap.registerPlugin(useGSAP);

export default function DemoWorkspace({ active, onExplore }: { active: boolean; onExplore: ExploreHandler }) {
  const [records, setRecords] = useState<readonly DemoRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirmClear, setConfirmClear] = useState(false);
  const root = useRef<HTMLElement>(null);
  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      const data = raw ? parseStore(raw) : { records: [] };
      setRecords(data.records);
      setError("");
      setReady(true);
    } catch {
      setReady(false);
      setError("Catatan tidak dapat dibaca. Data lama tidak ditimpa. Periksa izin penyimpanan atau ekspor data mentah sebelum menghapusnya.");
    }
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate browser storage and synchronize external tab changes.
    load();
    const sync = (event: StorageEvent) => { if (event.key === KEY || event.key === null) { load(); setError("Catatan diperbarui dari tab lain. Periksa ulang isian pemeriksaan sebelum menyimpan."); } };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".record-detail", { y: 8, duration: 0.24, ease: "power2.out", clearProps: "transform" });
    });
    return () => media.revert();
  }, { scope: root, dependencies: [selected], revertOnUpdate: true });

  const persist = async (update: ((rows: readonly DemoRecord[]) => readonly DemoRecord[]) | null, photo?: { id: string; file: File }) => {
    const next = await mutateStore(update, photo);
    load();
    return next;
  };
  const download = (raw: string) => {
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "ewise-catatan-demo.json";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const run = async (action: () => void | Promise<void>) => { try { await action(); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Penyimpanan gagal. Catatan belum diubah."); } };
  const current = records.find(record => record.id === selected);
  const visible = records.filter(record => {
    const last = record.reviews.at(-1);
    return (filter === "all" || workflowStatus(record) === filter) && `${record.fileName} ${record.id} ${last?.category ?? ""}`.toLocaleLowerCase("id").includes(query.toLocaleLowerCase("id"));
  });
  const pending = records.filter(record => workflowStatus(record) === "pending").length;
  const done = records.filter(record => workflowStatus(record) === "done").length;
  const review = records.filter(record => workflowStatus(record) === "review").length;
  return <>
    <TriagePanel active={active} onExplore={onExplore} onSave={async (prediction, file) => {
      try {
        const record = createRecord(prediction, file.name);
        await persist(rows => [record, ...rows], { id: record.id, file });
        setSelected(record.id);
        setFilter("all"); setQuery("");
        setError("");
        return "";
      } catch (e) { return e instanceof Error ? e.message : "Gagal menyimpan. Periksa ruang penyimpanan browser."; }
    }} />
    <section className="demo-records" ref={root} aria-labelledby="records-title">
      <div className="record-heading"><div><p className="spec">Ruang kerja lokal</p><h2 id="records-title">Catatan barang</h2></div><div className="record-actions">
        <button className="btn" type="button" onClick={() => run(() => { const raw = localStorage.getItem(KEY); if (!raw) throw new Error("Belum ada catatan untuk diekspor."); download(raw); })}>Ekspor JSON</button>
        <button className="btn" type="button" onClick={() => setConfirmClear(true)}>Hapus semua catatan</button>
      </div></div>
      {confirmClear && <div className="record-confirm" role="group" aria-label="Konfirmasi hapus" onKeyDown={event => { if (event.key === "Escape") setConfirmClear(false); }}><p>Hapus seluruh catatan demo beserta fotonya di browser ini? Tindakan tidak dapat dibatalkan. Ekspor metadata JSON dan unduh foto terpisah dahulu jika masih diperlukan.</p><button className="btn" type="button" onClick={() => setConfirmClear(false)}>Batal</button><button className="btn" type="button" onClick={() => run(async () => { await persist(null); setSelected(""); setConfirmClear(false); })}>Ya, hapus seluruh catatan</button></div>}
      {error && <div className="record-error" role="alert"><p>{error}</p><button className="btn" type="button" onClick={load}>Muat ulang catatan</button></div>}
      {!ready && !error && <p className="record-loading" role="status">Memuat…</p>}
      {ready && <>
        <dl className="record-counts"><div><dt>Barang dicatat</dt><dd>{records.length}</dd></div><div><dt>Menunggu pemeriksaan</dt><dd>{pending}</dd></div><div><dt>Perlu tinjauan</dt><dd>{review}</dd></div><div><dt>Selesai diperiksa</dt><dd>{done}</dd></div></dl>
        <div className="record-filters"><label>Cari barang<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nama berkas, kategori, atau ID" /></label><label>Status<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Semua status</option><option value="logged">Tercatat</option><option value="pending">Menunggu pemeriksaan</option><option value="review">Perlu tinjauan</option><option value="done">Selesai diperiksa</option></select></label></div>
        {!records.length ? <div className="record-empty"><h3>Belum ada barang dicatat</h3><p>Setiap hasil analisis berhasil dicatat otomatis di browser ini.</p></div> : <div className="record-workbench"><div className="record-list" aria-label="Daftar barang">{!visible.length && <p>Tidak ada barang sesuai pencarian.</p>}{visible.map(record => <button type="button" key={record.id} aria-pressed={selected === record.id} onClick={() => setSelected(record.id)}><strong>{record.reviews.at(-1)?.category ?? record.fileName}</strong><span>{{ logged: "Tercatat", pending: "Menunggu pemeriksaan", review: "Perlu tinjauan", done: "Selesai diperiksa" }[workflowStatus(record)]}</span><small>{date(record.createdAt)} · {record.id.slice(0, 8)}</small></button>)}</div>{current ? <RecordDetail key={`${current.id}:${current.reviews.at(-1)?.id ?? "new"}`} record={current} onExplore={onExplore} onDelete={async () => { try { await persist(rows => deleteRecord(rows, current)); setSelected(""); setError(""); return ""; } catch (e) { const message = e instanceof Error ? e.message : "Catatan belum dihapus."; setError(message); return message; } }} onReview={async input => { try { await persist(rows => {
          const latest = rows.find(row => row.id === current.id);
          if (!latest || latest.reviews.at(-1)?.id !== current.reviews.at(-1)?.id) {
            load(); throw new Error("Keputusan berubah di tab lain. Form telah dimuat ulang; periksa lalu ulangi.");
          }
          return rows.map(row => row.id === current.id ? appendReview(row, input) : row);
        }); setError(""); return ""; } catch (e) { const message = e instanceof Error ? e.message : "Keputusan belum tersimpan."; setError(message); return message; } }} /> : <p className="record-empty">Pilih barang untuk memeriksa hasil dan riwayat.</p>}</div>}
      </>}
      <footer className="record-storage">
        <p>Tersimpan di browser ini</p>
        <details>
          <summary>Tentang penyimpanan</summary>
          <div className="record-storage-info">
            <p>Demo tanpa akun. Catatan tidak dibagikan ke pengunjung lain; identitas pengisi tidak diverifikasi. Bukan audit resmi.</p>
            <p>Kapasitas {MAX_RECORDS} barang dengan foto sumber maksimal 3 MB per barang (hingga 900 MB). Kuota browser bisa lebih kecil. Foto disimpan tanpa kompresi tambahan dan hanya dimuat saat catatan dipilih. Ekspor catatan (JSON) hanya berisi metadata, bukan foto. Unduh foto terpisah sebelum menghapus data browser.</p>
            <p>Waktu mengikuti perangkat. Riwayat diurutkan berdasarkan penyimpanan, termasuk saat jam perangkat mundur.</p>
          </div>
        </details>
      </footer>
    </section>
  </>;
}

function RecordDetail({ record, onExplore, onReview, onDelete }: { record: DemoRecord; onExplore: ExploreHandler; onDelete: () => Promise<string>; onReview: (input: { category: string; lane: LaneCode; note: string; status: "review" | "done" }) => Promise<string> }) {
  const last = record.reviews.at(-1);
  const [category, setCategory] = useState(last && categoriesForLane(last.lane).includes(last.category) ? last.category : "");
  const [lane, setLane] = useState<LaneCode>(last?.lane ?? automaticLane(record.inference));
  const explanation = manualExplanation(record.inference.cluster.id);
  const [status, setStatus] = useState<"review" | "done">(last?.status ?? "review");
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return <article className="record-detail">
    <header><p className="spec num">{record.id}</p><h3>{record.fileName}</h3><p className="spec">Dicatat {date(record.createdAt)}</p></header>
    <RecordPhoto id={record.id} fileName={record.fileName} />
    <div className="record-inference"><h4>Hasil E-WISE</h4><p>C{record.inference.cluster.id} · {record.inference.cluster.label ?? "Belum dipastikan"}</p><p>Margin kecocokan {fixed4(record.inference.margin)} · Acuan {automaticLane(record.inference)}</p>{automaticLane(record.inference) === "MR" && <p>{explanation ? `${explanation.title}. ${explanation.body}` : NAMING_FAILURE_REASON}</p>}<p className="spec">{record.provenance === "backend version not supplied" ? "Versi model tidak disertakan backend." : `Versi dari backend: ${record.provenance}.`}</p><button className="btn" type="button" onClick={() => setError(onExplore(record.inference.cluster.id))}>Lihat kelompok referensi</button></div>
    <form className="record-form" onSubmit={async event => { event.preventDefault(); const err = await onReview({ category, lane, note, status }); setError(err); if (!err) { setNote(""); setMessage("Tersimpan."); } }}>
      <h4>{last ? "Tambah koreksi" : "Verifikasi"}</h4>
      <p className="hazard-note">Periksa bahaya fisik sesuai SOP fasilitas.</p>
      <label>Acuan penanganan<select value={lane} onChange={event => { const next = event.target.value as LaneCode; setLane(next); if (!categoriesForLane(next).includes(category)) setCategory(""); if (next === "MR") setStatus("review"); }}>{(Object.keys(LANES) as LaneCode[]).map(code => <option key={code} value={code}>{code} · {LANES[code].desc}</option>)}</select></label>
      <label>Kategori<select required value={category} onChange={event => setCategory(event.target.value)}><option value="">Pilih kategori</option>{categoriesForLane(lane).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Status<select value={status} onChange={event => setStatus(event.target.value as "review" | "done")}><option value="review">Ditahan</option><option value="done" disabled={lane === "MR"}>Selesai</option></select></label>
      <label>Catatan<textarea required maxLength={2000} value={note} onChange={event => setNote(event.target.value)} rows={3} /></label>
      <button className="btn" type="button" disabled={!note} onClick={() => setNote("")}>Kosongkan catatan</button>
      <button className="btn btn-primary" type="submit">{last ? "Simpan koreksi" : "Simpan pemeriksaan"}</button>
      {error && <p role="alert">{error}</p>}<p role="status">{message}</p>
    </form>
    <button className="btn" type="button" onClick={() => setConfirmDelete(true)}>Hapus catatan barang</button>
    {confirmDelete && <div className="record-confirm" role="group" aria-label="Konfirmasi hapus catatan barang" onKeyDown={event => { if (event.key === "Escape" && !deleting) setConfirmDelete(false); }}><p>Hapus catatan {record.fileName} beserta foto dan riwayatnya? Tindakan tidak dapat dibatalkan. Catatan barang lain tetap tersimpan.</p><button className="btn" type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}>Batal</button><button className="btn" type="button" disabled={deleting} onClick={async () => { setDeleting(true); setError(await onDelete()); setDeleting(false); }}>Ya, hapus catatan barang</button></div>}
    <div className="record-history"><h4>Riwayat</h4>{!record.reviews.length && <p>Belum ada riwayat.</p>}<ol>{record.reviews.slice().reverse().map(entry => <li key={entry.id}><strong>{entry.category} · {entry.lane}</strong><span>{entry.status === "done" ? "Selesai" : "Ditahan"}</span><p>{entry.note}</p><small>{date(entry.at)} · Sesi demo (tanpa akun)</small></li>)}</ol><details><summary>Snapshot inferensi</summary><pre>{JSON.stringify(record.inference, null, 2)}</pre></details></div>
  </article>;
}
