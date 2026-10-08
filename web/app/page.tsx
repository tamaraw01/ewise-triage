"use client";

import { useState } from "react";
import TriagePanel from "@/components/TriagePanel";
import ClusterMap from "@/components/ClusterMap";
import meta from "@/data/meta.json";
import { CLUSTERS_META, LANES, fixed4, type LaneCode } from "@/lib/data";

const sections = ["Konsol", "Cluster Explorer"] as const;
type Section = (typeof sections)[number];
const LANE_ORDER: LaneCode[] = ["P1", "P2", "P3", "MR"];
const clusters = Object.values(CLUSTERS_META);

export default function Page() {
  const [section, setSection] = useState<Section>("Konsol");
  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div className="brand">
          <h1>E-WISE</h1>
          <p>Triase limbah elektronik dari satu foto</p>
        </div>
        <span className="num spec">{clusters.length} klaster · ambang margin 0,0297</span>
      </header>
      <nav className="dashboard-nav" aria-label="Bagian dashboard">
        {sections.map(name => (
          <button key={name} type="button" aria-current={section === name ? "page" : undefined} onClick={() => setSection(name)}>{name}</button>
        ))}
      </nav>
      {section === "Konsol" ? <TriagePanel /> : <Explorer />}
      <footer className="dashboard-footer">© 2026 E-WISE</footer>
    </main>
  );
}

function Explorer() {
  const [selected, setSelected] = useState(0);
  const c = CLUSTERS_META[selected];
  const contested = c.lane === "MR";
  return (
    <section aria-labelledby="cluster-title">
      <h2 id="cluster-title" className="sr-only">Cluster Explorer</h2>
      <p className="explorer-intro">{clusters.length} klaster dari eksperimen riset. Ukuran dan kemurnian mengacu pada dataset, bukan unggahan sesi.</p>
      <div className="explorer">
        <div className="panel">
          <div className="panel-h"><h2>Daftar klaster</h2><span className="num spec">urut per jalur</span></div>
          <div className="ticks" aria-hidden="true" />
          {LANE_ORDER.map(code => {
            const rows = clusters.filter(x => x.lane === code);
            if (!rows.length) return null;
            return (
              <div key={code} className="lane-group">
                <h3 className={code === "P1" ? "is-hazard" : undefined}><span className="num">{code}</span>{LANES[code].desc}</h3>
                <div className="c-head num" aria-hidden="true"><span>ID</span><span>Isi dominan</span><span className="r">n</span><span className="r">Murni</span><span className="r zs-col">Margin ZS</span></div>
                {rows.map(x => (
                  <button key={x.id} type="button" className="c-row" aria-pressed={selected === x.id} onClick={() => setSelected(x.id)}>
                    <span className="num">C{x.id}</span>
                    <span className="sub">{x.dom}{x.lane === "MR" && <span className="flag">terbantah</span>}</span>
                    <span className="num r dim">{x.n}</span>
                    <span className="num r">{x.pur.toLocaleString("id-ID")}%</span>
                    <span className="num r margin zs-col">{fixed4(x.zs)}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <div className="explorer-side">
          <figure className="panel">
            <div className="panel-h"><h2>Peta klaster</h2><span className="num spec">C{c.id} disorot</span></div>
            <div className="ticks" aria-hidden="true" />
            <div className="panel-b">
              <ClusterMap highlightedId={selected} />
              <figcaption>Proyeksi 2D, {meta.scatter_points.toLocaleString("id-ID")} titik sampel. Bukan ruang inferensi atau peta hasil unggahan.</figcaption>
            </div>
          </figure>

          <article className="panel" aria-live="polite">
            <div className="panel-h"><h2>C{c.id} · {c.sub}</h2><span className={`num spec${c.lane === "P1" ? " is-hazard" : ""}`}>{c.lane}</span></div>
            <div className="ticks" aria-hidden="true" />
            <div className="panel-b">
              {contested && <p className="caveat"><strong>Kegagalan penamaan · n={c.n}. </strong>{c.id === 9 ? "C9 campuran. Label zero-shot Mobile tidak dapat dipercaya; kelas dominan Keyboard hanya 25,8%." : "C11 salah nama. Label zero-shot Mobile bertentangan dengan kelas dominan Player (99,6%)."} Wajib peninjauan manual.</p>}
              <dl className="facts">
                <div><dt>Nama prediksi zero-shot</dt><dd>{c.name}</dd></div>
                <div><dt>Jumlah citra riset</dt><dd className="num">{c.n}</dd></div>
                <div><dt>Kelas dominan / kemurnian</dt><dd>{c.dom} / <span className="num">{c.pur.toLocaleString("id-ID")}%</span></dd></div>
                <div><dt>Similaritas zero-shot</dt><dd className="num">{fixed4(c.sim)}</dd></div>
                <div><dt>Margin penamaan zero-shot</dt><dd className="num">{fixed4(c.zs)}</dd></div>
                <div><dt>Jalur</dt><dd>{c.lane} · {LANES[c.lane].desc}</dd></div>
              </dl>
              <p><strong>Material: </strong>{c.material}</p>
              <p>{c.action}</p>
              {c.hazard && <p className="hazard-note">Perhatian: {c.hazard}. Ikuti SOP dan gunakan petugas terlatih.</p>}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
