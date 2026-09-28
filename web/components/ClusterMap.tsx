"use client";

import { useMemo } from "react";
import { scatter } from "@/lib/data";

const W = 720;
const H = 460;
const PAD = 28;

/**
 * Peta radar UMAP. Dua mode:
 * - scanning=true: titik berkedip berurutan disapu sonar (loading)
 * - scanning=false + highlightedId: satu klaster menyala, sisa redup (hasil)
 */
export default function ClusterMap({
  highlightedId,
  scanning = false,
}: {
  highlightedId?: number | null;
  scanning?: boolean;
}) {
  const points = useMemo(() => {
    if (scatter.length === 0) return [];
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const p of scatter) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const rx = maxX - minX || 1;
    const ry = maxY - minY || 1;

    // Normalisasi, tapi kita perlu hitung sudut untuk delay sonar.
    // Asumsikan tengah SVG adalah cx=W/2, cy=H/2
    const cx = W / 2;
    const cy = H / 2;

    return scatter.map((p) => {
      const px = PAD + ((p.x - minX) / rx) * (W - PAD * 2);
      const py = PAD + ((p.y - minY) / ry) * (H - PAD * 2);
      
      // Hitung sudut dari tengah (0 s/d 360). y dibalik karena koordinat SVG terbalik.
      let angle = Math.atan2(py - cy, px - cx) * (180 / Math.PI);
      // Offset 90deg karena conic-gradient mulai dari atas (jam 12) arah jarum jam
      angle = (angle + 90 + 360) % 360;
      
      // Waktu putaran 3 detik (3000ms), hitung persentase waktu.
      // Sinar nyapu searah jarum jam, maka delay sama dengan proporsi sudut.
      const delay = (angle / 360) * 3;

      return { ...p, px, py, angle, delay };
    });
  }, []);

  return (
    <div className="relative w-full overflow-hidden bg-void">
      {/* Background Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{ backgroundImage: "radial-gradient(#ebb303 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      />
      
      {/* Cincin Sonar Statis (hanya saat scanning) */}
      {scanning && (
        <>
          <div className="sonar-ring w-1/4 h-1/4" />
          <div className="sonar-ring w-2/4 h-2/4" />
          <div className="sonar-ring w-3/4 h-3/4" />
          <div className="sonar-ring w-full h-full" />
        </>
      )}

      {/* Sweeping Sonar Beam */}
      {scanning && (
        <div className="absolute inset-[-50%] pointer-events-none flex items-center justify-center">
          <div className="w-[150%] aspect-square sonar-sweep" />
        </div>
      )}

      {/* Titik Scatter (di atas sonar) */}
      <div className="relative z-10 w-full pb-[63.8%]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
        >
          {points.map((p, i) => {
            const active = highlightedId !== undefined && highlightedId === p.c;
            const dim = highlightedId !== undefined && highlightedId !== p.c && !scanning;
            
            return (
              <circle
                key={i}
                cx={p.px}
                cy={p.py}
                r={active ? 3.5 : 2}
                fill={active ? "var(--amber)" : "var(--bone-dim)"}
                className={scanning ? "animate-radar-dot" : "transition-opacity duration-700"}
                style={{
                  animationDelay: scanning ? `${p.delay}s` : "0s",
                  opacity: scanning ? undefined : (dim ? 0.15 : (active ? 1 : 0.4))
                }}
              />
            );
          })}

          {/* Sorotan ekstra buat titik centroid pemenang (jika ada) */}
          {highlightedId !== undefined && !scanning && (
            points.filter(p => p.c === highlightedId).map((p, i) => {
              // Gambar ring berdenyut (pulse) di sekitar klaster pemenang. 
              // Kita ambil rata-rata centroid titik-titik pemenang, tapi ini per titik.
              // Agar tidak terlalu ramai, gambar pulse cuma di titik pertama pemenang sbg jangkar
              if (i !== 0) return null;
              return (
                <circle
                  key={`pulse-${i}`}
                  cx={p.px}
                  cy={p.py}
                  r={12}
                  fill="none"
                  stroke="var(--amber)"
                  strokeWidth={1}
                  className="animate-pulse"
                />
              );
            })
          )}
        </svg>
      </div>
      
      {/* Scanline CRT overlay permanen (estetika industrial) */}
      <div 
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30" 
        style={{ background: "linear-gradient(rgba(18,16,12,0) 50%, rgba(0,0,0,0.25) 50%), linear-gradient(90deg, rgba(255,0,0,0.06), rgba(0,255,0,0.02), rgba(0,0,255,0.06))", backgroundSize: "100% 4px, 3px 100%" }}
      />
    </div>
  );
}
