"use client";

import { useMemo, useState } from "react";
import { clusters, scatter, type Cluster } from "@/lib/data";
import { TickRule } from "./Primitives";

const W = 720;
const H = 460;
const PAD = 28;

export default function ClusterMap() {
  const [active, setActive] = useState<number | null>(null);

  const { pts, bounds } = useMemo(() => {
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
    return { pts: scatter.map((p) => ({ ...p, px: sx(p.x), py: sy(p.y) })), bounds: b };
  }, []);

  const centers = useMemo(() => {
    const acc = new Map<number, { x: number; y: number; n: number }>();
    for (const p of pts) {
      const c = acc.get(p.c) ?? { x: 0, y: 0, n: 0 };
      c.x += p.px;
      c.y += p.py;
      c.n += 1;
      acc.set(p.c, c);
    }
    return [...acc.entries()].map(([id, v]) => ({ id, x: v.x / v.n, y: v.y / v.n }));
  }, [pts]);

  const selected: Cluster | undefined = clusters.find((c) => c.id === active);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
      <div className="border border-edge bg-iron p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Sebaran ${pts.length} citra pada proyeksi UMAP dua dimensi, diwarnai menurut 14 klaster`}
        >
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#3a342a" strokeWidth="1" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#3a342a" strokeWidth="1" />
          {Array.from({ length: 25 }, (_, i) => {
            const x = PAD + (i / 24) * (W - PAD * 2);
            const len = i % 5 === 0 ? 7 : 3;
            return (
              <line
                key={`tx${i}`}
                x1={x}
                y1={H - PAD}
                x2={x}
                y2={H - PAD + len}
                stroke="#3a342a"
                strokeWidth="1"
              />
            );
          })}

          {pts.map((p, i) => {
            const dim = active !== null && p.c !== active;
            return (
              <circle
                key={i}
                cx={p.px}
                cy={p.py}
                r={active === p.c ? 3 : 2.1}
                fill={active === p.c ? "#f0a030" : "#a8a196"}
                opacity={dim ? 0.12 : active === p.c ? 0.95 : 0.5}
              />
            );
          })}

          {centers.map((c) => (
            <text
              key={c.id}
              x={c.x}
              y={c.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="11"
              fontWeight="600"
              fill={active === c.id ? "#100e0b" : "#e8e3d9"}
              stroke={active === c.id ? "#f0a030" : "#100e0b"}
              strokeWidth="3.5"
              paintOrder="stroke"
              style={{ fontFamily: "var(--font-plex-mono), monospace" }}
            >
              C{c.id}
            </text>
          ))}
        </svg>
        <div className="mt-3 flex items-center justify-between">
          <TickRule count={18} className="opacity-60" />
          <p className="num text-[11px] text-bone-dim">
            {pts.length} dari {scatter.length} titik, UMAP 2D
          </p>
        </div>
      </div>

      <div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide">Sorot klaster</legend>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-pressed={active === null}
              className={`num border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                active === null ? "border-amber bg-amber text-void" : "border-edge hover:border-amber"
              }`}
            >
              SEMUA
            </button>
            {clusters.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(active === c.id ? null : c.id)}
                aria-pressed={active === c.id}
                className={`num border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  active === c.id ? "border-amber bg-amber text-void" : "border-edge hover:border-amber"
                }`}
              >
                C{c.id}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 border border-edge bg-iron p-4" aria-live="polite">
          {selected ? (
            <>
              <p className="num text-[11px] tracking-widest text-bone-dim">C{selected.id}</p>
              <h3 className="mt-1 text-lg font-semibold leading-tight">{selected.label}</h3>
              <dl className="mt-3 space-y-1.5 text-xs">
                <Row k="Citra" v={String(selected.n_images)} />
                <Row k="Skor teratas" v={selected.sim_top1.toFixed(4)} />
                <Row k="Margin" v={selected.margin.toFixed(4)} />
                <Row k="Kemurnian" v={`${(selected.purity * 100).toFixed(1)}%`} />
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-bone-dim">
                Isi sebenarnya:{" "}
                {Object.entries(selected.truth_mix)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(", ")}
              </p>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-bone-dim">
              Pilih satu kode klaster untuk menyorot sebarannya dan membaca komposisi isinya.
            </p>
          )}
        </div>

        <p className="num mt-3 text-[11px] leading-relaxed text-bone-dim">
          Rentang sumbu: x {bounds.x0.toFixed(1)} sampai {bounds.x1.toFixed(1)}, y{" "}
          {bounds.y0.toFixed(1)} sampai {bounds.y1.toFixed(1)}
        </p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-bone-dim">{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
}
