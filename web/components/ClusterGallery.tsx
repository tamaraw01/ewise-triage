"use client";

import { useEffect, useState } from "react";
import gallery from "@/data/gallery.json";

type Example = { filename: string; label: string; src: string; width: number; height: number };

function MemberImage({ example, selected }: { example: Example; selected: number }) {
  const [state, setState] = useState("loading");
  return <figure>
    <div className="member-photo" aria-busy={state === "loading"}>
      {/* Native img preserves prebuilt ≤150px thumbnails without optimization requests. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {state !== "error" && <img src={example.src} width={example.width} height={example.height} loading="lazy" decoding="async" alt={`${example.label}, anggota C${selected}, ${example.filename}`} onLoad={() => setState("ready")} onError={() => setState("error")} />}
      {state === "loading" && <span className="photo-state">Memuat foto…</span>}
      {state === "error" && <span className="photo-state" role="status">Foto tidak tersedia</span>}
    </div>
    <figcaption>{example.label}<small>{example.filename}</small></figcaption>
    <style jsx>{`
      figure { margin:0; min-width:0; }
      .member-photo { min-height:150px; height:150px; display:flex; position:relative; align-items:center; justify-content:center; background:var(--iron); }
      img { display:block; max-width:100%; max-height:150px; width:auto; height:auto; object-fit:contain; }
      .photo-state { position:absolute; inset:0; display:grid; place-items:center; font-size:12px; color:var(--bone-dim); background:var(--iron); text-align:center; }
      figcaption { margin-top:8px; font-size:13px; overflow-wrap:anywhere; }
      small { display:block; color:var(--bone-dim); font-size:11px; margin-top:3px; }
    `}</style>
  </figure>;
}

function Members({ selected }: { selected: number }) {
  const [examples, setExamples] = useState<Example[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/gallery/C${selected}.json`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Gallery unavailable"); return response.json(); })
      .then(data => {
        if (data.id !== selected || !Array.isArray(data.examples) || data.examples.some((item: Example) => typeof item.filename !== "string" || typeof item.label !== "string" || !/^\/gallery\/[A-Za-z0-9_-]+\.webp$/.test(item.src) || !(item.width > 0 && item.width <= 150 && item.height > 0 && item.height <= 150))) throw new Error("Invalid gallery data");
        if (!controller.signal.aborted) setExamples(data.examples);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [selected, attempt]);
  if (error) return <div role="status"><p>Contoh foto belum dapat dimuat.</p><button className="btn" type="button" onClick={() => { setError(false); setAttempt(value => value + 1); }}>Coba lagi</button></div>;
  if (examples === null) return <p role="status">Memuat contoh C{selected}…</p>;
  if (!examples.length) return <p role="status">Belum ada contoh foto untuk C{selected}.</p>;
  return <div className="members" aria-label={`Contoh foto anggota C${selected}`}>
    {examples.map(example => <MemberImage key={example.filename} example={example} selected={selected} />)}
    <style jsx>{`.members { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:20px 12px; margin-top:16px; }`}</style>
  </div>;
}

export default function ClusterGallery({ selected }: { selected: number }) {
  const cluster = gallery.clusters.find(item => item.id === selected);
  return <section className="cluster-gallery" aria-label="Contoh anggota kelompok">
    <div className="gallery-heading"><h3>Contoh anggota kelompok</h3>{cluster && <span className="num">C{selected} · {cluster.sampleCount} / {cluster.count.toLocaleString("id-ID")}</span>}</div>
    {cluster && cluster.systemLabel !== Object.entries(cluster.mix).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0][0] && <p className="caveat">C{selected} berisi {Object.entries(cluster.mix).filter(([, count]) => count).map(([label, count]) => `${count} ${label}`).join(", ")}. Label sistem: {cluster.systemLabel}. Periksa barang secara manual.</p>}
    <p className="dossier-note">Contoh mencakup tiap label, bukan proporsi kelompok. Label berasal dari nama file; subtipe belum diverifikasi.</p>
    {cluster ? <Members key={selected} selected={selected} /> : <p role="status">Kelompok tidak ditemukan.</p>}
    <style jsx>{`
      .cluster-gallery { margin-top:24px; padding-top:20px; border-top:1px solid var(--edge); min-width:0; }
      .gallery-heading { display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px; }
      h3 { font-size:20px; font-weight:600; margin:0; }
      .num { font-size:13px; color:var(--bone-dim); }
    `}</style>
  </section>;
}
