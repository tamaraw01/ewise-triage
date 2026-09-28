/** Motif identitas: takik skala ukur (DESIGN.md).
 *  Hanya dipakai di kepala bagian, batang margin, dan sumbu peta. */
export function TickRule({ count = 40, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`tick-rule ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

export function SectionHead({
  index,
  title,
  lead,
}: {
  index: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-end gap-4">
        <span className="num text-xs font-semibold tracking-widest text-amber">{index}</span>
        <TickRule count={24} className="flex-1 opacity-70" />
      </div>
      <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">{title}</h2>
      {lead ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone-dim">{lead}</p> : null}
    </div>
  );
}

/** Batang pengukur: skala fisik untuk nilai margin terhadap ambang. */
export function MarginGauge({
  value,
  threshold,
  max = 0.2,
}: {
  value: number;
  threshold: number;
  max?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const tpct = Math.min(100, Math.max(0, (threshold / max) * 100));
  const pass = value >= threshold;

  return (
    <div>
      <div
        className="relative h-7 border border-edge bg-void"
        role="img"
        aria-label={`Margin ${value.toFixed(4)}, ambang ${threshold.toFixed(4)}, ${
          pass ? "di atas ambang" : "di bawah ambang"
        }`}
      >
        <div
          className={`h-full ${pass ? "bg-amber" : "bg-edge"}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-bone"
          style={{ left: `${tpct}%` }}
          title="Ambang tinjauan"
        />
        <div className="absolute inset-y-0 left-0 flex w-full items-end justify-between px-px">
          {Array.from({ length: 21 }, (_, i) => (
            <span
              key={i}
              className="block w-px bg-bone-dim/25"
              style={{ height: i % 5 === 0 ? "9px" : "4px" }}
            />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between">
        <span className="num text-[11px] text-bone-dim">0</span>
        <span className="num text-[11px] text-bone-dim">
          ambang {threshold.toFixed(4)}
        </span>
        <span className="num text-[11px] text-bone-dim">{max.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function RouteTag({ code, accent }: { code: string; accent: boolean }) {
  return (
    <span
      className={`num inline-block border px-2 py-1 text-[11px] font-semibold tracking-wider ${
        accent ? "border-amber bg-amber text-void" : "border-edge text-bone"
      }`}
    >
      {code}
    </span>
  );
}
