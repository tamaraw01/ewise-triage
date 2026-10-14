"use client";

import { useState } from "react";
import rawClusters from "@/data/clusters.json";
import { CLUSTERS_META, LANES, fixed4, type LaneCode } from "@/lib/data";

// truth_mix lists leading classes only; n_images remains the denominator.
export const researchClusters = rawClusters.map(raw => {
  const dominant = Object.entries(raw.truth_mix).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  return { ...CLUSTERS_META[raw.id], n: raw.n_images, sim: raw.sim_top1, zs: raw.margin, name: raw.label,
    dom: dominant[0], pur: (dominant[1] ?? 0) / raw.n_images * 100 };
});
const lanes: LaneCode[] = ["P1", "P2", "P3", "MR"];
const total = researchClusters.reduce((sum, c) => sum + c.n, 0);
const percent = (value: number) => value.toLocaleString("id-ID", { maximumFractionDigits: 1 });
type Sort = "id" | "size" | "purity" | "margin";

export function filterClusters(query: string, lane: string, evidence: string, sort: Sort) {
  const term = query.trim().toLocaleLowerCase("id-ID");
  return researchClusters.filter(c =>
    (!term || [`C${c.id}`, c.sub, c.name, c.dom].some(value => value.toLocaleLowerCase("id-ID").includes(term))) &&
    (lane === "all" || c.lane === lane) && (evidence === "all" || (evidence === "disputed" ? c.name !== c.dom : c.name === c.dom))
  ).sort((a, b) => sort === "size" ? b.n - a.n : sort === "purity" ? a.pur - b.pur : sort === "margin" ? a.zs - b.zs : a.id - b.id);
}

export default function ExplorationTools({ selected, onSelect }: { selected: number; onSelect: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const [lane, setLane] = useState("all");
  const [evidence, setEvidence] = useState("all");
  const [sort, setSort] = useState<Sort>("id");
  const [compareId, setCompareId] = useState(10);
  const visible = filterClusters(query, lane, evidence, sort);
  const visibleTotal = visible.reduce((sum, c) => sum + c.n, 0);
  const first = researchClusters.find(c => c.id === selected)!;
  const second = researchClusters.find(c => c.id === compareId && c.id !== selected) ?? researchClusters.find(c => c.id !== selected)!;
  return (
    <div className="exploration-tools">
      <section aria-labelledby="register-title">
        <div className="register-heading"><h3 id="register-title">Indeks & distribusi klaster</h3></div>
        <div className="exploration-filters">
          <label className="search-label">Cari klaster<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="ID, perangkat, atau label" /></label>
          <label>Jalur<select value={lane} onChange={event => setLane(event.target.value)}><option value="all">Semua jalur</option>{lanes.map(code => <option key={code} value={code}>{code} · {LANES[code].desc}</option>)}</select></label>
          <label>Bukti penamaan<select value={evidence} onChange={event => setEvidence(event.target.value)}><option value="all">Semua klaster</option><option value="disputed">Nama berbeda dari label dominan</option><option value="aligned">Nama sama dengan label dominan</option></select></label>
          <label>Urutkan<select value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="id">ID klaster</option><option value="size">Citra terbanyak</option><option value="purity">Kemurnian terendah</option><option value="margin">Margin nama terkecil</option></select></label>
        </div>
        <div className="exploration-result"><p role="status">{visible.length} dari {researchClusters.length} klaster · {visibleTotal.toLocaleString("id-ID")} dari {total.toLocaleString("id-ID")} citra</p><button type="button" className="btn" onClick={() => { setQuery(""); setLane("all"); setEvidence("all"); setSort("id"); }}>Reset filter</button></div>
        <p className="dossier-note">Filter berlaku pada indeks dan distribusi. Peta tetap menampilkan semua klaster.</p>
        <ul className="lane-distribution" aria-label="Distribusi citra hasil filter per jalur">{lanes.map(code => {
          const count = visible.filter(c => c.lane === code).reduce((sum, c) => sum + c.n, 0);
          return <li key={code}><span className="num">{code}</span><span>{count.toLocaleString("id-ID")} citra</span><span className="num">{percent(count / total * 100)}%</span></li>;
        })}</ul>
        <p className="dossier-note">Porsi dihitung dari {total.toLocaleString("id-ID")} citra riset, bukan volume limbah lapangan.</p>
        <div className="distribution-head" aria-hidden="true"><span>Klaster / label dominan</span><span>Citra / porsi</span><span>Murni</span></div>
        {visible.length ? <ul className="cluster-distribution">{visible.map(c => <li key={c.id}><button type="button" aria-pressed={selected === c.id} onClick={() => onSelect(c.id)} aria-label={`C${c.id}, ${c.sub}, label dominan ${c.dom}, ${c.n} citra, ${percent(c.n / total * 100)} persen dataset, kemurnian ${percent(c.pur)} persen, jalur ${c.lane}`}>
          <span><strong>C{c.id} · {c.sub}</strong><small>{c.dom} · {c.lane}{c.name !== c.dom ? " · Nama terbantah" : ""}</small></span>
          <span className="num">{c.n}<small>{percent(c.n / total * 100)}%</small></span><span className="num">{percent(c.pur)}%</span>
          <span className="distribution-track" aria-hidden="true"><span style={{ width: `${c.n / total * 100}%` }} /></span>
        </button></li>)}</ul> : <p className="exploration-empty">Tidak ada klaster yang cocok. Ubah pencarian atau reset filter.</p>}
      </section>
      <section className="cluster-comparison" aria-labelledby="comparison-title">
        <h3 id="comparison-title">Bandingkan dua klaster</h3>
        <div className="comparison-pickers"><label>Klaster A<select value={selected} onChange={event => onSelect(Number(event.target.value))}>{researchClusters.map(c => <option key={c.id} value={c.id}>C{c.id} · {c.sub}</option>)}</select></label><label>Klaster B<select value={second.id} onChange={event => setCompareId(Number(event.target.value))}>{researchClusters.filter(c => c.id !== selected).map(c => <option key={c.id} value={c.id}>C{c.id} · {c.sub}</option>)}</select></label></div>
        <table><caption className="dossier-note">A mengikuti pilihan peta atau indeks. Perbandingan memakai seluruh dataset.</caption><thead><tr><th scope="col">Metrik riset</th><th scope="col">C{first.id}</th><th scope="col">C{second.id}</th></tr></thead><tbody>
          <tr><th scope="row">Citra</th><td className="num">{first.n}</td><td className="num">{second.n}</td></tr>
          <tr><th scope="row">Kemurnian label dominan</th><td className="num">{percent(first.pur)}%</td><td className="num">{percent(second.pur)}%</td></tr>
          <tr><th scope="row">Margin penamaan zero-shot</th><td className="num">{fixed4(first.zs)}</td><td className="num">{fixed4(second.zs)}</td></tr>
          <tr><th scope="row">Label dominan</th><td>{first.dom}</td><td>{second.dom}</td></tr>
          <tr><th scope="row">Nama zero-shot</th><td>{first.name}</td><td>{second.name}</td></tr>
          <tr><th scope="row">Jalur</th><td>{first.lane}</td><td>{second.lane}</td></tr>
        </tbody></table>
        {(first.name !== first.dom || second.name !== second.dom) && <p className="caveat">Nama C9 dan C11 terbantah oleh label riset. Keduanya tetap perlu peninjauan manual.</p>}
        <details><summary>Arti metrik & sumber</summary><p className="dossier-note">Kemurnian adalah porsi kelas dominan dalam klaster, bukan akurasi foto baru. Margin penamaan adalah selisih similaritas dua kandidat nama zero-shot, bukan probabilitas atau margin kecocokan foto.</p><p className="dossier-note">Sumber: dataset riset dan metadata jalur E-WISE. Label riset yang ditampilkan hanya kelas dominan; bukan komposisi material.</p></details>
      </section>
      <style jsx>{`
        .exploration-tools { min-width:0; }
        .exploration-filters,.comparison-pickers { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin:20px 0; }
        label { display:flex; flex-direction:column; gap:8px; font-size:14px; color:var(--bone-dim); min-width:0; }
        .search-label { grid-column:1/-1; }
        input,select { width:100%; min-width:0; min-height:44px; padding:8px 10px; border:1px solid var(--edge); background:var(--iron); color:var(--bone); font:inherit; border-radius:0; }
        input::placeholder { color:var(--bone-dim); opacity:1; }
        .exploration-result { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; font-size:14px; }
        .lane-distribution { list-style:none; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); padding:0; margin:20px 0 0; gap:0 24px; }
        .lane-distribution li { display:flex; flex-wrap:wrap; gap:8px; justify-content:space-between; padding:12px 0; border-top:1px solid var(--edge); font-size:14px; }
        .distribution-head,.cluster-distribution button { display:grid; grid-template-columns:minmax(0,1fr) 72px 64px; gap:12px; text-align:left; }
        .distribution-head { color:var(--bone-dim); font-size:12px; padding:12px 10px; }
        .cluster-distribution { list-style:none; padding:0; margin:0; }
        .cluster-distribution button { position:relative; width:100%; min-height:64px; padding:12px 10px 18px; background:none; color:var(--bone); border:0; border-top:1px solid var(--edge); cursor:pointer; font-size:14px; align-items:center; }
        .cluster-distribution button:hover { background:var(--iron-hi); }
        .cluster-distribution button[aria-pressed="true"] { background:var(--green); color:var(--void); }
        strong { font-weight:500; overflow-wrap:anywhere; }
        small { display:block; font-size:12px; margin-top:4px; }
        .distribution-track { position:absolute; bottom:6px; left:10px; right:10px; height:3px; background:var(--iron-hi); }
        .distribution-track span { display:block; height:100%; background:var(--bone); }
        .cluster-distribution button[aria-pressed="true"] .distribution-track span { background:var(--green); }
        .cluster-comparison { margin-top:36px; border-top:1px solid var(--edge); padding-top:24px; }
        h3 { font-size:23px; font-weight:600; }
        table { width:100%; table-layout:fixed; border-collapse:collapse; font-size:14px; }
        caption { text-align:left; caption-side:bottom; }
        th,td { border-bottom:1px solid var(--edge); padding:12px 8px; text-align:left; vertical-align:top; overflow-wrap:anywhere; }
        th:first-child { width:46%; padding-left:0; }
        th { font-weight:500; }
        tbody th { color:var(--bone-dim); }
        .exploration-empty { padding:20px 0; font-size:14px; }
        @media(max-width:560px) { .exploration-filters,.comparison-pickers { grid-template-columns:1fr; } .lane-distribution { gap:0 12px; } .distribution-head,.cluster-distribution button { grid-template-columns:minmax(0,1fr) 54px 54px; gap:8px; } th,td { padding:12px 4px; } }
      `}</style>
    </div>
  );
}
