"use client";

import { useState } from 'react';
import TriagePanel from '@/components/TriagePanel';
import ClusterMap from '@/components/ClusterMap';
import meta from '@/data/meta.json';
import { CLUSTERS_META, LANES, fixed4 } from '@/lib/data';
import { researchSubset } from '@/lib/session';

const sections = ['Konsol', 'Cluster Explorer'] as const;
const pct = (value: number) => `${(value * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
const research = researchSubset();

export default function Page() {
  const [section, setSection] = useState<string>('Konsol');
  return <main className="dashboard">
    <header className="dashboard-header"><div><h1>E-WISE</h1><p>E-Waste Intelligent Sorting &amp; Exploration</p></div><span className="num text-bone-dim">CLIP ViT-H/14</span></header>
    <nav className="dashboard-nav" aria-label="Bagian dashboard">{sections.map(name => <button key={name} aria-current={section === name ? 'page' : undefined} onClick={() => setSection(name)}>{name}</button>)}</nav>
    <div id="konten" tabIndex={-1}>
      {section === 'Konsol' && <section aria-label="Konsol triase"><TriagePanel />


      </section>}
      {section === 'Cluster Explorer' && <Explorer />}
    </div>
    <footer className="dashboard-footer">Pendukung keputusan berbasis citra. Penanganan akhir memerlukan verifikasi petugas sesuai SOP fasilitas.</footer>
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
  </section>;
}

