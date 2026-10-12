"use client";

import { useMemo } from "react";
import { scatter } from "@/lib/data";

const W = 720, H = 460, PAD = 44;

export default function ClusterMap({ highlightedId, scanning = false, onSelect }: {
  highlightedId?: number | null;
  scanning?: boolean;
  onSelect?: (id: number) => void;
}) {
  const points = useMemo(() => {
    const xs = scatter.map(p => p.x), ys = scatter.map(p => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const rx = Math.max(...xs) - minX || 1, ry = Math.max(...ys) - minY || 1;
    const points = scatter.map(p => {
      const px = PAD + ((p.x - minX) / rx) * (W - PAD * 2);
      const py = PAD + ((p.y - minY) / ry) * (H - PAD * 2);
      return { ...p, px, py, delay: ((Math.atan2(py - H / 2, px - W / 2) * 180 / Math.PI + 450) % 360) / 120 };
    });
    return points;
  }, []);

  return <>
    {!scanning && <span className="field-label num" aria-hidden="true">C{highlightedId}</span>}
    <div className="cluster-map">
    {scanning && <><div className="sonar-ring w-1/4 h-1/4" /><div className="sonar-ring w-2/4 h-2/4" /><div className="sonar-ring w-3/4 h-3/4" /><div className="absolute inset-[-50%] pointer-events-none flex items-center justify-center"><div className="w-[150%] aspect-square sonar-sweep" /></div></>}
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={scanning ? "Analisis berlangsung: sebaran klaster riset" : `Sebaran klaster riset, C${highlightedId} disorot. Pilihan tersedia di bawah peta.`}>
      {[...points].sort((a, b) => Number(a.c === highlightedId) - Number(b.c === highlightedId)).map((p, i) => <circle key={i} data-cluster={p.c} onClick={onSelect && !scanning ? () => onSelect(p.c) : undefined} cx={p.px} cy={p.py} r={highlightedId === p.c ? 6 : 2.4} className={scanning ? "animate-radar-dot" : undefined} style={{ fill: highlightedId === p.c ? "var(--green)" : "var(--bone-dim)", stroke: highlightedId === p.c ? "var(--void)" : undefined, strokeWidth: highlightedId === p.c ? 1.4 : undefined, animationDelay: `${p.delay}s`, opacity: scanning ? undefined : highlightedId === p.c ? 1 : .2 }} />)}
    </svg>
  </div></>;
}
