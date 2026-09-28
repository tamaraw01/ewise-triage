"""Mesin inference E-WISE Triage.

Rantai: citra -> CLIP ViT-H/14 -> L2 -> cosine ke 14 centroid klaster (EXP 14)
-> klaster terdekat -> label zero-shot klaster + margin top1-top2.
Margin di bawah ambang empiris -> status 'review', tanpa label.
"""
from __future__ import annotations

import io
import json
import threading
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

ART = Path(__file__).parent / "artifacts"
MODEL_NAME = "ViT-H-14"
PRETRAIN = "laion2b_s32b_b79k"

_lock = threading.Lock()
_state: dict = {}


def _load_artifacts() -> dict:
    centroids = np.load(ART / "centroids.npy").astype(np.float32)
    clusters = json.loads((ART / "clusters.json").read_text())
    meta = json.loads((ART / "meta.json").read_text())
    norms = np.linalg.norm(centroids, axis=1, keepdims=True)
    centroids = centroids / np.clip(norms, 1e-12, None)
    return {
        "centroids": centroids,
        "clusters": {c["id"]: c for c in clusters},
        "cluster_list": clusters,
        "meta": meta,
        "threshold": float(meta["review_margin_threshold"]),
        "classes": list(meta["classes"]),
    }


def get_state() -> dict:
    """Muat model sekali, aman dipanggil dari beberapa permintaan sekaligus."""
    with _lock:
        if _state:
            return _state
        import open_clip

        art = _load_artifacts()
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model, _, preprocess = open_clip.create_model_and_transforms(
            MODEL_NAME, pretrained=PRETRAIN, device=device
        )
        model.eval()
        tokenizer = open_clip.get_tokenizer(MODEL_NAME)

        prompts = [f"a photo of {c}" for c in art["classes"]]
        with torch.no_grad():
            txt = model.encode_text(tokenizer(prompts).to(device))
            txt = txt / txt.norm(dim=-1, keepdim=True)
        art["text_emb"] = txt.cpu().float().numpy()

        art["model"] = model
        art["preprocess"] = preprocess
        art["device"] = device
        _state.update(art)
        return _state


def embed(image_bytes: bytes) -> np.ndarray:
    """Citra -> vektor CLIP ternormalisasi L2 (1024 dimensi)."""
    st = get_state()
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = st["preprocess"](img).unsqueeze(0).to(st["device"])
    with torch.no_grad():
        v = st["model"].encode_image(tensor)
    v = v.cpu().float().numpy()[0]
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
