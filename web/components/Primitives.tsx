import { fixed4 } from "@/lib/data";

export function MarginMeter({ margin, threshold, colorClass }: { margin: number; threshold: number; colorClass: string }) {
  const scaleMax = 0.20;
  const fillW = Math.min(margin / scaleMax, 1) * 100;
  const tickL = Math.min(threshold / scaleMax, 1) * 100;

  return (
    <div>
      <div className="meter" role="img" aria-label={`Margin ${fixed4(margin)} terhadap ambang ${fixed4(threshold)}`}>
        <span className="fill" style={{ width: `${fillW}%`, backgroundColor: colorClass }}></span>
        <span className="tick" style={{ left: `calc(${tickL}% - 1px)` }} title={`Ambang ${fixed4(threshold)}`}></span>
      </div>
      <div className="ticks" aria-hidden="true" />
      <div className="meter-scale">
        <span>0</span>
        <span>ambang {fixed4(threshold)}</span>
        <span>0,20</span>
      </div>
    </div>
  );
}

export function StatusPill({ auto, text }: { auto: boolean, text: string }) {
  return (
    <span className={`status ${auto ? 'auto' : 'manual'}`}>
      {auto ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M5 12l5 5L20 7"/></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"><path d="M12 7v6"/><rect x="10" y="15" width="4" height="4" fill="currentColor" stroke="none"/><rect x="3" y="3" width="18" height="18" stroke="currentColor"/></svg>
      )}
      {text}
    </span>
  );
}

export function IconWarn() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" style={{ flex: 'none', marginTop: '2px' }}>
      <path d="M12 3l10 18H2L12 3z"/>
      <path d="M12 10v4" strokeLinecap="square"/>
      <rect x="11" y="16" width="2" height="2" fill="currentColor" stroke="none"/>
    </svg>
  );
}
