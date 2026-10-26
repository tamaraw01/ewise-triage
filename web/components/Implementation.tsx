"use client";

import { useState } from "react";
import { FactoryLoop } from "./MotionPreview";

export default function Implementation({ active = true }: { active?: boolean } = {}) {
  const [paused, setPaused] = useState(false);
  return <section className="motion-preview" aria-labelledby="impl-title">
    <div className="motion-heading"><h2 id="impl-title">Alur pemilahan</h2><button className="btn" type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Lanjutkan animasi" : "Jeda animasi"}</button></div>
    <p className="motion-note">Ilustrasi alur</p>
    <section aria-labelledby="mixed-title"><h3 id="mixed-title">Simulasi E-WISE</h3><FactoryLoop single={false} paused={paused} active={active} /></section>
    <section aria-labelledby="single-title"><h3 id="single-title">Rekomendasi</h3><FactoryLoop single paused={paused} active={active} /></section>
  </section>;
}
