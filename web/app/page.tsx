"use client";

import { TriagePanel } from "@/components/TriagePanel";

export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--void)] text-[var(--iron)] font-sans antialiased p-4 sm:p-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl space-y-8">
        <header className="flex items-center justify-between border-b border-[var(--border)] pb-6">
          <h1 className="text-xl font-bold tracking-tight text-white">
            E-WISE Triase
          </h1>
          <p className="text-sm font-mono text-[var(--muted-foreground)]">
            VI-TH-14 ZERO-SHOT
          </p>
        </header>

        <TriagePanel />
        
        <footer className="pt-12 text-xs font-mono text-[var(--muted-foreground)] text-center">
          Sistem inferensi e-waste otomatis. Mengelompokkan citra tanpa pengawasan.
        </footer>
      </div>
    </main>
  );
}
