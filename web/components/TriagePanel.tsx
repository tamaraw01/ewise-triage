"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { fixed4, CLUSTERS_META, LANES, type LaneCode } from "@/lib/data";
import { submitToBackend } from "@/lib/api";
import { MarginMeter, StatusPill, IconWarn } from "./Primitives";
import ClusterMap from "./ClusterMap";
import { automaticLane, candidateLabel, manualReason, parsePrediction, validateFile } from "@/lib/session";

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

export default function TriagePanel({ active = true }: { active?: boolean }) {
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);
  const cameraStarting = useRef(false);
  const request = useRef<AbortController | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);

  const releaseCamera = useCallback(() => {
    cameraRequest.current += 1;
    cameraStarting.current = false;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopCamera = useCallback(() => {
    releaseCamera();
    setCameraActive(false);
    setCameraPending(false);
  }, [releaseCamera]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Stop external camera tracks and sync controls when this tab becomes hidden.
    if (!active) stopCamera();
    return releaseCamera;
  }, [active, releaseCamera, stopCamera]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  useEffect(() => {
    const video = videoRef.current;
    if (cameraActive && video) video.srcObject = streamRef.current;
    return () => { if (video) video.srcObject = null; };
  }, [cameraActive]);

  const reset = useCallback(() => {
    request.current?.abort();
    setPhase("idle");
    setResult(null);
    setError("");
    setPreviewUrl("");
    setFile(null);
    stopCamera();
  }, [stopCamera]);

  const selectFile = (selected: File) => {
    reset();
    const validationError = validateFile(selected);
    if (validationError) {
      setError(validationError);
      setPhase("error");
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (selected && phase !== "loading") selectFile(selected);
  };

  const startCamera = async () => {
    if (!active || cameraStarting.current || cameraActive || phase === "loading") return;
    const id = ++cameraRequest.current;
    cameraStarting.current = true;
    setCameraPending(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      if (id !== cameraRequest.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      if (id !== cameraRequest.current) return;
      setError("Kamera tidak bisa dibuka. Pilih foto dari perangkat.");
      setPhase("error");
    } finally {
      if (id === cameraRequest.current) {
        cameraStarting.current = false;
        setCameraPending(false);
      }
    }
  };

  // Jepret frame dari video feed, jadikan File, biarkan auto-submit yang jalan
  const capturePhoto = () => {
    if (!videoRef.current || !cameraActive || !videoRef.current.videoWidth || !videoRef.current.videoHeight) return;
    const id = cameraRequest.current;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob || id !== cameraRequest.current) return;
      selectFile(new File([blob], "capture.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  };

  const submitAnalysis = useCallback(async () => {
    if (!file) return;

    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPhase("loading");
    setResult(null);
    setError("");
    try {
      const data = await submitToBackend(file, controller.signal);
      if (controller.signal.aborted) return;
      parsePrediction(data);
      setResult(data as Prediction);
      setPhase("done");
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Gagal menghubungi backend");
      setPhase("error");
    }
  }, [file]);

  // Auto-submit saat file terisi dari DragDrop / Browse / Capture Kamera
  useEffect(() => {
    if (file && phase === "idle") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Start the external analysis request and sync its loading state for each selected file or retry.
      submitAnalysis();
    }
  }, [file, phase, submitAnalysis]);

  // File drop
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (phase !== "loading" && dropped) selectFile(dropped);
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const busy = phase === "loading";

  return (
    <div className="console">
      <p className="sr-only" role="status" aria-live="polite">{busy ? "Citra dikirim, menunggu backend." : phase === "done" ? "Hasil triase tersedia." : phase === "error" ? `Gagal: ${error}` : ""}</p>

      <section className="panel capture-panel" aria-labelledby="input-title" onDrop={onDrop} onDragOver={onDragOver}>
        <div className="panel-h"><h2 id="input-title">Foto barang</h2><span className="num spec">JPG · PNG · WebP ≤ 3 MB</span></div>
        <div className="panel-b">
          {cameraActive ? (
            <div className="camera">
              <video ref={videoRef} autoPlay playsInline muted aria-label="Pratinjau kamera" />
              <div className="camera-actions">
                <button type="button" className="btn btn-primary" onClick={capturePhoto}>Ambil foto</button>
                <button type="button" className="btn" onClick={stopCamera}>Batal</button>
              </div>
            </div>
          ) : (
            <div className={`drop${previewUrl ? " has-image" : ""}`}>
              <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Pilih citra untuk triase" disabled={busy} onChange={handleFileChange} />
              {previewUrl
                // eslint-disable-next-line @next/next/no-img-element -- User-selected blob URL stays in the browser; server image optimization cannot fetch it.
                ? <img src={previewUrl} alt="Citra yang sedang ditriase" />
                : <div className="drop-copy"><svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M16 5H5v11M32 5h11v11M5 32v11h11M43 32v11H32M24 33V15m-7 7 7-7 7 7" /></svg><b>Pilih foto barang</b><span>atau seret berkas ke bidang ini</span><small>Satu barang, latar polos, pencahayaan cukup.</small></div>}
            </div>
          )}
          {!cameraActive && (
            <div className="capture-bar">
              <span className="num">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : "Satu foto per triase"}</span>
              {cameraPending && <button type="button" className="btn" onClick={stopCamera}>Batal</button>}
              <button type="button" className="btn" onClick={startCamera} disabled={busy || cameraPending || !active}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                {cameraPending ? "Membuka kamera…" : "Kamera"}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="panel verdict-panel" aria-labelledby="verdict-title" aria-busy={busy}>
        <div className="panel-h"><h2 id="verdict-title">Hasil triase</h2></div>
        <div className="panel-b">
          {phase === "idle" && !file && <LaneLegend />}
          {busy && <>
            <ClusterMap scanning />
            <p className="scan-note">Mencocokkan foto dengan klaster…</p>
            <button type="button" className="btn" onClick={reset}>Batalkan triase</button>
          </>}
          {phase === "done" && result && <ResultCard data={result} onReset={reset} />}
          {phase === "error" && (
            <div className="inline-error" role="alert">
              <Image src="/mascot-error.webp" alt="" width={309} height={512} unoptimized className="error-mascot" />
              <b>Triase gagal</b>
              <span className="dim">{error}</span>
              <div><button type="button" className="btn" onClick={() => { setError(""); if (file) setPhase("idle"); else reset(); }}>{file ? "Coba lagi" : "Tutup"}</button></div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const LEGEND: LaneCode[] = ["P1", "P2", "P3", "MR"];

function LaneLegend() {
  return (
    <div className="verdict-empty">
      <h3>Menunggu foto</h3>
      <ul className="lane-legend" aria-label="Panduan jalur penanganan" style={{ marginTop: 16 }}>
        {LEGEND.map(code => (
          <li key={code}>
            <span className="num">{code}</span>
            <span>{LANES[code].name}<small>{LANES[code].desc}</small></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultCard({ data, onReset }: { data: Prediction; onReset: () => void }) {
  const cMeta = CLUSTERS_META[data.cluster.id];
  // Id di luar tabel turun ke peninjauan manual, bukan crash
  const auto = Boolean(cMeta) && automaticLane(data) !== "MR";
  const laneKey: LaneCode = auto ? cMeta.lane : "MR";
  const lane = LANES[laneKey];
  const hazard = laneKey === "P1";

  const reason = !auto
    ? manualReason(data) || (data.runner_up?.label
      ? `${data.cluster.handling}. Kandidat kedua C${data.runner_up.id} (${data.runner_up.label}) terlalu rapat.`
      : data.cluster.handling)
    : "";

  const fill = auto ? "var(--green)" : "var(--bone-dim)";
  const zsEntries = (data.zero_shot ?? []).slice(0, 3);
  const maxScore = zsEntries[0]?.similarity || 1;

  return (
    <>
      <div className={`ticket-lane${hazard ? " is-hazard" : ""}${auto ? "" : " is-manual"}`}>
        <span className="num lane-code">{lane.code}</span>
        <span><b>{lane.name}</b><small>{lane.desc}</small></span>
      </div>

      <StatusPill auto={auto} text={auto ? "Jalur otomatis, tetap periksa fisik" : "Peninjauan manual"} />

      <div className="ticket-id">
        <span className="num chip">C{data.cluster.id}</span>
        <h3>{auto ? cMeta.name : "Belum dapat dipastikan"}</h3>
      </div>
      <p className="ticket-sub">{auto ? cMeta.sub : `Kandidat terdekat: C${data.cluster.id} (${candidateLabel(data) ?? "tidak tersedia"})`}</p>

      <div className="block">
        <span className="label">Margin kecocokan klaster</span>
        <div className="num reading">{fixed4(data.margin)}<small style={{ color: fill }}>{data.margin >= data.threshold ? "di atas ambang" : "di bawah ambang"}</small></div>
        <MarginMeter margin={data.margin} threshold={data.threshold} colorClass={fill} /><p className="dim">Selisih similaritas foto ke dua centroid teratas, bukan probabilitas benar.</p>
      </div>

      <div className="block">
        <span className="label">Penanganan oleh petugas terlatih</span>
        {auto && cMeta.hazard && <div className="hazard-note"><IconWarn /><span>{cMeta.hazard}</span></div>}
        <p>{auto ? `${cMeta.action} Ikuti SOP fasilitas setelah pemeriksaan fisik.` : reason}</p>
        {auto && <p className="dim"><b className="text-bone">Potensi material:</b> {cMeta.material}. Bukan komposisi yang terdeteksi dari foto.</p>}
      </div>

      {zsEntries.length > 0 && (
        <details className="zs block">
          <summary>Detail zero-shot</summary>
          {zsEntries.map((zs, i) => (
            <div key={zs.label}>
              <div className="zs-row num"><span>{zs.label}</span><span className="dim">{fixed4(zs.similarity)}</span></div>
              <div className="zs-bar"><i style={{ width: `${(zs.similarity / maxScore) * 100}%`, opacity: i === 0 ? 1 : 0.4 }} /></div>
            </div>
          ))}
        </details>
      )}

      {data.disclaimer && <p className="disclaimer">{data.disclaimer}</p>}

      <button type="button" className="btn btn-block" onClick={onReset}>Triase barang berikutnya</button>
    </>
  );
}
