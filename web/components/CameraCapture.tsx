"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onCapture: (file: File) => void;
  disabled?: boolean;
};

type CamPhase = "off" | "starting" | "live" | "denied" | "unsupported";

/** Kamera langsung: aliran video perangkat dijepret ke satu berkas JPEG.
 *  Dipakai petugas lapangan yang memegang barang, bukan berkas. */
export default function CameraCapture({ onCapture, disabled }: Props) {
  const [phase, setPhase] = useState<CamPhase>("off");
  const [error, setError] = useState("");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [devices, setDevices] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPhase("off");
  }, []);

  const start = useCallback(
    async (mode: "environment" | "user") => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setPhase("unsupported");
        setError(
          "Peramban ini tidak menyediakan akses kamera. Gunakan jalur unggah berkas, atau buka lewat HTTPS.",
        );
        return;
      }
      setPhase("starting");
      setError("");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setPhase("live");
        const list = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setDevices(list.filter((d) => d.kind === "videoinput").length);
      } catch (err) {
        setPhase("denied");
        const name = err instanceof Error ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Izin kamera ditolak. Berikan izin pada peramban, lalu nyalakan ulang kamera."
            : name === "NotFoundError"
              ? "Tidak ada kamera yang terbaca pada perangkat ini. Gunakan jalur unggah berkas."
              : "Kamera gagal dinyalakan. Periksa apakah aplikasi lain sedang memakainya.",
        );
      }
    },
    [],
  );

  useEffect(() => stop, [stop]);

  const shoot = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        onCapture(new File([blob], `kamera-${stamp}.jpg`, { type: "image/jpeg" }));
        stop();
      },
      "image/jpeg",
      0.92,
    );
  }, [onCapture, stop]);

  const flip = () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    void start(next);
  };

  return (
    <div className="mt-4">
      {phase === "off" ? (
        <button
          type="button"
          onClick={() => void start(facing)}
          disabled={disabled}
          className="min-h-11 w-full border border-dashed border-edge bg-void px-4 py-6 text-center transition-colors hover:border-amber disabled:opacity-50"
        >
          <span className="num block text-xs tracking-wider text-amber">NYALAKAN KAMERA</span>
          <span className="mt-1 block text-xs text-bone-dim">
            Arahkan ke barang, lalu jepret satu bingkai
          </span>
        </button>
      ) : null}

      {phase === "starting" ? (
        <p className="border border-edge bg-void px-4 py-6 text-center text-xs text-bone-dim">
          Meminta izin kamera. Setujui permintaan yang muncul di peramban.
        </p>
      ) : null}

      {phase === "denied" || phase === "unsupported" ? (
        <div className="border-l-2 border-amber bg-void px-4 py-4">
          <p className="text-xs leading-relaxed text-bone">{error}</p>
          {phase === "denied" ? (
            <button
              type="button"
              onClick={() => void start(facing)}
              className="num mt-3 min-h-11 border border-amber px-4 py-2 text-[11px] font-semibold tracking-wider text-amber"
            >
              COBA LAGI
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={phase === "live" ? "block" : "hidden"}>
        {/* Cermin hanya untuk kamera depan, agar gerak tangan petugas terasa benar. */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full border border-edge bg-void"
          style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={shoot}
            className="num min-h-11 flex-1 border border-amber bg-amber px-4 py-2 text-[11px] font-semibold tracking-wider text-void"
          >
            JEPRET DAN KIRIM
          </button>
          {devices > 1 ? (
            <button
              type="button"
              onClick={flip}
              className="num min-h-11 border border-edge px-4 py-2 text-[11px] font-semibold tracking-wider transition-colors hover:border-amber"
            >
              BALIK KAMERA
            </button>
          ) : null}
          <button
            type="button"
            onClick={stop}
            className="num min-h-11 border border-edge px-4 py-2 text-[11px] font-semibold tracking-wider transition-colors hover:border-amber"
          >
            MATIKAN
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-bone-dim">
          Bingkai dikirim sebagai JPEG sekali pakai. Tidak ada rekaman yang disimpan di peramban.
        </p>
      </div>
    </div>
  );
}
