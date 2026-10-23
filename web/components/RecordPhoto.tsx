"use client";

import { useEffect, useState } from "react";
import { readPhoto } from "@/lib/demo-photos";

export default function RecordPhoto({ id, fileName }: { id: string; fileName: string }) {
  const [attempt, setAttempt] = useState(0);
  const [photo, setPhoto] = useState<{ url: string; state: "loading" | "ready" | "missing" | "error" }>({ url: "", state: "loading" });
  useEffect(() => {
    let cancelled = false;
    let url = "";
    readPhoto(id).then(blob => {
      if (cancelled) return;
      if (!blob) { setPhoto({ url: "", state: "missing" }); return; }
      url = URL.createObjectURL(blob);
      setPhoto({ url, state: "ready" });
    }).catch(() => { if (!cancelled) setPhoto({ url: "", state: "error" }); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [id, attempt]);
  return <section className="record-inference" aria-label="Foto bukti barang">
    <h4>Foto sumber</h4>
    {photo.state === "loading" && <p role="status">Memuat foto…</p>}
    {photo.state === "missing" && <p>Foto tidak tersedia di browser ini. Foto tidak tersimpan pada catatan lama; data browser juga dapat terhapus.</p>}
    {photo.state === "error" && <p role="alert">Foto gagal dibaca. Coba muat ulang foto.</p>}
    {photo.url && <>
      {/* eslint-disable-next-line @next/next/no-img-element -- Original local evidence, never sent to image optimization. */}
      <img src={photo.url} alt={`Foto sumber barang: ${fileName}`} style={{ display: "block", width: "100%", maxHeight: 360, objectFit: "contain" }} onError={() => setPhoto(value => ({ ...value, state: "error" }))} />
      <div className="record-actions"><a className="btn" href={photo.url} target="_blank" rel="noopener noreferrer">Buka foto sumber</a><a className="btn" href={photo.url} download={fileName}>Unduh foto</a></div>
    </>}
    {(photo.state === "error" || photo.state === "missing") && <button type="button" className="btn" onClick={() => { setPhoto({ url: "", state: "loading" }); setAttempt(value => value + 1); }}>Muat ulang foto</button>}
  </section>;
}
