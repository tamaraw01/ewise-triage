"""E-WISE Triage API: Hugging Face Space (Docker, FastAPI).

Endpoint:
  GET  /            info ringkas
  GET  /health      status muat model
  GET  /clusters    14 klaster + metrik EXP 14
  POST /predict     unggah satu citra -> putusan triase
"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import engine

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
    return {"status": "ok", "model_loaded": bool(engine._state)}


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
