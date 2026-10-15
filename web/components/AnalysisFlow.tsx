"use client";

import { useId, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import analytics from "../data/analytics.json";
import meta from "../data/meta.json";
import clusters from "../data/clusters.json";
import flow from "../data/analysis-flow.json";
import "./analysis-flow.css";

gsap.registerPlugin(useGSAP);
const n = (value: number, digits = 0) => value.toLocaleString("id-ID", { maximumFractionDigits: digits });
const pct = (value: number) => `${n(value * 100, 2)}%`;
const stages = [
  ["Data", "Seleksi citra", "Awalan nama berkas menentukan citra yang dipakai. Bukan penyaringan mutu citra."],
  ["CLIP", "Citra menjadi fitur", "OpenCLIP ViT-H-14 menghasilkan representasi visual 1024 dimensi."],
  ["L2", "Satu norma, arah tetap", "Normalisasi L2 menyetarakan panjang vektor sebelum reduksi dimensi."],
  ["UMAP", "Dua jalur paralel", "UMAP 50D untuk clustering; UMAP 2D langsung dari embedding L2 untuk visualisasi."],
  ["Pilihan K", "Jumlah klaster dipilih", "Silhouette tertinggi untuk K-Means dan Ward; BIC terendah untuk GMM."],
  ["Clustering", "Tiga partisi, citra yang sama", "Ganti metode untuk membandingkan label. Posisi citra tidak berubah."],
  ["Konsensus", "Kesepakatan menjadi partisi", "Co-association menggabungkan tiga partisi. Average linkage membentuk konsensus."],
  ["Bootstrap", "Uji kestabilan partisi", "Sampling dengan pengembalian, lalu indeks unik dipakai untuk refit clustering dan konsensus."],
  ["Penamaan", "Nama mengikuti kemiripan", "Nama sistem dipilih dari kemiripan fitur citra dengan prompt teks. Bukan label terverifikasi."],
  ["Evaluasi", "Bandingkan dengan label acuan", "Evaluasi deskriptif pada citra yang sama. Acuan berasal dari nama berkas, bukan audit independen."],
] as const;
const methods = ["K-Means", "Ward", "GMM", "Konsensus"];
const chosen = analytics.selection.selected;
const selectedK = [chosen.kmeans, chosen.ward, chosen.gmm, chosen.consensus];
const points = flow.points;
const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
const bounds = { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) };
// One isotropic scale, reused for every partition; only point labels change.
const scale = Math.min(440 / (bounds.xmax - bounds.xmin), 300 / (bounds.ymax - bounds.ymin));
const px = (v: number) => 250 + (v - (bounds.xmin + bounds.xmax) / 2) * scale;
const py = (v: number) => 175 - (v - (bounds.ymin + bounds.ymax) / 2) * scale;
const label = (x: number, y: number, text: string, accent = false) => <text x={x} y={y} textAnchor="middle" className={accent ? "af-accent" : undefined}>{text}</text>;
function Box({ x, y, width = 190, title, sub }: { x: number; y: number; width?: number; title: string; sub: string }) {
  return <g className="af-node"><rect x={x} y={y} width={width} height={90} rx={2} />{label(x + width / 2, y + 36, title)}<text x={x + width / 2} y={y + 63} textAnchor="middle" className="af-small">{sub}</text></g>;
}
function Diagram({ stage }: { stage: number }) {
  return <svg className="af-diagram" viewBox="0 0 900 360" role="img" aria-label={`${stages[stage][1]}. ${({ 0: `${n(meta.dataset_images_total)} citra awal, ${n(meta.dataset_images_dropped)} dikeluarkan lewat seleksi awalan, ${n(points.length)} dipakai.`, 1: `Citra masuk OpenCLIP ViT-H-14, menghasilkan embedding ${meta.embed_dim} dimensi.`, 2: 'Embedding dibagi norma L2, menghasilkan vektor dengan norma satu.', 3: 'Embedding L2 masuk dua UMAP independen: 50 dimensi untuk pemilihan K dan clustering, 2 dimensi hanya untuk visualisasi.', 6: `Partisi K-Means, Ward, dan GMM membentuk co-association. Jarak satu dikurangi kesepakatan, average linkage menghasilkan ${chosen.consensus} klaster.` } as Record<number, string>)[stage] ?? ''} Diagram skematis, bukan lintasan pengukuran.`}>
    {stage === 0 && <><path d="M260 180H350M550 180H640" /><Box x={55} y={135} title={`${n(meta.dataset_images_total)} citra`} sub="Data awal" /><Box x={355} y={135} title="Seleksi awalan" sub={`${n(meta.dataset_images_dropped)} dikeluarkan`} /><Box x={655} y={135} title={`${n(points.length)} citra`} sub="Dipakai" /></>}
    {stage === 1 && <><path d="M245 180H350M550 180H655" /><Box x={55} y={135} title="Citra" sub="Masukan visual" /><Box x={355} y={135} title="OpenCLIP" sub="ViT-H-14" /><Box x={655} y={135} title={`${meta.embed_dim}D`} sub="Embedding citra" />{label(450, 305, "Skema ekstraksi · bukan lintasan fitur terukur")}</>}
    {stage === 2 && <><circle cx={640} cy={180} r={100} className="af-wire" /><path d="M640 180L711 109M245 180H350M550 180H585" /><Box x={55} y={135} title="Embedding" sub={`${meta.embed_dim} dimensi`} /><Box x={355} y={135} title="x / ‖x‖₂" sub="Normalisasi L2" />{label(640, 210, "‖x‖₂ = 1", true)}{label(450, 325, "Lingkaran skematis · bukan proyeksi data")}</>}
    {stage === 3 && <><path d="M300 180H430V95H560M430 180V265H560" /><Box x={70} y={135} width={230} title="Embedding L2" sub={`${meta.embed_dim}D`} /><Box x={560} y={50} width={260} title="UMAP 50D" sub="Pemilihan K dan clustering" /><Box x={560} y={220} width={260} title="UMAP 2D" sub="Visualisasi saja" />{label(225, 305, "Cabang independen", true)}</>}
    {stage === 6 && <><path d="M240 180H330M570 180H650" /><Box x={40} y={135} title="Tiga partisi" sub="K-Means · Ward · GMM" /><Box x={330} y={135} width={240} title="Co-association" sub="D = 1 − kesepakatan" /><Box x={650} y={135} width={220} title={`${chosen.consensus} klaster`} sub="Average linkage" />{label(450, 300, "Konsensus dipilih dengan silhouette pada D")}</>}
  </svg>;
}
function KCurves() {
  const fields = ["silhouette_kmeans", "silhouette_ward", "bic_gmm"] as const;
  return <div className="af-curves">{fields.map((field, i) => {
    const rows = analytics.selection.baseCurves, values = rows.map(r => r[field]);
    const lo = Math.min(...values), hi = Math.max(...values);
    const x = (k: number) => 35 + (k - rows[0].K) / (rows.at(-1)!.K - rows[0].K) * 235;
    const y = (v: number) => 160 - (v - lo) / (hi - lo) * 125;
    const pick = rows.find(r => r.K === selectedK[i])!;
    return <figure key={field}><figcaption>{methods[i]} <strong>K {selectedK[i]}</strong></figcaption><svg viewBox="0 0 300 205" role="img" aria-label={`${methods[i]}, K ${selectedK[i]}, ${i === 2 ? "BIC" : "silhouette"} ${n(pick[field], 4)}`}><path d="M35 25V170H275" /><polyline points={rows.map(r => `${x(r.K)},${y(r[field])}`).join(" ")} className="af-curve" /><line x1={x(pick.K)} x2={x(pick.K)} y1={25} y2={170} className="af-chosen" /><circle cx={x(pick.K)} cy={y(pick[field])} r={4} className="af-accent-fill" /><text x={35} y={193} className="af-small">K {rows[0].K}</text><text x={270} y={193} textAnchor="end" className="af-small">K {rows.at(-1)!.K}</text></svg><p>{i === 2 ? "BIC minimum" : "Silhouette maksimum"}<br /><strong>{n(pick[field], 4)}</strong></p></figure>;
  })}</div>;
}
function Scatter({ partition, focus }: { partition: number; focus: number | null }) {
  return <svg className="af-scatter" viewBox="0 0 500 360" role="img" aria-label={`${n(points.length)} citra, partisi ${methods[partition]}, ${selectedK[partition]} klaster. Posisi dan skala X/Y tetap. Sorotan ${focus === null ? "semua klaster" : `C${focus}`}.`}>
    <path d="M20 15V335H480" />
    {points.map((p, i) => <circle key={i} cx={px(p[0])} cy={py(p[1])} r={focus === p[partition + 2] ? 2.5 : 1.9} fill={focus === null ? `hsl(${75 + p[partition + 2] * 27} 28% 66%)` : focus === p[partition + 2] ? "var(--amber)" : "var(--bone-dim)"} opacity={focus === null || focus === p[partition + 2] ? 0.85 : 0.18}><title>C{p[partition + 2]} · UMAP ({n(p[0], 3)}, {n(p[1], 3)})</title></circle>)}
    <text x={480} y={354} textAnchor="end" className="af-small">UMAP 1</text><text x={22} y={13} className="af-small">UMAP 2</text>
  </svg>;
}

export default function AnalysisFlow() {
  const root = useRef<HTMLElement>(null), nav = useRef<HTMLElement>(null);
  const id = useId();
  const [stage, setStage] = useState(0), [partition, setPartition] = useState(0);
  const [focus, setFocus] = useState<number | null>(null), [replay, setReplay] = useState(0);
  const [reduce, setReduce] = useState(false);
  const activePartition = stage === 5 ? partition : 3;
  const named = clusters.find(c => c.id === (focus ?? 0))!;
  useGSAP(() => {
    // Motion reveals the selected explanation, never fabricates an embedding trajectory.
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      if (reduce) return;
      gsap.fromTo(".af-visual", { opacity: 0 }, { opacity: 1, duration: 0.7, ease: "power3.out" });
      gsap.from(".af-node", { opacity: 0, y: 8, duration: 0.7, stagger: 0.018, ease: "power3.out" });
    });
    return () => media.revert();
  }, { scope: root, dependencies: [stage, partition, replay, reduce], revertOnUpdate: true });
  function go(next: number) { setStage(next); setFocus(next === 8 ? 0 : null); }
  const scatterVisible = [3, 5, 6, 8].includes(stage);
  return <section ref={root} className="analysis-flow" aria-labelledby={`${id}-title`}>
    <header className="af-intro"><div><p className="af-eyebrow">E-WISE / Alur analisis</p><h2 id={`${id}-title`}>Dari citra,<br />menjadi konsensus.</h2></div><p>Satu tahap setiap waktu.<br />Telusuri bagaimana citra dikelompokkan.</p></header>
    <nav ref={nav} className="af-steps" aria-label="Tahap analisis" onKeyDown={e => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const next = e.key === "Home" ? 0 : e.key === "End" ? stages.length - 1 : Math.max(0, Math.min(stages.length - 1, stage + (e.key === "ArrowRight" ? 1 : -1)));
      go(next); nav.current?.querySelectorAll("button")[next]?.focus();
    }}>{stages.map((s, i) => <button key={s[0]} type="button" aria-current={i === stage ? "step" : undefined} aria-controls={`${id}-panel`} onClick={() => go(i)}><span>{String(i + 1).padStart(2, "0")}</span>{s[0]}</button>)}</nav>
    <section id={`${id}-panel`} className="af-panel" aria-labelledby={`${id}-stage`}>
      <div className="af-stage-heading"><div><p className="af-eyebrow">{String(stage + 1).padStart(2, "0")} / {stages.length}</p><h3 id={`${id}-stage`}>{stages[stage][1]}</h3></div><p>{stages[stage][2]}</p></div>
      <div className="af-visual">
        {[0, 1, 2, 3, 6].includes(stage) && <div className="af-diagram-scroll" tabIndex={0} role="region" aria-label="Diagram skematis, geser bila diperlukan"><Diagram stage={stage} /></div>}
        {stage === 4 && <KCurves />}
        {scatterVisible && <div className="af-map-area">
          {stage === 5 && <div className="af-methods" aria-label="Partisi clustering">{methods.slice(0, 3).map((name, i) => <button type="button" key={name} aria-pressed={partition === i} onClick={() => { setPartition(i); setFocus(null); }}>{name} · K {selectedK[i]}</button>)}</div>}
          <div className="af-map-grid"><Scatter partition={activePartition} focus={focus} /><div className="af-map-key"><p><strong>{methods[activePartition]}</strong><br />{n(points.length)} citra · {selectedK[activePartition]} klaster</p><label htmlFor={`${id}-cluster`}>Sorot klaster</label><select id={`${id}-cluster`} value={focus ?? "all"} onChange={e => setFocus(e.target.value === "all" ? null : Number(e.target.value))}><option value="all">Semua klaster</option>{Array.from({ length: selectedK[activePartition] }, (_, i) => <option key={i} value={i}>C{i} · {n(points.filter(p => p[activePartition + 2] === i).length)} citra</option>)}</select><p className="af-caption">Posisi 2D tetap, skala X/Y sama. Warna menunjukkan partisi, bukan kelas benar. Clustering memakai 50D.</p>{stage === 8 && focus === null && <p>Pilih klaster untuk melihat nama dan kemiripannya.</p>}{stage === 8 && focus !== null && <><h4>C{named.id} · {named.label}</h4><p>Kemiripan {n(named.sim_top1, 4)}<br />Kedua: {named.label_top2}, {n(named.sim_top2, 4)}<br />Margin {n(named.margin, 4)}</p><p className="af-warning">Kemiripan bukan probabilitas. C9 campuran; C11 dinamai Mobile meski didominasi Player.</p></>}</div></div>
        </div>}
        {stage === 7 && <div className="af-bootstrap"><div className="af-protocol"><span>UMAP 50D tetap</span><span>K tetap: {selectedK.join(" / ")}</span><span>{analytics.bootstrap.replicates} refit clustering</span></div><p className="af-metric">{n(analytics.bootstrap.summary.ensemble.mean, 4)}<span>Rata-rata ARI konsensus</span></p><svg viewBox="0 0 800 120" role="img" aria-label={`${analytics.bootstrap.replicates} hasil bootstrap konsensus; rata-rata ARI ${n(analytics.bootstrap.summary.ensemble.mean, 4)}, skala ARI 0 sampai 1`}><line x1={35} x2={765} y1={55} y2={55} className="af-wire" />{analytics.bootstrap.rows.map((row, i) => <circle key={row.bootstrap} cx={35 + row.ARI_ensemble * 730} cy={37 + i % 4 * 12} r={3} className="af-dot"><title>Bootstrap {row.bootstrap}: ARI {n(row.ARI_ensemble, 4)}</title></circle>)}<line x1={35 + analytics.bootstrap.summary.ensemble.mean * 730} x2={35 + analytics.bootstrap.summary.ensemble.mean * 730} y1={15} y2={92} className="af-chosen" /><text x={35} y={113}>0</text><text x={765} y={113} textAnchor="end">1</text></svg><p className="af-caption">Titik: ARI tiap replikasi. Garis: rata-rata. Dibandingkan pada observasi unik yang sama terhadap partisi data penuh. CLIP, UMAP, dan pemilihan K tidak diulang.</p></div>}
        {stage === 9 && <div className="af-evaluation"><dl>{[["Akurasi penamaan", pct(analytics.evaluation.accuracy)], ["Macro-F1", n(analytics.evaluation.macroF1, 4)], ["ARI klaster vs acuan", n(analytics.evaluation.ariClusters, 4)]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><svg viewBox="0 0 800 95" role="img" aria-label={`Akurasi penamaan ${pct(analytics.evaluation.accuracy)} pada ${n(analytics.evaluation.count)} citra`}><rect x={30} y={20} width={740} height={24} className="af-muted-fill" /><rect x={30} y={20} width={740 * analytics.evaluation.accuracy} height={24} className="af-accent-fill" /><text x={30} y={78}>0%</text><text x={770} y={78} textAnchor="end">100%</text></svg><p className="af-warning">Kestabilan bukan ketepatan nama. C9 dan C11 perlu tinjauan. Rincian kelas dan evaluasi tersedia di bawah.</p></div>}
      </div>
      <div className="af-stage-foot">{stage < 3 ? "Skematis · bukan hasil pengukuran posisi fitur" : stage === 4 ? "Skor terukur pada UMAP 50D" : stage === 7 ? "Bootstrap bersyarat pada embedding dan K tetap" : stage === 9 ? `${n(analytics.evaluation.count)} citra · evaluasi retrospektif` : stage === 8 ? "Nama sistem · skor kemiripan, bukan probabilitas" : "Peta terukur UMAP 2D · diagram alur skematis"}</div>
    </section>
    <div className="af-controls"><button type="button" disabled={stage === 0} onClick={() => go(stage - 1)}>Sebelumnya</button><button type="button" disabled={stage === stages.length - 1} onClick={() => go(stage + 1)}>Berikutnya</button><button type="button" onClick={() => setReplay(replay + 1)}>Putar ulang</button><button type="button" className="af-reduce" aria-pressed={reduce} onClick={() => setReduce(!reduce)}>Kurangi gerak: {reduce ? "aktif" : "nonaktif"}</button></div>
    <p className="af-caption">Tanpa putaran otomatis. Preferensi pengurangan gerak perangkat selalu dihormati.</p>
    <p className="af-sr" role="status" aria-live="polite" aria-atomic="true">Tahap {stage + 1} dari {stages.length}: {stages[stage][1]}. {stages[stage][2]} {stage === 5 ? methods[partition] : ""}{replay > 0 ? ` · Putar ulang ${replay}` : ""}</p>
  </section>;
}
