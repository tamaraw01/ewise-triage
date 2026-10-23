"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Image from "next/image";
import dynamic from "next/dynamic";
import DemoWorkspace from "@/components/DemoWorkspace";
import "./demo.css";
const ResearchDashboard = dynamic(() => import("@/components/ResearchDashboard"));
const AnalysisFlow = dynamic(() => import("@/components/AnalysisFlow"));
const Implementation = dynamic(() => import("@/components/Implementation"));
const Explorer = dynamic(() => import("@/components/Explorer"));
import { CLUSTERS_META } from "@/lib/data";

gsap.registerPlugin(useGSAP);

const sections = ["Konsol", "Cluster Explorer", "Statistik", "Proses", "Implementasi"] as const;
type Section = (typeof sections)[number];
const clusters = Object.values(CLUSTERS_META);
gsap.config({ nullTargetWarn: false }); // panels share one timeline; absent targets are expected

export default function Page() {
  const [section, setSection] = useState<Section>("Konsol");
  const [explorerOpened, setExplorerOpened] = useState(false);
  const [selected, setSelected] = useState(0);
  const explore = (id: number) => {
    if (!clusters.some(cluster => cluster.id === id)) return `Kelompok C${id} tidak ada di referensi.`;
    setSelected(id);
    setExplorerOpened(true);
    setSection("Cluster Explorer");
    requestAnimationFrame(() => document.getElementById("tab-1")?.focus());
    return "";
  };
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
          const next = event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : event.key === "ArrowRight" ? (index + 1) % sections.length : event.key === "ArrowLeft" ? (index + sections.length - 1) % sections.length : -1;
          if (next < 0) return;
          event.preventDefault();
          document.getElementById(`tab-${next}`)?.click();
          document.getElementById(`tab-${next}`)?.focus();
        }}>{name}</button>)}
      </nav>
      <div ref={stage} className="dashboard-stage">
        <div id="panel-0" role="tabpanel" aria-labelledby="tab-0" hidden={section !== "Konsol"}><DemoWorkspace active={section === "Konsol"} onExplore={explore} /></div>
        <div id="panel-1" role="tabpanel" aria-labelledby="tab-1" hidden={section !== "Cluster Explorer"}>{explorerOpened && <Explorer selected={selected} onSelect={setSelected} />}</div>
        <div id="panel-2" role="tabpanel" aria-labelledby="tab-2" hidden={section !== "Statistik"}>{section === "Statistik" && <ResearchDashboard />}</div>
        <div id="panel-3" role="tabpanel" aria-labelledby="tab-3" hidden={section !== "Proses"}>{section === "Proses" && <AnalysisFlow />}</div>
        <div id="panel-4" role="tabpanel" aria-labelledby="tab-4" hidden={section !== "Implementasi"}>{section === "Implementasi" && <Implementation />}</div>
      </div>
      <footer className="dashboard-footer">© {new Date().getFullYear()} E-WISE</footer>
    </main>
  );
}
