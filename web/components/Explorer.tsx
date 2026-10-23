"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import dynamic from "next/dynamic";
import ExplorationTools, { researchClusters } from "@/components/ExplorationTools";
import ClusterGallery from "@/components/ClusterGallery";
import meta from "@/data/meta.json";
import { LANES, fixed4 } from "@/lib/data";
import { scatter } from "@/lib/scatter";
const clusters = researchClusters;
gsap.registerPlugin(useGSAP);
const ClusterField = dynamic(() => import("@/components/ClusterField"), {
  ssr: false,
  loading: () => <div className="field-loading" role="status">Memuat peta klaster…</div>,
});

export default function Explorer({ selected, onSelect: setSelected }: { selected: number; onSelect: (id: number) => void }) {
  const dossier = useRef<HTMLElement>(null);
  useGSAP(() => {
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".dossier-title, .facts, .dossier-action", { y: 5, duration: 0.2, stagger: 0.025, ease: "power2.out" });
    });
    return () => motion.revert();
  }, { scope: dossier, dependencies: [selected], revertOnUpdate: true });
  const c = clusters.find(cluster => cluster.id === selected);
  if (!c) return <p role="alert">Kelompok C{selected} tidak ada di referensi.</p>;
  const contested = c.lane === "MR";
  return (
    <section aria-labelledby="cluster-title" className="explorer-workspace">
      <div className="workspace-heading"><h2 id="cluster-title">Referensi perangkat</h2><p>{meta.dataset_images_used.toLocaleString("id-ID")} citra referensi · {clusters.length} kelompok</p></div>
      <div className="explorer">
        <figure className="cluster-atlas">
          <div className="panel-h"><h3>Peta sebaran</h3><span className="spec num">{scatter.length.toLocaleString("id-ID")} sampel · 2D</span></div>
          <ClusterField selected={selected} onSelect={setSelected} />
          <div className="atlas-controls" aria-label="Pilih klaster pada peta">
            {clusters.map(x => <button key={x.id} className="cluster-key num" type="button" aria-pressed={selected === x.id} onClick={() => setSelected(x.id)}>C{x.id}</button>)}
          </div>
          <figcaption>Pilih kelompok untuk melihat contoh dan acuan pemeriksaan.</figcaption>
        </figure>
        <article ref={dossier} className="cluster-dossier" aria-live="polite">
          <div className="dossier-title"><span className="dossier-id num">C{c.id}</span><div><h3>{c.sub}</h3><span className={`spec${c.lane === "P1" ? " is-hazard" : ""}`}>{c.lane} · {LANES[c.lane].desc}</span></div></div>
          {contested && <p className="caveat"><strong>Perlu pemeriksaan petugas. </strong>{c.id === 9 ? "Referensi memuat foto berkualitas rendah atau warna yang berubah." : "Referensi pemutar musik memiliki ketidaksesuaian label."} Wajib peninjauan manual.</p>}
          <dl className="facts">
            <div><dt>Jumlah citra referensi</dt><dd className="num">{c.n}</dd></div>
            <div><dt>Kelas dominan / kemurnian kelompok</dt><dd>{c.dom} / <span className="num">{c.pur.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</span></dd></div>
          </dl>
          <p className="dossier-note">Kemurnian dihitung pada citra referensi, bukan akurasi untuk foto baru.</p>
          <ClusterGallery selected={selected} />
          <details className="dossier-detail"><summary>Detail label</summary><dl className="facts"><div><dt>Label sistem</dt><dd>{c.name}</dd></div><div><dt>Skor kecocokan label</dt><dd className="num">{fixed4(c.sim)}</dd></div><div><dt>Selisih skor label</dt><dd className="num">{fixed4(c.zs)}</dd></div></dl><p className="dossier-note">Selisih skor dua label teratas. Bukan skor kecocokan foto yang diunggah.</p></details>
          {c.hazard && <p className="hazard-note">{c.hazard}</p>}
          <div className="dossier-action"><h4>Penanganan awal</h4><p>{c.action}</p></div>
          <p className="dossier-note"><strong>Material: </strong>{c.material}</p>
        </article>
      </div>
      <div className="explorer-reference">
        <div className="cluster-register"><ExplorationTools selected={selected} onSelect={setSelected} /></div>
        <aside className="research-context" aria-labelledby="research-title">
          <h3 id="research-title">Perbedaan perangkat</h3>
          <dl className="subtype-findings">
            <div><dt>Baterai <span className="num">C4 / C10</span></dt><dd>Li-ion ponsel/laptop dibanding sel silinder dan aki. Kimia baterai tetap perlu diperiksa.</dd></div>
            <div><dt>Televisi <span className="num">C8 / C12</span></dt><dd>Layar datar dibanding tabung CRT.</dd></div>
            <div><dt>Mesin cuci <span className="num">C2 / C5</span></dt><dd>Bukaan depan dibanding bukaan atas.</dd></div>
          </dl>

        </aside>
      </div>
    </section>
  );
}
