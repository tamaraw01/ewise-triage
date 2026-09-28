"use client";

import { useCallback, useRef, useState } from "react";
import { API_BASE, ROUTES, fixed4 } from "@/lib/data";
import { MarginGauge, RouteTag } from "./Primitives";

type Prediction = {
  status: "classified" | "review";
  margin: number;
  threshold: number;
  top_similarity: number;
  cluster: {
    id: number;
    label: string | null;
    route: string;
    handling: string;
    n_images: number;
    purity: number;
    contested: boolean;
  };
  runner_up: { id: number; label: string };
  ranking: { cluster: number; label: string; similarity: number }[];
  zero_shot: { label: string; similarity: number }[];
  disclaimer: string;
  filename?: string;
};

type Phase = "idle" | "loading" | "done" | "error";

const MAX_BYTES = 12 * 1024 * 1024;

export default function TriagePanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(async (file: File) => {
    if (!API_BASE) {
      setPhase("error");
      setError(
        "Alamat backend belum dikonfigurasi. Setel NEXT_PUBLIC_API_BASE ke URL Space inference, lalu muat ulang.",
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      setPhase("error");
      setError("Berkas melebihi 12 MB. Gunakan citra yang lebih kecil.");
      return;
    }

    setName(file.name);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPhase("loading");
    setError("");
    setResult(null);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_BASE}/predict`, { method: "POST", body });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? detail?.error ?? `Server menolak (HTTP ${res.status})`);
      }
      setResult((await res.json()) as Prediction);
      setPhase("done");
    } catch (err) {
      setPhase("error");
      setError(
        err instanceof Error
          ? `${err.message}. Space inference mungkin sedang bangun dari kondisi tidur, coba lagi dalam satu menit.`
          : "Permintaan gagal.",
      );
    }
  }, []);

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setError("");
    setName("");
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="border border-edge bg-iron p-5">
        <h3 className="text-sm font-semibold tracking-wide">Masukan citra</h3>
        <p className="mt-2 text-xs leading-relaxed text-bone-dim">
          Satu foto barang elektronik. Berkas JPG, PNG, atau WebP hingga 12 MB.
        </p>

        <label
          htmlFor="berkas-citra"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void submit(f);
          }}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed bg-void px-4 py-8 text-center transition-colors ${
            dragging ? "border-amber" : "border-edge hover:border-amber"
          }`}
        >
          <span className="num text-xs tracking-wider text-amber">PILIH BERKAS</span>
          <span className="text-xs text-bone-dim">atau jatuhkan berkas ke area ini</span>
        </label>
        <input
          ref={inputRef}
          id="berkas-citra"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/bmp,image/gif"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void submit(f);
          }}
        />

        {preview ? (
          <figure className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={`Pratinjau citra ${name}`}
              className="max-h-56 w-full border border-edge object-contain"
            />
            <figcaption className="num mt-2 truncate text-[11px] text-bone-dim">{name}</figcaption>
          </figure>
        ) : null}

        {phase !== "idle" ? (
          <button
            type="button"
            onClick={reset}
            className="mt-4 min-h-11 w-full border border-edge px-4 py-2.5 text-xs font-semibold tracking-wide transition-colors hover:border-amber hover:text-amber"
          >
            Kosongkan dan mulai lagi
          </button>
        ) : null}
      </div>

      <div className="border border-edge bg-iron p-5" aria-live="polite" aria-busy={phase === "loading"}>
        {phase === "idle" ? <IdleState /> : null}
        {phase === "loading" ? <LoadingState /> : null}
        {phase === "error" ? <ErrorState message={error} onRetry={() => inputRef.current?.click()} /> : null}
        {phase === "done" && result ? <ResultState data={result} /> : null}
      </div>
    </div>
  );
}

function IdleState() {
  return (
    <div className="flex h-full min-h-64 flex-col justify-center">
      <h3 className="text-sm font-semibold tracking-wide">Belum ada citra</h3>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-bone-dim">
        Putusan jalur penanganan akan muncul di sini setelah satu citra diproses. Panel menampilkan
        klaster terdekat, skor kosinus, margin terhadap ambang, dan pembanding zero-shot.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full min-h-64 flex-col justify-center">
      <h3 className="text-sm font-semibold tracking-wide text-amber">Menghitung</h3>
      <p className="mt-2 text-xs leading-relaxed text-bone-dim">
        Citra diubah ke vektor CLIP ViT-H/14, lalu dibandingkan ke 14 centroid klaster.
      </p>
      <div className="mt-4 h-1 w-full overflow-hidden bg-void">
        <div className="h-full w-1/3 animate-pulse bg-amber" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full min-h-64 flex-col justify-center">
      <h3 className="text-sm font-semibold tracking-wide text-amber">Permintaan gagal</h3>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-bone-dim">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-11 self-start border border-amber px-4 py-2.5 text-xs font-semibold tracking-wide text-amber"
      >
        Pilih berkas lain
      </button>
    </div>
  );
}

function ResultState({ data }: { data: Prediction }) {
  const route = ROUTES[data.cluster.route] ?? ROUTES.MANUAL_REVIEW;
  const accepted = data.status === "classified";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="num text-[11px] tracking-widest text-bone-dim">
            KLASTER C{data.cluster.id}
          </p>
          <h3 className="mt-1 text-2xl font-semibold leading-tight">
            {accepted ? data.cluster.label : "Tidak diputuskan"}
          </h3>
        </div>
        <RouteTag code={data.cluster.route} accent={route.accent} />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-bone-dim">{data.cluster.handling}</p>

      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-semibold tracking-wide">Margin keyakinan</span>
          <span className="num text-lg font-semibold text-amber">{fixed4(data.margin)}</span>
        </div>
        <MarginGauge value={data.margin} threshold={data.threshold} />
      </div>

      {data.cluster.contested ? (
        <p className="mt-4 border-l-2 border-amber bg-void px-3 py-2 text-xs leading-relaxed">
          Klaster ini tercatat terbantah pada data acuan: kemurniannya{" "}
          <span className="num">{(data.cluster.purity * 100).toFixed(1)}%</span>, artinya label
          zero-shot tidak mewakili mayoritas isi klaster. Perlakukan hasil ini sebagai petunjuk, bukan putusan.
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold tracking-wide">Klaster terdekat</h4>
          <ul className="mt-2 space-y-1.5">
            {data.ranking.map((r, i) => (
              <li key={r.cluster} className="flex items-baseline justify-between gap-3 text-xs">
                <span className={i === 0 ? "text-bone" : "text-bone-dim"}>
                  <span className="num">C{r.cluster}</span> {r.label}
                </span>
                <span className="num text-bone-dim">{fixed4(r.similarity)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold tracking-wide">Pembanding zero-shot</h4>
          <ul className="mt-2 space-y-1.5">
            {data.zero_shot.map((z, i) => (
              <li key={z.label} className="flex items-baseline justify-between gap-3 text-xs">
                <span className={i === 0 ? "text-bone" : "text-bone-dim"}>{z.label}</span>
                <span className="num text-bone-dim">{fixed4(z.similarity)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-6 border-t border-edge pt-3 text-[11px] leading-relaxed text-bone-dim">
        {data.disclaimer}
      </p>
    </div>
  );
}
