"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Image from "next/image";
import dynamic from "next/dynamic";
import TriagePanel from "@/components/TriagePanel";
import ExplorationTools, { researchClusters } from "@/components/ExplorationTools";
const ClusterField = dynamic(() => import("@/components/ClusterField"), {
  ssr: false,
  loading: () => <div className="field-loading" role="status">Memuat peta klaster…</div>,
});
import meta from "@/data/meta.json";
import { LANES, fixed4 } from "@/lib/data";

gsap.registerPlugin(useGSAP);

const sections = ["Konsol", "Cluster Explorer"] as const;
type Section = (typeof sections)[number];
const clusters = researchClusters;
gsap.config({ nullTargetWarn: false }); // panels share one timeline; absent targets are expected

export default function Page() {
  const [section, setSection] = useState<Section>("Konsol");
  const [explorerOpened, setExplorerOpened] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      const panel = stage.current?.querySelector('[role="tabpanel"]:not([hidden])');
      if (!panel) return;
      gsap.timeline({ defaults: { ease: "power2.out" } })
        .from(panel.querySelectorAll(".workspace-heading"), { y: 6, duration: 0.2 })
        .from(panel.querySelectorAll(".capture-panel, .verdict-panel, .explorer"), { y: 10, duration: 0.24 }, 0.04);
    });
    return () => motion.revert();
  }, { scope: stage, dependencies: [section], revertOnUpdate: true });
  return (
    <main id="konten" className="dashboard">
      <header className="dashboard-header">
        <div className="brand"><Image src="/ewise-mark.png" alt="" width={56} height={56} priority className="brand-mark" /><h1 aria-label="E-WISE">E<span className="brand-dash" aria-hidden="true" />WISE</h1><p>Electronic Waste Intelligent Sorting &amp; Exploration</p></div>
      </header>
      <nav className="dashboard-nav" role="tablist" aria-label="Ruang kerja">
        {sections.map((name, index) => <button key={name} id={`tab-${index}`} type="button" role="tab" aria-selected={section === name} aria-controls={`panel-${index}`} tabIndex={section === name ? 0 : -1} onClick={() => { setSection(name); if (index === 1) setExplorerOpened(true); }} onKeyDown={event => {
          const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : event.key === "ArrowRight" || event.key === "ArrowLeft" ? 1 - index : -1;
          if (next < 0) return;
          event.preventDefault();
          document.getElementById(`tab-${next}`)?.click();
          document.getElementById(`tab-${next}`)?.focus();
        }}>{name}</button>)}
      </nav>
      <div ref={stage} className="dashboard-stage">
        <div id="panel-0" role="tabpanel" aria-labelledby="tab-0" hidden={section !== "Konsol"}><TriagePanel active={section === "Konsol"} /></div>
        <div id="panel-1" role="tabpanel" aria-labelledby="tab-1" hidden={section !== "Cluster Explorer"}>{explorerOpened && <Explorer />}</div>
      </div>
      <footer className="dashboard-footer">© {new Date().getFullYear()} E-WISE</footer>
    </main>
  );
}

function Explorer() {
  const [selected, setSelected] = useState(0);
  const dossier = useRef<HTMLElement>(null);
  useGSAP(() => {
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".dossier-title, .facts, .dossier-action", { y: 5, duration: 0.2, stagger: 0.025, ease: "power2.out" });
    });
    return () => motion.revert();
  }, { scope: dossier, dependencies: [selected], revertOnUpdate: true });
  const c = clusters.find(cluster => cluster.id === selected)!;
  const contested = c.lane === "MR";
  return (
    <section aria-labelledby="cluster-title" className="explorer-workspace">
      <div className="workspace-heading"><h2 id="cluster-title">Referensi perangkat</h2><p>{meta.dataset_images_used.toLocaleString("id-ID")} citra · {clusters.length} klaster</p></div>
      <div className="explorer">
        <figure className="cluster-atlas">
          <div className="panel-h"><h3>Peta sebaran</h3><span className="spec num">{meta.scatter_points.toLocaleString("id-ID")} sampel · 2D</span></div>
          <ClusterField selected={selected} onSelect={setSelected} />
          <div className="atlas-controls" aria-label="Pilih klaster pada peta">
            {clusters.map(x => <button key={x.id} className="cluster-key num" type="button" aria-pressed={selected === x.id} onClick={() => setSelected(x.id)}>C{x.id}</button>)}
          </div>
          <figcaption>Pilih klaster untuk melihat panduan penanganan.</figcaption>
        </figure>
        <article ref={dossier} className="cluster-dossier" aria-live="polite">
          <div className="dossier-title"><span className="dossier-id num">C{c.id}</span><div><h3>{c.sub}</h3><span className={`spec${c.lane === "P1" ? " is-hazard" : ""}`}>{c.lane} · {LANES[c.lane].desc}</span></div></div>
          {contested && <p className="caveat"><strong>Perlu pemeriksaan petugas. </strong>{c.id === 9 ? "C9 campuran; kelas dominan Keyboard hanya 25,8%." : "C11 dinamai Mobile, tetapi kelas dominan Player mencapai 99,6%."} Wajib peninjauan manual.</p>}
          <dl className="facts">
            <div><dt>Foto referensi</dt><dd className="num">{c.n}</dd></div>
            <div><dt>Kelas dominan / kemurnian</dt><dd>{c.dom} / <span className="num">{c.pur.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</span></dd></div>
          </dl>
          <details className="dossier-detail"><summary>Detail label</summary><dl className="facts"><div><dt>Label sistem</dt><dd>{c.name}</dd></div><div><dt>Skor kecocokan label</dt><dd className="num">{fixed4(c.sim)}</dd></div><div><dt>Selisih skor label</dt><dd className="num">{fixed4(c.zs)}</dd></div></dl><p className="dossier-note">Selisih skor dua label teratas. Bukan skor kecocokan foto yang diunggah.</p></details>
          {c.hazard && <p className="hazard-note">Perhatian: {c.hazard}.</p>}
          <div className="dossier-action"><h4>Penanganan oleh petugas terlatih</h4><p>{c.action} Ikuti SOP fasilitas setelah pemeriksaan fisik.</p></div>
          <p className="dossier-note"><strong>Potensi material: </strong>{c.material}. Bukan komposisi yang terdeteksi dari foto.</p>
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
