"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, fixed4, CLUSTERS_META, LANES } from "@/lib/data";
import { MarginMeter, StatusPill, IconWarn } from "./Primitives";
import CameraCapture from "./CameraCapture";
import ClusterMap from "./ClusterMap";

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

export function TriagePanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<"berkas" | "kamera">("berkas");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!API_BASE) return;
    const ping = () => fetch(`${API_BASE}/health`).catch(() => {});
    ping();
    const id = setInterval(ping, 240_000);
    return () => clearInterval(id);
  }, []);

  const submit = useCallback(async (file: File) => {
    if (file.size > MAX_BYTES) {
      setPhase("error");
      setError("Berkas melebihi 12 MB.");
      return;
    }

    setName(file.name);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });

    if (!API_BASE) {
      setPhase("error");
      setError("Backend belum terhubung.");
      return;
    }

    setPhase("loading");
    setError("");
    setResult(null);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_BASE}/predict`, { method: "POST", body });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? detail?.error ?? `HTTP ${res.status}`);
      }
      setResult((await res.json()) as Prediction);
      setPhase("done");
    } catch (err) {
      setPhase("error");
      setError(
        err instanceof Error
          ? `${err.message}. Coba lagi dalam satu menit.`
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
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border border-edge bg-iron p-5 flex flex-col">
          <div className="flex border border-edge" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "berkas"}
              onClick={() => setMode("berkas")}
              className={`num min-h-11 flex-1 px-3 py-2 text-[11px] font-semibold tracking-wider transition-colors ${
                mode === "berkas" ? "bg-amber text-void" : "text-bone-dim hover:text-amber"
              }`}
            >
              BERKAS
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "kamera"}
              onClick={() => setMode("kamera")}
              className={`num min-h-11 flex-1 border-l border-edge px-3 py-2 text-[11px] font-semibold tracking-wider transition-colors ${
                mode === "kamera" ? "bg-amber text-void" : "text-bone-dim hover:text-amber"
              }`}
            >
              KAMERA
            </button>
          </div>

          <div className="mt-4 flex-1" hidden={mode !== "berkas"}>
            <label
              htmlFor="berkas-citra"
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void submit(f);
              }}
              className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed bg-void p-6 text-center transition-colors ${
                dragging ? "border-amber" : "border-edge hover:border-amber"
              }`}
            >
              <span className="num text-xs tracking-wider text-amber">PILIH BERKAS</span>
              <span className="text-xs text-bone-dim">atau jatuhkan di sini</span>
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
          </div>

          <div className="mt-4 flex-1" hidden={mode !== "kamera"}>
            <CameraCapture onCapture={(f) => void submit(f)} disabled={phase === "loading"} />
          </div>
        </div>

        <div className="border border-edge bg-iron p-5 flex flex-col items-center justify-center">
          {preview ? (
            <figure className="w-full flex flex-col items-center gap-3">
              <img
                src={preview}
                alt="Pratinjau"
                className="max-h-64 w-full object-contain border border-edge bg-void"
              />
              <figcaption className="num text-[11px] text-bone-dim truncate max-w-full">{name}</figcaption>
              {phase === "loading" && (
                <p className="text-xs text-amber animate-pulse font-mono">Mengekstrak fitur visual...</p>
              )}
            </figure>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-bone-dim">Belum ada citra</p>
              <p className="mt-1 text-xs text-bone-dim/60">Unggah atau jepret untuk memulai analisis</p>
            </div>
          )}
        </div>
      </div>

      {(phase === "loading" || phase === "done") && (
        <div className="border border-edge bg-iron p-5">
          <div className="flex justify-between items-baseline mb-3">
            <h3 className={`text-sm font-semibold tracking-wide ${phase === "loading" ? "text-amber" : "text-bone"}`}>
              {phase === "loading" ? "Mencari centroid terdekat..." : `Klaster C${result?.cluster.id} ditemukan`}
            </h3>
            <span className="text-[10px] font-mono text-bone-dim">UMAP 2D RADAR</span>
          </div>
          <div className="relative">
            <ClusterMap
              highlightedId={phase === "done" && result ? result.cluster.id : undefined}
              scanning={phase === "loading"}
            />
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <ResultCard data={result} onReset={reset} />
      )}

      {phase === "error" && (
        <div className="border border-edge bg-iron p-5">
          <h3 className="text-sm font-semibold tracking-wide text-amber">Gagal</h3>
          <p className="mt-2 text-xs leading-relaxed text-bone-dim">{error}</p>
          <button
            type="button"
            onClick={() => { setPhase("idle"); setError(""); }}
            className="mt-4 min-h-11 border border-amber px-6 py-2 text-xs font-semibold tracking-wide text-amber hover:bg-amber hover:text-void transition-colors"
          >
            Coba lagi
          </button>
        </div>
      )}
    </div>
  );
}

function ResultCard({ data, onReset }: { data: Prediction; onReset: () => void }) {
  const auto = data.status === "classified";
  const cMeta = CLUSTERS_META[data.cluster.id];
  const laneKey = auto ? cMeta.lane : 'MR';
  const lane = LANES[laneKey];
  
  const reason = !auto 
    ? `Selisih skor ke klaster kedua (C${data.runner_up.id} · ${data.runner_up.label}) terlalu kecil. Objek ambigu atau jenis langka, jadi petugas yang memeriksa.` 
    : '';

  const fillColorClass = auto ? 'var(--ok)' : 'var(--warn)';
  const fillWord = auto ? 'Tinggi' : 'Rendah';

  return (
    <div className="res-main mt-2">
      <StatusPill auto={auto} text={auto ? "Diterima otomatis" : "Peninjauan manual"} />
      
      <div className="res-title mt-2">
        <span className="num min-h-6 inline-flex items-center border border-edge rounded px-2 text-bone-dim">C{data.cluster.id}</span>
        <h3 className="text-3xl font-bold leading-tight">{auto ? cMeta.name : "Belum dapat dipastikan"}</h3>
      </div>
      <p className="res-sub">
        {auto ? cMeta.sub : `Kandidat terdekat: C${cMeta.id} · ${cMeta.sub} (label zero-shot: ${data.cluster.label})`}
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mt-2">
        <div className="box">
          <span className="label">Confidence margin</span>
          <div className="big-num text-2xl font-mono mt-1">
            {fixed4(data.margin)}
            <small className="ml-2 font-sans text-sm font-semibold" style={{ color: fillColorClass }}>{fillWord}</small>
          </div>
          <MarginMeter margin={data.margin} threshold={data.threshold} colorClass={fillColorClass} />
        </div>
        
        <div className="box">
          <span className="label">Tindakan</span>
          <span className="lane"><i style={{ backgroundColor: lane.color }}></i>{lane.code} · {lane.desc}</span>
          <p className="text-sm mt-1 mb-2">{auto ? cMeta.action : reason}</p>
          
          {auto && cMeta.hazard && (
            <div className="flex gap-2 items-start bg-[var(--amber-dim)] border border-[var(--amber)] text-amber p-2 text-xs font-semibold">
              <IconWarn />
              <span>{cMeta.hazard}</span>
            </div>
          )}
          
          {auto && (
            <p className="text-xs text-bone-dim mt-auto">
              <b className="text-bone">Material utama:</b> {cMeta.material}
            </p>
          )}
        </div>
      </div>

      <div className="box mt-2">
        <span className="label mb-2">Zero-shot Similarity · 3 Teratas</span>
        <div className="flex flex-col gap-1">
          {data.zero_shot.slice(0, 3).map((z, i) => (
            <div key={z.label} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
              <span className={`truncate ${i === 0 ? "text-bone font-medium" : "text-bone-dim"}`}>{z.label}</span>
              <span className="h-2 bg-edge rounded-full overflow-hidden">
                <i className="block h-full bg-bone-dim rounded-full" style={{ width: `${Math.max(0, (z.similarity / data.zero_shot[0].similarity) * 100)}%` }} />
              </span>
              <span className="num text-bone-dim text-right w-12">{fixed4(z.similarity)}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-2 min-h-11 w-full border border-edge bg-void px-4 py-2.5 text-xs font-semibold tracking-wide transition-colors hover:border-amber hover:text-amber"
      >
        Analisis Citra Baru
      </button>
    </div>
  );
}
