"""E-WISE Triage API: Hugging Face Space (Docker, FastAPI).

Endpoint:
  GET  /            info ringkas
  GET  /health      status muat model
  GET  /clusters    14 klaster + metrik EXP 14
  POST /predict     unggah satu citra -> putusan triase
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import engine_onnx

# Jalur ONNX INT8 (~630 MB) dipakai bila berkas modelnya ada; kalau tidak,
# jatuh ke jalur torch fp32 (~3,7 GB) yang hanya muat di mesin berRAM besar.
if engine_onnx.tersedia():
    engine = engine_onnx
    BACKEND_ENGINE = "onnx-int8"
else:
    import engine as engine  # noqa: PLC0414
    BACKEND_ENGINE = "torch-fp32"

MAX_BYTES = 12 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/gif"}

app = FastAPI(title="E-WISE Triage API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

ART = Path(__file__).parent / "artifacts"
_meta = json.loads((ART / "meta.json").read_text())
_clusters = json.loads((ART / "clusters.json").read_text())

# True hanya setelah satu inferensi nyata selesai. Pengawas tunnel menunggu
# tanda ini, jadi ia tidak boleh menyala saat bobot baru sekadar termuat.
_siap = False


@app.on_event("startup")
def pramuat() -> None:
    """Muat model sebelum melayani permintaan.

    Memuat saat permintaan pertama membuat pengguna pertama menunggu hingga
    dua menit dan kena batas waktu proksi (Cloudflare memutus di ~100 detik).
    """
    import threading

    def kerjakan() -> None:
        log = logging.getLogger("ewise")
        try:
            engine.get_state()
            log.info("Bobot termuat (%s), memanaskan jalur inferensi", BACKEND_ENGINE)

            # Memuat bobot saja tidak cukup. Lintasan pertama masih membayar
            # alokasi buffer dan pemilihan kernel, dan itu jatuh ke pengguna
            # pertama. Jalankan sekali di sini dengan citra sintetis.
            import io

            from PIL import Image

            buf = io.BytesIO()
            Image.new("RGB", (336, 336), (127, 127, 127)).save(buf, format="JPEG")
            engine.classify(buf.getvalue())
            global _siap
            _siap = True
            log.info("Pemanasan selesai, siap melayani")
        except Exception:
            log.exception("Pramuat model gagal")

    # Di utas terpisah agar systemd tidak menganggap start-up menggantung;
    # permintaan yang datang lebih awal tetap menunggu kunci di get_state().
    threading.Thread(target=kerjakan, name="pramuat", daemon=True).start()


@app.get("/")
def root():
    return {
        "service": "E-WISE Triage API",
        "backbone": _meta["backbone"],
        "clusters": _meta["inference_validation"]["n_clusters"],
        "endpoints": ["/health", "/clusters", "/predict"],
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": _siap,
        "engine": BACKEND_ENGINE,
    }


@app.get("/clusters")
def clusters():
    return {"meta": _meta, "clusters": _clusters}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED:
        raise HTTPException(415, f"Tipe berkas tidak didukung: {file.content_type}")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Berkas kosong")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Berkas melebihi 12 MB")

    try:
        result = engine.classify(data)
    except HTTPException:
        raise
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"error": "Gagal memproses citra", "detail": str(exc)[:200]},
        )

    result["filename"] = file.filename
    result["bytes"] = len(data)
    return result
