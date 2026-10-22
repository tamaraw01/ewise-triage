"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { fixed4, CLUSTERS_META, HANDLING_SOURCES, LANES, type LaneCode } from "@/lib/data";
import { submitToBackend } from "@/lib/api";
import { IconWarn } from "./Primitives";
import ClusterMap from "./ClusterMap";
import { automaticLane, candidateLabel, manualExplanation, manualReason, parsePrediction, validateFile } from "@/lib/session";

gsap.registerPlugin(useGSAP);

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

// Returns "" after navigation, or an explicit error when the reference group is absent.
export type ExploreHandler = (clusterId: number) => string;

export default function TriagePanel({ active = true, onExplore, onSave }: { active?: boolean; onExplore?: ExploreHandler; onSave?: (result: Prediction, fileName: string) => Promise<string> }) {
  const [saved, setSaved] = useState(false);
  const saving = useRef<number | null>(null);
  const saveGeneration = useRef(0);
  const [saveError, setSaveError] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const cameraError = error === "Kamera tidak bisa dibuka. Pilih foto dari perangkat.";

  useGSAP(() => {
    if (phase !== "error") return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".error-art, .error-copy", {
        y: 10, opacity: 0, duration: 0.42, stagger: 0.06,
        ease: "power3.out", clearProps: "transform,opacity",
      });
    });
    return () => media.revert();
  }, { scope: errorRef, dependencies: [phase], revertOnUpdate: true });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);
  const cameraStarting = useRef(false);
  const request = useRef<AbortController | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [autoCapture, setAutoCapture] = useState(false);
  const automatic = useRef(false);
  const capturing = useRef(false);
  const [resultFileName, setResultFileName] = useState("");
  const resultRef = useRef<Prediction | null>(null);
  useEffect(() => { resultRef.current = result; }, [result]);

  const releaseCamera = useCallback(() => {
    if (automatic.current) request.current?.abort();
    automatic.current = false;
    capturing.current = false;
    cameraRequest.current += 1;
    cameraStarting.current = false;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopCamera = useCallback(() => {
    if (automatic.current) {
      request.current?.abort();
      setPhase(resultRef.current ? "done" : "idle");
      if (!resultRef.current) setFile(null);
    }
    releaseCamera();
    setAutoCapture(false);
    setCameraActive(false);
    setCameraPending(false);
  }, [releaseCamera]);

  useEffect(() => {
    if (!active) stopCamera();
  }, [active, stopCamera]);
  useEffect(() => releaseCamera, [releaseCamera]);

  useEffect(() => {
    const hide = () => { if (document.hidden) stopCamera(); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [stopCamera]);
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
    saveGeneration.current++;
    request.current?.abort();
    setPhase("idle");
    setSaved(false);
    setSaveError("");
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
      stream.getVideoTracks().forEach(track => track.addEventListener("ended", stopCamera, { once: true }));
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

  const capturePhoto = useCallback(() => {
    if (capturing.current || !videoRef.current || !cameraActive || !videoRef.current.videoWidth || !videoRef.current.videoHeight) return;
    capturing.current = true;
    const id = cameraRequest.current;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    const failCapture = (message: string) => {
      stopCamera();
      setError(message);
      setPhase("error");
    };
    if (!ctx) { failCapture("Foto kamera gagal dibuat."); return; }
    try {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (id !== cameraRequest.current) return;
        capturing.current = false;
        if (!blob) { failCapture("Foto kamera gagal dibuat."); return; }
        const selected = new File([blob], "capture.jpg", { type: "image/jpeg" });
        const validationError = validateFile(selected);
        if (validationError) { failCapture(validationError); return; }
        if (!automatic.current) stopCamera();
        saveGeneration.current++;
        setSaved(false);
        setSaveError("");
        setError("");
        setFile(selected);
        setPreviewUrl(URL.createObjectURL(selected));
        setPhase("idle");
      }, "image/jpeg", 0.9);
    } catch { failCapture("Foto kamera gagal dibuat."); }
  }, [cameraActive, stopCamera]);

  useEffect(() => {
    if (!autoCapture || !cameraActive || !active || (phase !== "done" && !(phase === "idle" && !file))) return;
    const video = videoRef.current;
    const frame = requestAnimationFrame(capturePhoto);
    video?.addEventListener("loadeddata", capturePhoto);
    return () => { cancelAnimationFrame(frame); video?.removeEventListener("loadeddata", capturePhoto); };
  }, [autoCapture, cameraActive, active, phase, file, capturePhoto]);

  const saveResult = useCallback(async (prediction: Prediction, fileName: string) => {
    const generation = saveGeneration.current;
    if (!onSave || saving.current === generation || saved) return;
    saving.current = generation;
    try {
      const message = await onSave(prediction, fileName);
      if (generation !== saveGeneration.current) return;
      setSaveError(message);
      if (!message) setSaved(true);
      else if (automatic.current) stopCamera();
    } catch {
      if (generation === saveGeneration.current) {
        setSaveError("Barang belum tersimpan. Coba lagi.");
        if (automatic.current) stopCamera();
      }
    } finally { if (saving.current === generation) saving.current = null; }
  }, [onSave, saved, stopCamera]);

  const submitAnalysis = useCallback(async () => {
    if (!file) return;

    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPhase("loading");
    if (!automatic.current) setResult(null);
    setError("");
    try {
      const data = await submitToBackend(file, controller.signal);
      if (controller.signal.aborted) return;
      parsePrediction(data);
      setResult(data as Prediction);
      setResultFileName(file.name);
      await saveResult(data as Prediction, file.name);
      if (controller.signal.aborted) return;
      setPhase("done");
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Gagal menghubungi backend");
      stopCamera();
      setPhase("error");
    }
  }, [file, saveResult, stopCamera]);

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
    <div className={`console${result && (phase === "done" || autoCapture) ? " inspection-desk" : ""}`}>
      <p className="sr-only" role="status" aria-live="polite">{busy ? "Citra dikirim, menunggu backend." : phase === "done" ? "Hasil triase tersedia." : phase === "error" ? `Gagal: ${error}` : ""}</p>

      <section className="panel capture-panel" aria-labelledby="input-title" onDrop={onDrop} onDragOver={onDragOver}>
        <div className="panel-h"><h2 id="input-title">Foto barang</h2><span className="num spec">JPG · PNG · WebP ≤ 3 MB</span></div>
        <div className="panel-b">
          {cameraActive ? (
            <div className="camera">
              <video ref={videoRef} autoPlay playsInline muted aria-label="Pratinjau kamera" />
              <div className="camera-actions">
                {autoCapture ? <button type="button" className="btn btn-primary" onClick={stopCamera}>Hentikan otomatis</button> : <>
                  <button type="button" className="btn btn-primary" onClick={capturePhoto} disabled={busy}>Ambil foto</button>
                  <button type="button" className="btn" disabled={busy} onClick={() => {
                    automatic.current = true;
                    setAutoCapture(true);
                    setError("");
                    setPhase(result ? "done" : "idle");
                    if (!result) setFile(null);
                  }}>Mulai otomatis</button>
                  <button type="button" className="btn" onClick={stopCamera}>Batal</button>
                </>}
              </div>
              <p className="scan-note">Foto otomatis dikirim ke backend Hugging Face.</p>
              {autoCapture && <p className="scan-note" role="status">{busy ? "Menunggu prediksi. Foto berikutnya setelah hasil tersedia." : "Pengambilan otomatis aktif."}</p>}

            </div>
          ) : (
            <div className={`drop${previewUrl ? " has-image" : ""}`}>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Pilih citra untuk triase" disabled={busy} onChange={handleFileChange} />
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

      {phase !== "done" && !(autoCapture && result) && <section className="panel verdict-panel" aria-labelledby="verdict-title" aria-busy={busy}>
        <div className="panel-h"><h2 id="verdict-title">Hasil triase</h2></div>
        <div className="panel-b">
          {phase === "idle" && !file && <LaneLegend />}
          {busy && <>
            <ClusterMap scanning />
            <p className="scan-note">Mencocokkan foto dengan klaster…</p>
            <button type="button" className="btn" onClick={reset}>Batalkan triase</button>
          </>}
          {phase === "error" && (
            <div ref={errorRef} className="inline-error" role="alert">
              <div className="error-art"><Image src="/mascot-error.webp" alt="" width={309} height={512} unoptimized className="error-mascot" /></div>
              <div className="error-copy">
                <h3>{cameraError ? "Kamera tidak tersedia" : "Triase gagal"}</h3>
                <p>{cameraError ? "Pilih foto dari perangkat untuk melanjutkan triase." : error}</p>
                <div className="error-actions">
                  {file && <button type="button" className="btn btn-primary" onClick={() => { setError(""); setPhase("idle"); }}>Coba lagi</button>}
                  <button type="button" className={`btn${file ? "" : " btn-primary"}`} onClick={() => fileInputRef.current?.click()}>Pilih foto</button>
                  <button type="button" className="btn error-dismiss" onClick={reset}>Tutup</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>}
      {result && (phase === "done" || autoCapture) && <ResultCard data={result} onReset={reset} onExplore={onExplore} />}
      {result && (phase === "done" || autoCapture) && onSave && <div className="demo-save">
        <button type="button" className="btn btn-primary" disabled={saved || autoCapture || busy} onClick={() => saveResult(result, resultFileName || file?.name || "Foto barang")}>{saved ? "Barang sudah dicatat" : "Catat barang ini"}</button>
        <p role="status">{saved ? "Tersimpan di browser ini." : "Foto tidak ikut disimpan."}</p>
        {saveError && <p role="alert">{saveError}</p>}
      </div>}
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

function ResultCard({ data, onReset, onExplore }: { data: Prediction; onReset: () => void; onExplore?: ExploreHandler }) {
  const evidenceRef = useRef<HTMLDivElement>(null);
  const [exploreError, setExploreError] = useState("");
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".evidence-column", {
        y: 12, opacity: 0, duration: 0.45, stagger: 0.07,
        ease: "power2.out", clearProps: "transform,opacity",
      });
    });
    return () => media.revert();
  }, { scope: evidenceRef });

  const cMeta = CLUSTERS_META[data.cluster.id];
  const auto = Boolean(cMeta) && automaticLane(data) !== "MR";
  const laneKey: LaneCode = auto ? cMeta.lane : "MR";
  const lane = LANES[laneKey];
  const explanation = manualExplanation(data.cluster.id);
  const reason = manualReason(data) || "Jenis barang belum pasti. Petugas perlu memeriksa sebelum memilih jalur.";
  const candidates = (Array.isArray(data.ranking) ? data.ranking : [])
    .filter(candidate => candidate && Number.isInteger(candidate.cluster) && candidate.cluster >= 0 &&
      (candidate.label === null || typeof candidate.label === "string") && Number.isFinite(candidate.similarity))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
  const zsEntries = (data.zero_shot ?? []).slice(0, 3);
  const explore = () => {
    if (!onExplore) return setExploreError("Kelompok pembanding tidak tersedia.");
    setExploreError(onExplore(data.cluster.id));
  };

  return (
    <>
      <section className="inspection-verdict" aria-labelledby="result-device">
        <div className="inspection-decision">
          <header className={`result-route${laneKey === "P1" || !auto ? " needs-check" : ""}`} aria-label={`Saran jalur ${lane.code}: ${lane.name}`}>
            <span className="num lane-code">{lane.code}</span>
            <div><span className="label">Saran jalur</span><h3>{lane.name}</h3></div>
          </header>
          <div className="result-group">
            <h4 className="label">{auto ? "Kelompok barang" : "Kandidat kelompok"}</h4>
            <div className="ticket-id">
              <span className="num chip">C{data.cluster.id}</span>
              <h3 id="result-device">{cMeta?.sub ?? candidateLabel(data) ?? "Kelompok belum pasti"}</h3>
            </div>
          </div>
          <div className="inspection-handling">
            <h4 className="label">Penanganan awal</h4>
            {auto && cMeta.hazard && <div className="hazard-note"><IconWarn /><span>{cMeta.hazard}</span></div>}
            <p>{!auto && explanation ? `${explanation.title}. ${explanation.body}` : auto ? cMeta.action : reason}</p>
            {!auto && <p className="hazard-note">Jangan bongkar, pecahkan, atau cacah sebelum diperiksa.</p>}
            <small className="dim">Konfirmasi fisik dan SOP fasilitas tetap wajib.</small>
          </div>
          <button type="button" className="btn" onClick={explore}>Lihat kelompok pembanding</button>
          {exploreError && <p className="inline-note" role="alert">{exploreError}</p>}
          <button type="button" className="btn btn-primary btn-block" onClick={onReset}>Triase barang berikutnya</button>
        </div>
      </section>

      <section ref={evidenceRef} className="inspection-evidence" aria-labelledby="evidence-title">
        <div className="evidence-heading"><h3 id="evidence-title">Hasil pencocokan</h3><span className="spec">Kemiripan, bukan probabilitas</span></div>
        <div className="evidence-columns">
          <div className="evidence-column evidence-ranking">
            <h4 className="label">Kandidat klaster</h4>
            <div className="signed-scale num" aria-hidden="true"><span>−1</span><span>0</span><span>1</span></div>
            {candidates.length > 0 ? (
              <ol className="candidate-list" aria-label="Kandidat menurut similaritas tertinggi, skala minus satu sampai satu">
                {candidates.map((candidate, i) => {
                  const score = Math.max(-1, Math.min(1, candidate.similarity));
                  return (
                    <li key={`${candidate.cluster}-${i}`}>
                      <div className="candidate-row"><span><span className="num">C{candidate.cluster}</span> {CLUSTERS_META[candidate.cluster]?.sub ?? candidate.label ?? "Nama tidak tersedia"}</span><span className="num">{fixed4(candidate.similarity)}</span></div>
                      <div className="signed-bar" aria-hidden="true"><i style={{ left: `${score < 0 ? 50 + score * 50 : 50}%`, width: `${Math.abs(score) * 50}%` }} /></div>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="dim">Peringkat kandidat tidak tersedia.</p>}
          </div>
          <div className="evidence-column evidence-detail">
            <h4 className="label">Potensi material</h4>
            {auto ? <><p>{cMeta.material}</p><p className="spec dim">Acuan jenis barang, bukan kandungan terukur.</p></> : <p className="dim">Belum ditentukan. Tunggu pemeriksaan fisik.</p>}
            <details className="block handling-sources">
              <summary>Sumber penanganan</summary>
              <ul>{HANDLING_SOURCES.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a></li>)}</ul>
              <p className="spec dim">Acuan teknis, bukan jaminan keamanan. Sumber luar negeri tidak menggantikan ketentuan Indonesia.</p>
            </details>
            <details className="block technical-evidence">
              <summary>Detail teknis</summary>
              <dl className="facts"><div><dt>Selisih dua skor teratas</dt><dd className="num">{fixed4(data.margin)}</dd></div><div><dt>Ambang tinjau</dt><dd className="num">{fixed4(data.threshold)}</dd></div></dl>
              <p className="spec dim">Nilai ini bukan peluang benar atau ukuran keamanan barang.</p>
            </details>
            {zsEntries.length > 0 && (
              <details className="zs block">
                <summary>Detail label</summary>
                <p className="dim">Skor kemiripan label: −1 sampai 1.</p>
                {zsEntries.map(zs => <div key={zs.label} className="zs-row"><span>{zs.label}</span><span className="num">{fixed4(zs.similarity)}</span></div>)}
              </details>
            )}
          </div>
        </div>
        {data.disclaimer && <p className="disclaimer">{data.disclaimer}</p>}
      </section>
    </>
  );
}
