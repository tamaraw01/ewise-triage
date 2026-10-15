"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import clusters from "../data/clusters.json";
import meta from "../data/meta.json";
import analytics from "../data/analytics.json";

type Cluster = (typeof clusters)[number];
type Metric = "n_images" | "purity" | "margin";
const number = (n: number, digits = 0) => n.toLocaleString("id-ID", { maximumFractionDigits: digits });
const percent = (n: number) => `${(n * 100).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const cross = analytics.clusterAudit.crossTab;
// Full 14×10 cross-tab; truth_mix in clusters.json is truncated and never used for counts.
export const dominant = (c: Cluster): [string, number] => { const row = cross.values[cross.rowClusterIds.indexOf(c.id)]; const max = Math.max(...row); return [cross.columnLabels[row.indexOf(max)], max]; };
export const exactPurity = (c: Cluster) => dominant(c)[1] / c.n_images;
export const metricValue = (c: Cluster, metric: Metric) => metric === "purity" ? exactPurity(c) : c[metric];
export function descriptive(rows: Cluster[]) {
  const sizes = rows.map(c => c.n_images).sort((a, b) => a - b);
  const total = sizes.reduce((a, b) => a + b, 0);
  const mean = total / sizes.length;
  const middle = Math.floor(sizes.length / 2);
  return { total, mean, median: sizes.length % 2 ? sizes[middle] : (sizes[middle - 1] + sizes[middle]) / 2, min: sizes[0], max: sizes.at(-1)!, sd: Math.sqrt(sizes.reduce((sum, n) => sum + (n - mean) ** 2, 0) / sizes.length), dominantCount: rows.reduce((sum, c) => sum + dominant(c)[1], 0) };
}
export const orderedClusters = (metric: Metric, ascending: boolean) => [...clusters].sort((a, b) => (metricValue(a, metric) - metricValue(b, metric)) * (ascending ? 1 : -1) || a.id - b.id);
export function clusterCSV(rows: Cluster[]) {
  const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return ["cluster,system_label,n_images,dominant_class,dominant_count,purity_exact,naming_margin,runner_up", ...rows.map(c => [c.id, c.label, c.n_images, ...dominant(c), dominant(c)[1] / c.n_images, c.margin, c.label_top2].map(cell).join(","))].join("\r\n");
}

const methods = ["ensemble", "kmeans", "ward", "gmm"] as const;
const methodName = { ensemble: "Ensemble", kmeans: "K-Means", ward: "Ward", gmm: "GMM" };
const binName: Record<string, string> = { "≤150": "Hingga 150", "151–224": "151 sampai 224", "225–512": "225 sampai 512", "513–1024": "513 sampai 1024", ">1024": "Di atas 1024" };
const flagged = (id: number) => id === 9 ? "Kelas campuran" : id === 11 ? "Nama salah" : "";
const x = (v: number, lo: number, hi: number, w = 300) => ((v - lo) / (hi - lo)) * w;

function Bar({ value, max, tone = "var(--green)" }: { value: number; max: number; tone?: string }) {
  return <div className="research-bar-track" aria-hidden="true"><span style={{ width: `${max ? value / max * 100 : 0}%`, background: tone }} /></div>;
}

function Heatmap({ label, rows, cols, values, diagonal }: { label: string; rows: string[]; cols: string[]; values: number[][]; diagonal: boolean }) {
  const max = Math.max(...values.flat());
  return <div className="research-table-scroll" tabIndex={0} role="region" aria-label={label}><table className="research-heat"><thead><tr><th scope="col"><span className="sr-only">{label}</span></th>{cols.map(c => <th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{values.map((row, i) => <tr key={rows[i]}><th scope="row">{rows[i]}</th>{row.map((v, j) => { const hit = diagonal ? i === j : v === Math.max(...row); return <td className="num" key={j} style={{ background: v ? `color-mix(in srgb, ${hit ? "var(--green)" : "var(--amber)"} ${Math.max(14, Math.round(v / max * 85))}%, transparent)` : undefined, color: v ? "var(--bone)" : "var(--edge)" }}>{v}</td>; })}</tr>)}</tbody></table></div>;
}

function Curve({ name, field, chosen, higher }: { name: string; field: "silhouette_kmeans" | "silhouette_ward" | "bic_gmm"; chosen: number; higher: boolean }) {
  const pts = analytics.selection.baseCurves;
  const vals = pts.map(p => p[field]); const lo = Math.min(...vals), hi = Math.max(...vals);
  const px = (k: number) => 10 + x(k, 2, 25, 220); const py = (v: number) => 90 - x(v, lo, hi, 75);
  const pick = pts.find(p => p.K === chosen)!;
  return <figure className="research-multiple"><svg viewBox="0 0 240 110" role="img" aria-label={`${name}: K terpilih ${chosen}, nilai ${number(pick[field], 4)}`}><polyline fill="none" stroke="var(--bone-dim)" strokeWidth="1.5" points={pts.map(p => `${px(p.K)},${py(p[field])}`).join(" ")} /><line x1={px(chosen)} x2={px(chosen)} y1="8" y2="96" stroke="var(--green)" /><circle cx={px(chosen)} cy={py(pick[field])} r="3.5" fill="var(--green)" /><text x="10" y="107" fill="var(--bone-dim)" fontSize="9">K 2</text><text x="205" y="107" fill="var(--bone-dim)" fontSize="9">K 25</text></svg><figcaption><strong>{name}</strong> K {chosen}, {higher ? "silhouette tertinggi" : "BIC terendah"}</figcaption></figure>;
}

export default function ResearchDashboard() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => { gsap.from(".research-bar-track span, .research-split span", { scaleX: 0, transformOrigin: "left center", duration: 0.5, stagger: 0.01, ease: "power2.out" }); });
    return () => motion.revert();
  }, { scope: root });
  const [metric, setMetric] = useState<Metric>("n_images");
  const [ascending, setAscending] = useState(false);
  const rows = orderedClusters(metric, ascending);
  const stats = descriptive(clusters);
  const ev = analytics.evaluation, tri = ev.triageIllustration, boot = analytics.bootstrap, audit = analytics.imageAudit, cross = analytics.clusterAudit.crossTab;
  const ceiling = metric === "n_images" ? stats.max : metric === "purity" ? 1 : Math.ceil(Math.max(...clusters.map(c => c.margin)) * 100) / 100;
  const show = (c: Cluster) => metric === "purity" ? percent(metricValue(c, metric)) : number(c[metric], metric === "margin" ? 4 : 0);
  const classes = [...analytics.classDistribution].sort((a, b) => b.count - a.count);
  const lo = 0.82;
  function download() {
    const url = URL.createObjectURL(new Blob(["\uFEFF", clusterCSV(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "ewise-statistik-klaster.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const kpis: [string, string, string][] = [
    ["Citra dipakai", number(meta.dataset_images_used), `dari ${number(meta.dataset_images_total)}`],
    ["Akurasi penamaan", percent(ev.accuracy), `Macro-F1 ${number(ev.macroF1, 4)}`],
    ["Kemurnian klaster", percent(stats.dominantCount / stats.total), `${number(stats.dominantCount)} dari ${number(stats.total)}`],
    ["Rata-rata ARI Ensemble", number(boot.summary.ensemble.mean, 4), `SD ${number(boot.summary.ensemble.stdSample, 4)}, ${boot.replicates} bootstrap`],
  ];
  return <section ref={root} className="research-dashboard" aria-labelledby="statistics-title">
    <div className="workspace-heading"><h2 id="statistics-title">Statistik</h2><p>Electronic BDC 2026, {clusters.length} klaster</p></div>

    <dl className="research-kpis">{kpis.map(([k, v, s]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd><dd>{s}</dd></div>)}</dl>
    <div className="research-split" role="img" aria-label={`${number(meta.dataset_images_used)} citra dipakai, ${number(meta.dataset_images_dropped)} dikeluarkan`}><span style={{ width: `${meta.dataset_images_used / meta.dataset_images_total * 100}%`, background: "var(--green)" }} /><span style={{ width: `${meta.dataset_images_dropped / meta.dataset_images_total * 100}%`, background: "var(--edge)" }} /></div>
    <p className="research-legend"><i style={{ background: "var(--green)" }} />Dipakai {percent(meta.dataset_images_used / meta.dataset_images_total)} <i style={{ background: "var(--edge)" }} />Dikeluarkan {number(meta.dataset_images_dropped)}, awalan nama berkas tidak cocok</p>

    <div className="research-grid">
      <section aria-labelledby="class-title"><h3 id="class-title">Citra per kelas</h3>
        <ol className="research-bars">{classes.map(c => <li key={c.label}><span>{c.label}</span><Bar value={c.count} max={classes[0].count} /><span className="num">{c.count}</span></li>)}</ol>
      </section>
      <section aria-labelledby="res-title"><h3 id="res-title">Resolusi, sisi terpanjang</h3>
        <div className="research-table-scroll" tabIndex={0} role="region" aria-label="Resolusi citra"><table><thead><tr><th scope="col">Piksel</th><th scope="col">Dipakai</th><th scope="col">Dikeluarkan</th></tr></thead><tbody>{audit.kept.longSideBins.map((bin, i) => { const ex = audit.excluded.longSideBins[i].count; return <tr key={bin.label}><th scope="row">{binName[bin.label] ?? bin.label}</th><td><span className="research-cell"><Bar value={bin.count} max={audit.kept.count} /><span className="num">{number(bin.count)}</span></span></td><td><span className="research-cell"><Bar value={ex} max={audit.excluded.count} tone="var(--edge)" /><span className="num">{number(ex)}</span></span></td></tr>; })}</tbody></table></div>
        <p className="research-note">{number(audit.kept.topDimensions[0].count)} citra dipakai berukuran 150 x 150 piksel.</p>
      </section>
    </div>

    <section className="research-block" aria-labelledby="distribution-title">
      <div className="research-section-heading"><h3 id="distribution-title">Klaster</h3>
        <div className="research-controls"><label htmlFor="research-metric" className="sr-only">Ukuran grafik</label><select id="research-metric" value={metric} onChange={e => setMetric(e.target.value as Metric)}><option value="n_images">Jumlah citra</option><option value="purity">Kemurnian</option><option value="margin">Margin penamaan</option></select><button type="button" className="btn" onClick={() => setAscending(!ascending)}>{ascending ? "Terkecil dahulu" : "Terbesar dahulu"}</button><button type="button" className="btn" onClick={download}>Unduh CSV</button></div></div>
      <div className="research-grid research-grid-wide">
        <ol className="research-bars research-cluster-bars" aria-label="Nilai per klaster">{rows.map(c => <li key={c.id}><span><span className="num">C{c.id}</span> {c.label}</span><Bar value={metricValue(c, metric)} max={ceiling} tone={flagged(c.id) ? "var(--amber)" : "var(--green)"} /><span className="num">{show(c)}{flagged(c.id) && <span className="research-review">{flagged(c.id)}</span>}</span></li>)}</ol>
        <dl className="research-facts">{[["Rata-rata", number(stats.mean, 2)], ["Median", number(stats.mean, 1)], ["Terkecil", number(stats.min)], ["Terbesar", number(stats.max)], ["Simpangan baku", number(stats.sd, 2)]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}<p className="research-note">Citra per klaster.</p></dl>
      </div>
      <p className="research-note">Margin penamaan adalah selisih skor kemiripan dua label teratas, bukan probabilitas.</p>
      <div className="research-flags">{[9, 11].map(id => { const c = clusters.find(k => k.id === id)!; const [name, n] = dominant(c); return <p key={id}><strong>C{id} {flagged(id).toLowerCase()}.</strong> Dinamai {c.label}, isinya {n} {name} dari {c.n_images} citra.</p>; })}</div>
      <details><summary>Tabel klaster</summary><div className="research-table-scroll" tabIndex={0} role="region" aria-label="Tabel klaster"><table><thead><tr><th scope="col">Klaster</th><th scope="col">Nama sistem</th><th scope="col">Citra</th><th scope="col">Kelas dominan</th><th scope="col">Kemurnian</th><th scope="col">Label kedua</th><th scope="col">Margin</th></tr></thead><tbody>{rows.map(c => { const [name, count] = dominant(c); return <tr key={c.id}><th scope="row" className="num">C{c.id}</th><td>{c.label}</td><td className="num">{c.n_images}</td><td>{name} <span className="num">{count}</span></td><td className="num">{percent(count / c.n_images)}</td><td>{c.label_top2}</td><td className="num">{number(c.margin, 4)}</td></tr>; })}</tbody></table></div></details>
      <details><summary>Isi kelas per klaster</summary><Heatmap label="Jumlah citra per klaster dan kelas" rows={cross.rowClusterIds.map(id => `C${id}`)} cols={cross.columnLabels} values={cross.values} diagonal={false} /></details>
    </section>

    <section className="research-block" aria-labelledby="evaluation-title"><h3 id="evaluation-title">Ketepatan per kelas</h3><p className="research-note">Pembanding: label dari nama berkas.</p>
      <div className="research-table-scroll" tabIndex={0} role="region" aria-label="Kinerja per kelas"><table><thead><tr><th scope="col">Kelas</th><th scope="col">F1</th><th scope="col">Presisi</th><th scope="col">Recall</th></tr></thead><tbody>{analytics.classDistribution.map(c => <tr key={c.label}><th scope="row">{c.label}{c.f1 === 0 && <span className="research-review">C11 dinamai Mobile</span>}</th><td><span className="research-cell"><Bar value={c.f1} max={1} tone={c.f1 ? "var(--green)" : "var(--amber)"} /><span className="num">{number(c.f1, 4)}</span></span></td><td className="num">{percent(c.precision)}</td><td className="num">{percent(c.recall)}</td></tr>)}</tbody></table></div>
      <h4>Confusion matrix</h4><p className="research-note">Baris kelas asli, kolom nama dari sistem.</p>
      <Heatmap label="Confusion matrix" rows={ev.confusion.rowLabels} cols={ev.confusion.columnLabels} values={ev.confusion.values} diagonal />
    </section>

    <div className="research-grid">
      <section aria-labelledby="triage-title"><h3 id="triage-title">Triase margin</h3>
        <div className="research-split" role="img" aria-label={`${tri.acceptedCount} diterima, ${tri.reviewCount} ditinjau`}><span style={{ width: `${tri.acceptedCount / ev.count * 100}%`, background: "var(--green)" }} /><span style={{ width: `${tri.reviewCount / ev.count * 100}%`, background: "var(--amber)" }} /></div>
        <p className="research-legend"><i style={{ background: "var(--green)" }} />Diterima {number(tri.acceptedCount)} <i style={{ background: "var(--amber)" }} />Ditinjau {tri.reviewCount}, C9 dan C11</p>
        <p className="research-big num">{percent(tri.acceptedAccuracy)}</p><p className="research-note">Akurasi citra diterima, margin di bawah {number(tri.threshold, 2)} ditinjau. Konsol memakai ambang terpisah, {number(0.0297, 4)}.</p>
      </section>
      <section aria-labelledby="boot-title"><h3 id="boot-title">Stabilitas bootstrap</h3><p className="research-note">Rata-rata ARI dari 50 replikasi. Garis hijau menandai rata-rata.</p>
        <div className="research-strips">{methods.map(m => { const s = boot.summary[m]; return <figure key={m}><figcaption><strong>{methodName[m]}</strong> <span className="num">{number(s.mean, 4)}</span></figcaption><svg viewBox="0 0 320 46" role="img" aria-label={`${methodName[m]}: rata-rata ARI ${number(s.mean, 4)}`}><line x1="10" x2="310" y1="15" y2="15" stroke="var(--iron-hi)" strokeWidth="8" /><line x1={10 + x(s.p05, lo, 1)} x2={10 + x(s.p95, lo, 1)} y1="15" y2="15" stroke="var(--edge)" strokeWidth="8" />{boot.rows.map(r => <circle key={r.bootstrap} cx={10 + x(r[`ARI_${m}`], lo, 1)} cy="15" r="2.2" fill="var(--bone)" opacity=".55" />)}<line x1={10 + x(s.mean, lo, 1)} x2={10 + x(s.mean, lo, 1)} y1="3" y2="27" stroke="var(--green)" strokeWidth="2" /><text x="10" y="43" fill="var(--bone-dim)" fontSize="10">{number(lo, 2)}</text><text x="310" y="43" textAnchor="end" fill="var(--bone-dim)" fontSize="10">1,00</text></svg></figure>; })}</div>
        <p className="research-note">Titik menunjukkan hasil tiap replikasi.</p>
      </section>
    </div>

    <section className="research-block" aria-labelledby="k-title"><h3 id="k-title">Pemilihan K</h3>
      <div className="research-multiples"><Curve name="K-Means" field="silhouette_kmeans" chosen={analytics.selection.selected.kmeans} higher /><Curve name="Ward" field="silhouette_ward" chosen={analytics.selection.selected.ward} higher /><Curve name="GMM" field="bic_gmm" chosen={analytics.selection.selected.gmm} higher={false} /></div>
      <p className="research-note">Ketiganya digabung lewat co-association menjadi {clusters.length} klaster.</p>
    </section>
    <style jsx global>{`
      .research-dashboard { min-width:0; } .research-dashboard h3 { font-size:20px; font-weight:600; margin:0 0 16px; } .research-dashboard h4 { font-size:15px; font-weight:600; margin:28px 0 4px; }
      .research-kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:1px; background:var(--edge); border:1px solid var(--edge); margin:24px 0 20px; }
      .research-kpis div { background:var(--iron); padding:18px 20px; } .research-kpis dt { font-size:13px; color:var(--bone-dim); } .research-kpis dd { margin:0; } .research-kpis dd.num { font-size:30px; margin:6px 0 4px; color:var(--bone); } .research-kpis dd:last-child { font-size:12px; color:var(--bone-dim); }
      .research-split { display:flex; gap:2px; height:14px; } .research-split span { display:block; height:100%; }
      .research-legend { display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; font-size:12px; color:var(--bone-dim); margin:10px 0 0; } .research-legend i { width:10px; height:10px; display:inline-block; } .research-legend i + * , .research-legend i:not(:first-child) { margin-left:8px; }
      .research-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:40px; margin:44px 0; } .research-grid-wide { grid-template-columns:minmax(0,2fr) minmax(0,1fr); margin:0; }
      .research-block { margin:44px 0; padding-top:28px; border-top:1px solid var(--edge); }
      .research-bars { list-style:none; padding:0; margin:0; } .research-bars li { display:grid; grid-template-columns:120px minmax(0,1fr) 64px; gap:12px; align-items:center; min-height:30px; font-size:13px; } .research-cluster-bars li { grid-template-columns:150px minmax(0,1fr) 92px; } .research-bars li > :last-child { text-align:right; }
      .research-bar-track { height:10px; background:var(--iron); flex:1; min-width:40px; } .research-bar-track span { display:block; height:100%; }
      .research-cell { display:flex; align-items:center; gap:10px; } .research-cell .num { min-width:44px; text-align:right; }
      .research-review { display:block; font-family:var(--font-plex-sans),sans-serif; font-size:11px; color:var(--amber); }
      .research-facts { background:var(--iron); padding:8px 20px 12px; margin:0; align-self:start; } .research-facts div { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--edge); font-size:13px; } .research-facts dd { margin:0; }
      .research-note { font-size:12px; color:var(--bone-dim); margin:12px 0 0; line-height:1.55; max-width:70ch; }
      .research-flags { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin:16px 0; } .research-flags p { margin:0; padding:12px 14px; border-left:3px solid var(--amber); background:var(--iron); font-size:13px; line-height:1.5; }
      .research-section-heading { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; } .research-section-heading h3 { margin:0; }
      .research-controls { display:flex; flex-wrap:wrap; gap:8px; } .research-controls select { min-height:44px; padding:8px; border:1px solid var(--edge); background:var(--iron); color:var(--bone); font:inherit; font-size:13px; }
      .research-dashboard details { margin:12px 0; } .research-dashboard summary { cursor:pointer; min-height:44px; display:flex; align-items:center; font-size:14px; color:var(--bone-dim); }
      .research-table-scroll { max-width:100%; overflow-x:auto; } .research-dashboard table { width:100%; border-collapse:collapse; font-size:13px; text-align:left; } .research-dashboard th, .research-dashboard td { padding:9px 10px; border-bottom:1px solid var(--edge); vertical-align:middle; } .research-dashboard thead { color:var(--bone-dim); } .research-dashboard td.num { white-space:nowrap; }
      .research-heat { margin-top:12px; } .research-heat th, .research-heat td { padding:7px 8px; font-size:12px; text-align:center; border:1px solid var(--void); } .research-heat tbody th { text-align:left; white-space:nowrap; } .research-heat thead th { font-weight:500; min-width:52px; }
      .research-big { font-size:30px; margin:20px 0 0; color:var(--green); }
      .research-strips figure { margin:0 0 8px; } .research-strips figcaption { display:flex; justify-content:space-between; font-size:13px; max-width:420px; } .research-strips svg { width:100%; max-width:420px; display:block; }
      .research-multiples { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px; } .research-multiple { margin:0; } .research-multiple svg { width:100%; display:block; } .research-multiple figcaption { font-size:13px; color:var(--bone-dim); } .research-multiple strong { color:var(--bone); font-weight:600; }
      .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
      @media(max-width:760px) { .research-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } .research-grid, .research-grid-wide, .research-flags, .research-multiples { grid-template-columns:1fr; } .research-kpis dd.num { font-size:24px; } .research-cluster-bars li { grid-template-columns:118px minmax(0,1fr) 84px; } }
    `}</style>
  </section>;
}
