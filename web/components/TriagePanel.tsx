"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, fixed4, CLUSTERS_META, LANES } from "@/lib/data";
import { MarginMeter, StatusPill, IconWarn } from "./Primitives";
import ClusterMap from "./ClusterMap";

type Prediction = {
  status: "classified" | "manual";
  margin: number;
  threshold: number;
  cluster: { id: number; label: string };
  runner_up: { id: number; label: string };
  zs_scores: Record<string, number>;
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
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

  // Handle capture
  const capturePhoto = () => {
    if (!videoRef.current || !cameraActive) return;
    
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        reset();
        setFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        stopCamera();
      }
    }, "image/jpeg", 0.9);
  };

  const submitAnalysis = async () => {
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
      const base = API_BASE?.replace(/\/$/, "");
      const res = await fetch(`${base}/predict`, {
        method: "POST",
        body: formData
      });
      
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
  };

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

  // Ping backend 24/7 (prevent idle)
  useEffect(() => {
    if (!API_BASE) return;
    const base = API_BASE.replace(/\/$/, "");
    const doPing = () => fetch(`${base}/health`).catch(() => {});
    
    doPing();
    const iv = setInterval(doPing, 4 * 60 * 1000);
    return () => clearInterval(iv);
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
            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 h-12 border border-edge bg-iron hover:bg-iron-hi flex items-center justify-center font-semibold text-xs tracking-wide text-bone"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  UNGGAH BERKAS
                </button>
                <button 
                  onClick={startCamera}
                  className="flex-1 h-12 border border-edge bg-iron hover:bg-iron-hi flex items-center justify-center font-semibold text-xs tracking-wide text-bone"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  BUKA KAMERA
                </button>
              </div>

              <div className="relative border border-dashed border-edge p-6 flex flex-col items-center justify-center text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <p className="text-xs text-bone-dim">Pilih tombol di atas atau seret foto kemari (Format JPG, PNG)</p>
              </div>
            </div>
          )}

          {/* Tombol Aksi Utama */}
          {file && !cameraActive && phase === "idle" && (
            <button
              onClick={submitAnalysis}
              className="mt-2 w-full min-h-12 border border-amber bg-amber/10 text-amber text-xs font-semibold tracking-wide hover:bg-amber hover:text-void transition-colors"
            >
              MULAI ANALISIS
            </button>
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
  const auto = data.status === "classified";
  const cMeta = CLUSTERS_META[data.cluster.id];
  const laneKey = auto ? cMeta.lane : 'MR';
  const lane = LANES[laneKey];
  
  const reason = !auto 
    ? `Selisih skor ke klaster kedua (C${data.runner_up.id} · ${data.runner_up.label}) terlalu kecil. Objek ambigu atau jenis langka, jadi petugas yang memeriksa.` 
    : '';

  const fillColorClass = auto ? 'var(--amber)' : 'var(--bone-dim)';
  const fillWord = auto ? 'Tinggi' : 'Rendah';

  const zsEntries = Object.entries(data.zs_scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  const maxScore = zsEntries[0]?.[1] || 1;

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
          {auto ? cMeta.sub : `Kandidat terdekat: C${cMeta.id} · ${cMeta.sub} (label zero-shot: ${data.cluster.label})`}
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
            {zsEntries.map(([label, score], i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-bone capitalize">{label}</span>
                  <span className="text-bone-dim">{fixed4(score)}</span>
                </div>
                <div className="h-1.5 bg-edge overflow-hidden">
                  <div 
                    className="h-full bg-bone transition-all duration-500" 
                    style={{ width: `${(score / maxScore) * 100}%`, opacity: i === 0 ? 1 : 0.4 }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

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