"use client";

import { useState } from "react";
import { FactoryLoop } from "./MotionPreview";

export default function Implementation() {
  const [paused, setPaused] = useState(false);
  return <section className="motion-preview" aria-labelledby="impl-title">
    <div className="motion-heading"><h2 id="impl-title">Alur pemilahan</h2><button className="btn" type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Lanjutkan animasi" : "Jeda animasi"}</button></div>
    <p className="motion-note">Ilustrasi integrasi, bukan inferensi langsung.</p>
    <section aria-labelledby="mixed-title"><h3 id="mixed-title">01 · Muatan campuran</h3><FactoryLoop single={false} paused={paused} /></section>
    <section aria-labelledby="single-title"><h3 id="single-title">02 · Target C3: PCB</h3><FactoryLoop single paused={paused} /></section>
  </section>;
}
