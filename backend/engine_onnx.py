"""Mesin inference E-WISE Triage, jalur ONNX Runtime (tanpa torch).

Rantai identik dengan engine.py: citra -> CLIP ViT-H/14 (menara visual, ONNX INT8)
-> L2 -> cosine ke 14 centroid klaster (EXP 14) -> label zero-shot + margin top1-top2.
Margin di bawah ambang empiris -> status 'review', tanpa label.

Beda dari engine.py: bobot dimuat dari artifacts/visual_encoder_int8.onnx (~630 MB)
alih-alih safetensors fp32 (~3,7 GB), sehingga muat di kontainer berplafon 2 GB.
Preprocessing direplikasi dengan Pillow + NumPy agar torchvision tidak diperlukan.
"""
from __future__ import annotations

import io
import json
import logging
import threading
from pathlib import Path

import numpy as np
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True
log = logging.getLogger("ewise")

ART = Path(__file__).parent / "artifacts"
ONNX_PATH = ART / "visual_encoder_int8.onnx"

_lock = threading.Lock()
_state: dict = {}


def tersedia() -> bool:
    """Jalur ONNX hanya dipakai bila berkas modelnya benar-benar ada."""
    return ONNX_PATH.exists()


def _load_artifacts() -> dict:
    centroids = np.load(ART / "centroids.npy").astype(np.float32)
    clusters = json.loads((ART / "clusters.json").read_text())
    meta = json.loads((ART / "meta.json").read_text())
    norms = np.linalg.norm(centroids, axis=1, keepdims=True)
    centroids = centroids / np.clip(norms, 1e-12, None)

    text_emb_path = ART / "text_emb.npy"
    if not text_emb_path.exists():
        raise RuntimeError(
            "text_emb.npy wajib ada pada jalur ONNX: menara teks tidak diekspor, "
            "jadi embedding teks tidak bisa dihitung ulang saat runtime."
        )
    text_emb = np.load(text_emb_path).astype(np.float32)

    prep = json.loads((ART / "preprocess.json").read_text())

    return {
        "centroids": centroids,
        "clusters": {c["id"]: c for c in clusters},
        "cluster_list": clusters,
        "meta": meta,
        "threshold": float(meta["review_margin_threshold"]),
        "classes": list(meta["classes"]),
        "text_emb": text_emb,
        "prep": prep,
    }


def get_state() -> dict:
    """Muat sesi ONNX sekali, aman dipanggil dari beberapa permintaan sekaligus."""
    with _lock:
        if _state:
            return _state

        import onnxruntime as ort

        art = _load_artifacts()

        opts = ort.SessionOptions()
        # Satu utas: kontainer hanya punya 2 core, dan antrean permintaan
        # lebih murah daripada rebutan thread di dalam satu inferensi.
        opts.intra_op_num_threads = 1
        opts.inter_op_num_threads = 1
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        sess = ort.InferenceSession(
            str(ONNX_PATH), sess_options=opts, providers=["CPUExecutionProvider"]
        )
        log.info("Sesi ONNX dimuat: %s", ONNX_PATH.name)

        art["sess"] = sess
        art["input_name"] = sess.get_inputs()[0].name
        _state.update(art)
        return _state


def _preprocess(img: Image.Image, prep: dict) -> np.ndarray:
    """Replikasi transform open_clip: resize sisi pendek -> center crop -> normalisasi.

    open_clip memakai Resize(size, bicubic) yang menskalakan sisi TERPENDEK ke `size`
    sambil menjaga rasio aspek, lalu CenterCrop(size).
    """
    size = int(prep["size"])
    w, h = img.size
    if w <= h:
        target = (size, max(size, round(h * size / w)))
    else:
        target = (max(size, round(w * size / h)), size)
    img = img.resize(target, Image.BICUBIC)

    w, h = img.size
    kiri = (w - size) // 2
    atas = (h - size) // 2
    img = img.crop((kiri, atas, kiri + size, atas + size))

    x = np.asarray(img, dtype=np.float32) / 255.0
    mean = np.asarray(prep["mean"], dtype=np.float32)
    std = np.asarray(prep["std"], dtype=np.float32)
    x = (x - mean) / std
    return np.ascontiguousarray(x.transpose(2, 0, 1)[None], dtype=np.float32)


def embed(image_bytes: bytes) -> np.ndarray:
    """Citra -> vektor CLIP ternormalisasi L2 (1024 dimensi)."""
    st = get_state()
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    x = _preprocess(img, st["prep"])
    v = st["sess"].run(None, {st["input_name"]: x})[0][0].astype(np.float32)
    return (v / max(float(np.linalg.norm(v)), 1e-12)).astype(np.float32)


def classify(image_bytes: bytes) -> dict:
    """Putusan triase untuk satu citra, beserta bukti angkanya."""
    st = get_state()
    v = embed(image_bytes)

    scores = st["centroids"] @ v
    order = np.argsort(-scores)
    top1, top2 = int(order[0]), int(order[1])
    margin = float(scores[top1] - scores[top2])
    accepted = margin >= st["threshold"]

    c1 = st["clusters"][top1]
    c2 = st["clusters"][top2]

    zs = st["text_emb"] @ v
    zs_order = np.argsort(-zs)
    zero_shot = [
        {"label": st["classes"][int(i)], "similarity": round(float(zs[int(i)]), 4)}
        for i in zs_order[:4]
    ]

    ranking = [
        {
            "cluster": int(i),
            "label": st["clusters"][int(i)]["label"],
            "similarity": round(float(scores[int(i)]), 4),
        }
        for i in order[:5]
    ]

    return {
        "status": "classified" if accepted else "review",
        "margin": round(margin, 4),
        "threshold": round(st["threshold"], 4),
        "top_similarity": round(float(scores[top1]), 4),
        "cluster": {
            "id": top1,
            "label": c1["label"] if accepted else None,
            "route": c1["route"] if accepted else "MANUAL_REVIEW",
            "handling": c1["handling"] if accepted else "Margin keyakinan di bawah ambang, perlu pemeriksaan petugas",
            "n_images": c1["n_images"],
            "purity": c1["purity"],
            "contested": c1["purity"] < 0.5,
        },
        "runner_up": {"id": top2, "label": c2["label"]},
        "ranking": ranking,
        "zero_shot": zero_shot,
        "disclaimer": "Label adalah dugaan taksonomis dari kedekatan visual, bukan pemeriksaan isi fisik barang.",
    }
