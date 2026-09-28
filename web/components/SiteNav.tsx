"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { href: "#triase", label: "Triase" },
  { href: "#peta", label: "Peta klaster" },
  { href: "#klaster", label: "Tabel klaster" },
  { href: "#metode", label: "Metode" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-void/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="#konten" className="flex min-h-11 items-baseline gap-2 py-2">
          <span className="num text-sm font-bold tracking-widest text-amber">E-WISE</span>
          <span className="text-sm font-medium tracking-wide">Triage</span>
        </a>

        <nav aria-label="Navigasi utama" className="hidden sm:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="flex min-h-11 items-center px-3 text-xs font-medium tracking-wide text-bone-dim transition-colors hover:text-amber"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="menu-ponsel"
          className="num min-h-11 border border-edge px-4 py-2 text-[11px] font-semibold tracking-wider transition-colors hover:border-amber hover:text-amber sm:hidden"
        >
          {open ? "TUTUP" : "MENU"}
        </button>
      </div>

      {open ? (
        <nav id="menu-ponsel" aria-label="Navigasi ponsel" className="border-t border-edge sm:hidden">
          <ul>
            {LINKS.map((l) => (
              <li key={l.href} className="border-b border-edge/60 last:border-0">
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center px-4 py-3 text-sm font-medium text-bone transition-colors hover:text-amber"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
