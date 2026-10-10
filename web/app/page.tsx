"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import TriagePanel from "@/components/TriagePanel";
import ClusterField from "@/components/ClusterField";
import meta from "@/data/meta.json";
import { CLUSTERS_META, LANES, fixed4, type LaneCode } from "@/lib/data";

const sections = ["Konsol", "Cluster Explorer"] as const;
type Section = (typeof sections)[number];
const LANE_ORDER: LaneCode[] = ["P1", "P2", "P3", "MR"];
const clusters = Object.values(CLUSTERS_META);

export default function Page() {
  const [section, setSection] = useState<Section>("Konsol");
  const stage = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(stage.current!.querySelectorAll(":scope > * > *"), { y: 14, autoAlpha: 0, duration: .45, ease: "power3.out", stagger: .05, clearProps: "all" });
    });
  }, { dependencies: [section], scope: stage });
  return (
    <main id="konten" className="dashboard">
      <header className="dashboard-header">
        <div className="brand"><Image src="/ewise-mark.png" alt="" width={44} height={44} priority className="brand-mark" /><h1 aria-label="E-WISE">E<span className="brand-dash" aria-hidden="true" />WISE</h1><p>Triase limbah elektronik</p></div>
        <span className="spec">Satu foto. Rekomendasi jalur. Pemeriksaan petugas.</span>
      </header>
      <nav className="dashboard-nav" aria-label="Bagian dashboard">
        {sections.map(name => <button key={name} type="button" aria-current={section === name ? "page" : undefined} onClick={() => setSection(name)}>{name}</button>)}
      </nav>
      <div ref={stage} className="dashboard-stage">{section === "Konsol" ? <TriagePanel /> : <Explorer />}</div>
      <footer className="dashboard-footer"><span>E-WISE</span><span>Hasil visual bukan pemeriksaan fisik. Ikuti SOP fasilitas.</span></footer>
    </main>
  );
}

function Explorer() {
  const [selected, setSelected] = useState(0);
  const c = CLUSTERS_META[selected];
  const contested = c.lane === "MR";
  return (
    <section aria-labelledby="cluster-title" className="explorer-workspace">
      <div className="workspace-heading"><h2 id="cluster-title">Anatomi klaster</h2><p><strong>{meta.dataset_images_used.toLocaleString("id-ID")} citra · {clusters.length} klaster</strong> <br />Dataset riset, bukan hasil unggahan sesi.</p></div>
      <div className="explorer">
        <figure className="cluster-atlas">
          <div className="panel-h"><h3>Peta sebaran</h3><span className="spec num">C{c.id} dipilih</span></div>
          <ClusterField selected={selected} onSelect={setSelected} />
          <div className="atlas-controls" aria-label="Pilih klaster pada peta">
            {clusters.map(x => <button key={x.id} className="cluster-key num" type="button" aria-pressed={selected === x.id} onClick={() => setSelected(x.id)}>C{x.id}</button>)}
          </div>
          <figcaption>Proyeksi 2D · {meta.scatter_points.toLocaleString("id-ID")} titik sampel. Klik titik atau ID untuk memeriksa klaster. Kemiringan hanya tampilan; posisi bukan ruang inferensi.</figcaption>
        </figure>
        <article className="cluster-dossier" aria-live="polite">
          <div className="dossier-title"><span className="dossier-id num">C{c.id}</span><div><h3>{c.sub}</h3><span className={`spec${c.lane === "P1" ? " is-hazard" : ""}`}>{c.lane} · {LANES[c.lane].desc}</span></div></div>
          {contested && <p className="caveat"><strong>Nama zero-shot terbantah. </strong>{c.id === 9 ? "C9 campuran; kelas dominan Keyboard hanya 25,8%." : "C11 dinamai Mobile, tetapi kelas dominan Player mencapai 99,6%."} Wajib peninjauan manual.</p>}
          <dl className="facts">
            <div><dt>Citra riset</dt><dd className="num">{c.n}</dd></div>
            <div><dt>Kelas dominan / kemurnian</dt><dd>{c.dom} / <span className="num">{c.pur.toLocaleString("id-ID")}%</span></dd></div>
            <div><dt>Nama zero-shot</dt><dd>{c.name}</dd></div>
            <div><dt>Similaritas zero-shot</dt><dd className="num">{fixed4(c.sim)}</dd></div>
            <div><dt>Margin penamaan zero-shot</dt><dd className="num">{fixed4(c.zs)}</dd></div>
          </dl>
          <p className="dossier-note">Margin ini membandingkan dua kandidat nama klaster, bukan kecocokan foto dengan centroid.</p>
          {c.hazard && <p className="hazard-note">Perhatian: {c.hazard}.</p>}
          <div className="dossier-action"><h4>Penanganan oleh petugas terlatih</h4><p>{c.action} Ikuti SOP fasilitas setelah pemeriksaan fisik.</p></div>
          <p className="dossier-note"><strong>Potensi material: </strong>{c.material}. Bukan komposisi yang terdeteksi dari foto.</p>
        </article>
      </div>
      <div className="explorer-reference">
        <div className="cluster-register">
          <div className="register-heading"><h3>Indeks klaster</h3><span className="spec">Dikelompokkan menurut jalur</span></div>
          {LANE_ORDER.map(code => <div key={code} className="lane-group">
            <h4><span className="num">{code}</span>{LANES[code].desc}</h4>
            <div className="c-head num" aria-hidden="true"><span>ID</span><span>Isi dominan</span><span className="r">Citra</span><span className="r">Murni</span><span className="r zs-col">Margin nama</span></div>
            {clusters.filter(x => x.lane === code).map(x => <button key={x.id} type="button" className="c-row" aria-pressed={selected === x.id} onClick={() => setSelected(x.id)}>
              <span className="num">C{x.id}</span><span className="sub">{x.dom}{x.lane === "MR" && <span className="flag">tinjau</span>}</span><span className="num r dim">{x.n}</span><span className="num r">{x.pur.toLocaleString("id-ID")}%</span><span className="num r margin zs-col">{fixed4(x.zs)}</span>
            </button>)}
          </div>)}
        </div>
        <aside className="research-context" aria-labelledby="research-title">
          <h3 id="research-title">Mengapa 14, bukan 10?</h3>
          <p>Konsensus menemukan subtipe di dalam 10 kategori perangkat. Bentuk yang berbeda dapat membutuhkan penanganan berbeda.</p>
          <dl className="subtype-findings">
            <div><dt>Baterai <span className="num">C4 / C10</span></dt><dd>Li-ion ponsel/laptop dibanding sel silinder dan aki. Kimia baterai tetap perlu diperiksa.</dd></div>
            <div><dt>Televisi <span className="num">C8 / C12</span></dt><dd>Layar datar dibanding tabung CRT.</dd></div>
            <div><dt>Mesin cuci <span className="num">C2 / C5</span></dt><dd>Bukaan depan dibanding bukaan atas.</dd></div>
          </dl>
          <details className="research-method" open><summary>Metode & batas evaluasi</summary><p>Fitur CLIP ViT-H/14 direduksi dengan UMAP. K-Means, Ward, dan GMM digabung melalui evidence accumulation, lalu klaster dinamai secara zero-shot.</p><p>Dalam evaluasi historis dengan ambang ilustratif, 89,7% citra dilabeli otomatis dengan akurasi 97,57%. Bukan ukuran kinerja unggahan baru.</p><p className="research-source">Sumber: paper E-WISE, BDC 2026, §3.3, §3.6–3.8; Tabel 5 & 8.</p></details>
        </aside>
      </div>
    </section>
  );
}
