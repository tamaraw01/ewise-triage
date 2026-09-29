"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fixed4, CLUSTERS_META, LANES } from "@/lib/data";
import { resolveApiBase, backendSiap } from "@/lib/api";
import { MarginMeter, StatusPill, IconWarn } from "./Primitives";
import ClusterMap from "./ClusterMap";

type ZeroShot = { label: string; similarity: number };

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
  runner_up: { id: number; label: string | null };
  ranking: { cluster: number; label: string | null; similarity: number }[];
  zero_shot: ZeroShot[];
  disclaimer: string;
};

export default function TriagePanel() {
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState("");
  
  // Fake progress
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const reset = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setError("");
    setProgress(0);
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl("");
    setFile(null);
    stopCamera();
  }, [previewUrl]);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    
    reset();
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  // Handle camera start
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      setCameraActive(true);
      
      // Tunggu React selesai me-render tag <video> (di dalam timeout 0 atau langsung mengikat ref sesudahnya)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      alert("Kamera tidak dapat diakses. Gunakan upload berkas.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Jepret frame dari video feed, jadikan File, biarkan auto-submit yang jalan
  const capturePhoto = () => {
    if (!videoRef.current || !cameraActive) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const shot = new File([blob], "capture.jpg", { type: "image/jpeg" });
      setPhase("idle");
      setResult(null);
      setError("");
      setProgress(0);
      setFile(shot);
      setPreviewUrl(URL.createObjectURL(shot));
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const submitAnalysis = useCallback(async () => {
    if (!file) return;

    setPhase("loading");
    setResult(null);
    setError("");
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    const intv = setInterval(() => {
      setProgress(p => Math.min(p + (Math.random() * 15), 90));
    }, 400);

    try {
      // Alamat dicari saat dijalankan: tunnel berotasi, jadi nilai yang
      // ditanam saat build bisa sudah mati di bundel yang sedang dipegang.
      let base = await resolveApiBase();
      if (!base) throw new Error("Alamat backend tidak ditemukan");

      const kirim = (b: string) =>
        fetch(`${b}/predict`, { method: "POST", body: formData });

      let res: Response;
      try {
        res = await kirim(base);
      } catch {
        // Kegagalan jaringan biasanya berarti tunnel baru saja berotasi.
        // Cari ulang alamatnya sekali, lalu kirim lagi.
        base = await resolveApiBase();
        res = await kirim(base);
      }
      
      clearInterval(intv);
      setProgress(100);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }

      const data = await res.json();
      setTimeout(() => {
        setResult(data);
        setPhase("done");
      }, 500);

    } catch (err: any) {
      clearInterval(intv);
      setError(err.message || "Gagal menghubungi backend");
      setPhase("error");
    }
  }, [file]);

  // Auto-submit saat file terisi dari DragDrop / Browse / Capture Kamera
  useEffect(() => {
    if (file && phase === "idle") {
      submitAnalysis();
    }
  }, [file, phase, submitAnalysis]);

  // File drop
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type.startsWith("image/")) {
      reset();
      setFile(dropped);
      setPreviewUrl(URL.createObjectURL(dropped));
    }
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  // Cari alamat backend sejak halaman dibuka, lalu jaga tetap panas.
  // Memanaskan lebih dulu berarti unggahan pertama tidak menanggung
  // biaya pemuatan model.
  useEffect(() => {
    let hidup = true;

    const denyut = async () => {
      const base = await resolveApiBase();
      if (!hidup || !base) return;
      await backendSiap(base);
    };

    denyut();
    const iv = setInterval(denyut, 4 * 60 * 1000);
    return () => {
      hidup = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      
      {/* Kolom Console Kiri: Input */}
      <div className="panel" onDrop={onDrop} onDragOver={onDragOver}>
        <div className="panel-h">
          <h2 className="text-sm font-semibold tracking-wide text-bone">CONSOLE</h2>
          <span className="text-[10px] font-mono text-bone-dim">INPUT C-2</span>
        </div>
        
        <div className="panel-b mt-4">
          
          {/* Kamera View (Opsional) */}
          {cameraActive && (
            <div className="relative border border-edge bg-void overflow-hidden flex flex-col">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-auto bg-void"
                style={{ maxHeight: "300px", objectFit: "cover" }}
              />
              <div className="absolute inset-x-0 bottom-0 p-3 bg-void/80 flex justify-center gap-4">
                <button 
                  onClick={capturePhoto}
                  className="h-10 px-6 border border-amber bg-amber/20 text-amber font-semibold text-xs tracking-wide"
                >
                  Jepret
                </button>
                <button 
                  onClick={stopCamera}
                  className="h-10 px-6 border border-edge bg-iron text-bone font-semibold text-xs tracking-wide"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Form Upload & Citra Terpilih */}
          {!cameraActive && (
            <div className="flex gap-4">
              <div className="flex-1 relative border border-dashed border-edge p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-amber transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <p className="text-sm font-semibold text-bone">Pilih atau seret foto kemari</p>
                <p className="mt-1 text-xs text-bone-dim">Format JPG, PNG (Max 5MB)</p>
              </div>
              <button 
                onClick={startCamera}
                className="w-16 flex-none border border-edge bg-iron hover:bg-iron-hi flex items-center justify-center"
                title="Buka Kamera"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="text-bone-dim"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
            </div>
          )}

          {/* Preview Foto Mini di bawah input */}
          {file && !cameraActive && (
            <div className="mt-4 flex gap-4 items-center border border-edge p-2 bg-void">
              <img src={previewUrl} alt="Preview" className="h-16 w-16 object-cover border border-edge" />
              <div className="flex-1 min-w-0">
                <div className="truncate text-xs font-mono text-bone">{file.name}</div>
                <div className="text-[10px] text-bone-dim mt-1">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Area Loading (HANYA MUNCUL SAAT LOADING) */}
      {phase === "loading" && (
        <div className="panel border-amber/30">
          <div className="panel-h">
            <h3 className="text-sm font-semibold tracking-wide text-amber">
              Mencari centroid terdekat...
            </h3>
            <span className="text-[10px] font-mono text-amber">UMAP 2D RADAR</span>
          </div>
          <div className="relative mt-4">
            <ClusterMap scanning={true} />
            <div className="absolute inset-x-0 bottom-4 text-center text-amber text-xs font-mono animate-pulse">
              {progress < 40 ? "Mengekstrak ViT-H/14 embeddings..." : 
               progress < 80 ? "Mencari centroid terdekat di UMAP..." : 
               "Menyimpulkan zero-shot semantic margin..."}
            </div>
          </div>
        </div>
      )}

      {/* Area Hasil (MUNCUL SAAT SELESAI, MENGGANTIKAN RADAR) */}
      {phase === "done" && result && (
        <ResultCard data={result} onReset={reset} />
      )}

      {phase === "error" && (
        <div className="panel border-edge">
          <div className="panel-b p-5">
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
        </div>
      )}
    </div>
  );
}

function ResultCard({ data, onReset }: { data: Prediction; onReset: () => void }) {
  const cMeta = CLUSTERS_META[data.cluster.id];
  // Kalau backend mengirim id di luar tabel, turunkan ke peninjauan manual daripada crash
  const auto = data.status === "classified" && Boolean(cMeta);
  const laneKey = auto ? cMeta.lane : 'MR';
  const lane = LANES[laneKey];
  
  const reason = !auto
    ? data.runner_up?.label
      ? `${data.cluster.handling}. Kandidat kedua C${data.runner_up.id} (${data.runner_up.label}) terlalu rapat.`
      : data.cluster.handling
    : '';

  const fillColorClass = auto ? 'var(--amber)' : 'var(--bone-dim)';
  const fillWord = auto ? 'Tinggi' : 'Rendah';

  const zsEntries = (data.zero_shot ?? []).slice(0, 3);
  const maxScore = zsEntries[0]?.similarity || 1;

  return (
    <div className="panel res-main">
      <div className="panel-b pt-5">
        <StatusPill auto={auto} text={auto ? "Diterima otomatis" : "Peninjauan manual"} />
        
        {/* PENAMBAHAN KELAS WARNA TERANG text-bone AGAR KONTRAS */}
        <div className="res-title mt-2 flex items-center gap-3">
          <span className="num min-h-6 inline-flex items-center border border-edge px-2 text-bone-dim text-xs">C{data.cluster.id}</span>
          <h3 className="text-2xl font-bold leading-tight text-bone">{auto ? cMeta.name : "Belum dapat dipastikan"}</h3>
        </div>
        <p className="res-sub text-bone-dim mt-1">
          {auto
            ? cMeta.sub
            : `Kandidat terdekat: C${data.cluster.id} (label zero-shot: ${data.cluster.label})`}
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div className="box">
            <span className="label">Confidence margin</span>
            <div className="big-num text-2xl font-mono mt-1 text-bone">
              {fixed4(data.margin)}
              <small className="ml-2 font-sans text-sm font-semibold" style={{ color: fillColorClass }}>{fillWord}</small>
            </div>
            <MarginMeter margin={data.margin} threshold={data.threshold} colorClass={fillColorClass} />
          </div>
          
          <div className="box">
            <span className="label">Tindakan</span>
            <span className="lane text-bone"><i style={{ backgroundColor: lane.color }}></i>{lane.code} · {lane.desc}</span>
            <p className="text-sm mt-1 mb-2 text-bone">{auto ? cMeta.action : reason}</p>
            
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

        <div className="box mt-4">
          <span className="label">Zero-Shot Similarity · 3 Teratas</span>
          <div className="flex flex-col gap-3 mt-2">
            {zsEntries.map((zs, i) => (
              <div key={zs.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-bone capitalize">{zs.label}</span>
                  <span className="text-bone-dim">{fixed4(zs.similarity)}</span>
                </div>
                <div className="h-1.5 bg-edge overflow-hidden">
                  <div 
                    className="h-full bg-bone transition-all duration-500" 
                    style={{ width: `${(zs.similarity / maxScore) * 100}%`, opacity: i === 0 ? 1 : 0.4 }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {data.disclaimer && (
          <p className="mt-4 text-[11px] leading-relaxed text-bone-dim border-t border-edge pt-3">
            {data.disclaimer}
          </p>
        )}

        <button
          type="button"
          onClick={onReset}
          className="mt-4 w-full min-h-12 border border-edge bg-iron-hi text-bone text-xs font-semibold tracking-wide hover:border-amber hover:text-amber transition-colors"
        >
          ANALISIS CITRA BARU
        </button>
      </div>
    </div>
  );
}