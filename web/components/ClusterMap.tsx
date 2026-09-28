"use client";

import { useMemo } from "react";
import { scatter } from "@/lib/data";

const W = 720;
const H = 460;
const PAD = 28;

/**
 * Peta radar UMAP. Dua mode:
 * - scanning=true: titik berkedip acak, simulasi pencarian centroid
 * - highlightedId=number: sorot satu klaster (hasil inference)
 * - tanpa keduanya: semua titik redup, menunggu input
 */
export default function ClusterMap({
  highlightedId,
  scanning = false,
}: {
  highlightedId?: number | null;
  scanning?: boolean;
}) {
  const { pts, centers } = useMemo(() => {
    const xs = scatter.map((p) => p.x);
    const ys = scatter.map((p) => p.y);
    const b = {
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
    };
    const sx = (v: number) => PAD + ((v - b.x0) / (b.x1 - b.x0)) * (W - PAD * 2);
    const sy = (v: number) => H - PAD - ((v - b.y0) / (b.y1 - b.y0)) * (H - PAD * 2);
    const mapped = scatter.map((p) => ({ ...p, px: sx(p.x), py: sy(p.y) }));

    const acc = new Map<number, { x: number; y: number; n: number }>();
    for (const p of mapped) {
      const c = acc.get(p.c) ?? { x: 0, y: 0, n: 0 };
      c.x += p.px;
      c.y += p.py;
      c.n += 1;
      acc.set(p.c, c);
    }
    const cArr = [...acc.entries()].map(([id, v]) => ({
      id,
      x: v.x / v.n,
      y: v.y / v.n,
    }));

    return { pts: mapped, centers: cArr };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[280px]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        role="img"
        aria-label="Peta radar klaster UMAP"
      >
        {/* Grid axis */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#3a342a" strokeWidth="1" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#3a342a" strokeWidth="1" />
        {Array.from({ length: 25 }, (_, i) => {
          const x = PAD + (i / 24) * (W - PAD * 2);
          return (
            <line
              key={`tx${i}`}
              x1={x}
              y1={H - PAD}
              x2={x}
              y2={H - PAD + (i % 5 === 0 ? 7 : 3)}
              stroke="#3a342a"
              strokeWidth="1"
            />
          );
        })}

        {/* Data points */}
        {pts.map((p, i) => {
          const hit = highlightedId !== null && highlightedId !== undefined && highlightedId === p.c;
          const dim = highlightedId !== null && highlightedId !== undefined && !hit;
          return (
            <circle
              key={i}
              cx={p.px}
              cy={p.py}
              r={hit ? 3.5 : 2}
              fill={hit ? "#f0a030" : "#a8a196"}
              opacity={dim ? 0.1 : hit ? 1 : 0.35}
              className={scanning ? "animate-radar-dot" : ""}
              style={scanning ? { animationDelay: `${(i * 37) % 2000}ms` } : undefined}
            />
          );
        })}

        {/* Centroid labels */}
        {centers.map((c) => {
          const hit = highlightedId === c.id;
          return (
            <text
              key={c.id}
              x={c.x}
              y={c.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="11"
              fontWeight="600"
              fill={hit ? "#100e0b" : "#e8e3d9"}
              stroke={hit ? "#f0a030" : "#100e0b"}
              strokeWidth="3.5"
              paintOrder="stroke"
              className={hit ? "animate-pulse" : ""}
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              C{c.id}
            </text>
          );
        })}

        {/* Scanning sweep line */}
        {scanning && (
          <line
            x1={PAD}
            y1={PAD}
            x2={W - PAD}
            y2={H - PAD}
            stroke="#f0a030"
            strokeWidth="1"
            opacity="0.3"
            className="animate-sweep"
          />
        )}
      </svg>
    </div>
  );
}
