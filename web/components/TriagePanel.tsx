"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { fixed4, CLUSTERS_META, LANES, type LaneCode } from "@/lib/data";
import { submitToBackend } from "@/lib/api";
import { MarginMeter, StatusPill, IconWarn } from "./Primitives";
import ClusterMap from "./ClusterMap";
import { automaticLane, candidateLabel, manualReason, parsePrediction, validateFile } from "@/lib/session";

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

export default function TriagePanel({ active = true, onExplore }: { active?: boolean; onExplore?: ExploreHandler }) {
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
    <div className={`console${phase === "done" && result ? " inspection-desk" : ""}`}>
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

      {phase !== "done" && <section className="panel verdict-panel" aria-labelledby="verdict-title" aria-busy={busy}>
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
      {phase === "done" && result && <ResultCard data={result} onReset={reset} onExplore={onExplore} />}
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
  const hazard = laneKey === "P1";
  const reason = !auto
    ? manualReason(data) || (data.runner_up?.label
      ? `${data.cluster.handling}. Kandidat kedua C${data.runner_up.id} (${data.runner_up.label}) terlalu rapat.`
      : data.cluster.handling)
    : "";
  const fill = auto ? "var(--green)" : "var(--bone-dim)";
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
          <div className="result-group">
            <h4 className="label">Kelompok</h4>
            <div className="ticket-id">
              <span className="num chip">C{data.cluster.id}</span>
              <h3 id="result-device">{cMeta?.sub ?? candidateLabel(data) ?? "Kelompok belum pasti"}</h3>
            </div>
            <p className="ticket-sub">{auto ? cMeta.sub : `Kandidat terdekat: C${data.cluster.id} (${candidateLabel(data) ?? "tidak tersedia"})`}</p>
          </div>
          <div className="result-evidence">
            <h4 className="label">Bukti</h4>
            <p><span className="num">{fixed4(data.margin)}</span> margin, {data.margin >= data.threshold ? "di atas" : "di bawah"} ambang <span className="num">{fixed4(data.threshold)}</span>. Skor kemiripan, bukan probabilitas.</p>
            <button type="button" className="btn" onClick={explore}>Lihat kelompok pembanding</button>
            {exploreError && <p className="inline-note" role="alert">{exploreError}</p>}
          </div>
          <div className="inspection-handling">
            <h4 className="label">Status pemeriksaan</h4>
            <StatusPill auto={auto} text={auto ? "Saran kelompok tersedia. Konfirmasi kondisi fisik." : "Periksa barang secara manual."} />
            {auto && cMeta.hazard && <div className="hazard-note"><IconWarn /><span>{cMeta.hazard}</span></div>}
            <p>{auto ? `${cMeta.action} Ikuti SOP fasilitas setelah pemeriksaan fisik.` : reason}</p>
          </div>
          <details className="result-reference">
            <summary>Acuan penanganan · <span className="num">{lane.code}</span></summary>
            <p className={hazard ? "hazard-note" : "dim"}>{lane.name}. {lane.desc}</p>
          </details>
          <button type="button" className="btn btn-primary btn-block" onClick={onReset}>Triase barang berikutnya</button>
        </div>
      </section>

      <section ref={evidenceRef} className="inspection-evidence" aria-labelledby="evidence-title">
        <div className="evidence-heading"><h3 id="evidence-title">Bukti pencocokan</h3><span className="spec">Skor kemiripan, bukan probabilitas</span></div>
        <div className="evidence-columns">
          <div className="evidence-column evidence-margin">
            <h4 className="label">Margin kecocokan klaster</h4>
            <div className="num reading">{fixed4(data.margin)}</div>
            <p className="margin-state" style={{ color: fill }}>{data.margin >= data.threshold ? "Di atas ambang" : "Di bawah ambang"} <span className="num">{fixed4(data.threshold)}</span></p>
            <MarginMeter margin={data.margin} threshold={data.threshold} colorClass={fill} />
            <p className="dim">Selisih dua skor teratas. {auto ? "Tetap periksa kondisi barang." : "Jalur manual tetap berlaku."}</p>
          </div>
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
            <h4 className="label">Catatan barang</h4>
            {auto ? <p><b>Potensi material</b><br />{cMeta.material}. Bukan komposisi yang terdeteksi dari foto.</p> : <p className="dim">Identitas dan jalur penanganan perlu pemeriksaan petugas.</p>}
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
