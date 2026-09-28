import { ReactNode } from "react";
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
      <div className="meter-scale mt-1">
        <span>0</span>
        <span>ambang {fixed4(threshold)}</span>
        <span>0,20</span>
      </div>
    </div>
  );
}

export function PipelineSteps({ activeStep }: { activeStep: number }) {
  const STEPS = [
    ['Input gambar', 'Foto diterima backend'],
    ['Ekstraksi fitur', 'CLIP ViT-H/14 → vektor L2'],
    ['Pemetaan cluster', 'Cosine similarity ke 14 centroid'],
    ['Validasi margin', 'Selisih skor top-1 vs top-2'],
    ['Keputusan', 'Cluster, margin, tindakan']
  ];

  return (
    <div className="steps">
      {STEPS.map((s, i) => {
        let st = '';
        if (i < activeStep) st = 'done';
        else if (i === activeStep) st = 'run';
        
        return (
          <div key={i} className={`step ${st}`}>
            <div className="bar"><i /></div>
            <span className="n">0{i + 1}</span>
            <b>{s[0]}</b>
            <small>{s[1]}</small>
          </div>
        );
      })}
    </div>
  );
}

export function StatusPill({ auto, text }: { auto: boolean, text: string }) {
  return (
    <span className={`status ${auto ? 'auto' : 'manual'}`}>
      {auto ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 7v6"/><circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9.5"/></svg>
      )}
      {text}
    </span>
  );
}

export function IconWarn() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" style={{ flex: 'none', marginTop: '1px' }}>
      <path d="M12 3 2.5 20h19z"/>
      <path d="M12 10v4.5" strokeLinecap="round"/>
      <circle cx="12" cy="17.2" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}
