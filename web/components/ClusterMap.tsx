"use client";

import { useMemo } from "react";
import { scatter } from "@/lib/data";

const W = 720, H = 460, PAD = 44;

export default function ClusterMap({ highlightedId, scanning = false, onSelect }: {
  highlightedId?: number | null;
  scanning?: boolean;
  onSelect?: (id: number) => void;
}) {
  const { points, anchors } = useMemo(() => {
    const xs = scatter.map(p => p.x), ys = scatter.map(p => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const rx = Math.max(...xs) - minX || 1, ry = Math.max(...ys) - minY || 1;
    const points = scatter.map(p => {
      const px = PAD + ((p.x - minX) / rx) * (W - PAD * 2);
      const py = PAD + ((p.y - minY) / ry) * (H - PAD * 2);
      return { ...p, px, py, delay: ((Math.atan2(py - H / 2, px - W / 2) * 180 / Math.PI + 450) % 360) / 120 };
    });
    // Anchors label sample means in this projection, never inference centroids.
    const anchors = [...new Set(points.map(p => p.c))].map(id => {
      const group = points.filter(p => p.c === id);
      const x = group.reduce((s, p) => s + p.px, 0) / group.length, top = Math.min(...group.map(p => p.py)), bottom = Math.max(...group.map(p => p.py));
      return { id, x: Math.min(Math.max(x, 28), W - 28), y: top > 52 ? top - 24 : bottom + 24 };
    });
    return { points, anchors };
  }, []);

  return <div className="cluster-map">
    {scanning && <><div className="sonar-ring w-1/4 h-1/4" /><div className="sonar-ring w-2/4 h-2/4" /><div className="sonar-ring w-3/4 h-3/4" /><div className="absolute inset-[-50%] pointer-events-none flex items-center justify-center"><div className="w-[150%] aspect-square sonar-sweep" /></div></>}
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={scanning ? "Analisis berlangsung: sebaran klaster riset" : `Sebaran klaster riset, C${highlightedId} disorot. Pilihan tersedia di bawah peta.`}>
      {[...points].sort((a, b) => Number(a.c === highlightedId) - Number(b.c === highlightedId)).map((p, i) => <circle key={i} cx={p.px} cy={p.py} r={highlightedId === p.c ? 6 : 2.4} className={scanning ? "animate-radar-dot" : undefined} style={{ fill: highlightedId === p.c ? "var(--green)" : "var(--bone-dim)", stroke: highlightedId === p.c ? "var(--void)" : undefined, strokeWidth: highlightedId === p.c ? 1.4 : undefined, animationDelay: `${p.delay}s`, opacity: scanning ? undefined : highlightedId === p.c ? 1 : .2 }} />)}
      {!scanning && anchors.filter(a => a.id === highlightedId).map(a => <g key={a.id} className={`map-label${a.id === highlightedId ? " selected" : ""}`} transform={`translate(${a.x}, ${a.y})`} onClick={() => onSelect?.(a.id)} aria-hidden="true">
        <rect x="-23" y="-15" width="46" height="30" rx="2" /><text textAnchor="middle" dy="5">C{a.id}</text>
      </g>)}
    </svg>
  </div>;
}
